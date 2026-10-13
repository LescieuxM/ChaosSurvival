import './styles.css';
import './styles-story.css';
import './styles-menu.css';
import chart from './config/chart.json';
import music from './config/music-lvl1.analysis.json';
import { AudioEngine } from './audio/engine.js';
import { Timeline, compileChart, isOnBeat } from './game/timeline.js';
import { musicAt } from './game/music.js';
import { BeginnerDirector } from './game/director.js';
import { WINDOW_TYPES } from './config/popups.js';
import { GameState } from './game/state.js';
import { WindowManager } from './ui/windows.js';
import { icon } from './ui/icons.js';
import { mountDesktop } from './ui/desktop.js';
import { createMusicDebug } from './ui/music-debug.js';
import story from './config/story.json';
import pixelgirlDialogue from './dialogues/pixelgirl-intro.json';
import { Progression } from './story/progression.js';
import { ConversationWindow } from './ui/conversation.js';
import { celebrateVictory } from './ui/victory.js';
import { DesktopSounds } from './audio/sounds.js';
import { dialogues } from './story/catalog.js';
import { miniGames, createMiniGame } from './ui/minigame.js';
import { MainMenu } from './ui/main-menu.js';
import { MenuMusic } from './audio/menu-music.js';
import { UserSettings, deleteUserData } from './settings.js';

const BEST_SCORE_KEY = 'chaos-survival-best';
const DEFAULT_VOLUME = 0.55;
const SYNC_OFFSET_KEY = `chaos-sync-${music.source.sha256}`;
let syncOffset = 0;
try {
  syncOffset = Math.max(-0.5, Math.min(0.5, Number(localStorage.getItem(SYNC_OFFSET_KEY)) || 0));
} catch {
  /* Calibration is optional. */
}

let best = 0;
try {
  best = Number(localStorage.getItem(BEST_SCORE_KEY)) || 0;
} catch {
  /* Storage can be unavailable in private browsing. */
}

const ui = mountDesktop(document.getElementById('app'), best);

const state = new GameState(chart.gameplay);
const audio = new AudioEngine(chart.volume);
let storyStorage;
try {
  storyStorage = localStorage;
} catch {
  /* Optional persistence. */
}
const progression = new Progression(story, storyStorage);
const settings = new UserSettings(storyStorage, chart.volume);
const menuMusic = new MenuMusic(() => settings.data.musicVolume);
audio.setVolume(settings.data.musicVolume);
let arcadeSequenceId = 'arcade-1';
const sounds = new DesktopSounds(
  () => settings.data.effectsVolume,
  () => (menuMusic.active ? menuMusic.context : audio.context),
);
let cancelVictory = () => {};
let storyToastAction = null;
let msnArrivalTimer;
let timeline;
let configurationError;
let director;
try {
  timeline = new Timeline(compileChart(chart, music));
  director = new BeginnerDirector(chart.gameplay);
} catch (error) {
  configurationError = error;
}
let phase = 'idle';
let duration = chart.durationSeconds;
let lastTime = 0;
let frame = 0;
let toastUntil = 0;
let wizzUntil = 0;
let sparkleUntil = -Infinity;
let lastLateness = null;
let maxLateness = 0;
let pauseGeneration = 0;
let action = () => {};
let secondaryAction = () => {};
let previousVolume = chart.volume;
const manager = new WindowManager(ui.playfield, ({ preview, x, y, openedAt }) => {
  if (preview || phase !== 'playing') return;
  const onBeat = isOnBeat(audio.time - syncOffset, chart, music);
  director.closed(audio.time, openedAt);
  const points = state.close(onBeat);
  feedback(x, y, points, onBeat);
  renderStats();
});
let activeDialogue = pixelgirlDialogue;
let conversation = createConversation(activeDialogue);
let miniGame;
let restoringStory = false;
function createConversation(dialogue) {
  return new ConversationWindow(
    manager,
    dialogue,
    progression,
    sounds,
    (id) => {
      if (progression.current?.type === 'conversation' && progression.current.dialogue === id) {
        progression.complete(progression.current.id, { dialogue: id });
        if (progression.current) progression.enterCurrent().catch(showStoryError);
      }
      if (!progression.current)
        ui.sessionLabel.textContent = `À TOUT À L’HEURE, ${dialogue.contact.name.toUpperCase()}`;
    },
    renderDesktopFiles,
    () => {
      if (
        progression.current?.type === 'conversation' &&
        progression.current.dialogue === dialogue.id
      ) {
        progression.complete(progression.current.id, { dialogue: dialogue.id });
        ui.sessionLabel.textContent = 'SUPER_MEGA_GAME.exe T’ATTEND';
      }
    },
  );
}
progression.register('arcade', async (sequence) => {
  if (sequence.level !== chart.level)
    throw new Error(`Le niveau ${sequence.level} n’est pas disponible.`);
  arcadeSequenceId = sequence.id;
  phase = 'idle';
  await startGame();
});
progression.register('conversation', (sequence) => {
  const dialogue = dialogues[sequence.dialogue];
  if (!dialogue) throw new Error(`Conversation introuvable : ${sequence.dialogue}`);
  activeDialogue = dialogue;
  conversation = createConversation(dialogue);
  showStoryDesktop(!restoringStory);
});
progression.register('minigame', () => {
  showStoryDesktop(false);
  ui.sessionLabel.textContent = 'SUPER_MEGA_GAME.exe T’ATTEND';
});

