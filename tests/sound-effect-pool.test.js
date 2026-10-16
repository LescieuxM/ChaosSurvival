import test from 'node:test';
import assert from 'node:assert/strict';
import { createSoundEffectPool } from '../src/audio/sound-effect-pool.js';

test('sound effect pool overlaps, stays bounded, reuses finished voices and disposes all sources', () => {
  const voices = [];
  const pool = createSoundEffectPool('/bubble.mp3', {
    size: 3,
    volume: 0.5,
    AudioConstructor: () => {
      const voice = {
        src: '/bubble.mp3',
        currentTime: 8,
        volume: 1,
        paused: true,
        ended: false,
        playCount: 0,
        play() {
          this.paused = false;
          this.playCount++;
          return Promise.resolve();
        },
        pause() { this.paused = true; },
        removeAttribute(name) { if (name === 'src') this.src = ''; },
        load() {},
      };
      voices.push(voice);
      return voice;
    },
  });

  assert.equal(pool.play(), true);
  assert.equal(pool.play(), true);
  assert.equal(pool.play(), true);
  assert.equal(voices.length, 3);
  assert.ok(voices.every((voice) => voice.volume === 0.5 && voice.currentTime === 0));
  assert.equal(pool.play(), false, 'a full pool does not interrupt active sounds');
  assert.equal(voices.length, 3);

  voices[0].paused = true;
  voices[0].currentTime = 0.4;
  assert.equal(pool.play(), true);
  assert.equal(voices.length, 3);
  assert.equal(voices[0].playCount, 2);
  assert.equal(voices[0].currentTime, 0);

  pool.stopAll();
  assert.ok(voices.every((voice) => voice.paused && voice.currentTime === 0));
  pool.dispose();
  assert.ok(voices.every((voice) => voice.src === ''));
  assert.equal(pool.play(), false);
});
