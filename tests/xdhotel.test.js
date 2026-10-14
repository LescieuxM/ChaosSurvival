import test from 'node:test';
import assert from 'node:assert/strict';
import { hotelData, hotelRooms } from '../src/browser/sites/xdhotel/index.js';
import {
  HOTEL_URL,
  VIEW_WIDTH,
  VIEW_HEIGHT,
  project,
  screenCell,
  blockedCells,
  findPath,
  RoomWalk,
  furnitureCells,
  inside,
} from '../src/browser/sites/xdhotel/model.js';
import { depthOrder } from '../src/browser/sites/xdhotel/draw.js';
import { renderHotelRoom } from '../src/browser/sites/xdhotel/render.js';
import { localPages } from '../src/browser/registry.js';
import { BrowserSession } from '../src/browser/session.js';
const room = hotelData.room;

test('legacy Hotel URLs resolve to the new site, including saved histories, without admitting lookalike domains', () => {
  for (const old of ['xdhotel.fr', 'https://www.xdhotel.fr/'])
    assert.equal(localPages.resolve(old, {}).page.url, HOTEL_URL);
  const oldRoom = 'http://www.xdhotel.fr/salle/hall?test=1';
  const resolved = localPages.resolve(oldRoom, {});
  assert.equal(resolved.page.url, `${HOTEL_URL}salle/hall`);
  assert.equal(resolved.url.href, `${HOTEL_URL}salle/hall?test=1`);
  const saved = {
    version: 1,
    active: 'old',
    tabs: [
      { id: 'old', title: 'XD Hotel', history: ['http://www.xdhotel.fr/', oldRoom], cursor: 1 },
    ],
  };
  const progression = { data: { browser: structuredClone(saved) }, save() {} };
  const session = new BrowserSession(progression);
  assert.equal(session.active, 'old');
  assert.ok(localPages.resolve(session.address, {}).page);
  session.move(-1);
  assert.equal(localPages.resolve(session.address, {}).page.title, 'Hopla Hotel');
  assert.deepEqual(saved.tabs[0].history, ['http://www.xdhotel.fr/', oldRoom]);
  for (const address of [
    'xdhotel.fr.evil.example',
    'http://xdhotel.fr@evil.example',
    'javascript:xdhotel.fr',
    'file:///xdhotel.fr',
  ])
    assert.ok(localPages.resolve(address, {}).error);
  const entries = localPages.sites({}).filter((page) => /hotel/.test(page.url));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].url, HOTEL_URL);
});

test('Hotel registration uses only local routes and existing directory/search', () => {
  assert.equal(localPages.resolve('www.hoplahotel.fr', {}).page.url, HOTEL_URL);
  assert.ok(localPages.resolve(`${HOTEL_URL}salle/hall`, {}).page);
  assert.equal(localPages.resolve(`${HOTEL_URL}salle/unknown`, {}).error, 'not-found');
  assert.ok(localPages.sites({}).some((page) => page.url === HOTEL_URL));
  for (const query of ['hopla hotel', 'hotel virtuel'])
    assert.ok(localPages.search(query, {}).some((page) => page.url === HOTEL_URL));
  assert.equal(room.width, 10);
  assert.equal(room.height, 10);
  assert.equal(room.npcs[0].name, 'ReceptionHotel');
  assert.equal(room.npcs[0].dialogue, 'Bienvenue sur Hopla Hotel ! Amuse-toi bien ;)');
});

