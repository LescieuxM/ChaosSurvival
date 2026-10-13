import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Progression } from '../src/story/progression.js';
import {
  recordArcadeCompletion,
  queueArcadeVictory,
  pendingArcadeVictory,
  acknowledgeArcadeVictory,
} from '../src/story/arcade.js';
import { celebrateVictory } from '../src/ui/victory.js';
const story = JSON.parse(readFileSync(new URL('../src/config/story.json', import.meta.url)));

test('victory survives restart and first contact waits for a saved acknowledgement', async () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const progression = new Progression(story, storage);
  progression.begin();
  queueArcadeVictory(progression, 'arcade-1', { score: 1200, closed: 12, newRecord: true });
  const reopened = new Progression(story, storage);
  let arrivals = 0;
  reopened.register('conversation', () => arrivals++);
  assert.equal(pendingArcadeVictory(reopened).score, 1200);
  assert.equal(arrivals, 0);
  assert.equal(acknowledgeArcadeVictory(reopened).firstCompletion, true);
  await reopened.enterCurrent();
  assert.equal(arrivals, 1);
  assert.equal(acknowledgeArcadeVictory(reopened), null);
  assert.equal(pendingArcadeVictory(new Progression(story, storage)), null);
  queueArcadeVictory(reopened, 'arcade-1', { score: 1400, closed: 14, newRecord: true });
  assert.equal(acknowledgeArcadeVictory(reopened).firstCompletion, false);
  assert.equal(arrivals, 1);
});

test('corrupt pending results and failed acknowledgement do not erase progression', () => {
  const progression = new Progression(story);
  progression.begin();
  progression.data.pendingVictory = { score: 'invalid' };
  assert.equal(pendingArcadeVictory(progression), null);
  queueArcadeVictory(progression, 'arcade-1', { score: 100, closed: 1, newRecord: false });
  const pending = structuredClone(progression.data.pendingVictory);
  progression.storage = {
    setItem() {
      throw new Error('disk full');
    },
  };
  assert.throws(() => acknowledgeArcadeVictory(progression));
  assert.deepEqual(progression.data.pendingVictory, pending);
});

test('victory never times out, both manual controls return once and cancellation returns nothing', (t) => {
  const previous = globalThis.document;
  const create = () => ({
    style: { setProperty() {} },
    classList: { toggle() {} },
    handlers: {},
    children: [],
    setAttribute() {},
    append(child) {
      this.children.push(child);
    },
    addEventListener(type, callback) {
      this.handlers[type] = callback;
    },
    focus() {},
    remove() {
      this.removed = true;
    },
    querySelector(selector) {
      this.elements ??= {};
      return (this.elements[selector] ??= create());
    },
  });
  globalThis.document = {
    createElement: create,
    addEventListener() {},
    removeEventListener() {},
    hidden: false,
  };
  t.after(() => {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  });
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  for (const control of ['#victory-continue', '#victory-close']) {
    const desktop = create();
    const background = create();
    background.inert = false;
    desktop.append(background);
    let returns = 0;
    const cleanup = celebrateVictory(
      desktop,
      { score: 100, closed: 1 },
      { play() {} },
      () => returns++,
    );
    t.mock.timers.tick(60000);
    assert.equal(returns, 0);
    assert.equal(background.inert, true);
    const layer = desktop.children.at(-1);
    assert.notEqual(layer.removed, true);
    layer.querySelector(control).handlers.click();
    layer.querySelector(control).handlers.click();
    assert.equal(returns, 1);
    assert.equal(background.inert, false);
    cleanup();
    assert.equal(returns, 1);
  }
  let returned = false;
  celebrateVictory(create(), { score: 0, closed: 0 }, { play() {} }, () => {
    returned = true;
  })();
  assert.equal(returned, false);
});
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
