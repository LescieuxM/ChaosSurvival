import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { compileChart } from '../src/game/timeline.js';
import { WINDOW_TYPES } from '../src/config/popups.js';

const music = JSON.parse(
  await readFile(new URL('../src/config/music-lvl1.analysis.json', import.meta.url), 'utf8'),
);
const chart = JSON.parse(
  await readFile(new URL('../src/config/chart.json', import.meta.url), 'utf8'),
);
const audio = await readFile(new URL(`../assets/${music.source.file}`, import.meta.url));
assert.equal(
  createHash('sha256').update(audio).digest('hex'),
  music.source.sha256,
  'Le MP3 a changé : relancer scripts/analyze-music.py avant de compiler.',
);
assert.equal(chart.analysisFile, 'music-lvl1.analysis.json');
assert.equal(chart.title, music.source.file);
assert.ok(Math.abs(chart.durationSeconds - music.source.durationSeconds) < 0.02);
const events = compileChart(chart, music);
const windows = events.filter((event) => WINDOW_TYPES.includes(event.type));
assert.ok(windows.every((event) => event.time === music.beats[event.beat].time));
console.log(
  `Musique vérifiée : ${music.bpm} BPM, ${music.beats.length} pulsations, ${windows.length} fenêtres possibles, SHA-256 conforme.`,
);
