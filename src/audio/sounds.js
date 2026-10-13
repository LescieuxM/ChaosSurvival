// Small offline synth cues: no downloaded sounds, no dependency on music timing.
export class DesktopSounds {
  constructor(getVolume, getContext) {
    this.getVolume = getVolume;
    this.getContext = getContext;
  }
  async unlock() {
    try {
      this.context = this.getContext() ?? this.context ?? new window.AudioContext();
      if (this.context.state !== 'running') await this.context.resume();
    } catch {
      /* Sound effects are optional. */
    }
  }
  play(kind) {
    const context = this.getContext() ?? this.context;
    if (!context || context.state !== 'running' || !this.getVolume()) return;
    const notes = {
      online: [659, 880, 1047],
      message: [880, 1175],
      wizz: [220, 440, 220, 440],
      offline: [659, 523, 392],
      send: [523, 659],
      catch: [440, 1568, 880],
      victory: [523, 659, 784, 1047, 1319, 1568],
    }[kind] ?? [880];
    notes.forEach((frequency, index) => {
      const start = context.currentTime + index * 0.09;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(this.getVolume() * 0.09, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.18);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  }
}
