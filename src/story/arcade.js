// A replay must not move the narrative checkpoint or repeat the unlock event.
export function recordArcadeCompletion(progression, id, result) {
  if (progression.data.completed.includes(id) || progression.current?.id !== id) return false;
  return progression.complete(id, result);
}
