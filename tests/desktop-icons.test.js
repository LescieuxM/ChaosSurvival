import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DesktopIcons,
  iconGrid,
  layoutIconCells,
  nearestIconCell,
} from '../src/ui/desktop-icons.js';
import { Progression } from '../src/story/progression.js';
const story = JSON.parse(readFileSync(new URL('../src/config/story.json', import.meta.url)));

test('desktop icons fill the first column before the next and preserve existing custom cells', () => {
  const ids = ['computer', 'folder', 'msn', 'music', 'bin', 'game'];
  const grid = iconGrid(1280, 800);
  const first = layoutIconCells(ids, {}, grid);
  assert.deepEqual(first.get('game'), { col: 0, row: 5 });
  assert.deepEqual(layoutIconCells(ids, {}, iconGrid(800, 600)).get('game'), { col: 1, row: 0 });
  const saved = Object.fromEntries(first);
  saved.music = { col: 3, row: 2 };
  const withNew = layoutIconCells([...ids, 'new-file'], saved, grid);
  for (const id of ids) assert.deepEqual(withNew.get(id), saved[id]);
  assert.deepEqual(withNew.get('new-file'), { col: 0, row: 3 });
});

test('corrupt or colliding positions and resolution changes produce distinct bounded cells', () => {
  const saved = {
    a: { col: 99, row: 99 },
    b: { col: 99, row: 99 },
    c: { row: -1, col: 1 },
    d: 'oops',
  };
  const grid = iconGrid(800, 600);
  const result = layoutIconCells(['a', 'b', 'c', 'd'], saved, grid);
  assert.equal(new Set([...result.values()].map(JSON.stringify)).size, 4);
  for (const cell of result.values()) {
    assert.ok(cell.col >= 0 && cell.col < grid.cols && cell.row >= 0 && cell.row < grid.rows);
  }
  assert.deepEqual(nearestIconCell(-500, 10000, grid), { col: 0, row: grid.rows - 1 });
  assert.deepEqual(saved.a, { col: 99, row: 99 });
});

test('dragging snaps, persists, rejects occupied cells, suppresses accidental clicks and restores after resize', (t) => {
  const previous = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    observe() {}
  };
  t.after(() => {
    globalThis.ResizeObserver = previous;
  });
  const entries = new Map();
  const storage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
  const progression = new Progression(story, storage);
  progression.begin();
  const buttons = ['computer', 'folder', 'msn', 'music', 'bin'].map((name) => ({
    dataset: { shortcut: name },
    style: {},
    attrs: {},
    offsetWidth: 100,
    offsetHeight: 90,
    classList: { add() {}, remove() {} },
    setAttribute(key, value) {
      this.attrs[key] = value;
    },
    closest() {
      return this;
    },
    setPointerCapture() {},
    hasPointerCapture() {
      return false;
    },
  }));
  const handlers = {};
  const desktop = {
    width: 1280,
    classList: {
      add() {},
      contains(name) {
        return name === 'story-desktop';
      },
    },
    addEventListener(type, callback) {
      handlers[type] = callback;
    },
    querySelectorAll() {
      return buttons;
    },
    querySelector() {
      return {
        getBoundingClientRect() {
          return { height: 40, top: 760 };
        },
      };
    },
    getBoundingClientRect() {
      return { width: this.width, height: 800, top: 0 };
    },
  };
  const icons = new DesktopIcons(desktop, progression);
  const button = buttons[3];
  let nativeDragPrevented = false;
  handlers.dragstart({
    target: button,
    preventDefault() {
      nativeDragPrevented = true;
    },
  });
  assert.equal(nativeDragPrevented, true);
  const event = (x, y) => ({
    target: button,
    button: 0,
    pointerId: 1,
    clientX: x,
    clientY: y,
    preventDefault() {},
  });
  handlers.pointerdown(event(30, 342));
  handlers.pointermove(event(32, 344));
  assert.equal(icons.drag.moved, false);
  handlers.pointermove(event(270, 134));
  assert.match(button.style.transform, /translate/);
  handlers.pointerup(event(270, 134));
  assert.deepEqual(progression.data.desktopIcons['shortcut:music'], { col: 2, row: 1 });
  let blocked = false;
  handlers.dblclick({
    target: button,
    preventDefault() {},
    stopImmediatePropagation() {
      blocked = true;
    },
  });
  assert.equal(blocked, true);
  handlers.pointerdown(event(270, 134));
  handlers.pointermove(event(30, 30));
  handlers.pointerup(event(30, 30));
  assert.deepEqual(progression.data.desktopIcons['shortcut:music'], { col: 2, row: 1 });
  assert.equal(button.attrs['aria-pressed'], 'true');
  handlers.pointerdown(event(270, 134));
  handlers.pointerup(event(270, 134));
  blocked = false;
  handlers.dblclick({
    target: button,
    stopImmediatePropagation() {
      blocked = true;
    },
  });
  assert.equal(blocked, false);
  assert.deepEqual(new Progression(story, storage).data.desktopIcons['shortcut:music'], {
    col: 2,
    row: 1,
  });
  desktop.width = 240;
  icons.refresh();
  assert.equal(new Set([...icons.cells.values()].map(JSON.stringify)).size, buttons.length);
  desktop.width = 1280;
  icons.refresh();
  assert.equal(button.style.left, '260px');
  assert.equal(button.style.top, '124px');
});
