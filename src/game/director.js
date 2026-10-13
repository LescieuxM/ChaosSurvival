// Never queue missed windows. Decisions use the chart's musical clock.
export class BeginnerDirector {
  constructor(settings) {
    for (const key of [
      'singleWindowRecovery',
      'crowdedRecovery',
      'initialCloseSeconds',
      'maxRecoverySeconds',
    ])
      if (settings[key] !== undefined && (!Number.isFinite(settings[key]) || settings[key] <= 0))
        throw new Error('La récupération adaptative est invalide.');
    if (
      (settings.chaosRecoveryThreshold !== undefined &&
        (!Number.isFinite(settings.chaosRecoveryThreshold) ||
          settings.chaosRecoveryThreshold <= 0 ||
          settings.chaosRecoveryThreshold > 100)) ||
      (settings.recoveryWindows !== undefined &&
        (!Number.isInteger(settings.recoveryWindows) ||
          settings.recoveryWindows < 1 ||
          settings.recoveryWindows > settings.maxWindows)) ||
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
    this.closeSeconds = this.settings.initialCloseSeconds ?? 1.8;
    this.skipped = 0;
    this.reason = 'Prêt';
  }
  preview(event, now, state) {
    if (now - event.time > this.settings.maxEventLatenessSeconds)
      return 'Ralentissement : temps dépassé';
    const limit = Math.min(
      this.settings.peakWindows ?? this.settings.maxWindows,
      event.maxWindows ?? this.settings.maxWindows,
    );
    if (state.open >= limit) return 'Bureau plein : respiration';
    if (
      state.chaos >= (this.settings.chaosRecoveryThreshold ?? 60) &&
      state.open >= (this.settings.recoveryWindows ?? 1)
    )
      return 'Chaos élevé : récupération';
    // Queue residence includes waiting behind other windows. Cap its influence
    // on pacing without losing the player's measured response time.
    const closeSeconds = Math.min(this.closeSeconds, this.settings.maxRecoverySeconds ?? Infinity);
    const recovery =
      state.open >= 2
        ? closeSeconds * (this.settings.crowdedRecovery ?? 1.3)
        : state.open === 1
          ? closeSeconds * (this.settings.singleWindowRecovery ?? 0.6)
          : 0;
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
