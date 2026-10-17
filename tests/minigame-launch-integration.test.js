import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('reopening a mini-game after its narrative transition leaves Messenger windows alone', () => {
  const start = mainSource.indexOf('function prepareMiniGameLaunch() {');
  const end = mainSource.indexOf('\nconst miniGameLauncher', start);
  assert.notEqual(start, -1, 'mini-game transition callback exists');
  assert.notEqual(end, -1, 'mini-game transition callback has a clear boundary');
  const callback = mainSource.slice(start, end);
  const closedWindows = [];
  const context = {
    pixelgirlDialogue: { id: 'pixelgirl-intro' },
    activeDialogue: { id: 'pixelgirl-intro' },
    progression: {
      current: { id: 'pixelgirl-hello', dialogue: 'pixelgirl-intro' },
      complete(id, result) {
        this.completed = [id, result];
        this.current = { id: 'super-mega-game', type: 'minigame' };
      },
    },
    conversation: { element: { isConnected: true, dataset: { windowId: '12' } } },
    manager: {
      close(id) {
        closedWindows.push(id);
        context.conversation.element.isConnected = false;
      },
    },
  };
  vm.runInNewContext(`'use strict'; ${callback}\nprepareMiniGameLaunch();`, context);
  assert.equal(context.progression.completed[0], 'pixelgirl-hello');
  assert.equal(context.progression.completed[1].dialogue, 'pixelgirl-intro');
  assert.deepEqual(closedWindows, [12], 'the first launch completes its intended dialogue transition');

  for (const state of [
    { hidden: false, zIndex: '40', unread: ['message-1'] },
    { hidden: true, zIndex: '41', unread: ['message-2'] },
    { hidden: false, zIndex: '5', unread: ['message-3'] },
    { isConnected: false, hidden: false, zIndex: '42', unread: ['message-4'] },
  ]) {
    context.conversation.element = {
      isConnected: state.isConnected ?? true,
      hidden: state.hidden,
      style: { zIndex: state.zIndex },
      dataset: { windowId: '44' },
    };
    context.conversation.unread = [...state.unread];
    const savedState = {
      connected: context.conversation.element.isConnected,
      hidden: context.conversation.element.hidden,
      zIndex: context.conversation.element.style.zIndex,
      unread: [...context.conversation.unread],
    };
    vm.runInNewContext(`'use strict'; ${callback}\nprepareMiniGameLaunch();`, context);
    assert.deepEqual({
      connected: context.conversation.element.isConnected,
      hidden: context.conversation.element.hidden,
      zIndex: context.conversation.element.style.zIndex,
      unread: [...context.conversation.unread],
    }, savedState);
  }
  assert.deepEqual(closedWindows, [12], 'later opens cannot change or close any Messenger window state');
});
