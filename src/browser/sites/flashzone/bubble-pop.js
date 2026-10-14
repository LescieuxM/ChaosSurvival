import { textElement as node } from '../../dom.js';
import { BubbleRound, bestScore, saveBestScore } from './bubble-round.js';
export function renderBubblePop({ progression, onDispose }, game) {
  const root = node('section', undefined, 'bubble-pop');
  const intro = node('div', undefined, 'bubble-intro');
  intro.append(
    node('h2', game.title),
    node('p', 'Clique sur les bulles colorées : 10 points par bulle. Tu as 30 secondes !'),
  );
  const play = node('button', 'JOUER', 'bubble-play');
  intro.append(play);
  const stats = node('div', undefined, 'bubble-stats'),
    score = node('strong'),
    time = node('span');
  stats.append(score, time);
  stats.hidden = true;
  const arena = node('div', undefined, 'bubble-arena');
  arena.setAttribute('aria-label', 'Bulles à éclater');
  arena.hidden = true;
  const result = node('div', undefined, 'bubble-result');
  result.hidden = true;
  const final = node('strong'),
    best = node('p'),
    replay = node('button', 'REJOUER', 'bubble-replay');
  result.append(node('h3', 'TEMPS ÉCOULÉ !'), final, best, replay);
  root.append(intro, stats, arena, result);
  const round = new BubbleRound(),
    elements = new Map();
  let frame = null,
    disposed = false;
  function dispose() {
    disposed = true;
    cancelAnimationFrame(frame);
    frame = null;
    round.stop();
    elements.clear();
    arena.replaceChildren();
  }
  onDispose(dispose);
  function render(now) {
    score.textContent = `Score : ${round.score}`;
    time.textContent = `Temps : ${round.seconds(now)} s`;
    const ids = new Set(round.bubbles.map((b) => b.id));
    for (const [id, element] of elements)
      if (!ids.has(id)) {
        element.remove();
        elements.delete(id);
      }
    for (const bubble of round.bubbles) {
      if (elements.has(bubble.id)) continue;
      const button = node('button', undefined, `bubble-target bubble-color-${bubble.color}`);
      button.setAttribute('aria-label', 'Éclater une bulle');
      button.style.left = `calc(${bubble.x * 100}% - ${bubble.x * 46}px)`;
      button.style.top = `calc(${bubble.y * 100}% - ${bubble.y * 46}px)`;
      button.addEventListener('click', () => {
        if (disposed) return;
        if (round.pop(bubble.id, performance.now())) {
          const effect = node('span', '✦', 'bubble-burst');
          effect.style.left = button.style.left;
          effect.style.top = button.style.top;
          effect.addEventListener('animationend', () => effect.remove(), { once: true });
          arena.append(effect);
        }
        render(performance.now());
      });
      elements.set(bubble.id, button);
      arena.append(button);
    }
  }
  function loop(now) {
    if (disposed) return;
    if (!root.isConnected) {
      dispose();
      return;
    }
    round.tick(now);
    render(now);
    if (!round.active) {
      frame = null;
      stats.hidden = true;
      arena.hidden = true;
      arena.replaceChildren();
      elements.clear();
      result.hidden = false;
      final.textContent = `Score final : ${round.score}`;
      best.textContent = `Meilleur score : ${saveBestScore(progression, game.id, round.score)}`;
      return;
    }
    frame = requestAnimationFrame(loop);
  }
  function start() {
    if (disposed || round.active) return;
    cancelAnimationFrame(frame);
    arena.replaceChildren();
    elements.clear();
    intro.hidden = true;
    result.hidden = true;
    stats.hidden = false;
    arena.hidden = false;
    round.start(performance.now());
    round.tick(performance.now());
    render(performance.now());
    frame = requestAnimationFrame(loop);
  }
  play.addEventListener('click', start);
  replay.addEventListener('click', start);
  intro.append(node('small', `Meilleur score : ${bestScore(progression, game.id)}`));
  return root;
}
