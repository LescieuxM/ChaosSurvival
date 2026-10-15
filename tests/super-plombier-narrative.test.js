import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Progression } from '../src/story/progression.js';
import { DialogueSession, validateDialogue } from '../src/story/dialogue.js';
import { ConversationThread } from '../src/story/conversation-thread.js';
import { NarrativeOrchestrator } from '../src/story/narrative-orchestrator.js';
import { ConversationWindow } from '../src/ui/conversation.js';
import { createContactAvatar } from '../src/ui/contact-avatar.js';

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
  const storage = new Map();
  const progression = new Progression(story, {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  });
  let now = 1_000;
  const sentWizzes = [];
  const notifications = [];
  let groupThread;
  const contacts = {
    turbo: { id: 'turbo', available: true, online: true },
    pixelgirl: { id: 'pixelgirl', available: true, online: true },
    'plumber-group': { id: 'plumber-group', available: true, online: true },
  };
  const dialogueEvents = { update() {}, triggerConnection() {} };
  const orchestrator = new NarrativeOrchestrator({
    progression,
    definitions,
    dialogueEvents,
    getContact: (id) => contacts[id],
    prepareContact: () => null,
    showConnectionNotification() {},
    showTurboMessageNotification() {},
    sendWizz: (...args) => {
      sentWizzes.push(args);
      return true;
    },
    getGroupThread: () => groupThread,
    showGroupNotification: (contact) => {
      notifications.push(contact?.id);
      return true;
    },
    now: () => now,
  });
  return {
    progression,
    orchestrator,
    sentWizzes,
    notifications,
    storage,
    setGroupThread: (thread) => (groupThread = thread),
    get now() {
      return now;
    },
    set now(value) {
      now = value;
    },
  };
}

test('Super Plombier fixes PixelGirl case at victory and schedules three Wizzes only for case A', () => {
  const { progression, orchestrator, sentWizzes } = fixture();
  progression.data.dialogues['pixelgirl-smiley-victory'] = { finished: false };
  orchestrator.onSuperPlombierStart();
  assert.equal(progression.data.flags.superPlombierPixelCase, undefined);
  progression.data.dialogues['pixelgirl-smiley-victory'] = {
    node: 's8-common-1',
    cursor: definitions['pixelgirl-smiley-victory'].nodes['s8-common-1'].messages.length,
    finished: true,
    transcript: [{ speaker: 'contact', text: 'bon jreviens :3', receivedAt: 1_000 }],
  };
  assert.equal(orchestrator.onSuperPlombierVictory(), true);
  assert.equal(progression.data.flags.superPlombierPixelCase, 'A');
  assert.equal(orchestrator.onSuperPlombierVictory(), false);
  progression.data.dialogues['turbo-super-plombier'] = {
    transcript: [{ speaker: 'contact', receivedAt: 1_000 }],
  };
  progression.data.dialogues['pixelgirl-smiley-victory'] = {
    node: 's8-common-1',
    cursor: definitions['pixelgirl-smiley-victory'].nodes['s8-common-1'].messages.length,
    finished: true,
    transcript: [{ speaker: 'contact', text: 'bon jreviens :3', receivedAt: 1_000 }],
  };

  orchestrator.updateSuperPlombierWizzes(20_999);
  assert.equal(sentWizzes.length, 0);
  orchestrator.updateSuperPlombierWizzes(21_000);
  orchestrator.updateSuperPlombierWizzes(31_000);
  orchestrator.updateSuperPlombierWizzes(39_000);
  orchestrator.updateSuperPlombierWizzes(50_000);

  assert.deepEqual(sentWizzes.map(([id, event]) => [id, event]), [
    ['pixelgirl', 'pixelgirl-super-plombier-wizz-1'],
    ['pixelgirl', 'pixelgirl-super-plombier-wizz-2'],
    ['pixelgirl', 'pixelgirl-super-plombier-wizz-3'],
  ]);
  assert.equal(progression.data.flags.superPlombierWizzCount, 3);
  assert.equal(orchestrator.isConversationUnlocked('pixelgirl-super-plombier-wizz'), true);
});