test('five data-driven rooms have unique IDs, unoccupied spawns, bounded obstacles and connected walkable areas', () => {
  assert.deepEqual(
    hotelRooms.map((room) => room.name),
    ["Hall de l'hôtel", 'Café Hopla', 'Discothèque', 'Salon détente', 'Salle de jeux'],
  );
  assert.equal(new Set(hotelRooms.map((room) => room.id)).size, 5);
  for (const definition of hotelRooms) {
    const route = localPages.resolve(`${HOTEL_URL}salle/${definition.id}`, {});
    assert.ok(route.page);
    assert.equal(route.page.preserveOnTabSwitch, true);
    assert.equal(
      new Set(definition.furniture.map((item) => item.id)).size,
      definition.furniture.length,
    );
    const occupied = new Set();
    for (const cell of [
      ...definition.furniture.flatMap(furnitureCells),
      ...definition.npcs.map((npc) => npc.position),
    ]) {
      assert.ok(inside(definition, cell), `${definition.id}: ${cell}`);
      assert.ok(!occupied.has(cell.join(':')), `${definition.id}: overlap ${cell}`);
      occupied.add(cell.join(':'));
    }
    const blocked = blockedCells(definition);
    assert.ok(inside(definition, definition.spawn));
    assert.ok(!blocked.has(definition.spawn.join(':')));
    let accessible = 0;
    for (let x = 0; x < definition.width; x++)
      for (let y = 0; y < definition.height; y++) {
        const path = findPath(definition, definition.spawn, [x, y]);
        if (blocked.has(`${x}:${y}`)) {
          assert.equal(path, null);
          continue;
        }
        assert.ok(path, `${definition.id}: disconnected ${x}:${y}`);
        accessible++;
        assert.ok(path.every((cell) => !blocked.has(cell.join(':'))));
      }
    assert.ok(accessible >= 70);
    const walk = new RoomWalk(definition);
    assert.ok(walk.moveTo([8, 7]));
    for (let i = 0; i < 5; i++) walk.update(100);
    assert.deepEqual(walk.cell, [8, 7]);
  }
});
test('isometric projection and inverse hit tests agree across the floor and reject outside clicks', () => {
  for (let x = 0; x < room.width; x++)
    for (let y = 0; y < room.height; y++) {
      const point = project(x, y, room);
      assert.deepEqual(screenCell(point.x, point.y, room), [x, y]);
      assert.deepEqual(screenCell(point.x + 3, point.y + 1, room), [x, y]);
    }
  for (const [x, y] of [
    [0, 0],
    [400, 0],
    [200, 290],
    [-10, 150],
    [NaN, 20],
  ])
    assert.equal(screenCell(x, y, room), null);
});
test('BFS routes around all furniture footprints and the NPC without leaving the room', () => {
  const path = findPath(room, [0, 6], [4, 6]);
  assert.ok(path.length > 4);
  const blocked = blockedCells(room);
  let previous = [0, 6];
  for (const cell of path) {
    assert.ok(!blocked.has(cell.join(':')));
    assert.equal(Math.abs(cell[0] - previous[0]) + Math.abs(cell[1] - previous[1]), 1);
    previous = cell;
  }
  assert.deepEqual(previous, [4, 6]);
  for (const target of [[-1, 2], [10, 2], [2, 4], [2, 6], room.npcs[0].position])
    assert.equal(findPath(room, room.spawn, target), null);
  assert.deepEqual(findPath(room, room.spawn, room.spawn), []);
  const isolated = {
    width: 3,
    height: 3,
    furniture: [],
    npcs: [],
    blocked: [
      [1, 0],
      [1, 1],
      [1, 2],
    ],
  };
  assert.equal(findPath(isolated, [0, 1], [2, 1]), null);
});
test('walk interpolates, faces four directions, and replaces a destination without cutting through obstacles', () => {
  const walk = new RoomWalk(room);
  assert.ok(walk.moveTo([8, 7]));
  walk.update(100);
  assert.ok(walk.position[0] > 7 && walk.position[0] < 8);
  assert.equal(walk.direction, 'east');
  assert.ok(walk.moveTo([6, 7]));
  for (let i = 0; i < 20; i++) walk.update(100);
  assert.deepEqual(walk.cell, [6, 7]);
  assert.equal(walk.direction, 'west');
  for (const [target, direction] of [
    [[6, 6], 'north'],
    [[6, 7], 'south'],
  ]) {
    walk.moveTo(target);
    for (let i = 0; i < 3; i++) walk.update(100);
    assert.deepEqual(walk.cell, target);
    assert.equal(walk.direction, direction);
  }
  assert.equal(walk.moveTo([2, 4]), false);
  assert.deepEqual(walk.cell, [6, 7]);
  assert.equal(walk.moving, false);
  const another = new RoomWalk(room);
  assert.deepEqual(another.cell, room.spawn);
  assert.deepEqual(room.spawn, [7, 7]);
  walk.update(Infinity);
  assert.deepEqual(walk.cell, [6, 7]);
});
test('painter order puts an avatar behind or ahead of furniture according to grid depth', () => {
  const walk = new RoomWalk(room);
  walk.position = [0, 0];
  const back = depthOrder(room, walk);
  assert.ok(
    back.findIndex((entry) => entry.kind === 'player') <
      back.findIndex((entry) => entry.item?.id === 'sofa'),
  );
  walk.position = [9, 9];
  assert.equal(depthOrder(room, walk).at(-1).kind, 'player');
});

