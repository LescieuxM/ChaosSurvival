export function celebrateVictory(desktop, result, sounds, onReturn) {
  const layer = document.createElement('section');
  layer.className = 'victory-layer';
  layer.id = 'victory-layer';
  layer.setAttribute('aria-label', 'Victoire du premier niveau');
  layer.innerHTML = /* HTML */ ` <div class="victory-rays" aria-hidden="true"></div>
    <div class="victory-confetti" aria-hidden="true"></div>
    <div class="victory-card">
      <span class="victory-sticker">BUREAU SAUVÉ !!</span>
      <div class="victory-stars" aria-hidden="true">★ ✦ ★</div>
      <h2>LEVEL COMPLETE !!!<span>YOU SURVIVED ! ★★★★★</span></h2>
      <p>Des pixels. Des paillettes. Une souris héroïque.</p>
      <strong class="victory-score"></strong><small class="victory-details"></small>
      <button class="start-button" id="victory-continue">★ RETOUR AU BUREAU</button>
      <small>Ton bureau t’attend ♫</small>
    </div>`;
  layer.querySelector('.victory-score').textContent =
    `${String(result.score).padStart(6, '0')} POINTS`;
  layer.querySelector('.victory-details').textContent =
    `${result.closed} fenêtres fermées${result.newRecord ? ' · NOUVEAU RECORD !' : ''}`;
  const confetti = layer.querySelector('.victory-confetti');
  for (let i = 0; i < 64; i++) {
    const piece = document.createElement('i');
    piece.textContent = ['★', '✦', '♥', '●'][i % 4];
    piece.style.setProperty('--x', `${(i * 37) % 100}%`);
    piece.style.setProperty('--delay', `${-(i % 13) * 0.17}s`);
    piece.style.setProperty('--color', ['#ff68bc', '#fff45a', '#62ffff', '#ac8dff'][i % 4]);
    confetti.append(piece);
  }
  desktop.append(layer);
  sounds.play('victory');
  let frame,
    elapsed = 0,
    previous = null,
    finished = false;
  const onVisibility = () => {
    previous = null;
    layer.classList.toggle('is-suspended', document.hidden);
  };
  document.addEventListener('visibilitychange', onVisibility);
  const cleanup = () => {
    finished = true;
    cancelAnimationFrame(frame);
    document.removeEventListener('visibilitychange', onVisibility);
    layer.remove();
  };
  const finish = () => {
    if (finished) return;
    cleanup();
    onReturn();
  };
  layer.querySelector('#victory-continue').addEventListener('click', finish);
  layer.querySelector('#victory-continue').focus();
  function tick(time) {
    if (finished) return;
    if (previous !== null && !document.hidden) elapsed += time - previous;
    previous = time;
    if (elapsed >= 5000) return finish();
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  return cleanup;
}
