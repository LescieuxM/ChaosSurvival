// Keep earlier close buttons exposed whenever the playfield allows it.
export function chooseWindowPosition(width, height, windowWidth, windowHeight, occupied, sequence) {
  const maxX = Math.max(0, width - windowWidth);
  const maxY = Math.max(0, height - windowHeight);
  if (!occupied.length) return { x: maxX, y: 0 };
  const candidates = [];
  for (let y = 0; y <= 4; y++)
    for (let x = 0; x <= 4; x++) candidates.push({ x: (maxX * x) / 4, y: (maxY * y) / 4 });
  let best = candidates[sequence % candidates.length];
  let bestScore = -Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const position = candidates[(i + sequence * 7) % candidates.length];
    // Start near the top so later windows can expose existing titlebars by
    // staggering downward, including in a small Electron window.
    let score = -position.y * 8;
    for (const item of occupied) {
      const closeX = item.x + item.width - 17;
      const closeY = item.y + 17;
      const distance = Math.hypot(position.x - item.x, position.y - item.y);
      score += Math.min(distance, 400);
      if (distance < 40) score -= 10000;
      if (
        closeX >= position.x - 8 &&
        closeX <= position.x + windowWidth + 8 &&
        closeY >= position.y - 16 &&
        closeY <= position.y + windowHeight + 8
      )
        score -= 100000;
    }
    if (score > bestScore) {
      bestScore = score;
      best = position;
    }
  }
  return best;
}
