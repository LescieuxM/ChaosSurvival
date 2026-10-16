import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localPages } from '../src/browser/registry.js';
import { flashCatalog, FLASH_URL, renderFlashHome } from '../src/browser/sites/flashzone/index.js';
import {
  BubbleRound,
  bestScore,
  saveBestScore,
} from '../src/browser/sites/flashzone/bubble-round.js';
import { Progression } from '../src/story/progression.js';
import { InternetAdventurer } from '../src/ui/browser.js';
const story = JSON.parse(readFileSync(new URL('../src/config/story.json', import.meta.url)));
const walk = (n) => [n, ...n.children.flatMap(walk)];
function fixture() {
  const values = new Map();
  const storage = {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
  return { storage, p: new Progression(story, storage) };
}
function dom(t) {
  const previous = {
    document: globalThis.document,
    request: globalThis.requestAnimationFrame,
    cancel: globalThis.cancelAnimationFrame,
    Audio: globalThis.Audio,
  };
  const audios = [];
  globalThis.Audio = class {
    constructor(src) {
      this.src = src;
      this.currentTime = 0;
      this.playCount = 0;
      this.pauseCount = 0;
      this.paused = true;
      this.ended = false;
      audios.push(this);
    }
    play() { this.playCount++; this.paused = false; return Promise.resolve(); }
    pause() { this.pauseCount++; this.paused = true; }
    removeAttribute(name) { if (name === 'src') this.src = ''; }
    load() {}
  };
  globalThis.document = {
    createElement(tag) {
      return {
        tag,
        children: [],
        dataset: {},
        style: {},
        handlers: {},
        isConnected: true,
        classList: { toggle() {} },
        setAttribute() {},
        addEventListener(name, fn) {
          this.handlers[name] = fn;
        },
        append(...nodes) {
          for (const n of nodes) {
            n.parentNode = this;
            this.children.push(n);
          }
        },
        replaceChildren(...nodes) {
          this.children = [];
          this.append(...nodes);
        },
        remove() {
          this.parentNode.children = this.parentNode.children.filter((n) => n !== this);
        },
        set innerHTML(_) {
          throw new Error('HTML sink');
        },
      };
    },
  };
  const frames = new Map();
  let serial = 0;
  globalThis.requestAnimationFrame = (fn) => {
    frames.set(++serial, fn);
    return serial;
  };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  t.after(() => {
    globalThis.document = previous.document;
    globalThis.requestAnimationFrame = previous.request;
    globalThis.cancelAnimationFrame = previous.cancel;
    globalThis.Audio = previous.Audio;
  });
  return {
    frames,
    audios,
    frame(now) {
      const entries = [...frames];
      frames.clear();
      for (const [, fn] of entries) fn(now);
    },
  };
}
test('catalog generates a single thumbnail grid with internal image/title links and no game metadata', (t) => {
  dom(t);
  assert.equal(flashCatalog.games.length, 4);
  const nodes = walk(renderFlashHome());
  assert.equal(nodes.filter((n) => n.className === 'flashzone-grid').length, 1);
  const cards = nodes.filter((n) => n.className === 'flashzone-card');
  assert.equal(cards.length, flashCatalog.games.length - 1);
  assert.equal(nodes.filter((n) => n.className === 'flashzone-list').length, 0);
  for (const [index, card] of cards.entries()) {
    const game = flashCatalog.games[index];
    assert.equal(card.children.length, 2);
    assert.equal(card.children[0].children[0].tag, 'img');
    assert.equal(card.children[0].children[0].src, game.thumbnail);
    assert.equal(card.children[0].dataset.browserLink, game.route);
    assert.equal(card.children[1].dataset.browserLink, game.route);
    assert.equal(card.children[1].textContent, game.title);
    assert.equal(walk(card).filter((n) => ['p', 'small', 'h2'].includes(n.tag)).length, 0);
  }
  const unlockedNodes = walk(
    renderFlashHome({ data: { flags: { superPlombierFlashUnlocked: true } } }),
  );
  assert.equal(
    unlockedNodes.filter((n) => n.className === 'flashzone-card').length,
    flashCatalog.games.length,
  );
  for (const n of nodes.filter((n) => n.tag === 'a')) {
    assert.equal(n.href, '#');
    assert.ok(localPages.resolve(n.dataset.browserLink, {}).page);
  }
  assert.ok(localPages.sites({}).some((p) => p.url === FLASH_URL));
  for (const q of ['flashzone', 'jeux flash', 'jeux gratuits', 'bubble pop', 'bulles'])
    assert.ok(localPages.search(q, {}).some((p) => p.url === flashCatalog.games[0].route));
  assert.equal(localPages.resolve('flashzone.fr/missing', {}).error, 'not-found');
});
test('round lasts exactly 30 seconds, rewards one click per bubble and expires/caps targets without catch-up bursts', () => {
  const r = new BubbleRound(() => 0.5);
  r.start(1000);
  r.tick(1000);
  assert.equal(r.bubbles.length, 1);
  const id = r.bubbles[0].id;
  assert.ok(r.pop(id, 1001));
  assert.equal(r.score, 10);
  assert.equal(r.pop(id, 1002), false);
  r.tick(5000);
  assert.equal(r.bubbles.length, 1);
  r.tick(8000);
  assert.equal(r.bubbles.length, 1);
  assert.equal(r.seconds(1000), 30);
  r.tick(30999);
  assert.ok(r.active);
  r.tick(31000);
  assert.equal(r.active, false);
  assert.equal(r.bubbles.length, 0);
  assert.equal(r.pop(10, 31000), false);
  assert.equal(r.score, 10);
  r.start(40000);
  assert.equal(r.score, 0);
  r.stop();
  assert.equal(r.bubbles.length, 0);
});
test('only personal best is saved, corrupt scores fall back, restart restores and New Game clears without narrative events', () => {
  const { p, storage } = fixture();
  const narrative = JSON.stringify([p.data.completed, p.data.dialogues, p.data.choices]);
  assert.equal(bestScore(p, 'bubble-pop'), 0);
  saveBestScore(p, 'bubble-pop', 30);
  saveBestScore(p, 'bubble-pop', 10);
  assert.deepEqual(p.data.flashzone, { bestScores: { 'bubble-pop': 30 } });
  assert.equal(bestScore(new Progression(story, storage), 'bubble-pop'), 30);
  assert.equal(JSON.stringify([p.data.completed, p.data.dialogues, p.data.choices]), narrative);
  p.newGame();
  assert.equal(bestScore(p, 'bubble-pop'), 0);
  p.data.flashzone = { bestScores: { 'bubble-pop': '999' } };
  assert.equal(bestScore(p, 'bubble-pop'), 0);
  saveBestScore(p, 'bubble-pop', 10);
  assert.equal(bestScore(p, 'bubble-pop'), 10);
});
test('BubblePop music and pop effects start at their events, overlap, restart and clean up', (t) => {
  const clock = dom(t),
    { p } = fixture();
  let cleanup;
  const route = localPages.resolve(flashCatalog.games[0].route, {});
  const root = route.page.render({ progression: p, onDispose: (fn) => (cleanup = fn) });
  const find = (cls) => walk(root).find((n) => n.className === cls);
  assert.equal(clock.audios.length, 0);
  assert.equal(clock.frames.size, 0);
  find('bubble-play').handlers.click();
  assert.equal(clock.audios.length, 1);
  const music = clock.audios[0];
  assert.match(music.src, /jakob_welik-roblox-time-to-win-skyline-run-1-442119\.mp3$/);
  assert.equal(music.loop, true);
  assert.equal(music.volume, 0.35);
  assert.equal(music.playCount, 1);
  assert.equal(clock.audios.length, 1, 'effect audio is lazy until a bubble pops');
  assert.equal(clock.frames.size, 1);
  let bubble = walk(root).find((n) => n.className?.startsWith('bubble-target'));
  assert.ok(bubble);
  bubble.handlers.click();
  assert.equal(find('bubble-stats').children[0].textContent, 'Score : 10');
  const popEffect = clock.audios[1];
  assert.ok(popEffect);
  assert.match(popEffect.src, /cherskis-bubble-popping-3-587265\.mp3$/);
  assert.equal(popEffect.volume, 0.5);
  assert.equal(popEffect.playCount, 1);
  assert.equal(music.playCount, 1, 'popping does not restart the background music');
  bubble.handlers.click();
  assert.equal(popEffect.playCount, 1, 'a stale target does not play another effect');
  clock.frame(performance.now() + 451);
  const nextBubble = walk(root).find((n) => n.className?.startsWith('bubble-target'));
  assert.ok(nextBubble);
  nextBubble.handlers.click();
  assert.equal(clock.audios.length, 3, 'overlapping pops use separate pool voices');
  assert.equal(clock.audios[2].playCount, 1);
  assert.equal(music.playCount, 1);
  clock.frame(performance.now() + 30001);
  assert.equal(clock.frames.size, 0);
  assert.equal(find('bubble-result').hidden, false);
  assert.equal(music.currentTime, 0);
  assert.equal(popEffect.currentTime, 0, 'finishing the round stops active effects');
  assert.equal(clock.audios[2].currentTime, 0);
  assert.equal(bestScore(p, 'bubble-pop'), 20);
  find('bubble-replay').handlers.click();
  assert.equal(clock.audios.length, 3);
  assert.equal(music.playCount, 2);
  assert.equal(find('bubble-stats').children[0].textContent, 'Score : 0');
  assert.equal(clock.frames.size, 1);
  cleanup();
  cleanup();
  assert.equal(clock.frames.size, 0);
  assert.equal(music.src, '');
  assert.equal(popEffect.src, '');
  assert.equal(clock.audios[2].src, '');
  assert.equal(bestScore(p, 'bubble-pop'), 20);
  let cleanup2;
  const second = route.page.render({ progression: p, onDispose: (fn) => (cleanup2 = fn) });
  assert.equal(walk(second).find((n) => n.className === 'bubble-intro').hidden, undefined);
  walk(second)
    .find((n) => n.className === 'bubble-play')
    .handlers.click();
  assert.equal(clock.frames.size, 1);
  cleanup2();
  assert.equal(clock.frames.size, 0);
});
test('browser disposes interactive pages on navigation and reset before replacing DOM', async (t) => {
  const clock = dom(t),
    { p } = fixture();
  const browser = new InternetAdventurer({}, {}, p);
  browser.tabs = () => {};
  const controls = new Map();
  browser.instance = {
    element: {
      isConnected: true,
      querySelector(s) {
        if (!controls.has(s))
          controls.set(s, {
            setAttribute() {},
            replaceChildren(node) {
              this.node = node;
            },
          });
        return controls.get(s);
      },
    },
  };
  t.after(() => {
    clearTimeout(browser.timer);
    browser.disposePage();
  });
  browser.navigate(flashCatalog.games[0].route);
  await new Promise((r) => setTimeout(r, 250));
  const root = controls.get('.browser-page').node;
  walk(root)
    .find((n) => n.className === 'bubble-play')
    .handlers.click();
  assert.equal(clock.frames.size, 1);
  browser.navigate(FLASH_URL);
  assert.equal(clock.frames.size, 0);
  browser.navigate(flashCatalog.games[0].route);
  await new Promise((r) => setTimeout(r, 250));
  walk(controls.get('.browser-page').node)
    .find((n) => n.className === 'bubble-play')
    .handlers.click();
  assert.equal(clock.frames.size, 1);
  browser.reset();
  assert.equal(clock.frames.size, 0);
});
