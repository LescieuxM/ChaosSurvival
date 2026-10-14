import { icon } from './icons.js';
import { playerIdentity } from './player-identity.js';
import { StartMenuOrder } from './start-menu-order.js';

// Project the existing launch registry and received-file unlocks, never create installations.
export function availablePrograms(applications, files, games) {
  const entries = Object.values(applications).filter(
    (app) => !app.system && app.available?.() !== false,
  );
  const ids = new Set(entries.map((app) => app.id));
  for (const file of Object.values(files ?? {})) {
    const game = games[file.launch?.game];
    const id = `game:${file.launch?.game}`;
    if (file.status !== 'complete' || file.direction !== 'receive' || !game || ids.has(id))
      continue;
    ids.add(id);
    entries.push({
      id,
      name: game.rules?.title ?? game.title,
      icon: 'download',
      category: 'games',
      file,
    });
  }
  return entries;
}
export function frequentPrograms(programs, usage, pinned, defaults = ['arcade']) {
  const available = programs.filter((app) => !pinned.includes(app.id));
  const rank = new Map(defaults.map((id, index) => [id, index]));
  return available
    .filter((app) => usage[app.id]?.count || rank.has(app.id))
    .sort(
      (a, b) =>
        (usage[b.id]?.count ?? 0) - (usage[a.id]?.count ?? 0) ||
        (usage[b.id]?.lastUsed ?? 0) - (usage[a.id]?.lastUsed ?? 0) ||
        (rank.get(a.id) ?? 100) - (rank.get(b.id) ?? 100) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 5);
}
const categories = { accessories: 'Accessoires', games: 'Jeux', applications: 'Applications' };
export class StartMenu {
  constructor(menu, settings, getPrograms, launch) {
    Object.assign(this, { menu, settings, getPrograms, launch });
    this.pinned = menu.querySelector('.start-pinned');
    this.order = new StartMenuOrder(this.pinned, settings);
    this.all = menu.querySelector('.start-all');
    this.submenu = menu.querySelector('.start-programs');
    menu.querySelector('header strong').textContent = playerIdentity.nickname;
    this.all.addEventListener('click', () => this.showAll(true));
    this.all.addEventListener('pointerenter', () => {
      if (!this.order.drag) this.showAll(true);
    });
    menu.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.submenu.hidden) {
        event.preventDefault();
        event.stopPropagation();
        this.showAll(false);
        this.all.focus();
      }
    });
    globalThis.addEventListener('resize', () => {
      if (!this.submenu.hidden) this.position();
    });
  }
  button(app, section) {
    const button = document.createElement('button');
    button.dataset.programId = app.id;
    button.dataset.programSection = section;
    button.innerHTML = icon(app.icon);
    const label = document.createElement('span');
    label.textContent = app.name;
    button.append(label);
    button.addEventListener('click', () => this.launch(app));
    return button;
  }
  refresh() {
    this.programs = this.getPrograms();
    const pinned = this.order.order();
    for (const button of this.order.buttons)
      button.hidden = !this.programs.some((app) => app.id === button.dataset.startApp);
    const frequent = this.menu.querySelector('.start-frequent');
    frequent.replaceChildren(
      ...frequentPrograms(this.programs, this.settings.data.applicationUsage, pinned).map((app) =>
        this.button(app, 'frequent'),
      ),
    );
    this.submenu.replaceChildren();
    for (const [id, label] of Object.entries(categories)) {
      const members = this.programs.filter((app) => (app.category ?? 'applications') === id);
      if (!members.length) continue;
      const group = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = label;
      group.append(summary);
      for (const app of members) group.append(this.button(app, 'all'));
      summary.addEventListener('pointerenter', () => {
        group.open = true;
      });
      group.addEventListener('toggle', () => {
        if (!this.submenu.hidden) this.position();
      });
      this.submenu.append(group);
    }
  }
  record(id, now = Date.now()) {
    const previous = this.settings.data.applicationUsage[id]?.count ?? 0;
    this.settings.update({
      applicationUsage: {
        ...this.settings.data.applicationUsage,
        [id]: { count: Math.min(Number.MAX_SAFE_INTEGER, previous + 1), lastUsed: now },
      },
    });
  }
  showAll(open) {
    this.submenu.hidden = !open;
    this.all.setAttribute('aria-expanded', String(open));
    if (open) this.position();
  }
  position() {
    const button = this.all.getBoundingClientRect();
    const menu = this.menu.getBoundingClientRect();
    const desktop = this.menu.parentElement.getBoundingClientRect();
    const taskbar = this.menu.parentElement.querySelector('.taskbar').getBoundingClientRect();
    const width = Math.min(240, desktop.width - 12);
    this.submenu.style.width = `${width}px`;
    this.submenu.style.maxHeight = `${taskbar.top - desktop.top - 12}px`;
    const x =
      menu.right + width <= desktop.right
        ? menu.right - desktop.left
        : menu.left - width >= desktop.left
          ? menu.left - desktop.left - width
          : desktop.right - desktop.left - width - 6;
    const height = this.submenu.offsetHeight;
    const y = Math.max(desktop.top + 6, Math.min(button.bottom - height, taskbar.top - height - 6));
    this.submenu.style.left = `${x - (menu.left - desktop.left)}px`;
    this.submenu.style.top = `${y - menu.top}px`;
  }
  cancel() {
    this.order.cancel();
    this.showAll(false);
  }
  reset() {
    this.order.reset();
    this.refresh();
  }
}
