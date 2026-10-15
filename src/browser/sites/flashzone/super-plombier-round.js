export const PLUMBER_WIDTH = 640;
export const PLUMBER_HEIGHT = 360;
export const PLUMBER_GROUND = 286;
export const PLUMBER_WORLD_WIDTH = 8_500;
export const PLUMBER_START_X = 36;
export const PLUMBER_GOAL_X = 8_300;
export const PLUMBER_MAX_SPEED = 170;
export const TURBO_RECORD_MS = 12_430;
export const PLUMBER_MINIMUM_TIME_MS =
  ((PLUMBER_GOAL_X - PLUMBER_START_X - 28) / PLUMBER_MAX_SPEED) * 1000;

const PLAYER_WIDTH = 28;
const PLAYER_HEIGHT = 38;
const GRAVITY = 1250;
const JUMP_SPEED = 490;
const firstHalfGaps = [
  [640, 708],
  [1255, 1330],
  [2670, 2755],
  [3405, 3490],
];

const firstHalfPlatforms = [
  { x: 235, y: 226, w: 112, h: 18, kind: 'brick' },
  { x: 385, y: 160, w: 72, h: 18, kind: 'bonus' },
  { x: 810, y: 224, w: 128, h: 18, kind: 'brick' },
  { x: 1010, y: 188, w: 82, h: 18, kind: 'brick' },
  { x: 1430, y: 228, w: 150, h: 18, kind: 'brick' },
  { x: 1630, y: 194, w: 100, h: 18, kind: 'bonus' },
  { x: 2070, y: 216, w: 130, h: 18, kind: 'brick' },
  { x: 2250, y: 180, w: 96, h: 18, kind: 'brick' },
  { x: 2840, y: 220, w: 140, h: 18, kind: 'brick' },
  { x: 3045, y: 186, w: 90, h: 18, kind: 'bonus' },
  { x: 3580, y: 225, w: 150, h: 18, kind: 'brick' },
  { x: 3800, y: 190, w: 115, h: 18, kind: 'brick' },
];
const firstHalfPipes = [
  { x: 475, y: 234, w: 48, h: 52, kind: 'pipe' },
  { x: 905, y: 222, w: 54, h: 64, kind: 'pipe' },
  { x: 1170, y: 246, w: 48, h: 40, kind: 'pipe' },
  { x: 1775, y: 230, w: 52, h: 56, kind: 'pipe' },
  { x: 2430, y: 220, w: 58, h: 66, kind: 'pipe' },
  { x: 3230, y: 232, w: 50, h: 54, kind: 'pipe' },
  { x: 3970, y: 210, w: 60, h: 76, kind: 'pipe' },
];
const firstHalfCoins = [
  [280, 194],
  [321, 194],
  [410, 159],
  [568, 222],
  [750, 226],
  [850, 192],
  [893, 192],
  [1048, 155],
  [1208, 214],
  [1480, 194],
  [1522, 194],
  [1660, 160],
  [1835, 210],
  [2130, 182],
  [2180, 182],
  [2294, 146],
  [2525, 216],
  [2882, 188],
  [2928, 188],
  [3085, 152],
  [3335, 222],
  [3620, 193],
  [3680, 193],
  [3850, 156],
  [4110, 220],
];
const firstHalfEnemyPaths = [
  [555, 520, 620],
  [1080, 1015, 1150],
  [1510, 1435, 1580],
  [2140, 2100, 2190],
  [2320, 2220, 2390],
  [2980, 2940, 3040],
  [3140, 3060, 3200],
  [3720, 3590, 3770],
  [4050, 4000, 4140],
];
const SECOND_HALF_OFFSET = 4200;
const LEVEL_GAPS = [
  ...firstHalfGaps,
  ...firstHalfGaps.map(([start, end]) => [start + SECOND_HALF_OFFSET, end + SECOND_HALF_OFFSET]),
];
const platforms = [
  ...firstHalfPlatforms,
  ...firstHalfPlatforms.map((item) => ({ ...item, x: item.x + SECOND_HALF_OFFSET })),
];
const pipes = [
  ...firstHalfPipes,
  ...firstHalfPipes.map((item) => ({ ...item, x: item.x + SECOND_HALF_OFFSET })),
];
const coinPoints = [
  ...firstHalfCoins,
  ...firstHalfCoins.map(([x, y]) => [x + SECOND_HALF_OFFSET, y]),
].map(([x, y], id) => ({ id, x, y, collected: false }));
const enemyPaths = [
  ...firstHalfEnemyPaths,
  ...firstHalfEnemyPaths.map(([x, minX, maxX]) => [
    x + SECOND_HALF_OFFSET,
    minX + SECOND_HALF_OFFSET,
    maxX + SECOND_HALF_OFFSET,
  ]),
];
const intersects = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function makeGround() {
  const solids = [];
  let cursor = 0;
  for (const [start, end] of LEVEL_GAPS) {
    if (start > cursor) solids.push({ x: cursor, y: PLUMBER_GROUND, w: start - cursor, h: 150, kind: 'ground' });
    cursor = end;
  }
  if (cursor < PLUMBER_WORLD_WIDTH)
    solids.push({
      x: cursor,
      y: PLUMBER_GROUND,
      w: PLUMBER_WORLD_WIDTH - cursor,
      h: 150,
      kind: 'ground',
    });
  return solids;
}

export const PLUMBER_LEVEL = Object.freeze({
  gaps: LEVEL_GAPS,
  platforms,
  pipes,
  coins: coinPoints,
  enemyPaths,
  minimumHorizontalDistance: PLUMBER_GOAL_X - PLUMBER_START_X - PLAYER_WIDTH,
});

