import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DialogueSession } from '../src/story/dialogue.js';
import { ConversationThread } from '../src/story/conversation-thread.js';
import { Progression } from '../src/story/progression.js';
import { visibleContacts } from '../src/ui/contacts.js';
import { desktopApps } from '../src/ui/desktop-apps.js';
import { icon } from '../src/ui/icons.js';
import { ConversationWindow } from '../src/ui/conversation.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const intro = read('../src/dialogues/pixelgirl-intro.json');

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
