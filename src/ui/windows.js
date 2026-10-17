import { icon } from './icons.js';
import { createPopupContent } from './popup-content.js';
import { clamp } from '../utils/math.js';
import { chooseWindowPosition } from './window-placement.js';

export class WindowManager {
  constructor(field, onClose) {
    this.field = field;
    this.onClose = onClose;
    this.windows = new Map();
    this.dragged = new WeakSet();
    this.sequence = 0;
    this.z = 10;
    this.observer = new ResizeObserver(() => this.reposition());
    this.observer.observe(field);
  }
  spawn(type = 'msn', { preview = false, x, y, openedAt, content, onDismiss } = {}) {
    const id = ++this.sequence;
    const element = document.createElement('article');
    element.className = `xp-window popup popup-${type}${preview ? ' preview-window' : ''}`;
    element.dataset.windowId = id;
    const { title, body, iconName } = content ?? createPopupContent(type);
    element.innerHTML = /* HTML */ `<header class="titlebar">
        <span class="window-title">${icon(iconName)}<span>${title}</span></span
        ><button class="close-button" aria-label="Fermer ${title}">×</button>
      </header>
      <div class="window-body">${body}</div>`;
    element.style.zIndex = ++this.z;
    this.field.append(element);
    const { width, height } = this.field.getBoundingClientRect();
    const maxX = Math.max(0, width - element.offsetWidth);
    const maxY = Math.max(0, height - element.offsetHeight);
    const occupied = [...this.windows.values()].map(({ element: item }) => ({
      x: item.offsetLeft,
      y: item.offsetTop,
      width: item.offsetWidth,
      height: item.offsetHeight,
    }));
    const position = chooseWindowPosition(
      width,
      height,
      element.offsetWidth,
      element.offsetHeight,
      occupied,
      id,
    );
    element.style.left = `${x === undefined ? position.x : clamp(x * maxX, 0, maxX)}px`;
    element.style.top = `${y === undefined ? position.y : clamp(y * maxY, 0, maxY)}px`;
    this.windows.set(id, { element, preview, openedAt, onDismiss });
    element.querySelectorAll('.close-button, [data-dismiss]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        this.close(id, event.clientX, event.clientY);
      });
    });
    element.addEventListener('pointerdown', () => {
      element.style.zIndex = ++this.z;
    });
    this.enableDrag(element);
    return id;
  }
  close(id, x, y) {
    const item = this.windows.get(id);
    if (!item || this.field.inert) return;
    if (item.beforeClose?.() === false) return;
    this.windows.delete(id);
    item.element.remove();
    item.onDismiss?.({ reason: 'close' });
    this.onClose({ preview: item.preview, openedAt: item.openedAt, x, y });
  }
  activeWindow() {
    let active = null;
    for (const item of this.windows.values()) {
      if (!item.element.isConnected || item.element.hidden) continue;
      if (!active || Number(item.element.style.zIndex) > Number(active.style.zIndex))
        active = item.element;
    }
    return active;
  }
  isActive(element) {
    return Boolean(element?.isConnected && !element.hidden && this.activeWindow() === element);
  }
  clear() {
    for (const { element, onDismiss } of this.windows.values()) {
      element.remove();
      onDismiss?.({ reason: 'clear' });
    }
    this.windows.clear();
  }
  reposition() {
    const occupied = [];
    for (const [id, { element, preview }] of this.windows) {
      const bounds = this.movementBounds(element);
      const position =
        preview || this.dragged.has(element)
          ? {
              x: clamp(parseFloat(element.style.left) || 0, bounds.minX, bounds.maxX),
              y: clamp(parseFloat(element.style.top) || 0, bounds.minY, bounds.maxY),
            }
          : chooseWindowPosition(
              this.field.clientWidth,
              this.field.clientHeight,
              element.offsetWidth,
              element.offsetHeight,
              occupied,
              id,
            );
      element.style.left = `${position.x}px`;
      element.style.top = `${position.y}px`;
      occupied.push({ ...position, width: element.offsetWidth, height: element.offsetHeight });
    }
  }
  movementBounds(element) {
    // Keep spawn coordinates in the playfield, but drag across the actual desktop.
    // Negative local coordinates reach the space above the arcade's playfield.
    const field = this.field.getBoundingClientRect();
    const desktop = this.field.closest('.desktop');
    const surface = desktop?.getBoundingClientRect() ?? field;
    const bottom =
      desktop?.querySelector('.taskbar')?.getBoundingClientRect().top ?? surface.bottom;
    const minX = surface.left - field.left;
    const minY = surface.top - field.top;
    return {
      minX,
      minY,
      maxX: Math.max(minX, surface.right - field.left - element.offsetWidth),
      maxY: Math.max(minY, bottom - field.top - element.offsetHeight),
    };
  }
  enableDrag(element) {
    const bar = element.querySelector('.titlebar');
    let drag = null;
    bar.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('button')) return;
      drag = {
        x: event.clientX,
        y: event.clientY,
        left: element.offsetLeft,
        top: element.offsetTop,
      };
      bar.setPointerCapture(event.pointerId);
    });
    bar.addEventListener('pointermove', (event) => {
      if (!drag) return;
      const bounds = this.movementBounds(element);
      this.dragged.add(element);
      element.style.left = `${clamp(drag.left + event.clientX - drag.x, bounds.minX, bounds.maxX)}px`;
      element.style.top = `${clamp(drag.top + event.clientY - drag.y, bounds.minY, bounds.maxY)}px`;
    });
    const endDrag = () => {
      drag = null;
    };
    bar.addEventListener('pointerup', endDrag);
    bar.addEventListener('pointercancel', endDrag);
    bar.addEventListener('lostpointercapture', endDrag);
  }
}
