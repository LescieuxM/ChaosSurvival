import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NotificationCenter,
  NOTIFICATION_DURATION_MS,
  EXIT_ANIMATION_MS,
} from '../src/ui/notifications.js';

class Element {
  constructor() {
    this.hidden = true;
    this.dataset = {};
    this.attributes = {};
    this.listeners = new Map();
    this.children = [];
    this.textContent = '';
    this.offsetWidth = 0;
    this.classList = {
      values: new Set(),
      add: (...values) => values.forEach((value) => this.classList.values.add(value)),
      remove: (...values) => values.forEach((value) => this.classList.values.delete(value)),
      contains: (value) => this.classList.values.has(value),
    };
  }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  setAttribute(name, value) { this.attributes[name] = value; }
  dispatch(type, event) { this.listeners.get(type)?.(event); }
  append(child) { this.children.push(child); child.parentElement = this; }
  remove() {
    if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
  }
  querySelector(selector) { return this.parts?.[selector] ?? null; }
}

function makeMessageCard() {
  const card = new Element();
  card.parts = {
    '.toast-contact': new Element(),
    '.toast-message': new Element(),
    '.toast-dismiss': new Element(),
  };
  return card;
}

function setup() {
  let now = 0;
  const root = new Element();
  const contact = {};
  const message = {};
  const dismissButton = new Element();
  const messageRoot = new Element();
  const center = new NotificationCenter({
    root, contact, message, dismissButton, messageRoot,
    createMessageCard: makeMessageCard,
    getTime: () => now,
  });
  return {
    center, root, contact, message, messageRoot,
    setTime(value) { now = value; },
  };
}

test('legacy important notifications keep their queue and dismissal behavior', () => {
  const view = setup();
  let firstClosed = null;
  let secondAction = 0;
  view.center.show({ id: 'connection:turbo', type: 'connection', contact: 'Turb0', message: ' vient de se connecter', durationMs: 3300, onDismiss: (reason) => firstClosed = reason });
  view.center.show({ id: 'message:turbo', type: 'message', contact: 'Turb0', message: ' vous a envoyé un message', action: () => secondAction++ });
  assert.equal(view.center.current.id, 'connection:turbo');
  view.setTime(3300);
  view.center.update();
  view.setTime(3480);
  view.center.update();
  assert.equal(firstClosed, 'timeout');
  assert.equal(view.center.current.id, 'message:turbo');
  view.root.dispatch('click', { target: { closest: () => null } });
  assert.equal(secondAction, 1);
});

test('legacy message IDs can be cancelled without affecting other contacts', () => {
  const view = setup();
  view.center.show({ id: 'message:luna:old', type: 'message', contactId: 'luna' });
  view.center.show({ id: 'message:luna:queued', type: 'message', contactId: 'luna' });
  view.center.show({ id: 'message:turbo:new', type: 'message', contactId: 'turbo' });
  view.center.cancelContact('luna', 'message');
  view.setTime(180);
  view.center.update();
  assert.equal(view.center.current.id, 'message:turbo:new');
  assert.equal(view.center.show({ id: 'message:luna:old', type: 'message', contactId: 'luna' }), false);
  assert.equal(view.center.show({ id: 'message:luna:queued', type: 'message', contactId: 'luna' }), false);
  assert.equal(view.center.show({ id: 'message:luna:new', type: 'message', contactId: 'luna' }), true);
});

test('legacy cancellation removes queued messages but leaves connection notices intact', () => {
  const view = setup();
  view.center.show({ id: 'connection:luna', type: 'connection', contactId: 'luna' });
  view.center.show({ id: 'luna:message:1', type: 'message', contactId: 'luna' });
  view.center.show({ id: 'luna:message:2', type: 'message', contactId: 'luna' });
  view.center.cancelContact('luna', 'message');
  assert.deepEqual(view.center.queue, []);
  assert.equal(view.center.current.id, 'connection:luna');
  assert.equal(view.center.has('luna:message:1'), false);
  assert.equal(view.center.has('luna:message:2'), false);
});

test('dismissed legacy IDs stay handled and do not activate their action', () => {
  const view = setup();
  let activated = 0;
  view.center.show({ id: 'connection:turbo', type: 'connection', action: () => activated++ });
  view.center.dismissButton.dispatch('click', { stopPropagation() {} });
  view.setTime(180);
  view.center.update();
  assert.equal(view.center.root.hidden, true);
  assert.equal(view.center.show({ id: 'connection:turbo', type: 'connection' }), false);
  assert.equal(activated, 0);
  assert.equal(view.center.show({ id: 'message:turbo:mdrrrr', type: 'message' }), true);
});

test('delayed legacy notifications wait for their real-time deadline', () => {
  const view = setup();
  view.center.show({ id: 'pixelgirl:message', type: 'message', contactId: 'pixelgirl', delayMs: 500, delayClock: 'real' });
  assert.equal(view.root.hidden, true);
  view.setTime(499);
  view.center.update();
  assert.equal(view.root.hidden, true);
  view.setTime(500);
  view.center.update();
  assert.equal(view.root.hidden, false);
});

