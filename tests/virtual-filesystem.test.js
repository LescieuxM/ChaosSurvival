import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Progression } from '../src/story/progression.js';
import { VirtualTextFiles } from '../src/story/text-files.js';
import { VirtualFilesystem, virtualFileId } from '../src/story/virtual-filesystem.js';
import { DesktopApplications } from '../src/ui/desktop-apps.js';
import { DesktopFiles } from '../src/ui/desktop-files.js';
const story = JSON.parse(readFileSync(new URL('../src/config/story.json', import.meta.url)));

function memory() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
  };
}

class FakeElement {
  constructor() {
    this.children = [];
    this.dataset = {};
    this.attrs = {};
    this.handlers = {};
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    this.classList = { add() {}, remove() {} };
    this.offsetWidth = 150;
    this.offsetHeight = 90;
  }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  setAttribute(key, value) { this.attrs[key] = value; }
  addEventListener(type, callback) { this.handlers[type] = callback; }
  removeEventListener(type) { delete this.handlers[type]; }
  focus() {}
  getBoundingClientRect() { return { left: 10, top: 20, width: 400, height: 300 }; }
  contains(target) { return this === target || this.children.some((child) => child.contains?.(target)); }
  closest() { return this; }
  querySelector(selector) {
    const match = (node) => {
      if (selector === 'p' && node.tagName === 'P') return node;
      if (selector === 'strong' && node.tagName === 'STRONG') return node;
      if (selector === 'dl' && node.tagName === 'DL') return node;
      const action = selector.match(/^\[data-explorer-action="(.+)"\]$/)?.[1];
      if (action && node.dataset.explorerAction === action) return node;
      const answer = selector.match(/^\[data-delete-answer="(.+)"\]$/)?.[1];
      if (answer && node.dataset.deleteAnswer === answer) return node;
      if (selector === 'button' && node.tagName === 'BUTTON') return node;
      for (const child of node.children) {
        const found = match(child);
        if (found) return found;
      }
      return null;
    };
    this.fields ??= new Map();
    if (!this.fields.has(selector)) this.fields.set(selector, match(this) ?? new FakeElement());
    return this.fields.get(selector);
  }
}

test('virtual files have stable path IDs, protect system files, delete permanently and keep the bin empty', () => {
  const disk = memory();
  const progression = new Progression(story, disk);
  const files = new VirtualFilesystem(progression);
  const before = readFileSync(new URL('../src/config/filesystem.json', import.meta.url));
  const deletable = virtualFileId('downloads', 'smileys_pack_2009.zip');
  const protectedFile = virtualFileId('system32', 'desktop.dll');

  assert.equal(files.canDelete(deletable), true);
  assert.equal(files.deleteFile(protectedFile).reason, 'protected');
  assert.equal(files.deleteFile(deletable).ok, true);
  assert.equal(files.exists(deletable), false);
  assert.ok(!files.getLocation('downloads').items.some((item) => item.fileId === deletable));
  assert.deepEqual(files.getLocation('bin').items, []);
  assert.deepEqual(files.getLocation('my-games').items, []);
  assert.throws(() => files.getLocation('games'), /inconnu/);
  assert.equal(files.addFile('games', {
    name: 'old-game.txt', icon: 'document', detail: 'Document texte',
  }).ok, false);
  assert.deepEqual(readFileSync(new URL('../src/config/filesystem.json', import.meta.url)), before);

  const restored = new VirtualFilesystem(new Progression(story, disk));
  assert.equal(restored.exists(deletable), false);
  assert.deepEqual(restored.getLocation('bin').items, []);
  assert.deepEqual(restored.getLocation('my-games').items, []);
  restored.progression.newGame();
  assert.equal(new VirtualFilesystem(restored.progression).exists(deletable), true);
  assert.deepEqual(new VirtualFilesystem(restored.progression).getLocation('my-games').items, []);
});