test('case B preserves the prior PixelGirl conversation and does not unlock the added Wizz dialogue', () => {
  const context = fixture();
  const { progression, orchestrator, sentWizzes } = context;
  const previousDialogue = {
    finished: false,
    node: 's1',
    transcript: [{ speaker: 'contact', text: 'ancien message' }],
  };
  progression.data.dialogues['pixelgirl-smiley-victory'] = previousDialogue;
  orchestrator.onSuperPlombierStart();
  assert.equal(progression.data.flags.superPlombierPixelCase, undefined);
  progression.data.flags.superPlombierPixelCase = 'A'; // Stale pre-victory snapshot from an older save.
  orchestrator.onSuperPlombierVictory();
  assert.equal(progression.data.flags.superPlombierPixelCase, 'B');
  progression.data.flags.superPlombierWizzCount = 3;
  progression.data.flags.superPlombierNextWizzAt = 20_000;
  progression.data.flags.pixelGirlSuperPlombierReplyWizzDueAt = 21_000;
  progression.data.dialogues['turbo-super-plombier'] = {
    transcript: [{ speaker: 'contact', receivedAt: 1_000 }],
  };
  orchestrator.updateSuperPlombierWizzes(100_000);
  orchestrator.updatePixelGirlWizzBrawl(100_000);
  assert.equal(sentWizzes.length, 0);
  assert.equal(progression.data.flags.superPlombierNextWizzAt, undefined);
  assert.equal(progression.data.dialogues['pixelgirl-smiley-victory'], previousDialogue);
  assert.equal(progression.data.dialogues['pixelgirl-super-plombier-wizz'], undefined);
  assert.equal(orchestrator.isConversationUnlocked('pixelgirl-super-plombier-wizz'), false);
  assert.equal(orchestrator.pixelGirlPostDialogueFinished(), false);
  previousDialogue.finished = true;
  previousDialogue.node = 's8-common-1';
  previousDialogue.cursor = definitions['pixelgirl-smiley-victory'].nodes['s8-common-1'].messages.length;
  previousDialogue.transcript.push({ speaker: 'contact', text: 'bon jreviens :3', receivedAt: 90 });
  progression.data.dialogues['pixelgirl-super-plombier-wizz'] = {
    node: 'ending',
    cursor: definitions['pixelgirl-super-plombier-wizz'].nodes.ending.messages.length,
    finished: true,
    transcript: [{ text: 'allez bisousss :3', receivedAt: 100 }],
  };
  assert.equal(orchestrator.pixelGirlPostDialogueFinished(), true);
  progression.save();
  const restored = new Progression(story, {
    getItem: (key) => context.storage.get(key) ?? null,
    setItem: (key, value) => context.storage.set(key, value),
  });
  let restoredWizzCount = 0;
  const resumed = new NarrativeOrchestrator({
    progression: restored,
    definitions,
    dialogueEvents: { update() {} },
    getContact: () => null,
    prepareContact: () => null,
    showConnectionNotification() {},
    showTurboMessageNotification() {},
    sendWizz: () => {
      restoredWizzCount++;
      return true;
    },
  });
  resumed.updateSuperPlombierWizzes(500_000);
  assert.equal(restored.data.flags.superPlombierPixelCase, 'B');
  assert.equal(restoredWizzCount, 0);
});

test('case B sends exactly three saved reminder Wizzes at 20, 35 and 45 seconds, then stops after a reply', () => {
  const { progression, orchestrator, sentWizzes } = fixture();
  const definition = definitions['pixelgirl-smiley-victory'];
  progression.data.flags.superPlombierPostStarted = true;
  progression.data.flags.superPlombierPixelCase = 'B';
  progression.data.dialogues[definition.id] = {
    revision: definition.revision,
    node: 's1',
    cursor: definition.nodes.s1.messages.length,
    transcript: [{ speaker: 'contact', text: 'attente', receivedAt: 1_000 }],
    finished: false,
  };

  orchestrator.updatePixelGirlReplyReminders(20_999);
  assert.equal(sentWizzes.length, 0);
  orchestrator.updatePixelGirlReplyReminders(21_000);
  assert.equal(progression.data.flags.pixelGirlReplyReminderCount, 1);
  assert.equal(progression.data.flags.pixelGirlReplyReminderDueAt, 36_000);
  orchestrator.updatePixelGirlReplyReminders(36_000);
  assert.equal(progression.data.flags.pixelGirlReplyReminderCount, 2);
  assert.equal(progression.data.flags.pixelGirlReplyReminderDueAt, 46_000);
  orchestrator.updatePixelGirlReplyReminders(46_000);
  orchestrator.updatePixelGirlReplyReminders(100_000);
  assert.equal(progression.data.flags.pixelGirlReplyReminderCount, 3);
  assert.equal(sentWizzes.length, 3);
  assert.equal(progression.data.dialogues[definition.id].transcript.length, 1);
});

test('case B reminder deadlines resume from a save without restarting the sequence', () => {
  const context = fixture();
  const { progression, storage, sentWizzes } = context;
  const definition = definitions['pixelgirl-smiley-victory'];
  progression.data.flags.superPlombierPostStarted = true;
  progression.data.flags.superPlombierPixelCase = 'B';
  progression.data.dialogues[definition.id] = {
    revision: definition.revision,
    node: 's1',
    cursor: definition.nodes.s1.messages.length,
    transcript: [{ speaker: 'contact', text: 'attente', receivedAt: 1_000 }],
    finished: false,
  };
  context.orchestrator.updatePixelGirlReplyReminders(21_000);
  assert.equal(sentWizzes.length, 1);
  const restored = new Progression(story, {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  });
  const resumedWizzes = [];
  const resumed = new NarrativeOrchestrator({
    progression: restored,
    definitions,
    dialogueEvents: { update() {} },
    getContact: (id) => ({ id }),
    prepareContact: () => null,
    showConnectionNotification() {},
    showTurboMessageNotification() {},
    sendWizz: (...args) => { resumedWizzes.push(args); return true; },
  });
  assert.equal(restored.data.flags.pixelGirlReplyReminderCount, 1);
  assert.equal(restored.data.flags.pixelGirlReplyReminderDueAt, 36_000);
  resumed.updatePixelGirlReplyReminders(35_999);
  assert.equal(resumedWizzes.length, 0);
  resumed.updatePixelGirlReplyReminders(36_000);
  assert.equal(resumedWizzes.length, 1);
  assert.equal(restored.data.flags.pixelGirlReplyReminderCount, 2);
});

