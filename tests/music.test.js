import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { compileChart, Timeline, isOnBeat, beatPosition } from '../src/game/timeline.js';
import { validateMusic, musicAt } from '../src/game/music.js';
import { BeginnerDirector } from '../src/game/director.js';
import { GameState } from '../src/game/state.js';
import { WINDOW_TYPES } from '../src/config/popups.js';
import { chooseWindowPosition } from '../src/ui/window-placement.js';

const chart = JSON.parse(readFileSync(new URL('../src/config/chart.json', import.meta.url)));
const music = JSON.parse(
  readFileSync(new URL('../src/config/music-lvl1.analysis.json', import.meta.url)),
);
const events = compileChart(chart, music);
const windows = events.filter((event) => WINDOW_TYPES.includes(event.type));

test('analysis belongs to the actual MP3 and every window is anchored to a detected beat', () => {
  const bytes = readFileSync(new URL('../assets/music-lvl1.mp3', import.meta.url));
  assert.equal(music.source.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.ok(music.beats.length > 200);
  assert.ok(music.firstBeatSeconds > 0);
  assert.ok(windows.every((event) => event.time === music.beats[event.beat].time));
  assert.equal(
    events.filter((event) => event.type === 'sparkle').length,
    music.subdivisions.length,
  );
  assert.ok(music.tempoCandidates.some((candidate) => candidate.bpm > 180));
});

test('beat lookup and score follow irregular timestamps and calibration, not the average BPM', () => {
  const irregular = { ...music, beats: [0.3, 0.81, 1.46, 1.9, 2.65].map((time) => ({ time })) };
  const settings = { ...chart, bpm: 170, offsetSeconds: 0.2 };
  assert.equal(isOnBeat(1.01, settings, irregular), true);
  assert.equal(isOnBeat(1.26, settings, irregular), false);
  assert.equal(beatPosition(0.2, settings, irregular), -1);
  assert.equal(beatPosition(1.335, settings, irregular), 1.5);
  assert.equal(musicAt(0.81, irregular).index, 1);
});

test('level one introduces mechanics slowly and breathes during musical breaks', () => {
  const intro = windows.filter((event) => event.beat < 32);
  assert.deepEqual(
    intro.map((event) => event.beat),
    [8, 16, 24],
  );
  assert.ok(intro.every((event) => event.type === 'msn'));
  assert.ok(windows.every((event) => event.everyBeats >= 2));
  assert.ok(windows.some((event) => event.everyBeats === 2));
  for (const event of windows) {
    if (musicAt(event.time, music).section.kind === 'break') assert.equal(event.everyBeats, 8);
    if (event.type === 'virus') assert.ok(event.beat >= 120);
  }
});

test('invalid music timestamps and introductions are rejected', () => {
  assert.throws(() => validateMusic({ ...music, beats: [{ time: 1 }, { time: 0.5 }] }));
  assert.throws(() => compileChart(chart, null));
  assert.throws(() =>
    compileChart({ ...chart, introductions: [{ beat: 0, types: ['unknown'] }] }, music),
  );
  assert.throws(() =>
    compileChart({ ...chart, rhythm: { ...chart.rhythm, intenseEveryBeats: 0 } }, music),
  );
});

test('slow frames, calibration in both directions and a new level never replay consumed events', () => {
  const timeline = new Timeline([{ time: 1 }, { time: 2 }, { time: 3 }, { time: 5 }]);
  const received = [];
  timeline.advance(2, (event) => received.push(event.time));
  timeline.seek(1.5);
  timeline.advance(2.5, (event) => received.push(event.time));
  assert.deepEqual(received, [1, 2]);
  timeline.seek(4);
  timeline.advance(10, (event) => received.push(event.time));
  assert.deepEqual(received, [1, 2, 5]);
  timeline.reset();
  timeline.advance(1, (event) => received.push(event.time));
  assert.equal(received.at(-1), 1);
  const nextLevel = new Timeline([{ time: 0.4 }]);
  nextLevel.advance(0, () => assert.fail('Previous level leaked into next'));
});

test('director suppresses stale/congested beats, retains chaos, and adapts to slow clicks', () => {
  const director = new BeginnerDirector(chart.gameplay);
  const state = new GameState(chart.gameplay);
  assert.equal(director.allow({ time: 1 }, 5, state), false);
  assert.equal(director.allow({ time: 5 }, 5, state), true);
  state.spawn();
  director.closed(9, 5);
  assert.ok(director.closeSeconds > 1.8);
  assert.equal(director.allow({ time: 5.7 }, 5.7, state), false);
  while (state.open < chart.gameplay.maxWindows) state.spawn();
  assert.equal(director.allow({ time: 10 }, 10, state), false);
  assert.equal(state.chaos, 0); // Skips never punish a beginner.
  assert.ok(director.skipped >= 3);
  director.reset();
  assert.equal(director.closeSeconds, 1.8);
  assert.equal(director.skipped, 0);
});

function simulate(secondsPerClick, stall = false) {
  const state = new GameState(chart.gameplay);
  const director = new BeginnerDirector(chart.gameplay);
  const timeline = new Timeline(events);
  const opened = [];
  let time = 0;
  let nextClose = Infinity;
  let maxChaos = 0;
  let actualWindows = 0;
  while (time < chart.durationSeconds) {
    const previous = time;
    time = Math.min(
      chart.durationSeconds,
      time + (stall && time > 26 && time < 26.05 ? 2.2 : 1 / 60),
    );
    assert.equal(state.update(time - previous), false, `Defeat at ${time.toFixed(2)}s`);
    if (time >= nextClose && opened.length) {
      director.closed(time, opened.shift());
      state.close();
      nextClose = opened.length ? time + secondsPerClick : Infinity;
    }
    timeline.advance(time, (event) => {
      if (!WINDOW_TYPES.includes(event.type) || !director.allow(event, time, state)) return;
      state.spawn();
      opened.push(time);
      actualWindows++;
      if (!Number.isFinite(nextClose)) nextClose = time + secondsPerClick;
    });
    assert.ok(state.open <= chart.gameplay.maxWindows);
    maxChaos = Math.max(maxChaos, state.chaos);
  }
  return { maxChaos, actualWindows, skipped: director.skipped, peak: state.peak };
}

test('a beginner closing one window every 2.5–4 seconds survives the entire level, even with a stall', () => {
  const comfortable = simulate(2.5);
  const slow = simulate(4, true);
  assert.ok(comfortable.actualWindows > 15);
  assert.ok(slow.maxChaos < 80);
  assert.ok(slow.skipped > comfortable.skipped);
  assert.ok(slow.actualWindows < windows.length);
});

test('ignoring all windows still fills the chaos gauge and causes defeat', () => {
  const state = new GameState(chart.gameplay);
  const director = new BeginnerDirector(chart.gameplay);
  const timeline = new Timeline(events);
  for (let time = 0; time < chart.durationSeconds; time += 1 / 60) {
    if (state.update(1 / 60)) return;
    timeline.advance(time, (event) => {
      if (WINDOW_TYPES.includes(event.type) && director.allow(event, time, state)) state.spawn();
    });
  }
  assert.fail('A completely abandoned desktop must still reach 100% chaos');
});

test('window placement staggers all three titlebars without hiding existing close buttons', () => {
  for (const [width, height, w, h] of [
    [1136, 524, 330, 340],
    [656, 324, 350, 244],
  ]) {
    const occupied = [];
    for (let i = 1; i <= 3; i++) {
      const position = chooseWindowPosition(width, height, w, h, occupied, i);
      assert.ok(position.x >= 0 && position.x + w <= width);
      assert.ok(position.y >= 0 && position.y + h <= height);
      for (const old of occupied) {
        const cx = old.x + w - 17,
          cy = old.y + 17;
        assert.ok(
          cx < position.x || cx > position.x + w || cy < position.y || cy > position.y + h,
          JSON.stringify({ position, old }),
        );
      }
      occupied.push({ ...position, width: w, height: h });
    }
  }
});
