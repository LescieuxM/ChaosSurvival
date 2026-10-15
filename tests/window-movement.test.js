import test from 'node:test';
import assert from 'node:assert/strict';
import { WindowManager } from '../src/ui/windows.js';

function fixture(t) {
  const previous = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    observe() {}
  };
  t.after(() => {
    globalThis.ResizeObserver = previous;
  });
  const surface = { left: 30, top: 20, right: 930, bottom: 660 };
  const fieldRect = { left: 30, top: 140, right: 930, bottom: 504 };
  const desktop = {
    getBoundingClientRect: () => surface,
    querySelector: () => ({ getBoundingClientRect: () => ({ top: surface.bottom - 36 }) }),
  };
  const field = {
    closest: () => desktop,
    getBoundingClientRect: () => fieldRect,
    get clientWidth() {
      return fieldRect.right - fieldRect.left;
    },
    get clientHeight() {
      return fieldRect.bottom - fieldRect.top;
    },
  };
  const manager = new WindowManager(field, () => {});
  const bar = {
    handlers: {},
    addEventListener(type, fn) {
      this.handlers[type] = fn;
    },
    setPointerCapture() {},
  };
  const element = {
    offsetWidth: 280,
    offsetHeight: 150,
    offsetLeft: 50,
    offsetTop: 60,
    style: { left: '50px', top: '60px' },
    querySelector: () => bar,
  };
  manager.windows.set(1, { element, preview: false });
  manager.enableDrag(element);
  const event = (x, y, button = false) => ({
    button: 0,
    clientX: x,
    clientY: y,
    pointerId: 1,
    target: { closest: () => button },
  });
  return { manager, element, bar, event, surface, fieldRect };
}

test('arcade dragging uses desktop coordinates above and below its unchanged spawn area', (t) => {
  const { manager, element, bar, event, fieldRect } = fixture(t);
  assert.deepEqual(manager.movementBounds(element), { minX: 0, minY: -120, maxX: 620, maxY: 334 });
  bar.handlers.pointerdown(event(100, 200));
  bar.handlers.pointermove(event(-10000, -10000));
  assert.equal(element.style.left, '0px');
  assert.equal(element.style.top, '-120px');
  bar.handlers.pointermove(event(10000, 10000));
  assert.equal(element.style.left, '620px');
  assert.equal(element.style.top, '334px');
  assert.equal(fieldRect.top + parseFloat(element.style.top) + element.offsetHeight, 624);
  bar.handlers.pointerup();
  bar.handlers.pointermove(event(-10000, -10000));
  assert.equal(element.style.top, '334px');
});

test('secondary mouse buttons do not start a window drag', (t) => {
  const { manager, element, bar, event } = fixture(t);
  for (const button of [1, 2]) {
    bar.handlers.pointerdown({ ...event(100, 200), button });
    bar.handlers.pointermove(event(300, 400));
    assert.equal(element.style.left, '50px');
    assert.equal(element.style.top, '60px');
    assert.equal(manager.dragged.has(element), false);
    bar.handlers.pointerup();
  }
});

test('resize preserves dragged arcade positions and clamps them to the current taskbar', (t) => {
  const { manager, element, bar, event, surface, fieldRect } = fixture(t);
  bar.handlers.pointerdown(event(100, 200));
  bar.handlers.pointermove(event(10000, 10000));
  surface.right = fieldRect.right = 730;
  surface.bottom = 500;
  manager.reposition();
  assert.equal(element.style.left, '420px');
  assert.equal(element.style.top, '174px');
  assert.equal(fieldRect.top + parseFloat(element.style.top) + element.offsetHeight, 464);
  assert.equal(element.offsetWidth, 280);
  assert.equal(element.offsetHeight, 150);
});

test('classical windows share the same bounds and titlebar buttons never initiate dragging', (t) => {
  const { manager, element, bar, event, fieldRect, surface } = fixture(t);
  fieldRect.top = surface.top;
  fieldRect.bottom = surface.bottom - 36;
  assert.deepEqual(manager.movementBounds(element), { minX: 0, minY: 0, maxX: 620, maxY: 454 });
  bar.handlers.pointerdown(event(100, 200, true));
  bar.handlers.pointermove(event(10000, 10000));
  assert.equal(element.style.left, '50px');
  assert.equal(element.style.top, '60px');
  assert.equal(manager.dragged.has(element), false);
});
