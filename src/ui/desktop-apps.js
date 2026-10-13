import definitions from '../config/desktop-apps.json' with { type: 'json' };
import { icon } from './icons.js';

export const desktopApps = definitions;

export class DesktopApplications {
  constructor(manager, taskbar, onWindowState = () => {}) {
    Object.assign(this, { manager, taskbar, onWindowState });
    this.instances = new Map();
  }
  open(kind) {
    const definition = definitions[kind];
    if (!definition) return;
    const existing = this.instances.get(kind);
    if (existing?.element.isConnected) {
      this.restore(existing);
      return existing;
    }
    const id = this.manager.spawn('desktopapp', {
      preview: true,
      x: 0.25,
      y: 0.12,
      content: {
        title: definition.title,
        iconName: definition.icon,
        body: `
        <div class="explorer-menu">Fichier <span>Édition</span><span>Affichage</span><span>Favoris</span><span>Outils</span><span>Aide</span></div>
        <div class="explorer-toolbar"><button class="xp-button explorer-back" disabled>◀ Précédente</button><button class="xp-button explorer-home">${icon('folder')} Dossiers</button><span>▦ Affichage : icônes</span></div>
        <div class="explorer-address">Adresse <strong></strong></div>
        <div class="explorer-content"><aside><h3>Gestion du système</h3><p>Afficher les informations</p><h3>Autres emplacements</h3><button data-location="computer">Poste de travail</button><button data-location="folder">Mes documents</button><button data-location="bin">Corbeille</button><h3>Détails</h3><p class="explorer-description"></p></aside><section class="explorer-items" aria-label="Contenu du dossier"></section></div>
        <div class="window-status explorer-status"></div>`,
      },
      onDismiss: () => {
        this.instances.delete(kind);
        instance.task.remove();
        this.onWindowState();
      },
    });
    const element = this.manager.windows.get(id).element;
    const task = document.createElement('button');
    task.className = 'task-tab desktop-app-task';
    task.dataset.app = kind;
    task.innerHTML = `${icon(definition.icon)}<span>${definition.title}</span>`;
    task.title = definition.title;
    this.taskbar.insertBefore(task, this.taskbar.querySelector('.tray'));
    const instance = { id, kind, element, task, history: [] };
    this.instances.set(kind, instance);
    const minimize = document.createElement('button');
    minimize.className = 'msn-minimize';
    minimize.textContent = '−';
    minimize.setAttribute('aria-label', `Réduire ${definition.title}`);
    minimize.addEventListener('click', () => {
      element.hidden = true;
      task.setAttribute('aria-pressed', 'false');
      this.onWindowState();
    });
    element
      .querySelector('.titlebar')
      .insertBefore(minimize, element.querySelector('.close-button'));
    task.addEventListener('click', () => this.restore(instance));
    element
      .querySelector('.explorer-home')
      .addEventListener('click', () => this.render(instance, definition));
    element.querySelector('.explorer-back').addEventListener('click', () => {
      const previous = instance.history.pop();
      if (previous) this.render(instance, previous, false);
    });
    element
      .querySelectorAll('[data-location]')
      .forEach((button) =>
        button.addEventListener('click', () => this.open(button.dataset.location)),
      );
    this.render(instance, definition);
    this.restore(instance);
    return instance;
  }
  restore(instance) {
    instance.element.hidden = false;
    instance.element.style.zIndex = ++this.manager.z;
    instance.task.setAttribute('aria-pressed', 'true');
    this.onWindowState();
  }
  render(instance, definition, remember = true) {
    if (remember && instance.current && instance.current !== definition)
      instance.history.push(instance.current);
    instance.current = definition;
    const { element } = instance;
    element.querySelector('.explorer-address strong').textContent = definition.address;
    element.querySelector('.explorer-description').textContent = definition.description;
    element.querySelector('.explorer-back').disabled = !instance.history.length;
    const content = element.querySelector('.explorer-items');
    content.replaceChildren();
    for (const item of definition.items) {
      const button = document.createElement('button');
      button.className = 'explorer-item';
      button.innerHTML = icon(item.icon);
      const label = document.createElement('strong');
      label.textContent = item.name;
      const detail = document.createElement('small');
      detail.textContent = item.detail;
      button.append(label, detail);
      const activate = () =>
        this.render(instance, {
          address: `${definition.address} / ${item.name}`,
          description: item.detail,
          items: [],
          text: item.text,
        });
      button.addEventListener('dblclick', activate);
      button.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          activate();
        }
      });
      content.append(button);
    }
    if (!definition.items.length) {
      const empty = document.createElement('p');
      empty.className = 'explorer-empty';
      empty.textContent =
        definition.text ??
        (instance.kind === 'bin'
          ? 'La corbeille est vide.'
          : 'Ce dossier ne contient aucun fichier.');
      content.append(empty);
    }
    element.querySelector('.explorer-status').textContent =
      `${definition.items.length} objet(s) · Windows XD`;
  }
}
