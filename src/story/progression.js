const TYPES = ['arcade', 'conversation', 'minigame'];
const STORAGE_KEY = 'chaos-survival-story-v1';

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
    this.data = {
      version: 1,
      current: story.start,
      completed: [],
      flags: {},
      choices: [],
      dialogues: {},
      results: {},
      choiceOffers: {},
      files: {},
      anomalies: {},
    };
    try {
      const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
      const ids = new Set(story.sequences.map((item) => item.id));
      if (
        saved?.version === 1 &&
        (saved.current === null || ids.has(saved.current)) &&
        Array.isArray(saved.completed) &&
        saved.completed.every((id) => ids.has(id)) &&
        Array.isArray(saved.choices) &&
        saved.flags &&
        typeof saved.flags === 'object' &&
        saved.dialogues &&
        typeof saved.dialogues === 'object' &&
        saved.results &&
        typeof saved.results === 'object'
      )
        this.data = saved;
    } catch {
      /* Playable even if local storage is unavailable or damaged. */
    }
    this.data.choiceOffers ??= {};
    this.data.files ??= {};
    this.data.anomalies ??= {};
    this.data.dialogueArchives ??= {};
    for (const sequence of story.sequences) {
      if (
        sequence.type === 'conversation' &&
        sequence.revision &&
        this.data.completed.includes(sequence.id) &&
        this.data.dialogues[sequence.dialogue]?.revision !== sequence.revision
      ) {
        this.data.completed = this.data.completed.filter((id) => id !== sequence.id);
        this.data.current = sequence.id;
        this.save();
        break;
      }
    }
  }
  save() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      /* Session-only fallback. */
    }
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
