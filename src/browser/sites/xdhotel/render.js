import { textElement as node, internalLink as link } from '../../dom.js';
import { HOTEL_URL, VIEW_WIDTH, VIEW_HEIGHT, project, screenCell } from './model.js';
import { drawRoom } from './draw.js';
import { RoomSimulation } from './simulation.js';
import { placeBubbles } from './bubbles.js';
import { playerIdentity } from '../../../ui/player-identity.js';

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
  const root = node('section', undefined, 'xdhotel hotel-room');
  root.setAttribute('aria-label', room.name);
  const navigation = node('nav', undefined, 'hotel-room-nav');
  const browserButton = node('button', undefined, 'hotel-navigator-open');
  const icon = node('span', undefined, 'hotel-navigator-icon');
  icon.setAttribute('aria-hidden', 'true');
  browserButton.append(icon, node('span', 'Navigateur'));
  browserButton.type = 'button';
  browserButton.setAttribute('aria-expanded', 'false');
  const chatSpace = node('div', undefined, 'hotel-chat-space');
  chatSpace.setAttribute('aria-hidden', 'true');
  navigation.append(browserButton, chatSpace, node('span', room.name, 'hotel-current-room'));
  const viewport = node('div', undefined, 'hotel-viewport');
  const stage = node('div', undefined, 'hotel-stage');
  const canvas = node('canvas', undefined, 'hotel-canvas');
  canvas.width = VIEW_WIDTH;
  canvas.height = VIEW_HEIGHT;
  canvas.setAttribute(
    'aria-label',
    `${room.name} : cliquez sur le sol pour marcher, ou sur un personnage pour le saluer.`,
  );
  stage.append(canvas);
  viewport.append(stage);
  root.append(viewport, navigation);
  const navigator = node('section', undefined, 'hotel-navigator');
  navigator.setAttribute('role', 'dialog');
  navigator.setAttribute('aria-label', 'Navigateur de salles');
  navigator.hidden = true;
  const panelHeader = node('header');
  const close = node('button', 'X', 'hotel-navigator-close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Fermer le navigateur');
  panelHeader.append(node('strong', 'Navigateur'), close);
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
  viewport.append(navigator);
  const ctx = canvas.getContext('2d'),
    simulation = new RoomSimulation(room),
    walk = simulation.player;
  const speakers = [...simulation.npcs, { id: 'player', name: playerIdentity.nickname, walk }];
  const bubbles = new Map();
  let frame = null,
    timer = null,
    last = performance.now(),
    disposed = false,
    paused = false;
  const observer = new ResizeObserver(() => {
    if (disposed || paused) return;
    const { width, height } = viewport.getBoundingClientRect();
    if (!width || !height) return;
    canvas.style.width = `${Math.max(0, Math.min(width, (height * VIEW_WIDTH) / VIEW_HEIGHT))}px`;
    clampNavigator();
    positionMessages();
  });
  observer.observe(viewport);
  function positionMessages() {
    const width = stage.clientWidth ?? VIEW_WIDTH;
    const height = stage.clientHeight ?? VIEW_HEIGHT;
    const scaleX = (canvas.clientWidth ?? VIEW_WIDTH) / VIEW_WIDTH;
    const scaleY = (canvas.clientHeight ?? VIEW_HEIGHT) / VIEW_HEIGHT;
    const offsetX = canvas.offsetLeft ?? 0;
    const offsetY = canvas.offsetTop ?? 0;
    const visible = [];
    for (const [id, bubble] of bubbles) {
      if (simulation.messages.has(id)) continue;
      bubble.remove();
      bubbles.delete(id);
    }
    for (const message of simulation.messages.values()) {
      const speaker = speakers.find((speaker) => speaker.id === message.speaker);
      if (!speaker) continue;
      let bubble = bubbles.get(message.id);
      if (!bubble) {
        bubble = node('div', undefined, 'hotel-bubble');
        bubble.setAttribute('role', 'status');
        bubble.dataset.speaker = speaker.id;
        bubble.style.setProperty(
          '--hotel-bubble-fade-delay',
          `${Math.max(0, message.expiresAt - simulation.now - 250)}ms`,
        );
        bubble.append(
          node('strong', `${speaker.name} : `),
          node('span', message.text, 'hotel-message-text'),
        );
        stage.append(bubble);
        bubbles.set(message.id, bubble);
      }
      const point = project(...speaker.walk.position, room);
      visible.push({
        id: message.id,
        x: offsetX + point.x * scaleX,
        y: offsetY + (point.y - 40) * scaleY,
        width: bubble.offsetWidth ?? 180,
        height: bubble.offsetHeight ?? 48,
      });
    }
    for (const position of placeBubbles(visible, width, height)) {
      const bubble = bubbles.get(position.id);
      bubble.style.left = `${position.left}px`;
      bubble.style.top = `${position.top}px`;
      bubble.style.setProperty('--hotel-pointer-left', `${position.pointer}px`);
    }
  }
  function draw() {
    drawRoom(ctx, simulation.view, walk);
    positionMessages();
  }
  function suspend() {
    stage.style.setProperty('--hotel-bubble-play-state', 'paused');
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    frame = timer = last = null;
  }
  function loop(now) {
    frame = timer = null;
    if (disposed || paused || !navigator.hidden) return;
    if (!root.isConnected) {
      dispose();
      return;
    }
    if (document.hidden) {
      suspend();
      return;
    }
    const changed = simulation.update(last === null ? 0 : Math.max(0, now - last));
    last = now;
    if (changed) draw();
    wake();
  }
  function wake() {
    if (!disposed && !paused && navigator.hidden && !document.hidden && frame === null) {
      stage.style.setProperty('--hotel-bubble-play-state', 'running');
      clearTimeout(timer);
      timer = null;
      if (last === null) last = performance.now();
      if (simulation.moving) frame = requestAnimationFrame(loop);
      else timer = setTimeout(() => loop(performance.now()), simulation.nextDelay);
    }
  }
  function showNavigator(open) {
    if (disposed || paused) return;
    navigator.hidden = !open;
    stage.inert = open;
    browserButton.setAttribute('aria-expanded', String(open));
    suspend();
    if (open) {
      clampNavigator();
      close.focus();
    } else {
      browserButton.focus();
      wake();
    }
  }
  let drag = null;
  function clampNavigator() {
    if (navigator.hidden || !navigator.style.top) return;
    navigator.style.left = `${Math.max(0, Math.min(viewport.clientWidth - navigator.offsetWidth, parseFloat(navigator.style.left)))}px`;
    navigator.style.top = `${Math.max(0, Math.min(viewport.clientHeight - navigator.offsetHeight, parseFloat(navigator.style.top)))}px`;
  }
  function startDrag(event) {
    if (paused || disposed || event.button !== 0 || event.target === close) return;
    const panel = navigator.getBoundingClientRect(),
      area = viewport.getBoundingClientRect();
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: panel.left - area.left,
      top: panel.top - area.top,
    };
    panelHeader.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  function moveDrag(event) {
    if (!drag || drag.id !== event.pointerId || paused || disposed) return;
    navigator.style.bottom = 'auto';
    navigator.style.left = `${drag.left + event.clientX - drag.x}px`;
    navigator.style.top = `${drag.top + event.clientY - drag.y}px`;
    clampNavigator();
  }
  function stopDrag() {
    drag = null;
  }
  panelHeader.addEventListener('pointerdown', startDrag);
  panelHeader.addEventListener('pointermove', moveDrag);
  panelHeader.addEventListener('pointerup', stopDrag);
  panelHeader.addEventListener('lostpointercapture', stopDrag);
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
    const now = performance.now();
    if (simulation.update(last === null ? 0 : Math.max(0, now - last))) draw();
    last = now;
    wake();
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = ((event.clientX - bounds.left) * VIEW_WIDTH) / bounds.width;
    const y = ((event.clientY - bounds.top) * VIEW_HEIGHT) / bounds.height;
    const npc = [...simulation.npcs]
      .sort((a, b) => b.position[0] + b.position[1] - (a.position[0] + a.position[1]))
      .find((item) => {
        const point = project(...item.position, room);
        return Math.abs(x - point.x) <= 11 && y >= point.y - 40 && y <= point.y + 5;
      });
    if (npc) {
      // Ordinary speech comes from the room clock, never from selecting a visitor.
      if (room.id === 'hall' && npc.id === 'reception-xd') {
        simulation.say(npc.id, npc.dialogue);
        positionMessages();
        wake();
      }
      return;
    }
    const cell = screenCell(x, y, room);
    if (!cell) return;
    if (!simulation.movePlayer(cell)) return;
    wake();
  }
  function visibility() {
    suspend();
    if (!document.hidden) wake();
  }
  function dispose(reason) {
    if (reason === 'pause') {
      paused = true;
      suspend();
      return;
    }
    if (disposed) return;
    disposed = true;
    suspend();
    simulation.dispose();
    for (const bubble of bubbles.values()) bubble.remove();
    bubbles.clear();
    canvas.removeEventListener('click', click);
    document.removeEventListener('visibilitychange', visibility);
    observer.disconnect();
    browserButton.removeEventListener('click', toggleNavigator);
    close.removeEventListener('click', closeNavigator);
    navigator.removeEventListener('keydown', escapeNavigator);
    panelHeader.removeEventListener('pointerdown', startDrag);
    panelHeader.removeEventListener('pointermove', moveDrag);
    panelHeader.removeEventListener('pointerup', stopDrag);
    panelHeader.removeEventListener('lostpointercapture', stopDrag);
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
  wake();
  return root;
}
