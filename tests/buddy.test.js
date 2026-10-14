import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Buddy } from '../src/ui/buddy.js';
import { Progression } from '../src/story/progression.js';
import { resolveStartMenuOrder } from '../src/ui/start-menu-order.js';

const read = (name) => JSON.parse(readFileSync(new URL(name, import.meta.url)));
const config = read('../src/config/buddy.json');
const story = read('../src/config/story.json');
function fixture(t) {
  const previous = globalThis.document;
  const create = () => ({
    dataset: {},
    hidden: false,
    fields: new Map(),
    handlers: {},
    setAttribute() {},
    querySelector(selector) {
      if (!this.fields.has(selector)) this.fields.set(selector, create());
      return this.fields.get(selector);
    },
    addEventListener(type, fn) {
      this.handlers[type] = fn;
    },
  });
  globalThis.document = { createElement: create };
  t.after(() => {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  });
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const progression = new Progression(story, storage);
  const root = { append() {} };
  return { root, progression, storage, buddy: new Buddy(root, progression) };
}
test('Buddy stays inactive until explicit activation and presents the three bubbles in order without narrative changes', (t) => {
  const { buddy, progression } = fixture(t);
  const before = JSON.stringify([
    progression.data.dialogues,
    progression.data.choices,
    progression.data.current,
  ]);
  buddy.setActive(true);
  assert.equal(buddy.element.hidden, true);
  assert.equal(buddy.say('future event'), false);
  buddy.open(0);
  let now = 0;
  for (const message of config.introduction) {
    assert.equal(buddy.text.textContent, message.text);
    assert.equal(buddy.element.dataset.animation, message.animation);
    assert.equal(buddy.bubble.hidden, false);
    buddy.update(now + message.durationMs - 1);
    assert.equal(buddy.text.textContent, message.text);
    now += message.durationMs;
    buddy.update(now);
  }
  assert.equal(buddy.bubble.hidden, true);
  assert.equal(buddy.element.hidden, false);
  assert.equal(buddy.element.dataset.animation, 'idle');
  assert.equal(
    JSON.stringify([
      progression.data.dialogues,
      progression.data.choices,
      progression.data.current,
    ]),
    before,
  );
});
test('closing, masking, relaunching and restarting never repeat the introduction; New Game restores initial state', (t) => {
  const { buddy, progression, storage, root } = fixture(t);
  buddy.setActive(true);
  buddy.open(0);
  buddy.element.querySelector('.buddy-close').handlers.click();
  buddy.open(1);
  assert.equal(buddy.text.textContent, config.tips[0]);
  buddy.hide(2);
  assert.equal(progression.data.buddy.visible, false);
  buddy.update(302);
  assert.equal(buddy.element.hidden, true);
  assert.equal(buddy.say('hidden event'), false);
  const restored = new Buddy(root, new Progression(story, storage));
  restored.setActive(true);
  assert.equal(restored.element.hidden, true);
  restored.open(303);
  assert.equal(restored.text.textContent, config.tips[0]);
  const visible = new Buddy(root, new Progression(story, storage));
  visible.setActive(true);
  assert.equal(visible.element.hidden, false);
  assert.equal(visible.bubble.hidden, true);
  visible.setActive(false);
  assert.equal(visible.element.hidden, true);
  visible.setActive(true);
  assert.equal(visible.element.hidden, false);
  progression.newGame();
  buddy.restore();
  assert.equal(buddy.opened, false);
  assert.equal(buddy.element.hidden, true);
  buddy.open(304);
  assert.equal(buddy.text.textContent, config.introduction[0].text);
});
test('Buddy tolerates invalid optional data and extends saved Start order without replacing preferences', (t) => {
  const { buddy, progression } = fixture(t);
  progression.data.buddy = { opened: 'yes', visible: true };
  buddy.restore();
  buddy.setActive(true);
  assert.equal(buddy.element.hidden, true);
  assert.deepEqual(
    resolveStartMenuOrder(
      ['bin', 'folder', 'menu-messenger'],
      ['menu-messenger', 'folder', 'bin', 'buddy'],
    ),
    ['bin', 'folder', 'menu-messenger', 'buddy'],
  );
});
