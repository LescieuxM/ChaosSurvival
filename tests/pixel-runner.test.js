import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RunnerRound,
  GROUND,
  bestDistance,
  saveBestDistance,
} from '../src/browser/sites/flashzone/runner-round.js';
import { localPages } from '../src/browser/registry.js';
import { Progression } from '../src/story/progression.js';
import { InternetAdventurer } from '../src/ui/browser.js';
const GAME_URL = 'http://www.flashzone.fr/jeux/pixel-runner';
const story = JSON.parse(readFileSync(new URL('../src/config/story.json', import.meta.url)));
function fixture() {
  const values = new Map(),
    storage = {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => values.set(k, v),
      removeItem: (k) => values.delete(k),
    };
  return { p: new Progression(story, storage), storage };
}
test('runner route and queries use existing registry', () => {
  assert.ok(localPages.resolve(GAME_URL, {}).page.preserveOnTabSwitch);
  for (const query of ['pixel runner', 'jeu plateforme', 'runner', 'flashzone', 'jeu flash'])
    assert.ok(localPages.search(query, {}).some((page) => page.url === GAME_URL));
});
test('run, gravity and jump work with no double-jump and consistent framerate', () => {
  const a = new RunnerRound(() => 0),
    b = new RunnerRound(() => 0);
  a.start(0);
  b.start(0);
  assert.ok(a.jump());
  assert.equal(a.jump(), false);
  b.jump();
  for (let now = 10; now <= 500; now += 10) a.tick(now);
  for (let now = 100; now <= 500; now += 100) b.tick(now);
  assert.deepEqual(a.obstacles, b.obstacles);
  assert.ok(Math.abs(a.y - b.y) < 0.0001);
  assert.ok(a.y < GROUND - 20);
  assert.ok(a.distance > 0);
  for (let now = 510; now <= 1000; now += 10) a.tick(now);
  assert.equal(a.y, GROUND - 20);
  assert.ok(a.grounded);
  const before = a.distance;
  a.resume(10000);
  a.tick(10010);
  assert.ok(a.distance - before < 2);
});
test('boxes collide, holes cause falling, and early jumps can clear both hazards', () => {
  function r(kind) {
    const round = new RunnerRound(() => 0);
    round.start(0);
    round.obstacles = [{ id: 1, kind, x: 150, width: kind === 'hole' ? 54 : 22, height: 28 }];
    return round;
  }
  for (const kind of ['crate', 'block', 'hole']) {
    const failed = r(kind);
    for (let t = 10; t < 2500 && failed.active; t += 10) failed.tick(t);
    assert.equal(failed.active, false, kind);
    const success = r(kind);
    for (let t = 10; t <= 600; t += 10) success.tick(t);
    assert.ok(success.jump());
    for (let t = 610; t <= 2000; t += 10) success.tick(t);
    assert.ok(success.active, kind);
  }
});
test('spawns allow reaction time, hazard spacing stays jumpable and speed is capped', () => {
  for (const value of [0, 0.4, 0.9]) {
    const r = new RunnerRound(() => value);
    r.start(0);
    for (let t = 10; t <= 4500 && !r.obstacles.length; t += 10) r.tick(t);
    assert.equal(r.obstacles.length, 1);
    assert.ok((r.obstacles[0].x - 76) / r.speed > 2);
    assert.ok(r.nextAt - r.distance >= r.speed * 1.4);
    r.distance = 100000;
    assert.equal(r.speed, 180);
  }
});
test('distance records persist/reset independently of other games and narrative', () => {
  const { p, storage } = fixture();
  p.data.flashzone = { bestScores: { 'bubble-pop': 70 } };
  p.data.flashzoneBestTimes = { 'avoid-the-squares': 1234 };
  const narrative = JSON.stringify([p.data.dialogues, p.data.completed]);
  saveBestDistance(p, 'pixel-runner', 456.7);
  saveBestDistance(p, 'pixel-runner', 12);
  assert.equal(bestDistance(new Progression(story, storage), 'pixel-runner'), 456.7);
  assert.equal(p.data.flashzone.bestScores['bubble-pop'], 70);
  assert.equal(p.data.flashzoneBestTimes['avoid-the-squares'], 1234);
  assert.equal(JSON.stringify([p.data.dialogues, p.data.completed]), narrative);
  p.newGame();
  assert.equal(bestDistance(p, 'pixel-runner'), 0);
});
function dom(t) {
  const previous = {
    doc: globalThis.document,
    raf: globalThis.requestAnimationFrame,
    caf: globalThis.cancelAnimationFrame,
    Audio: globalThis.Audio,
  };
  const audios = [];
  globalThis.Audio = class {
    constructor(src) {
      this.src = src;
      this.currentTime = 0;
      this.playCount = 0;
      this.pauseCount = 0;
      audios.push(this);
    }
    play() { this.playCount++; return Promise.resolve(); }
    pause() { this.pauseCount++; }
    removeAttribute(name) { if (name === 'src') this.src = ''; }
    load() {}
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
    addEventListener: (n, fn) => listeners.set(n, fn),
    removeEventListener: (n) => listeners.delete(n),
    createElement(tag) {
      return {
        tag,
        children: [],
        style: {},
        dataset: {},
        handlers: {},
        isConnected: true,
        classList: { toggle() {} },
        setAttribute() {},
        addEventListener(n, fn) {
          this.handlers[n] = fn;
        },
        removeEventListener(n) {
          delete this.handlers[n];
        },
        append(...nodes) {
          this.children.push(...nodes);
        },
        replaceChildren(...nodes) {
          this.children = nodes;
        },
        focus() {
          document.activeElement = this;
        },
        get firstElementChild() {
          return this.children[0];
        },
        getContext() {
          return { fillRect() {} };
        },
        set innerHTML(_) {
          throw new Error('Unsafe HTML');
        },
      };
    },
  };
  t.after(() => {
    globalThis.document = previous.doc;
    globalThis.requestAnimationFrame = previous.raf;
    globalThis.cancelAnimationFrame = previous.caf;
    globalThis.Audio = previous.Audio;
  });
  return {
    frames,
    listeners,
    audios,
    step(now) {
      const tasks = [...frames.values()];
      frames.clear();
      for (const fn of tasks) fn(now);
    },
  };
}
const walk = (n) => [n, ...n.children.flatMap(walk)];
test('view owns keyboard events and music, pauses/resumes, replays and cleans up', (t) => {
  const clock = dom(t),
    { p } = fixture();
  let cleanup, resume;
  const root = localPages.resolve(GAME_URL, {}).page.render({
    progression: p,
    onDispose: (fn) => (cleanup = fn),
    onResume: (fn) => (resume = fn),
  });
  const find = (cls) => walk(root).find((n) => n.className === cls);
  assert.equal(clock.audios.length, 0);
  find('runner-play').handlers.click();
  assert.equal(clock.audios.length, 1);
  const music = clock.audios[0];
  assert.match(music.src, /bransboynd-retro-runner-548536\.mp3$/);
  assert.equal(music.loop, true);
  assert.equal(music.volume, 0.35);
  assert.equal(music.playCount, 1);
  assert.equal(framesCount(), 1);
  function framesCount() {
    return clock.frames.size;
  }
  const canvas = find('runner-canvas');
  assert.equal(document.activeElement, canvas);
  let prevented = 0;
  canvas.handlers.keydown({
    code: 'Space',
    repeat: false,
    preventDefault() {
      prevented++;
    },
  });
  assert.equal(prevented, 1);
  const now = performance.now();
  clock.step(now + 100);
  const before = find('runner-distance').textContent;
  cleanup('pause');
  assert.equal(music.pauseCount, 1);
  assert.equal(framesCount(), 0);
  resume();
  assert.equal(music.playCount, 2);
  assert.equal(framesCount(), 1);
  assert.equal(find('runner-distance').textContent, before);
  let time = performance.now();
  for (let i = 1; i <= 130 && find('runner-result').hidden; i++) clock.step(time + i * 100);
  assert.equal(find('runner-result').hidden, false);
  assert.equal(music.currentTime, 0);
  assert.ok(bestDistance(p, 'pixel-runner') > 0);
  find('runner-replay').handlers.click();
  assert.equal(clock.audios.length, 1);
  assert.equal(music.playCount, 3);
  assert.equal(find('runner-distance').textContent, 'Distance : 0 m');
  cleanup();
  assert.equal(music.src, '');
  assert.equal(framesCount(), 0);
  assert.equal(clock.listeners.size, 0);
  assert.equal(canvas.handlers.keydown, undefined);
});
test('browser suspends each runner tab independently, restores it and discards it on navigation/reset', async (t) => {
  const clock = dom(t),
    { p } = fixture(),
    browser = new InternetAdventurer({}, {}, p);
  browser.tabs = () => {};
  const controls = new Map();
  browser.instance = {
    element: {
      isConnected: true,
      querySelector(s) {
        if (!controls.has(s)) controls.set(s, document.createElement('div'));
        return controls.get(s);
      },
    },
  };
  const wait = () => new Promise((resolve) => setTimeout(resolve, 250));
  t.after(() => {
    clearTimeout(browser.timer);
    browser.disposePage();
    browser.clearRetainedPages();
  });
  browser.navigate(GAME_URL);
  await wait();
  const first = p.data.browser.active,
    root = controls.get('.browser-page').firstElementChild;
  walk(root)
    .find((n) => n.className === 'runner-play')
    .handlers.click();
  clock.step(performance.now() + 100);
  const before = walk(root).find((n) => n.className === 'runner-distance').textContent;
  browser.session.add(GAME_URL);
  browser.load('switch');
  await wait();
  const secondRoot = controls.get('.browser-page').firstElementChild;
  assert.notEqual(secondRoot, root);
  assert.equal(clock.frames.size, 0);
  assert.equal(browser.retainedPages.size, 1);
  browser.session.select(first);
  browser.load('switch');
  await wait();
  assert.equal(controls.get('.browser-page').firstElementChild, root);
  assert.equal(clock.frames.size, 1);
  assert.equal(walk(root).find((n) => n.className === 'runner-distance').textContent, before);
  browser.navigate('flashzone.fr');
  await wait();
  assert.equal(clock.frames.size, 0);
  browser.reset();
  assert.equal(browser.retainedPages.size, 0);
  assert.equal(clock.listeners.size, 0);
});
