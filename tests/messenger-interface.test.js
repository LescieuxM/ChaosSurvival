import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DialogueSession } from '../src/story/dialogue.js';
import { ConversationThread } from '../src/story/conversation-thread.js';
import { Progression } from '../src/story/progression.js';
import { visibleContacts } from '../src/ui/contacts.js';
import { Messenger } from '../src/ui/messenger.js';
import {
  desktopApps,
  explorerLocation,
  explorerItem,
  DesktopApplications,
  fileViewer,
  localPicture,
} from '../src/ui/desktop-apps.js';
import { icon } from '../src/ui/icons.js';
import { ConversationWindow } from '../src/ui/conversation.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const intro = read('../src/dialogues/pixelgirl-intro.json');

test('text and picture viewers have independent windows and task controls without replacing the explorer', (t) => {
  const previous = globalThis.document;
  const create = () => ({
    children: [],
    handlers: {},
    dataset: {},
    style: {},
    attrs: {},
    isConnected: true,
    classList: { add() {} },
    append(...nodes) {
      this.children.push(...nodes);
    },
    insertBefore(node) {
      this.children.push(node);
    },
    replaceChildren() {
      this.children = [];
    },
    addEventListener(type, callback) {
      this.handlers[type] = callback;
    },
    setAttribute(key, value) {
      this.attrs[key] = value;
    },
    remove() {
      this.isConnected = false;
    },
    querySelector(key) {
      this.fields ??= new Map();
      if (!this.fields.has(key)) this.fields.set(key, create());
      return this.fields.get(key);
    },
    querySelectorAll() {
      return [];
    },
  });
  globalThis.document = { createElement: create };
  t.after(() => {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  });
  const manager = {
    z: 10,
    windows: new Map(),
    calls: [],
    spawn(type, options) {
      const id = this.calls.length + 1;
      this.calls.push({ type, ...options });
      this.windows.set(id, { element: create(), onDismiss: options.onDismiss });
      return id;
    },
    close(id) {
      const entry = this.windows.get(id);
      entry.element.remove();
      this.windows.delete(id);
      entry.onDismiss();
    },
  };
  const app = new DesktopApplications(manager, create());
  const explorer = app.open('folder');
  const location = explorer.current;
  const txt = location.items.find((item) => item.name.endsWith('.txt'));
  const notepad = app.openFile(location, txt);
  assert.equal(explorer.current, location);
  assert.equal(explorer.element.isConnected, true);
  assert.equal(notepad.element.querySelector('.notepad-content').value, txt.text);
  assert.match(manager.calls[1].content.body, /readonly/);
  assert.ok(notepad.element.querySelector('.window-title > span').textContent.includes(txt.name));
  assert.equal(app.openFile(location, txt), notepad);
  const images = explorerLocation('images');
  const picture = app.openFile(images, images.items[0]);
  assert.equal(picture.element.querySelector('.picture-content').src, images.items[0].image);
  assert.equal(manager.windows.size, 3);
  notepad.element.querySelector('.titlebar').children[0].handlers.click();
  assert.equal(notepad.element.hidden, true);
  const previousZ = manager.z;
  notepad.task.handlers.click();
  assert.equal(notepad.element.hidden, false);
  assert.ok(manager.z > previousZ);
  const sameNameElsewhere = app.openFile(explorerLocation('downloads'), txt);
  assert.notEqual(sameNameElsewhere, notepad);
  manager.close(notepad.id);
  assert.equal(notepad.task.isConnected, false);
  assert.equal(explorer.element.isConnected, true);
  assert.equal(picture.element.isConnected, true);
  const unsafe = app.openFile(images, {
    name: 'private.jpg',
    image: 'file:///C:/Users/private.jpg',
  });
  assert.equal(unsafe.element.querySelector('.picture-content').src, undefined);
  assert.equal(unsafe.element.querySelector('.picture-content').hidden, true);
  assert.equal(unsafe.element.querySelector('.picture-error').hidden, false);
  assert.ok(manager.calls.every((call) => call.type === 'desktopapp' && call.preview));
});

