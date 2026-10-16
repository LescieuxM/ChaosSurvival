import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NotificationCenter,
  STANDARD_MESSAGE_NOTIFICATION_DURATION_MS,
} from '../src/ui/notifications.js';

class Element {
  constructor() {
    this.hidden = true;
    this.dataset = {};
    this.attributes = {};
    this.listeners = new Map();
    this.classList = {
      values: new Set(),
      add: (...values) => values.forEach((value) => this.classList.values.add(value)),
      remove: (...values) => values.forEach((value) => this.classList.values.delete(value)),
      contains: (value) => this.classList.values.has(value),
    };
  }
  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }
  setAttribute(name, value) {
    this.attributes[name] = value;
  }
  dispatch(type, event) {
    this.listeners.get(type)?.(event);
  }
}

function setup() {
  let now = 0;
  const root = new Element();
  const contact = {};
  const message = {};
  const dismissButton = new Element();
  const center = new NotificationCenter({
    root,
    contact,
    message,
    dismissButton,
    getTime: () => now,
  });
  return {
    center,
    root,
    contact,
    message,
    setTime(value) {
      now = value;
    },
  };
}

test('queues important notifications until the exit animation finishes', () => {
  const view = setup();
  let firstClosed = null;
  let secondAction = 0;
  view.center.show({
    id: 'connection:turbo',
    type: 'connection',
    contact: 'Turb0',
    message: ' vient de se connecter',
    durationMs: 3300,
    onDismiss: (reason) => (firstClosed = reason),
  });
  view.center.show({
    id: 'message:turbo',
    type: 'message',
    contact: 'Turb0',
    message: ' vous a envoy\u00e9 un message',
    action: () => secondAction++,
  });

  assert.equal(view.root.hidden, false);
  assert.equal(view.contact.textContent, 'Turb0');
  assert.equal(view.center.current.id, 'connection:turbo');
  view.setTime(3299);
  view.center.update();
  assert.equal(view.root.classList.contains('is-dismissing'), false);
  view.setTime(3300);
  view.center.update();
  assert.equal(view.root.classList.contains('is-dismissing'), true);
  assert.equal(view.center.current.id, 'connection:turbo');
  view.setTime(3479);
  view.center.update();
  assert.equal(view.center.current.id, 'connection:turbo');
  view.setTime(3480);
  view.center.update();
  assert.equal(firstClosed, 'timeout');
  assert.equal(view.center.current.id, 'message:turbo');
  assert.equal(view.message.textContent, ' vous a envoy\u00e9 un message');
  assert.equal(view.root.hidden, false);

  view.root.dispatch('click', { target: { closest: () => null } });
  assert.equal(secondAction, 1);
  assert.equal(view.root.classList.contains('is-dismissing'), true);
});

test('the first Turb0 message notification expires on real time after the standard six-second duration', () => {
  const view = setup();
  view.center.show({
    id: 'turbo-smiley-scene3-message',
    type: 'message',
    contactId: 'turbo',
    contact: 'Turb0',
    message: ' vous a envoyé un message',
    durationMs: STANDARD_MESSAGE_NOTIFICATION_DURATION_MS,
    clock: 'real',
  });
  view.setTime(STANDARD_MESSAGE_NOTIFICATION_DURATION_MS - 1);
  view.center.update();
  assert.equal(view.center.current.id, 'turbo-smiley-scene3-message');
  view.setTime(STANDARD_MESSAGE_NOTIFICATION_DURATION_MS);
  view.center.update();
  assert.equal(view.root.classList.contains('is-dismissing'), true);
  view.setTime(STANDARD_MESSAGE_NOTIFICATION_DURATION_MS + 180);
  view.center.update();
  assert.equal(view.center.current, null);
});

test('opening and cancelling notifications handles their IDs while preserving other contacts', () => {
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
  assert.equal(view.center.queue.at(-1).id, 'message:luna:new');
});

test('cancels queued messages for a contact after the conversation is read', () => {
  const view = setup();
  view.center.show({ id: 'connection:luna', type: 'connection', contactId: 'luna' });
  view.center.show({ id: 'luna:message:1', type: 'message', contactId: 'luna' });
  view.center.show({ id: 'luna:message:2', type: 'message', contactId: 'luna' });

  view.center.cancelContact('luna', 'message');

  assert.deepEqual(view.center.queue, []);
  assert.equal(view.center.current.id, 'connection:luna');
  assert.equal(view.center.has('luna:message:1'), false);
  assert.equal(view.center.has('luna:message:2'), false);
  assert.equal(view.center.show({ id: 'luna:message:1', type: 'message', contactId: 'luna' }), false);
});

test('a dismissed notification id is treated as handled while a new message id remains available', () => {
  const view = setup();
  let activated = 0;
  assert.equal(
    view.center.show({ id: 'connection:turbo', type: 'connection', action: () => activated++ }),
    true,
  );

  view.center.dismissButton.dispatch('click', {
    stopPropagation() {},
  });
  view.setTime(180);
  view.center.update();
  assert.equal(view.root.hidden, true);
  assert.equal(view.center.show({ id: 'connection:turbo', type: 'connection' }), false);
  assert.equal(activated, 0);

  assert.equal(view.center.show({ id: 'message:turbo:mdrrrr', type: 'message' }), true);
  assert.equal(view.center.current.id, 'message:turbo:mdrrrr');
});

test('delayed notifications wait for their real-time deadline before taking the queue', () => {
  const view = setup();
  view.center.show({
    id: 'pixelgirl:message',
    type: 'message',
    contactId: 'pixelgirl',
    contact: 'PixelGirl',
    message: ' a envoyé un nouveau message.',
    delayMs: 500,
    delayClock: 'real',
  });

  assert.equal(view.root.hidden, true);
  view.setTime(499);
  view.center.update();
  assert.equal(view.root.hidden, true);
  view.setTime(500);
  view.center.update();
  assert.equal(view.root.hidden, false);
  assert.equal(view.center.current.id, 'pixelgirl:message');
});

test('gameplay notifications replace one another but cannot replace story notifications', () => {
  const view = setup();
  view.center.show({ id: 'game:1', type: 'gameplay', policy: 'replace', priority: 'transient' });
  view.center.show({ id: 'game:2', type: 'gameplay', policy: 'replace', priority: 'transient' });
  assert.equal(view.center.current.id, 'game:1');
  assert.equal(view.center.queue[0].id, 'game:2');

  view.center.clear();
  view.center.show({ id: 'important', type: 'connection', priority: 'important' });
  assert.equal(
    view.center.show({ id: 'game:3', type: 'gameplay', policy: 'replace', priority: 'transient' }),
    false,
  );
  assert.equal(view.center.current.id, 'important');
});