test('gameplay notices replace one another but cannot replace story notices', () => {
  const view = setup();
  view.center.show({ id: 'game:1', type: 'gameplay', policy: 'replace', priority: 'transient' });
  view.center.show({ id: 'game:2', type: 'gameplay', policy: 'replace', priority: 'transient' });
  assert.equal(view.center.current.id, 'game:1');
  assert.equal(view.center.queue[0].id, 'game:2');
  view.center.clear();
  view.center.show({ id: 'important', type: 'connection', priority: 'important' });
  assert.equal(view.center.show({ id: 'game:3', type: 'gameplay', policy: 'replace', priority: 'transient' }), false);
});

test('a sender card updates in place, replays sound, and resets its three-second timer', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const view = setup();
  let sounds = 0;
  const notification = {
    conversationId: 'turbo-private', senderId: 'turbo', sender: 'Turb0',
    preview: 'mdrrrr noob', playSound: () => sounds++,
  };
  assert.equal(view.center.showMessage(notification), true);
  const card = view.messageRoot.children[0];
  t.mock.timers.tick(1000);
  assert.equal(view.center.showMessage({ ...notification, preview: 'bah ouais mdr' }), 'updated');
  assert.equal(view.messageRoot.children.length, 1);
  assert.equal(card.parts['.toast-message'].textContent, 'bah ouais mdr');
  assert.equal(card.classList.contains('toast-refresh'), true);
  assert.equal(sounds, 2);
  t.mock.timers.tick(NOTIFICATION_DURATION_MS - 1);
  assert.equal(card.classList.contains('is-dismissing'), false);
  t.mock.timers.tick(1);
  assert.equal(card.classList.contains('is-dismissing'), true);
  assert.equal(view.center.showMessage({ ...notification, preview: 'arrivé pendant la sortie' }), 'updated');
  assert.equal(card.classList.contains('is-dismissing'), false);
  t.mock.timers.tick(EXIT_ANIMATION_MS);
  assert.equal(view.center.messages.size, 1, 'the expired timer cannot remove the refreshed card');
  t.mock.timers.tick(NOTIFICATION_DURATION_MS - EXIT_ANIMATION_MS - 1);
  assert.equal(card.classList.contains('is-dismissing'), false);
  t.mock.timers.tick(1);
  assert.equal(card.classList.contains('is-dismissing'), true);
  t.mock.timers.tick(EXIT_ANIMATION_MS);
  assert.equal(view.center.messages.size, 0);
  assert.equal(view.messageRoot.hidden, true);
});

test('message notifications stack independently by conversation and sender, with only two visible', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const view = setup();
  const show = (conversationId, senderId, sender) => view.center.showMessage({ conversationId, senderId, sender, preview: 'nouveau message' });
  show('group', 'pixelgirl', 'PixelGirl');
  show('group', 'turbo', 'Turb0');
  show('private-luna', 'luna', 'Luna');
  assert.equal(view.center.messages.size, 3);
  assert.equal(view.messageRoot.children.length, 2);
  assert.equal(view.center.messages.get('private-luna:luna').visible, false);

  view.center.messages.get('group:turbo').card.dispatch('click', { target: { closest: () => null } });
  assert.equal(view.center.messages.size, 1);
  assert.equal(view.center.messages.has('private-luna:luna'), true);
  assert.equal(view.center.messages.get('private-luna:luna').visible, true);
  t.mock.timers.tick(NOTIFICATION_DURATION_MS);
  assert.equal(view.center.messages.get('private-luna:luna').card.classList.contains('is-dismissing'), true);
});

test('third notification waits in FIFO order and starts its full timer when promoted', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const view = setup();
  let sounds = 0;
  const show = (senderId) => view.center.showMessage({
    conversationId: 'group', senderId, sender: senderId, preview: senderId, playSound: () => sounds++,
  });
  show('pixelgirl');
  t.mock.timers.tick(500);
  show('turbo');
  t.mock.timers.tick(500);
  show('luna');
  show('other');
  const queued = view.center.messages.get('group:luna');
  assert.equal(view.messageRoot.children.length, 2);
  assert.deepEqual(view.center.messageQueue.map((item) => item.key), ['group:luna', 'group:other']);

  t.mock.timers.tick(NOTIFICATION_DURATION_MS - 1000);
  assert.equal(view.center.messages.get('group:pixelgirl').card.classList.contains('is-dismissing'), true);
  t.mock.timers.tick(EXIT_ANIMATION_MS);
  assert.equal(queued.visible, true);
  assert.equal(view.messageRoot.children.length, 2);
  assert.deepEqual(view.center.messageQueue.map((item) => item.key), ['group:other']);
  t.mock.timers.tick(500);
  assert.equal(view.center.messages.get('group:turbo').card.classList.contains('is-dismissing'), true);
  t.mock.timers.tick(EXIT_ANIMATION_MS);
  assert.equal(view.center.messages.get('group:other').visible, true);
  assert.deepEqual(view.center.messageQueue, []);
  assert.equal(sounds, 4, 'promotion does not replay message sounds');
  t.mock.timers.tick(2319);
  assert.equal(queued.card.classList.contains('is-dismissing'), false);
  t.mock.timers.tick(1);
  assert.equal(queued.card.classList.contains('is-dismissing'), true);
});