test('XP personal folders are rooted in Mes documents without legacy Games or Downloads paths', () => {
  const files = new VirtualFilesystem(new Progression(story, memory()));
  const root = files.getLocation('c-root');
  assert.deepEqual(root.items.map((item) => item.location), ['programs', 'windows', 'profiles']);
  assert.throws(() => files.getLocation('games'), /inconnu/);

  const documents = files.getLocation('folder');
  for (const name of ['Mes images', 'Ma musique', 'Mes vidéos', 'Mes fichiers reçus', 'My Games', 'a_faire.txt'])
    assert.ok(documents.items.some((item) => item.name === name), name);
  assert.deepEqual(files.getLocation('my-games').items, []);
  assert.deepEqual(files.getLocation('videos').items, []);
  assert.equal(files.getLocation('downloads').parent, 'folder');
  assert.equal(
    files.getLocation('downloads').address,
    'C:\\Documents and Settings\\Joueur\\Mes documents\\Mes fichiers reçus',
  );
  assert.equal(files.getLocation('music').address.endsWith('\\Ma musique'), true);
});

test('all text and JPG files plus named exceptions are deletable except fond-ecran.jpg everywhere', () => {
  const disk = memory();
  const files = new VirtualFilesystem(new Progression(story, disk));
  const definitions = {
    ...JSON.parse(readFileSync(new URL('../src/config/filesystem.json', import.meta.url))),
    ...JSON.parse(readFileSync(new URL('../src/config/desktop-apps.json', import.meta.url))),
  };
  for (const [locationId, location] of Object.entries(definitions))
    for (const item of location.items ?? [])
      if (!item.location && /\.(txt|jpg)$/i.test(item.name) && !['fond-bureau.jpg', 'fond_bureau.jpg', 'fond-ecran.jpg'].includes(item.name.toLowerCase()))
        assert.equal(files.canDelete(virtualFileId(locationId, item.name)), true, `${locationId}/${item.name}`);

  assert.equal(files.canDelete(virtualFileId('fonts', 'PixelSans.ttf')), true);
  assert.equal(files.canDelete(virtualFileId('folder', 'a_faire.txt')), true);
  assert.equal(files.canDelete(virtualFileId('images', 'fond_bureau.jpg')), false);
  assert.equal(files.deleteFile(virtualFileId('images', 'fond_bureau.jpg')).reason, 'protected');
  const requestedZip = files.addFile('downloads', {
    name: 'smiley_pack_2009.zip', icon: 'document', detail: 'Archive ZIP',
  });
  assert.equal(requestedZip.ok, true);
  assert.equal(files.canDelete(requestedZip.fileId), true);

  const protectedWallpaper = files.addFile('images', {
    name: 'fond-bureau.jpg', icon: 'document', detail: 'Image', deletable: true,
  });
  const protectedDownloadWallpaper = files.addFile('downloads', {
    name: 'fond-ecran.jpg', icon: 'document', detail: 'Image', deletable: true,
  });
  assert.equal(protectedWallpaper.ok, true);
  assert.equal(protectedDownloadWallpaper.ok, true);
  assert.equal(files.canDelete(protectedWallpaper.fileId), false);
  assert.equal(files.deleteFile(protectedWallpaper.fileId).reason, 'protected');
  files.state.deleted.push(protectedWallpaper.fileId, protectedDownloadWallpaper.fileId);
  disk.setItem('chaos-survival-story-v1', JSON.stringify(files.progression.data));
  const restored = new VirtualFilesystem(new Progression(story, disk));
  assert.equal(restored.exists(protectedWallpaper.fileId), true);
  assert.equal(restored.exists(protectedDownloadWallpaper.fileId), true);
  const unauthorized = files.addFile('downloads', {
    name: 'other.exe', icon: 'document', detail: 'Programme',
  });
  assert.equal(unauthorized.ok, true);
  assert.equal(files.canDelete(unauthorized.fileId), false);
});

