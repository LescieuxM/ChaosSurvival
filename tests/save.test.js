import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Progression, HISTORY_KEY } from '../src/story/progression.js';
import { UserSettings, SETTINGS_KEY, deleteUserData } from '../src/settings.js';
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
test('NEW GAME archives choices and unselected responses separately, preserving preferences', () => {
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
  let events = 0;
  progression.onNewGame = () => events++;
  progression.newGame();
  assert.equal(events, 1);
  assert.notEqual(progression.data.runId, oldId);
  assert.equal(progression.current.id, 'arcade-1');
  assert.deepEqual(progression.data.choices, []);
  const history = JSON.parse(storage.getItem(HISTORY_KEY));
  assert.equal(history.runs.length, 1);
  assert.equal(history.runs[0].runId, oldId);
  assert.equal(history.runs[0].choices[0].unselected[0].text, 'B');
  assert.equal(history.runs[0].choiceOffers['dialogue:choice'].length, 2);
  assert.deepEqual(new UserSettings(storage).data, settings.data);
});
test('failed archive or active writes never replace the active run; retries do not duplicate history', () => {
  for (const failKey of [HISTORY_KEY, ACTIVE]) {
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
    assert.equal(JSON.parse(storage.getItem(HISTORY_KEY)).runs.length, 1);
  }
});
test('malformed JSON and malformed nested data safely return to first-launch state', () => {
  for (const broken of [
    '{broken',
    'null',
    '[]',
    '{"version":1}',
    JSON.stringify({ ...new Progression(story).data, started: true, dialogues: { broken: null } }),
    JSON.stringify({
      ...new Progression(story).data,
      files: { broken: { status: 'complete', name: null } },
    }),
  ]) {
    const storage = memory();
    storage.setItem(ACTIVE, broken);
    const progression = new Progression(story, storage);
    assert.equal(progression.hasSave, false);
    assert.equal(progression.current.id, 'arcade-1');
    progression.begin();
    assert.equal(new Progression(story, storage).hasSave, true);
  }
});
test('corrupt history does not silently erase prior runs on NEW GAME', () => {
  const storage = memory();
  const progression = new Progression(story, storage);
  progression.begin();
  const oldId = progression.data.runId;
  storage.setItem(HISTORY_KEY, '{broken');
  assert.throws(() => progression.newGame());
  assert.equal(progression.data.runId, oldId);
  assert.equal(storage.getItem(HISTORY_KEY), '{broken');
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
