import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DesktopIcons,
  groupIconCells,
  rectanglesTouch,
  iconGrid,
  layoutIconCells,
  nearestIconCell,
} from '../src/ui/desktop-icons.js';
import { Progression } from '../src/story/progression.js';
const story = JSON.parse(readFileSync(new URL('../src/config/story.json', import.meta.url)));

test('the arcade EXE keeps the legacy music shortcut position without changing other saved icon IDs', () => {
  assert.equal(
    DesktopIcons.prototype.id.call({}, { dataset: { shortcut: 'arcade' } }),
    'shortcut:music',
  );
  assert.equal(
    DesktopIcons.prototype.id.call({}, { dataset: { shortcut: 'computer' } }),
    'shortcut:computer',
  );
  assert.equal(
    DesktopIcons.prototype.id.call({}, { dataset: { fileId: 'smiley' } }),
    'file:smiley',
  );
});

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

test('group moves preserve relative cells and reject occupied and out-of-bounds destinations', () => {
  const cells = new Map([
    ['a', { col: 0, row: 0 }],
    ['b', { col: 0, row: 1 }],
    ['other', { col: 2, row: 2 }],
  ]);
  const moved = groupIconCells(cells, ['a', 'b'], { col: 1, row: 1 }, { cols: 5, rows: 5 });
  assert.deepEqual(moved.get('a'), { col: 1, row: 1 });
  assert.deepEqual(moved.get('b'), { col: 1, row: 2 });
  assert.equal(groupIconCells(cells, ['a', 'b'], { col: 2, row: 1 }, { cols: 5, rows: 5 }), null);
  assert.equal(groupIconCells(cells, ['a', 'b'], { col: -1, row: 0 }, { cols: 5, rows: 5 }), null);
  assert.deepEqual(cells.get('a'), { col: 0, row: 0 });
  assert.equal(
    rectanglesTouch(
      { left: 0, top: 0, right: 10, bottom: 10 },
      { left: 10, top: 10, right: 20, bottom: 20 },
    ),
    true,
  );
});

test('empty-area dragging selects icons without moving them and clears the box on release', (t) => {
  const previousObserver = globalThis.ResizeObserver,
    previousDocument = globalThis.document;
  globalThis.ResizeObserver = class {
    observe() {}
  };
  globalThis.document = {
    createElement() {
      return {
        style: {},
        setAttribute() {},
        remove() {
          this.removed = true;
        },
      };
    },
  };
  t.after(() => {
    globalThis.ResizeObserver = previousObserver;
    globalThis.document = previousDocument;
  });
  const entries = new Map();
  const storage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
  const progression = new Progression(story, storage);
  progression.begin();
  const buttons = ['computer', 'folder', 'msn'].map((name) => ({
    dataset: { shortcut: name },
    style: {},
    attrs: {},
    offsetWidth: 100,
    offsetHeight: 90,
    classList: { add() {}, remove() {} },
    setAttribute(key, value) {
      this.attrs[key] = value;
    },
    closest(selector) {
      return selector.includes('[data-shortcut]') || selector.includes('.desktop-icons')
        ? this
        : null;
    },
    setPointerCapture() {},
    hasPointerCapture() {
      return false;
    },
    getBoundingClientRect() {
      const left = parseFloat(this.style.left),
        top = parseFloat(this.style.top);
      return { left, top, right: left + 100, bottom: top + 90 };
    },
  }));
  const desktop = {
    children: [],
    classList: {
      add() {},
      contains(name) {
        return name === 'story-desktop';
      },
    },
    closest() {
      return null;
    },
    addEventListener() {},
    querySelectorAll() {
      return buttons;
    },
    append(item) {
      this.children.push(item);
    },
    querySelector() {
      return {
        getBoundingClientRect() {
          return { height: 40, top: 760 };
        },
      };
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, right: 1280, width: 1280, height: 800 };
    },
  };
  const icons = new DesktopIcons(desktop, progression);
  const event = (x, y, target = desktop) => ({
    button: 0,
    pointerId: 1,
    clientX: x,
    clientY: y,
    target,
    preventDefault() {},
  });
  const saved = JSON.stringify(progression.data.desktopIcons);
  icons.down(event(5, 5));
  icons.move(event(8, 8));
  assert.equal(desktop.children.length, 0);
  icons.move(event(125, 216));
  assert.equal(buttons[0].attrs['aria-pressed'], 'true');
  assert.equal(buttons[1].attrs['aria-pressed'], 'true');
  assert.equal(buttons[2].attrs['aria-pressed'], 'false');
  const box = desktop.children[0];
  icons.up(event(125, 216));
  assert.equal(box.removed, true);
  assert.equal(icons.selectedIds.size, 2);
  assert.equal(JSON.stringify(progression.data.desktopIcons), saved);
  icons.down(event(40, 40, buttons[0]));
  icons.move(event(160, 40, buttons[0]));
  icons.up(event(160, 40, buttons[0]));
  assert.deepEqual(progression.data.desktopIcons['shortcut:computer'], { col: 1, row: 0 });
  assert.deepEqual(progression.data.desktopIcons['shortcut:folder'], { col: 1, row: 1 });
  const restored = new Progression(story, storage);
  assert.deepEqual(restored.data.desktopIcons['shortcut:computer'], { col: 1, row: 0 });
  assert.deepEqual(restored.data.desktopIcons['shortcut:folder'], { col: 1, row: 1 });
  assert.equal(icons.selectedIds.size, 2);
  icons.down(event(500, 500));
  icons.up(event(500, 500));
  assert.equal(icons.selectedIds.size, 0);
  assert.ok(buttons.every((button) => button.attrs['aria-pressed'] === 'false'));
});
