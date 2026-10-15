const TURBO_MESSAGE_NOTIFICATION_GAP_MS = 2000;
const SUPER_PLOMBIER_INVITATION_DELAY_MS = 10_000;
export const DEFERRED_CONNECTION_DIALOGUES = Object.freeze(['pixelgirl-smiley-victory']);

// Scene-specific rules sit here; dialogue timing and persistence remain owned
// by DialogueEvents, DialogueSession, and ConversationThread.
export class NarrativeOrchestrator {
  constructor({
    progression,
    definitions,
    dialogueEvents,
    getContact,
    prepareContact,
    showConnectionNotification,
    showTurboMessageNotification,
    now = () => Date.now(),
  }) {
    Object.assign(this, {
      progression,
      definitions,
      dialogueEvents,
      getContact,
      prepareContact,
      showConnectionNotification,
      showTurboMessageNotification,
      now,
    });
    this.turboConnectionNotificationActive = false;
    this.restoreLegacyTurboArrival();
  }

  get flags() {
    return this.progression.data.flags;
  }

  restoreLegacyTurboArrival() {
    const flags = this.flags;
    if (
      !flags.turboSmileyScene3ArrivalTriggered &&
      (flags.turboSmileyScene3Opened ||
        flags.turboSmileyScene3Notified ||
        this.progression.data.contactConnections?.turbo?.status === 'online' ||
        (flags.turboSmileyScene3 &&
          this.progression.data.dialogues['pixelgirl-smiley-victory']?.finished))
    ) {
      flags.turboSmileyScene3ArrivalTriggered = true;
      this.progression.save();
    }
  }

  onContactOpened(contact) {
    if (contact.id !== 'turbo' || !this.flags.turboSmileyScene3ArrivalTriggered) return;
    this.turboConnectionNotificationActive = false;
    this.flags.turboSmileyScene3Opened = true;
    delete this.flags.turboSmileyScene3MessageNotificationDueAt;
    this.progression.save();
  }

  onChoiceValidated(definition, { nodeId }) {
    if (
      definition.id !== 'pixelgirl-smiley-victory' ||
      nodeId !== definition.start ||
      this.flags.turboSmileyScene3ArrivalTriggered
    )
      return;
    this.flags.turboSmileyScene3ArrivalTriggered = true;
    this.progression.save();
    this.dialogueEvents.triggerConnection('turbo');
  }

  onContactConnected(contactId) {
    const contact = this.getContact(contactId);
    if (!contact) return;
    if (contactId === 'turbo') this.turboConnectionNotificationActive = true;
    this.showConnectionNotification(contactId, {
      onDismiss: () => this.onConnectionNotificationDismissed(contactId),
    });
    if (contactId === 'turbo') this.prepareTurboSceneMessage();
    if (contactId === 'luna') this.scheduleSuperPlombierInvitation();
  }

  onConnectionNotificationQueued(contactId, completeDurationMs) {
    if (
      contactId !== 'turbo' ||
      !this.flags.turboSmileyScene3ArrivalTriggered ||
      this.flags.turboSmileyScene3Opened ||
      this.flags.turboSmileyScene3Notified
    )
      return;
    this.flags.turboSmileyScene3MessageNotificationDueAt =
      this.now() + completeDurationMs + TURBO_MESSAGE_NOTIFICATION_GAP_MS;
    this.progression.save();
  }

  onConnectionNotificationDismissed(contactId) {
    if (contactId !== 'turbo') return;
    this.turboConnectionNotificationActive = false;
    if (this.flags.turboSmileyScene3Opened || this.flags.turboSmileyScene3Notified) return;
    this.flags.turboSmileyScene3MessageNotificationDueAt =
      this.now() + TURBO_MESSAGE_NOTIFICATION_GAP_MS;
    this.progression.save();
  }

  prepareTurboSceneMessage() {
    if (
      !this.flags.turboSmileyScene3ArrivalTriggered ||
      this.progression.data.contactConnections?.turbo?.status !== 'online'
    )
      return;
    const definition = this.definitions['turbo-smiley-catcher'];
    if (!definition) return;
    const saved = this.progression.data.dialogues[definition.id];
    if (saved?.finished || saved?.transcript?.length) return;
    const contact = this.getContact('turbo');
    if (!contact?.available) return;
    const view = this.prepareContact(contact);
    if (!view) return;
    view.thread.schedule(definition);
    const pending = this.progression.data.dialogues[definition.id];
    if (pending && Number.isFinite(pending.receiveDueAt)) {
      pending.receiveDueAt = this.now();
      this.progression.save();
    }
  }

  scheduleSuperPlombierInvitation() {
    const flags = this.flags;
    if (
      !flags.superPlombierInvitationScheduled &&
      !flags.superPlombierInvitationReceived &&
      !this.progression.data.dialogues['turbo-flashzone-invitation']?.transcript?.length
    ) {
      flags.superPlombierInvitationDueAt = this.now() + SUPER_PLOMBIER_INVITATION_DELAY_MS;
      flags.superPlombierInvitationDelayVersion = 2;
      this.progression.save();
    }
  }