test('a player reply cancels remaining case B reminder Wizzes without rearming at the next choice', () => {
  const { progression, orchestrator, sentWizzes } = fixture();
  const definition = definitions['pixelgirl-smiley-victory'];
  progression.data.flags.superPlombierPostStarted = true;
  progression.data.flags.superPlombierPixelCase = 'B';
  progression.data.dialogues[definition.id] = {
    revision: definition.revision,
    node: 's1',
    cursor: definition.nodes.s1.messages.length,
    transcript: [{ speaker: 'contact', text: 'attente', receivedAt: 1_000 }],
    finished: false,
  };
  orchestrator.updatePixelGirlReplyReminders(21_000);
  assert.equal(sentWizzes.length, 1);
  orchestrator.onChoiceValidated(definition, { nodeId: 's1' });
  assert.equal(progression.data.flags.pixelGirlReplyReminderDueAt, undefined);
  assert.equal(progression.data.flags.pixelGirlReplyReminderStopped, true);
  progression.data.dialogues[definition.id].node = 's2';
  progression.data.dialogues[definition.id].cursor = definition.nodes.s2.messages.length;
  progression.data.dialogues[definition.id].transcript.push({ speaker: 'contact', text: 'nouvelle question', receivedAt: 50_000 });
  orchestrator.updatePixelGirlReplyReminders(100_000);
  assert.equal(sentWizzes.length, 1);
});

test('case B starts the humor Wizz sequence 20 seconds after the initial PixelGirl dialogue ends', () => {
  const { progression, orchestrator, sentWizzes } = fixture();
  progression.data.flags.superPlombierPostStarted = true;
  progression.data.flags.superPlombierPixelCase = 'B';
  progression.data.dialogues['pixelgirl-smiley-victory'] = {
    node: 's8-common-1',
    cursor: definitions['pixelgirl-smiley-victory'].nodes['s8-common-1'].messages.length,
    finished: true,
    transcript: [{ text: 'bon jreviens :3', receivedAt: 50_000 }],
  };
  orchestrator.updateSuperPlombierWizzes(69_999);
  assert.equal(sentWizzes.length, 0);
  orchestrator.updateSuperPlombierWizzes(70_000);
  assert.equal(sentWizzes.length, 1);
  assert.equal(progression.data.flags.superPlombierWizzCount, 1);
  assert.equal(progression.data.flags.superPlombierNextWizzAt, 80_000);
});

test('PixelGirl Wizz dialogue preserves its three opening choices and completes all closing choices', () => {
  const definition = definitions['pixelgirl-super-plombier-wizz'];
  validateDialogue(definition);
  assert.deepEqual(definition.nodes.opening.messages.map((message) => message.text), [
    'WIZZZZZZZ',
    'hihihihi xD',
  ]);
  assert.deepEqual(definition.nodes.opening.choices.map((choice) => choice.text), [
    'MAIS ARRETE MDR',
    'quoiiiii',
    '*wizz*',
  ]);

  for (const [branchIndex, openingChoice] of definition.nodes.opening.choices.entries()) {
    const { progression, orchestrator, sentWizzes } = fixture();
    progression.data.flags.superPlombierPixelCase = 'A';
    const session = new DialogueSession(definition, progression);
    session.deliver();
    session.deliver();
    session.choose(openingChoice.id);
    orchestrator.onChoiceValidated(definition, { nodeId: definition.start });
    orchestrator.onChoiceValidated(definition, { nodeId: definition.start });

    while (session.state.node !== 'closing') {
      if (session.nextMessage()) session.deliver();
      else assert.equal(session.advance(), true);
    }
    if (openingChoice.id === 'wizz') {
      assert.deepEqual(sentWizzes.map(([, eventId, speaker]) => [eventId, speaker]), [
        ['pixelgirl-super-plombier-player-wizz', 'player'],
      ]);
      assert.ok(session.state.transcript.some((message) => message.text === 'AHAHAHAHA'));
      assert.ok(session.state.transcript.some((message) => message.text === 'BATAILLE DE WIZZ !!!'));
      session.state.transcript.at(-1).receivedAt = 10_000;
      session.persist();
      orchestrator.updatePixelGirlWizzBrawl(10_599);
      assert.equal(sentWizzes.length, 1);
      orchestrator.updatePixelGirlWizzBrawl(10_600);
      orchestrator.updatePixelGirlWizzBrawl(11_499);
      assert.equal(sentWizzes.length, 2);
      orchestrator.updatePixelGirlWizzBrawl(11_500);
      orchestrator.updatePixelGirlWizzBrawl(20_000);
      assert.deepEqual(sentWizzes.map(([, eventId, speaker]) => [eventId, speaker]), [
        ['pixelgirl-super-plombier-player-wizz', 'player'],
        ['pixelgirl-super-plombier-battle-1', 'contact'],
        ['pixelgirl-super-plombier-battle-2', 'contact'],
      ]);
    } else {
      assert.deepEqual(sentWizzes, []);
    }

    while (session.nextMessage()) session.deliver();
    assert.deepEqual(session.choices.map((choice) => choice.text), [
      'merci ptdr',
      "j'y crois pas une seconde",
      'dommage je commen\u00e7ais \u00e0 aimer',
    ]);
    session.choose(session.choices[branchIndex].id);
    while (!session.state.finished) {
      if (session.nextMessage()) session.deliver();
      else session.advance();
    }
    assert.equal(session.state.transcript.at(-1).text, 'allez bisousss :3');
    assert.equal(session.state.finished, true);
    assert.equal(
      session.state.transcript.some((message) => message.text === 'fallait r\u00e9pondre aussi xD'),
      false,
    );
    const countAtEnd = sentWizzes.length;
    orchestrator.updatePixelGirlWizzBrawl(100_000);
    assert.equal(sentWizzes.length, countAtEnd);
  }
});

