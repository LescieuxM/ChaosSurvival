import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GameRules, validateGameRules } from '../src/ui/game-rules.js';
import { Progression } from '../src/story/progression.js';
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const chart = read('../src/config/chart.json');
const story = read('../src/config/story.json');

test('first arcade approval gates gameplay and persists independently from victory; cancellation permits retry', () => {
  const records = new Map();
  const storage = {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
  };
  const progression = new Progression(story, storage);
  progression.begin();
  const rules = new GameRules({}, progression);
  let starts = 0;
  rules.show = (definition, confirm, cancel) => {
    rules.confirm = () => {
      progression.data.tutorials[definition.rules.id] = true;
      progression.save();
      confirm();
    };
    rules.cancel = cancel;
  };
  rules.beforeStart(chart, () => starts++);
  assert.equal(starts, 0);
  assert.deepEqual(progression.data.completed, []);
  rules.cancel();
  assert.equal(rules.hasSeen(chart), false);
  rules.beforeStart(chart, () => starts++);
  rules.confirm();
  assert.equal(starts, 1);
  assert.deepEqual(progression.data.completed, []);
  const loaded = new Progression(story, storage);
  const restored = new GameRules({}, loaded);
  restored.beforeStart(chart, () => starts++);
  assert.equal(starts, 2);
  loaded.newGame();
  assert.equal(restored.hasSeen(chart), false);
});

test('legacy completed games and corrupt optional tutorial metadata stay compatible', () => {
  const progression = new Progression(story);
  progression.complete('arcade-1');
  delete progression.data.tutorials;
  assert.equal(new GameRules({}, progression).hasSeen(chart), true);
  const storage = { getItem: () => JSON.stringify({ ...progression.data, tutorials: 'invalid' }) };
  const loaded = new Progression(story, storage);
  assert.equal(loaded.corrupt, undefined);
  assert.deepEqual(loaded.data.tutorials, {});
  assert.equal(new GameRules({}, loaded).hasSeen(chart), true);
});

test('rule definitions are generic and checked before a future game is packaged', () => {
  validateGameRules(chart);
  validateGameRules(read('../src/minigames/smiley-catcher.json'));
  assert.throws(() =>
    validateGameRules({
      rules: {
        id: 'future',
        title: 'future',
        description: 'game',
        controls: 'oops',
        mechanics: [],
      },
    }),
  );
});
