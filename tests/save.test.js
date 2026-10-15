import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Progression, HISTORY_KEY } from '../src/story/progression.js';
import { UserSettings, SETTINGS_KEY, deleteUserData } from '../src/settings.js';
import { resetGameToInitialState, recoverGameReset, RESET_KEY } from '../src/story/reset-game.js';
const story = JSON.parse(readFileSync(new URL('../src/config/story.json', import.meta.url)));
const ACTIVE = 'chaos-survival-story-v1';
function memory() {
  const values = new Map();
  return {
    get length() {
      return values.size;
    },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
test('first launch has no save; PLAY creates a durable checkpoint before level one', () => {
  const storage = memory();
  const first = new Progression(story, storage);
  assert.equal(first.hasSave, false);
  assert.equal(storage.getItem(ACTIVE), null);
  first.begin();
  const reopened = new Progression(story, storage);
  assert.equal(reopened.hasSave, true);
  assert.equal(reopened.current.id, 'arcade-1');
  assert.equal(reopened.data.runId, first.data.runId);
});
test('completed sequences are restored without replay, including unlocked conversations and files', () => {
  const storage = memory();
  const progression = new Progression(story, storage);
  progression.begin();
  progression.complete('arcade-1', { score: 1500 });
  assert.deepEqual(progression.data.unlockedConversations, ['pixelgirl-intro']);
  const file = progression.receiveFile(
    { id: 'game', name: 'GAME.exe', launch: { game: 'smiley-catcher' } },
    'pixelgirl-intro',
    'transfer',
  );
  progression.finishTransfer(file.key);
  const next = new Progression(story, storage);
  assert.equal(next.current.id, 'pixelgirl-hello');
  assert.equal(next.complete('arcade-1'), false);
  assert.equal(next.data.results['arcade-1'].score, 1500);
  assert.equal(next.data.files[file.key].status, 'complete');
});
test('NEW GAME deletes all game customizations, records and archives while preserving unrelated storage', () => {
  const storage = memory();
  const settings = new UserSettings(storage);
  settings.update({ musicVolume: 0.23, effectsVolume: 0.81, fullscreen: true });
  const progression = new Progression(story, storage);
  progression.begin();
  const oldId = progression.data.runId;
  progression.complete('arcade-1');
  progression.choose('dialogue', 'choice', { id: 'a', text: 'A' }, [
    { id: 'a', text: 'A' },
    { id: 'b', text: 'B' },
  ]);
  progression.save();
  progression.data.desktopIcons = { 'shortcut:bin': { col: 4, row: 5 } };
  progression.data.virtualFilesystem = { deleted: ['c/a.txt'], created: ['c/b.txt'] };
  progression.data.installedApps = ['custom'];
  progression.data.contactConnections = { turbo: { status: 'online' } };
  progression.save();
  storage.setItem(HISTORY_KEY, '{"version":1,"runs":[{"runId":"past"}]}');
  storage.setItem('chaos-survival-best', '5000');
  storage.setItem('chaos-survival-custom-apps', '["custom"]');
  storage.setItem('chaos-sync-track', '0.2');
  storage.setItem('another-app', 'keep');
  let events = 0;
  progression.onNewGame = () => events++;
  progression.newGame();
  assert.equal(events, 1);
  assert.notEqual(progression.data.runId, oldId);
  assert.equal(progression.current.id, 'arcade-1');
  assert.deepEqual(progression.data.choices, []);
  assert.equal(progression.hasSave, false);
  assert.equal(progression.data.desktopIcons, undefined);
  assert.equal(progression.data.virtualFilesystem, undefined);
  assert.equal(progression.data.installedApps, undefined);
  assert.equal(progression.data.contactConnections, undefined);
  assert.equal(storage.getItem(HISTORY_KEY), null);
  assert.equal(storage.getItem(RESET_KEY), null);
  assert.equal(storage.length, 2);
  assert.equal(storage.getItem('another-app'), 'keep');
  settings.reset();
  assert.deepEqual(settings.data, settings.defaults);
  assert.deepEqual(new UserSettings(storage).data, settings.defaults);
});
test('failed reset writes never replace the active run and retries discard the old history', () => {
  for (const failKey of [RESET_KEY, ACTIVE]) {
    const storage = memory();
    const progression = new Progression(story, storage);
    progression.begin();
    const oldId = progression.data.runId;
    const oldBytes = storage.getItem(ACTIVE);
    const setItem = storage.setItem;
    storage.setItem = (key, value) => {
      if (key === failKey) throw new Error('quota');
      setItem(key, value);
    };
    assert.throws(() => progression.newGame(), /quota/);
    assert.equal(progression.data.runId, oldId);
    assert.equal(storage.getItem(ACTIVE), oldBytes);
    storage.setItem = setItem;
    progression.newGame();
    assert.equal(storage.getItem(HISTORY_KEY), null);
  }
});
test('unreadable saves fall back safely while malformed optional records are isolated', () => {
  for (const broken of [
    '{broken',
    'null',
    '[]',
    '{"version":1}',
  ]) {
    const storage = memory();
    storage.setItem(ACTIVE, broken);
    const progression = new Progression(story, storage);
    assert.equal(progression.hasSave, false);
    assert.equal(progression.current.id, 'arcade-1');
    progression.begin();
    assert.equal(new Progression(story, storage).hasSave, true);
  }
  const storage = memory();
  const source = new Progression(story);
  source.begin();
  source.complete('arcade-1', { score: 1400 });
  source.data.dialogues.broken = null;
  source.data.files.broken = { status: 'complete', name: null };
  source.data.dialogues.valid = {
    node: 'start', cursor: 0, transcript: [{ speaker: 'contact', text: 'saved' }], finished: false,
  };
  source.data.flashzone = { bestScores: { 'bubble-pop': 2500 } };
  source.data.flashzoneBestTimes = { 'avoid-the-squares': 18.4 };
  source.data.desktopIcons = { 'shortcut:bin': { col: 2, row: 1 } };
  source.data.textFiles = { 'c:/notes.txt': { text: 'kept', original: 'source' } };
  storage.setItem(ACTIVE, JSON.stringify(source.data));
  const restored = new Progression(story, storage);
  assert.equal(restored.current.id, 'pixelgirl-hello');
  assert.deepEqual(restored.data.results['arcade-1'], { score: 1400 });
  assert.equal(restored.data.dialogues.broken, undefined);
  assert.equal(restored.data.files.broken, undefined);
  assert.equal(restored.data.dialogues.valid.transcript[0].text, 'saved');
  assert.equal(restored.data.flashzone.bestScores['bubble-pop'], 2500);
  assert.equal(restored.data.flashzoneBestTimes['avoid-the-squares'], 18.4);
  assert.deepEqual(restored.data.desktopIcons['shortcut:bin'], { col: 2, row: 1 });
  assert.equal(restored.data.textFiles['c:/notes.txt'].text, 'kept');
});

test('old saves without recently added optional fields retain story state and receive defaults', () => {
  const storage = memory();
  const saved = new Progression(story).data;
  saved.started = true;
  saved.completed = ['arcade-1'];
  saved.current = 'pixelgirl-hello';
  delete saved.choiceOffers;
  delete saved.files;
  delete saved.tutorials;
  delete saved.anomalies;
  storage.setItem(ACTIVE, JSON.stringify(saved));
  const restored = new Progression(story, storage);
  assert.equal(restored.current.id, 'pixelgirl-hello');
  assert.deepEqual(restored.data.completed, ['arcade-1']);
  assert.deepEqual(restored.data.choiceOffers, {});
  assert.deepEqual(restored.data.files, {});
  assert.deepEqual(restored.data.tutorials, {});
});

test('reloading preserves valid narrative deadlines and contact status while dropping only malformed status entries', () => {
  const storage = memory();
  const progression = new Progression(story, storage);
  progression.begin();
  progression.data.contactConnections = {
    turbo: { status: 'online' },
    luna: { status: 'pending', dueAt: 123456 },
    broken: { status: 'pending', dueAt: null },
  };
  progression.data.dialogues['turbo-smiley-catcher'] = {
    node: 'response-1', cursor: 0, transcript: [], finished: false, receiveDueAt: 123999,
  };
  progression.data.dialogues.finished = {
    node: 'end', cursor: 0, transcript: [], finished: true,
  };
  progression.save();
  for (let i = 0; i < 3; i++) {
    const restored = new Progression(story, storage);
    assert.deepEqual(restored.data.contactConnections, {
      turbo: { status: 'online' },
      luna: { status: 'pending', dueAt: 123456 },
    });
    assert.equal(restored.data.dialogues['turbo-smiley-catcher'].receiveDueAt, 123999);
    assert.equal(restored.data.dialogues.finished.finished, true);
    restored.save();
  }
});
test('confirmed NEW GAME also discards corrupt archives rather than restoring stale data', () => {
  const storage = memory();
  const progression = new Progression(story, storage);
  progression.begin();
  const oldId = progression.data.runId;
  storage.setItem(HISTORY_KEY, '{broken');
  progression.newGame();
  assert.notEqual(progression.data.runId, oldId);
  assert.equal(storage.getItem(HISTORY_KEY), null);
});

test('a failed ancillary deletion rolls back the persisted and in-memory game', () => {
  const storage = memory();
  const progression = new Progression(story, storage);
  progression.begin();
  storage.setItem(HISTORY_KEY, 'history');
  storage.setItem(SETTINGS_KEY, 'settings');
  const before = storage.getItem(ACTIVE),
    oldId = progression.data.runId,
    remove = storage.removeItem;
  storage.removeItem = (key) => {
    if (key === SETTINGS_KEY) throw new Error('locked');
    remove(key);
  };
  assert.throws(() => progression.newGame(), /locked/);
  assert.equal(storage.getItem(ACTIVE), before);
  assert.equal(storage.getItem(HISTORY_KEY), 'history');
  assert.equal(storage.getItem(SETTINGS_KEY), 'settings');
  assert.equal(storage.getItem(RESET_KEY), null);
  assert.equal(progression.data.runId, oldId);
});

test('an interrupted committed reset cleans remaining game data before any subsystem can load it', () => {
  const storage = memory();
  const progression = new Progression(story, storage);
  progression.newGame();
  storage.setItem(RESET_KEY, progression.data.runId);
  storage.setItem(SETTINGS_KEY, 'old');
  storage.setItem('chaos-sync-track', 'old');
  storage.setItem(HISTORY_KEY, 'old');
  storage.setItem('another-app', 'keep');
  recoverGameReset(storage);
  assert.equal(storage.length, 2);
  assert.equal(storage.getItem('another-app'), 'keep');
  assert.equal(new Progression(story, storage).hasSave, false);
  storage.setItem(RESET_KEY, 'uncommitted');
  storage.setItem(SETTINGS_KEY, 'keep existing');
  recoverGameReset(storage);
  assert.equal(storage.getItem(SETTINGS_KEY), 'keep existing');
  assert.equal(storage.getItem(RESET_KEY), null);
});

test('reset orchestration stops first, commits before rebuilding, then restarts once', async () => {
  const order = [];
  await resetGameToInitialState({
    progression: {
      newGame() {
        order.push('commit');
      },
    },
    stop: async () => order.push('stop'),
    rebuild: async () => order.push('rebuild'),
    restart: () => order.push('restart'),
  });
  assert.deepEqual(order, ['stop', 'commit', 'rebuild', 'restart']);
  order.length = 0;
  await assert.rejects(
    resetGameToInitialState({
      progression: {
        newGame() {
          throw new Error('write');
        },
      },
      stop: () => order.push('stop'),
      rebuild: () => order.push('rebuild'),
      restart: () => order.push('restart'),
    }),
    /write/,
  );
  assert.deepEqual(order, ['stop']);
});
test('preferences validate corrupt values and complete deletion removes active and historical data', () => {
  const storage = memory();
  storage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ version: 1, musicVolume: 'bad', effectsVolume: 2, fullscreen: 'yes' }),
  );
  const settings = new UserSettings(storage);
  assert.deepEqual(settings.data, settings.defaults);
  settings.update({ musicVolume: 0, effectsVolume: 0.32 });
  assert.equal(new UserSettings(storage).data.musicVolume, 0);
  assert.equal(new UserSettings(storage).data.effectsVolume, 0.32);
  const progression = new Progression(story, storage);
  progression.begin();
  progression.newGame();
  storage.setItem('chaos-survival-best', '1000');
  storage.setItem('chaos-sync-hash', '0.1');
  storage.setItem('another-app', 'keep');
  deleteUserData(storage);
  assert.equal(storage.length, 1);
  assert.equal(storage.getItem('another-app'), 'keep');
  assert.equal(new Progression(story, storage).hasSave, false);
  assert.deepEqual(new UserSettings(storage).data, settings.defaults);
});

test('individual damaged preferences default independently of valid saved preferences', () => {
  const storage = memory();
  storage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      version: 1,
      musicVolume: 'bad',
      effectsVolume: 0.3,
      fullscreen: 'yes',
      startMenuOrder: ['settings', null, 'settings'],
    }),
  );
  const settings = new UserSettings(storage);
  assert.equal(settings.data.musicVolume, settings.defaults.musicVolume);
  assert.equal(settings.data.effectsVolume, 0.3);
  assert.equal(settings.data.fullscreen, settings.defaults.fullscreen);
  assert.deepEqual(settings.data.startMenuOrder, ['settings']);
});
