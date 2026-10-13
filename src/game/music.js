import { WINDOW_TYPES } from '../config/popups.js';

// The average BPM is informational. Gameplay uses recorded audio attacks.
export function indexAtTime(items, time) {
  let low = 0;
  let high = items.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (items[middle].time <= time) low = middle + 1;
    else high = middle;
  }
  return low - 1;
}

export function validateMusic(music) {
  if (!music || music.schemaVersion !== 1 || !music.beats?.length)
    throw new Error('Les battements analysés sont absents.');
  if (!Number.isFinite(music.source?.durationSeconds) || music.source.durationSeconds <= 0)
    throw new Error('La durée audio analysée est invalide.');
  if (!Number.isFinite(music.bpm) || music.bpm < 20 || music.bpm > 400)
    throw new Error('Le tempo analysé est invalide.');
  for (const key of ['beats', 'subdivisions', 'sections', 'intensity']) {
    if (!Array.isArray(music[key])) throw new Error(`Données musicales absentes : ${key}`);
    for (let i = 0; i < music[key].length; i++) {
      const item = music[key][i];
      if (
        !Number.isFinite(item.time) ||
        item.time < 0 ||
        item.time > music.source.durationSeconds ||
        (i > 0 && item.time <= music[key][i - 1].time)
      )
        throw new Error(`Timestamps musicaux invalides : ${key}`);
      if (
        key === 'beats' &&
        (!Number.isFinite(item.intensity) || item.intensity < 0 || item.intensity > 1)
      )
        throw new Error('Une intensité musicale est invalide.');
    }
  }
}

export function musicalPosition(time, music) {
  const index = indexAtTime(music.beats, time);
  if (index < 0) return -1;
  const start = music.beats[index].time;
  const end = music.beats[index + 1]?.time;
  return end === undefined ? index : index + (time - start) / (end - start);
}

export function onDetectedBeat(time, music, tolerance) {
  const index = indexAtTime(music.beats, time);
  return [music.beats[index], music.beats[index + 1]].some(
    (beat) => beat && Math.abs(time - beat.time) <= tolerance,
  );
}

export function musicAt(time, music) {
  const index = indexAtTime(music.beats, time);
  return {
    index,
    beat: music.beats[index],
    nextBeat: music.beats[index + 1],
    section: music.sections[indexAtTime(music.sections, time)],
    intensity: music.intensity[indexAtTime(music.intensity, time)]?.value ?? 0,
  };
}

export function windowCadence(index, beat, section, settings) {
  if (index < settings.introUntilBeat) return settings.introEveryBeats;
  if (['intro', 'break', 'outro'].includes(section?.kind)) return settings.calmEveryBeats;
  if (beat.intensity >= 0.7 || section?.kind === 'drop') return settings.intenseEveryBeats;
  if (beat.intensity >= 0.4) return 4;
  return section?.kind === 'build' ? 6 : settings.calmEveryBeats;
}

export function compileMusicalEvents(chart, music) {
  validateMusic(music);
  const settings = chart.rhythm;
  if (
    !settings ||
    !Number.isInteger(settings.introUntilBeat) ||
    settings.introUntilBeat < 0 ||
    !['introEveryBeats', 'calmEveryBeats', 'intenseEveryBeats'].every(
      (key) => Number.isInteger(settings[key]) && settings[key] >= 2,
    )
  )
    throw new Error('La cadence du niveau est invalide.');
  if (
    !chart.introductions?.length ||
    chart.introductions[0].beat !== 0 ||
    chart.introductions.some(
      (item, i) =>
        !Number.isInteger(item.beat) ||
        item.beat < 0 ||
        (i > 0 && item.beat <= chart.introductions[i - 1].beat) ||
        !item.types?.length ||
        item.types.some((type) => !WINDOW_TYPES.includes(type)),
    )
  )
    throw new Error('Les introductions des fenêtres sont invalides.');
  const events = [];
  let nextWindowBeat = settings.introEveryBeats;
  let sequence = 0;
  music.beats.forEach((beat, index) => {
    const section = music.sections[indexAtTime(music.sections, beat.time)];
    events.push({ ...beat, beat: index, type: 'pulse' });
    if (index < nextWindowBeat || section?.kind === 'outro') return;
    const introduction = chart.introductions.findLast((item) => item.beat <= index);
    const everyBeats = windowCadence(index, beat, section, settings);
    events.push({
      ...beat,
      beat: index,
      type: introduction.types[sequence++ % introduction.types.length],
      everyBeats,
    });
    nextWindowBeat = index + everyBeats;
  });
  // Detected offbeat attacks add sparkle without increasing the click load.
  for (const subdivision of music.subdivisions) events.push({ ...subdivision, type: 'sparkle' });
  for (const section of music.sections) {
    if (!section.time || section.kind === 'outro') continue;
    const messages = {
      break: 'Petite respiration : prends ton temps pour fermer les fenêtres.',
      drop: 'Monte le son ! Le bureau danse avec toi.',
      build: 'Les amis arrivent… ferme les fenêtres à ton rythme.',
      calm: 'Tout va bien. Profite de la musique ♫',
    };
    events.push({
      time: section.time,
      type: 'notify',
      contact: 'MSN DJ',
      message: messages[section.kind] ?? 'Bienvenue !',
    });
    if (section.kind === 'drop') events.push({ time: section.time, type: 'wizz' });
  }
  return events
    .filter((event) => event.time >= 0 && event.time < chart.durationSeconds)
    .sort((a, b) => a.time - b.time);
}
