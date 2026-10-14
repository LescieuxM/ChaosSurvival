// Completion effects use saved deadlines, so closing MSN or the app cannot lose them.
export class DialogueEvents {
  constructor(progression, definitions, onConnection = () => {}) {
    Object.assign(this, { progression, definitions, onConnection });
  }
  update(now = Date.now(), notify = true) {
    const data = this.progression.data;
    for (const sequence of this.progression.story.sequences) {
      const definition = this.definitions[sequence.dialogue];
      if (!definition?.completion || !data.dialogues[definition.id]?.finished) continue;
      if (data.current === sequence.id)
        this.progression.complete(sequence.id, { dialogue: definition.id });
      if (!data.completed.includes(sequence.id)) continue;
      const connection = definition.completion.connection;
      if (!connection) continue;
      data.contactConnections ??= {};
      if (!data.contactConnections[connection.contactId]) {
        data.contactConnections[connection.contactId] = {
          status: 'pending',
          dueAt: now + connection.delayMs,
        };
        this.progression.save();
      }
    }
    for (const [id, connection] of Object.entries(data.contactConnections ?? {})) {
      if (
        !notify ||
        connection?.status !== 'pending' ||
        !Number.isFinite(connection.dueAt) ||
        connection.dueAt > now
      )
        continue;
      connection.status = 'online';
      this.progression.save();
      this.onConnection(id);
    }
  }
}