test('legacy and malformed filesystem save data normalize without hiding unrelated files', () => {
  const disk = memory();
  const original = new Progression(story).data;
  delete original.virtualFilesystem;
  disk.setItem('chaos-survival-story-v1', JSON.stringify(original));
  const legacy = new VirtualFilesystem(new Progression(story, disk));
  assert.deepEqual(legacy.state, { deleted: [], added: {} });
  assert.deepEqual(legacy.getLocation('my-games').items, []);

  legacy.progression.data.virtualFilesystem = {
    deleted: ['downloads/unknown.txt', 'system32/desktop.dll', null],
    added: {
      'downloads/../outside.txt': { name: 'outside.txt', detail: 'Texte', icon: 'document' },
      'not-a-folder/new.txt': { name: 'new.txt', detail: 'Texte', icon: 'document' },
      'games/old-game.txt': { name: 'old-game.txt', detail: 'Texte', icon: 'document' },
      'system32/desktop.dll': { name: 'desktop.dll', detail: 'Application', icon: 'document', deletable: true },
    },
  };
  const normalized = new VirtualFilesystem(legacy.progression);
  assert.deepEqual(normalized.state, { deleted: [], added: {} });
  assert.ok(normalized.exists(virtualFileId('system32', 'desktop.dll')));
});

test('old folder paths migrate idempotently and retain file deletions, received files and text edits', () => {
  const disk = memory();
  const source = new Progression(story);
  const received = source.receiveFile({
    id: 'test-received', name: 'received.txt', description: 'Document reçu',
  }, 'legacy', 'receive');
  source.finishTransfer(received.key);
  source.data.virtualFilesystem = {
    deleted: ['user-desktop/a_faire.txt', 'downloads/installation_a_lire.txt', 'games/old.exe'],
    added: {
      'games/old-save.txt': { name: 'old-save.txt', icon: 'document', detail: 'Document texte' },
    },
  };
  source.data.textFiles = {
    'user-desktop\\a_faire.txt': { text: 'modification conservée', original: 'texte initial' },
  };
  source.data.desktopIcons = { 'file:test-received': { col: 2, row: 3, anchor: 'right' } };
  disk.setItem('chaos-survival-story-v1', JSON.stringify(source.data));

  const restoredProgression = new Progression(story, disk);
  const filesystem = new VirtualFilesystem(restoredProgression);
  assert.ok(filesystem.state.deleted.includes('folder/a_faire.txt'));
  assert.ok(filesystem.state.deleted.includes('downloads/installation_a_lire.txt'));
  assert.ok(!filesystem.state.deleted.some((fileId) => fileId.startsWith('games/')));
  assert.equal(restoredProgression.data.textFiles['user-desktop\\a_faire.txt'], undefined);
  assert.equal(restoredProgression.data.textFiles['folder/a_faire.txt'].text, 'modification conservée');
  assert.deepEqual(restoredProgression.data.desktopIcons['file:downloads/received.txt'], {
    col: 2, row: 3, anchor: 'right',
  });
  assert.equal(restoredProgression.data.desktopIcons['file:test-received'], undefined);
  assert.equal(filesystem.exists('folder/a_faire.txt'), false);
  assert.equal(filesystem.exists('downloads/installation_a_lire.txt'), false);
  const receivedId = virtualFileId('downloads', 'received.txt');
  assert.ok(filesystem.exists(receivedId));
  assert.ok(filesystem.getLocation('downloads').items.some((item) => item.fileId === receivedId));
  assert.equal(filesystem.deleteFile(receivedId).ok, true);

  const reloaded = new VirtualFilesystem(new Progression(story, disk));
  assert.equal(reloaded.exists(receivedId), false);
  assert.ok(!reloaded.getLocation('downloads').items.some((item) => item.fileId === receivedId));
  assert.deepEqual(reloaded.getLocation('my-games').items, []);
});

test('dynamic files persist with distinct folder identities, expose virtual properties and can be deleted', () => {
  const disk = memory();
  const progression = new Progression(story, disk);
  const files = new VirtualFilesystem(progression);
  const file = { name: 'BombArena.zip', icon: 'document', detail: 'Archive ZIP', size: 247000, deletable: true };
  assert.equal(files.addFile('bin', file).ok, false, 'the recycle bin cannot retain files');
  const download = files.addFile('downloads', file);
  const music = files.addFile('music', file);
  assert.equal(download.ok, true);
  assert.equal(music.ok, true);
  assert.notEqual(download.fileId, music.fileId);
  assert.ok(files.getLocation('downloads').items.some((item) => item.fileId === download.fileId));
  assert.deepEqual(files.metadata(download.fileId), {
    name: 'BombArena.zip',
    type: 'Archive ZIP',
    location: 'C:\\Documents and Settings\\Joueur\\Mes documents\\Mes fichiers reçus',
    size: 247000,
    path: 'C:\\Documents and Settings\\Joueur\\Mes documents\\Mes fichiers reçus\\BombArena.zip',
  });

  const restored = new VirtualFilesystem(new Progression(story, disk));
  assert.ok(restored.exists(download.fileId));
  assert.equal(restored.deleteFile(download.fileId).ok, true);
  assert.equal(new VirtualFilesystem(new Progression(story, disk)).exists(download.fileId), false);
  assert.ok(new VirtualFilesystem(new Progression(story, disk)).exists(music.fileId));
});