export class SuperPlombierRound {
  constructor() {
    this.solids = [...makeGround(), ...platforms, ...pipes];
    this.start(0, false);
  }
  start(now = performance.now(), active = true) {
    this.active = active;
    this.won = false;
    this.elapsed = 0;
    this.startedAt = now;
    this.last = now;
    this.pauseAt = null;
    this.deaths = this.deaths ?? 0;
    this.coins = coinPoints.map((coin) => ({ ...coin }));
    this.enemies = enemyPaths.map(([x, minX, maxX], id) => ({
      id,
      x,
      minX,
      maxX,
      y: PLUMBER_GROUND - 30,
      w: 28,
      h: 30,
      speed: id % 2 ? -48 : 48,
      alive: true,
    }));
    this.player = {
      x: PLUMBER_START_X,
      y: PLUMBER_GROUND - PLAYER_HEIGHT,
      w: PLAYER_WIDTH,
      h: PLAYER_HEIGHT,
      vx: 0,
      vy: 0,
      grounded: true,
      direction: 1,
    };
    this.camera = 0;
    return this;
  }
  begin(now = performance.now()) {
    return this.start(now, true);
  }
  jump() {
    if (!this.active || !this.player.grounded) return false;
    this.player.vy = -JUMP_SPEED;
    this.player.grounded = false;
    return true;
  }
  pause(now = performance.now()) {
    if (!this.active || this.pauseAt !== null) return;
    this.pauseAt = now;
  }
  resume(now = performance.now()) {
    if (this.pauseAt !== null) {
      const pausedFor = Math.max(0, now - this.pauseAt);
      this.startedAt += pausedFor;
      this.last = now;
      this.pauseAt = null;
    }
  }
  stop() {
    this.active = false;
    this.pauseAt = null;
  }
  resetAfterDeath(now) {
    this.deaths += 1;
    this.start(now, true);
  }
  tick(now, controls = {}) {
    if (!this.active || this.pauseAt !== null) return;
    this.elapsed = Math.max(0, now - this.startedAt);
    const elapsed = Math.min(0.25, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    const steps = Math.max(1, Math.ceil(elapsed * 120));
    const dt = elapsed / steps;
    for (let step = 0; step < steps && this.active; step++) this.step(dt, controls, now);
    if (this.player.x + this.player.w >= PLUMBER_GOAL_X) {
      this.player.x = PLUMBER_GOAL_X - this.player.w;
      this.won = true;
      this.active = false;
      this.elapsed = Math.max(0, now - this.startedAt);
    }
    this.camera = Math.max(
      0,
      Math.min(PLUMBER_WORLD_WIDTH - PLUMBER_WIDTH, this.player.x - PLUMBER_WIDTH * 0.34),
    );
  }
  step(dt, controls, now) {
    const player = this.player;
    const direction = Number(Boolean(controls.right)) - Number(Boolean(controls.left));
    if (direction) {
      player.vx += direction * 1100 * dt;
      player.direction = direction;
    } else {
      const drag = 1500 * dt;
      player.vx = Math.abs(player.vx) <= drag ? 0 : player.vx - Math.sign(player.vx) * drag;
    }
    player.vx = Math.max(-PLUMBER_MAX_SPEED, Math.min(PLUMBER_MAX_SPEED, player.vx));
    player.x = Math.max(0, Math.min(PLUMBER_WORLD_WIDTH - player.w, player.x + player.vx * dt));
    for (const solid of this.solids) {
      if (!['ground', 'pipe'].includes(solid.kind)) continue;
      if (!intersects(player, solid)) continue;
      player.x = player.vx > 0 ? solid.x - player.w : solid.x + solid.w;
      player.vx = 0;
    }

    const oldTop = player.y;
    const oldBottom = player.y + player.h;
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    player.grounded = false;
    for (const solid of this.solids) {
      if (!intersects(player, solid)) continue;
      if (player.vy >= 0 && oldBottom <= solid.y + 2) {
        player.y = solid.y - player.h;
        player.vy = 0;
        player.grounded = true;
      } else if (
        solid.kind === 'pipe' &&
        player.vy < 0 &&
        oldTop >= solid.y + solid.h - 2
      ) {
        player.y = solid.y + solid.h;
        player.vy = 0;
      }
    }

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.x += enemy.speed * dt;
      if (enemy.x < enemy.minX || enemy.x + enemy.w > enemy.maxX) {
        enemy.speed *= -1;
        enemy.x = Math.max(enemy.minX, Math.min(enemy.maxX - enemy.w, enemy.x));
      }
      if (!intersects(player, enemy)) continue;
      if (player.vy > 20 && oldBottom <= enemy.y + 11) {
        enemy.alive = false;
        player.y = enemy.y - player.h;
        player.vy = -JUMP_SPEED * 0.48;
        player.grounded = false;
      } else {
        this.resetAfterDeath(now);
        return;
      }
    }
    for (const coin of this.coins) {
      if (!coin.collected && intersects(player, { x: coin.x - 9, y: coin.y - 9, w: 18, h: 18 }))
        coin.collected = true;
    }
    if (player.y > PLUMBER_HEIGHT + 80) this.resetAfterDeath(now);
  }
}

export function formatPlumberTime(milliseconds) {
  const total = Math.max(0, Math.floor(milliseconds));
  const minutes = Math.floor(total / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const centiseconds = Math.floor((total % 1000) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(centiseconds).padStart(2, '0')}`;
}
