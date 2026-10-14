export const ROUND_MS = 30000;
export class BubbleRound {
  constructor(random = Math.random) {
    this.random = random;
    this.active = false;
  }
  start(now) {
    this.active = true;
    this.started = now;
    this.score = 0;
    this.bubbles = [];
    this.nextSpawn = now;
    this.serial = 0;
  }
  tick(now) {
    if (!this.active) return;
    if (now - this.started >= ROUND_MS) {
      this.active = false;
      this.bubbles = [];
      return;
    }
    this.bubbles = this.bubbles.filter((bubble) => bubble.expires > now);
    if (now >= this.nextSpawn && this.bubbles.length < 8) {
      this.bubbles.push({
        id: ++this.serial,
        x: this.random(),
        y: this.random(),
        color: Math.floor(this.random() * 4),
        expires: now + 2600,
      });
      // No catch-up burst after a slow frame.
      this.nextSpawn = now + 450;
    }
  }
  pop(id, now) {
    this.tick(now);
    if (!this.active) return false;
    const index = this.bubbles.findIndex((bubble) => bubble.id === id);
    if (index < 0) return false;
    this.bubbles.splice(index, 1);
    this.score += 10;
    return true;
  }
  stop() {
    this.active = false;
    this.bubbles = [];
  }
  seconds(now) {
    return Math.max(0, Math.ceil((ROUND_MS - (now - this.started)) / 1000));
  }
}
export function bestScore(progression, id) {
  const value = progression?.data.flashzone?.bestScores?.[id];
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
export function saveBestScore(progression, id, score) {
  const best = bestScore(progression, id);
  if (score > best && progression) {
    const saved = progression.data.flashzone;
    const scores = saved?.bestScores;
    progression.data.flashzone = {
      bestScores: {
        ...(scores && typeof scores === 'object' && !Array.isArray(scores) ? scores : {}),
        [id]: score,
      },
    };
    progression.save();
  }
  return Math.max(best, score);
}