function previewWindows() {
  manager.spawn('msn', { preview: true, x: 0.96, y: 0.15 });
  manager.spawn('virus', { preview: true, x: 0.91, y: 0.87 });
  manager.spawn('ad', { preview: true, x: 0.06, y: 0.8 });
}
previewWindows();
ui.bpmLabel.textContent = `≈ ${Math.round(music.bpm)} BPM`;
ui.launcherBpm.textContent = `NIVEAU 1 · ≈ ${Math.round(music.bpm)} BPM`;
ui.volume.value = settings.data.musicVolume * 100;
ui.durationLabel.textContent = `${Math.round(chart.durationSeconds)} secondes · découverte`;
ui.trackTitle.firstChild.textContent = `${chart.title} `;

function musicalTime() {
  return audio.time - chart.offsetSeconds - syncOffset;
}
function debugSnapshot() {
  const time = musicalTime();
  return {
    ...musicAt(time, music),
    time,
    audioTime: audio.time,
    offset: syncOffset,
    phase,
    level: chart.level,
    open: state.open,
    maxWindows: chart.gameplay.maxWindows,
    skipped: director?.skipped ?? 0,
    closeSeconds: director?.closeSeconds ?? 1.8,
    lastLateness,
    maxLateness,
    sourceHash: music.source.sha256,
    beatCount: music.beats.length,
    next:
      timeline?.events
        .slice(timeline.cursor)
        .filter((event) => WINDOW_TYPES.includes(event.type))
        .slice(0, 4) ?? [],
  };
}
function setSyncOffset(value) {
  if (!Number.isFinite(value)) return;
  syncOffset = Math.max(-0.5, Math.min(0.5, value));
  try {
    localStorage.setItem(SYNC_OFFSET_KEY, String(syncOffset));
  } catch {
    /* Optional. */
  }
  if (phase === 'playing' || phase === 'paused') timeline.seek(musicalTime());
  debug.render();
}
const debug = createMusicDebug(ui.desktop, music, debugSnapshot, setSyncOffset);
let deletingUserData = false;
const menu = new MainMenu(document.getElementById('app'), progression, settings, sounds, {
  play: continueFromMenu,
  newGame: async () => {
    progression.newGame();
    await continueFromMenu();
  },
  settingsChanged: () => setVolume(settings.data.musicVolume),
  fullscreen: setFullscreen,
  deleteData: async () => {
    deletingUserData = true;
    try {
      await setFullscreen(false);
      deleteUserData(storyStorage);
      window.location.reload();
    } catch (error) {
      deletingUserData = false;
      throw error;
    }
  },
});
const returnMenu = ui.menuPlay;
returnMenu.id = 'return-main-menu';
returnMenu.innerHTML = `${icon('computer')}<span>Menu principal<small>Continuer / nouvelle partie / options</small></span>`;
async function setFullscreen(value) {
  try {
    if (window.chaosWindow) await window.chaosWindow.setFullscreen(value);
    else if (value && !document.fullscreenElement)
      await document.documentElement.requestFullscreen();
    else if (!value && document.fullscreenElement) await document.exitFullscreen();
    settings.update({ fullscreen: value });
    menu.syncSettings();
  } catch (error) {
    menu.syncSettings();
    throw error;
  }
}
window.chaosWindow?.onFullscreenChanged(async () => {
  if (deletingUserData) return;
  const value = await window.chaosWindow.getFullscreen();
  if (deletingUserData) return;
  settings.update({ fullscreen: value });
  menu.syncSettings();
});
document.addEventListener('fullscreenchange', () => {
  if (!window.chaosWindow && !deletingUserData) {
    settings.update({ fullscreen: Boolean(document.fullscreenElement) });
    menu.syncSettings();
  }
});
async function continueFromMenu() {
  menu.hide();
  menuMusic.stop();
  returnMenu.hidden = false;
  progression.begin();
  if (progression.current?.type === 'arcade') {
    phase = 'idle';
    await startGame();
    return;
  }
  restoringStory = true;
  try {
    const last = [...story.sequences]
      .reverse()
      .find(
        (item) =>
          item.type === 'conversation' &&
          (item.id === progression.data.current || progression.data.completed.includes(item.id)),
      );
    activeDialogue = dialogues[last?.dialogue] ?? pixelgirlDialogue;
    conversation = createConversation(activeDialogue);
    if (progression.current) await progression.enterCurrent();
    else showStoryDesktop(false);
    if (progression.current?.type === 'conversation') openConversation();
  } catch (error) {
    showStoryError(error);
  } finally {
    restoringStory = false;
  }
}
function returnToMenu() {
  if (['loading', 'resuming'].includes(phase)) return;
  cancelVictory();
  pauseGeneration++;
  cancelAnimationFrame(frame);
  audio.stop(true);
  clearEffects();
  if (progression.current?.type === 'conversation' && conversation.session?.state.finished)
    progression.complete(progression.current.id, { dialogue: activeDialogue.id });
  manager.clear();
  miniGame = null;
  if (progression.hasSave) progression.save();
  phase = 'menu';
  ui.modalLayer.hidden = true;
  ui.introLayer.hidden = true;
  ui.playfield.inert = true;
  ui.pauseButton.disabled = true;
  ui.desktop.classList.remove('is-playing', 'on-beat');
  setStartMenuOpen(false);
  returnMenu.hidden = true;
  menu.show();
  menuMusic.start();
  debug.render();
}
document.addEventListener('pointerdown', () => {
  if (phase === 'menu' && !menuMusic.active) menuMusic.start();
});
// Diagnostic data remains available in the standalone game (F3).
Object.defineProperty(window, 'chaosDebug', { value: Object.freeze({ snapshot: debugSnapshot }) });
debug.render();