test('Wizz dialogue migration preserves an in-progress save and leaves completed saves finished', () => {
  const definition = definitions['pixelgirl-super-plombier-wizz'];
  const context = fixture();
  const { progression } = context;
  const oldMessages = ['WIZZZZZ', "t'es mort ou quoi xD"];
  progression.data.dialogues[definition.id] = {
    revision: 1,
    node: 'opening',
    cursor: 2,
    transcript: oldMessages.map((text, index) => ({
      speaker: 'contact',
      text,
      receivedAt: index + 1,
    })),
    finished: false,
  };
  progression.data.conversations.pixelgirl = {
    version: 1,
    history: oldMessages.map((text, index) => ({
      speaker: 'contact',
      text,
      key: `${definition.id}:1:${index}`,
    })),
    unread: [`${definition.id}:1:1`],
    activeEvent: definition.id,
    pendingEvents: [],
  };
  new NarrativeOrchestrator({
    progression,
    definitions,
    dialogueEvents: { update() {} },
    getContact: () => null,
    prepareContact: () => null,
    showConnectionNotification() {},
    showTurboMessageNotification() {},
  });
  assert.equal(progression.data.dialogues[definition.id].revision, 2);
  assert.equal(progression.data.dialogues[definition.id].cursor, 2);
  assert.deepEqual(
    new DialogueSession(definition, progression).choices.map((choice) => choice.id),
    ['stop', 'what', 'wizz'],
  );
  assert.deepEqual(progression.data.conversations.pixelgirl.unread, [`${definition.id}:2:1`]);
  assert.ok(progression.data.dialogueArchives[`${definition.id}:1`]);

  const finishedContext = fixture();
  finishedContext.progression.data.dialogues[definition.id] = {
    revision: 1,
    node: 'stop-reply',
    cursor: 2,
    transcript: [{ speaker: 'contact', text: 'ancien dernier message', receivedAt: 3 }],
    finished: true,
  };
  new NarrativeOrchestrator({
    progression: finishedContext.progression,
    definitions,
    dialogueEvents: { update() {} },
    getContact: () => null,
    prepareContact: () => null,
    showConnectionNotification() {},
    showTurboMessageNotification() {},
  });
  assert.equal(finishedContext.progression.data.dialogues[definition.id].revision, 1);
  assert.equal(finishedContext.progression.data.dialogues[definition.id].finished, true);
});

