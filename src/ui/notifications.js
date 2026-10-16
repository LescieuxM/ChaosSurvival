const ENTER_ANIMATION_MS = 300;
const EXIT_ANIMATION_MS = 180;

export class NotificationCenter {
  constructor({ root, contact, message, dismissButton, getTime = () => Date.now() }) {
    Object.assign(this, { root, contact, message, dismissButton, getTime });
    this.current = null;
    this.queue = [];
    this.handled = new Set();
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
      durationMs: 6000,
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
    if (this.current || !this.queue.length) return;
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
  }

  clear({ resetHandled = false } = {}) {
    this.queue.length = 0;
    this.current = null;
    this.root.hidden = true;
    this.root.classList.remove('is-dismissing');
    delete this.root.dataset.notificationType;
    if (resetHandled) this.handled.clear();
  }
}

export { ENTER_ANIMATION_MS, EXIT_ANIMATION_MS };
