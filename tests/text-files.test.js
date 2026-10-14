import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Progression } from '../src/story/progression.js';
import { VirtualTextFiles, textBytes, MAX_TEXT_BYTES } from '../src/story/text-files.js';
import { HISTORY_KEY } from '../src/story/progression.js';
const story = JSON.parse(readFileSync(new URL('../src/config/story.json', import.meta.url)));
const storage = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
};

test('virtual text edits persist by path without altering story, original documents or other files', () => {
  const disk = storage();
  const progression = new Progression(story, disk);
  progression.begin();
  progression.complete('arcade-1');
  const before = structuredClone(progression.data);
  const files = new VirtualTextFiles(progression);
  const text = '<script>globalThis.executed=true</script>\nnew Function("alert(1)")\né 😃 日本語';
  files.save('folder/notes.txt', text, 'original');
  files.save('downloads/notes.txt', 'another document', 'download');
  const restored = new Progression(story, disk);
  const read = new VirtualTextFiles(restored);
  assert.equal(read.read('folder/notes.txt', 'original').text, text);
  assert.equal(read.read('downloads/notes.txt', 'download').text, 'another document');
  assert.equal(read.read('new/notes.txt', 'untouched').text, 'untouched');
  const { textFiles, ...rest } = restored.data;
  assert.deepEqual(rest, before);
  assert.equal(read.read('folder/notes.txt', 'new narrative text').text, text);
  assert.equal(read.read('folder/notes.txt', 'new narrative text').conflict, true);
  assert.equal(globalThis.executed, undefined);
});

test('a new game resets document edits and preserves them only in the previous run archive', () => {
  const disk = storage();
  const progression = new Progression(story, disk);
  progression.begin();
  new VirtualTextFiles(progression).save('c/test.txt', 'edited', 'base');
  progression.newGame();
  assert.equal(new VirtualTextFiles(progression).read('c/test.txt', 'base').text, 'base');
  assert.equal(
    JSON.parse(disk.getItem(HISTORY_KEY)).runs[0].textFiles['c/test.txt'].text,
    'edited',
  );
});

test('strict UTF-8 limit accepts exactly 100 KiB and rejects whole oversized saves', () => {
  const progression = new Progression(story, storage());
  const files = new VirtualTextFiles(progression);
  const unicode = '😃'.repeat(MAX_TEXT_BYTES / 4);
  assert.equal(textBytes(unicode), MAX_TEXT_BYTES);
  files.save('c/notes.txt', unicode, 'base');
  for (const text of [unicode + 'é', 'a'.repeat(MAX_TEXT_BYTES + 1)]) {
    assert.throws(() => files.save('c/notes.txt', text, 'base'), /100 Ko/);
    assert.equal(files.read('c/notes.txt', 'base').text, unicode);
  }
  const longOriginal = 'a'.repeat(MAX_TEXT_BYTES + 1);
  assert.deepEqual(files.read('c/large.txt', longOriginal), {
    text: longOriginal,
    readonly: true,
    conflict: false,
  });
});

test('failed storage rolls back the overlay and corrupt edits do not invalidate narrative saves', () => {
  const disk = storage();
  const progression = new Progression(story, disk);
  progression.begin();
  const files = new VirtualTextFiles(progression);
  files.save('c/test.txt', 'saved', 'base');
  disk.setItem = () => {
    throw new Error('quota');
  };
  assert.throws(() => files.save('c/test.txt', 'unsaved', 'base'), /impossible/);
  assert.equal(files.read('c/test.txt', 'base').text, 'saved');
  assert.equal(
    new VirtualTextFiles(new Progression(story, disk)).read('c/test.txt', 'base').text,
    'saved',
  );
  for (const entry of [
    null,
    { text: 3 },
    { text: 'x'.repeat(MAX_TEXT_BYTES + 1), original: 'base' },
  ]) {
    progression.data.textFiles = { 'c/test.txt': entry };
    assert.equal(files.read('c/test.txt', 'base').text, 'base');
    assert.equal(progression.hasSave, true);
  }
});