test('the group invite waits for both branches and migrates an old rest deadline to 20 seconds', () => {
  const context = fixture();
  const { progression, orchestrator, notifications } = context;
  let scheduled = 0;
  let received = 0;
  context.setGroupThread({
    state: { history: [] },
    schedule() {
      scheduled++;
      progression.data.dialogues['pixelgirl-super-plombier-group'] = {
        transcript: [],
        receiveDueAt: 158_800,
      };
    },
    receive() {
      received++;
    },
  });
  progression.data.flags.superPlombierPostStarted = true;
  progression.data.flags.superPlombierPixelCase = 'A';
  progression.data.flags.superPlombierTurboMigratedFinishAt = 500_000;
  progression.data.flags.superPlombierGroupRestDueAt = 158_000;
  progression.data.dialogues['turbo-super-plombier'] = {
    node: 'last-goodbye',
    cursor: definitions['turbo-super-plombier'].nodes['last-goodbye'].messages.length,
    finished: true,
    transcript: [{ text: 'allez a+', receivedAt: 4_000 }],
  };
  progression.data.dialogues['pixelgirl-smiley-victory'] = {
    node: 's8-common-1',
    cursor: definitions['pixelgirl-smiley-victory'].nodes['s8-common-1'].messages.length,
    finished: true,
    transcript: [{ text: 'bon jreviens :3', receivedAt: 6_000 }],
  };
  progression.data.dialogues['pixelgirl-super-plombier-wizz'] = {
    node: 'ending',
    cursor: definitions['pixelgirl-super-plombier-wizz'].nodes.ending.messages.length,
    finished: false,
    transcript: [{ receivedAt: 5_000 }],
  };
  orchestrator.updateGroup(10_000);
  assert.equal(progression.data.flags.superPlombierGroupRestDueAt, undefined);
  progression.data.dialogues['pixelgirl-super-plombier-wizz'].finished = true;
  progression.data.dialogues['pixelgirl-super-plombier-wizz'].transcript.push({ text: 'allez bisousss :3', receivedAt: 8_000 });
  orchestrator.updateGroup(10_000);
  assert.equal(progression.data.flags.superPlombierGroupRestDueAt, 28_000);
  orchestrator.updateGroup(27_999);
  assert.equal(progression.data.flags.superPlombierGroupCreated, undefined);
  orchestrator.updateGroup(28_000);
  orchestrator.updateGroup(28_001);
  assert.equal(progression.data.flags.superPlombierGroupCreated, true);
  assert.equal(scheduled, 1);
  assert.equal(received, 2);
  assert.deepEqual(notifications, ['plumber-group']);
});

test('group rest begins from Turb0\u2019s final transcript message, never the obsolete migration marker', () => {
  const { progression, orchestrator } = fixture();
  progression.data.flags.superPlombierPostStarted = true;
  progression.data.flags.superPlombierPixelCase = 'B';
  progression.data.flags.superPlombierTurboMigratedFinishAt = 900_000;
  progression.data.dialogues['turbo-super-plombier'] = {
    node: 'last-goodbye',
    cursor: definitions['turbo-super-plombier'].nodes['last-goodbye'].messages.length,
    finished: true,
    transcript: [
      { speaker: 'contact', text: 'MDRRRRRR', receivedAt: 100_000 },
      { speaker: 'contact', text: 'allez a+', receivedAt: 200_000 },
    ],
  };
  progression.data.dialogues['pixelgirl-smiley-victory'] = {
    node: 's8-common-1',
    cursor: definitions['pixelgirl-smiley-victory'].nodes['s8-common-1'].messages.length,
    finished: true,
    transcript: [{ text: 'bon jreviens :3', receivedAt: 205_000 }],
  };
  progression.data.dialogues['pixelgirl-super-plombier-wizz'] = {
    node: 'ending',
    cursor: definitions['pixelgirl-super-plombier-wizz'].nodes.ending.messages.length,
    finished: true,
    transcript: [{ text: 'allez bisousss :3', receivedAt: 210_000 }],
  };
  orchestrator.updateGroup(210_000);
  assert.equal(progression.data.flags.superPlombierGroupRestDueAt, 230_000);
  orchestrator.updateGroup(229_999);
  assert.equal(progression.data.flags.superPlombierGroupCreated, undefined);
  orchestrator.updateGroup(230_000);
  assert.equal(progression.data.flags.superPlombierGroupCreated, true);
  progression.data.flags.superPlombierGroupRestDueAt = 999_000;
  progression.data.flags.superPlombierGroupCreatedAt = 230_000;
  orchestrator.updateGroup(500_000);
  assert.equal(progression.data.flags.superPlombierGroupRestDueAt, 999_000);
  assert.equal(progression.data.flags.superPlombierGroupCreatedAt, 230_000);
});

