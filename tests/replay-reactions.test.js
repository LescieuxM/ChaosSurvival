import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { ReplayReactions } from '../src/story/replays.js';
import { Progression } from '../src/story/progression.js';
import { DialogueSession } from '../src/story/dialogue.js';
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
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
function setup() {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const progression = new Progression(story, storage);
  progression.begin();
  return { storage, progression, reactions: new ReplayReactions(progression, definitions, config) };
}
function meet(progression) {
  progression.complete('arcade-1');
  const session = new DialogueSession(definitions['pixelgirl-intro'], progression);
  session.deliver();
}
test('attempts are counted immediately, including abandonments, without reactions before the first meeting', () => {
  const { progression, reactions } = setup();
  reactions.launch(0);
  reactions.launch(1000);
  assert.equal(progression.data.level1Launches, 2);
  assert.deepEqual(reactions.flush(10000), []);
  meet(progression);
  reactions.launch(11000);
  assert.deepEqual(reactions.flush(15999), []);
  const incoming = reactions.flush(16000);
  assert.equal(incoming.length, 1);
  assert.equal(progression.data.replayReactions[0].template, config.first);
  assert.deepEqual(reactions.flush(99999), []);
  const saved = progression.data.dialogues[incoming[0].id];
  assert.equal(saved.transcript.length, 3);
  assert.equal(saved.transcript[0].text, 'et bah !!!');
  assert.equal(progression.data.choiceOffers[`${incoming[0].id}:hello`].length, 3);
  assert.equal(progression.current.id, 'pixelgirl-hello');
});
test('closed Messenger, app relaunch and delayed answers preserve incoming messages and every proposed answer', () => {
  const { storage, progression, reactions } = setup();
  reactions.launch(0);
  meet(progression);
  reactions.launch(1000);
  const reopened = new Progression(story, storage);
  const restored = new ReplayReactions(reopened, definitions, config);
  assert.equal(reopened.data.level1Launches, 2);
  const [incoming] = restored.flush(7000);
  const session = new DialogueSession(incoming, reopened);
  session.choose('replay-music');
  while (session.nextMessage()) session.deliver();
  session.advance();
  assert.equal(session.state.finished, true);
  assert.equal(reopened.data.choices.at(-1).unselected.length, 2);
  assert.ok(session.state.transcript.at(-1).text.includes('reste dans la tête'));
  assert.equal(reopened.current.id, 'pixelgirl-hello');
  assert.deepEqual(
    new ReplayReactions(new Progression(story, storage), definitions, config).flush(8000),
    [],
  );
});
test('later reactions rotate through all variants and NEW GAME resets only the active counter', () => {
  const { storage, progression, reactions } = setup();
  reactions.launch(0);
  meet(progression);
  for (let index = 0; index < 8; index++) {
    reactions.launch(index * 6000);
    reactions.flush(index * 6000 + 5000);
  }
  const variants = progression.data.replayReactions.slice(1).map((event) => event.template);
  for (let index = 1; index < variants.length; index++)
    assert.notEqual(variants[index], variants[index - 1]);
  assert.equal(new Set(variants).size, config.variants.length);
  progression.newGame();
  assert.equal(progression.data.level1Launches, 0);
  assert.deepEqual(progression.data.replayReactions, []);
  const history = JSON.parse(storage.getItem('chaos-survival-history-v1'));
  assert.equal(history.runs[0].level1Launches, 9);
  assert.equal(history.runs[0].replayReactions.length, 8);
  reactions.launch(100000);
  assert.equal(progression.data.level1Launches, 1);
  assert.deepEqual(reactions.flush(106000), []);
});

test('all replay response branches finish independently of the original narrative', () => {
  for (const [choice, lastMessage] of [
    ['replay-olympics', "médaille d'or du clic gauche"],
    ['replay-music', "j'avoue elle reste dans la tête :3"],
    ['replay-score', 'bon courage alors xD'],
  ]) {
    const { progression, reactions } = setup();
    reactions.launch(0);
    meet(progression);
    reactions.launch(1000);
    const [definition] = reactions.flush(6000);
    const session = new DialogueSession(definition, progression);
    session.choose(choice);
    while (session.nextMessage()) session.deliver();
    session.advance();
    assert.equal(session.state.finished, true);
    assert.equal(session.state.transcript.at(-1).text, lastMessage);
    assert.equal(progression.data.choices.at(-1).offered.length, 3);
    assert.equal(progression.data.choices.at(-1).unselected.length, 2);
    assert.equal(progression.current.id, 'pixelgirl-hello');
  }
});
