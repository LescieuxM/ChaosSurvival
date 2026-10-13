export const SETTINGS_KEY = 'chaos-survival-settings-v1';
export class UserSettings {
  constructor(storage, musicVolume = 0.55) {
    this.storage = storage;
    this.defaults = { version: 1, musicVolume, effectsVolume: 0.65, fullscreen: false };
    this.data = { ...this.defaults };
    try {
      const saved = JSON.parse(storage?.getItem(SETTINGS_KEY) ?? 'null');
      if (saved?.version === 1) {
        for (const key of ['musicVolume', 'effectsVolume'])
          if (Number.isFinite(saved[key]) && saved[key] >= 0 && saved[key] <= 1)
            this.data[key] = saved[key];
        if (typeof saved.fullscreen === 'boolean') this.data.fullscreen = saved.fullscreen;
      }
    } catch {
      /* Invalid preferences use defaults. */
    }
  }
  update(values) {
    for (const [key, value] of Object.entries(values)) {
      if (['musicVolume', 'effectsVolume'].includes(key) && Number.isFinite(value))
        this.data[key] = Math.max(0, Math.min(1, value));
      if (key === 'fullscreen' && typeof value === 'boolean') this.data[key] = value;
    }
    try {
      this.storage?.setItem(SETTINGS_KEY, JSON.stringify(this.data));
    } catch {
      /* Session-only fallback. */
    }
  }
}
export function deleteUserData(storage) {
  if (!storage) return;
  const keys = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith('chaos-survival-') || key?.startsWith('chaos-sync-')) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}
