const definitions = Object.values(
  import.meta.glob('../minigames/*.json', { eager: true, import: 'default' }),
);
export const miniGames = Object.fromEntries(definitions.map((game) => [game.id, game]));
export { registerMiniGame, createMiniGame } from './minigame-registry.js';
