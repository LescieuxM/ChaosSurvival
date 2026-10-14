import { textElement as node, internalLink as link } from '../../dom.js';
import { playerIdentity } from '../../../ui/player-identity.js';
import { HOTEL_URL, VIEW_WIDTH, VIEW_HEIGHT, project, screenCell, RoomWalk } from './model.js';
import { drawRoom } from './draw.js';

function shell(data) {
  const root = node('section', undefined, 'xdhotel');
  const header = node('header', undefined, 'hotel-header');
  header.append(
    link('Hopla Hotel', HOTEL_URL),
    node('span', 'Un petit monde, de grandes rencontres !'),
  );
  root.append(header);
  return root;
}
export function renderHotelHome(_context, data) {
  const root = shell(data);
  const banner = node('div', undefined, 'hotel-banner');
  const skyline = node('div', undefined, 'hotel-skyline');
  skyline.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 5; i++) skyline.append(node('span'));
  banner.append(node('h1', 'Bienvenue à Hopla Hotel !'), node('p', data.welcome), skyline);
  const enter = link("Entrer dans l'hôtel", `${HOTEL_URL}salle/${data.room.id}`);
  enter.className = 'hotel-enter';
  banner.append(enter);
  const intro = node('div', undefined, 'hotel-intro');
  intro.append(
    node('h2', 'Pose tes valises'),
    node(
      'p',
      "Le hall t'attend : choisis un coin pour te poser et passe saluer ReceptionXD à l'accueil.",
    ),
    node('p', 'Une souris, un clic, et te voilà dans le décor. Bonne visite !'),
  );
  root.append(banner, intro, node('small', 'Hopla Hotel · 2009', 'hotel-footer'));
  return root;
}
export function renderHotelRoom({ onDispose }, data, room = data.room) {
  const root = shell(data);
  root.classList.add('hotel-room');
  const navigation = node('nav', undefined, 'hotel-room-nav');
  navigation.append(node('h2', room.name), link("Retour à l'accueil", HOTEL_URL));
  root.append(navigation);
  const viewport = node('div', undefined, 'hotel-viewport');
  const stage = node('div', undefined, 'hotel-stage');
  const canvas = node('canvas', undefined, 'hotel-canvas');
  canvas.width = VIEW_WIDTH;
  canvas.height = VIEW_HEIGHT;
  canvas.setAttribute(
    'aria-label',
    'Hall isométrique : cliquez sur le sol pour marcher, ou sur ReceptionXD pour le saluer.',
  );
  const bubble = node('div', undefined, 'hotel-bubble');
  bubble.setAttribute('role', 'status');
  bubble.hidden = true;
  stage.append(canvas, bubble);
  viewport.append(stage);
  const status = node('p', 'Cliquez sur une case libre pour vous déplacer.', 'hotel-room-status');
  const location = node('small', undefined, 'hotel-location');
  root.append(viewport, status, location);
  const ctx = canvas.getContext('2d'),
    walk = new RoomWalk(room);
  const observer = new ResizeObserver(() => {
    const { width, height } = viewport.getBoundingClientRect();
    stage.style.width = `${Math.max(0, Math.min(width - 4, ((height - 4) * VIEW_WIDTH) / VIEW_HEIGHT))}px`;
    positionBubble();
  });
  observer.observe(viewport);
  let frame = null,
    last = null,
    disposed = false,
    bubbleUntil = null,
    speaking = null;
  function positionBubble() {
    if (!speaking || bubble.hidden) return;
    const point = project(...speaking.position, room);
    const width = stage.clientWidth ?? VIEW_WIDTH;
    const height = stage.clientHeight ?? VIEW_HEIGHT;
    const bubbleWidth = bubble.offsetWidth ?? 220;
    const bubbleHeight = bubble.offsetHeight ?? 64;
    bubble.style.left = `${Math.max(6, Math.min(width - bubbleWidth - 6, (point.x / VIEW_WIDTH) * width - bubbleWidth / 2))}px`;
    bubble.style.top = `${Math.max(6, Math.min(height - bubbleHeight - 6, ((point.y - 40) / VIEW_HEIGHT) * height - bubbleHeight - 5))}px`;
  }
  function draw() {
    drawRoom(ctx, room, walk);
    location.textContent = `${playerIdentity.nickname} · case ${walk.cell[0] + 1}, ${walk.cell[1] + 1}`;
  }
  function loop(now) {
    frame = null;
    if (disposed) return;
    if (!root.isConnected) {
      dispose();
      return;
    }
    if (document.hidden) {
      last = null;
      return;
    }
    if (last !== null) walk.update(now - last);
    last = now;
    if (bubbleUntil !== null && now >= bubbleUntil) {
      bubble.hidden = true;
      bubbleUntil = null;
    }
    draw();
    if (walk.moving || bubbleUntil !== null) frame = requestAnimationFrame(loop);
    else {
      last = null;
    }
  }
  function wake() {
    if (!disposed && !document.hidden && frame === null) frame = requestAnimationFrame(loop);
  }
  function click(event) {
    if (disposed || event.button !== 0) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = ((event.clientX - bounds.left) * VIEW_WIDTH) / bounds.width;
    const y = ((event.clientY - bounds.top) * VIEW_HEIGHT) / bounds.height;
    const npc = [...room.npcs]
      .sort((a, b) => b.position[0] + b.position[1] - (a.position[0] + a.position[1]))
      .find((item) => {
        const point = project(...item.position, room);
        return Math.abs(x - point.x) <= 11 && y >= point.y - 40 && y <= point.y + 5;
      });
    if (npc) {
      bubble.textContent = npc.dialogue;
      bubble.hidden = false;
      speaking = npc;
      positionBubble();
      bubbleUntil = performance.now() + 4500;
      status.textContent = npc.name;
      wake();
      return;
    }
    const cell = screenCell(x, y, room);
    if (!cell) return;
    if (!walk.moveTo(cell)) {
      status.textContent = 'Cette case est inaccessible.';
      return;
    }
    status.textContent = 'Cliquez sur une case libre pour vous déplacer.';
    wake();
  }
  function visibility() {
    cancelAnimationFrame(frame);
    frame = last = null;
    if (!document.hidden) wake();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    frame = last = bubbleUntil = null;
    canvas.removeEventListener('click', click);
    document.removeEventListener('visibilitychange', visibility);
    observer.disconnect();
  }
  canvas.addEventListener('click', click);
  document.addEventListener('visibilitychange', visibility);
  onDispose?.(dispose);
  draw();
  return root;
}