async function startGame() {
  if (!['idle', 'ended', 'desktop'].includes(phase)) return;
  cancelVictory();
  if (progression.current?.type === 'arcade') arcadeSequenceId = progression.current.id;
  ui.desktop.classList.remove('story-desktop');
  storyToastAction = null;
  phase = 'loading';
  returnMenu.disabled = true;
  if (!progression.hasSave) progression.begin();
  ui.startButton.disabled = true;
  ui.closeLauncher.disabled = true;
  ui.dialogAction.disabled = true;
  ui.loadStatus.textContent = 'Chargement de la musique… connexion à 56k (presque).';
  try {
    if (configurationError) throw configurationError;
    const trackDuration = await audio.start();
    duration = Math.min(chart.durationSeconds, trackDuration);
    manager.clear();
    clearEffects();
    state.reset();
    timeline.reset();
    director.reset();
    pauseGeneration++;
    lastLateness = null;
    maxLateness = 0;
    lastTime = 0;
    ui.introLayer.hidden = true;
    ui.modalLayer.hidden = true;
    ui.playfield.inert = false;
    phase = 'playing';
    ui.pauseButton.disabled = false;
    ui.desktop.classList.add('is-playing');
    renderStats();
    frame = requestAnimationFrame(tick);
    debug.render();
    if (document.hidden) await pauseGame();
  } catch (error) {
    audio.stop();
    phase = 'idle';
    ui.loadStatus.textContent = `Impossible de démarrer : ${error.message}`;
    showDialog(
      'Connexion interrompue',
      `<p>La musique ou la configuration n’a pas pu être chargée.</p><p class="dialog-detail"></p>`,
      'Réessayer',
      () => {
        ui.modalLayer.hidden = true;
        startGame();
      },
    );
    ui.dialogCopy.querySelector('.dialog-detail').textContent = error.message;
  } finally {
    returnMenu.disabled = false;
    ui.startButton.disabled = false;
    ui.closeLauncher.disabled = false;
    ui.dialogAction.disabled = false;
  }
}

