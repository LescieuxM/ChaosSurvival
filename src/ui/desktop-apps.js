import definitions from '../config/desktop-apps.json' with { type: 'json' };
import filesystem from '../config/filesystem.json' with { type: 'json' };
import { bindFileActivation } from '../utils/activation.js';
import { icon } from './icons.js';
import { isArcadeExecutable } from './arcade-launcher.js';
import { VirtualTextFiles } from '../story/text-files.js';
import { attachNotepad } from './notepad.js';

export const desktopApps = definitions;

// Locations are JSON keys, never host paths. No disk or network API is used.
export function explorerLocation(id) {
  const entry = Object.hasOwn(definitions, id)
    ? definitions[id]
    : Object.hasOwn(filesystem, id)
      ? filesystem[id]
      : null;
  if (!entry) throw new Error('Emplacement fictif inconnu.');
  return { ...entry, id };
}
export function explorerItem(location, item) {
  if (item.location) return explorerLocation(item.location);
  return {
    id: `${location.id}/${item.name}`,
    parent: location.id,
    address: `${location.address.replace(/\\$/, '')}\\${item.name}`,
    description: item.detail,
    items: [],
    image: item.image,
    text:
      item.text ??
      (item.image
        ? undefined
        : 'Windows XD ne peut pas ouvrir ce fichier. Aucune application associée.'),
  };
}

export function fileViewer(item) {
  if (item.location) return null;
  if (/\.txt$/i.test(item.name)) return 'notepad';
  if (/\.jpg$/i.test(item.name)) return 'image';
  return 'generic';
}
export function localPicture(path) {
  return typeof path === 'string' && /^\.\/(?:wallpaper\.svg|covers\/[a-z0-9-]+\.svg)$/.test(path);
}