test('deleting an edited text file closes its overlay to reads and rejects a stale editor save', () => {
  const disk = memory();
  const progression = new Progression(story, disk);
  const filesystem = new VirtualFilesystem(progression);
  const textFiles = new VirtualTextFiles(progression, filesystem);
  const item = filesystem.getLocation('folder').items.find((entry) => entry.name.endsWith('.txt'));
  const fileId = item.fileId;
  textFiles.save(fileId, 'texte modifié', item.text);
  assert.equal(textFiles.read(fileId, item.text).text, 'texte modifié');
  assert.equal(filesystem.deleteFile(fileId).ok, true);
  assert.equal(progression.data.textFiles[fileId], undefined);
  assert.equal(textFiles.read(fileId, item.text).text, item.text);
  assert.throws(() => textFiles.save(fileId, 'texte périmé', item.text), /supprimé/);
});

test('filesystem changes roll back when the main save cannot be written', () => {
  const disk = memory();
  const progression = new Progression(story, disk);
  const files = new VirtualFilesystem(progression);
  const fileId = virtualFileId('downloads', 'installation_a_lire.txt');
  disk.setItem = () => { throw new Error('quota'); };
  assert.equal(files.deleteFile(fileId).reason, 'save');
  assert.equal(files.exists(fileId), true);
  assert.deepEqual(files.state.deleted, []);
  assert.equal(files.addFile('downloads', {
    name: 'new.txt', icon: 'document', detail: 'Document texte', deletable: true,
  }).reason, 'save');
  assert.equal(files.exists(virtualFileId('downloads', 'new.txt')), false);
});