function tick() {
  if (phase !== 'playing') return;
  const now = Math.min(audio.time, duration);
  // The audio clock drives pressure and scheduling, even after missed frames.
  const lost = state.update(Math.max(0, now - lastTime));
  lastTime = now;
  const time = now - chart.offsetSeconds - syncOffset;
  if (!lost) timeline.advance(time, (event) => emitEvent(event, time));
  const { beat, section, intensity } = musicAt(time, music);
  ui.desktop.style.setProperty('--music-intensity', intensity);
  ui.desktop.classList.toggle('on-beat', Boolean(beat && time - beat.time < 0.12));
  ui.desktop.classList.toggle('music-accent', Boolean(beat?.accent && time - beat.time < 0.1));
  ui.desktop.classList.toggle('music-sparkle', time < sparkleUntil);
  if (now >= toastUntil) ui.toast.hidden = true;
  if (now >= wizzUntil) {
    ui.desktop.classList.remove('wizz');
    ui.wizzLabel.hidden = true;
  }
  if (section) {
    ui.sessionLabel.textContent = section.label;
    ui.sessionLabel.title = section.name;
  }
  renderStats();
  debug.render();
  ui.trackFill.style.width = `${(now / duration) * 100}%`;
  ui.trackTime.textContent = `${formatTime(now)} / ${formatTime(duration)}`;
  if (lost || state.chaos >= 100) return finishGame(false);
  if (now >= duration) return finishGame(true);
  frame = requestAnimationFrame(tick);
}

function emitEvent(event, time) {
  if (event.type === 'pulse') return;
  if (time - event.time > chart.gameplay.maxEventLatenessSeconds) {
    if (WINDOW_TYPES.includes(event.type)) director.allow(event, time, state);
    return;
  }
  if (event.type === 'sparkle') {
    sparkleUntil = event.time + 0.08;
    return;
  }
  if (event.type === 'notify') return notify(event.contact, event.message);
  if (event.type === 'wizz') return wizz();
  if (!director.allow(event, time, state)) return;
  manager.spawn(event.type, { openedAt: audio.time });
  state.spawn();
  lastLateness = Math.max(0, time - event.time);
  maxLateness = Math.max(maxLateness, lastLateness);
}

function renderStats() {
  ui.score.textContent = String(state.score).padStart(6, '0');
  ui.chaosText.textContent = `${Math.floor(state.chaos)} %`;
  ui.chaosFill.style.width = `${state.chaos}%`;
  ui.chaosMeter.setAttribute('aria-valuenow', Math.floor(state.chaos));
  ui.desktop.classList.toggle('danger', state.chaos >= 70);
  ui.chaosCaption.textContent =
    state.chaos >= 70
      ? 'ALERTE : ferme ces fenêtres !'
      : state.chaos >= 35
        ? 'Ça commence à faire beaucoup…'
        : 'Tout va bien. Pour l’instant.';
  ui.windowCount.textContent = `${state.open} fenêtre${state.open === 1 ? '' : 's'} ouverte${state.open === 1 ? '' : 's'}`;
}