export class DesktopApplications {
  constructor(
    manager,
    taskbar,
    onWindowState = () => {},
    onLaunchArcade = null,
    textFiles = new VirtualTextFiles({ data: {}, save: () => true }),
  ) {
    Object.assign(this, { manager, taskbar, onWindowState, onLaunchArcade });
    this.textFiles = textFiles;
    this.instances = new Map();
  }
  open(kind) {
    if (!Object.hasOwn(definitions, kind)) return;
    const definition = explorerLocation(kind);
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
        <div class="explorer-toolbar"><button class="xp-button explorer-back" disabled>◀ Précédente</button><button class="xp-button explorer-up" disabled>↑ Remonter</button><button class="xp-button explorer-home">${icon('computer')} Poste de travail</button></div>
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
    const instance = this.attachWindow(kind, id, definition.title, definition.icon);
    const { element } = instance;
    element.querySelector('.explorer-home').addEventListener('click', () => this.home(instance));
    element.querySelector('.explorer-up').addEventListener('click', () => this.up(instance));
    element.querySelector('.explorer-back').addEventListener('click', () => this.back(instance));
    element
      .querySelectorAll('[data-location]')
      .forEach((button) =>
        button.addEventListener('click', () =>
          this.render(instance, explorerLocation(button.dataset.location)),
        ),
      );
    this.render(instance, definition);
    this.restore(instance);
    return instance;
  }
  attachWindow(kind, id, title, iconName) {
    const element = this.manager.windows.get(id).element;
    const task = document.createElement('button');
    task.className = 'task-tab desktop-app-task';
    task.dataset.app = kind;
    task.dataset.windowId = String(id);
    task.innerHTML = icon(iconName);
    const label = document.createElement('span');
    label.textContent = title;
    task.append(label);
    task.title = title;
    this.taskbar.insertBefore(task, this.taskbar.querySelector('.tray'));
    const instance = { id, kind, element, task, history: [] };
    this.instances.set(kind, instance);
    const minimize = document.createElement('button');
    minimize.className = 'msn-minimize';
    minimize.textContent = '−';
    minimize.setAttribute('aria-label', `Réduire ${title}`);
    minimize.addEventListener('click', () => {
      element.hidden = true;
      task.setAttribute('aria-pressed', 'false');
      instance.onMinimize?.();
      this.onWindowState();
    });
    element
      .querySelector('.titlebar')
      .insertBefore(minimize, element.querySelector('.close-button'));
    task.addEventListener('click', () => this.restore(instance));
    return instance;
  }
  openFile(location, item) {
    const viewer = fileViewer(item);
    if (!viewer) return;
    if (isArcadeExecutable(item) && this.onLaunchArcade) return this.onLaunchArcade();
    const key = `file:${location.id}/${item.name}`;
    const existing = this.instances.get(key);
    if (existing?.element.isConnected) {
      this.restore(existing);
      return existing;
    }
    const title =
      viewer === 'generic'
        ? item.name
        : `${item.name} — ${viewer === 'notepad' ? 'Bloc-notes' : 'Visionneuse d’images'}`;
    const iconName = viewer === 'image' ? 'picture' : 'document';
    const id = this.manager.spawn('desktopapp', {
      preview: true,
      content: {
        title: 'Document',
        iconName,
        body:
          viewer === 'generic'
            ? '<div class="generic-file-content"><pre></pre><p class="generic-file-unavailable" hidden>Windows ne peut pas ouvrir ce fichier. Aucun contenu ni visualiseur spécifique n’est défini pour ce fichier fictif.</p></div><div class="window-status">Windows XD · Lecture seule</div>'
            : viewer === 'notepad'
              ? '<div class="msn-menu notepad-menu"></div><textarea class="notepad-content" aria-label="Contenu du fichier texte" spellcheck="false"></textarea><div class="window-status" role="status"></div><section class="notepad-confirm" role="dialog" aria-label="Bloc-notes : enregistrer les modifications" aria-modal="true" hidden><strong>Bloc-notes Windows XD</strong><p></p><div><button class="xp-button" data-answer="yes">Oui</button><button class="xp-button" data-answer="no">Non</button><button class="xp-button" data-answer="cancel">Annuler</button></div></section>'
              : '<div class="explorer-menu file-menu">Fichier <span>Affichage</span><span>Image</span><span>Aide</span></div><div class="picture-stage"><img class="picture-content" alt="" /><p class="picture-error" hidden>Aperçu non disponible pour cette image.</p></div><div class="picture-toolbar">▧ Ajuster à la fenêtre</div><div class="window-status">Visionneuse d’images Windows XD</div>',
      },
      onDismiss: () => {
        instance.disposeEditor?.();
        this.instances.delete(key);
        instance.task.remove();
        this.onWindowState();
      },
    });
    const instance = this.attachWindow(key, id, title, iconName);
    const { element } = instance;
    element.classList.add(`file-${viewer}`);
    element.querySelector('.window-title > span').textContent = title;
    element.querySelector('.close-button').setAttribute('aria-label', `Fermer ${item.name}`);
    if (viewer === 'generic') {
      element.querySelector('.generic-file-content pre').textContent = item.text ?? '';
      element.querySelector('.generic-file-unavailable').hidden =
        item.text !== undefined && item.text !== null;
    } else if (viewer === 'notepad')
      instance.disposeEditor = attachNotepad(
        instance,
        this.manager,
        this.textFiles,
        `${location.id}/${item.name}`,
        item,
      );
    else {
      const image = element.querySelector('.picture-content');
      const unavailable = () => {
        image.hidden = true;
        element.querySelector('.picture-error').hidden = false;
      };
      image.alt = item.name;
      image.addEventListener('error', unavailable);
      if (localPicture(item.image)) image.src = item.image;
      else unavailable();
    }
    this.restore(instance);
    return instance;
  }
  restore(instance) {
    instance.element.hidden = false;
    instance.element.style.zIndex = ++this.manager.z;
    instance.task.setAttribute('aria-pressed', 'true');
    instance.onRestore?.();
    this.onWindowState();
  }
  home(instance) {
    this.render(instance, explorerLocation('computer'));
  }
  up(instance) {
    if (instance.current.parent) this.render(instance, explorerLocation(instance.current.parent));
  }
  back(instance) {
    const previous = instance.history.pop();
    if (previous) this.render(instance, previous, false);
  }
  render(instance, definition, remember = true) {
    if (remember && instance.current && instance.current.id !== definition.id)
      instance.history.push(instance.current);
    instance.current = definition;
    const { element } = instance;
    element.querySelector('.explorer-address strong').textContent = definition.address;
    element.querySelector('.explorer-description').textContent = definition.description;
    element.querySelector('.explorer-back').disabled = !instance.history.length;
    element.querySelector('.explorer-up').disabled = !definition.parent;
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
        item.location
          ? this.render(instance, explorerItem(definition, item))
          : this.openFile(definition, item);
      bindFileActivation(button, activate);
      content.append(button);
    }
    if (!definition.items.length) {
      if (localPicture(definition.image)) {
        const image = document.createElement('img');
        image.className = 'explorer-image';
        image.src = definition.image;
        image.alt = definition.description;
        content.append(image);
      }
      const empty = document.createElement('p');
      empty.className = 'explorer-empty';
      empty.textContent =
        definition.text ??
        definition.emptyText ??
        (definition.image ? 'Aperçu de l’image' : undefined) ??
        (instance.kind === 'bin'
          ? 'La corbeille est vide.'
          : 'Ce dossier ne contient aucun fichier.');
      content.append(empty);
    }
    element.querySelector('.explorer-status').textContent =
      `${definition.items.length} objet(s) · Windows XD`;
  }
}
