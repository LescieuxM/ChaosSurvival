import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ConversationThread } from '../src/story/conversation-thread.js';
import { DialogueSession } from '../src/story/dialogue.js';
import { Progression } from '../src/story/progression.js';
import { DialogueEvents } from '../src/story/dialogue-events.js';
import { ConversationWindow } from '../src/ui/conversation.js';
import { installDevelopmentConversationShortcut } from '../src/dev/finish-shortcut.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const story = read('../src/config/story.json');
const turbo = read('../src/dialogues/turbo-smiley-catcher.json');
const pixelgirlIntro = read('../src/dialogues/pixelgirl-intro.json');
const pixelgirlAfterSmiley = read('../src/dialogues/pixelgirl-smiley-victory.json');

function createView(dialogue = turbo) {
  const values = new Map();
  const progression = new Progression(story, {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
  progression.begin();
  const thread = new ConversationThread(dialogue.contact.id ?? 'turbo', progression, () => [
    dialogue,
  ]);
  const view = Object.assign(Object.create(ConversationWindow.prototype), {
    dialogue,
    progression,
    thread,
    sessions: new Map(),
    session: new DialogueSession(dialogue, progression),
    element: {
      isConnected: true,
      classList: { toggle() {}, remove() {} },
    },
    typing: { textContent: '' },
    typingIndicator: { textContent: '', hidden: false, classList: { remove() {} } },
    onChoiceValidated() {},
    onCheckpoint: () => {},
    onFilesChanged() {},
    appendHistory() {},
    renderResponses() {},
    scrollLatest() {},
  });
  return view;
}

test('development conversation shortcut runs one random branch through the saved dialogue engine', () => {
  const view = createView();
  const logs = [];
  assert.equal(
    view.finishImmediately(
      () => 0.5,
      (line) => logs.push(line),
    ),
    true,
  );
  const saved = view.progression.data.dialogues[turbo.id];
  assert.deepEqual(
    saved.transcript.map((message) => message.text),
    [
      'mdrrrr noob',
      turbo.nodes.opening.choices[1].text,
      'bah ouais je voyais ton jeu mdr',
      'pourquoi tu demandes ça ???',
    ],
  );
  assert.equal(saved.finished, true);
  assert.equal(view.progression.data.choices.at(-1).choice, 'screen');
  assert.equal(view.thread.state.history.length, 4);
  assert.equal(logs.filter((line) => line.startsWith('[DEV] Choix')).length, 1);
  assert.equal(logs.at(-1), '[DEV] Conversation terminée');

  assert.equal(
    view.finishImmediately(
      () => 0,
      (line) => logs.push(line),
    ),
    false,
  );
  assert.equal(saved.transcript.length, 4);
});

test('partially received messages are preserved and Ctrl+Shift+F ignores text fields', () => {
  const view = createView();
  view.session.deliver();
  view.thread.sync();
  const calls = [];
  let listener;
  const target = {
    addEventListener(type, handler) {
      listener = handler;
    },
    removeEventListener() {},
  };
  const remove = installDevelopmentConversationShortcut(target, () => ({
    finishImmediately: () => calls.push('finish'),
  }));
  const base = {
    ctrlKey: true,
    shiftKey: true,
    altKey: false,
    metaKey: false,
    repeat: false,
    key: 'f',
    preventDefault() {},
  };
  listener({ ...base, target: { closest: () => 'input' } });
  assert.deepEqual(calls, []);
  listener({ ...base, target: { closest: () => null } });
  assert.deepEqual(calls, ['finish']);
  remove();

  assert.equal(
    view.finishImmediately(
      () => 0,
      () => {},
    ),
    true,
  );
  assert.equal(view.progression.data.dialogues[turbo.id].transcript[0].text, 'mdrrrr noob');
  assert.equal(view.progression.data.dialogues[turbo.id].transcript.length, 3);
});

test('development conversation shortcut resolves successive choices and transfer steps without delays', () => {
  const view = createView(pixelgirlIntro);
  const checkpoints = [];
  view.onCheckpoint = (id) => checkpoints.push(id);
  const logs = [];
  assert.equal(
    view.finishImmediately(
      () => 0.99,
      (line) => logs.push(line),
    ),
    true,
  );
  assert.equal(view.progression.data.dialogues[pixelgirlIntro.id].finished, true);
  assert.ok(view.progression.data.choices.length > 1);
  assert.ok(Object.values(view.progression.data.files).some((file) => file.status === 'complete'));
  assert.deepEqual(checkpoints, [pixelgirlIntro.id]);
  assert.equal(logs.at(-1), '[DEV] Conversation terminée');
});

test('development fast-forward triggers Turb0 arrival when it validates PixelGirl first reply', () => {
  const view = createView(pixelgirlAfterSmiley);
  const arrivals = [];
  const effects = new DialogueEvents(
    view.progression,
    { [pixelgirlAfterSmiley.id]: pixelgirlAfterSmiley },
    (contactId) => arrivals.push(contactId),
    { deferredConnectionDialogues: [pixelgirlAfterSmiley.id] },
  );
  view.onChoiceValidated = (definition, { nodeId }) => {
    if (definition.id === pixelgirlAfterSmiley.id && nodeId === definition.start)
      effects.triggerConnection('turbo');
  };

  assert.equal(
    view.finishImmediately(
      () => 0.5,
      () => {},
    ),
    true,
  );
  assert.deepEqual(arrivals, ['turbo']);
  assert.equal(view.progression.data.contactConnections.turbo.status, 'online');
  assert.equal(
    view.progression.data.choices.filter((entry) => entry.dialogue === pixelgirlAfterSmiley.id)
      .length,
    10,
  );
});

test('development fast-forward finishes Turb0 scene and queues Luna connection once', () => {
  const view = createView(turbo);
  const connected = [];
  const events = new DialogueEvents(view.progression, { [turbo.id]: turbo }, (id) =>
    connected.push(id),
  );
  assert.equal(view.finishImmediately(() => 0.5, () => {}), true);
  assert.equal(view.progression.data.dialogues[turbo.id].finished, true);

  const finishedAt = 20_000;
  events.update(finishedAt);
  assert.deepEqual(view.progression.data.contactConnections.luna, {
    status: 'pending',
    dueAt: finishedAt + 3000,
  });
  events.update(finishedAt + 2999);
  assert.deepEqual(connected, []);
  events.update(finishedAt + 3000);
  events.update(finishedAt + 9000);
  assert.deepEqual(connected, ['luna']);
});
