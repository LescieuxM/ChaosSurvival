import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Progression } from '../src/story/progression.js';
import { DialogueSession, validateDialogue } from '../src/story/dialogue.js';
import { ReplayReactions } from '../src/story/replays.js';
import { DialogueEvents } from '../src/story/dialogue-events.js';
import { visibleContacts } from '../src/ui/contacts.js';
import { MiniGameLauncher } from '../src/ui/minigame-launcher.js';
import { registerMiniGame } from '../src/ui/minigame-registry.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const story = read('../src/config/story.json');
const config = read('../src/config/replay-reactions.json');
const definitions = Object.fromEntries(
  readdirSync(new URL('../src/dialogues/', import.meta.url))
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const d = read(`../src/dialogues/${file}`);
      return [d.id, d];
    }),
);
const dialogue = definitions['pixelgirl-smiley-victory'];
function setup() {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const progression = new Progression(story, storage);
  progression.begin();
  progression.complete('arcade-1');
  const intro = new DialogueSession(definitions['pixelgirl-intro'], progression);
  for (let step = 0; step < 150 && !intro.state.finished; step++) {
    if (intro.nextMessage()) intro.deliver();
    else if (intro.advance()) continue;
    else if (intro.choices.length) intro.choose(intro.choices[0].id);
    else if (intro.activeTransfer) progression.finishTransfer(intro.activeTransfer.key);
  }
  assert.ok(intro.state.finished);
  progression.complete('pixelgirl-hello');
  return { progression, storage };
}
function receiver(progression) {
  return new ReplayReactions(progression, definitions, config);
}
function drain(reactions, now = 1000) {
  reactions.flush(now);
  for (let step = 0; step < 100; step++) {
    const due = reactions.progression.data.dialogues[dialogue.id]?.receiveDueAt;
    if (!Number.isFinite(due)) return now;
    now = Math.max(now, due);
    reactions.flush(now);
  }
  assert.fail('message loop');
}

test('Smiley completion unlocks the next event once; defeats and abandoned games do not', () => {
  const { progression } = setup();
  let completed;
  registerMiniGame('story-test', (definition, manager, sounds, onComplete) => {
    completed = onComplete;
    return { definition, element: { isConnected: true }, open() {} };
  });
  let victories = 0;
  const launcher = new MiniGameLauncher(
    { 'smiley-catcher': { id: 'smiley-catcher', engine: 'story-test' } },
    progression,
    {},
    { unlock() {} },
    undefined,
    undefined,
    () => victories++,
  );
  const file = Object.values(progression.data.files).find(
    (item) => item.launch?.game === 'smiley-catcher',
  );
  launcher.open(file);
  assert.equal(progression.current.id, 'super-mega-game');
  assert.equal(
    receiver(progression)
      .thread.getEvents()
      .some((event) => event.id === dialogue.id),
    false,
  );
  completed({ won: false, score: 0 });
  assert.equal(progression.current.id, 'super-mega-game');
  assert.equal(victories, 0);
  completed({ score: 150 });
  assert.equal(progression.current.id, 'pixelgirl-smiley-win');
  assert.equal(victories, 1);
  completed({ score: 999 });
  assert.equal(victories, 1);
  assert.equal(progression.data.results['super-mega-game'].score, 150);
  const reactions = receiver(progression);
  const before = reactions.thread.state.history.length;
  drain(reactions);
  assert.deepEqual(
    reactions.thread.state.history.slice(before).map((entry) => entry.text),
    ['AAAAAA', 'ALOOOOORS ???', "t'as survécu à l'attaque des smileys ????"],
  );
  assert.equal(reactions.thread.availableResponses[0].choices.length, 3);
});