async function pauseGame() {
  if (phase !== 'playing') return;
  phase = 'paused';
  cancelAnimationFrame(frame);
  ui.playfield.inert = true;
  ui.desktop.classList.remove('is-playing');
  const generation = ++pauseGeneration;
  await audio.pause();
  if (phase !== 'paused' || generation !== pauseGeneration) return;
  debug.render();
  showDialog(
    'Une petite pause ?',
    '<p>Ton bureau et la musique t’attendent.</p><p class="dialog-hint">Respire. Détends ta souris. Tu gères.</p>',
    '▶ REPRENDRE',
    resumeGame,
    'help',
    { label: 'Recommencer', callback: restartGame },
  );
}
async function resumeGame() {
  if (phase !== 'paused') return;
  phase = 'resuming';
  const generation = ++pauseGeneration;
  ui.dialogAction.disabled = true;
  try {
    await audio.resume();
    if (phase !== 'resuming' || generation !== pauseGeneration) return;
    ui.modalLayer.hidden = true;
    ui.playfield.inert = false;
    phase = 'playing';
    ui.desktop.classList.add('is-playing');
    debug.render();
    manager.reposition();
    frame = requestAnimationFrame(tick);
    if (document.hidden) await pauseGame();
  } catch (error) {
    if (generation !== pauseGeneration) return;
    phase = 'paused';
    ui.dialogCopy.textContent = `La reprise a échoué : ${error.message}`;
  } finally {
    ui.dialogAction.disabled = false;
  }
}
function finishGame(won) {
  pauseGeneration++;
  phase = 'ended';
  cancelAnimationFrame(frame);
  audio.stop();
  clearEffects();
  ui.pauseButton.disabled = true;
  ui.playfield.inert = true;
  ui.desktop.classList.remove('is-playing', 'on-beat');
  debug.render();
  const newRecord = state.score > best;
  best = Math.max(best, state.score);
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(best));
  } catch {
    /* Best score is optional. */
  }
  ui.best.textContent = String(best).padStart(6, '0');
  ui.sessionLabel.textContent = won ? 'BUREAU SAUVÉ' : 'LE SYSTÈME A CRAQUÉ';
  if (won) {
    progression.complete(arcadeSequenceId, { score: state.score, closed: state.closed });
    ui.modalLayer.hidden = true;
    ui.dialogTitle.textContent = 'Tu as survécu !';
    cancelVictory = celebrateVictory(
      ui.desktop,
      { score: state.score, closed: state.closed, newRecord },
      sounds,
      () => {
        if (progression.current) progression.enterCurrent().catch(showStoryError);
        else showStoryDesktop(false);
      },
    );
    return;
  }
  showDialog(
    won ? 'Tu as survécu !' : 'Ton PC a rendu l’âme.',
    `<p>${won ? 'Le drop est passé. Le bureau respire à nouveau.' : 'Trop de fenêtres. Pas assez de clics. On remet ça ?'}</p><div class="result-score"><span>${newRecord ? '★ NOUVEAU RECORD' : 'SCORE FINAL'}</span><strong>${String(state.score).padStart(6, '0')}</strong></div><div class="result-details"><span>${state.closed} fenêtres fermées</span><span>${formatTime(lastTime)} de survie</span></div>`,
    '↻ REJOUER',
    startGame,
    won ? 'computer' : 'error',
    { label: 'Retour au bureau', callback: restartDesktop },
  );
}
function restartDesktop() {
  returnToMenu();
}
function restartGame() {
  pauseGeneration++;
  phase = 'ended';
  startGame();
}
function showDialog(title, copy, button, callback, type = 'help', secondary) {
  ui.dialogTitle.textContent = title;
  ui.dialogCopy.innerHTML = copy;
  ui.dialogIcon.innerHTML = icon(type);
  ui.dialogAction.textContent = button;
  action = callback;
  secondaryAction = secondary?.callback ?? (() => {});
  ui.dialogSecondary.hidden = !secondary;
  if (secondary) ui.dialogSecondary.textContent = secondary.label;
  ui.modalLayer.hidden = false;
  ui.dialogAction.focus();
}
async function help() {
  if (phase === 'loading') return;
  if (phase === 'playing') await pauseGame();
  showDialog(
    'Mode d’emploi, version 2005.',
    '<p>Ferme les fenêtres avec leur <b>croix rouge</b>. Une fermeture rapporte <b>100 points</b>, avec <b>25 points bonus</b> si tu cliques sur un temps musical.</p><p>Les fenêtres oubliées font monter le chaos ; les fermer le réduit. À <b>100 %</b>, c’est perdu. Survis jusqu’à la fin pour gagner.</p><p class="dialog-hint">Déplace les fenêtres par leur barre bleue. Échap met en pause. F11 ou Alt+Entrée active / désactive le plein écran. Le jeu se met aussi en pause si tu réduis sa fenêtre.</p>',
    phase === 'paused' ? '▶ REPRENDRE' : 'COMPRIS !',
    phase === 'paused'
      ? resumeGame
      : () => {
          ui.modalLayer.hidden = true;
        },
  );
}
function feedback(x, y, points, onBeat) {
  const label = document.createElement('div');
  label.className = `score-feedback${onBeat ? ' perfect' : ''}`;
  label.textContent = `${onBeat ? 'ON BEAT! ' : ''}+${points}`;
  label.style.left = `${Math.min(window.innerWidth - 140, Math.max(20, x || window.innerWidth / 2))}px`;
  label.style.top = `${Math.max(30, (y || window.innerHeight / 2) - 20)}px`;
  ui.feedbackLayer.append(label);
  label.addEventListener('animationend', () => label.remove(), { once: true });
}
function notify(contact, message) {
  ui.toastContact.textContent = contact;
  ui.toastMessage.textContent = message;
  ui.toast.hidden = false;
  toastUntil = audio.time + 4.5;
}
function wizz() {
  ui.desktop.classList.remove('wizz');
  void ui.desktop.offsetWidth;
  ui.desktop.classList.add('wizz');
  ui.wizzLabel.hidden = false;
  wizzUntil = audio.time + 0.65;
}
function clearEffects() {
  clearTimeout(msnArrivalTimer);
  storyToastAction = null;
  ui.toast.classList.remove('story-toast');
  ui.toastOpen.hidden = true;
  toastUntil = 0;
  wizzUntil = 0;
  sparkleUntil = -Infinity;
  ui.toast.hidden = true;
  ui.wizzLabel.hidden = true;
  ui.desktop.classList.remove('wizz', 'on-beat', 'music-accent', 'music-sparkle');
  ui.desktop.style.setProperty('--music-intensity', 0);
  ui.feedbackLayer.replaceChildren();
}
function showStoryError(error) {
  showDialog('MSN Messenger', '<p class="story-error"></p>', 'Retour au bureau', () =>
    showStoryDesktop(false),
  );
  ui.dialogCopy.querySelector('.story-error').textContent = error.message;
}
function showStoryDesktop(announce) {
  cancelVictory();
  cancelAnimationFrame(frame);
  audio.stop();
  clearEffects();
  manager.clear();
  phase = 'desktop';
  ui.desktop.classList.add('story-desktop');
  ui.desktop.classList.remove('is-playing', 'on-beat');
  ui.introLayer.hidden = true;
  ui.modalLayer.hidden = true;
  ui.playfield.inert = false;
  ui.pauseButton.disabled = true;
  state.open = 0;
  state.chaos = 0;
  renderStats();
  ui.chaosCaption.textContent = 'Le bureau est calme. Place aux amis.';
  ui.sessionLabel.textContent = progression.current
    ? `${activeDialogue.contact.name.toUpperCase()} EST EN LIGNE`
    : 'CONVERSATION ENREGISTRÉE';
  if (announce) {
    ui.toastContact.textContent = activeDialogue.contact.nickname;
    ui.toastMessage.textContent = 'vient de se connecter. Clique pour lui dire bonjour :)';
    ui.toast.classList.add('story-toast');
    ui.toast.hidden = false;
    ui.toastOpen.hidden = false;
    storyToastAction = openConversation;
    sounds.play('online');
    clearTimeout(msnArrivalTimer);
    msnArrivalTimer = setTimeout(() => {
      if (phase !== 'desktop' || conversation.element?.isConnected) return;
      ui.toastMessage.textContent = 't’a envoyé un nouveau message.';
      ui.toast.hidden = false;
      sounds.play('message');
    }, 2000);
  }
  renderDesktopFiles();
  debug.render();
}
function openConversation() {
  if (phase !== 'desktop') return;
  ui.toast.hidden = true;
  sounds.unlock();
  conversation.open();
}
function renderDesktopFiles() {
  let files = ui.desktop.querySelector('#desktop-files');
  if (!files) {
    files = document.createElement('nav');
    files.id = 'desktop-files';
    files.className = 'desktop-files';
    files.setAttribute('aria-label', 'Fichiers reçus');
    ui.desktop.append(files);
  }
  files.replaceChildren();
  const received = new Map(
    Object.values(progression.data.files)
      .filter((file) => file.status === 'complete' && file.direction === 'receive')
      .map((file) => [file.id, file]),
  );
  for (const file of received.values()) {
    const button = document.createElement('button');
    button.className = 'desktop-file';
    button.dataset.fileId = file.id;
    button.innerHTML = icon('download');
    const name = document.createElement('span');
    name.textContent = file.name;
    button.append(name);
    button.addEventListener('dblclick', () => openDesktopFile(file));
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        openDesktopFile(file);
      }
    });
    files.append(button);
  }
}
function openDesktopFile(file) {
  if (phase !== 'desktop' || !file.launch) return;
  const definition = miniGames[file.launch.game];
  if (!definition) return showStoryError(new Error('Ce mini-jeu est indisponible.'));
  if (progression.current?.type === 'conversation')
    progression.complete(progression.current.id, { dialogue: activeDialogue.id });
  if (conversation.element?.isConnected) {
    manager.close(Number(conversation.element.dataset.windowId));
  }
  if (!miniGame || miniGame.definition.id !== definition.id || miniGame.finished)
    miniGame = createMiniGame(definition, manager, sounds, (result) => {
      if (progression.current?.type === 'minigame' && progression.current.game === definition.id)
        progression.complete(progression.current.id, result);
    });
  sounds.unlock();
  miniGame.open();
}
function formatTime(value) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
}