  prepareSuperPlombierInvitation() {
    if (
      this.progression.data.contactConnections?.luna?.status !== 'online' ||
      !this.progression.data.dialogues['turbo-smiley-catcher']?.finished
    )
      return;
    const flags = this.flags;
    const definition = this.definitions['turbo-flashzone-invitation'];
    if (!definition) return;
    const saved = this.progression.data.dialogues[definition.id];
    if (flags.superPlombierInvitationScheduled) {
      if (
        flags.superPlombierInvitationDelayVersion !== 2 &&
        !saved?.transcript?.length &&
        Number.isFinite(saved?.receiveDueAt)
      ) {
        saved.receiveDueAt += 5000;
        flags.superPlombierInvitationDelayVersion = 2;
        this.progression.save();
      }
      return;
    }
    if (!Number.isFinite(flags.superPlombierInvitationDueAt)) {
      flags.superPlombierInvitationDueAt = this.now() + SUPER_PLOMBIER_INVITATION_DELAY_MS;
      flags.superPlombierInvitationDelayVersion = 2;
      this.progression.save();
    } else if (flags.superPlombierInvitationDelayVersion !== 2) {
      flags.superPlombierInvitationDueAt += 5000;
      flags.superPlombierInvitationDelayVersion = 2;
      this.progression.save();
    }
    if (this.now() < flags.superPlombierInvitationDueAt) return;
    if (
      saved?.finished ||
      saved?.transcript?.length ||
      Number.isFinite(saved?.receiveDueAt)
    ) {
      flags.superPlombierInvitationScheduled = true;
      this.progression.save();
      return;
    }
    const contact = this.getContact('turbo');
    if (!contact?.available) return;
    const view = this.prepareContact(contact);
    if (!view) return;
    view.thread.schedule(definition);
    delete flags.superPlombierInvitationDueAt;
    if (Number.isFinite(this.progression.data.dialogues[definition.id]?.receiveDueAt)) {
      flags.superPlombierInvitationScheduled = true;
      this.progression.save();
    }
  }

  onMessage(contact) {
    if (contact.id === 'turbo') {
      if (this.progression.data.dialogues['turbo-flashzone-invitation']?.transcript?.length) {
        if (!this.flags.superPlombierInvitationNotificationShown) {
          this.flags.superPlombierInvitationNotificationShown = true;
          this.progression.save();
          return 'notify';
        }
        return 'handled';
      }
      if (this.flags.turboSmileyScene3ArrivalTriggered) return 'handled';
    }
    return false;
  }

  isConversationUnlocked(dialogueId) {
    return (
      this.progression.data.unlockedConversations.includes(dialogueId) ||
      (dialogueId === 'turbo-smiley-catcher' && this.flags.turboSmileyScene3ArrivalTriggered)
    );
  }

  onLink(url) {
    if (url !== 'http://www.flashzone.fr/jeux/super-plombier-flash') return;
    this.flags.superPlombierOpenedFromInvite = true;
    this.progression.save();
  }

  isEventAvailable(event) {
    return (
      event.id !== 'turbo-flashzone-invitation' ||
      this.progression.data.contactConnections?.luna?.status === 'online'
    );
  }

  compareEvents(a, b) {
    const order = { 'turbo-smiley-catcher': 0, 'turbo-flashzone-invitation': 1 };
    return (order[a.id] ?? 10) - (order[b.id] ?? 10);
  }

  afterMessengerUpdate(now = this.now()) {
    if (
      !this.flags.superPlombierInvitationReceived &&
      this.progression.data.dialogues['turbo-flashzone-invitation']?.transcript?.length
    ) {
      this.flags.superPlombierInvitationReceived = true;
      this.progression.save();
    }
    this.flushTurboMessageNotification(now);
  }

  update(now = this.now(), notify = true) {
    this.prepareTurboSceneMessage();
    this.dialogueEvents.update(now, notify);
    this.prepareSuperPlombierInvitation();
  }

  flushTurboMessageNotification(now = this.now()) {
    const dueAt = this.flags.turboSmileyScene3MessageNotificationDueAt;
    if (!Number.isFinite(dueAt)) return;
    if (this.flags.turboSmileyScene3Opened) {
      delete this.flags.turboSmileyScene3MessageNotificationDueAt;
      this.progression.save();
      return;
    }
    if (this.turboConnectionNotificationActive) return;
    if (!this.progression.data.dialogues['turbo-smiley-catcher']?.transcript?.length) return;
    if (now < dueAt) return;
    const contact = this.getContact('turbo');
    if (!contact?.online) return;
    this.showTurboMessageNotification(contact, () => {
      delete this.flags.turboSmileyScene3MessageNotificationDueAt;
      this.flags.turboSmileyScene3Notified = true;
      this.progression.save();
    });
  }

  resetTransientState() {
    this.turboConnectionNotificationActive = false;
  }
}
