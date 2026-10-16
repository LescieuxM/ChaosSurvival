const ENTER_ANIMATION_MS = 300;
const EXIT_ANIMATION_MS = 180;
export const NOTIFICATION_DURATION_MS = 3000;
export const MAX_VISIBLE_NOTIFICATIONS = 2;
const STANDARD_NOTIFICATION_DURATION_MS = 6000;

export class NotificationCenter {
  constructor({
    root,
    contact,
    message,
    dismissButton,
    messageRoot,
    messageTemplate,
    createMessageCard,
    getTime = () => Date.now(),
  }) {
    Object.assign(this, {
      root,
      contact,
      message,
      dismissButton,
      messageRoot,
      messageTemplate,
      createMessageCard,
      getTime,
    });
    this.current = null;
    this.queue = [];
    this.handled = new Set();
    this.messages = new Map();
    this.messageQueue = [];
    this.root.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;
      this.activate();
    });
    this.root.addEventListener('keydown', (event) => {
      if (!['Enter', ' '].includes(event.key) || event.target.closest('button')) return;
      event.preventDefault();
      this.activate();
    });
    this.dismissButton.addEventListener('click', (event) => {
      event.stopPropagation();
      this.dismiss('dismissed');
    });
  }

  has(id) {
    return this.current?.id === id || this.queue.some((item) => item.id === id);
  }

  show(notification) {
    if (
      !notification ||
      typeof notification.id !== 'string' ||
      this.handled.has(notification.id) ||
      this.has(notification.id)
    )
      return false;
    const item = {
      type: 'story',
      clock: 'real',
      durationMs: STANDARD_NOTIFICATION_DURATION_MS,
      policy: 'queue',
      priority: 'important',
      ...notification,
    };
    if (Number.isFinite(item.delayMs) && item.delayMs > 0) {
      item.delayClock ??= item.clock;
      item.availableAt = this.getTime(item.delayClock) + item.delayMs;
    }
    if (item.policy === 'replace') {
      this.queue = this.queue.filter((queued) => queued.policy !== 'replace');
      if (
        !this.current &&
        this.queue.some((queued) => queued.priority === 'important')
      )
        return false;
      if (this.current) {
        if (this.current.priority === 'important') return false;
        this.queue.unshift(item);
        this.dismiss('replaced');
        return true;
      }
    }
    this.queue.push(item);
    this.presentNext();
    return true;
  }

  presentNext() {
    if (this.current || !this.queue.length || this.visibleCount() >= MAX_VISIBLE_NOTIFICATIONS) {
      this.presentQueuedMessages();
      return;
    }
    if (
      this.queue[0].availableAt >
      this.getTime(this.queue[0].delayClock ?? this.queue[0].clock)
    )
      return;
    const item = this.queue.shift();
    item.shownAt = this.getTime(item.clock);
    item.expiresAt = item.shownAt + item.durationMs;
    item.dismissingAt = null;
    this.current = item;
    this.root.hidden = false;
    this.root.classList.remove('is-dismissing');
    this.root.dataset.notificationType = item.type;
    this.contact.textContent = item.contact ?? '';
    this.message.textContent = item.message ?? '';
    this.root.setAttribute('aria-label', `${item.contact ?? ''}${item.message ?? ''}`.trim());
    item.onShow?.();
    this.presentQueuedMessages();
  }

  visibleCount() {
    return Number(Boolean(this.current)) + [...this.messages.values()].filter((item) => item.visible).length;
  }

  presentQueuedMessages() {
    if (!this.messageRoot) return;
    while (this.visibleCount() < MAX_VISIBLE_NOTIFICATIONS && this.messageQueue.length) {
      const item = this.messageQueue.shift();
      if (this.messages.get(item.key) !== item) continue;
      this.showMessageCard(item);
    }
  }

  showMessageCard(item) {
    item.visible = true;
    this.messageRoot.hidden = false;
    item.card.classList.remove('is-dismissing', 'toast-refresh');
    this.messageRoot.append(item.card);
    this.startMessageTimer(item);
  }

  startMessageTimer(item) {
    clearTimeout(item.timer);
    clearTimeout(item.removalTimer);
    item.removalTimer = null;
    const generation = ++item.generation;
    item.timer = setTimeout(() => {
      if (this.messages.get(item.key) !== item || item.generation !== generation) return;
      item.card.classList.add('is-dismissing');
      item.removalTimer = setTimeout(() => {
        if (this.messages.get(item.key) === item && item.generation === generation)
          this.removeMessage(item);
      }, EXIT_ANIMATION_MS);
    }, item.durationMs);
  }

  update() {
    const item = this.current;
    if (!item) return this.presentNext();
    const now = this.getTime(item.dismissingAt === null ? item.clock : 'animation');
    if (item.dismissingAt !== null) {
      if (now >= item.dismissingAt) this.finishDismissal(item);
    } else if (now >= item.expiresAt) {
      this.dismiss('timeout');
    }
  }

  activate() {
    const item = this.current;
    if (!item || item.dismissingAt !== null) return;
    item.action?.();
    this.dismiss('action');
  }

  dismiss(reason = 'dismissed') {
    const item = this.current;
    if (!item || item.dismissingAt !== null) return false;
    item.dismissReason = reason;
    item.dismissingAt = this.getTime('animation') + EXIT_ANIMATION_MS;
    this.root.classList.add('is-dismissing');
    return true;
  }

  finishDismissal(item) {
    if (this.current !== item) return;
    const dismissedAt = this.getTime(item.clock);
    this.current = null;
    this.root.hidden = true;
    this.root.classList.remove('is-dismissing');
    if (item.dismissReason !== 'replaced') this.handled.add(item.id);
    item.onDismiss?.(item.dismissReason, {
      shownAt: item.shownAt,
      expiresAt: item.expiresAt,
      dismissedAt,
    });
    this.presentQueuedMessages();
    this.presentNext();
  }

  cancel(id) {
    const queuedIndex = this.queue.findIndex((item) => item.id === id);
    if (queuedIndex >= 0) {
      this.queue.splice(queuedIndex, 1);
      this.handled.add(id);
      return true;
    }
    if (this.current?.id === id) return this.dismiss('cancelled');
    return false;
  }

  cancelContact(contactId, type = null) {
    const kept = [];
    for (const item of this.queue) {
      if (item.contactId === contactId && (!type || item.type === type)) this.handled.add(item.id);
      else kept.push(item);
    }
    this.queue = kept;
    if (
      this.current?.contactId === contactId &&
      (!type || this.current.type === type)
    )
      this.dismiss('cancelled');
    if (!type || type === 'message') this.dismissMessagesForConversation(contactId);
  }

  clear({ resetHandled = false } = {}) {
    this.queue.length = 0;
    this.current = null;
    this.root.hidden = true;
    this.root.classList.remove('is-dismissing');
    delete this.root.dataset.notificationType;
    if (resetHandled) this.handled.clear();
    this.clearMessages();
  }

  showMessage({
    conversationId,
    senderId,
    sender,
    preview,
    action,
    playSound = () => {},
    durationMs = NOTIFICATION_DURATION_MS,
  }) {
    if (!conversationId || !senderId || !this.messageRoot || (!this.createMessageCard && !this.messageTemplate))
      return false;
    const key = `${conversationId}:${senderId}`;
    let item = this.messages.get(key);
    const isUpdate = Boolean(item);
    if (!item) {
      const card = this.createMessageCard?.() ?? this.messageTemplate.content.firstElementChild.cloneNode(true);
      item = {
        key,
        conversationId,
        senderId,
        card,
        generation: 0,
        timer: null,
        removalTimer: null,
        visible: false,
      };
      item.contact = card.querySelector('.toast-contact');
      item.preview = card.querySelector('.toast-message');
      item.closeButton = card.querySelector('.toast-dismiss');
      card.addEventListener('click', (event) => {
        if (event.target.closest('button')) return;
        item.action?.();
        this.dismissMessagesForConversation(item.conversationId);
      });
      card.addEventListener('keydown', (event) => {
        if (!['Enter', ' '].includes(event.key) || event.target.closest('button')) return;
        event.preventDefault();
        item.action?.();
        this.dismissMessagesForConversation(item.conversationId);
      });
      item.closeButton.addEventListener('click', (event) => {
        event.stopPropagation();
        this.removeMessage(item);
      });
      this.messages.set(key, item);
      this.messageQueue.push(item);
    }
    item.sender = sender;
    item.previewText = preview;
    item.durationMs = durationMs;
    item.action = action;
    item.contact.textContent = sender;
    item.preview.textContent = preview;
    item.card.setAttribute('aria-label', `${sender}: ${preview}`);
    item.card.dataset.notificationKey = key;
    if (item.visible) {
      item.card.classList.remove('is-dismissing', 'toast-refresh');
      void item.card.offsetWidth;
      item.card.classList.add('toast-refresh');
      this.startMessageTimer(item);
    } else {
      this.presentNext();
      this.presentQueuedMessages();
    }
    playSound();
    return isUpdate ? 'updated' : true;
  }

  removeMessage(item) {
    if (!item || this.messages.get(item.key) !== item) return false;
    clearTimeout(item.timer);
    clearTimeout(item.removalTimer);
    item.generation++;
    item.visible = false;
    item.card.remove();
    this.messages.delete(item.key);
    this.messageQueue = this.messageQueue.filter((queued) => queued !== item);
    this.messageRoot.hidden = ![...this.messages.values()].some((message) => message.visible);
    this.presentNext();
    this.presentQueuedMessages();
    return true;
  }

  dismissMessagesForConversation(conversationId) {
    for (const item of [...this.messages.values()])
      if (item.conversationId === conversationId) this.removeMessage(item);
  }

  cancelMessage(key) {
    return this.removeMessage(this.messages.get(key));
  }

  clearMessages() {
    for (const item of this.messages.values()) {
      clearTimeout(item.timer);
      clearTimeout(item.removalTimer);
      item.card.remove();
      item.generation++;
      item.visible = false;
    }
    this.messages.clear();
    this.messageQueue.length = 0;
    if (this.messageRoot) this.messageRoot.hidden = true;
  }
}

export { ENTER_ANIMATION_MS, EXIT_ANIMATION_MS };
