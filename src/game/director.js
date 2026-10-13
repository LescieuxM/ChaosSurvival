// Never queue missed windows. Decisions use the chart's musical clock.
export class BeginnerDirector {
  constructor(settings) {
    if (
      !Number.isFinite(settings.minSpawnSeconds) ||
      settings.minSpawnSeconds <= 0 ||
      !Number.isFinite(settings.maxEventLatenessSeconds) ||
      settings.maxEventLatenessSeconds <= 0
    )
      throw new Error('Les réglages de récupération sont invalides.');
    this.settings = settings;
    this.reset();
  }
  reset() {
    this.lastSpawn = -Infinity;
    this.closeSeconds = 1.8;
    this.skipped = 0;
    this.reason = 'Prêt';
  }
  preview(event, now, state) {
    if (now - event.time > this.settings.maxEventLatenessSeconds)
      return 'Ralentissement : temps dépassé';
    if (state.open >= this.settings.maxWindows) return 'Bureau plein : respiration';
    if (state.chaos >= 60 && state.open >= 1) return 'Chaos élevé : récupération';
    const recovery =
      state.open >= 2 ? this.closeSeconds * 1.3 : state.open === 1 ? this.closeSeconds * 0.6 : 0;
    if (now - this.lastSpawn < Math.max(this.settings.minSpawnSeconds, recovery))
      return 'Récupération entre deux fenêtres';
    return '';
  }
  allow(event, now, state) {
    const reason = this.preview(event, now, state);
    this.reason = reason || 'Sur la pulsation';
    if (reason) {
      this.skipped++;
      return false;
    }
    this.lastSpawn = now;
    return true;
  }
  closed(time, openedAt) {
    if (!Number.isFinite(openedAt)) return;
    const response = Math.min(6, Math.max(0.4, time - openedAt));
    this.closeSeconds = this.closeSeconds * 0.7 + response * 0.3;
  }
}
