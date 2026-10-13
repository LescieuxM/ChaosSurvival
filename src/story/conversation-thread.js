import { DialogueSession, pendingChoices } from './dialogue.js';

// JSON dialogues are event scripts. A contact owns one durable discussion.
export class ConversationThread {
  constructor(contactId, progression, getEvents) {
    Object.assign(this, { contactId, progression, getEvents });
    this.sync();
  }
  get state() {
    const data = this.progression.data;
    if (
      !data.conversations ||
      typeof data.conversations !== 'object' ||
      Array.isArray(data.conversations)
    )
      data.conversations = {};
    const saved = data.conversations[this.contactId];
    if (
      !saved ||
      saved.version !== 1 ||
      !Array.isArray(saved.history) ||
      !saved.history.every(
        (entry) =>
          typeof entry?.key === 'string' &&
          typeof entry.text === 'string' &&
          ['contact', 'player'].includes(entry.speaker),
      ) ||
      !Array.isArray(saved.unread) ||
      !saved.unread.every((key) => typeof key === 'string')
    )
      data.conversations[this.contactId] = {
        version: 1,
        history: [],
        unread: [],
        activeEvent: null,
        pendingEvents: [],
      };
    return data.conversations[this.contactId];
  }
  hasPendingFile(id) {
    return (this.progression.data.dialogues[id]?.transcript ?? []).some(
      (entry) =>
        entry.type === 'file' && this.progression.data.files[entry.fileKey]?.status === 'pending',
    );
  }
  get activeDefinition() {
    const events = this.getEvents();
    const pending = events.filter(
      (event) =>
        !this.progression.data.dialogues[event.id]?.finished || this.hasPendingFile(event.id),
    );
    return (
      pending.find((event) => {
        const saved = this.progression.data.dialogues[event.id];
        return !saved || saved.cursor < event.nodes[saved.node]?.messages.length;
      }) ??
      pending[0] ??
      events.at(-1)
    );
  }
  get pendingResponses() {
    return this.getEvents()
      .map((definition) => ({
        definition,
        choices: pendingChoices(
          definition,
          this.progression.data.dialogues[definition.id],
          this.progression,
        ),
        position: this.state.history.findLastIndex((entry) => entry.eventId === definition.id),
      }))
      .filter((group) => group.choices.length)
      .sort((a, b) => a.position - b.position);
  }
  sync() {
    const state = this.state;
    const keys = new Set(state.history.map((entry) => entry.key));
    const added = [];
    for (const event of this.getEvents()) {
      const saved = this.progression.data.dialogues[event.id];
      for (const [index, message] of (saved?.transcript ?? []).entries()) {
        const key = `${event.id}:${saved.revision ?? 1}:${index}`;
        if (keys.has(key)) continue;
        keys.add(key);
        added.push({ ...message, key, eventId: event.id });
      }
    }
    added.sort((a, b) => (a.receivedAt ?? 0) - (b.receivedAt ?? 0));
    state.history.push(...added);
    state.unread.push(
      ...added.filter((entry) => entry.speaker === 'contact').map((entry) => entry.key),
    );
    const active = this.activeDefinition?.id ?? null;
    const pending = this.getEvents()
      .filter(
        (event) => event.id !== active && !this.progression.data.dialogues[event.id]?.finished,
      )
      .map((event) => event.id);
    const changed =
      added.length ||
      state.activeEvent !== active ||
      JSON.stringify(state.pendingEvents) !== JSON.stringify(pending);
    state.activeEvent = active;
    state.pendingEvents = pending;
    if (changed && this.progression.hasSave) this.progression.save();
    return state.history;
  }
  receive() {
    const incoming = [];
    for (const event of this.getEvents().slice(1)) {
      if (this.progression.data.dialogues[event.id]?.finished && !this.hasPendingFile(event.id))
        continue;
      // Receive independently of other pending choices; only replies need the UI.
      const saved = this.progression.data.dialogues[event.id];
      if (saved) {
        const node = event.nodes[saved.node];
        if (node?.end && saved.cursor >= node.messages.length && !this.hasPendingFile(event.id)) {
          new DialogueSession(event, this.progression).advance();
        }
        if (saved.node !== event.start || saved.cursor >= event.nodes[event.start].messages.length)
          continue;
      }
      const session = new DialogueSession(event, this.progression);
      while (session.nextMessage()) session.deliver();
      session.offerChoices();
      session.advance();
      incoming.push(event);
    }
    this.sync();
    return incoming;
  }
  markRead() {
    if (!this.state.unread.length) return;
    this.state.unread = [];
    this.progression.save();
  }
}
