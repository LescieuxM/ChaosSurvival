export class AudioEngine {
  constructor(volume, url = new URL('../../assets/musiclvl1.mp3', import.meta.url).href) {
    this.volume = volume;
    this.muted = false;
    this.buffer = null;
    this.startTime = 0;
    this.stoppedTime = 0;
    this.loading = fetch(url).then((response) => {
      if (!response.ok) throw new Error('Le fichier assets/musiclvl1.mp3 est introuvable.');
      return response.arrayBuffer();
    });
    // Keep preload failures handled until the player presses START.
    this.loading.catch(() => {});
  }
  async start() {
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Ce navigateur ne prend pas en charge Web Audio.');
    this.context ??= new AudioContextClass();
    // Resume directly in the click handler to satisfy browser autoplay policies.
    await this.context.resume();
    if (!this.buffer)
      this.buffer = await this.context.decodeAudioData((await this.loading).slice(0));
    this.stop();
    if (!this.gain) {
      this.gain = this.context.createGain();
      this.gain.connect(this.context.destination);
    }
    this.gain.gain.value = this.muted ? 0 : this.volume;
    this.source = this.context.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.connect(this.gain);
    this.startTime = this.context.currentTime + 0.08;
    this.stoppedTime = 0;
    this.source.start(this.startTime);
    return this.buffer.duration;
  }
  get time() {
    if (!this.source) return this.stoppedTime;
    return Math.min(this.buffer.duration, Math.max(0, this.context.currentTime - this.startTime));
  }
  async pause() {
    if (this.context?.state === 'running') await this.context.suspend();
  }
  async resume() {
    await this.context?.resume();
  }
  setVolume(value) {
    this.volume = value;
    if (this.gain)
      this.gain.gain.setTargetAtTime(this.muted ? 0 : value, this.context.currentTime, 0.025);
  }
  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.gain)
      this.gain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, 0.025);
    return this.muted;
  }
  stop(reset = false) {
    if (!this.source) {
      if (reset) this.stoppedTime = 0;
      return;
    }
    this.stoppedTime = reset ? 0 : this.time;
    this.source.stop();
    this.source.disconnect();
    this.source = null;
  }
}
