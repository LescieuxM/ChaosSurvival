import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../src/audio/engine.js';

test('muting changes only the music gain while its timeline keeps running', async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const gainValues = [];
  let playStarts = 0;
  const context = {
    currentTime: 10,
    state: 'running',
    destination: {},
    resume: async () => {},
    decodeAudioData: async () => ({ duration: 90 }),
    createGain: () => ({
      gain: {
        set value(value) { gainValues.push(value); },
        setTargetAtTime(value) { gainValues.push(value); },
      },
      connect() {},
    }),
    createBufferSource: () => ({
      connect() {},
      start() { playStarts++; },
      stop() {},
      disconnect() {},
    }),
  };
  globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  globalThis.window = { AudioContext: class { constructor() { return context; } } };

  try {
    const audio = new AudioEngine(0.55, '/local/music.mp3');
    await audio.start();
    assert.equal(audio.muted, false);
    assert.equal(gainValues.at(-1), 0.55);

    assert.equal(audio.setMuted(true), true);
    assert.equal(gainValues.at(-1), 0);
    const mutedTime = audio.time;
    context.currentTime += 2;
    assert.ok(audio.time > mutedTime);
    const progressedTime = audio.time;

    assert.equal(audio.setMuted(false), false);
    assert.equal(gainValues.at(-1), 0.55);
    assert.equal(audio.time, progressedTime);
    assert.equal(playStarts, 1);

    audio.setMuted(true);
    await audio.start();
    assert.equal(audio.muted, true);
    assert.equal(gainValues.at(-1), 0);
    assert.equal(playStarts, 2);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