test('explorer selects files, provides XP properties and confirmation, and refreshes each open view', (t) => {
  const oldDocument = globalThis.document;
  const listeners = new Set();
  globalThis.document = {
    createElement: (tag) => Object.assign(new FakeElement(), { tagName: tag.toUpperCase() }),
    addEventListener(_type, callback) { listeners.add(callback); },
    removeEventListener(_type, callback) { listeners.delete(callback); },
  };
  t.after(() => {
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
  });
  const progression = new Progression(story, memory());
  const transfer = progression.receiveFile({
    id: 'super-mega-game',
    name: 'SUPER_MEGA_GAME.exe',
    description: 'SMILEY CATCHER 2009',
    launch: { game: 'smiley-catcher' },
  }, 'pixelgirl', 'offer');
  progression.finishTransfer(transfer.key);
  const filesystem = new VirtualFilesystem(progression);
  const desktop = new FakeElement();
  let desktopItems = null;
  desktop.querySelector = (selector) => selector === '#desktop-files' ? desktopItems : null;
  desktop.append = (...items) => {
    desktop.children.push(...items);
    desktopItems = items[0];
  };
  const openedDesktopFiles = [];
  const recordDesktopOpen = (file) => {
    openedDesktopFiles.push(file);
    return file;
  };
  const desktopFiles = new DesktopFiles(
    desktop, progression, recordDesktopOpen, () => {}, filesystem,
  );
  desktopFiles.render();
  const desktopButton = desktopItems.children[0];
  assert.equal(desktopButton.dataset.fileId, virtualFileId('downloads', 'SUPER_MEGA_GAME.exe'));
  const app = new DesktopApplications({ windows: new Map(), close() {} }, null, () => {}, null,
    new VirtualTextFiles(progression, filesystem), filesystem,
    () => desktopFiles.render(), recordDesktopOpen);
  const makeExplorer = () => {
    const body = new FakeElement();
    const fields = new Map();
    const element = new FakeElement();
    element.querySelector = (selector) => {
      if (selector === '.window-body') return body;
      if (!fields.has(selector)) fields.set(selector, new FakeElement());
      return fields.get(selector);
    };
    const instance = { id: 1, kind: 'downloads', element, history: [] };
    app.setupExplorer(instance);
    app.render(instance, filesystem.getLocation('downloads'));
    return instance;
  };
  const first = makeExplorer();
  const second = makeExplorer();
  app.instances.set('downloads:first', first);
  app.instances.set('downloads:second', second);
  const fileId = virtualFileId('downloads', 'smileys_pack_2009.zip');
  const row = first.element.querySelector('.explorer-items').children.find(
    (item) => item.dataset.fileId === fileId,
  );
  row.handlers.click();
  assert.equal(row.attrs['aria-selected'], 'true');
  row.handlers.contextmenu({
    clientX: 45,
    clientY: 60,
    preventDefault() {},
  });
  const menu = first.explorerMenu;
  const propertyAction = menu.children.find((item) => item.dataset.explorerAction === 'properties');
  menu.handlers.click({ target: propertyAction, stopPropagation() {} });
  assert.equal(first.explorerProperties.hidden, false);
  assert.equal(first.explorerProperties.querySelector('strong').textContent, 'smileys_pack_2009.zip');
  first.explorerProperties.querySelector('button').handlers.click();
  row.handlers.contextmenu({ clientX: 45, clientY: 60, preventDefault() {} });
  const deleteAction = menu.children.find((item) => item.dataset.explorerAction === 'delete');
  assert.equal(deleteAction.disabled, false);
  menu.handlers.click({ target: deleteAction, stopPropagation() {} });
  assert.match(first.explorerConfirmation.querySelector('p').textContent, /smileys_pack_2009\.zip/);
  first.explorerConfirmation.querySelector('[data-delete-answer="yes"]').handlers.click();
  assert.equal(filesystem.exists(fileId), false);
  for (const instance of [first, second])
    assert.ok(!instance.element.querySelector('.explorer-items').children.some((item) => item.dataset.fileId === fileId));
  const receivedId = virtualFileId('downloads', 'SUPER_MEGA_GAME.exe');
  const receivedItem = filesystem.getLocation('downloads').items.find((item) => item.fileId === receivedId);
  assert.ok(receivedItem?.receivedFile);
  assert.equal(app.openFile(filesystem.getLocation('downloads'), receivedItem), receivedItem);
  assert.equal(openedDesktopFiles.length, 1);
  const receivedRow = first.element.querySelector('.explorer-items').children.find(
    (item) => item.dataset.fileId === receivedId,
  );
  receivedRow.handlers.contextmenu({ clientX: 45, clientY: 60, preventDefault() {} });
  const receivedDelete = first.explorerMenu.children.find((item) => item.dataset.explorerAction === 'delete');
  assert.equal(receivedDelete.disabled, false);
  first.explorerMenu.handlers.click({ target: receivedDelete, stopPropagation() {} });
  first.explorerConfirmation.querySelector('[data-delete-answer="yes"]').handlers.click();
  assert.equal(filesystem.exists(receivedId), false);
  assert.equal(desktopItems.children.length, 0, 'Explorer deletion refreshes the desktop from the same transfer state');
  desktopButton.handlers.dblclick();
  assert.equal(openedDesktopFiles.length, 1, 'a stale desktop icon cannot reopen a deleted transfer');
  const protectedFile = filesystem.getLocation('windows').items.find((item) => item.name === 'win.ini');
  const systemExplorer = makeExplorer();
  app.render(systemExplorer, filesystem.getLocation('windows'));
  const protectedRow = systemExplorer.element.querySelector('.explorer-items').children.find(
    (item) => item.dataset.fileId === protectedFile.fileId,
  );
  protectedRow.handlers.contextmenu({ clientX: 40, clientY: 50, preventDefault() {} });
  assert.equal(
    systemExplorer.explorerMenu.children.find((item) => item.dataset.explorerAction === 'delete').disabled,
    true,
  );
  for (const instance of [first, second, systemExplorer]) app.teardownExplorer(instance);
  assert.equal(listeners.size, 0);
});
