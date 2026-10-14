import { textElement as node, internalLink as link } from '../../dom.js';
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
export function renderHotelHome({ openHotel }, data) {
  const root = shell(data);
  const banner = node('div', undefined, 'hotel-banner');
  const skyline = node('div', undefined, 'hotel-skyline');
  skyline.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 5; i++) skyline.append(node('span'));
  banner.append(node('h1', 'Bienvenue à Hopla Hotel !'), node('p', data.welcome), skyline);
  const enter = node('a', "Entrer dans l'hôtel");
  enter.href = '#';
  enter.addEventListener('click', (event) => {
    event.preventDefault();
    openHotel?.();
  });
  enter.className = 'hotel-enter';
  banner.append(enter);
  root.append(banner, node('small', 'Hopla Hotel · 2009', 'hotel-footer'));
  return root;
}
export function renderHotelRoom({ onDispose, onResume, navigate }, data, room = data.room) {
  const root = shell(data);
  root.classList.add('hotel-room');
  const navigation = node('nav', undefined, 'hotel-room-nav');
  const browserButton = node('button', 'Navigateur', 'hotel-navigator-open');
  browserButton.type = 'button';
  browserButton.setAttribute('aria-expanded', 'false');
  navigation.append(node('h2', room.name), browserButton);
  root.append(navigation);
  const viewport = node('div', undefined, 'hotel-viewport');
  const stage = node('div', undefined, 'hotel-stage');
  const canvas = node('canvas', undefined, 'hotel-canvas');
  canvas.width = VIEW_WIDTH;
  canvas.height = VIEW_HEIGHT;
  canvas.setAttribute(
    'aria-label',
    `${room.name} : cliquez sur le sol pour marcher, ou sur un personnage pour le saluer.`,
  );
  const bubble = node('div', undefined, 'hotel-bubble');
  bubble.setAttribute('role', 'status');
  bubble.hidden = true;
  stage.append(canvas, bubble);
  viewport.append(stage);
  root.append(viewport);
  const navigator = node('section', undefined, 'hotel-navigator');
  navigator.setAttribute('role', 'dialog');
  navigator.setAttribute('aria-label', 'Navigateur de salles');
  navigator.hidden = true;
  const panelHeader = node('header');
  const close = node('button', 'Fermer', 'hotel-navigator-close');
  close.type = 'button';
  panelHeader.append(node('strong', 'Navigateur de salles'), close);
  navigator.append(panelHeader);
  for (const destination of [data.room, ...data.rooms]) {
    const entry = node('div', undefined, 'hotel-room-entry');
    const copy = node('div');
    copy.append(node('h3', destination.name), node('p', destination.description));
    const enter = node('button', 'Entrer');
    enter.type = 'button';
    enter.dataset.hotelRoom = destination.id;
    enter.addEventListener('click', () => {
      if (disposed || paused) return;
      showNavigator(false);
      navigate(`${HOTEL_URL}salle/${destination.id}`);
    });
    entry.append(copy, enter);
    navigator.append(entry);
  }
  root.append(navigator);
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
    paused = false,
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
  }
  function loop(now) {
    frame = null;
    if (disposed || paused || !navigator.hidden) return;
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
    if (
      !disposed &&
      !paused &&
      navigator.hidden &&
      !document.hidden &&
      frame === null &&
      (walk.moving || bubbleUntil !== null)
    )
      frame = requestAnimationFrame(loop);
  }
  function showNavigator(open) {
    if (disposed || paused) return;
    navigator.hidden = !open;
    viewport.inert = open;
    browserButton.setAttribute('aria-expanded', String(open));
    cancelAnimationFrame(frame);
    frame = last = null;
    if (open) close.focus();
    else {
      browserButton.focus();
      wake();
    }
  }
  const toggleNavigator = () => showNavigator(navigator.hidden);
  const closeNavigator = () => showNavigator(false);
  const escapeNavigator = (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    closeNavigator();
  };
  browserButton.addEventListener('click', toggleNavigator);
  close.addEventListener('click', closeNavigator);
  navigator.addEventListener('keydown', escapeNavigator);
  function click(event) {
    if (disposed || paused || !navigator.hidden || event.button !== 0) return;
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
      wake();
      return;
    }
    const cell = screenCell(x, y, room);
    if (!cell) return;
    if (!walk.moveTo(cell)) return;
    wake();
  }
  function visibility() {
    cancelAnimationFrame(frame);
    frame = last = null;
    if (!document.hidden) wake();
  }
  function dispose(reason) {
    if (reason === 'pause') {
      paused = true;
      cancelAnimationFrame(frame);
      frame = last = null;
      return;
    }
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    frame = last = bubbleUntil = null;
    canvas.removeEventListener('click', click);
    document.removeEventListener('visibilitychange', visibility);
    observer.disconnect();
    browserButton.removeEventListener('click', toggleNavigator);
    close.removeEventListener('click', closeNavigator);
    navigator.removeEventListener('keydown', escapeNavigator);
  }
  canvas.addEventListener('click', click);
  document.addEventListener('visibilitychange', visibility);
  onDispose?.(dispose);
  onResume?.(() => {
    if (disposed) return;
    paused = false;
    last = null;
    wake();
  });
  draw();
  return root;
}
