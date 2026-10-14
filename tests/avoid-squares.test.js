import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SquaresRound,
  MAX_ENEMIES,
  ARENA_WIDTH,
  ARENA_HEIGHT,
  bestTime,
  saveBestTime,
} from '../src/browser/sites/flashzone/squares-round.js';
import { saveBestScore, bestScore } from '../src/browser/sites/flashzone/bubble-round.js';
import { localPages } from '../src/browser/registry.js';
import { Progression } from '../src/story/progression.js';
const GAME_URL = 'http://www.flashzone.fr/jeux/avoid-the-squares';
const story = JSON.parse(readFileSync(new URL('../src/config/story.json', import.meta.url)));
test('route and searches exist through the existing registry', () => {
  assert.equal(localPages.resolve(GAME_URL, {}).page.title, 'Avoid the Squares — FlashZone');
  for (const q of ['avoid the squares', 'carrés', 'jeu esquive', 'arcade', 'flashzone'])
    assert.ok(localPages.search(q, {}).some((page) => page.url === GAME_URL));
});
test('player clamps to arena, starts safely and swept collision blocks jumping across red squares', () => {
  const r = new SquaresRound(() => 0.25);
  r.start(0);
  assert.equal(r.enemies.length, 2);
  assert.ok(r.enemies.every((e) => Math.hypot(e.x - r.player.x, e.y - r.player.y) > 100));
  r.move(-100, -100);
  assert.deepEqual(r.player, { x: 0, y: 0 });
  r.move(10000, 10000);
  assert.equal(r.player.x, 586);
  assert.equal(r.player.y, 286);
  r.elapsed = 1000;
  r.player = { x: 10, y: 10 };
  r.enemies = [{ x: 100, y: 10, vx: 0, vy: 0 }];
  r.move(250, 17);
  assert.equal(r.active, false);
  const elapsed = r.elapsed;
  r.tick(2000);
  assert.equal(r.elapsed, elapsed);
  r.start(3000);
  assert.equal(r.elapsed, 0);
  assert.ok(r.active);
});
test('red squares move independently of frame rate, bounce, gain speed and additions are safe/capped', () => {
  const a = new SquaresRound(() => 0.3),
    b = new SquaresRound(() => 0.3);
  a.start(0);
  b.start(0);
  for (let now = 10; now <= 600; now += 10) a.tick(now);
  for (let now = 100; now <= 600; now += 100) b.tick(now);
  assert.equal(a.elapsed, b.elapsed);
  assert.deepEqual(a.enemies, b.enemies);
  assert.notEqual(a.enemies[0].x, 12);
  b.last = 600;
  b.tick(5000);
  assert.equal(b.elapsed, 600, 'renderer suspension skips invisible catch-up');
  b.elapsed = 7990;
  b.last = 0;
  b.enemies = [];
  b.tick(20);
  assert.equal(b.enemies.length, 1);
  assert.ok(Math.hypot(b.enemies[0].x - b.player.x, b.enemies[0].y - b.player.y) > 100);
  for (let i = 0; i < 20; i++) b.addEnemy();
  assert.equal(b.enemies.length, MAX_ENEMIES);
  const c = new SquaresRound(() => 0.2);
  c.start(0);
  c.elapsed = 1000;
  c.enemies = [{ id: 1, x: 575, y: 270, vx: 100, vy: 100 }];
  c.tick(100);
  assert.ok(c.enemies[0].vx < 0 && c.enemies[0].vy < 0);
  assert.ok(c.enemies[0].x <= ARENA_WIDTH - 24 && c.enemies[0].y <= ARENA_HEIGHT - 24);
  const early = new SquaresRound(() => 0.2),
    late = new SquaresRound(() => 0.2);
  early.start(0);
  late.start(0);
  late.elapsed = 20000;
  early.tick(100);
  late.tick(100);
  assert.ok(late.enemies[0].y > early.enemies[0].y);
});
test('time records survive restart, cannot overwrite bubble scores, reset on New Game, and invalid records fall back', () => {
  const values = new Map(),
    storage = {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => values.set(k, v),
      removeItem: (k) => values.delete(k),
    };
  const p = new Progression(story, storage),
    narrative = JSON.stringify([p.data.dialogues, p.data.completed]);
  saveBestTime(p, 'avoid-the-squares', 1234.5);
  saveBestTime(p, 'avoid-the-squares', 100);
  saveBestScore(p, 'bubble-pop', 90);
  saveBestTime(p, 'avoid-the-squares', 2000);
  assert.equal(bestScore(p, 'bubble-pop'), 90);
  assert.equal(bestTime(p, 'avoid-the-squares'), 2000);
  assert.equal(bestTime(new Progression(story, storage), 'avoid-the-squares'), 2000);
  assert.equal(JSON.stringify([p.data.dialogues, p.data.completed]), narrative);
  p.newGame();
  assert.equal(bestTime(p, 'avoid-the-squares'), 0);
  assert.equal(bestScore(p, 'bubble-pop'), 0);
  for (const value of [null, '5', -1, Infinity, NaN]) {
    p.data.flashzoneBestTimes = { 'avoid-the-squares': value };
    assert.equal(bestTime(p, 'avoid-the-squares'), 0);
  }
});
test('view controls player, finishes on collision, replays and removes frames/listeners on departure', (t) => {
  const old = {
    doc: globalThis.document,
    raf: globalThis.requestAnimationFrame,
    caf: globalThis.cancelAnimationFrame,
  };
  const frames = new Map(),
    listeners = new Map();
  let serial = 0;
  globalThis.requestAnimationFrame = (fn) => {
    frames.set(++serial, fn);
    return serial;
  };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  globalThis.document = {
    hidden: false,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
    createElement(tag) {
      return {
        tag,
        children: [],
        style: {},
        dataset: {},
        handlers: {},
        isConnected: true,
        clientLeft: 2,
        clientTop: 2,
        classList: { add() {}, remove() {} },
        setAttribute() {},
        addEventListener(name, fn) {
          this.handlers[name] = fn;
        },
        removeEventListener(name) {
          delete this.handlers[name];
        },
        append(...nodes) {
          this.children.push(...nodes);
        },
        replaceChildren(...nodes) {
          this.children = nodes;
        },
        getBoundingClientRect() {
          return { left: 0, top: 0, width: 604, height: 304 };
        },
        set innerHTML(_) {
          throw new Error('Unsafe render');
        },
      };
    },
  };
  t.after(() => {
    globalThis.document = old.doc;
    globalThis.requestAnimationFrame = old.raf;
    globalThis.cancelAnimationFrame = old.caf;
  });
  const walk = (n) => [n, ...n.children.flatMap(walk)];
  let cleanup;
  const p = { data: {}, save() {} };
  const root = localPages
    .resolve(GAME_URL, {})
    .page.render({ progression: p, onDispose: (fn) => (cleanup = fn) });
  const find = (cls) => walk(root).find((n) => n.className === cls);
  find('squares-play').handlers.click();
  assert.equal(frames.size, 1);
  assert.equal(walk(root).filter((n) => n.className === 'squares-enemy').length, 2);
  const arena = find('squares-arena');
  arena.handlers.pointermove({ clientX: 302, clientY: 152 });
  assert.equal(find('squares-player').style.left, `${(293 / 600) * 100}%`);
  const start = performance.now();
  for (let i = 1; i <= 10; i++) {
    const tasks = [...frames.values()];
    frames.clear();
    for (const fn of tasks) fn(start + i * 100);
  }
  const enemy = find('squares-enemy');
  const x = (parseFloat(enemy.style.left) / 100) * 600,
    y = (parseFloat(enemy.style.top) / 100) * 300;
  arena.handlers.pointermove({ clientX: x + 14, clientY: y + 14 });
  assert.equal(find('squares-result').hidden, false);
  assert.equal(frames.size, 0);
  assert.ok(bestTime(p, 'avoid-the-squares') >= 750);
  find('squares-replay').handlers.click();
  assert.equal(find('squares-result').hidden, true);
  document.hidden = true;
  listeners.get('visibilitychange')();
  assert.equal(frames.size, 0);
  assert.equal(find('squares-intro').hidden, false);
  document.hidden = false;
  find('squares-play').handlers.click();
  cleanup();
  cleanup();
  assert.equal(frames.size, 0);
  assert.equal(listeners.size, 0);
  assert.equal(arena.handlers.pointermove, undefined);
});