function setStartMenuOpen(open) {
  ui.startMenu.hidden = !open;
  ui.windowsStart.setAttribute('aria-expanded', String(open));
}

function setVolume(value) {
  audio.setVolume(value);
  settings.update({ musicVolume: value });
  menuMusic.setVolume(value);
  ui.volume.value = value * 100;
  ui.muteButton.textContent = value === 0 ? '♪̸' : '♫';
  ui.muteButton.setAttribute('aria-label', value === 0 ? 'Réactiver le son' : 'Couper le son');
}

ui.startButton.addEventListener('click', startGame);
ui.closeLauncher.addEventListener('click', () => {
  ui.introLayer.hidden = true;
  ui.windowsStart.focus();
});
ui.pauseButton.addEventListener('click', pauseGame);
ui.helpButton.addEventListener('click', help);
ui.dialogAction.addEventListener('click', () => action());
ui.dialogSecondary.addEventListener('click', () => secondaryAction());
ui.dismissToast.addEventListener('click', () => {
  ui.toast.hidden = true;
});
ui.toastOpen.addEventListener('click', () => storyToastAction?.());
ui.toast.addEventListener('click', (event) => {
  if (!event.target.closest('button')) storyToastAction?.();
});
ui.msnTask.addEventListener('click', openConversation);
ui.volume.addEventListener('input', (event) => {
  setVolume(Number(event.target.value) / 100);
});
ui.muteButton.addEventListener('click', () => {
  if (audio.volume > 0) {
    previousVolume = audio.volume;
    setVolume(0);
  } else {
    setVolume(previousVolume || DEFAULT_VOLUME);
  }
});
ui.windowsStart.addEventListener('click', () => {
  setStartMenuOpen(ui.startMenu.hidden);
});
document.addEventListener('pointerdown', (event) => {
  if (!event.target.closest('.start-menu, .windows-start')) setStartMenuOpen(false);
});
ui.menuPlay.addEventListener('click', () => {
  setStartMenuOpen(false);
  returnToMenu();
});
ui.menuHelp.addEventListener('click', () => {
  setStartMenuOpen(false);
  help();
});
ui.shortcuts.forEach((button) =>
  button.addEventListener('click', () => {
    const kind = button.dataset.shortcut;
    if (kind === 'msn' && phase === 'desktop') return openConversation();
    if (kind === 'music') return help();
    if (phase === 'idle')
      manager.spawn(kind === 'msn' ? 'msn' : kind === 'folder' ? 'download' : 'error', {
        preview: true,
      });
  }),
);
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || event.repeat) return;
  if (phase === 'playing') pauseGame();
  else if (phase === 'paused') resumeGame();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && phase === 'playing') pauseGame();
});
function updateClock() {
  ui.clock.textContent = new Date().toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
updateClock();
setInterval(updateClock, 10000);
ui.trackTime.textContent = `00:00 / ${formatTime(chart.durationSeconds)}`;
returnToMenu();
if (settings.data.fullscreen) setFullscreen(true).catch(() => {});
