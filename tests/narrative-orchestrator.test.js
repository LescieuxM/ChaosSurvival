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

function fixture() {
  const values = new Map();
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
  const messageNotifications = [];
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
    prepareContact: () => ({ thread: turboThread }),
    showConnectionNotification: (id, options) => connectionNotifications.push({ id, options }),
    showTurboMessageNotification: (contact, onShow) =>
      messageNotifications.push({ contact, onShow }),
    now: () => now,
  });
  return {
    progression,
    orchestrator,
    connectionNotifications,
    messageNotifications,
    get now() {
      return now;
    },
    set now(value) {
      now = value;
    },
  };
}

test('validating PixelGirl first reply connects Turb0 once and prepares the existing dialogue thread', () => {
  const { progression, orchestrator, connectionNotifications } = fixture();
  const definition = definitions['pixelgirl-smiley-victory'];
  orchestrator.onChoiceValidated(definition, { nodeId: definition.start });
  orchestrator.onChoiceValidated(definition, { nodeId: definition.start });

  assert.equal(progression.data.flags.turboSmileyScene3ArrivalTriggered, true);
  assert.equal(progression.data.contactConnections.turbo.status, 'online');
  assert.equal(connectionNotifications.length, 1);
  assert.equal(progression.data.dialogues['turbo-smiley-catcher'].receiveDueAt, 10_000);
});

test('Turb0 message deadline follows the full connection notice and two-second gap', () => {
  const context = fixture();
  const { progression, orchestrator, messageNotifications, connectionNotifications } = context;
  progression.data.flags.turboSmileyScene3ArrivalTriggered = true;
  progression.data.contactConnections = { turbo: { status: 'online' } };
  progression.data.dialogues['turbo-smiley-catcher'] = {
    node: 'opening',
    cursor: 1,
    finished: false,
    transcript: [{ speaker: 'contact', text: 'mdrrrr noob' }],
  };

  orchestrator.onContactConnected('turbo');
  orchestrator.onConnectionNotificationQueued('turbo', 3_480);
  assert.equal(progression.data.flags.turboSmileyScene3MessageNotificationDueAt, 15_480);
  orchestrator.afterMessengerUpdate(15_480);
  assert.equal(messageNotifications.length, 0);

  context.now = 15_480;
  connectionNotifications[0].options.onDismiss();
  orchestrator.afterMessengerUpdate(17_479);
  assert.equal(messageNotifications.length, 0);
  orchestrator.afterMessengerUpdate(17_480);
  assert.equal(messageNotifications.length, 1);
  messageNotifications[0].onShow();
  assert.equal(progression.data.flags.turboSmileyScene3Notified, true);
  assert.equal(progression.data.flags.turboSmileyScene3MessageNotificationDueAt, undefined);
});

test('invitation is scheduled ten seconds after Luna connects and only once', () => {
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
  assert.equal(progression.data.flags.superPlombierInvitationDueAt, now + 10_000);

  context.now = now + 9_999;
  orchestrator.update(context.now);
  assert.equal(progression.data.dialogues['turbo-flashzone-invitation'], undefined);
  context.now = now + 10_000;
  orchestrator.update(context.now);
  assert.equal(
    Number.isFinite(progression.data.dialogues['turbo-flashzone-invitation']?.receiveDueAt),
    true,
  );
  assert.equal(progression.data.flags.superPlombierInvitationScheduled, true);
  context.now = now + 20_000;
  orchestrator.update(context.now);
  assert.equal(progression.data.flags.superPlombierInvitationScheduled, true);
});
