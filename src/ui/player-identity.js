import profile from '../config/player.json' with { type: 'json' };

// Shared default profile; dialogues describe the story, not the player's identity.
export const playerIdentity = Object.freeze(profile);
