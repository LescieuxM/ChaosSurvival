import { project, VIEW_WIDTH, VIEW_HEIGHT } from './model.js';

function polygon(ctx, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  ctx.fill();
}
function tile(ctx, x, y, color) {
  polygon(
    ctx,
    [
      [x, y - 8],
      [x + 16, y],
      [x, y + 8],
      [x - 16, y],
    ],
    color,
  );
}
function block(ctx, point, height, top, left, right) {
  const { x, y } = point;
  polygon(
    ctx,
    [
      [x - 15, y],
      [x, y + 7],
      [x, y + 7 - height],
      [x - 15, y - height],
    ],
    left,
  );
  polygon(
    ctx,
    [
      [x, y + 7],
      [x + 15, y],
      [x + 15, y - height],
      [x, y + 7 - height],
    ],
    right,
  );
  tile(ctx, x, y - height, top);
}
function person(ctx, point, color, direction, stride = 0) {
  const x = Math.round(point.x),
    y = Math.round(point.y);
  tile(ctx, x, y + 1, '#69797c');
  ctx.fillStyle = '#243047';
  ctx.fillRect(x - 6, y - 12 - stride, 5, 12 + stride);
  ctx.fillRect(x + 1, y - 12 + stride, 5, 12 - stride);
  ctx.fillStyle = '#172438';
  ctx.fillRect(x - 7, y - 2 - stride, 7, 3);
  ctx.fillRect(x + 1, y - 2 + stride, 7, 3);
  ctx.fillStyle = color;
  ctx.fillRect(x - 7, y - 26, 14, 16);
  ctx.fillRect(x - 10, y - 23, 3, 11);
  ctx.fillRect(x + 7, y - 23, 3, 11);
  ctx.fillStyle = '#efba86';
  ctx.fillRect(x - 6, y - 37, 12, 12);
  ctx.fillRect(x - 10, y - 13, 3, 3);
  ctx.fillRect(x + 7, y - 13, 3, 3);
  ctx.fillStyle = '#543c32';
  ctx.fillRect(x - 7, y - 39, 14, 5);
  if (['north', 'west'].includes(direction)) ctx.fillRect(x - 6, y - 34, 12, 7);
  else {
    ctx.fillStyle = '#243047';
    ctx.fillRect(x + (direction === 'east' ? 2 : -4), y - 32, 2, 2);
    ctx.fillRect(x + (direction === 'east' ? 5 : 2), y - 32, 2, 2);
  }
  // A small sleeve highlight makes all four facings distinct, including back views.
  ctx.fillStyle = '#e7eff1';
  ctx.fillRect(x + (['east', 'north'].includes(direction) ? 5 : -7), y - 25, 2, 6);
}
function furniture(ctx, room, item) {
  const [width, height] = item.size ?? [1, 1];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const point = project(item.position[0] + x, item.position[1] + y, room);
      if (item.type === 'sofa') {
        block(ctx, point, 12, '#ea8665', '#944834', '#bc6045');
        block(ctx, { x: point.x, y: point.y - 8 }, 22, '#ffab78', '#bb684b', '#d77e59');
      } else if (item.type === 'table') {
        ctx.fillStyle = '#6d5137';
        ctx.fillRect(point.x - 10, point.y - 12, 3, 16);
        ctx.fillRect(point.x + 7, point.y - 12, 3, 16);
        block(ctx, { x: point.x, y: point.y - 13 }, 3, '#efd796', '#ad8750', '#d3b070');
      } else if (item.type === 'plant') {
        block(ctx, point, 12, '#b17550', '#74452f', '#986449');
        ctx.fillStyle = '#315f3a';
        ctx.fillRect(point.x - 2, point.y - 33, 4, 23);
        ctx.fillStyle = '#54a350';
        ctx.fillRect(point.x - 12, point.y - 32, 12, 7);
        ctx.fillRect(point.x + 1, point.y - 37, 10, 7);
        ctx.fillRect(point.x - 8, point.y - 44, 10, 9);
      } else if (item.type === 'counter') {
        block(ctx, point, 25, '#f8d679', '#9c6b38', '#bb8b48');
        ctx.fillStyle = '#fff0bd';
        ctx.fillRect(point.x - 6, point.y - 21, 10, 2);
      }
    }
}
export function depthOrder(room, walk) {
  return [
    ...room.furniture.map((item) => ({
      kind: 'furniture',
      item,
      depth:
        item.position[0] +
        item.position[1] +
        ((item.size?.[0] ?? 1) - 1) +
        ((item.size?.[1] ?? 1) - 1),
    })),
    ...room.npcs.map((item) => ({ kind: 'npc', item, depth: item.position[0] + item.position[1] })),
    { kind: 'player', depth: walk.position[0] + walk.position[1] },
  ].sort((a, b) => a.depth - b.depth);
}
export function drawRoom(ctx, room, walk) {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#172e48';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  const start = project(0, 0, room),
    left = project(0, room.height - 1, room),
    right = project(room.width - 1, 0, room);
  polygon(
    ctx,
    [
      [start.x, start.y - 8],
      [left.x - 16, left.y],
      [left.x - 16, left.y - 64],
      [start.x, start.y - 72],
    ],
    '#57a9b4',
  );
  polygon(
    ctx,
    [
      [start.x, start.y - 8],
      [right.x + 16, right.y],
      [right.x + 16, right.y - 64],
      [start.x, start.y - 72],
    ],
    '#387f99',
  );
  const sign = project(0, 3, room);
  ctx.fillStyle = '#183e59';
  ctx.fillRect(sign.x - 12, sign.y - 57, 26, 14);
  ctx.fillStyle = '#ffe393';
  ctx.font = 'bold 8px monospace';
  ctx.fillText('HH', sign.x - 6, sign.y - 47);
  for (let depth = 0; depth < room.width + room.height - 1; depth++) {
    for (let x = 0; x < room.width; x++) {
      const y = depth - x;
      if (y < 0 || y >= room.height) continue;
      const point = project(x, y, room);
      tile(ctx, point.x, point.y, '#bda776');
      polygon(
        ctx,
        [
          [point.x, point.y - 7],
          [point.x + 14, point.y],
          [point.x, point.y + 6],
          [point.x - 14, point.y],
        ],
        (x + y) % 2 ? '#e9d6a1' : '#f4e5bc',
      );
    }
  }
  for (const entry of depthOrder(room, walk)) {
    if (entry.kind === 'furniture') furniture(ctx, room, entry.item);
    else if (entry.kind === 'npc')
      person(ctx, project(...entry.item.position, room), '#f3bf43', entry.item.direction);
    else
      person(
        ctx,
        project(...walk.position, room),
        '#a284dc',
        walk.direction,
        walk.moving ? (Math.floor(walk.elapsed / 120) % 2 ? 1 : -1) : 0,
      );
  }
}