test('every JPG has a bundled illustration and viewers reject host paths and remote images', () => {
  const filesystem = read('../src/config/filesystem.json');
  for (const location of Object.values(filesystem))
    for (const item of location.items) {
      if (!/\.jpg$/i.test(item.name)) continue;
      assert.equal(fileViewer(item), 'image');
      assert.equal(localPicture(item.image), true);
      assert.ok(readFileSync(new URL(`../public/${item.image.slice(2)}`, import.meta.url)).length);
    }
  assert.equal(fileViewer({ name: 'notes.txt' }), 'notepad');
  assert.equal(fileViewer({ name: 'folder.txt', location: 'images' }), null);
  assert.equal(fileViewer({ name: 'toolbar.exe' }), null);
  for (const unsafe of [
    'file:///C:/Users/private.jpg',
    'https://example.com/image.jpg',
    '../secret.svg',
    './covers/../../secret.svg',
  ])
    assert.equal(localPicture(unsafe), false);
});

test('explorer double-click, back, up and home preserve path and content', (t) => {
  const previous = globalThis.document;
  const element = () => ({
    children: [],
    handlers: {},
    append(...nodes) {
      this.children.push(...nodes);
    },
    replaceChildren() {
      this.children = [];
    },
    addEventListener(name, callback) {
      this.handlers[name] = callback;
    },
  });
  globalThis.document = { createElement: element };
  t.after(() => {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  });
  const fields = new Map();
  const instance = {
    kind: 'computer',
    history: [],
    element: {
      querySelector(selector) {
        if (!fields.has(selector)) fields.set(selector, element());
        return fields.get(selector);
      },
    },
  };
  const app = new DesktopApplications(null, null);
  app.home(instance);
  fields.get('.explorer-items').children[0].handlers.dblclick();
  assert.equal(instance.current.address, 'C:\\');
  assert.equal(fields.get('.explorer-items').children.length, 5);
  fields.get('.explorer-items').children[0].handlers.dblclick();
  assert.equal(instance.current.address, 'C:\\Program Files');
  app.back(instance);
  assert.equal(instance.current.address, 'C:\\');
  app.up(instance);
  assert.equal(instance.current.id, 'computer');
  assert.equal(fields.get('.explorer-up').disabled, true);
  fields.get('.explorer-items').children[2].handlers.dblclick();
  assert.equal(instance.current.address, 'E:\\');
  app.home(instance);
  assert.equal(instance.current.id, 'computer');
  assert.equal(fields.get('.explorer-address strong').textContent, 'Poste de travail');
});

test('disks contain navigable folders, valid parents, safe previews and an empty CD', () => {
  const computer = explorerLocation('computer');
  assert.equal(computer.items.length, 3);
  const disk = explorerItem(computer, computer.items[0]);
  assert.equal(disk.address, 'C:\\');
  assert.deepEqual(
    disk.items.map((item) => item.name),
    ['Program Files', 'WINDOWS', 'Documents and Settings', 'Games', 'Downloads'],
  );
  const seen = new Set();
  function explore(location) {
    if (seen.has(location.id)) return;
    seen.add(location.id);
    if (location.parent) assert.ok(explorerLocation(location.parent));
    for (const item of location.items) {
      const target = explorerItem(location, item);
      if (item.icon === 'folder') assert.ok(item.location);
      if (item.location) explore(target);
      else {
        assert.equal(target.parent, location.id);
        assert.ok(target.text || target.image);
      }
    }
  }
  explore(computer);
  assert.ok(seen.size > 15);
  const cd = explorerItem(computer, computer.items[1]);
  assert.equal(cd.items.length, 0);
  assert.match(cd.emptyText, /Insérez un disque/);
  assert.ok(explorerItem(computer, computer.items[2]).items.length > 0);
  assert.throws(() => explorerLocation('C:\\Users\\real-user'));
  assert.throws(() => explorerLocation('__proto__'));
});

