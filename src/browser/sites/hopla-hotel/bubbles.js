export const messageDuration = (text) => Math.min(10000, Math.max(6000, 2800 + text.length * 45));

// Shared by NPC speech and future player chat; the room clock owns expiration.
export class BubbleHistory {
  constructor() {
    this.messages = new Map();
    this.sequence = 0;
  }
  add(speaker, text, now) {
    const id = ++this.sequence;
    this.messages.set(id, { id, speaker, text, expiresAt: now + messageDuration(text) });
    if (this.messages.size > 4) this.messages.delete(this.messages.keys().next().value);
  }
  hasSpeaker(speaker) {
    return [...this.messages.values()].some((message) => message.speaker === speaker);
  }
  expire(now) {
    let changed = false;
    for (const [id, message] of this.messages) {
      if (message.expiresAt > now) continue;
      this.messages.delete(id);
      changed = true;
    }
    return changed;
  }
  clear() {
    this.messages.clear();
  }
}

// Chronological horizontal rows follow the projected speakers. Additions shift older
// messages sideways; narrow scenes wrap above, without changing the canvas or zoom.
export function placeBubbles(items, width, height) {
  const margin = 6,
    gap = 6;
  const rows = [];
  for (const item of items) {
    const bubble = {
      ...item,
      width: Math.min(item.width, Math.max(0, width - margin * 2)),
      height: Math.min(item.height, Math.max(0, height - margin * 2 - gap)),
    };
    let row = rows.findLast(
      (candidate) =>
        Math.abs(candidate.y - item.y) < Math.max(candidate.height, bubble.height) + gap &&
        candidate.width + gap + bubble.width <= width - margin * 2,
    );
    if (!row) {
      row = { items: [], width: 0, height: 0, y: item.y };
      rows.push(row);
    }
    row.width += (row.items.length ? gap : 0) + bubble.width;
    row.height = Math.max(row.height, bubble.height);
    row.y = Math.min(row.y, item.y);
    row.items.push(bubble);
  }
  const placed = [];
  for (const row of rows) {
    // Keep different speakers on their side of the scene, while stable sorting
    // preserves the chronological sequence of messages from the same avatar.
    row.items.sort((a, b) => a.x - b.x);
    const anchor = row.items.reduce((sum, item) => sum + item.x, 0) / row.items.length;
    let left = Math.max(margin, Math.min(width - margin - row.width, anchor - row.width / 2));
    let top = Math.max(
      margin,
      Math.min(height - margin - gap - row.height, row.y - row.height - 8),
    );
    const overlaps = (previous) =>
      left < previous.left + previous.width + gap &&
      left + row.width + gap > previous.left &&
      top < previous.top + previous.height + gap &&
      top + row.height + gap > previous.top;
    // Try all row boundaries; if the scene is saturated, prefer a bounded placement.
    const candidates = [
      top,
      ...placed.map((p) => p.top - row.height - gap),
      ...placed.map((p) => p.top + p.height + gap),
    ];
    for (const candidate of candidates) {
      if (candidate < margin || candidate + row.height + gap > height - margin) continue;
      top = candidate;
      if (!placed.some(overlaps)) break;
    }
    for (const item of row.items) {
      placed.push({
        ...item,
        left,
        top,
        pointer: Math.max(8, Math.min(item.width - 8, item.x - left)),
      });
      left += item.width + gap;
    }
  }
  return placed;
}
