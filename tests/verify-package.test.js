import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyRequiredAudio } from '../scripts/verify-package.mjs';
import { collectAudioReferences } from '../scripts/audio-references.mjs';
import { projectRoot } from '../scripts/verify-package.mjs';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

test('audio resource discovery follows Vite URL references instead of a hard-coded track list', async () => {
  const references = await collectAudioReferences(projectRoot);
  const paths = references.map(({ path }) => path);
  assert.ok(paths.includes('assets/musiclvl1.mp3'));
  assert.ok(paths.includes('assets/djartmusic-i-love-my-8-bit-game-console-301272.mp3'));
  assert.ok(paths.includes('assets/moodmode-retro-game-arcade-236133.mp3'));
  assert.ok(paths.includes('assets/producesplatinum-disco-483559.mp3'));
  assert.ok(paths.includes('assets/cherskis-bubble-popping-3-587265.mp3'));
  assert.ok(paths.includes('assets/9jackjack8-neon-amnesia-club-house-2010-375600.mp3'));
  assert.ok(paths.includes('assets/bransboynd-retro-runner-548536.mp3'));
  assert.ok(paths.includes('assets/jakob_welik-roblox-time-to-win-skyline-run-1-442119.mp3'));
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(paths.every((path) => path.startsWith('assets/') || path.startsWith('public/')));
});

test('portable validation checks each referenced audio by packaged name and source hash', async () => {
  const references = await collectAudioReferences(projectRoot);
  const requiredFiles = await Promise.all(references.map(async ({ path, absolute }) => ({
    path,
    sha256: createHash('sha256').update(await readFile(absolute)).digest('hex'),
  })));
  const packaged = requiredFiles.map(({ path, sha256 }) => {
    const filename = path.split('/').at(-1);
    const stem = filename.slice(0, filename.lastIndexOf('.'));
    return { path: `dist/assets/${stem}-bundlehash.mp3`, sha256 };
  });
  packaged.push({ path: 'dist/assets/optional-future-track.mp3', sha256: 'other' });

  const verified = verifyRequiredAudio(packaged, requiredFiles);
  assert.equal(verified.length, references.length);
  const levelOneIndex = references.findIndex(({ path }) => path === 'assets/musiclvl1.mp3');
  assert.match(verified[levelOneIndex].path, /musiclvl1-bundlehash\.mp3$/);
  assert.equal(verified[levelOneIndex].sha256, requiredFiles[levelOneIndex].sha256);
  assert.throws(() => verifyRequiredAudio(packaged.slice(1), requiredFiles), (error) =>
    error.message.includes(requiredFiles[0].path),
  );
  assert.throws(() => verifyRequiredAudio([...packaged, packaged[0]], requiredFiles), (error) =>
    error.message.includes(requiredFiles[0].path),
  );
});