test('the menu CRT is original and distinct from the desktop computer', () => {
  assert.notEqual(icon('menu-computer'), icon('computer'));
  const svg = readFileSync(new URL('../public/icons/menu-computer.svg', import.meta.url), 'utf8');
  assert.match(svg, /crtGradient/);
  assert.doesNotMatch(svg, /<image|<script|href=/);
});

test('decorative contacts are offline and PixelGirl stays hidden until unlocked', () => {
  const locked = visibleContacts({ [intro.id]: intro }, []);
  assert.equal(locked.length, 3);
  assert.ok(
    locked.every(
      (contact) => contact.kind === 'decorative' && !contact.online && !contact.dialogue,
    ),
  );
  for (const contact of locked)
    assert.ok(
      readFileSync(new URL(`../public/${contact.avatar.slice(2)}`, import.meta.url)).length,
    );
  const unlocked = visibleContacts({ [intro.id]: intro }, [intro.id]);
  assert.equal(unlocked.length, 4);
  assert.equal(unlocked.at(-1).nickname, intro.contact.nickname);
  assert.equal(unlocked.at(-1).kind, 'narrative');
  assert.equal(unlocked.at(-1).online, true);
  const future = { ...intro, id: 'future-contact', contact: { ...intro.contact, name: 'Future' } };
  const roster = [{ id: 'future', kind: 'narrative', dialogue: future.id }];
  assert.deepEqual(visibleContacts({ [future.id]: future }, [], roster), []);
  assert.equal(visibleContacts({ [future.id]: future }, [future.id], roster)[0].id, 'future');
});

test('Messenger keeps one independent window per contact including future contacts', () => {
  const records = [];
  const view = (id) => ({
    thread: { state: { history: ['old message'] } },
    open() {
      records.push(`open:${id}`);
    },
    openOffline(contact) {
      records.push(`offline:${contact.id}`);
    },
  });
  const primary = view('pixelgirl');
  const roster = [
    { id: 'pixelgirl', kind: 'narrative' },
    { id: 'skater', kind: 'decorative' },
    { id: 'princess', kind: 'decorative' },
    { id: 'future', kind: 'narrative' },
  ];
  const created = [];
  const messenger = new Messenger({
    primary: () => primary,
    createConversation(contact) {
      created.push(contact.id);
      return view(contact.id);
    },
  });
  messenger.contacts = () => roster;
  assert.equal(messenger.openContact(roster[0]), primary);
  const skater = messenger.openContact(roster[1]);
  const princess = messenger.openContact(roster[2]);
  const future = messenger.openContact(roster[3]);
  assert.notEqual(skater, princess);
  assert.notEqual(future, primary);
  assert.equal(messenger.openContact(roster[1]), skater);
  assert.equal(messenger.openContact(roster[3]), future);
  assert.deepEqual(created, ['skater', 'princess', 'future']);
  assert.equal(messenger.openContact({ id: 'locked' }), undefined);
  assert.deepEqual(primary.thread.state.history, ['old message']);
  assert.deepEqual(records, [
    'open:pixelgirl',
    'offline:skater',
    'offline:princess',
    'open:future',
    'offline:skater',
    'open:future',
  ]);
});