function dom(t) {
  const saved = {
    document: globalThis.document,
    raf: globalThis.requestAnimationFrame,
    caf: globalThis.cancelAnimationFrame,
    observer: globalThis.ResizeObserver,
  };
  const frames = new Map(),
    listeners = new Set();
  const positions = new WeakMap();
  let serial = 0;
  globalThis.document = {
    hidden: false,
    addEventListener(_name, fn) {
      listeners.add(fn);
    },
    removeEventListener(_name, fn) {
      listeners.delete(fn);
    },
    createElement(tag) {
      const ctx = Object.fromEntries(
        ['beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'fillText'].map((name) => [
          name,
          () => {},
        ]),
      );
      ctx.fillRect = (x, y, width, height) => {
        if (ctx.fillStyle === '#a284dc' && width === 14 && height === 16)
          positions.set(element, { x: x + 7, y: y + 26 });
      };
      const element = {
        tag,
        children: [],
        style: {},
        dataset: {},
        handlers: {},
        classList: { add() {} },
        isConnected: true,
        append(...items) {
          this.children.push(...items);
        },
        setAttribute() {},
        focus() {},
        getContext() {
          return ctx;
        },
        getBoundingClientRect() {
          return { left: 20, top: 30, width: VIEW_WIDTH * 2, height: VIEW_HEIGHT * 2 };
        },
        addEventListener(name, fn) {
          this.handlers[name] = fn;
        },
        removeEventListener(name) {
          delete this.handlers[name];
        },
        set innerHTML(_) {
          throw new Error('Unsafe HTML');
        },
      };
      return element;
    },
  };
  globalThis.requestAnimationFrame = (fn) => {
    frames.set(++serial, fn);
    return serial;
  };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  t.after(() => {
    globalThis.document = saved.document;
    globalThis.requestAnimationFrame = saved.raf;
    globalThis.cancelAnimationFrame = saved.caf;
    globalThis.ResizeObserver = saved.observer;
  });
  return {
    frames,
    listeners,
    position: (canvas) => positions.get(canvas),
    step(now) {
      const tasks = [...frames.values()];
      frames.clear();
      for (const fn of tasks) fn(now);
    },
  };
}
const walkTree = (node) => [node, ...node.children.flatMap(walkTree)];
test('room instances have independent motion/bubbles; scaled clicks, visibility and disposal clean up all resources', (t) => {
  const clock = dom(t);
  let disposeA, disposeB;
  const a = renderHotelRoom(
    {
      onDispose: (fn) => {
        disposeA = fn;
      },
    },
    hotelData,
  );
  const b = renderHotelRoom(
    {
      onDispose: (fn) => {
        disposeB = fn;
      },
    },
    hotelData,
  );
  const find = (root, cls) => walkTree(root).find((item) => item.className === cls);
  const canvas = find(a, 'hotel-canvas');
  const click = (x, y) =>
    canvas.handlers.click({ button: 0, clientX: 20 + x * 2, clientY: 30 + y * 2 });
  click(...Object.values(project(8, 7, room)));
  assert.equal(clock.frames.size, 1);
  for (let i = 0; i < 5; i++) clock.step(i * 100);
  assert.deepEqual(clock.position(canvas), project(8, 7, room));
  assert.deepEqual(clock.position(find(b, 'hotel-canvas')), project(...room.spawn, room));
  for (const root of [a, b]) {
    assert.equal(find(root, 'hotel-location'), undefined);
    assert.equal(find(root, 'hotel-room-status'), undefined);
  }
  assert.equal(clock.frames.size, 0);
  const npc = project(...room.npcs[0].position, room);
  click(npc.x, npc.y - 25);
  assert.equal(find(a, 'hotel-bubble').textContent, room.npcs[0].dialogue);
  assert.equal(find(a, 'hotel-bubble').hidden, false);
  assert.equal(find(b, 'hotel-bubble').hidden, true);
  clock.step(performance.now() + 5000);
  assert.equal(find(a, 'hotel-bubble').hidden, true);
  click(...Object.values(project(9, 7, room)));
  document.hidden = true;
  for (const fn of clock.listeners) fn();
  assert.equal(clock.frames.size, 0);
  document.hidden = false;
  for (const fn of clock.listeners) fn();
  disposeA();
  disposeA();
  disposeB();
  assert.equal(clock.frames.size, 0);
  assert.equal(clock.listeners.size, 0);
  assert.equal(canvas.handlers.click, undefined);
});