test('the second finished conversation starts one rest deadline that survives a reload in either order', () => {
  for (const order of ['turbo-first', 'pixelgirl-first']) {
    const context = fixture();
    const { progression, orchestrator, storage } = context;
    progression.data.flags.superPlombierPostStarted = true;
    progression.data.flags.superPlombierPixelCase = order === 'turbo-first' ? 'A' : 'B';
    progression.data.dialogues['pixelgirl-smiley-victory'] = {
      revision: definitions['pixelgirl-smiley-victory'].revision,
      node: 's8-common-1',
      cursor: 1,
      finished: order === 'pixelgirl-first',
      transcript: [{ speaker: 'contact', text: order === 'pixelgirl-first' ? 'bon jreviens :3' : 'en cours', receivedAt: 10_000 }],
    };
    progression.data.dialogues['pixelgirl-super-plombier-wizz'] = {
      revision: definitions['pixelgirl-super-plombier-wizz'].revision,
      node: 'ending',
      cursor: 2,
      finished: order === 'pixelgirl-first',
      transcript: [{ speaker: 'contact', text: order === 'pixelgirl-first' ? 'allez bisousss :3' : 'en cours', receivedAt: 10_000 }],
    };
    progression.data.dialogues['turbo-super-plombier'] = {
      revision: definitions['turbo-super-plombier'].revision,
      node: 'last-goodbye',
      cursor: 1,
      finished: order === 'turbo-first',
      transcript: [{ speaker: 'contact', text: order === 'turbo-first' ? 'allez a+' : 'en cours', receivedAt: 20_000 }],
    };
    orchestrator.updateGroup(20_000);
    assert.equal(progression.data.flags.superPlombierGroupRestDueAt, undefined);

    progression.data.dialogues['pixelgirl-smiley-victory'].finished = true;
    progression.data.dialogues['pixelgirl-smiley-victory'].transcript.at(-1).text = 'bon jreviens :3';
    progression.data.dialogues['pixelgirl-smiley-victory'].transcript.push({ speaker: 'contact', text: 'bon jreviens :3', receivedAt: 30_000 });
    progression.data.dialogues['pixelgirl-super-plombier-wizz'].finished = true;
    progression.data.dialogues['pixelgirl-super-plombier-wizz'].transcript.at(-1).text = 'allez bisousss :3';
    progression.data.dialogues['pixelgirl-super-plombier-wizz'].transcript.push({ speaker: 'contact', text: 'allez bisousss :3', receivedAt: 30_000 });
    progression.data.dialogues['turbo-super-plombier'].finished = true;
    progression.data.dialogues['turbo-super-plombier'].transcript.at(-1).text = 'allez a+';
    progression.data.dialogues['turbo-super-plombier'].transcript.push({ speaker: 'contact', text: 'allez a+', receivedAt: 40_000 });
    orchestrator.updateGroup(40_000);
    assert.equal(progression.data.flags.superPlombierGroupRestDueAt, 60_000);
    progression.save();

    const restored = new Progression(story, {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    });
    let scheduled = 0;
    const resumed = new NarrativeOrchestrator({
      progression: restored,
      definitions,
      dialogueEvents: { update() {} },
      getContact: () => ({ id: 'plumber-group' }),
      prepareContact: () => null,
      showConnectionNotification() {},
      showTurboMessageNotification() {},
      getGroupThread: () => ({
        state: { history: [] },
        schedule() {
          scheduled++;
          restored.data.dialogues['pixelgirl-super-plombier-group'] = { receiveDueAt: 200_000 };
        },
        receive() {},
      }),
      showGroupNotification: () => true,
      now: () => 45_000,
    });
    resumed.updateGroup(45_000);
    assert.equal(restored.data.flags.superPlombierGroupRestDueAt, 60_000);
    resumed.updateGroup(59_999);
    assert.equal(restored.data.flags.superPlombierGroupCreated, undefined);
    resumed.updateGroup(60_000);
    resumed.updateGroup(60_001);
    assert.equal(restored.data.flags.superPlombierGroupCreated, true);
    assert.equal(scheduled, 1);
  }
});

test('group dialogue keeps its original opening, persists each choice path, and converges at the quiet ending', () => {
  const definition = definitions['pixelgirl-super-plombier-group'];
  validateDialogue(definition);
  const originalOpening = [
    'COUCOUUUUUUU', '???', 'salut :)', 'voila maintenant vous etes tous la :D',
    'pk tu fais un groupe mdr', 'parce que jai envie xD', 'argument imparable', 'ptdrrrr',
  ];
  const selectedOpeningChoices = [
    ['on peut juste discuter non ?', 'des mains à la place des pieds', 'vous êtes vraiment débiles mdr'],
    ['on peut jouer à un truc', 'des pieds à la place des mains', 'moi je suis du côté de luna'],
    ["c'est toi qui nous as réunis mdr", 'je préfère garder mon corps actuel merci', 'SI'],
  ];
  const branchMessages = [
    ['merci captain obvious', 'MAIS VOUS ETES TOUS OBSEDES PAR LES MAINS'],
    ['evidemment que tu veux jouer toi', 'imagine jouer a la souris avec un pied'],
    ['MAIS ARRETEZ DE ME JUGER', 'MAIS LUNAAAA'],
  ];

  for (let path = 0; path < 3; path++) {
    const { progression } = fixture();
    const thread = new ConversationThread('plumber-group', progression, () => [definition]);
    const session = new DialogueSession(definition, progression);
    const choices = selectedOpeningChoices[path];
    let choiceIndex = 0;
    while (!session.state.finished) {
      const message = session.nextMessage();
      if (message) {
        session.deliver();
        continue;
      }
      if (session.choices.length) {
        session.offerChoices();
        const offered = session.choices;
        const targetText = choices[choiceIndex++];
        const selected = offered.find((choice) => choice.text === targetText);
        assert.ok(selected, `Missing ${targetText}; offered: ${offered.map(({ text }) => text).join(' | ')}`);
        session.choose(selected.id);
        continue;
      }
      if (!session.advance()) break;
    }
    thread.sync();
    assert.equal(session.state.finished, true);
    assert.equal(choiceIndex, 3);
    assert.deepEqual(session.state.transcript.slice(0, 8).map(({ text }) => text), originalOpening);
    assert.ok(session.state.transcript.some(({ text }) => text === branchMessages[path][0]));
    assert.ok(session.state.transcript.some(({ text }) => text === branchMessages[path][1]));
    assert.ok(session.state.transcript.some(({ text }) => text === [
      'on fait de notre mieux :D', 'TRAHISON', 'PTDRRRRRRRRRRR',
    ][path]));
    assert.equal(session.state.transcript.at(-1).text, "vous êtes méchants :'(");
    assert.deepEqual(
      session.state.transcript.filter(({ speaker }) => speaker === 'player').map(({ text }) => text),
      choices,
    );
    assert.equal(thread.state.history.length, session.state.transcript.length);

    const restored = new ConversationThread('plumber-group', progression, () => [definition]);
    restored.sync();
    assert.equal(restored.state.history.length, session.state.transcript.length);
  }
});