test('queued choices survive a multi-node message sequence and only return after its last message', () => {
  const progression = new Progression(read('../src/config/story.json'));
  progression.begin();
  const first = new DialogueSession(intro, progression);
  while (first.nextMessage()) first.deliver();
  first.offerChoices();
  const before = structuredClone(progression.data.choiceOffers);
  const event = {
    ...intro,
    id: 'test-incoming',
    start: 'first',
    nodes: {
      first: {
        messages: [{ speaker: 'contact', text: 'un message', delayMs: 500, typingMs: 500 }],
        next: 'join',
      },
      join: { messages: [], next: 'last' },
      last: {
        messages: [{ speaker: 'contact', text: 'le dernier', delayMs: 1000, typingMs: 500 }],
        choices: [{ id: 'test-reply', text: 'ok', next: 'end' }],
      },
      end: { messages: [], end: true },
    },
  };
  const second = new DialogueSession(event, progression);
  const thread = new ConversationThread('pixelgirl', progression, () => [intro, event]);
  assert.equal(thread.pendingResponses.length, 1);
  assert.deepEqual(thread.availableResponses, []);
  second.deliver();
  assert.deepEqual(thread.availableResponses, []); // No flicker at an automatic join.
  second.advance();
  second.advance();
  assert.deepEqual(thread.availableResponses, []);
  second.deliver();
  assert.equal(thread.availableResponses.length, 2);
  assert.deepEqual(progression.data.choiceOffers, before);
  assert.equal(first.choices.length, 3);
});

test('desktop applications contain credible data and the trash starts genuinely empty', () => {
  assert.equal(desktopApps.bin.items.length, 0);
  assert.ok(desktopApps.computer.items.some((item) => item.name.includes('(C:)')));
  assert.ok(desktopApps.folder.items.some((item) => item.text));
  for (const kind of ['computer', 'folder', 'bin']) {
    const resource = icon(kind).match(/src="([^"]+)"/)[1];
    const svg = readFileSync(new URL(`../public/${resource.slice(2)}`, import.meta.url), 'utf8');
    assert.doesNotMatch(svg, /<image|<script|href=/);
  }
});

test('response rendering keeps all buttons below the transcript and queues narrative questions', (t) => {
  // Minimal DOM objects exercise the real renderer without launching the game.
  const createElement = (tag) => ({
    tag,
    children: [],
    dataset: {},
    handlers: {},
    disabled: false,
    isConnected: true,
    classList: { add() {}, remove() {} },
    append(...nodes) {
      this.children.push(...nodes);
    },
    replaceChildren(...nodes) {
      this.children.forEach((node) => {
        node.isConnected = false;
      });
      this.children = [];
      this.append(...nodes);
    },
    addEventListener(event, handler) {
      this.handlers[event] = handler;
    },
    querySelectorAll(selector) {
      return this.children.flatMap((node) => [
        ...(node.tag === selector ? [node] : []),
        ...(node.querySelectorAll?.(selector) ?? []),
      ]);
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0];
    },
    focus() {},
  });
  const previous = globalThis.document;
  globalThis.document = { createElement, createTextNode: (text) => ({ textContent: text }) };
  t.after(() => {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  });
  const progression = new Progression(read('../src/config/story.json'));
  progression.begin();
  const definition = (id) => ({
    ...intro,
    id,
    start: 'question',
    nodes: {
      question: {
        messages: [{ speaker: 'contact', text: `question ${id}`, delayMs: 0, typingMs: 0 }],
        choices: [{ id: `answer-${id}`, text: `réponse ${id}`, next: 'end' }],
      },
      end: { messages: [], end: true },
    },
  });
  const events = [definition('one'), definition('two')];
  const sessions = new Map(
    events.map((event) => [event.id, new DialogueSession(event, progression)]),
  );
  sessions.get('one').deliver();
  const thread = new ConversationThread('pixelgirl', progression, () => events);
  const view = {
    choices: createElement('div'),
    log: createElement('div'),
    element: createElement('article'),
    thread,
    progression,
    sounds: { play() {} },
    sessionFor: (event) => sessions.get(event.id),
    renderResponses: ConversationWindow.prototype.renderResponses,
    appendHistory() {
      this.log.replaceChildren(
        ...thread
          .sync()
          .map((message) => ({ tag: 'p', textContent: message.text, speaker: message.speaker })),
      );
    },
    pump() {
      this.renderResponses();
    },
  };
  view.appendHistory();
  view.renderResponses();
  assert.equal(view.choices.querySelectorAll('button').length, 0); // Second sequence is still sending.
  sessions.get('two').deliver();
  thread.sync();
  view.appendHistory();
  view.renderResponses();
  assert.equal(thread.availableResponses.length, 2);
  assert.equal(view.choices.querySelectorAll('button').length, 1);
  assert.equal(view.choices.querySelector('button').dataset.choiceId, 'answer-one');
  assert.equal(view.log.querySelectorAll('button').length, 0);
  view.choices.querySelector('button').handlers.click();
  assert.equal(view.log.children.filter((message) => message.speaker === 'player').length, 1);
  assert.ok(view.log.children.some((message) => message.textContent === 'réponse one'));
  assert.equal(view.log.querySelectorAll('button').length, 0);
  assert.equal(view.choices.querySelector('button').dataset.choiceId, 'answer-two');
});

