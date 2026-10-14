import { replaceGameStorage } from './reset-game.js';
const TYPES = ['arcade', 'conversation', 'minigame'];
const STORAGE_KEY = 'chaos-survival-story-v1';
export const HISTORY_KEY = 'chaos-survival-history-v1';
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const runId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
function freshData(story) {
  return {
    version: 1,
    runId: runId(),
    started: false,
    current: story.start,
    completed: [],
    flags: {},
    choices: [],
    dialogues: {},
    conversations: {},
    results: {},
    choiceOffers: {},
    files: {},
    anomalies: {},
    dialogueArchives: {},
    unlockedConversations: [],
    level1Launches: 0,
    replayReactions: [],
    tutorials: {},
  };
}
function validSaved(saved, story) {
  const ids = new Set(story.sequences.map((item) => item.id));
  return (
    record(saved) &&
    saved.version === 1 &&
    (saved.level1Launches === undefined ||
      (Number.isInteger(saved.level1Launches) && saved.level1Launches >= 0)) &&
    (saved.replayReactions === undefined ||
      (Array.isArray(saved.replayReactions) &&
        saved.replayReactions.every(
          (event) =>
            record(event) &&
            Number.isInteger(event.attempt) &&
            typeof event.id === 'string' &&
            typeof event.template === 'string' &&
            Number.isFinite(event.dueAt) &&
            typeof event.ready === 'boolean',
        ))) &&
    (saved.started === undefined || typeof saved.started === 'boolean') &&
    (saved.current === null || ids.has(saved.current)) &&
    Array.isArray(saved.completed) &&
    saved.completed.every((id) => ids.has(id)) &&
    Array.isArray(saved.choices) &&
    saved.choices.every(
      (item) => record(item) && typeof item.key === 'string' && typeof item.choice === 'string',
    ) &&
    ['flags', 'dialogues', 'results'].every((key) => record(saved[key])) &&
    ['choiceOffers', 'files', 'anomalies', 'dialogueArchives'].every(
      (key) => saved[key] === undefined || record(saved[key]),
    ) &&
    Object.values(saved.choiceOffers ?? {}).every(
      (items) =>
        Array.isArray(items) &&
        items.every(
          (item) => record(item) && typeof item.id === 'string' && typeof item.text === 'string',
        ),
    ) &&
    Object.values(saved.files ?? {}).every(
      (item) =>
        record(item) &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        ['pending', 'declined', 'complete'].includes(item.status) &&
        (!item.launch || (record(item.launch) && typeof item.launch.game === 'string')),
    ) &&
    Object.values(saved.dialogues).every(
      (item) =>
        record(item) &&
        typeof item.node === 'string' &&
        Number.isInteger(item.cursor) &&
        item.cursor >= 0 &&
        typeof item.finished === 'boolean' &&
        Array.isArray(item.transcript) &&
        item.transcript.every(
          (message) =>
            record(message) &&
            ['contact', 'player'].includes(message.speaker) &&
            typeof message.text === 'string',
        ),
    )
  );
}

export function validateStory(story) {
  if (story.version !== 1 || !Array.isArray(story.sequences) || !story.sequences.length)
    throw new Error('La progression narrative est invalide.');
  const ids = new Set(story.sequences.map((item) => item.id));
  if (ids.size !== story.sequences.length || !ids.has(story.start))
    throw new Error('Identifiants de séquences invalides.');
  for (const item of story.sequences) {
    if (
      typeof item.id !== 'string' ||
      !TYPES.includes(item.type) ||
      (item.next !== null && !ids.has(item.next))
    )
      throw new Error(`Séquence invalide : ${item.id}`);
  }
}

