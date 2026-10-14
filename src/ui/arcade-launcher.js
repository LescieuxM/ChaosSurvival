export const arcadeLauncher = { name: 'ChaosSurvival.exe', icon: 'arcade-game' };

export function isArcadeExecutable(item) {
  return !item.location && /^ChaosSurvival\.exe$/i.test(item.name ?? '');
}
