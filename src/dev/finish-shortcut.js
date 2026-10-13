// Imported only inside Vite's development-only branch in main.js.
// Mini-game engines participate by exposing their normal, idempotent finish() method.
export function installDevelopmentVictoryShortcut(target, activeGame) {
  const onKey = (event) => {
    if (
      !event.ctrlKey ||
      !event.shiftKey ||
      event.altKey ||
      event.metaKey ||
      event.repeat ||
      event.key.toLowerCase() !== 'd'
    )
      return;
    const game = activeGame();
    if (typeof game?.finish !== 'function') return;
    event.preventDefault();
    game.finish();
  };
  target.addEventListener('keydown', onKey);
  return () => target.removeEventListener('keydown', onKey);
}