test('offline contacts reuse the conversation window, remain empty and preserve narrative history', (t) => {
  const previous = {
    document: globalThis.document,
    ResizeObserver: globalThis.ResizeObserver,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  const element = () => ({
    children: [],
    style: {},
    dataset: {},
    handlers: {},
    attrs: {},
    isConnected: true,
    classList: { add() {}, remove() {}, toggle() {} },
    querySelector(selector) {
      this.nodes ??= new Map();
      if (!this.nodes.has(selector)) this.nodes.set(selector, element());
      return this.nodes.get(selector);
    },
    querySelectorAll(selector) {
      return [this.querySelector(selector)];
    },
    append(...items) {
      this.children.push(...items);
    },
    insertBefore() {},
    addEventListener(type, handler) {
      this.handlers[type] = handler;
    },
    setAttribute(key, value) {
      this.attrs[key] = value;
    },
    replaceChildren() {
      this.children = [];
    },
    focus() {},
    remove() {
      this.isConnected = false;
    },
  });
  Object.assign(globalThis, {
    document: {
      baseURI: 'http://game.local/',
      createElement: element,
      addEventListener() {},
      removeEventListener() {},
    },
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    requestAnimationFrame() {
      return 1;
    },
    cancelAnimationFrame() {},
  });
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });
  const progression = new Progression(read('../src/config/story.json'));
  let completions = 0,
    spawns = 0;
  const manager = {
    windows: new Map(),
    z: 10,
    spawn(type, options) {
      const node = element();
      node.dataset.windowId = ++spawns;
      this.windows.set(spawns, { element: node, options });
      return spawns;
    },
    close(id) {
      const entry = this.windows.get(id);
      entry.element.remove();
      this.windows.delete(id);
      entry.options.onDismiss({ reason: 'close' });
    },
  };
  const view = new ConversationWindow(
    manager,
    intro,
    progression,
    { unlock() {} },
    () => completions++,
    undefined,
    undefined,
    { isUnlocked: () => false },
  );
  const original = JSON.stringify(progression.data);
  const contact = read('../src/config/contacts.json')[0];
  view.openOffline(contact);
  assert.equal(view.element.querySelector('.contact-name').textContent, contact.nickname);
  assert.ok(view.element.querySelector('.contact-status').textContent.startsWith('Hors ligne'));
  assert.equal(view.log.children.length, 0);
  assert.equal(view.choices.children.length, 0);
  assert.equal(view.session, null);
  assert.match(view.typing.textContent, /indisponible/);
  view.openOffline(contact);
  assert.equal(manager.windows.size, 1);
  assert.equal(spawns, 1);
  view.element.hidden = true;
  view.restore();
  assert.equal(view.element.hidden, false);
  view.refresh();
  view.pump();
  assert.equal(JSON.stringify(progression.data), original);
  manager.close(Number(view.element.dataset.windowId));
  assert.equal(completions, 0);
  assert.equal(manager.windows.size, 0);
  assert.equal(JSON.stringify(progression.data), original);
});
