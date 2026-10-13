import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileChart, Timeline, isOnBeat } from '../src/game/timeline.js';
import { GameState } from '../src/game/state.js';
import { WINDOW_TYPES } from '../src/config/popups.js';

const chart = JSON.parse(readFileSync(new URL('../src/config/chart.json', import.meta.url)));
const music = JSON.parse(
  readFileSync(new URL('../src/config/music-lvl1.analysis.json', import.meta.url)),
);

test('chart events stay ordered and fire exactly once, including frames that skip beats', () => {
  const events = compileChart(chart, music);
  assert.ok(events.length > 100);
  assert.ok(
    events.every(
      (event, i) => event.time < chart.durationSeconds && (!i || event.time >= events[i - 1].time),
    ),
  );
  const timeline = new Timeline(events);
  const received = [];
  timeline.advance(30, (event) => received.push(event));
  timeline.advance(30, (event) => received.push(event));
  timeline.advance(chart.durationSeconds, (event) => received.push(event));
  assert.deepEqual(received, events);
  timeline.reset();
  const replay = [];
  timeline.advance(chart.durationSeconds, (event) => replay.push(event));
  assert.deepEqual(replay, events);
});

test('BPM and initial offset move events and beat bonuses together', () => {
  const adjusted = {
    ...chart,
    analysisFile: undefined,
    bpm: 120,
    offsetSeconds: 0.5,
    patterns: [],
    events: [{ beat: 4, type: 'msn' }],
  };
  assert.equal(compileChart(adjusted)[0].time, 2.5);
  assert.equal(isOnBeat(2.5, adjusted), true);
  assert.equal(isOnBeat(2.7, adjusted), false);
  assert.equal(isOnBeat(0.2, adjusted), false);
});

test('invalid chart configuration is rejected instead of looping forever', () => {
  assert.throws(() => compileChart({ ...chart, analysisFile: undefined, bpm: 0 }));
  assert.throws(() =>
    compileChart({
      ...chart,
      analysisFile: undefined,
      patterns: [{ fromBeat: 0, toBeat: 4, types: ['msn'], everyBeats: 0 }],
    }),
  );
  assert.throws(() =>
    compileChart({ ...chart, analysisFile: undefined, events: [{ beat: 0, type: 'unknown' }] }),
  );
});

test('abandoned windows cause defeat; closing windows rewards points and relieves pressure', () => {
  const state = new GameState(chart.gameplay);
  for (let i = 0; i < 10; i++) state.spawn();
  assert.equal(state.update(1), false);
  const pressure = state.chaos;
  assert.equal(state.close(true), 125);
  assert.ok(state.chaos < pressure);
  assert.equal(state.open, 9);
  assert.equal(state.closed, 1);
  assert.equal(state.update(20), true);
  assert.equal(state.chaos, 100);
  state.reset();
  assert.equal(state.score, 0);
  assert.equal(state.update(90), false);
  assert.equal(state.close(), 0);
});

test('a player who closes each window promptly can survive the whole chart', () => {
  const state = new GameState(chart.gameplay);
  const events = compileChart(chart, music);
  let previousTime = 0;
  for (const event of events) {
    assert.equal(state.update(event.time - previousTime), false);
    if (WINDOW_TYPES.includes(event.type)) {
      state.spawn();
      state.update(0.15);
      state.close();
    }
    previousTime = event.time;
  }
  assert.equal(state.update(chart.durationSeconds - previousTime), false);
  assert.ok(state.score > 3000);
  assert.equal(state.open, 0);
});