test('a saved group opening resumes at the new dialogue without replaying its original messages', () => {
  const { progression } = fixture();
  const definition = definitions['pixelgirl-super-plombier-group'];
  const transcript = definition.nodes.opening.messages.map((message, index) => ({
    speaker: message.speaker,
    author: message.author,
    text: message.text,
    receivedAt: 1_000 + index,
  }));
  progression.data.dialogues[definition.id] = {
    node: 'opening', cursor: 8, transcript, finished: true, revision: 1,
  };
  progression.data.conversations['plumber-group'] = {
    version: 1,
    history: transcript.map((message, index) => ({
      ...message,
      key: `${definition.id}:1:${index}`,
      eventId: definition.id,
    })),
    unread: [],
    activeEvent: definition.id,
    pendingEvents: [],
  };

  new NarrativeOrchestrator({
    progression,
    definitions,
    dialogueEvents: { update() {}, triggerConnection() {} },
    getContact: () => null,
    prepareContact: () => null,
    showConnectionNotification() {},
  });

  const saved = progression.data.dialogues[definition.id];
  assert.equal(saved.revision, 2);
  assert.equal(saved.node, 'a');
  assert.equal(saved.cursor, 0);
  assert.equal(saved.finished, false);
  assert.equal(saved.transcript.length, 8);
  assert.deepEqual(
    progression.data.conversations['plumber-group'].history.map(({ key }) => key),
    transcript.map((_, index) => `${definition.id}:2:${index}`),
  );
  assert.ok(progression.data.dialogueArchives[`${definition.id}:1`]);
});

test('group conversation status keeps the participant list alongside its normal contact profile', () => {
  const status = ConversationWindow.prototype.contactStatus.call(
    { player: { nickname: 'Moi' } },
    definitions['pixelgirl-super-plombier-group'],
  );
  assert.match(status, /xX_PixelGirl_Xx, Turb0/);
  assert.match(status, /Moi/);
  assert.match(status, /En ligne/);
  assert.match(status, /Conversation de groupe/);
});

test('the group avatar is composed from the three existing character avatars', (t) => {
  const previous = globalThis.document;
  globalThis.document = {
    createElement: (tagName) => ({
      tagName: tagName.toUpperCase(),
      attributes: {},
      children: [],
      dataset: {},
      setAttribute(name, value) { this.attributes[name] = value; },
      append(child) { this.children.push(child); },
    }),
  };
  t.after(() => {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  });

  const avatar = createContactAvatar(definitions['pixelgirl-super-plombier-group'].contact);
  assert.equal(avatar.className, 'contact-avatar-composition');
  assert.equal(avatar.attributes.role, 'img');
  assert.deepEqual(avatar.children.map(({ src, dataset }) => [src, dataset.avatar]), [
    ['./avatars/pixelgirl.svg', 'pixelgirl'],
    ['./avatars/turbo.svg', 'turb0'],
    ['./avatars/luna.svg', 'luna'],
  ]);
});

