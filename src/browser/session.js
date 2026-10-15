import { HOME_URL, normalizeUrl } from './registry.js';

const safeTab = (tab) =>
  tab &&
  typeof tab.id === 'string' &&
  tab.id.length > 0 &&
  typeof tab.title === 'string' &&
  tab.title.length <= 256 &&
  Array.isArray(tab.history) &&
  tab.history.length > 0 &&
  tab.history.length <= 100;
const validSavedUrl = (url) => {
  const normalized = normalizeUrl(url);
  if (!normalized || normalized !== url) return false;
  return new URL(normalized).hostname !== 'www.xdhotel.fr';
};

function restoreTab(tab) {
  if (!safeTab(tab)) return null;
  const history = tab.history.filter(
    (url) => typeof url === 'string' && url.length <= 2048 && validSavedUrl(url),
  );
  if (!history.length) return null;
  const current = tab.history[tab.cursor];
  let cursor = Number.isInteger(tab.cursor) && validSavedUrl(current) ? history.indexOf(current) : -1;
  if (cursor < 0) {
    const before = Number.isInteger(tab.cursor) ? Math.min(tab.cursor - 1, tab.history.length - 1) : -1;
    for (let index = before; index >= 0 && cursor < 0; index--) {
      if (validSavedUrl(tab.history[index])) cursor = history.indexOf(tab.history[index]);
    }
    if (cursor < 0) cursor = 0;
  }
  return { ...tab, history, cursor };
}
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
            saved.recentPages.filter(validSavedUrl),
          ),
        ].slice(0, 100)
      : [];
    const restored = saved?.version === 1 && Array.isArray(saved.tabs)
      ? saved.tabs.slice(0, 30).map(restoreTab).filter(Boolean)
      : [];
    this.tabs = restored.filter(
      (tab, index) => restored.findIndex((candidate) => candidate.id === tab.id) === index,
    );
    this.active = this.tabs.some((tab) => tab.id === saved?.active)
      ? saved.active
      : (this.tabs[0]?.id ?? null);
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
