import test from 'node:test';
import assert from 'node:assert/strict';
import { availablePrograms, frequentPrograms, StartMenu } from '../src/ui/start-menu.js';
import { UserSettings } from '../src/settings.js';

const registry = {
  buddy: { id: 'buddy', name: 'Buddy', category: 'accessories' },
  messenger: { id: 'menu-messenger', name: 'Messenger', category: 'applications' },
  arcade: { id: 'arcade', name: 'ChaosSurvival.exe', category: 'games' },
  computer: { id: 'computer', system: true },
  absent: { id: 'absent', available: () => false },
};
test('All Programs derives availability from existing launchers and received game files, including future unlocks and removals', () => {
  const games = { smiley: { title: 'Smiley' }, future: { title: 'Future' } };
  const file = {
    id: 'smiley-file',
    status: 'pending',
    direction: 'receive',
    launch: { game: 'smiley' },
  };
  const files = { first: file };
  assert.deepEqual(
    availablePrograms(registry, files, games).map((app) => app.id),
    ['buddy', 'menu-messenger', 'arcade'],
  );
  file.status = 'complete';
  files.duplicate = { ...file, id: 'duplicate' };
  files.sent = { ...file, direction: 'send', launch: { game: 'future' } };
  files.unknown = { ...file, launch: { game: 'missing' } };
  assert.deepEqual(
    availablePrograms(registry, files, games).map((app) => app.id),
    ['buddy', 'menu-messenger', 'arcade', 'game:smiley'],
  );
  files.future = { ...file, id: 'future-file', launch: { game: 'future' } };
  assert.equal(availablePrograms(registry, files, games).at(-1).id, 'game:future');
  delete files.first;
  delete files.duplicate;
  assert.ok(!availablePrograms(registry, files, games).some((app) => app.id === 'game:smiley'));
});
test('frequent applications use real counts and recency, never duplicate pinned items or exceed five available apps', () => {
  const apps = availablePrograms(registry, {}, {});
  const pinned = ['buddy', 'menu-messenger'];
  assert.deepEqual(
    frequentPrograms(apps, {}, pinned).map((app) => app.id),
    ['arcade'],
  );
  const extra = Array.from({ length: 9 }, (_, i) => ({ id: `game${i}` }));
  const usage = Object.fromEntries(extra.map((app, i) => [app.id, { count: i + 1, lastUsed: i }]));
  usage.buddy = { count: 100, lastUsed: 100 };
  usage.removed = { count: 1000, lastUsed: 1000 };
  assert.deepEqual(
    frequentPrograms([...apps, ...extra], usage, pinned).map((app) => app.id),
    ['game8', 'game7', 'game6', 'game5', 'game4'],
  );
});
test('usage persists through the existing settings and reset clears it without changing pinned order', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  const settings = new UserSettings(storage);
  settings.update({ startMenuOrder: ['menu-messenger', 'buddy'] });
  StartMenu.prototype.record.call({ settings }, 'arcade', 1);
  StartMenu.prototype.record.call({ settings }, 'arcade', 2);
  const restored = new UserSettings(storage);
  assert.deepEqual(restored.data.applicationUsage, { arcade: { count: 2, lastUsed: 2 } });
  assert.deepEqual(restored.data.startMenuOrder, ['menu-messenger', 'buddy']);
  restored.update({ applicationUsage: { broken: { count: -1, lastUsed: 2 } } });
  assert.deepEqual(restored.data.applicationUsage, {});
  restored.reset();
  assert.deepEqual(restored.data.startMenuOrder, []);
  assert.deepEqual(restored.data.applicationUsage, {});
});
