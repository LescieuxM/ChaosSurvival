export function createMusicDebug(desktop, music, snapshot, onOffset) {
  const button = document.createElement('button');
  button.className = 'hud-control';
  button.id = 'music-debug-button';
  button.textContent = '♫';
  button.title = 'Synchronisation musicale (F3)';
  button.setAttribute('aria-label', button.title);
  button.setAttribute('aria-expanded', 'false');
  desktop.querySelector('.hud').append(button);
  const panel = document.createElement('aside');
  panel.className = 'music-debug';
  panel.id = 'music-debug';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Debug de synchronisation musicale');
  panel.innerHTML = /* HTML */ `
    <header>♫ SYNCHRONISATION <small>F3</small></header>
    <pre id="music-debug-status"></pre>
    <div class="debug-intensity"><i></i></div>
    <p>Battements détectés <span class="debug-beat-lamp">●</span></p>
    <pre id="music-debug-beats"></pre>
    <p>Prochaines fenêtres (selon disponibilité)</p>
    <pre id="music-debug-next"></pre>
    <label
      >Décalage <output id="sync-offset-value"></output>
      <input
        id="sync-offset"
        type="range"
        min="-500"
        max="500"
        step="10"
        aria-label="Décalage de synchronisation en millisecondes"
      />
    </label>
    <small>+ retarde les apparitions · − les avance</small>
    <button class="xp-button" id="reset-sync">Réinitialiser</button>
    <small>Sections / kicks estimés automatiquement.</small>
  `;
  desktop.append(panel);
  const status = panel.querySelector('#music-debug-status');
  const beats = panel.querySelector('#music-debug-beats');
  const next = panel.querySelector('#music-debug-next');
  const intensity = panel.querySelector('.debug-intensity i');
  const lamp = panel.querySelector('.debug-beat-lamp');
  const offset = panel.querySelector('#sync-offset');
  const offsetValue = panel.querySelector('#sync-offset-value');
  const applyOffset = (value) => {
    onOffset(value / 1000);
    render();
  };
  offset.addEventListener('input', () => applyOffset(Number(offset.value)));
  panel.querySelector('#reset-sync').addEventListener('click', () => applyOffset(0));
  function toggle() {
    panel.hidden = !panel.hidden;
    button.setAttribute('aria-expanded', String(!panel.hidden));
    render();
  }
  button.addEventListener('click', toggle);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'F3' && !event.repeat) {
      event.preventDefault();
      toggle();
    }
  });
  function render() {
    if (panel.hidden) return;
    const data = snapshot();
    offset.value = Math.round(data.offset * 1000);
    offsetValue.textContent = `${data.offset >= 0 ? '+' : ''}${Math.round(data.offset * 1000)} ms`;
    status.textContent = `Niveau ${data.level} · ${data.phase}\nBPM détecté : ${music.bpm.toFixed(2)}\nBPM local : ${(data.beat?.bpm ?? music.bpm).toFixed(2)}\nAudio : ${data.audioTime.toFixed(3)} s\nMusique : ${data.time.toFixed(3)} s\nIntensité : ${Math.round(data.intensity * 100)} %\nSection : ${data.section?.kind ?? 'intro'}\nOuvertes : ${data.open}/${data.maxWindows}\nÉcart dernière apparition : ${data.lastLateness === null ? '—' : `${Math.round(data.lastLateness * 1000)} ms`}\nÉcart max : ${Math.round(data.maxLateness * 1000)} ms\nAllégées : ${data.skipped} · clic ~${data.closeSeconds.toFixed(1)} s`;
    intensity.style.width = `${data.intensity * 100}%`;
    lamp.classList.toggle('lit', data.beat && data.time - data.beat.time < 0.12);
    const first = Math.max(0, data.index - 1);
    beats.textContent = music.beats
      .slice(first, first + 5)
      .map(
        (beat, i) =>
          `${first + i === data.index ? '▶' : ' '} ${String(first + i + 1).padStart(3)} ${beat.time.toFixed(3)}s${beat.kick ? ' KICK' : ''}${beat.accent ? ' ★' : ''}`,
      )
      .join('\n');
    next.textContent =
      data.next
        .map((event) => `${event.time.toFixed(3)}s · ${event.type} · /${event.everyBeats}`)
        .join('\n') || 'Fin de la séquence';
  }
  return { render };
}
