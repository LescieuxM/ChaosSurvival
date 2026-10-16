import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Progression } from '../src/story/progression.js';
import { DialogueEvents } from '../src/story/dialogue-events.js';
import { ConversationThread } from '../src/story/conversation-thread.js';
import { NarrativeOrchestrator } from '../src/story/narrative-orchestrator.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const story = read('../src/config/story.json');
const definitions = Object.fromEntries(
  readdirSync(new URL('../src/dialogues/', import.meta.url))
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const definition = read(`../src/dialogues/${file}`);
      return [definition.id, definition];
    }),
);

function fixture(values = new Map()) {
  const progression = new Progression(story, {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
  let now = 10_000;
  const contacts = {
    turbo: { id: 'turbo', available: true, online: true },
    luna: { id: 'luna', available: true, online: true },
  };
  const connectionNotifications = [];
  const turboMessages = [];
  const preparedContacts = [];
  const turboThread = new ConversationThread('turbo', progression, () => [
    definitions['turbo-smiley-catcher'],
    definitions['turbo-flashzone-invitation'],
  ]);
  let orchestrator;
  const events = new DialogueEvents(
    progression,
    definitions,
    (id) => orchestrator.onContactConnected(id),
    { deferredConnectionDialogues: ['pixelgirl-smiley-victory'] },
  );
  orchestrator = new NarrativeOrchestrator({
    progression,
    definitions,
    dialogueEvents: events,
    getContact: (id) => contacts[id],
    prepareContact: (contact) => {
      preparedContacts.push(contact?.id);
      return { thread: turboThread };
    },
    getTurboThread: () => turboThread,
    onTurboMessage: (contact, incoming) => turboMessages.push({ contact, incoming }),
    showConnectionNotification: (id, options) => connectionNotifications.push({ id, options }),
    now: () => now,
  });
  return {
    progression,
    orchestrator,
    turboThread,
    values,
    connectionNotifications,
    turboMessages,
    preparedContacts,
    get now() {
      return now;
    },
    set now(value) {
      now = value;
    },
  };
}

test('validating PixelGirl first reply saves Turb0 connection for exactly two seconds later', () => {
  const context = fixture();
  const { progression, orchestrator, connectionNotifications } = context;
  const definition = definitions['pixelgirl-smiley-victory'];
  orchestrator.onChoiceValidated(definition, { nodeId: definition.start });
  orchestrator.onChoiceValidated(definition, { nodeId: definition.start });

  assert.equal(progression.data.flags.turboSmileyScene3ArrivalTriggered, true);
  assert.deepEqual(progression.data.contactConnections.turbo, { status: 'pending', dueAt: 12_000 });
  assert.equal(connectionNotifications.length, 0);
  const restored = fixture(context.values);
  restored.now = 11_999;
  restored.orchestrator.update(restored.now);
  assert.equal(restored.progression.data.contactConnections.turbo.status, 'pending');
  assert.equal(restored.connectionNotifications.length, 0);
  restored.now = 12_000;
  restored.orchestrator.update(restored.now);
  assert.equal(restored.progression.data.contactConnections.turbo.status, 'online');
  assert.equal(restored.connectionNotifications.length, 1);
  assert.equal(restored.progression.data.dialogues['turbo-smiley-catcher'].receiveDueAt, 14_000);
  assert.deepEqual(restored.preparedContacts, [], 'connection alone does not create a conversation window');
  assert.equal(restored.turboThread.state.history.length, 0);
  restored.now = 13_999;
  restored.orchestrator.update(restored.now);
  assert.equal(restored.turboThread.state.history.length, 0);
  assert.equal(restored.turboMessages.length, 0);
  restored.now = 14_000;
  restored.orchestrator.update(restored.now);
  assert.equal(restored.turboThread.state.history.at(-1).text, 'mdrrrr noob');
  assert.equal(restored.turboMessages.length, 1);
  restored.orchestrator.update(20_000);
  assert.equal(restored.turboMessages.length, 1);
  assert.equal(restored.connectionNotifications.length, 1);
});

test('Turb0 message notification is tied to receiving a new message, not a saved timer', () => {
  const context = fixture();
  const { progression, orchestrator } = context;
  progression.data.flags.turboSmileyScene3ArrivalTriggered = true;
  progression.data.contactConnections = { turbo: { status: 'online' } };
  orchestrator.onContactConnected('turbo');
  const received = definitions['turbo-smiley-catcher'];
  assert.equal(orchestrator.onMessage({ id: 'turbo' }), 'handled');
  assert.equal(orchestrator.onMessage({ id: 'turbo' }, [received]), 'turbo-smiley-scene3');
  assert.equal(progression.data.flags.turboSmileyScene3Notified, true);
  assert.equal(orchestrator.onMessage({ id: 'turbo' }, [received]), 'handled');

  progression.data.flags.turboSmileyScene3Notified = false;
  progression.data.flags.turboSmileyScene3MessageNotificationDueAt = 20_000;
  progression.data.dialogues['turbo-smiley-catcher'] = {
    node: 'opening',
    cursor: 1,
    finished: false,
    transcript: [{ speaker: 'contact', text: 'mdrrrr noob' }],
  };
  progression.save();
  const restored = fixture(context.values);
  assert.equal(restored.progression.data.flags.turboSmileyScene3MessageNotificationDueAt, undefined);
  restored.orchestrator.update(30_000);
});

test('invitation message is scheduled exactly three seconds after Luna connects and only once', () => {
  const context = fixture();
  const { progression, orchestrator, now } = context;
  progression.data.contactConnections = { luna: { status: 'online' } };
  progression.data.dialogues['turbo-smiley-catcher'] = {
    node: 'noob-reply',
    cursor: 1,
    finished: true,
    transcript: [{ speaker: 'contact', text: 'MDRRR' }],
  };
  orchestrator.onContactConnected('luna');
  assert.equal(progression.data.flags.superPlombierInvitationDueAt, now + 3000);
  const definition = definitions['turbo-flashzone-invitation'];
  assert.equal(orchestrator.isEventAvailable(definition), false);

  const restored = fixture(context.values);
  restored.now = now + 2999;
  restored.orchestrator.update(restored.now);
  assert.equal(restored.progression.data.dialogues['turbo-flashzone-invitation'], undefined);
  assert.equal(restored.orchestrator.isEventAvailable(definition), false);
  restored.now = now + 3000;
  restored.orchestrator.update(restored.now);
  assert.equal(
    restored.progression.data.dialogues['turbo-flashzone-invitation']?.receiveDueAt,
    now + 3000,
  );
  assert.equal(restored.progression.data.flags.superPlombierInvitationScheduled, true);
  assert.equal(restored.orchestrator.isEventAvailable(definition), true);
  assert.deepEqual(restored.turboThread.receive(now + 2999), []);
  assert.deepEqual(restored.turboThread.receive(now + 3000), [definition]);
  assert.equal(restored.turboThread.state.history.at(-1).text, definition.nodes.invitation.messages[0].text);
  assert.deepEqual(restored.turboThread.receive(now + 3000), []);
  assert.equal(
    restored.turboThread.state.history.filter(
      (entry) => entry.eventId === definition.id && entry.text === definition.nodes.invitation.messages[0].text,
    ).length,
    1,
  );
  restored.now = now + 4000;
  restored.orchestrator.update(restored.now);
  assert.equal(restored.progression.data.flags.superPlombierInvitationScheduled, true);
});

test('FlashZone unlocks when the invitation link is delivered and restores compatible saves', () => {
  const context = fixture();
  const { progression, orchestrator, values } = context;
  assert.equal(progression.data.flags.superPlombierFlashUnlocked, undefined);
  orchestrator.onLink('http://www.flashzone.fr/jeux/super-plombier-flash');
  assert.equal(progression.data.flags.superPlombierFlashUnlocked, undefined);

  progression.data.dialogues['turbo-flashzone-invitation'] = {
    transcript: [
      {
        speaker: 'contact',
        type: 'link',
        url: 'http://www.flashzone.fr/jeux/super-plombier-flash',
      },
    ],
    finished: true,
  };
  orchestrator.afterMessengerUpdate();
  assert.equal(progression.data.flags.superPlombierFlashUnlocked, true);
  assert.equal(fixture(values).progression.data.flags.superPlombierFlashUnlocked, true);

  const oldWonSave = fixture();
  oldWonSave.progression.data.flags.superPlombierFirstCompletion = true;
  oldWonSave.progression.save();
  assert.equal(fixture(oldWonSave.values).progression.data.flags.superPlombierFlashUnlocked, true);
});
