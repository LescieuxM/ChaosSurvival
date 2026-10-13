// Vite embeds authored JSON; no server or Node.js is used by players.
const files = import.meta.glob('../dialogues/*.json', { eager: true, import: 'default' });
export const dialogues = Object.fromEntries(
  Object.values(files).map((dialogue) => [dialogue.id, dialogue]),
);
