import { applicationName } from './identity.js';
import { BrowserSession } from '../browser/session.js';
import { HOME_URL, localPages } from '../browser/registry.js';
import { renderError, pageErrors } from '../browser/pages/error.js';

export function openLocalUrl(url) {
  document.dispatchEvent(new CustomEvent('windows-xd:open-url', { detail: { url } }));
}
export class InternetAdventurer {
  constructor(manager, applications, progression, registry = localPages) {
    Object.assign(this, { manager, applications, progression, registry });
    this.session = new BrowserSession(progression);
    this.generation = 0;
  }
  open(url) {
    const existing = this.instance?.element.isConnected;
    if (existing) {
      this.applications.restore(this.instance);
      if (url !== undefined) {
        this.session.add(url);
        this.load();
      }
      return this.instance;
    }
    if (!this.session.tabs.length) this.session.add();
    if (url !== undefined) this.session.navigate(url);
    const title = applicationName('browser');
    const id = this.manager.spawn('desktopapp', {
      preview: true,
      content: {
        title,
        iconName: 'browser',
        body: `
      <div class="browser-toolbar"><button data-browser-action="back" title="Précédent" aria-label="Précédent">◀</button><button data-browser-action="forward" title="Suivant" aria-label="Suivant">▶</button><button data-browser-action="reload" title="Actualiser" aria-label="Actualiser">↻</button><button data-browser-action="home" title="Accueil" aria-label="Accueil">⌂</button>
      <form class="browser-address"><label>Adresse <input aria-label="Adresse Internet" maxlength="2048" autocomplete="off" spellcheck="false" /></label><button>Aller</button></form></div>
      <div class="browser-tabs" role="tablist" aria-label="Onglets"></div>
      <div class="browser-page" role="region" aria-label="Page Web"></div>
      <div class="window-status browser-statusbar"><span class="browser-status"></span><progress class="browser-progress" hidden></progress></div>`,
      },
      onDismiss: () => {
        clearTimeout(this.timer);
        this.generation++;
        this.observer?.disconnect();
        this.session.save();
        this.instance?.task.remove();
        this.applications.instances.delete('browser');
        this.instance = null;
        this.applications.onWindowState();
      },
    });
    this.instance = this.applications.attachWindow('browser', id, title, 'browser');
    const element = this.instance.element;
    element.classList.add('internet-adventurer');
    element.querySelector('.browser-address').addEventListener('submit', (event) => {
      event.preventDefault();
      this.navigate(element.querySelector('.browser-address input').value);
    });
    element.addEventListener('click', (event) => {
      // A site's anchors never navigate the host document, including future sites.
      if (event.target.closest('.browser-page a')) event.preventDefault();
      const link = event.target.closest('[data-browser-link]');
      if (link) {
        event.preventDefault();
        this.navigate(link.dataset.browserLink);
        return;
      }
      const button = event.target.closest('[data-browser-action]');
      if (!button) return;
      const action = button.dataset.browserAction;
      if (action === 'back') this.session.move(-1);
      if (action === 'forward') this.session.move(1);
      if (action === 'home') this.session.navigate(HOME_URL);
      if (action === 'new') this.session.add();
      if (action === 'select') this.session.select(button.dataset.tabId);
      if (action === 'close') {
        this.session.close(button.dataset.tabId);
        if (!this.session.tabs.length) {
          this.manager.close(this.instance.id);
          return;
        }
      }
      this.load();
    });
    this.observer = new ResizeObserver(() => {
      if (element.hidden || !element.isConnected) return;
      const bounds = this.manager.movementBounds(element);
      element.style.left = `${Math.max(bounds.minX, Math.min(bounds.maxX, parseFloat(element.style.left) || 0))}px`;
      element.style.top = `${Math.max(bounds.minY, Math.min(bounds.maxY, parseFloat(element.style.top) || 0))}px`;
      this.manager.dragged.add(element);
    });
    this.observer.observe(element);
    this.applications.restore(this.instance);
    this.session.save();
    this.load();
    return this.instance;
  }
  navigate(url) {
    this.session.navigate(url);
    this.load();
  }
  tabs() {
    const list = this.instance.element.querySelector('.browser-tabs');
    list.replaceChildren();
    for (const tab of this.session.tabs) {
      const group = document.createElement('div');
      group.className = 'browser-tab';
      group.setAttribute('role', 'tab');
      group.setAttribute('aria-selected', String(tab.id === this.session.active));
      const select = document.createElement('button');
      select.dataset.browserAction = 'select';
      select.dataset.tabId = tab.id;
      select.textContent = tab.title;
      select.title = tab.title;
      const close = document.createElement('button');
      close.dataset.browserAction = 'close';
      close.dataset.tabId = tab.id;
      close.textContent = '×';
      close.setAttribute('aria-label', `Fermer l'onglet ${tab.title}`);
      group.append(select, close);
      list.append(group);
    }
    const add = document.createElement('button');
    add.dataset.browserAction = 'new';
    add.textContent = '+';
    add.setAttribute('aria-label', 'Nouvel onglet');
    list.append(add);
  }
  load() {
    clearTimeout(this.timer);
    const generation = ++this.generation;
    const element = this.instance.element;
    const resolved = this.registry.resolve(this.session.address, this.progression.data);
    this.session.title(
      resolved.page?.title ?? (pageErrors[resolved.error] ?? pageErrors.connection)[0],
    );
    this.tabs();
    element.querySelector('.browser-address input').value = this.session.address;
    element.querySelector('[data-browser-action=back]').disabled = this.session.tab.cursor === 0;
    element.querySelector('[data-browser-action=forward]').disabled =
      this.session.tab.cursor === this.session.tab.history.length - 1;
    const status = element.querySelector('.browser-status'),
      progress = element.querySelector('.browser-progress'),
      page = element.querySelector('.browser-page');
    status.textContent = 'Chargement...';
    progress.hidden = false;
    page.setAttribute('aria-busy', 'true');
    this.timer = setTimeout(() => {
      if (generation !== this.generation || !element.isConnected) return;
      const current = this.registry.resolve(this.session.address, this.progression.data);
      this.session.title(
        current.page?.title ?? (pageErrors[current.error] ?? pageErrors.connection)[0],
      );
      this.tabs();
      page.replaceChildren(
        current.page
          ? current.page.render({
              url: current.url,
              registry: this.registry,
              data: this.progression.data,
              navigate: (url) => this.navigate(url),
            })
          : renderError(current.error),
      );
      if (current.page?.rememberVisit) this.session.recordVisit(current.page.url);
      page.scrollTop = 0;
      page.setAttribute('aria-busy', 'false');
      status.textContent = 'Terminé';
      progress.hidden = true;
    }, 200);
  }
  reset() {
    clearTimeout(this.timer);
    this.generation++;
    this.instance = null;
    this.session.restore();
  }
}
