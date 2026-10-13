import { clamp } from '../utils/math.js';

const MAX_CHAOS = 100;
const OVERFLOW_PENALTY = 8;

export class GameState {
  constructor(settings) {
    this.settings = settings;
    this.reset();
  }
  reset() {
    this.score = 0;
    this.chaos = 0;
    this.closed = 0;
    this.open = 0;
    this.peak = 0;
  }
  spawn() {
    this.open++;
    this.peak = Math.max(this.peak, this.open);
  }
  close(onBeat = false) {
    if (this.open <= 0) return 0;
    this.open--;
    this.closed++;
    const points = this.settings.pointsPerClose + (onBeat ? this.settings.beatBonus : 0);
    this.score += points;
    this.chaos = Math.max(0, this.chaos - this.settings.chaosRelief);
    return points;
  }
  update(seconds) {
    // A few abandoned windows are tolerable; accumulation quickly becomes costly.
    const pressure =
      this.open === 0
        ? -4
        : this.open * (this.settings.pressurePerWindow ?? 0.32) + Math.max(0, this.open - 3) * 1.25;
    this.chaos = clamp(this.chaos + pressure * Math.max(0, seconds), 0, MAX_CHAOS);
    return this.chaos >= MAX_CHAOS;
  }
  overflow() {
    this.chaos = Math.min(MAX_CHAOS, this.chaos + OVERFLOW_PENALTY);
  }
}
