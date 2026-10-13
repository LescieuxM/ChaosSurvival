import { ConversationThread } from './conversation-thread.js';
export class ReplayReactions {
  constructor(progression, definitions, config) {
    Object.assign(this, { progression, definitions, config });
    progression.data.level1Launches ??= progression.data.completed.includes('arcade-1') ? 1 : 0;
    progression.data.replayReactions ??= [];
    this.thread = new ConversationThread('pixelgirl', progression, () => [
      definitions['pixelgirl-intro'],
      ...this.dialogues,
    ]);
  }
  get metPixelGirl() {
    return (
      this.progression.data.dialogues['pixelgirl-intro']?.transcript.some(
        (entry) => entry.speaker === 'contact',
      ) ?? false
    );
  }
  launch(now = Date.now()) {
    const data = this.progression.data;
    data.level1Launches++;
    if (this.metPixelGirl) {
      const number = data.replayReactions.length;
      const template =
        number === 0
          ? this.config.first
          : this.config.variants[(number - 1) % this.config.variants.length];
      data.replayReactions.push({
        attempt: data.level1Launches,
        template,
        id: `pixelgirl-level1-attempt-${data.level1Launches}`,
        dueAt: now + this.config.delayMs,
        ready: false,
      });
    }
    this.progression.save();
    return data.level1Launches;
  }
  definition(event) {
    const template = this.definitions[event.template];
    if (!template) throw new Error('Réaction de replay inconnue.');
    return { ...template, id: event.id };
  }
  flush(now = Date.now()) {
    for (const event of this.progression.data.replayReactions) {
      if (event.ready || event.dueAt > now) continue;
      if (!this.definitions[event.template]) continue;
      event.ready = true;
      this.progression.save();
    }
    return this.thread.receive();
  }
  get dialogues() {
    return this.progression.data.replayReactions
      .filter((event) => event.ready && this.definitions[event.template])
      .map((event) => this.definition(event));
  }
}
