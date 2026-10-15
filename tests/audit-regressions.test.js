import test from 'node:test';
import assert from 'node:assert/strict';
import { Progression } from '../src/story/progression.js';
import { ConversationThread } from '../src/story/conversation-thread.js';
import { matches } from '../src/story/dialogue.js';
import { Messenger } from '../src/ui/messenger.js';

const story = {
  version: 1,
  start: 'chat',
  sequences: [{ id: 'chat', type: 'conversation', dialogue: 'intro', next: null }],
};
function savedRun() {
  let bytes;
  const storage = {
    getItem: () => bytes ?? null,
    setItem: (_key, value) => {
      bytes = value;
    },
  };
  const progression = new Progression(story, storage);
  progression.begin();
  return { progression, storage };
}

test('damaged unread metadata does not erase valid saved conversation history', () => {
  for (const unread of [undefined, null, 'bad', [null]]) {
    const { progression, storage } = savedRun();
    const history = [
      { key: 'wizz:1', speaker: 'player', type: 'wizz', text: 'JustMe vous a envoyé un wizz !' },
    ];
    progression.data.conversations.friend = { version: 1, history, unread };
    progression.save();
    const restored = new Progression(story, storage);
    assert.equal(
      Messenger.prototype.unreadCount.call({ progression: restored }, { id: 'friend' }),
      0,
    );
    const thread = new ConversationThread('friend', restored, () => []);
    assert.deepEqual(thread.state.history, history);
    assert.deepEqual(thread.state.unread, []);
    assert.equal(restored.hasSave, true);
  }
});

test('invalid unselected-choice metadata remains inert without losing the saved choice', () => {
  for (const unselected of ['bad', {}, [null], [42], undefined]) {
    const { progression, storage } = savedRun();
    progression.data.choices.push({
      key: 'intro:reply',
      dialogue: 'intro',
      node: 'reply',
      choice: 'yes',
      unselected,
    });
    progression.save();
    const restored = new Progression(story, storage);
    const query = { dialogue: 'intro', node: 'reply', id: 'no', selected: false };
    assert.equal(matches({ choice: query }, {}, restored.data.choices), false);
    assert.equal(
      matches({ choice: { ...query, id: 'yes', selected: true } }, {}, restored.data.choices),
      true,
    );
    assert.equal(restored.data.choices.length, 1);
  }
});
