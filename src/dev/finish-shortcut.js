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

// Installed from the same import.meta.env.DEV-only entry point as the arcade shortcut.
export function installDevelopmentConversationShortcut(target, activeConversation) {
  const onKey = (event) => {
    if (
      !event.ctrlKey ||
      !event.shiftKey ||
      event.altKey ||
      event.metaKey ||
      event.repeat ||
      event.key.toLowerCase() !== 'f' ||
      event.target?.closest?.('input, textarea, select, [contenteditable="true"]')
    )
      return;
    const conversation = activeConversation();
    if (typeof conversation?.finishImmediately !== 'function') return;
    event.preventDefault();
    conversation.finishImmediately();
  };
  target.addEventListener('keydown', onKey);
  return () => target.removeEventListener('keydown', onKey);
}
