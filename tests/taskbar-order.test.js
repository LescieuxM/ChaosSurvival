import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskbarOrder, reconcileTaskOrder } from '../src/ui/taskbar-order.js';

test('session task order appends new window IDs and removes closed IDs without resetting survivors', () => {
  assert.deepEqual(reconcileTaskOrder(['3', '1', '2'], ['1', '2', '3', '4']), ['3', '1', '2', '4']);
  assert.deepEqual(reconcileTaskOrder(['3', '1', '2', '4'], ['1', '3', '4']), ['3', '1', '4']);
});

test('horizontal dragging updates session state, preserves fixed slots and suppresses activation', (t) => {
  const previous = { document: globalThis.document, MutationObserver: globalThis.MutationObserver };
  const handlers = {};
  let observe;
  const node = (id) => ({
    dataset: id ? { windowId: id } : {},
    style: {},
    isConnected: true,
    offsetWidth: 100,
    handlers: {},
    classList: { add() {}, remove() {} },
    matches() {
      return Boolean(this.dataset.windowId);
    },
    closest() {
      return this;
    },
    addEventListener(type, fn) {
      this.handlers[type] = fn;
    },
    setAttribute() {},
    removeAttribute(attr) {
      if (attr === 'data-window-id') delete this.dataset.windowId;
    },
    getBoundingClientRect() {
      return {
        left: bar.children.indexOf(this) * 100,
        top: 0,
        width: 100,
        height: 36,
        right: (bar.children.indexOf(this) + 1) * 100,
      };
    },
    cloneNode() {
      return node();
    },
    replaceWith(other) {
      bar.children[bar.children.indexOf(this)] = other;
    },
    remove() {
      const index = bar.children.indexOf(this);
      if (index >= 0) bar.children.splice(index, 1);
      this.isConnected = false;
    },
  });
  const start = node(),
    tray = node(),
    buttons = ['1', '2', '3'].map(node);
  const bar = {
    ...node(),
    children: [start, ...buttons, tray],
    append(item) {
      this.children.push(item);
    },
    getBoundingClientRect: () => ({ left: 0 }),
    setPointerCapture() {},
    hasPointerCapture: () => false,
  };
  globalThis.document = {
    createComment: () => node(),
    addEventListener(type, fn) {
      handlers[type] = fn;
    },
  };
  globalThis.MutationObserver = class {
    constructor(fn) {
      observe = fn;
    }
    observe() {}
  };
  t.after(() => Object.assign(globalThis, previous));
  const controller = new TaskbarOrder(bar);
  const event = (button, x) => ({
    button: 0,
    pointerId: 1,
    clientX: x,
    clientY: 10,
    target: button,
    preventDefault() {},
  });
  bar.handlers.pointerdown(event(buttons[2], 350));
  handlers.pointermove(event(buttons[2], 348));
  handlers.pointerup(event(buttons[2], 348));
  assert.equal(controller.suppressClick, false);
  bar.handlers.pointerdown(event(buttons[2], 350));
  handlers.pointermove(event(buttons[2], 110));
  assert.deepEqual(controller.order, ['3', '1', '2']);
  handlers.pointerup(event(buttons[2], 110));
  let activated = true;
  bar.handlers.click({
    detail: 1,
    preventDefault() {},
    stopImmediatePropagation() {
      activated = false;
    },
  });
  assert.equal(activated, false);
  assert.equal(bar.children[0], start);
  assert.equal(bar.children.at(-1), tray);
  const added = node('4');
  bar.children.splice(bar.children.indexOf(tray), 0, added);
  observe();
  assert.deepEqual(controller.order, ['3', '1', '2', '4']);
  buttons[0].remove();
  observe();
  assert.deepEqual(controller.order, ['3', '2', '4']);
  bar.handlers.pointerdown(event(buttons[2], 150));
  handlers.pointermove(event(buttons[2], 1000));
  controller.cancel();
  assert.deepEqual(controller.order, ['3', '2', '4']);
  assert.equal(bar.children[0], start);
  assert.equal(bar.children.at(-1), tray);
});