test('same sender updates its queued card without changing queue position or replaying a timer early', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const view = setup();
  let sounds = 0;
  const show = (senderId, preview) => view.center.showMessage({
    conversationId: 'group', senderId, sender: senderId, preview, playSound: () => sounds++,
  });
  show('pixelgirl', 'un');
  show('turbo', 'deux');
  show('luna', 'ancien');
  t.mock.timers.tick(1000);
  assert.equal(show('luna', 'actualisé'), 'updated');
  const queued = view.center.messageQueue[0];
  assert.equal(queued.key, 'group:luna');
  assert.equal(queued.preview.textContent, 'actualisé');
  assert.equal(queued.visible, false);
  assert.equal(sounds, 4);

  t.mock.timers.tick(NOTIFICATION_DURATION_MS - 1000);
  t.mock.timers.tick(EXIT_ANIMATION_MS);
  assert.equal(queued.visible, true);
  t.mock.timers.tick(NOTIFICATION_DURATION_MS - 1);
  assert.equal(queued.card.classList.contains('is-dismissing'), false);
});

test('legacy notices and message cards share the two visible notification slots', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const view = setup();
  view.center.showMessage({ conversationId: 'private-a', senderId: 'a', sender: 'A', preview: 'a' });
  view.center.showMessage({ conversationId: 'private-b', senderId: 'b', sender: 'B', preview: 'b' });
  view.center.show({ id: 'connection:c', type: 'connection', contactId: 'c' });
  assert.equal(view.center.current, null);
  assert.equal(view.messageRoot.children.length, 2);

  t.mock.timers.tick(NOTIFICATION_DURATION_MS);
  t.mock.timers.tick(EXIT_ANIMATION_MS);
  assert.equal(view.center.current?.id, 'connection:c');
  assert.equal(view.center.visibleCount(), 1);
});

test('dismissing one sender card leaves the other group notifications visible', () => {
  const view = setup();
  view.center.showMessage({ conversationId: 'group', senderId: 'luna', sender: 'Luna', preview: 'salut' });
  view.center.showMessage({ conversationId: 'group', senderId: 'turbo', sender: 'Turb0', preview: '???' });
  view.center.messages.get('group:luna').closeButton.dispatch('click', { stopPropagation() {} });
  assert.equal(view.center.messages.has('group:luna'), false);
  assert.equal(view.center.messages.has('group:turbo'), true);
  view.center.clear();
  assert.equal(view.center.messages.size, 0);
  assert.equal(view.messageRoot.hidden, true);
});

test('opening a conversation clears its sender notices while preserving other conversations', () => {
  const view = setup();
  let opened = 0;
  view.center.showMessage({ conversationId: 'group', senderId: 'luna', sender: 'Luna', preview: 'salut', action: () => opened++ });
  view.center.showMessage({ conversationId: 'group', senderId: 'turbo', sender: 'Turb0', preview: '???' });
  view.center.showMessage({ conversationId: 'group', senderId: 'pixelgirl', sender: 'PixelGirl', preview: 'bonjour' });
  view.center.showMessage({ conversationId: 'private-pixel', senderId: 'pixel', sender: 'PixelGirl', preview: 'coucou' });
  view.center.messages.get('group:luna').card.dispatch('click', { target: { closest: () => null } });
  assert.equal(opened, 1);
  assert.equal(view.center.messages.size, 1);
  assert.equal(view.center.messages.has('private-pixel:pixel'), true);
  assert.equal(view.center.messageQueue.length, 0);
  assert.equal(view.messageRoot.children.length, 1);
});

test('the same sender gets separate cards in private and group conversations', () => {
  const view = setup();
  view.center.showMessage({ conversationId: 'private', senderId: 'turbo', sender: 'Turb0', preview: 'salut' });
  view.center.showMessage({ conversationId: 'group', senderId: 'turbo', sender: 'Turb0', preview: '???' });
  assert.equal(view.center.messages.size, 2);
  assert.equal(view.center.messages.get('private:turbo').preview.textContent, 'salut');
  assert.equal(view.center.messages.get('group:turbo').preview.textContent, '???');
});

test('message notification lifetime is three seconds', () => {
  assert.equal(NOTIFICATION_DURATION_MS, 3000);
});