test('group transcript color IDs follow saved authors, while private conversations stay unchanged', (t) => {
  const previous = globalThis.document;
  globalThis.document = {
    createElement: (tagName) => ({
      tagName,
      children: [],
      dataset: {},
      append(...children) { this.children.push(...children); },
      setAttribute() {},
    }),
    createTextNode: (textContent) => ({ textContent }),
  };
  t.after(() => {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  });
  const groupRows = [];
  const groupView = {
    dialogue: definitions['pixelgirl-super-plombier-group'],
    flow: { append: (row) => groupRows.push(row) },
    scrollLatest() {},
  };
  for (const [speaker, author, authorId, label] of [
    ['contact', 'xX_PixelGirl_Xx', 'pixelgirl', 'xX_PixelGirl_Xx dit :'],
    ['contact', 'Turb0', 'turbo', 'Turb0 dit :'],
    ['contact', '°•.LuNa.°•', 'luna', '°•.LuNa.°• dit :'],
    ['player', undefined, 'player', 'JustMe dit :'],
  ]) {
    ConversationWindow.prototype.appendMessage.call(groupView, {
      speaker, author, text: 'message de test',
    });
    const row = groupRows.at(-1);
    assert.equal(row.dataset.authorId, authorId);
    assert.equal(row.children[0].textContent, label);
  }
  const privateRows = [];
  ConversationWindow.prototype.appendMessage.call({
    dialogue: definitions['pixelgirl-smiley-victory'],
    flow: { append: (row) => privateRows.push(row) },
    scrollLatest() {},
  }, { speaker: 'contact', author: 'Turb0', text: 'message privé' });
  assert.equal(privateRows[0].dataset.authorId, undefined);

  const styles = readFileSync(new URL('../src/styles-story.css', import.meta.url), 'utf8');
  for (const color of ['#d21883', '#2057c8', '#7950a0', '#252525'])
    assert.ok(styles.includes(color));
  assert.match(styles, /\.group-conversation \.conversation-message\[data-author-id\] > p/);
  assert.doesNotMatch(styles, /\.group-conversation \.conversation-message\[data-author-id\] > small/);
  assert.match(styles, /\.conversation-message small \{[\s\S]*?color: #8795a5;/);
});

test('Turbo post-game dialogue preserves its opening and all six choice groups converge on the final line', () => {
  const definition = definitions['turbo-super-plombier'];
  validateDialogue(definition);
  const expectedOpenings = new Map([
    ['impossible-record', 'ptdrrrr mauvais perdant'],
    ['struggled', 'HAHAHAHA'],
    ['bad-game', "rage pas parce que t'es nul mdr"],
  ]);
  const choiceNodes = ['challenge', 'bug-found', 'bugs-passion', 'mom', 'friends', 'food'];
  for (const targetNode of choiceNodes) {
    for (const targetChoice of definition.nodes[targetNode].choices) {
      const { progression } = fixture();
      const session = new DialogueSession(definition, progression);
      while (!session.state.finished) {
        if (session.nextMessage()) session.deliver();
        else if (session.choices.length) {
          const choice = session.state.node === targetNode
            ? targetChoice
            : session.choices[0];
          session.choose(choice.id);
        } else session.advance();
      }
      const text = session.state.transcript.map((entry) => entry.text);
      assert.ok(text.includes("alors noob ta fini ? xD"));
      assert.ok(text.includes("bon j'avoue"));
      assert.ok(text.includes("MDRRRRRR"));
      assert.ok(text.includes('allez a+'));
      assert.equal(text.at(-1), 'allez a+');
      assert.ok(!text.includes('ah merde pixelgirl me wizz aussi'));
      assert.ok(!text.includes('elle est relou ptdr'));
      if (targetNode === 'challenge') assert.ok(text.includes(expectedOpenings.get(targetChoice.id)));
      if (targetNode === 'mom' && targetChoice.id === 'age') assert.ok(text.includes('13 ans'));
      assert.equal(progression.data.choices.filter((entry) => entry.dialogue === definition.id).length, 6);
    }
  }
});

test('old saves at the removed PixelGirl lines finish after the common reply without losing history', () => {
  const context = fixture();
  const { progression, storage } = context;
  const previousDefinition = structuredClone(definitions['turbo-super-plombier']);
  previousDefinition.revision = 1;
  delete previousDefinition.nodes.common.end;
  previousDefinition.nodes.common.next = 'pixelgirl-wizz';
  previousDefinition.nodes['pixelgirl-wizz'] = {
    messages: [
      { speaker: 'contact', text: 'ah merde pixelgirl me wizz aussi', delayMs: 0, typingMs: 0 },
      { speaker: 'contact', text: 'elle est relou ptdr', delayMs: 0, typingMs: 0 },
    ],
    end: true,
  };
  const oldSession = new DialogueSession(previousDefinition, progression);
  oldSession.deliver();
  oldSession.choose('bad-game');
  while (oldSession.state.node !== 'pixelgirl-wizz') {
    if (oldSession.nextMessage()) oldSession.deliver();
    else if (oldSession.choices.length) oldSession.choose(oldSession.choices[0].id);
    else oldSession.advance();
  }
  oldSession.deliver();
  const oldThread = new ConversationThread('turbo', progression, () => [previousDefinition]);
  oldThread.sync();
  const oldHistoryLength = oldThread.state.history.length;

  new NarrativeOrchestrator({
    progression,
    definitions,
    dialogueEvents: { update() {} },
    getContact: () => null,
    prepareContact: () => null,
    showConnectionNotification() {},
    showTurboMessageNotification() {},
  });
  const saved = progression.data.dialogues['turbo-super-plombier'];
  assert.equal(saved.revision, 3);
  assert.equal(saved.finished, true);
  assert.ok(saved.transcript.some((message) => message.text === 'ah merde pixelgirl me wizz aussi'));
  assert.ok(progression.data.dialogueArchives['turbo-super-plombier:1']);
  const currentThread = new ConversationThread('turbo', progression, () => [
    definitions['turbo-super-plombier'],
  ]);
  assert.equal(currentThread.state.history.length, oldHistoryLength);
  assert.equal(currentThread.state.history.at(-1).key, `turbo-super-plombier:3:${saved.transcript.length - 1}`);
  assert.equal(new DialogueSession(definitions['turbo-super-plombier'], progression).nextMessage(), null);
  assert.equal(storage.size > 0, true);
});
