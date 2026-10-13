import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Progression } from '../src/story/progression.js';
import { recordArcadeCompletion } from '../src/story/arcade.js';
const story = JSON.parse(readFileSync(new URL('../src/config/story.json', import.meta.url)));
test('first arcade success unlocks PixelGirl once; replays preserve every narrative field', () => {
  const progression = new Progression(story);
  progression.begin();
  assert.equal(recordArcadeCompletion(progression, 'arcade-1', { score: 100 }), true);
  progression.data.choices.push({ key: 'choice', choice: 'a', unselected: [{ id: 'b' }] });
  const saved = structuredClone(progression.data);
  for (let replay = 0; replay < 3; replay++)
    assert.equal(recordArcadeCompletion(progression, 'arcade-1', { score: 999 }), false);
  assert.deepEqual(progression.data, saved);
  assert.equal(progression.current.id, 'pixelgirl-hello');
  progression.complete('pixelgirl-hello');
  progression.complete('super-mega-game');
  const finished = structuredClone(progression.data);
  assert.equal(recordArcadeCompletion(progression, 'arcade-1', { score: 999 }), false);
  assert.deepEqual(progression.data, finished);
});
