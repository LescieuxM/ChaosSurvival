import test from 'node:test';
import assert from 'node:assert/strict';
import { DesktopSounds } from '../src/audio/sounds.js';

test('Wizz sound is a short original Web Audio buzz with a vibrating frequency sweep', () => {
  const calls = [];
  const parameter = (name) => ({
    setValueAtTime: (value, time) => calls.push([name, 'set', value, time]),
    linearRampToValueAtTime: (value, time) => calls.push([name, 'linear', value, time]),
    exponentialRampToValueAtTime: (value, time) => calls.push([name, 'exponential', value, time]),
  });
  const oscillator = {
    frequency: parameter('frequency'),
    connect: (node) => calls.push(['connect', 'oscillator', node]),
    start: (time) => calls.push(['start', time]),
    stop: (time) => calls.push(['stop', time]),
    disconnect: () => calls.push(['disconnect', 'oscillator']),
  };
  const filter = {
    frequency: parameter('filter-frequency'),
    Q: parameter('filter-q'),
    connect: (node) => calls.push(['connect', 'filter', node]),
    disconnect: () => calls.push(['disconnect', 'filter']),
  };
  const gain = {
    gain: parameter('gain'),
    connect: (node) => calls.push(['connect', 'gain', node]),
    disconnect: () => calls.push(['disconnect', 'gain']),
  };
  const context = {
    state: 'running',
    currentTime: 4,
    destination: {},
    createOscillator: () => oscillator,
    createBiquadFilter: () => filter,
    createGain: () => gain,
  };
  const sounds = new DesktopSounds(() => 0.7, () => context);

  sounds.play('wizz');

  assert.equal(oscillator.type, 'sawtooth');
  const frequencyCalls = calls.filter(([name]) => name === 'frequency');
  assert.deepEqual(frequencyCalls[0], ['frequency', 'set', 360, 4]);
  assert.deepEqual(
    frequencyCalls.filter(([, kind]) => kind === 'linear').map(([, , value]) => value),
    [1180, 240, 1040, 310, 1320, 420, 260],
  );
  assert.ok(calls.some(([name, kind, value]) => name === 'gain' && kind === 'exponential' && value === 0.001));
  assert.ok(calls.some(([name, time]) => name === 'stop' && Math.abs(time - 4.4) < 1e-9));
});
