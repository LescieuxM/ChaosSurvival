const ACTIVE_KEY = 'chaos-survival-story-v1';
export const RESET_KEY = 'chaos-survival-reset-pending';
const knownKeys = [
  ACTIVE_KEY,
  'chaos-survival-history-v1',
  'chaos-survival-settings-v1',
  'chaos-survival-best',
];
export function gameStorageKeys(storage) {
  if (!storage) return [];
  const keys = new Set(knownKeys.filter((key) => storage.getItem(key) != null));
  for (let index = 0; index < (storage.length ?? 0); index++) {
    const key = storage.key(index);
    if (key?.startsWith('chaos-survival-') || key?.startsWith('chaos-sync-')) keys.add(key);
  }
  return [...keys];
}

// localStorage writes are synchronous. Commit a clean run before removing its
// ancillary data; restore the snapshot if any operation fails.
export function replaceGameStorage(storage, next) {
  if (!storage) return;
  const snapshot = new Map(gameStorageKeys(storage).map((key) => [key, storage.getItem(key)]));
  const oldActive = storage.getItem(ACTIVE_KEY);
  try {
    if (storage.removeItem) storage.setItem(RESET_KEY, next.runId);
    storage.setItem(ACTIVE_KEY, JSON.stringify(next));
    for (const key of snapshot.keys())
      if (key !== ACTIVE_KEY && key !== RESET_KEY) storage.removeItem(key);
    storage.removeItem?.(RESET_KEY);
  } catch (error) {
    for (const [key, value] of snapshot) {
      if (storage.getItem(key) !== value) storage.setItem(key, value);
    }
    if (oldActive == null) storage.removeItem(ACTIVE_KEY);
    if (!snapshot.has(RESET_KEY)) storage.removeItem?.(RESET_KEY);
    throw error;
  }
}

export function recoverGameReset(storage) {
  const runId = storage?.getItem(RESET_KEY);
  if (!runId) return;
  let active;
  try {
    active = JSON.parse(storage.getItem(ACTIVE_KEY));
  } catch {
    /* Interrupted before commit. */
  }
  if (active?.runId === runId) {
    for (const key of gameStorageKeys(storage))
      if (key !== ACTIVE_KEY && key !== RESET_KEY) storage.removeItem(key);
  }
  storage.removeItem(RESET_KEY);
}

export async function resetGameToInitialState({ progression, stop, rebuild, restart }) {
  await stop();
  progression.newGame();
  await rebuild();
  return restart();
}
