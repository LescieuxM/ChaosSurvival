export function celebrateVictory(desktop, result, sounds, onReturn) {
  const layer = document.createElement('section');
  layer.className = 'victory-layer';
  layer.id = 'victory-layer';
  layer.setAttribute('aria-label', 'Victoire du premier niveau');
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  layer.innerHTML = /* HTML */ ` <div class="victory-rays" aria-hidden="true"></div>
    <div class="victory-confetti" aria-hidden="true"></div>
    <div class="victory-card">
      <button
        class="close-button victory-close"
        id="victory-close"
        aria-label="Fermer les résultats et revenir au bureau"
      >
        ×
      </button>
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
  const background = [...desktop.children]
    .filter((child) => child !== layer)
    .map((child) => ({ child, inert: child.inert }));
  for (const { child } of background) child.inert = true;
  sounds.play('victory');
  let finished = false;
  const onVisibility = () => {
    layer.classList.toggle('is-suspended', document.hidden);
  };
  document.addEventListener('visibilitychange', onVisibility);
  const cleanup = () => {
    if (finished) return;
    finished = true;
    document.removeEventListener('visibilitychange', onVisibility);
    layer.remove();
    for (const { child, inert } of background) child.inert = inert;
  };
  const finish = () => {
    if (finished) return;
    cleanup();
    onReturn();
  };
  layer.querySelector('#victory-continue').addEventListener('click', finish);
  layer.querySelector('#victory-close').addEventListener('click', finish);
  layer.querySelector('#victory-continue').focus();
  return cleanup;
}
