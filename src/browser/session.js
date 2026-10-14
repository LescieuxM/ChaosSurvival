import { HOME_URL, normalizeUrl } from './registry.js';

const safeTab = (tab) =>
  tab &&
  typeof tab.id === 'string' &&
  typeof tab.title === 'string' &&
  tab.title.length <= 256 &&
  Array.isArray(tab.history) &&
  tab.history.length > 0 &&
  tab.history.length <= 100 &&
  tab.history.every((url) => typeof url === 'string' && url.length <= 2048) &&
  Number.isInteger(tab.cursor) &&
  tab.cursor >= 0 &&
  tab.cursor < tab.history.length;
export class BrowserSession {
  constructor(progression) {
    this.progression = progression;
    this.restore();
  }
  restore() {
    const saved = this.progression.data.browser;
    this.recentPages = Array.isArray(saved?.recentPages)
      ? [
          ...new Set(
            saved.recentPages.filter((url) => typeof url === 'string' && normalizeUrl(url) === url),
          ),
        ].slice(0, 100)
      : [];
    const valid =
      saved?.version === 1 &&
      Array.isArray(saved.tabs) &&
      saved.tabs.length > 0 &&
      saved.tabs.length <= 30 &&
      saved.tabs.every(safeTab) &&
      new Set(saved.tabs.map((tab) => tab.id)).size === saved.tabs.length &&
      saved.tabs.some((tab) => tab.id === saved.active);
    this.tabs = valid ? structuredClone(saved.tabs) : [];
    this.active = valid ? saved.active : null;
    if (!this.tabs.length) this.add(HOME_URL, false);
  }
  get tab() {
    return this.tabs.find((tab) => tab.id === this.active);
  }
  get address() {
    return this.tab.history[this.tab.cursor];
  }
  save() {
    this.progression.data.browser = {
      version: 1,
      active: this.active,
      tabs: structuredClone(this.tabs),
      recentPages: [...this.recentPages],
    };
    this.progression.save();
  }
  add(input = HOME_URL, persist = true) {
    if (this.tabs.length >= 30) return false;
    const tab = {
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      title: 'Nouvel onglet',
      history: [normalizeUrl(input) ?? String(input).slice(0, 2048)],
      cursor: 0,
    };
    this.tabs.push(tab);
    this.active = tab.id;
    if (persist) this.save();
    return tab;
  }
  navigate(input) {
    const address = normalizeUrl(input) ?? String(input).slice(0, 2048);
    const tab = this.tab;
    tab.history = tab.history.slice(0, tab.cursor + 1);
    tab.history.push(address);
    if (tab.history.length > 100) tab.history.shift();
    tab.cursor = tab.history.length - 1;
    this.save();
  }
  move(delta) {
    const tab = this.tab;
    const cursor = tab.cursor + delta;
    if (cursor < 0 || cursor >= tab.history.length) return false;
    tab.cursor = cursor;
    this.save();
    return true;
  }
  select(id) {
    if (!this.tabs.some((tab) => tab.id === id)) return false;
    this.active = id;
    this.save();
    return true;
  }
  close(id) {
    const index = this.tabs.findIndex((tab) => tab.id === id);
    if (index < 0) return;
    this.tabs.splice(index, 1);
    if (this.active === id)
      this.active = this.tabs[Math.min(index, this.tabs.length - 1)]?.id ?? null;
    this.save();
  }
  title(title) {
    if (this.tab.title === title) return;
    this.tab.title = title.slice(0, 256);
    this.save();
  }
  recordVisit(url) {
    const address = normalizeUrl(url);
    if (!address || this.recentPages[0] === address) return;
    this.recentPages = [address, ...this.recentPages.filter((entry) => entry !== address)].slice(
      0,
      100,
    );
    this.save();
  }
}
