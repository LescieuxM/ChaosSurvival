import dialogueData from './conversations.json' with { type: 'json' };
import { RoomWalk, blockedCells, inside } from './model.js';
import { BubbleHistory } from './bubbles.js';
export { messageDuration, placeBubbles } from './bubbles.js';

const key = (cell) => cell.join(':');
// Milliseconds on the room clock; response delays remain authored in conversations.json.
export const AMBIENT_TIMING = Object.freeze({
  firstConversation: [2500, 4500],
  conversation: [14000, 26000],
  retry: [1500, 3000],
  firstSpontaneous: [12000, 22000],
  spontaneous: [25000, 45000],
});
export const ROOM_START_DELAYS = Object.freeze({
  hall: [0, 0],
  discotheque: [0, 0],
  cafe: [1000, 3000],
  jeux: [2000, 5000],
  detente: [4000, 8000],
});

// Only the active room owns a simulation. All movement uses the existing RoomWalk/BFS.
export class RoomSimulation {
  constructor(
    room,
    { random = Math.random, conversations = dialogueData, startImmediately = false } = {},
  ) {
    this.room = room;
    this.random = random;
    this.now = 0;
    this.disposed = false;
    this.bubbles = new BubbleHistory();
    this.messages = this.bubbles.messages;
    this.activeConversations = [];
    this.hasStartedConversation = false;
    this.scheduledSpeech = [];
    this.recent = [];
    this.staticBlocked = blockedCells({ ...room, npcs: [] });
    this.player = new RoomWalk({ ...room, npcs: [] });
    this.npcs = room.npcs.map((definition) => {
      const walk = new RoomWalk({ ...room, npcs: [], spawn: definition.position });
      walk.direction = definition.direction;
      return {
        ...definition,
        position: [...definition.position],
        walk,
        nextMove: definition.behavior?.idle ? this.range(definition.behavior.idle) : Infinity,
      };
    });
    this.actors = [this.player, ...this.npcs.map((npc) => npc.walk)];
    this.view = { ...room, npcs: this.npcs };
    const ids = new Set(this.npcs.map((npc) => npc.id));
    this.conversations = conversations.filter(
      (conversation) =>
        conversation.room === room.id &&
        conversation.participants.length >= 2 &&
        new Set(conversation.participants).size === conversation.participants.length &&
        conversation.participants.every((id) => ids.has(id)) &&
        conversation.messages.length > 0 &&
        conversation.messages.every(
          (message) =>
            conversation.participants.includes(message.speaker) &&
            typeof message.text === 'string' &&
            Number.isFinite(message.delay) &&
            message.delay >= 0,
        ),
    );
    this.nextConversation = this.range(
      ROOM_START_DELAYS[room.id] ?? AMBIENT_TIMING.firstConversation,
    );
    this.nextSpontaneous = this.range(AMBIENT_TIMING.firstSpontaneous);
    if (startImmediately && ['hall', 'discotheque'].includes(room.id)) {
      const opening = this.conversations.find((conversation) => conversation.opening);
      if (opening && this.startConversation(opening, true))
        this.nextConversation = this.now + this.range(AMBIENT_TIMING.conversation);
    }
  }
  range([low, high]) {
    return low + this.random() * (high - low);
  }
  reserved(walk) {
    return [walk.cell, ...(walk.step ? [walk.step.to] : []), ...walk.path];
  }
  obstacles(walk) {
    return new Set([
      ...this.staticBlocked,
      ...this.actors
        .filter((other) => other !== walk)
        .flatMap((other) => this.reserved(other).map(key)),
    ]);
  }
  move(walk, target) {
    if (this.disposed || !this.actors.includes(walk)) return false;
    walk.room = {
      ...this.room,
      npcs: [],
      blocked: [...this.obstacles(walk)].map((cell) => cell.split(':').map(Number)),
    };
    return walk.moveTo(target);
  }
  movePlayer(target) {
    return this.move(this.player, target);
  }
  moveNpc(npc) {
    if (!npc.behavior?.idle || npc.walk.moving) return false;
    for (let attempt = 0; attempt < 16; attempt++) {
      const target = [
        Math.floor(this.random() * this.room.width),
        Math.floor(this.random() * this.room.height),
      ];
      const distance =
        Math.abs(target[0] - npc.walk.cell[0]) + Math.abs(target[1] - npc.walk.cell[1]);
      if (distance < 1 || distance > 5) continue;
      // Keep idle visitors out of narrow passages; routes may still cross them.
      const exits = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]
        .map(([x, y]) => [target[0] + x, target[1] + y])
        .filter((cell) => inside(this.room, cell) && !this.staticBlocked.has(key(cell)));
      if (exits.length < 3) continue;
      if (this.move(npc.walk, target)) return true;
    }
    return false;
  }
  say(speaker, text) {
    if (this.disposed || (speaker !== 'player' && !this.npcs.some((npc) => npc.id === speaker)))
      return false;
    this.bubbles.add(speaker, text, this.now);
    return true;
  }
  sayAfter(speaker, text, delay) {
    if (
      this.disposed ||
      !this.npcs.some((npc) => npc.id === speaker) ||
      typeof text !== 'string' ||
      !Number.isFinite(delay) ||
      delay < 0
    ) return false;
    this.scheduledSpeech.push({ speaker, text, due: this.now + delay });
    return true;
  }
  startConversation(conversation, immediate = false) {
    if (
      this.disposed ||
      !this.conversations.includes(conversation) ||
      this.activeConversations.length >= 2
    )
      return false;
    const busy = new Set(
      this.activeConversations.flatMap((active) => active.definition.participants),
    );
    // Walking does not reserve speech. Existing routes continue while messages appear.
    if (conversation.participants.some((id) => busy.has(id))) return false;
    if (immediate) {
      const first = conversation.messages[0];
      this.say(first.speaker, first.text);
      if (conversation.messages.length > 1)
        this.activeConversations.push({
          definition: conversation,
          index: 1,
          due: this.now + conversation.messages[1].delay,
        });
    } else {
      this.activeConversations.push({
        definition: conversation,
        index: 0,
        due: this.now + conversation.messages[0].delay,
      });
    }
    this.recent.push(conversation.id);
    this.recent = this.recent.slice(-3);
    this.hasStartedConversation = true;
    return true;
  }
  update(delta) {
    if (this.disposed || !Number.isFinite(delta) || delta < 0) return false;
    this.now += delta;
    let changed = this.bubbles.expire(this.now);
    const speechSequencePending = this.scheduledSpeech.length > 0;
    for (const message of [...this.scheduledSpeech]) {
      if (message.due > this.now) continue;
      this.say(message.speaker, message.text);
      this.scheduledSpeech.splice(this.scheduledSpeech.indexOf(message), 1);
      changed = true;
    }
    for (const walk of this.actors) {
      if (!walk.moving) continue;
      const obstacles = this.obstacles(walk);
      // Reservations normally guarantee this; tolerate invalidated data/destinations safely.
      if (walk.step && obstacles.has(key(walk.step.to))) {
        walk.step = null;
        walk.path = [];
        walk.position = [...walk.cell];
      } else if (walk.path.some((cell) => obstacles.has(key(cell)))) walk.path = [];
      walk.update(delta);
      changed = true;
    }
    for (const active of speechSequencePending ? [] : [...this.activeConversations]) {
      if (active.due > this.now) continue;
      const message = active.definition.messages[active.index++];
      this.say(message.speaker, message.text);
      changed = true;
      if (active.index === active.definition.messages.length)
        this.activeConversations.splice(this.activeConversations.indexOf(active), 1);
      else active.due = this.now + active.definition.messages[active.index].delay;
    }
    if (!speechSequencePending && this.now >= this.nextConversation) {
      const fresh = this.conversations.filter(
        (conversation) => !this.recent.includes(conversation.id),
      );
      const choices = fresh.length ? fresh : this.conversations;
      // A shuffled attempt allows a second exchange only when its participants are free.
      const start = Math.floor(this.random() * choices.length);
      let started = false;
      for (let i = 0; i < choices.length; i++)
        if (
          this.startConversation(
            choices[(start + i) % choices.length],
            !this.hasStartedConversation,
          )
        ) {
          started = true;
          break;
        }
      this.nextConversation =
        this.now + this.range(started ? AMBIENT_TIMING.conversation : AMBIENT_TIMING.retry);
    }
    if (!speechSequencePending && this.now >= this.nextSpontaneous) {
      const busy = new Set(
        this.activeConversations.flatMap((active) => active.definition.participants),
      );
      const available = this.npcs.filter(
        (npc) =>
          npc.behavior?.messages?.length && !busy.has(npc.id) && !this.bubbles.hasSpeaker(npc.id),
      );
      const speaker = available[Math.floor(this.random() * available.length)];
      if (speaker)
        changed =
          this.say(
            speaker.id,
            speaker.behavior.messages[Math.floor(this.random() * speaker.behavior.messages.length)],
          ) || changed;
      this.nextSpontaneous =
        this.now + this.range(speaker ? AMBIENT_TIMING.spontaneous : AMBIENT_TIMING.retry);
    }
    const chatting = new Set([
      ...[...this.messages.values()].map((message) => message.speaker),
      ...this.activeConversations.flatMap((active) => active.definition.participants),
    ]);
    for (const npc of this.npcs) {
      if (this.now >= npc.nextMove && !npc.walk.moving) {
        if (!chatting.has(npc.id) && this.random() < (npc.behavior.moveChance ?? 0.7))
          changed = this.moveNpc(npc) || changed;
        npc.nextMove = this.now + this.range(npc.behavior.idle);
      }
      npc.position = npc.walk.position;
      npc.direction = npc.walk.direction;
    }
    return changed;
  }
  get moving() {
    return this.actors.some((walk) => walk.moving);
  }
  get nextDelay() {
    return Math.max(
      1,
      Math.min(
        this.nextConversation,
        this.nextSpontaneous,
        ...this.npcs.filter((npc) => !npc.walk.moving).map((npc) => npc.nextMove),
        ...this.activeConversations.map((active) => active.due),
        ...this.scheduledSpeech.map((message) => message.due),
        ...[...this.messages.values()].map((message) => message.expiresAt),
      ) - this.now,
    );
  }
  dispose() {
    this.disposed = true;
    this.bubbles.clear();
    this.activeConversations = [];
    this.scheduledSpeech = [];
    for (const walk of this.actors) {
      walk.path = [];
      walk.step = null;
    }
  }
}
