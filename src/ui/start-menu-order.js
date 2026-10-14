export function resolveStartMenuOrder(saved, available) {
  const known = new Set(available);
  return [...new Set([...(Array.isArray(saved) ? saved : []), ...available])].filter((id) =>
    known.has(id),
  );
}

// Reuse the original buttons and their listeners, leaving fixed entries in their slots.
export class StartMenuOrder {
  constructor(menu, settings) {
    Object.assign(this, { menu, settings });
    this.buttons = [
      ...menu.querySelectorAll(
        ':scope > [data-start-app], :scope > [data-system-app], :scope > #menu-messenger',
      ),
    ];
    this.buttons.forEach((button) => {
      button.dataset.startApp ??= button.dataset.systemApp ?? button.id;
    });
    this.render(
      resolveStartMenuOrder(
        settings.data.startMenuOrder,
        this.buttons.map((b) => b.dataset.startApp),
      ),
    );
    menu.addEventListener('pointerdown', (event) => {
      this.suppressClick = false;
      const button = event.target.closest('[data-start-app]');
      if (event.button !== 0 || !this.buttons.includes(button)) return;
      this.drag = {
        button,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        original: this.order(),
      };
    });
    document.addEventListener('pointermove', (event) => this.move(event));
    document.addEventListener('pointerup', (event) => {
      if (event.pointerId !== this.drag?.pointerId) return;
      if (this.drag.active) settings.update({ startMenuOrder: this.order() });
      this.finish();
    });
    document.addEventListener('pointercancel', (event) => {
      if (event.pointerId === this.drag?.pointerId) this.cancel();
    });
    menu.addEventListener('lostpointercapture', (event) => {
      if (event.target === menu && event.pointerId === this.drag?.pointerId) this.cancel();
    });
    globalThis.addEventListener?.('blur', () => this.cancel());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.cancel();
    });
    menu.addEventListener(
      'click',
      (event) => {
        if (!this.suppressClick || event.detail === 0) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        this.suppressClick = false;
      },
      true,
    );
    menu.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.drag?.active) {
        event.preventDefault();
        event.stopPropagation();
        this.cancel();
      }
    });
  }
  order() {
    return [...this.menu.children]
      .filter((b) => this.buttons.includes(b))
      .map((b) => b.dataset.startApp);
  }
  reset() {
    this.cancel();
    this.suppressClick = false;
    this.render(this.buttons.map((button) => button.dataset.startApp));
  }
  render(order) {
    const slots = [...this.menu.children]
      .filter((b) => this.buttons.includes(b))
      .map((button) => {
        const slot = document.createComment('application');
        button.replaceWith(slot);
        return slot;
      });
    order.forEach((id, index) =>
      slots[index].replaceWith(this.buttons.find((b) => b.dataset.startApp === id)),
    );
  }
  move(event) {
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    // A missed release outside the app must never turn later hovering into reordering.
    if (event.buttons !== undefined && !(event.buttons & 1)) return this.cancel();
    if (this.menu.hidden) return this.cancel();
    if (!drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
    if (!drag.active) {
      drag.active = true;
      this.menu.setPointerCapture(event.pointerId);
      const rect = drag.button.getBoundingClientRect();
      drag.offsetY = drag.y - rect.top;
      drag.ghost = drag.button.cloneNode(true);
      for (const attribute of ['id', 'data-start-app', 'data-system-app'])
        drag.ghost.removeAttribute(attribute);
      drag.ghost.className = 'start-menu-drag-preview';
      drag.ghost.setAttribute('aria-hidden', 'true');
      drag.ghost.tabIndex = -1;
      drag.button.classList.add('start-menu-reordering');
      this.menu.append(drag.ghost);
    }
    event.preventDefault();
    const rect = this.menu.getBoundingClientRect();
    drag.ghost.style.top = `${event.clientY - rect.top - drag.offsetY}px`;
    const others = [...this.menu.children].filter(
      (b) => this.buttons.includes(b) && b !== drag.button,
    );
    const index = others.filter((b) => {
      const r = b.getBoundingClientRect();
      return event.clientY > r.top + r.height / 2;
    }).length;
    const order = others.map((b) => b.dataset.startApp);
    order.splice(index, 0, drag.button.dataset.startApp);
    if (order.join('|') !== this.order().join('|')) this.render(order);
  }
  finish() {
    if (!this.drag) return;
    const { button, ghost, active, pointerId } = this.drag;
    this.drag = null;
    if (active) {
      this.suppressClick = true;
      button.classList.remove('start-menu-reordering');
      ghost.remove();
      if (this.menu.hasPointerCapture(pointerId)) this.menu.releasePointerCapture(pointerId);
    }
  }
  cancel() {
    if (this.drag?.active) this.render(this.drag.original);
    this.finish();
  }
}
