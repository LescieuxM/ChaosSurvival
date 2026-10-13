import { WINDOW_TYPES } from '../config/popups.js';
import { compileMusicalEvents, musicalPosition, onDetectedBeat } from './music.js';

const eventTypes = [...WINDOW_TYPES, 'notify', 'wizz'];

export function compileChart(chart, music) {
  if (!chart.analysisFile && (!Number.isFinite(chart.bpm) || chart.bpm < 20 || chart.bpm > 400))
    throw new Error('Le BPM doit être compris entre 20 et 400.');
  if (!Number.isFinite(chart.offsetSeconds)) throw new Error('Le décalage audio est invalide.');
  if (!Number.isFinite(chart.durationSeconds) || chart.durationSeconds <= 0)
    throw new Error('La durée doit être positive.');
  if (
    !chart.gameplay ||
    !Number.isInteger(chart.gameplay.maxWindows) ||
    chart.gameplay.maxWindows < 1
  )
    throw new Error('La limite de fenêtres est invalide.');
  for (const key of ['pointsPerClose', 'beatBonus', 'beatToleranceSeconds', 'chaosRelief']) {
    if (!Number.isFinite(chart.gameplay[key]) || chart.gameplay[key] < 0)
      throw new Error(`Réglage invalide : ${key}`);
  }
  if (chart.analysisFile) return compileMusicalEvents(chart, music);
  const secondsPerBeat = 60 / chart.bpm;
  const events = [...(chart.events ?? [])];
  for (const pattern of chart.patterns ?? []) {
    if (
      !Number.isFinite(pattern.fromBeat) ||
      !Number.isFinite(pattern.toBeat) ||
      pattern.fromBeat < 0 ||
      pattern.toBeat <= pattern.fromBeat ||
      !Number.isFinite(pattern.everyBeats) ||
      pattern.everyBeats < 0.25 ||
      !pattern.types?.length ||
      pattern.types.some((type) => !WINDOW_TYPES.includes(type))
    ) {
      throw new Error('Un motif musical est invalide.');
    }
    let index = 0;
    for (let beat = pattern.fromBeat; beat < pattern.toBeat; beat += pattern.everyBeats) {
      events.push({ beat, type: pattern.types[index++ % pattern.types.length] });
    }
  }
  for (const event of events) {
    if (!Number.isFinite(event.beat) || event.beat < 0 || !eventTypes.includes(event.type))
      throw new Error('Un événement musical est invalide.');
  }
  for (const section of chart.sections ?? []) {
    if (
      !Number.isFinite(section.beat) ||
      section.beat < 0 ||
      typeof section.label !== 'string' ||
      typeof section.name !== 'string'
    )
      throw new Error('Une section musicale est invalide.');
  }
  return events
    .map((event) => ({ ...event, time: chart.offsetSeconds + event.beat * secondsPerBeat }))
    .filter((event) => event.time >= 0 && event.time < chart.durationSeconds)
    .sort((a, b) => a.time - b.time);
}

export class Timeline {
  constructor(events) {
    this.events = events;
    this.reset();
  }
  reset() {
    this.cursor = 0;
  }
  seek(time) {
    // Recalibration consumes earlier events without replaying them.
    let low = 0;
    let high = this.events.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (this.events[middle].time <= time) low = middle + 1;
      else high = middle;
    }
    this.cursor = Math.max(this.cursor, low);
  }
  advance(time, emit) {
    while (this.cursor < this.events.length && this.events[this.cursor].time <= time) {
      emit(this.events[this.cursor++]);
    }
  }
}

export function beatPosition(time, chart, music) {
  if (music) return musicalPosition(time - chart.offsetSeconds, music);
  return ((time - chart.offsetSeconds) * chart.bpm) / 60;
}
export function isOnBeat(time, chart, music) {
  if (music)
    return onDetectedBeat(time - chart.offsetSeconds, music, chart.gameplay.beatToleranceSeconds);
  const beat = beatPosition(time, chart);
  return (
    beat >= 0 &&
    (Math.abs(beat - Math.round(beat)) * 60) / chart.bpm <= chart.gameplay.beatToleranceSeconds
  );
}
