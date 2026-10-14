export function reconcileTaskOrder(order, ids) {
  const available = new Set(ids);
  return [...new Set([...order, ...ids])].filter((id) => available.has(id));
}

// Session-only order of open window IDs. Existing task buttons keep their launch handlers.
export class TaskbarOrder {
  constructor(bar) {
    this.bar = bar;
    this.order = [];
    this.refresh();
    this.observer = new MutationObserver(() => this.refresh());
    this.observer.observe(bar, { childList: true });
    bar.addEventListener('pointerdown', (event) => {
      this.suppressClick = false;
      const button = event.target.closest('button.task-tab[data-window-id]');
      if (event.button !== 0 || !this.buttons().includes(button)) return;
      this.drag = {
        button,
        id: button.dataset.windowId,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        original: [...this.order],
      };
    });
    document.addEventListener('pointermove', (event) => this.move(event));
    document.addEventListener('pointerup', (event) => {
      if (event.pointerId === this.drag?.pointerId) this.finish();
    });
    document.addEventListener('pointercancel', () => this.cancel());
    bar.addEventListener('lostpointercapture', () => this.cancel());
    bar.addEventListener(
      'click',
      (event) => {
        if (!this.suppressClick || event.detail === 0) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        this.suppressClick = false;
      },
      true,
    );
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.drag?.active) {
        event.preventDefault();
        this.cancel();
      }
    });
  }
  buttons() {
    return [...this.bar.children].filter((button) =>
      button.matches('button.task-tab[data-window-id]'),
    );
  }
  reset() {
    this.cancel();
    this.suppressClick = false;
    this.order = [];
    this.refresh();
  }
  refresh() {
    const ids = this.buttons().map((button) => button.dataset.windowId);
    if (this.drag && !ids.includes(this.drag.id)) this.cancel();
    this.order = reconcileTaskOrder(this.order, ids);
    if (ids.join('|') !== this.order.join('|')) this.render();
  }
  render() {
    const buttons = this.buttons();
    const slots = buttons.map((button) => {
      const slot = document.createComment('task');
      button.replaceWith(slot);
      return slot;
    });
    this.order.forEach((id, index) =>
      slots[index].replaceWith(buttons.find((button) => button.dataset.windowId === id)),
    );
  }
  move(event) {
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.button.isConnected) return this.cancel();
    if (!drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
    if (!drag.active) {
      drag.active = true;
      this.bar.setPointerCapture(event.pointerId);
      const rect = drag.button.getBoundingClientRect();
      drag.offsetX = drag.x - rect.left;
      drag.ghost = drag.button.cloneNode(true);
      for (const attr of ['id', 'data-app', 'data-window-id']) drag.ghost.removeAttribute(attr);
      drag.ghost.className = 'task-tab taskbar-drag-preview';
      drag.ghost.setAttribute('aria-hidden', 'true');
      drag.ghost.tabIndex = -1;
      drag.ghost.style.width = `${rect.width}px`;
      drag.button.classList.add('taskbar-reordering');
      this.bar.append(drag.ghost);
    }
    event.preventDefault();
    const others = this.buttons().filter((button) => button !== drag.button);
    const index = others.filter((button) => {
      const r = button.getBoundingClientRect();
      return event.clientX > r.left + r.width / 2;
    }).length;
    const order = others.map((button) => button.dataset.windowId);
    order.splice(index, 0, drag.id);
    this.order = order;
    const ids = this.buttons().map((button) => button.dataset.windowId);
    if (ids.join('|') !== order.join('|')) this.render();
    const surface = this.bar.getBoundingClientRect();
    const first = this.buttons()[0]?.getBoundingClientRect();
    const last = this.buttons().at(-1)?.getBoundingClientRect();
    drag.ghost.style.left = `${Math.max(first.left, Math.min(last.right - drag.ghost.offsetWidth, event.clientX - drag.offsetX)) - surface.left}px`;
  }
  finish() {
    if (!this.drag) return;
    const { button, ghost, active, pointerId } = this.drag;
    this.drag = null;
    if (active) {
      this.suppressClick = true;
      button.classList.remove('taskbar-reordering');
      ghost.remove();
      if (this.bar.hasPointerCapture(pointerId)) this.bar.releasePointerCapture(pointerId);
    }
  }
  cancel() {
    if (this.drag?.active) {
      this.order = reconcileTaskOrder(
        this.drag.original,
        this.buttons().map((button) => button.dataset.windowId),
      );
      this.render();
    }
    this.finish();
  }
}
