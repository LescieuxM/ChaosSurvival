import { DialogueSession } from '../story/dialogue.js';
import { ConversationThread } from '../story/conversation-thread.js';
import { applicationName } from './identity.js';
import { playerIdentity } from './player-identity.js';

import { appendMessageText } from './message-text.js';
export { appendMessageText } from './message-text.js';

export class ConversationWindow {
  constructor(
    manager,
    dialogue,
    progression,
    sounds,
    onComplete,
    onFilesChanged = () => {},
    onCheckpoint = () => {},
    {
      isUnlocked = () => true,
      onWindowState = () => {},
      thread,
      onContactsRequested,
      manageWindow,
      onDispose,
      player = playerIdentity,
    } = {},
  ) {
    this.onContactsRequested = onContactsRequested;
    this.manageWindow = manageWindow;
    this.onDispose = onDispose;
    this.player = player;
    this.manager = manager;
    this.dialogue = dialogue;
    this.progression = progression;
    this.sounds = sounds;
    this.onComplete = onComplete;
    this.onFilesChanged = onFilesChanged;
    this.onCheckpoint = onCheckpoint;
    this.isUnlocked = isUnlocked;
    this.onWindowState = onWindowState;
    this.thread =
      thread ??
      new ConversationThread(dialogue.contact.name.toLowerCase(), progression, () => [dialogue]);
    this.sessions = new Map();
  }
  sessionFor(definition) {
    const existing = this.sessions.get(definition.id);
    if (existing && existing.state === this.progression.data.dialogues[definition.id])
      return existing;
    const session = new DialogueSession(definition, this.progression);
    this.sessions.set(definition.id, session);
    return session;
  }
  openOffline(contact) {
    if (this.element?.isConnected && this.offlineContact?.id === contact.id) return this.restore();
    this.closeForViewSwitch();
    this.offlineContact = contact;
    this.open(true);
  }
  open(keepOffline = false) {
    if (!keepOffline && this.offlineContact) {
      this.closeForViewSwitch();
      this.offlineContact = null;
    }
    if (this.element?.isConnected) {
      this.refresh();
      this.element.hidden = false;
      this.lastFrame = null;
      this.element.style.zIndex = ++this.manager.z;
      this.element.querySelector('.dialogue-choices button')?.focus();
      this.onWindowState({ open: true, minimized: false });
      return;
    }
    if (!this.offlineContact && !this.isUnlocked()) return this.openContacts();
    this.dialogue = this.offlineContact
      ? { contact: this.offlineContact, player: this.player }
      : this.thread.activeDefinition;
    this.session = this.offlineContact ? null : this.sessionFor(this.dialogue);
    const id = this.manager.spawn('narrative', {
      preview: true,
      x: 0.35,
      y: 0.15,
      content: {
        title: 'Conversation MSN',
        iconName: 'msn',
        body: /* HTML */ `
          <div class="msn-menu"></div>
          <div class="msn-contact">
            <img class="story-avatar contact-avatar" alt="Avatar de PixelGirl" />
            <div>
              <strong class="contact-name"></strong
              ><small><i class="online-dot"></i><span class="contact-status"></span></small>
            </div>
          </div>
          <div class="conversation-content">
            <div class="conversation-history">
              <div
                class="conversation-log"
                role="log"
                aria-label="Messages de la conversation"
                aria-live="polite"
                aria-relevant="additions"
              >
                <div class="conversation-flow"></div>
              </div>
              <div class="contact-typing" role="status" aria-live="polite" hidden></div>
            </div>
            <div class="conversation-portraits">
              <img class="story-avatar contact-avatar" alt="Avatar du contact" /><img
                class="story-avatar player-avatar"
                alt="Votre avatar"
              />
            </div>
          </div>
          <div class="msn-tools">
            <button class="text-button" data-msn-action="wizz">Wizz !</button>
          </div>
          <div class="dialogue-choices" aria-label="Réponses possibles"></div>
          <div class="window-status dialogue-typing" role="status"></div>
        `,
      },
      onDismiss: ({ reason }) => {
        const complete =
          reason === 'close' &&
          !this.switchingView &&
          !this.offlineContact &&
          this.session?.state.finished;
        this.dispose();
        if (complete) this.onComplete(this.dialogue.id);
      },
    });
    this.element = this.manager.windows.get(id).element;
    this.element.classList.toggle(
      'contact-offline',
      Boolean(this.offlineContact && !this.offlineContact.online),
    );
    if (this.manageWindow) this.manageWindow(this);
    else {
      const minimize = document.createElement('button');
      minimize.className = 'msn-minimize';
      minimize.textContent = '−';
      minimize.setAttribute('aria-label', 'Réduire MSN');
      minimize.addEventListener('click', () => {
        this.element.hidden = true;
        this.lastFrame = null;
        this.onWindowState({ open: true, minimized: true });
        if (this.ghost) {
          this.ghost.remove();
          this.ghost = null;
          this.pump();
        }
      });
      this.element
        .querySelector('.titlebar')
        .insertBefore(minimize, this.element.querySelector('.close-button'));
    }
    this.element.querySelector('.window-title > span').textContent =
      `${this.dialogue.contact.nickname} — Conversation`;
    this.element
      .querySelector('.close-button')
      .setAttribute('aria-label', `Fermer ${applicationName('messenger')}`);
    this.element.querySelector('.contact-name').textContent = this.dialogue.contact.nickname;
    this.element.querySelector('.contact-avatar').alt =
      `Avatar de ${this.dialogue.contact.name ?? this.dialogue.contact.nickname}`;
    this.element.querySelector('.contact-status').textContent =
      `${this.dialogue.contact.status} · ${this.dialogue.contact.personalMessage ?? ''}`;
    for (const [selector, path] of [
      ['.contact-avatar', this.dialogue.contact.avatar],
      ['.player-avatar', this.player.avatar],
    ]) {
      if (!/^\.\/avatars\/[a-z0-9-]+\.svg$/i.test(path)) throw new Error('Avatar local invalide.');
      this.element.querySelectorAll(selector).forEach((image) => {
        image.src = new URL(path, document.baseURI).href;
      });
    }
    this.log = this.element.querySelector('.conversation-log');
    this.history = this.element.querySelector('.conversation-history');
    this.flow = this.element.querySelector('.conversation-flow');
    this.choices = this.element.querySelector('.dialogue-choices');
    this.typing = this.element.querySelector('.dialogue-typing');
    this.typingIndicator = this.element.querySelector('.contact-typing');
    this.followLatest = true;
    const log = this.log;
    this.log.addEventListener('scroll', () => {
      if (this.log !== log || !log.isConnected) return;
      this.followLatest = log.scrollHeight - log.clientHeight - log.scrollTop < 24;
    });
    this.logObserver = new ResizeObserver(() => {
      if (this.element?.isConnected) this.scrollLatest();
    });
    this.logObserver.observe(this.log);
    this.renderTranscript();
    this.onVisibility = () => {
      this.lastFrame = null;
    };
    document.addEventListener('visibilitychange', this.onVisibility);
    this.sounds.unlock();
    this.onWindowState({ open: true, minimized: false });
    this.pump();
    this.frame = requestAnimationFrame((time) => this.tick(time));
  }
  restore() {
    if (!this.element?.isConnected) return this.open(Boolean(this.offlineContact));
    this.element.hidden = false;
    this.element.style.zIndex = ++this.manager.z;
    this.lastFrame = null;
    this.refresh();
    this.onWindowState({ open: true, minimized: false });
  }
  renderTranscript() {
    (this.flow ?? this.log).replaceChildren();
    this.renderedKeys = new Set();
    this.appendHistory();
  }
  appendHistory() {
    if (this.offlineContact) return;
    for (const message of this.thread.sync()) {
      if (this.renderedKeys.has(message.key)) continue;
      this.renderedKeys.add(message.key);
      this.appendMessage(message);
    }
  }
  refresh() {
    if (this.offlineContact && this.log) return;
    if (!this.element?.isConnected || !this.log) return;
    this.appendHistory();
    this.renderResponses();
    this.renderTyping();
    const definition = this.thread.activeDefinition;
    if (this.dialogue.id === definition.id) {
      if (this.receiving && !this.thread.isReceiving(definition.id)) this.pump();
      return;
    }
    // Only completed events yield control; pending choices and transfers stay intact.
    if (
      (!this.session.state.finished &&
        !this.session.choices.length &&
        !this.session.node.transfer) ||
      this.transfer ||
      this.ghost
    )
      return;
    this.dialogue = definition;
    this.element.classList.remove('contact-away');
    this.element.querySelector('.contact-status').textContent =
      `${definition.contact.status} · ${definition.contact.personalMessage ?? ''}`;
    this.session = this.sessionFor(definition);
    this.pending = null;
    this.ghost?.remove();
    this.ghost = null;
    this.transfer = null;
    this.lastFrame = null;
    this.appendHistory();
    this.pump();
  }
  appendMessage(message) {
    const row = document.createElement('div');
    row.className = `conversation-message ${message.speaker === 'player' ? 'from-player' : 'from-contact'}`;
    if (message.key) row.dataset.messageKey = message.key;
    if (message.type === 'wizz') {
      row.className = 'conversation-message conversation-system';
      row.textContent =
        message.speaker === 'player'
          ? `${(this.player ?? playerIdentity).nickname} vous a envoyé un wizz !`
          : message.text;
      (this.flow ?? this.log).append(row);
      this.scrollLatest();
      return row;
    }
    const author = document.createElement('small');
    author.textContent = `${message.speaker === 'player' ? (this.player ?? playerIdentity).nickname : this.dialogue.contact.nickname} dit :`;
    const copy = document.createElement('p');
    appendMessageText(copy, message.text);
    row.append(author, copy);
    if (message.type === 'file') this.renderTransfer(row, message.fileKey);
    (this.flow ?? this.log).append(row);
    this.scrollLatest();
    return row;
  }
  scrollLatest() {
    if (this.followLatest && this.log?.isConnected) this.log.scrollTop = this.log.scrollHeight;
  }
  renderTransfer(row, key) {
    const file = this.progression.data.files[key];
    if (!file) return;
    const owner = this.thread.getEvents().find((event) => event.id === file.dialogue);
    const session = owner ? this.sessionFor(owner) : this.session;
    const card = document.createElement('div');
    card.className = 'msn-transfer';
    card.dataset.fileKey = key;
    const title = document.createElement('strong');
    title.textContent = `📎 ${file.name} (${file.sizeLabel})`;
    const status = document.createElement('small');
    status.textContent =
      file.status === 'complete'
        ? 'Transfert terminé'
        : file.status === 'declined'
          ? 'Transfert refusé'
          : file.direction === 'send'
            ? 'Fichier prêt à envoyer'
            : 'Un fichier vous est proposé';
    const meter = document.createElement('progress');
    meter.max = 1;
    meter.value = file.status === 'complete' ? 1 : 0;
    const button = document.createElement('button');
    button.className = 'xp-button transfer-accept';
    button.textContent = file.direction === 'send' ? 'Envoyer' : 'Accepter';
    button.hidden = file.status !== 'pending';
    const refuse = document.createElement('button');
    refuse.className = 'xp-button transfer-refuse';
    refuse.textContent = 'Refuser';
    refuse.hidden = file.status !== 'pending' || file.direction === 'send';
    refuse.addEventListener('click', () => {
      if (this.transfer?.key === key || !session.declineTransfer(key)) return;
      status.textContent = 'Transfert refusé';
      button.hidden = true;
      refuse.hidden = true;
      if (!this.pending) this.pump();
    });
    button.addEventListener('click', () => {
      if (this.transfer) return;
      button.disabled = true;
      status.textContent = 'Transfert en cours…';
      refuse.hidden = true;
      this.transfer = { key, elapsed: 0, meter, status, button };
      this.sounds.play('send');
    });
    card.append(title, status, meter, button, refuse);
    row.append(card);
  }
  pump() {
    if (this.offlineContact) {
      this.choices.replaceChildren();
      this.typing.textContent = this.offlineContact.online
        ? 'Ce contact n’a pas encore envoyé de message.'
        : 'Ce contact est hors ligne. L\u2019envoi de messages est indisponible.';
      if (this.typingIndicator) this.typingIndicator.hidden = true;
      return;
    }
    this.renderResponses();
    this.renderTyping();
    this.receiving = this.thread.isReceiving(this.session.dialogue.id);
    if (this.receiving) {
      this.pending = null;
      this.typing.textContent = '';
      this.renderTyping();
      return;
    }
    for (let transitions = 0; transitions < 100; transitions++) {
      const message = this.session.nextMessage();
      if (message) {
        this.thread.schedule(this.dialogue);
        this.receiving = true;
        this.pending = null;
        this.renderTyping();
        this.typing.textContent = '';
        this.scrollLatest();
        return;
      }
      if (this.session.advance()) continue;
      if (this.session.state.finished) {
        const stayOnline = this.dialogue.completion?.stayOnline;
        this.element.classList.toggle('contact-away', !stayOnline);
        this.typing.textContent = stayOnline
          ? ''
          : `${this.dialogue.contact.name} est absente · à tout à l’heure !`;
        this.element.querySelector('.contact-status').textContent = stayOnline
          ? `${this.dialogue.contact.status} · ${this.dialogue.contact.personalMessage ?? ''}`
          : 'Partie choisir une image perso';
        const button = document.createElement('button');
        button.className = 'xp-button';
        button.classList.add('conversation-return');
        button.textContent = 'Retour au bureau';
        const pendingFile = this.session.state.transcript.some(
          (entry) =>
            entry.type === 'file' &&
            this.progression.data.files[entry.fileKey]?.status === 'pending',
        );
        button.disabled = pendingFile;
        if (!pendingFile) this.onCheckpoint(this.dialogue.id);
        if (pendingFile) this.typing.textContent = 'Termine le transfert quand tu le souhaites.';
        button.addEventListener('click', () => {
          const id = Number(this.element.dataset.windowId);
          this.manager.close(id);
        });
        if (!this.thread.pendingResponses.length && !this.thread.hasPendingMessages) {
          this.choices.replaceChildren(button);
          this.responseSignature = JSON.stringify([false, []]);
        } else {
          this.element.classList.remove('contact-away');
          this.typing.textContent = 'À toi de répondre :)';
        }
        this.scrollLatest();
        return;
      }
      this.typing.textContent = 'À toi de répondre :)';
      if (this.session.node.transfer) {
        this.typing.textContent = 'Tu peux accepter ou refuser le fichier quand tu veux.';
        return;
      }
      this.renderResponses();
      this.scrollLatest();
      return;
    }
    throw new Error('Le dialogue contient une boucle automatique.');
  }
  renderTyping(now = Date.now()) {
    if (!this.typingIndicator) return;
    const contact = this.offlineContact ? null : this.thread.typingContact(now);
    const text = contact ? `${contact.nickname ?? contact.name} est en train d'écrire...` : '';
    const changed = this.typingIndicator.textContent !== text;
    if (changed) this.typingIndicator.textContent = text;
    this.typingIndicator.classList.toggle('is-typing', Boolean(contact));
    this.typingIndicator.hidden = !contact;
  }
  renderResponses() {
    if (this.offlineContact) return;
    if (!this.choices || this.ghost) return;
    // One narrative question at a time, in order. Other questions stay saved.
    const groups = this.thread.availableResponses.slice(0, 1);
    const signature = JSON.stringify([
      this.thread.hasPendingMessages,
      groups.map((group) => [
        group.definition.id,
        this.progression.data.dialogues[group.definition.id].node,
        group.choices.map((choice) => choice.id),
        group.position,
      ]),
    ]);
    if (signature === this.responseSignature) return;
    this.responseSignature = signature;
    this.choices.replaceChildren();
    for (const group of groups) {
      const { definition } = group;
      const session = this.sessionFor(definition);
      session.offerChoices();
      const panel = this.choices;
      panel.dataset.eventId = definition.id;
      for (const choice of group.choices) {
        const button = document.createElement('button');
        button.className = 'xp-button dialogue-choice';
        button.dataset.choiceId = choice.id;
        appendMessageText(button, choice.text);
        button.addEventListener('click', () => {
          if (!button.isConnected || button.disabled || this.thread.hasPendingMessages) return;
          panel.querySelectorAll('button').forEach((item) => {
            item.disabled = true;
          });
          session.choose(choice.id);
          this.dialogue = definition;
          this.session = session;
          this.pending = null;
          this.lastFrame = null;
          this.element.classList.remove('contact-away');
          this.sounds.play('send');
          this.appendHistory();
          this.renderResponses();
          const echo = this.session.takeEcho();
          if (echo) {
            this.choices.replaceChildren();
            this.ghost = this.appendMessage({ speaker: 'player', text: echo.text });
            this.ghost.classList.add('dialogue-echo');
            this.echoRemaining = echo.durationMs;
            this.typing.textContent = '';
            return;
          }
          this.pump();
          this.choices.querySelector('button')?.focus();
        });
        panel.append(button);
      }
    }
    if (groups.length) this.element.classList.remove('contact-away');
  }
  tick(time) {
    if (!this.element?.isConnected || this.offlineContact) return;
    const delta =
      this.lastFrame === null || this.lastFrame === undefined ? 0 : time - this.lastFrame;
    this.lastFrame = time;
    if (!document.hidden && !this.element.hidden && this.ghost) {
      this.echoRemaining -= delta;
      if (this.echoRemaining <= 0) {
        this.ghost.remove();
        this.ghost = null;
        this.pump();
      }
    }
    if (!document.hidden && !this.element.hidden && this.transfer) {
      const transfer = this.transfer;
      transfer.elapsed += delta;
      transfer.meter.value = Math.min(1, transfer.elapsed / 1800);
      if (transfer.elapsed >= 1800) {
        this.progression.finishTransfer(transfer.key);
        transfer.status.textContent = 'Transfert terminé';
        transfer.button.hidden = true;
        this.transfer = null;
        this.onFilesChanged();
        this.sounds.play('message');
        if (!this.pending) this.pump();
      }
    }
    this.renderTyping();
    this.frame = requestAnimationFrame((next) => this.tick(next));
  }
  dispose() {
    this.onDispose?.(this);
    this.logObserver?.disconnect();
    cancelAnimationFrame(this.frame);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.pending = null;
    this.ghost = null;
    this.transfer = null;
    this.lastFrame = null;
    this.element = null;
    this.log = null;
    this.flow = null;
    this.history = null;
    this.typingIndicator = null;
    this.choices = null;
    this.session = null;
    this.renderedKeys = null;
    this.responseSignature = null;
    this.contactsSignature = null;
    this.sessions.clear();
    this.onWindowState({ open: false, minimized: false });
  }
  openContacts() {
    return this.onContactsRequested?.();
  }
  closeForViewSwitch() {
    if (!this.element?.isConnected) return;
    this.switchingView = true;
    try {
      this.manager.close(Number(this.element.dataset.windowId));
    } finally {
      this.switchingView = false;
    }
  }
  showContacts() {
    return this.onContactsRequested?.();
  }
}
