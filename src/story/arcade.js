// A replay must not move the narrative checkpoint or repeat the unlock event.
export function recordArcadeCompletion(progression, id, result) {
  if (progression.data.completed.includes(id) || progression.current?.id !== id) return false;
  return progression.complete(id, result);
}

export function queueArcadeVictory(progression, id, result) {
  const firstCompletion =
    !progression.data.completed.includes(id) && progression.current?.id === id;
  const pending = { sequence: id, ...result, firstCompletion };
  progression.data.pendingVictory = pending;
  if (!recordArcadeCompletion(progression, id, { score: result.score, closed: result.closed }))
    progression.save();
  return pending;
}

export function pendingArcadeVictory(progression) {
  const result = progression.data.pendingVictory;
  return result &&
    progression.story.sequences.some(
      (sequence) => sequence.id === result.sequence && sequence.type === 'arcade',
    ) &&
    progression.data.completed.includes(result.sequence) &&
    Number.isFinite(result.score) &&
    result.score >= 0 &&
    Number.isInteger(result.closed) &&
    result.closed >= 0 &&
    typeof result.newRecord === 'boolean' &&
    typeof result.firstCompletion === 'boolean'
    ? result
    : null;
}

export function acknowledgeArcadeVictory(progression) {
  const result = pendingArcadeVictory(progression);
  if (!result) return null;
  delete progression.data.pendingVictory;
  if (!progression.save()) {
    progression.data.pendingVictory = result;
    throw new Error(
      'Le retour au bureau n’a pas pu être sauvegardé. Les résultats sont conservés.',
    );
  }
  return result;
}
