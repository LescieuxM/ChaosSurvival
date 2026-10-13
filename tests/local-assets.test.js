import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { resolveLocalAsset } = require('../electron/local-assets.cjs');
const root = path.resolve('packaged game', 'resources', 'app.asar', 'dist');

test('packaged pages and encoded music paths resolve inside dist, including ASAR paths with spaces', () => {
  assert.equal(resolveLocalAsset(root, 'chaos://game/'), path.join(root, 'index.html'));
  assert.equal(
    resolveLocalAsset(root, 'chaos://game/assets/music%20mix.mp3?v=1'),
    path.join(root, 'assets', 'music mix.mp3'),
  );
});

test('local resource requests cannot escape the game directory or use external origins', () => {
  for (const url of [
    'https://game/index.html',
    'chaos://elsewhere/index.html',
    'chaos://game/..%2f..%2fsecret.txt',
    'chaos://game/assets%2f..%2f..%2fsecret.txt',
    'chaos://game/..%5csecret.txt',
    'chaos://game/C:%5csecret.txt',
    'chaos://game/assets/%00music.mp3',
  ])
    assert.equal(resolveLocalAsset(root, url), null, url);
});
