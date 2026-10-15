export const ARENA_WIDTH = 600,
  ARENA_HEIGHT = 300,
  PLAYER_SIZE = 14,
  ENEMY_SIZE = 24;
export const MAX_ENEMIES = 8;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
// Swept point against a rectangle expanded by the player's size.
function crosses(from, to, enemy) {
  const minX = enemy.x - PLAYER_SIZE,
    maxX = enemy.x + ENEMY_SIZE;
  const minY = enemy.y - PLAYER_SIZE,
    maxY = enemy.y + ENEMY_SIZE;
  let entry = 0,
    exit = 1;
  for (const [start, end, min, max] of [
    [from.x, to.x, minX, maxX],
    [from.y, to.y, minY, maxY],
  ]) {
    const delta = end - start;
    if (!delta) {
      if (start < min || start > max) return false;
      continue;
    }
    const a = (min - start) / delta,
      b = (max - start) / delta;
    entry = Math.max(entry, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
    if (entry > exit) return false;
  }
  return true;
}
export class SquaresRound {
  constructor(random = Math.random) {
    this.random = random;
    this.active = false;
  }
  start(now) {
    this.active = true;
    this.last = now;
    this.elapsed = 0;
    this.player = { x: 293, y: 143 };
    this.enemies = [];
    this.nextEnemy = 8000;
    this.serial = 0;
    this.addEnemy();
    this.addEnemy();
  }
  move(x, y) {
    if (!this.active || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const next = {
      x: clamp(x - PLAYER_SIZE / 2, 0, ARENA_WIDTH - PLAYER_SIZE),
      y: clamp(y - PLAYER_SIZE / 2, 0, ARENA_HEIGHT - PLAYER_SIZE),
    };
    if (this.elapsed >= 750 && this.enemies.some((enemy) => crosses(this.player, next, enemy)))
      this.active = false;
    this.player = next;
  }
  addEnemy() {
    if (this.enemies.length >= MAX_ENEMIES) return;
    const corners = [
      { x: 12, y: 12 },
      { x: 564, y: 264 },
      { x: 564, y: 12 },
      { x: 12, y: 264 },
    ];
    const candidates = corners.filter(
      (p) => Math.hypot(p.x - this.player.x, p.y - this.player.y) > 100,
    );
    const pos = candidates[Math.floor(this.random() * candidates.length)];
    const angle = (this.random() * 0.6 + 0.2) * Math.PI;
    const speed = 55 + this.random() * 15;
    this.enemies.push({
      id: ++this.serial,
      ...pos,
      vx: Math.cos(angle) * speed * (pos.x > 300 ? -1 : 1),
      vy: Math.sin(angle) * speed * (pos.y > 150 ? -1 : 1),
    });
  }
  tick(now) {
    if (!this.active) return;
    const delta = Math.max(0, now - this.last);
    this.last = now;
    // A suspended renderer must not kill the player through invisible catch-up movement.
    if (delta > 250) return;
    let remaining = delta;
    while (remaining > 0 && this.active) {
      const step = Math.min(10, remaining);
      remaining -= step;
      this.elapsed += step;
      const multiplier = Math.min(2.2, 1 + (this.elapsed / 1000) * 0.015);
      for (const enemy of this.enemies) {
        const old = { x: enemy.x, y: enemy.y };
        enemy.x += (enemy.vx * multiplier * step) / 1000;
        enemy.y += (enemy.vy * multiplier * step) / 1000;
        if (enemy.x < 0 || enemy.x > ARENA_WIDTH - ENEMY_SIZE) {
          enemy.x = clamp(enemy.x, 0, ARENA_WIDTH - ENEMY_SIZE);
          enemy.vx = -enemy.vx;
        }
        if (enemy.y < 0 || enemy.y > ARENA_HEIGHT - ENEMY_SIZE) {
          enemy.y = clamp(enemy.y, 0, ARENA_HEIGHT - ENEMY_SIZE);
          enemy.vy = -enemy.vy;
        }
        const relative = {
          x: this.player.x - (enemy.x - old.x),
          y: this.player.y - (enemy.y - old.y),
        };
        if (this.elapsed >= 750 && crosses(this.player, relative, old)) {
          this.active = false;
          break;
        }
      }
      if (this.active && this.elapsed >= this.nextEnemy) {
        this.addEnemy();
        this.nextEnemy += 8000;
      }
    }
  }
  stop() {
    this.active = false;
    this.enemies = [];
  }
}
export function bestTime(progression, id) {
  const value = progression?.data.flashzoneBestTimes?.[id];
  return Number.isFinite(value) && value >= 0 ? value : 0;
}
export function saveBestTime(progression, id, time) {
  const best = bestTime(progression, id);
  if (progression && Number.isFinite(time) && time > best) {
    const saved = progression.data.flashzoneBestTimes;
    const valid = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    progression.data.flashzoneBestTimes = { ...valid, [id]: time };
    progression.save();
  }
  return Math.max(best, time);
}