test('all eight sequences, all 31 branches, joins and ten choices survive restarted receivers', () => {
  validateDialogue(dialogue);
  const covered = new Set();
  for (let route = 0; route < 4; route++) {
    let { progression, storage } = setup();
    progression.complete('super-mega-game', { score: 250 });
    let reactions = receiver(progression),
      now = 1000,
      questions = 0;
    const initial = reactions.thread.state.history.map((entry) => entry.key);
    while (!progression.data.dialogues[dialogue.id]?.finished) {
      now = drain(reactions, now);
      if (progression.data.dialogues[dialogue.id].finished) break;
      const groups = reactions.thread.availableResponses;
      assert.equal(groups.length, 1);
      assert.equal(groups[0].definition.id, dialogue.id);
      const choice = groups[0].choices[route % groups[0].choices.length];
      covered.add(choice.id);
      questions++;
      const session = new DialogueSession(dialogue, progression);
      session.choose(choice.id);
      reactions.thread.sync();
      reactions.thread.schedule(dialogue, now);
      assert.ok(reactions.thread.isReceiving(dialogue.id));
      const savedHistory = structuredClone(reactions.thread.state.history);
      progression = new Progression(story, storage);
      reactions = receiver(progression);
      assert.deepEqual(reactions.thread.state.history, savedHistory);
      assert.ok(questions <= 10);
    }
    assert.equal(questions, 10);
    assert.equal(reactions.thread.pendingResponses.length, 0);
    const history = reactions.thread.state.history;
    assert.deepEqual(
      history.slice(0, initial.length).map((entry) => entry.key),
      initial,
    );
    assert.equal(new Set(history.map((entry) => entry.key)).size, history.length);
    assert.equal(history.at(-1).text, 'bon jreviens :3');
    const state = progression.data.dialogues[dialogue.id];
    assert.equal(state.transcript.filter((message) => message.speaker === 'player').length, 10);
    assert.equal(
      Object.keys(progression.data.choiceOffers).filter((key) => key.startsWith(dialogue.id))
        .length,
      10,
    );
    assert.ok(
      [':D', ':|', '>:)', 'pourquoi tu me poses cette question MDR'].includes(
        progression.data.flags.pixelgirlSmiley,
      ),
    );
    assert.ok(progression.data.flags.pixelgirlDrawingReaction);
    assert.ok(progression.data.flags.pixelgirlMeetingReaction);
    const connected = [];
    const effects = new DialogueEvents(progression, definitions, (id) => connected.push(id));
    effects.update(now);
    assert.equal(progression.current, null);
    assert.deepEqual(connected, []);
    assert.equal(reactions.thread.activeDefinition.contact.status, 'En ligne');
    assert.equal(reactions.thread.activeDefinition.completion.stayOnline, true);
    effects.update(now + 2199);
    assert.deepEqual(connected, []);
    const resumed = new Progression(story, storage);
    const effectsAfterRestart = new DialogueEvents(resumed, definitions, (id) =>
      connected.push(id),
    );
    effectsAfterRestart.update(now + 2200, false);
    assert.deepEqual(connected, []);
    effectsAfterRestart.update(now + 2200);
    effectsAfterRestart.update(now + 5000);
    assert.deepEqual(connected, ['turbo']);
    assert.ok(
      visibleContacts(
        definitions,
        resumed.data.unlockedConversations,
        undefined,
        resumed.data.contactConnections,
      ).some((contact) => contact.id === 'turbo' && contact.online),
    );
    const after = new Progression(story, storage);
    new DialogueEvents(after, definitions, (id) => connected.push(id)).update(now + 6000);
    assert.deepEqual(connected, ['turbo']);
    assert.equal(after.current, null);
    assert.equal(receiver(after).thread.state.history.length, history.length);
  }
  assert.equal(covered.size, 31);
});

test('typing pulse, silent pause and slower final sections use saved timing without fake messages', () => {
  const { progression } = setup();
  progression.complete('super-mega-game');
  const session = new DialogueSession(dialogue, progression);
  session.state.node = 's3';
  session.state.cursor = 1;
  session.persist();
  const reactions = receiver(progression);
  reactions.thread.schedule(dialogue, 1000);
  const historyLength = reactions.thread.state.history.length;
  assert.equal(reactions.thread.typingContact(1349), null);
  assert.equal(reactions.thread.typingContact(1350).nickname, 'xX_PixelGirl_Xx');
  assert.equal(reactions.thread.typingContact(2000), null);
  reactions.flush(4299);
  assert.equal(reactions.thread.state.history.length, historyLength);
  reactions.flush(4300);
  assert.equal(reactions.thread.state.history.at(-1).text, 'bon');
  assert.ok(
    dialogue.nodes.s7.messages.every(
      (message) => message.delayMs > dialogue.nodes.s1.messages[0].delayMs,
    ),
  );
});

test('legacy completed Smiley saves resume only the appended conversation, preserving messages and results', () => {
  const { progression, storage } = setup();
  progression.complete('super-mega-game', { score: 120 });
  progression.data.current = null;
  progression.data.unlockedConversations = ['pixelgirl-intro'];
  progression.save();
  const before = structuredClone(progression.data);
  const restored = new Progression(story, storage);
  assert.equal(restored.current.id, 'pixelgirl-smiley-win');
  assert.deepEqual(restored.data.results, before.results);
  assert.deepEqual(restored.data.dialogues, before.dialogues);
  assert.deepEqual(restored.data.choices, before.choices);
  drain(receiver(restored));
  assert.equal(restored.data.dialogues[dialogue.id].cursor, 3);
  assert.equal(restored.data.dialogues['pixelgirl-intro'].finished, true);
});

test('a level-one replay does not hide the later question or change PixelGirl final presence', () => {
  const { progression } = setup();
  progression.complete('super-mega-game');
  const reactions = receiver(progression);
  drain(reactions, 1000);
  const offered = structuredClone(reactions.thread.availableResponses[0].choices);
  reactions.launch(10000);
  reactions.flush(20000);
  assert.deepEqual(reactions.thread.availableResponses[0].choices, offered);
  assert.equal(reactions.thread.availableResponses[0].definition.id, dialogue.id);
  const session = new DialogueSession(dialogue, progression);
  session.state.node = 's8-common-1';
  session.state.cursor = 1;
  session.state.finished = true;
  session.persist();
  assert.equal(reactions.thread.activeDefinition.id, dialogue.id);
});

test('corrupt optional connection metadata preserves the rest of the saved run', () => {
  const { progression, storage } = setup();
  progression.data.contactConnections = { turbo: { status: 'pending', dueAt: 'invalid' } };
  progression.save();
  const restored = new Progression(story, storage);
  assert.equal(restored.corrupt, undefined);
  assert.deepEqual(restored.data.contactConnections, {});
  assert.deepEqual(restored.data.choices, progression.data.choices);
  assert.deepEqual(restored.data.dialogues, progression.data.dialogues);
});
