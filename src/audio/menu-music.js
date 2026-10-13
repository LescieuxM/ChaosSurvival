const MENU_MELODY = [
  76, 79, 81, 79, 76, 74, 72, 74, 77, 81, 84, 81, 77, 76, 74, 72, 79, 83, 86, 83, 79, 77, 76, 74,
  72, 76, 79, 84, 81, 79, 76, 74,
];

// A local, original chiptune. Independent from the level's audio clock.
export class MenuMusic {
  constructor(getVolume) {
    this.getVolume = getVolume;
    this.voices = new Set();
  }
  async start() {
    if (this.active) return;
    this.active = true;
    try {
      this.context ??= new window.AudioContext();
      this.gain ??= this.context.createGain();
      this.gain.disconnect();
      this.gain.connect(this.context.destination);
      await this.context.resume();
      if (!this.active) return;
      this.setVolume(this.getVolume());
      this.step = 0;
      this.nextTime = this.context.currentTime + 0.05;
      this.tick();
    } catch {
      this.active = false; /* Retry on a user gesture if autoplay is blocked. */
    }
  }
  setVolume(value) {
    if (this.gain) this.gain.gain.setTargetAtTime(value * 0.17, this.context.currentTime, 0.03);
  }
  note(midi, time, duration, type, level) {
    const voice = this.context.createOscillator();
    const envelope = this.context.createGain();
    voice.type = type;
    voice.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(level, time + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + duration);
    voice.connect(envelope);
    envelope.connect(this.gain);
    this.voices.add(voice);
    voice.onended = () => {
      this.voices.delete(voice);
      voice.disconnect();
      envelope.disconnect();
    };
    voice.start(time);
    voice.stop(time + duration + 0.01);
  }
  tick() {
    if (!this.active) return;
    // Skip suspended/background intervals instead of queuing accumulated notes.
    if (this.nextTime < this.context.currentTime) this.nextTime = this.context.currentTime + 0.02;
    while (this.nextTime < this.context.currentTime + 0.12) {
      this.note(MENU_MELODY[this.step % MENU_MELODY.length], this.nextTime, 0.16, 'triangle', 0.7);
      if (this.step % 2 === 0)
        this.note(
          [48, 53, 55, 48][Math.floor(this.step / 8) % 4],
          this.nextTime,
          0.23,
          'triangle',
          0.8,
        );
      if (this.step % 4 === 0) this.note(36, this.nextTime, 0.065, 'sine', 0.8);
      this.step++;
      this.nextTime += 60 / 126 / 2;
    }
    this.frame = requestAnimationFrame(() => this.tick());
  }
  stop() {
    this.active = false;
    cancelAnimationFrame(this.frame);
    for (const voice of this.voices) {
      try {
        voice.stop();
      } catch {
        /* Already ended. */
      }
    }
    this.gain?.disconnect();
  }
}