test('navigator opens/closes, cancels a moving instance on room changes and repeated mounts leave one listener', (t) => {
  const clock = dom(t);
  let active, cleanup;
  const context = {
    onDispose(fn) {
      cleanup = fn;
    },
    navigate(url) {
      cleanup();
      active = localPages.resolve(url, {}).page.render(context);
    },
  };
  active = renderHotelRoom(context, hotelData);
  const find = (cls) => walkTree(active).find((item) => item.className === cls);
  for (const definition of [...hotelRooms, ...hotelRooms].slice(1)) {
    const point = project(8, 7, room);
    find('hotel-canvas').handlers.click({
      button: 0,
      clientX: 20 + point.x * 2,
      clientY: 30 + point.y * 2,
    });
    assert.equal(clock.frames.size, 1);
    find('hotel-navigator-open').handlers.click();
    assert.equal(find('hotel-navigator').hidden, false);
    assert.equal(clock.frames.size, 0);
    const buttons = walkTree(active).filter((item) => item.dataset.hotelRoom);
    assert.equal(buttons.length, 5);
    find('hotel-navigator-close').handlers.click();
    assert.equal(find('hotel-navigator').hidden, true);
    find('hotel-navigator-open').handlers.click();
    buttons.find((button) => button.dataset.hotelRoom === definition.id).handlers.click();
    assert.equal(find('hotel-navigator').hidden, true);
    assert.equal(walkTree(active).find((item) => item.tag === 'h2').textContent, definition.name);
    assert.deepEqual(
      clock.position(find('hotel-canvas')),
      project(...definition.spawn, definition),
    );
    assert.equal(find('hotel-location'), undefined);
    assert.equal(find('hotel-room-status'), undefined);
    assert.equal(clock.frames.size, 0);
    assert.equal(clock.listeners.size, 1);
    const npc = project(...definition.npcs[0].position, definition);
    find('hotel-canvas').handlers.click({
      button: 0,
      clientX: 20 + npc.x * 2,
      clientY: 30 + (npc.y - 25) * 2,
    });
    assert.equal(find('hotel-bubble').textContent, definition.npcs[0].dialogue);
    clock.step(performance.now() + 5000);
  }
  cleanup();
  assert.equal(clock.frames.size, 0);
  assert.equal(clock.listeners.size, 0);
});

test('retained room stops frames while another tab is active, ignores visibility wakeups and resumes its own position', (t) => {
  const clock = dom(t);
  let cleanup, resume;
  const root = renderHotelRoom(
    {
      onDispose(fn) {
        cleanup = fn;
      },
      onResume(fn) {
        resume = fn;
      },
    },
    hotelData,
  );
  const find = (cls) => walkTree(root).find((item) => item.className === cls);
  const point = project(8, 7, room);
  find('hotel-canvas').handlers.click({
    button: 0,
    clientX: 20 + point.x * 2,
    clientY: 30 + point.y * 2,
  });
  clock.step(0);
  clock.step(100);
  const before = clock.position(find('hotel-canvas'));
  cleanup('pause');
  assert.equal(clock.frames.size, 0);
  document.hidden = false;
  for (const listener of clock.listeners) listener();
  assert.equal(clock.frames.size, 0);
  resume();
  assert.deepEqual(clock.position(find('hotel-canvas')), before);
  assert.equal(clock.frames.size, 1);
  for (let i = 0; i < 5; i++) clock.step(1000 + i * 100);
  assert.deepEqual(clock.position(find('hotel-canvas')), project(8, 7, room));
  cleanup();
  resume();
  assert.equal(clock.frames.size, 0);
  assert.equal(clock.listeners.size, 0);
});
