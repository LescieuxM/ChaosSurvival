export const HOTEL_URL = 'http://www.hoplahotel.fr/';
export const VIEW_WIDTH = 400;
export const VIEW_HEIGHT = 300;
const HALF_WIDTH = 16;
const HALF_HEIGHT = 8;

// Screen geometry is confined here; paths and collisions use integer cells.
export function project(x, y, room) {
  return {
    x: VIEW_WIDTH / 2 + (x - y + (room.height - room.width) / 2) * HALF_WIDTH,
    y: 90 + (x + y) * HALF_HEIGHT,
  };
}
export function screenCell(x, y, room) {
  const a = (x - VIEW_WIDTH / 2) / HALF_WIDTH - (room.height - room.width) / 2;
  const b = (y - 90) / HALF_HEIGHT;
  const cell = [Math.round((a + b) / 2) + 0, Math.round((b - a) / 2) + 0];
  return inside(room, cell) ? cell : null;
}
export function inside(room, cell) {
  return (
    Array.isArray(cell) &&
    cell.length === 2 &&
    cell.every(Number.isInteger) &&
    cell[0] >= 0 &&
    cell[1] >= 0 &&
    cell[0] < room.width &&
    cell[1] < room.height
  );
}
export function furnitureCells(item) {
  const [width, height] = item.size ?? [1, 1];
  const cells = [];
  for (let x = 0; x < width; x++)
    for (let y = 0; y < height; y++) cells.push([item.position[0] + x, item.position[1] + y]);
  return cells;
}
const key = (cell) => cell.join(':');
export function blockedCells(room) {
  return new Set(
    [
      ...(room.blocked ?? []),
      ...room.furniture.filter((item) => item.blocking).flatMap(furnitureCells),
      ...room.npcs.filter((item) => item.blocking).map((item) => item.position),
    ].map(key),
  );
}
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
export function findPath(room, from, to) {
  const blocked = blockedCells(room);
  if (!inside(room, from) || !inside(room, to) || blocked.has(key(to)) || blocked.has(key(from)))
    return null;
  const queue = [from],
    visited = new Map([[key(from), null]]);
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    if (same(current, to)) {
      const result = [];
      for (let cell = current; visited.get(key(cell)) !== null; cell = visited.get(key(cell)))
        result.push(cell);
      return result.reverse();
    }
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ]) {
      const next = [current[0] + dx, current[1] + dy];
      if (!inside(room, next) || blocked.has(key(next)) || visited.has(key(next))) continue;
      visited.set(key(next), current);
      queue.push(next);
    }
  }
  return null;
}

export class RoomWalk {
  constructor(room) {
    this.room = room;
    this.cell = [...room.spawn];
    this.position = [...room.spawn];
    this.path = [];
    this.direction = 'south';
    this.step = null;
    this.elapsed = 0;
  }
  get moving() {
    return Boolean(this.step || this.path.length);
  }
  moveTo(target) {
    // Finish the current edge before taking the new path, avoiding corner cutting.
    const path = findPath(this.room, this.step?.to ?? this.cell, target);
    if (!path) return false;
    this.path = path;
    return true;
  }
  update(delta) {
    if (!Number.isFinite(delta) || delta <= 0) return;
    let remaining = Math.min(delta, 100);
    this.elapsed += remaining;
    while (remaining > 0) {
      if (!this.step) {
        if (!this.path.length) break;
        const to = this.path.shift();
        const [dx, dy] = [to[0] - this.cell[0], to[1] - this.cell[1]];
        this.direction = dx > 0 ? 'east' : dx < 0 ? 'west' : dy > 0 ? 'south' : 'north';
        this.step = { from: [...this.cell], to, elapsed: 0 };
      }
      const step = this.step;
      const used = Math.min(remaining, 240 - step.elapsed);
      step.elapsed += used;
      remaining -= used;
      const fraction = step.elapsed / 240;
      this.position = step.from.map((value, axis) => value + (step.to[axis] - value) * fraction);
      if (step.elapsed >= 240) {
        this.cell = [...step.to];
        this.position = [...step.to];
        this.step = null;
      }
    }
  }
}
