export const RUNNER_WIDTH = 480,
  RUNNER_HEIGHT = 200,
  GROUND = 160,
  PLAYER_X = 64,
  PLAYER_W = 12,
  PLAYER_H = 20;
const GRAVITY = 900,
  JUMP_SPEED = 340;
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
    return Math.min(180, 100 + this.distance * 0.012);
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
      const dt = Math.min(5, remaining) / 1000;
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
        // At least a full jump duration plus reaction time between hazards, even at max speed.
        this.nextAt = this.distance + this.speed * (1.45 + this.random() * 0.55);
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
