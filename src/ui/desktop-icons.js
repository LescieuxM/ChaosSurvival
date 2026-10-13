const WIDTH = 120;
const HEIGHT = 104;
const MARGIN = 20;
const validCell = (cell) =>
  cell &&
  Number.isInteger(cell.col) &&
  Number.isInteger(cell.row) &&
  cell.col >= 0 &&
  cell.row >= 0;
const same = (a, b) => a?.col === b?.col && a?.row === b?.row;

export function iconGrid(width, height, taskbarHeight = 40) {
  return {
    cols: Math.max(1, Math.floor((width - MARGIN * 2) / WIDTH)),
    rows: Math.max(1, Math.floor((height - taskbarHeight - MARGIN * 2) / HEIGHT)),
  };
}
export function nearestIconCell(x, y, grid) {
  return {
    col: Math.max(0, Math.min(grid.cols - 1, Math.round((x - MARGIN) / WIDTH))),
    row: Math.max(0, Math.min(grid.rows - 1, Math.round((y - MARGIN) / HEIGHT))),
  };
}
export function layoutIconCells(ids, saved, grid) {
  const cells = [];
  for (let col = 0; col < grid.cols; col++)
    for (let row = 0; row < grid.rows; row++) cells.push({ col, row });
  const result = new Map();
  const free = (cell) => ![...result.values()].some((used) => same(used, cell));
  // Reserve existing custom positions before assigning newly unlocked icons.
  for (const id of ids.filter((id) => Object.hasOwn(saved, id) && validCell(saved[id]))) {
    const desired = {
      col: Math.min(saved[id].col, grid.cols - 1),
      row: Math.min(saved[id].row, grid.rows - 1),
    };
    const cell = free(desired)
      ? desired
      : [...cells]
          .sort(
            (a, b) =>
              Math.abs(a.col - desired.col) +
              Math.abs(a.row - desired.row) -
              Math.abs(b.col - desired.col) -
              Math.abs(b.row - desired.row),
          )
          .find(free);
    if (cell) result.set(id, cell);
  }
  for (const id of ids)
    if (!result.has(id)) {
      const cell = cells.find(free);
      if (cell) result.set(id, cell);
    }
  return result;
}

export class DesktopIcons {
  constructor(desktop, progression) {
    this.desktop = desktop;
    this.progression = progression;
    desktop.classList.add('icon-grid');
    desktop.addEventListener('dragstart', (event) => {
      if (this.button(event.target)) event.preventDefault();
    });
    desktop.addEventListener('pointerdown', (event) => this.down(event));
    desktop.addEventListener('pointermove', (event) => this.move(event));
    desktop.addEventListener('pointerup', (event) => this.up(event));
    desktop.addEventListener('pointercancel', () => this.cancel());
    desktop.addEventListener('lostpointercapture', () => this.cancel());
    for (const type of ['click', 'dblclick'])
      desktop.addEventListener(
        type,
        (event) => {
          const button = this.button(event.target);
          if (button && button === this.suppressClick) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
          }
          if (type === 'click' && button) this.select(button);
        },
        true,
      );
    this.observer = new ResizeObserver(() => this.refresh());
    this.observer.observe(desktop);
    this.refresh();
  }
  button(target) {
    const button = target.closest('[data-shortcut], [data-file-id]');
    return button?.closest('.desktop-icons, .desktop-files') ? button : null;
  }
  id(button) {
    return button.dataset.fileId
      ? `file:${button.dataset.fileId}`
      : `shortcut:${button.dataset.shortcut}`;
  }
  buttons() {
    return [...this.desktop.querySelectorAll('.desktop-icons button, .desktop-files button')];
  }
  select(button) {
    for (const item of this.buttons()) item.setAttribute('aria-pressed', String(item === button));
  }
  refresh() {
    this.cancel();
    const saved = this.progression.data.desktopIcons;
    this.saved = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    const buttons = this.buttons();
    const rect = this.desktop.getBoundingClientRect();
    this.grid = iconGrid(
      rect.width,
      rect.height,
      this.desktop.querySelector('.taskbar').getBoundingClientRect().height,
    );
    this.cells = layoutIconCells(
      buttons.map((button) => this.id(button)),
      this.saved,
      this.grid,
    );
    let changed = false;
    for (const button of buttons) {
      const id = this.id(button),
        cell = this.cells.get(id);
      button.style.visibility = cell ? '' : 'hidden';
      if (!cell) continue;
      button.style.left = `${MARGIN + cell.col * WIDTH}px`;
      button.style.top = `${MARGIN + cell.row * HEIGHT}px`;
      if (!validCell(this.saved[id])) {
        this.saved[id] = { ...cell };
        changed = true;
      }
    }
    if (changed && this.progression.hasSave) this.persist();
  }
  persist() {
    this.progression.data.desktopIcons = this.saved;
    this.progression.save();
  }
  down(event) {
    this.suppressClick = null;
    if (
      event.button !== 0 ||
      !this.desktop.classList.contains('story-desktop') ||
      this.desktop.inert
    )
      return;
    const button = this.button(event.target);
    if (!button) return;
    this.select(button);
    this.drag = {
      button,
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    button.setPointerCapture(event.pointerId);
  }
  move(event) {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointer) return;
    const dx = event.clientX - drag.x,
      dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    event.preventDefault();
    const rect = this.desktop.getBoundingClientRect();
    const left = parseFloat(drag.button.style.left),
      top = parseFloat(drag.button.style.top);
    const bottom = this.desktop.querySelector('.taskbar').getBoundingClientRect().top - rect.top;
    const x = Math.max(0, Math.min(rect.width - drag.button.offsetWidth, left + dx));
    const y = Math.max(0, Math.min(bottom - drag.button.offsetHeight, top + dy));
    drag.button.style.transform = `translate(${x - left}px, ${y - top}px)`;
    drag.button.classList.add('is-dragging');
  }
  up(event) {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointer) return;
    if (drag.moved) {
      this.suppressClick = drag.button;
      const rect = this.desktop.getBoundingClientRect();
      const desired = nearestIconCell(
        parseFloat(drag.button.style.left) + event.clientX - drag.x,
        parseFloat(drag.button.style.top) + event.clientY - drag.y,
        this.grid,
      );
      const id = this.id(drag.button);
      if (![...this.cells].some(([other, cell]) => other !== id && same(cell, desired))) {
        this.saved[id] = desired;
        this.persist();
      }
    }
    this.cancel();
    this.refresh();
  }
  cancel() {
    const drag = this.drag;
    this.drag = null;
    if (!drag) return;
    drag.button.style.transform = '';
    drag.button.classList.remove('is-dragging');
    if (drag.button.hasPointerCapture(drag.pointer))
      drag.button.releasePointerCapture(drag.pointer);
  }
}
