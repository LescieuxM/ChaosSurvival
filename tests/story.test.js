import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Progression, validateStory } from '../src/story/progression.js';
import { DialogueSession, validateDialogue, matches } from '../src/story/dialogue.js';
const story = JSON.parse(readFileSync(new URL('../src/config/story.json', import.meta.url)));
const dialogue = JSON.parse(
  readFileSync(new URL('../src/dialogues/pixelgirl-intro.json', import.meta.url)),
);
const memory = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
};
function drain(session) {
  for (let i = 0; i < 150; i++) {
    if (session.nextMessage()) {
      session.deliver();
      continue;
    }
    if (!session.advance()) return;
  }
  assert.fail('automatic loop');
}
function setup(storage = memory()) {
  const progression = new Progression(story, storage);
  progression.complete('arcade-1');
  return { storage, progression, session: new DialogueSession(dialogue, progression) };
}

test('all 81 choice paths merge into the common story and deliver the same mini-game', () => {
  for (let a = 1; a <= 3; a++)
    for (let b = 1; b <= 3; b++)
      for (let c = 1; c <= 3; c++)
        for (let d = 1; d <= 3; d++) {
          const { session, progression } = setup();
          for (const id of [`greeting-${a}`, `nickname-${b}`, `table-${c}`, `game-${d}`]) {
            drain(session);
            assert.equal(session.choices.length, 3);
            session.choose(id);
          }
          drain(session);
          assert.ok(session.activeTransfer);
          progression.finishTransfer(session.activeTransfer.key);
          drain(session);
          assert.equal(session.state.finished, true);
          assert.equal(progression.data.choices.length, 4);
          assert.ok(
            progression.data.choices.every(
              (choice) => choice.offered.length === 3 && choice.unselected.length === 2,
            ),
          );
          assert.equal(
            session.state.transcript.filter((message) => message.speaker === 'player').length,
            4,
          );
          assert.ok(session.state.transcript.at(-1).text.includes('paint'));
        }
});

test('proposals are saved before selection, and the 500ms echo never enters the transcript', () => {
  const { session, progression, storage } = setup();
  drain(session);
  session.offerChoices();
  const key = 'pixelgirl-intro:first-contact';
  assert.equal(new Progression(story, storage).data.choiceOffers[key].length, 3);
  session.choose('greeting-1');
  assert.equal(session.takeEcho().durationMs, 500);
  assert.equal(session.takeEcho(), null);
  assert.equal(
    session.state.transcript.filter((message) => message.speaker === 'player').length,
    1,
  );
  assert.ok(
    !session.state.transcript.some(
      (message) => message.text === 'j?ai surtout cliqu? au hasard mdr',
    ),
  );
  assert.equal(progression.data.anomalies[key].choice, 'greeting-2');
  const resumed = new DialogueSession(dialogue, new Progression(story, storage));
  assert.equal(resumed.takeEcho(), undefined);
  assert.equal(
    matches(
      {
        choice: {
          dialogue: 'pixelgirl-intro',
          node: 'first-contact',
          id: 'greeting-2',
          selected: false,
        },
      },
      {},
      progression.data.choices,
    ),
    true,
  );
  assert.equal(
    matches(
      {
        choice: {
          dialogue: 'pixelgirl-intro',
          node: 'first-contact',
          id: 'greeting-1',
          selected: false,
        },
      },
      {},
      progression.data.choices,
    ),
    false,
  );
});

test('refusing repeatedly remains playable and accepting later unlocks the file', () => {
  const { session, progression } = setup();
  for (const id of ['greeting-2', 'nickname-2', 'table-2', 'game-2']) {
    drain(session);
    session.choose(id);
  }
  drain(session);
  for (let i = 0; i < 3; i++) {
    assert.equal(session.activeTransfer.status, 'pending');
    session.declineTransfer(session.activeTransfer.key);
    drain(session);
    assert.equal(session.state.node, 'offer-again');
  }
  assert.equal(
    Object.values(progression.data.files).filter((file) => file.status === 'complete').length,
    0,
  );
  progression.finishTransfer(session.activeTransfer.key);
  drain(session);
  assert.equal(session.state.finished, true);
  const received = Object.values(progression.data.files).filter(
    (file) => file.status === 'complete',
  );
  assert.equal(received.length, 1);
  assert.equal(received[0].name, 'SUPER_MEGA_GAME.exe');
  assert.equal(received[0].launch.game, 'smiley-catcher');
  progression.complete('pixelgirl-hello');
  assert.equal(progression.current.type, 'minigame');
  progression.complete('super-mega-game', { score: 100 });
  assert.equal(progression.current, null);
});

