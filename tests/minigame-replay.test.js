import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { installDevelopmentVictoryShortcut } from '../src/dev/finish-shortcut.js';
import { Progression } from '../src/story/progression.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const story = JSON.parse(read('../src/config/story.json'));
const definition = JSON.parse(read('../src/minigames/smiley-catcher.json'));

function setup(progression) {
  const element = () => ({
    style: {},
    dataset: {},
    children: [],
    handlers: {},
    isConnected: true,
    clientWidth: 500,
    clientHeight: 250,
    querySelector(selector) {
      this.selectors ??= new Map();
      if (!this.selectors.has(selector)) this.selectors.set(selector, element());
      return this.selectors.get(selector);
    },
    addEventListener(type, handler) {
      this.handlers[type] = handler;
    },
    attrs: {},
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
    append(child) {
      this.children.push(child);
    },
    remove() {
      this.isConnected = false;
    },
    replaceChildren() {
      this.children.forEach((child) => child.remove());
      this.children = [];
    },
  });
  const manager = {
    windows: new Map(),
    z: 10,
    sequence: 0,
    spawn(type, options) {
      const id = ++this.sequence;
      this.windows.set(id, { element: element(), options, type });
      return id;
    },
    close(id) {
      const item = this.windows.get(id);
      item.element.remove();
      this.windows.delete(id);
      item.options.onDismiss();
    },
  };
  let frame = 0;
  const frames = new Map();
  const visibility = new Set();
  const context = {
    progression,
    manager,
    ui: { desktop: element() },
    desktopIcons: { refresh() {} },
    icon: () => '<svg></svg>',
    miniGames: { [definition.id]: definition },
    sounds: { unlock() {}, play() {} },
    conversation: {},
    activeDialogue: { id: 'pixelgirl-intro' },
    showStoryError(error) {
      throw error;
    },
    document: {
      hidden: false,
      createElement: element,
      addEventListener(type, handler) {
        visibility.add(handler);
      },
      removeEventListener(type, handler) {
        visibility.delete(handler);
      },
    },
    requestAnimationFrame(handler) {
      frames.set(++frame, handler);
      return frame;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
  };
  const engine = read('../src/ui/minigame.js').split('const engines = new Map();')[1];
  const renderFiles = read('../src/main.js').match(
    /function renderDesktopFiles\(\) \{[\s\S]*?\n\}/,
  )[0];
  const launch = read('../src/main.js').match(/function openDesktopFile\(file\) \{[\s\S]*?\n\}/)[0];
  runInNewContext(
    `const engines = new Map(); ${engine.replaceAll('export ', '')}
    let phase = 'desktop'; let miniGame;
    ${launch}
    ${renderFiles}
    this.game = () => miniGame;`,
    context,
  );
  return { context, manager, visibility };
}

function savedRun() {
  const entries = new Map();
  const storage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
  const progression = new Progression(story, storage);
  progression.begin();
  progression.complete('arcade-1');
  progression.complete('pixelgirl-hello');
  const file = progression.receiveFile(
    { id: 'super-mega-game', name: 'SUPER_MEGA_GAME.exe', launch: { game: definition.id } },
    'pixelgirl-intro',
    'file',
  );
  return { progression, storage, file };
}

function finish(game) {
  game.tick(0);
  game.tick(31000);
}

test('received mini-game launches only after transfer, closes and restarts from zero without duplicates', () => {
  const { progression, file } = savedRun();
  const { context, manager, visibility } = setup(progression);
  context.renderDesktopFiles();
  const desktopFiles = context.ui.desktop.querySelector('#desktop-files');
  assert.equal(desktopFiles.children.length, 0);
  context.openDesktopFile(file);
  assert.equal(manager.windows.size, 0);
  progression.finishTransfer(file.key);
  context.renderDesktopFiles();
  assert.equal(desktopFiles.children.length, 1);
  const shortcut = desktopFiles.children[0];
  assert.equal(shortcut.children[0].textContent, 'SUPER_MEGA_GAME.exe');
  assert.equal(manager.windows.size, 0);
  shortcut.handlers.dblclick();
  const first = context.game();
  context.openDesktopFile(file);
  assert.equal(manager.windows.size, 1);
  assert.equal(context.game(), first);
  first.tick(0);
  first.tick(5000);
  assert.equal(first.elapsed, 5);
  manager.close([...manager.windows.keys()][0]);
  assert.equal(visibility.size, 0);
  assert.equal(progression.current.id, 'super-mega-game');
  context.openDesktopFile(file);
  const second = context.game();
  assert.notEqual(second, first);
  assert.equal(second.elapsed, 0);
  assert.equal(second.score, 0);
  assert.equal(second.finished, false);
  assert.equal(manager.windows.size, 1);
});

test('finished mini-game stays single, can replay internally and from desktop after restart without repeating progression', () => {
  const { progression, storage, file } = savedRun();
  progression.finishTransfer(file.key);
  const { context, manager } = setup(progression);
  context.openDesktopFile(file);
  const game = context.game();
  finish(game);
  assert.equal(game.finished, true);
  assert.equal(progression.current, null);
  const saved = JSON.stringify(progression.data);
  context.openDesktopFile(file);
  assert.equal(context.game(), game);
  assert.equal(manager.windows.size, 1);
  game.element.querySelector('.flash-replay').handlers.click();
  assert.equal(game.elapsed, 0);
  assert.equal(game.result.hidden, true);
  finish(game);
  assert.equal(JSON.stringify(progression.data), saved);
  game.element.querySelector('.flash-return').handlers.click();
  assert.equal(manager.windows.size, 0);
  context.openDesktopFile(file);
  assert.equal(context.game().elapsed, 0);
  finish(context.game());
  assert.equal(JSON.stringify(progression.data), saved);
  const loaded = new Progression(story, storage);
  assert.equal(loaded.corrupt, undefined);
  assert.equal(loaded.data.files[file.key].status, 'complete');
  const reopened = setup(loaded);
  reopened.context.openDesktopFile(loaded.data.files[file.key]);
  finish(reopened.context.game());
  assert.equal(JSON.stringify(loaded.data), saved);
  assert.equal(reopened.manager.windows.size, 1);
});

test('development shortcut finishes Smiley normally once, cleans up and allows another round', () => {
  const { progression, file } = savedRun();
  progression.finishTransfer(file.key);
  const { context, visibility } = setup(progression);
  context.openDesktopFile(file);
  const game = context.game();
  let handler;
  let wins = 0;
  context.sounds.play = (sound) => {
    if (sound === 'victory') wins++;
  };
  const remove = installDevelopmentVictoryShortcut(
    {
      addEventListener(type, callback) {
        handler = callback;
      },
      removeEventListener(type, callback) {
        assert.equal(callback, handler);
        handler = null;
      },
    },
    () => game,
  );
  const key = { key: 'D', ctrlKey: true, shiftKey: true, preventDefault() {} };
  handler({ ...key, repeat: true });
  handler({ ...key, ctrlKey: false });
  assert.equal(game.finished, false);
  handler(key);
  assert.equal(game.finished, true);
  assert.equal(game.result.hidden, false);
  assert.equal(game.elapsed, definition.durationSeconds);
  assert.equal(game.targets.length, 0);
  assert.equal(visibility.size, 0);
  assert.equal(progression.current, null);
  const saved = JSON.stringify(progression.data);
  handler(key);
  game.tick(123456);
  assert.equal(wins, 1);
  assert.equal(JSON.stringify(progression.data), saved);
  game.element.querySelector('.flash-replay').handlers.click();
  assert.equal(visibility.size, 1);
  handler(key);
  assert.equal(wins, 2);
  assert.equal(JSON.stringify(progression.data), saved);
  remove();
  assert.equal(handler, null);
});
