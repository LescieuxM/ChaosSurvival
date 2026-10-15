import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameMusic } from '../src/audio/game-music.js';

function fixture() {
  const instances = [];
  class AudioMock {
    constructor(url) {
      this.src = url;
      this.currentTime = 8;
      this.playCount = 0;
      this.pauseCount = 0;
      this.loop = false;
      this.volume = 1;
      instances.push(this);
    }
    play() {
      this.playCount++;
      return Promise.resolve();
    }
    pause() { this.pauseCount++; }
    removeAttribute(name) { this.removedAttribute = name; }
    load() { this.loaded = true; }
  }
  return { instances, factory: () => new AudioMock('/local/game.mp3') };
}

test('game music starts once at 35 percent, loops, rewinds on retries, and resets on stop', () => {
  const { instances, factory } = fixture();
  const music = createGameMusic('/local/game.mp3', factory);
  assert.equal(instances.length, 0);
  assert.equal(music.start(), true);
  assert.equal(instances.length, 1);
  const audio = instances[0];
  assert.equal(audio.src, '/local/game.mp3');
  assert.equal(audio.loop, true);
  assert.equal(audio.volume, 0.35);
  assert.equal(audio.currentTime, 0);
  music.start();
  assert.equal(instances.length, 1);
  assert.equal(audio.playCount, 2);
  music.stop();
  assert.equal(audio.pauseCount, 1);
  assert.equal(audio.currentTime, 0);
  music.start();
  assert.equal(instances.length, 1);
  assert.equal(audio.playCount, 3);
});

test('game music pauses for an actual game pause and releases its media source on disposal', () => {
  const { instances, factory } = fixture();
  const music = createGameMusic('/local/game.mp3', factory);
  music.start();
  const audio = instances[0];
  music.pause();
  assert.equal(audio.pauseCount, 1);
  music.resume();
  assert.equal(audio.playCount, 2);
  music.dispose();
  assert.equal(audio.pauseCount, 2);
  assert.equal(audio.currentTime, 0);
  assert.equal(audio.removedAttribute, 'src');
  assert.equal(audio.loaded, true);
  assert.equal(music.start(), false);
  assert.equal(instances.length, 1);
});

test('media construction and playback failures never throw into gameplay', () => {
  const unavailable = createGameMusic('/missing.mp3', () => {
    throw new Error('unavailable');
  });
  assert.equal(unavailable.start(), false);
  unavailable.stop();
  unavailable.dispose();

  const blocked = createGameMusic('/blocked.mp3', () => ({
    loop: false,
    volume: 1,
    currentTime: 0,
    play() { return Promise.reject(new Error('autoplay blocked')); },
    pause() {},
  }));
  assert.equal(blocked.start(), true);
  blocked.stop();
});
