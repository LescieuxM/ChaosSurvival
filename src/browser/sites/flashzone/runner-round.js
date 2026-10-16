export const RUNNER_WIDTH = 480,
  RUNNER_HEIGHT = 200,
  GROUND = 160,
  PLAYER_X = 64,
  PLAYER_W = 12,
  PLAYER_H = 20;
const GRAVITY = 900,
  JUMP_SPEED = 340,
  STEP_MS = 2,
  OBSTACLE_GAP_MIN = 150,
  OBSTACLE_GAP_VARIATION = 50;
const SPEED_PROGRESS = Object.freeze([
  [0, 1],
  [15_000, 1.5],
  [30_000, 2],
  [45_000, 3],
  [60_000, 4],
  [75_000, 5.5],
  [90_000, 7],
  [105_000, 9],
  [120_000, 12],
  [135_000, 16],
]);

export function runnerSpeedAt(elapsedMs) {
  const elapsed = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  for (let index = 1; index < SPEED_PROGRESS.length; index++) {
    const [endTime, endMultiplier] = SPEED_PROGRESS[index];
    if (elapsed > endTime) continue;
    const [startTime, startMultiplier] = SPEED_PROGRESS[index - 1];
    const progress = (elapsed - startTime) / (endTime - startTime);
    return 100 * (startMultiplier + (endMultiplier - startMultiplier) * progress);
  }
  return 1600;
}
export class RunnerRound {
  constructor(random = Math.random) {
    this.random = random;
    this.active = false;
  }
  start(now) {
    this.active = true;
    this.last = now;
    this.elapsed = 0;
    this.distance = 0;
    this.y = GROUND - PLAYER_H;
    this.vy = 0;
    this.grounded = true;
    this.obstacles = [];
    this.nextAt = 420;
    this.serial = 0;
  }
  get speed() {
    return runnerSpeedAt(this.elapsed);
  }
  jump() {
    if (!this.active || !this.grounded) return false;
    this.vy = -JUMP_SPEED;
    this.grounded = false;
    return true;
  }
  tick(now) {
    if (!this.active) return;
    const delta = Math.max(0, now - this.last);
    this.last = now;
    if (delta > 250) return;
    let remaining = delta;
    while (remaining > 0 && this.active) {
      const dt = Math.min(STEP_MS, remaining) / 1000;
      remaining -= dt * 1000;
      this.elapsed += dt * 1000;
      const travel = this.speed * dt;
      this.distance += travel;
      if (this.distance >= this.nextAt) {
        const kind = ['crate', 'block', 'hole'][Math.floor(this.random() * 3)];
        const width = kind === 'hole' ? 54 : kind === 'crate' ? 22 : 16;
        this.obstacles.push({
          id: ++this.serial,
          kind,
          x: RUNNER_WIDTH + 12,
          width,
          height: kind === 'crate' ? 28 : 18,
        });
        // Keep world-space gaps fixed so the requested speed increase also tightens timing.
        this.nextAt = this.distance + OBSTACLE_GAP_MIN + this.random() * OBSTACLE_GAP_VARIATION;
      }
      for (const obstacle of this.obstacles) obstacle.x -= travel;
      this.obstacles = this.obstacles.filter((obstacle) => obstacle.x + obstacle.width > 0);
      const hole = this.obstacles.some(
        (o) =>
          o.kind === 'hole' &&
          PLAYER_X + PLAYER_W / 2 > o.x &&
          PLAYER_X + PLAYER_W / 2 < o.x + o.width,
      );
      const previousY = this.y;
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      if (
        !hole &&
        this.vy >= 0 &&
        previousY + PLAYER_H <= GROUND + 0.1 &&
        this.y + PLAYER_H >= GROUND
      ) {
        this.y = GROUND - PLAYER_H;
        this.vy = 0;
        this.grounded = true;
      } else if (hole) this.grounded = false;
      if (this.y > RUNNER_HEIGHT) {
        this.active = false;
        break;
      }
      if (
        this.obstacles.some(
          (o) =>
            o.kind !== 'hole' &&
            PLAYER_X < o.x + o.width &&
            PLAYER_X + PLAYER_W > o.x &&
            this.y + PLAYER_H > GROUND - o.height &&
            this.y < GROUND,
        )
      ) {
        this.active = false;
        break;
      }
    }
  }
  resume(now) {
    this.last = now;
  }
  stop() {
    this.active = false;
    this.obstacles = [];
  }
}
export function bestDistance(progression, id) {
  const value = progression?.data.flashzoneBestDistances?.[id];
  return Number.isFinite(value) && value >= 0 ? value : 0;
}
export function saveBestDistance(progression, id, distance) {
  const best = bestDistance(progression, id);
  if (progression && Number.isFinite(distance) && distance > best) {
    const saved = progression.data.flashzoneBestDistances;
    progression.data.flashzoneBestDistances = {
      ...(saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}),
      [id]: distance,
    };
    progression.save();
  }
  return Math.max(best, distance);
}