test('a new app session resumes partial messages, choices, offered alternatives and transfers', () => {
  const { session, progression, storage } = setup();
  session.deliver();
  let restored = new DialogueSession(dialogue, new Progression(story, storage));
  assert.equal(restored.state.cursor, 1);
  drain(restored);
  restored.choose('greeting-3');
  restored = new DialogueSession(dialogue, new Progression(story, storage));
  assert.equal(restored.state.node, 'spectator');
  assert.equal(restored.progression.data.choices[0].unselected.length, 2);
  assert.throws(() => restored.choose('greeting-3'));
});

test('old completed introductions keep their history and never replay after a JSON revision', () => {
  const storage = memory();
  storage.setItem(
    'chaos-survival-story-v1',
    JSON.stringify({
      version: 1,
      current: null,
      completed: ['arcade-1', 'pixelgirl-hello'],
      flags: { musicTaste: 'pop' },
      choices: [{ key: 'pixelgirl-intro:hello', choice: 'sparkles' }],
      dialogues: {
        'pixelgirl-intro': {
          node: 'hello',
          revision: 1,
          cursor: 3,
          finished: true,
          transcript: [{ speaker: 'contact', text: 'heyyy !!' }],
        },
      },
      results: {},
    }),
  );
  const progression = new Progression(story, storage);
  assert.equal(progression.current, null);
  const session = new DialogueSession(dialogue, progression);
  assert.equal(session.state.node, 'hello');
  assert.equal(session.state.finished, true);
  assert.equal(session.nextMessage(), null);
  assert.equal(session.state.transcript[0].text, 'heyyy !!');
  assert.equal(progression.data.choices.length, 1);
  assert.equal(progression.data.dialogueArchives['pixelgirl-intro:1'].transcript.length, 1);
});

test('invalid transitions, duplicate IDs, timers and automatic loops are rejected', () => {
  let bad = structuredClone(dialogue);
  bad.nodes['first-contact'].choices[0].next = 'constructor';
  assert.throws(() => validateDialogue(bad));
  bad = structuredClone(dialogue);
  bad.nodes['first-contact'].messages[0].delayMs = -1;
  assert.throws(() => validateDialogue(bad));
  bad = structuredClone(dialogue);
  bad.nodes.autographs.next = 'autographs';
  assert.throws(() => validateDialogue(bad));
  bad = structuredClone(dialogue);
  bad.nodes.introduction.choices[0].id = 'greeting-1';
  assert.throws(() => validateDialogue(bad));
  assert.throws(() => validateStory({ ...story, start: 'missing' }));
  const fallback = new Progression(story, {
    getItem: () => '{broken',
    setItem: () => {
      throw Error('blocked');
    },
  });
  assert.equal(fallback.current.id, 'arcade-1');
});

test('outgoing fictional files use the same transfer system without creating a received desktop item', () => {
  const custom = {
    ...dialogue,
    id: 'outgoing',
    start: 'send',
    nodes: {
      send: {
        messages: [
          {
            speaker: 'player',
            type: 'file',
            file: { id: 'photo', name: 'photo.jpg', sizeLabel: '12 Ko' },
            delayMs: 0,
            typingMs: 0,
          },
        ],
        end: true,
      },
    },
  };
  const { progression } = setup();
  const session = new DialogueSession(custom, progression);
  session.deliver();
  const file = Object.values(progression.data.files)[0];
  assert.equal(file.direction, 'send');
  progression.finishTransfer(file.key);
  assert.equal(file.status, 'complete');
});

test('PixelGirl describes the received executable with the exact requested wording', () => {
  const messages = Object.values(dialogue.nodes).flatMap((node) => node.messages);
  assert.ok(
    messages.some((message) => message.text === "j'ai un ami qui collectionne les ptits jeux nuls"),
  );
  assert.ok(!messages.some((message) => /jeux flash/i.test(message.text ?? '')));
});
