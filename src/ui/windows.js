import { icon } from './icons.js';
import { createPopupContent } from './popup-content.js';
import { clamp } from '../utils/math.js';
import { chooseWindowPosition } from './window-placement.js';

export class WindowManager {
  constructor(field, onClose) {
    this.field = field;
    this.onClose = onClose;
    this.windows = new Map();
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
    this.windows.delete(id);
    item.element.remove();
    item.onDismiss?.({ reason: 'close' });
    this.onClose({ preview: item.preview, openedAt: item.openedAt, x, y });
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
      const position = preview
        ? {
            x: clamp(
              parseFloat(element.style.left) || 0,
              0,
              this.field.clientWidth - element.offsetWidth,
            ),
            y: clamp(
              parseFloat(element.style.top) || 0,
              0,
              this.field.clientHeight - element.offsetHeight,
            ),
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
  enableDrag(element) {
    const bar = element.querySelector('.titlebar');
    let drag = null;
    bar.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button')) return;
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
      element.style.left = `${clamp(drag.left + event.clientX - drag.x, 0, this.field.clientWidth - element.offsetWidth)}px`;
      element.style.top = `${clamp(drag.top + event.clientY - drag.y, 0, this.field.clientHeight - element.offsetHeight)}px`;
    });
    const endDrag = () => {
      drag = null;
    };
    bar.addEventListener('pointerup', endDrag);
    bar.addEventListener('pointercancel', endDrag);
    bar.addEventListener('lostpointercapture', endDrag);
  }
}
