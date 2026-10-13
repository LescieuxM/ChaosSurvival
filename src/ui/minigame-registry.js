import { SmileyCatcher } from '../minigames/smiley-catcher.js';

const engines = new Map();
export function registerMiniGame(engine, factory) {
  engines.set(engine, factory);
}
export function createMiniGame(definition, manager, sounds, onComplete) {
  const factory = engines.get(definition.engine);
  if (!factory) throw new Error(`Mini-jeu indisponible : ${definition.engine}`);
  return factory(definition, manager, sounds, onComplete);
}
registerMiniGame('smiley-catcher', (...args) => new SmileyCatcher(...args));
