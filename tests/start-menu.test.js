import test from 'node:test';
import assert from 'node:assert/strict';
import { UserSettings } from '../src/settings.js';
import { resolveStartMenuOrder } from '../src/ui/start-menu-order.js';

const defaultOrder = ['buddy', 'menu-messenger', 'browser', 'computer', 'folder', 'bin'];

test('the canonical start menu order persists, preserves existing preferences and restores defaults', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const settings = new UserSettings(storage);

  assert.deepEqual(resolveStartMenuOrder(settings.data.startMenuOrder, defaultOrder), defaultOrder);

  const customOrder = ['folder', 'menu-messenger', 'computer', 'buddy', 'bin'];
  settings.update({ startMenuOrder: customOrder, musicVolume: 0.3 });

  const restored = new UserSettings(storage);
  assert.deepEqual(resolveStartMenuOrder(restored.data.startMenuOrder, defaultOrder), [
    ...customOrder,
    'browser',
  ]);
  assert.equal(restored.data.musicVolume, 0.3);

  restored.reset();
  assert.deepEqual(resolveStartMenuOrder(restored.data.startMenuOrder, defaultOrder), defaultOrder);
  assert.deepEqual(restored.data.startMenuOrder, []);
});
