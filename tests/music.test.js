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
// Previous released level, used to measure actual difficulty rather than only settings.
const previousChart = structuredClone(chart);
Object.assign(previousChart.gameplay, {
  chaosRelief: 3,
  maxWindows: 3,
  peakWindows: 4,
  pressurePerWindow: 0.5,
  minSpawnSeconds: 0.28,
  singleWindowRecovery: 0.25,
  crowdedRecovery: 0.45,
});
for (const key of [
  'initialCloseSeconds',
  'maxRecoverySeconds',
  'chaosRecoveryThreshold',
  'recoveryWindows',
])
  delete previousChart.gameplay[key];
Object.assign(previousChart.rhythm, {
  introUntilBeat: 32,
  introEveryBeats: 8,
  calmEveryBeats: 6,
  normalEveryBeats: 3,
  mediumEveryBeats: 3,
  buildEveryBeats: 3,
  buildLateEveryBeats: 2,
  dropBurstPeriodBeats: 16,
});

test('analysis belongs to the actual MP3 and every window is anchored to a detected beat', () => {
  const bytes = readFileSync(new URL('../assets/musiclvl1.mp3', import.meta.url));
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

test('the level ends at the decoded MP3 duration and never schedules events beyond it', () => {
  const duration = music.source.decodedSamples / music.source.sampleRate;
  assert.equal(music.source.file, 'musiclvl1.mp3');
  assert.equal(chart.durationSeconds, duration);
  assert.equal(music.source.durationSeconds, duration);
  assert.ok(events.every((event) => event.time < duration));
  for (const key of [
    'beats',
    'subdivisions',
    'kicks',
    'accents',
    'intensity',
    'phrases',
    'sections',
  ]) {
    assert.ok(
      music[key].every(
        (item) => item.time < duration && (item.endTime === undefined || item.endTime <= duration),
      ),
      key,
    );
  }
  const shortened = { ...chart, durationSeconds: duration - 4 };
  assert.deepEqual(
    compileChart(shortened, music),
    events.filter((event) => event.time < shortened.durationSeconds),
  );
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

test('Medium introduces mechanics before beat-aligned build and drop bursts, with musical breaks', () => {
  const intro = windows.filter((event) => event.beat < chart.rhythm.introUntilBeat);
  assert.deepEqual(
    intro.map((event) => event.beat),
    [4, 8, 12],
  );
  assert.ok(intro.every((event) => event.type === 'msn'));
  assert.ok(windows.every((event) => event.everyBeats >= 1));
  assert.ok(windows.some((event) => event.everyBeats === 2));
  for (const event of windows) {
    if (musicAt(event.time, music).section.kind === 'break')
      assert.equal(event.everyBeats, chart.rhythm.calmEveryBeats);
    if (event.everyBeats === 1) {
      assert.ok(['drop', 'build'].includes(musicAt(event.time, music).section.kind));
      assert.equal(event.maxWindows, 4);
    }
    if (event.type === 'virus') assert.ok(event.beat >= 120);
  }
});
test('Medium has at least 50% more beat-aligned windows than the previous level', () => {
  const previous = compileChart(previousChart, music).filter((event) =>
    WINDOW_TYPES.includes(event.type),
  );
  assert.ok(windows.length >= previous.length * 1.5);
  assert.equal(chart.gameplay.maxWindows, 4);
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
  assert.ok(director.closeSeconds > chart.gameplay.initialCloseSeconds);
  assert.equal(director.allow({ time: 5.4 }, 5.4, state), false);
  while (state.open < chart.gameplay.maxWindows) state.spawn();
  assert.equal(director.allow({ time: 10 }, 10, state), false);
  assert.equal(state.chaos, 0); // Skips never punish a beginner.
  assert.ok(director.skipped >= 3);
  director.reset();
  assert.equal(director.closeSeconds, chart.gameplay.initialCloseSeconds);
  assert.equal(director.skipped, 0);
});

function simulate(secondsPerClick, stall = false, configuration = chart) {
  const state = new GameState(configuration.gameplay);
  const director = new BeginnerDirector(configuration.gameplay);
  const timeline = new Timeline(compileChart(configuration, music));
  const opened = [];
  let time = 0;
  let nextClose = Infinity;
  let maxChaos = 0;
  let actualWindows = 0;
  let lost = false;
  while (time < chart.durationSeconds) {
    const previous = time;
    time = Math.min(
      chart.durationSeconds,
      time + (stall && time > 26 && time < 26.05 ? 2.2 : 1 / 60),
    );
    if (state.update(time - previous)) {
      lost = true;
      break;
    }
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
    assert.ok(state.open <= configuration.gameplay.peakWindows);
    maxChaos = Math.max(maxChaos, state.chaos);
  }
  return { lost, time, maxChaos, actualWindows, skipped: director.skipped, peak: state.peak };
}

test('Medium is winnable with practice and a stalled frame, but no longer rewards slow clicking', () => {
  for (const speed of [0.55, 0.8, 1]) {
    const result = simulate(speed, true);
    assert.equal(result.lost, false, JSON.stringify({ speed, result }));
    assert.ok(result.actualWindows > 65);
    assert.ok(result.skipped > 0);
  }
  for (const speed of [1.5, 2.5, 4]) {
    assert.equal(simulate(speed).lost, true, `Too forgiving at ${speed} seconds per click`);
    assert.equal(simulate(speed, false, previousChart).lost, false);
  }
});

test('actual click load rises significantly and adaptation retains a manageable four-window cap', () => {
  const previous = simulate(0.8, false, previousChart).actualWindows;
  const current = simulate(0.8).actualWindows;
  assert.ok(current >= previous * 1.3, `${previous} -> ${current}`);
  const director = new BeginnerDirector(chart.gameplay);
  const state = new GameState(chart.gameplay);
  while (state.open < 4) state.spawn();
  assert.equal(director.allow({ time: 10 }, 10, state), false);
  assert.equal(director.allow({ time: 10, maxWindows: 4 }, 10, state), false);
  assert.equal(director.allow({ time: 20, maxWindows: 4 }, 20, state), false);
});

test('adaptive recovery is bounded in Medium while legacy levels retain their previous defaults', () => {
  const medium = new BeginnerDirector(chart.gameplay);
  const old = new BeginnerDirector(previousChart.gameplay);
  medium.closeSeconds = old.closeSeconds = 6;
  medium.lastSpawn = old.lastSpawn = 0;
  const state = { open: 2, chaos: 0 };
  assert.equal(medium.allow({ time: 1 }, 1, state), true);
  assert.equal(old.allow({ time: 1 }, 1, state), false);
  assert.equal(
    medium.preview({ time: 10 }, 10, { open: 2, chaos: 90 }),
    'Chaos élevé : récupération',
  );
  assert.equal(old.preview({ time: 10 }, 10, { open: 1, chaos: 60 }), 'Chaos élevé : récupération');
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

test('successive isolated windows vary across the desktop instead of always spawning on the right', () => {
  const positions = Array.from({ length: 24 }, (_, index) =>
    chooseWindowPosition(1136, 524, 330, 340, [], index + 1),
  );
  assert.ok(positions.some(({ x }) => x < 200));
  assert.ok(positions.some(({ x }) => x > 600));
  assert.ok(positions.some(({ y }) => y > 100));
  assert.equal(new Set(positions.map(({ x, y }) => `${x}:${y}`)).size, positions.length);
});

test('window placement staggers all four titlebars without hiding existing close buttons', () => {
  for (const [width, height, w, h] of [
    [1136, 524, 330, 340],
    [656, 324, 350, 244],
  ]) {
    const occupied = [];
    for (let i = 1; i <= 4; i++) {
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