export class Progression {
  constructor(story, storage) {
    validateStory(story);
    this.story = story;
    this.storage = storage;
    this.handlers = new Map();
    this.data = freshData(story);
    try {
      const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
      if (validSaved(saved, story)) this.data = saved;
      else if (saved !== null) this.corrupt = true;
    } catch {
      this.corrupt = true;
    }
    this.data.choiceOffers ??= {};
    if (!record(this.data.contactConnections)) this.data.contactConnections = {};
    for (const [id, connection] of Object.entries(this.data.contactConnections)) {
      if (
        !record(connection) ||
        !['pending', 'online'].includes(connection.status) ||
        (connection.status === 'pending' && !Number.isFinite(connection.dueAt))
      )
        delete this.data.contactConnections[id];
    }
    if (!record(this.data.tutorials)) this.data.tutorials = {};
    this.data.files ??= {};
    this.data.anomalies ??= {};
    this.data.dialogueArchives ??= {};
    this.data.runId ??= runId();
    this.data.started ??= Boolean(
      this.data.completed.length ||
      this.data.choices.length ||
      Object.keys(this.data.dialogues).length,
    );
    // An appended chapter resumes old completed runs without replaying their games.
    const tail = story.sequences.find(
      (item) =>
        this.data.completed.includes(item.id) &&
        !this.data.completed.includes(item.next) &&
        story.sequences.some((next) => next.id === item.next && next.resumeAfterCompletion),
    );
    if (this.data.current === null && tail) this.data.current = tail.next;
    this.data.unlockedConversations = story.sequences
      .filter(
        (sequence) =>
          sequence.type === 'conversation' &&
          (this.data.completed.includes(sequence.id) || this.data.current === sequence.id),
      )
      .map((sequence) => sequence.dialogue);
    // A JSON revision must not unlock an already completed introduction again.
  }
  save() {
    try {
      this.data.chapter = this.current?.chapter ?? 1;
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.data));
      this.persistenceError = false;
      return true;
    } catch {
      this.persistenceError = true;
      return false;
    }
  }
  get hasSave() {
    return this.data.started || this.data.completed.length > 0;
  }
  begin() {
    this.data.started = true;
    this.data.startedAt ??= new Date().toISOString();
    this.save();
  }
  newGame() {
    const next = freshData(this.story);
    replaceGameStorage(this.storage, next);
    this.data = next;
    this.corrupt = false;
    this.persistenceError = false;
    this.onNewGame?.({ runId: next.runId });
  }
  get current() {
    return this.story.sequences.find((item) => item.id === this.data.current) ?? null;
  }
  register(type, handler) {
    if (!TYPES.includes(type) || typeof handler !== 'function')
      throw new Error('Gestionnaire de séquence invalide.');
    this.handlers.set(type, handler);
    return this;
  }
  async enterCurrent() {
    const sequence = this.current;
    if (!sequence) return null;
    const handler = this.handlers.get(sequence.type);
    if (!handler) throw new Error(`Aucun gestionnaire pour la séquence ${sequence.type}.`);
    await handler(sequence, this);
    return sequence;
  }
  complete(id, result = {}) {
    if (this.data.completed.includes(id)) return false;
    if (this.data.current !== id) throw new Error('Cette séquence n’est pas la séquence active.');
    this.data.completed.push(id);
    this.data.results[id] = result;
    this.data.current = this.current.next;
    const next = this.current;
    if (next?.type === 'conversation' && !this.data.unlockedConversations.includes(next.dialogue))
      this.data.unlockedConversations.push(next.dialogue);
    this.data.started = true;
    this.save();
    return true;
  }
  offer(dialogue, node, choices) {
    const key = `${dialogue}:${node}`;
    if (!Object.hasOwn(this.data.choiceOffers, key)) {
      this.data.choiceOffers[key] = choices.map(({ id, text, next, set }) => ({
        id,
        text,
        next,
        set: { ...set },
      }));
      this.save();
    }
    return this.data.choiceOffers[key];
  }
  choose(dialogue, node, choice, offered = []) {
    const key = `${dialogue}:${node}`;
    if (this.data.choices.some((item) => item.key === key))
      throw new Error('Une réponse a déjà été choisie.');
    const proposals = this.offer(dialogue, node, offered);
    for (const [flag, value] of Object.entries(choice.set ?? {})) {
      if (
        ['__proto__', 'constructor', 'prototype'].includes(flag) ||
        !['string', 'number', 'boolean'].includes(typeof value)
      )
        throw new Error('Valeur narrative invalide.');
      this.data.flags[flag] = value;
    }
    this.data.choices.push({
      key,
      dialogue,
      node,
      choice: choice.id,
      text: choice.text,
      offered: structuredClone(proposals),
      unselected: structuredClone(proposals.filter((item) => item.id !== choice.id)),
    });
  }
  receiveFile(file, dialogue, node, direction = 'receive', offer = 0) {
    const key = `${dialogue}:${node}:${direction}:${file.id}:${offer}`;
    if (Object.hasOwn(this.data.files, key)) return this.data.files[key];
    const item = { ...structuredClone(file), key, dialogue, node, direction, status: 'pending' };
    this.data.files[key] = item;
    this.save();
    return item;
  }
  finishTransfer(key) {
    const file = this.data.files[key];
    if (!file) throw new Error('Transfert inconnu.');
    file.status = 'complete';
    this.save();
    return file;
  }
}
