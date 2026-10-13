import { DialogueSession } from '../story/dialogue.js';
import { ConversationThread } from '../story/conversation-thread.js';
import { applicationName } from './identity.js';

const emoticons = {
  ':)': '☺',
  ':D': '☻',
  ';)': '😉',
  ':P': '😛',
  ':$': '😊',
  '<3': '♥',
  xD: '☻',
  ':3': '😺',
  ":')": '😂',
};
export function appendMessageText(element, text) {
  for (const part of text.split(/(:'\)|:\)|:D|;\)|:P|:\$|<3|xD|:3)/g)) {
    if (!emoticons[part]) {
      element.append(document.createTextNode(part));
      continue;
    }
    const face = document.createElement('span');
    face.className = `msn-emoticon${part === '<3' ? ' heart' : ''}`;
    face.textContent = emoticons[part];
    face.title = part;
    face.setAttribute('role', 'img');
    face.setAttribute('aria-label', part);
    element.append(face);
  }
}

export class ConversationWindow {
  constructor(
    manager,
    dialogue,
    progression,
    sounds,
    onComplete,
    onFilesChanged = () => {},
    onCheckpoint = () => {},
    { isUnlocked = () => true, onWindowState = () => {}, thread } = {},
  ) {
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
  open() {
    if (this.element?.isConnected) {
      this.refresh();
      this.element.hidden = false;
      this.lastFrame = null;
      this.element.style.zIndex = ++this.manager.z;
      this.element.querySelector('.dialogue-choices button')?.focus();
      this.onWindowState({ open: true, minimized: false });
      return;
    }
    if (!this.isUnlocked()) return this.openContacts();
    this.dialogue = this.thread.activeDefinition;
    this.session = this.sessionFor(this.dialogue);
    const id = this.manager.spawn('narrative', {
      preview: true,
      x: 0.35,
      y: 0.15,
      content: {
        title: 'Conversation MSN',
        iconName: 'msn',
        body: /* HTML */ `
          <div class="msn-menu">
            Fichier <span>Édition</span><span>Actions</span><span>Aide</span>
          </div>
          <div class="msn-contact">
            <img class="story-avatar contact-avatar" alt="Avatar de PixelGirl" />
            <div>
              <strong class="contact-name"></strong
              ><small><i class="online-dot"></i><span class="contact-status"></span></small>
            </div>
          </div>
          <div class="conversation-content">
            <div
              class="conversation-log"
              role="log"
              aria-label="Messages de la conversation"
              aria-live="polite"
              aria-relevant="additions"
            ></div>
            <div class="conversation-portraits">
              <img class="story-avatar contact-avatar" alt="Avatar du contact" /><img
                class="story-avatar player-avatar"
                alt="Votre avatar"
              /><small>Image perso</small>
            </div>
          </div>
          <div class="msn-tools">
            <span>☺</span><span>♥</span><span>♫</span><small>Choisis une réponse ci-dessous</small>
          </div>
          <div class="conversation-reader">
            <button class="xp-button" id="pause-messages">Pause messages</button
            ><button class="text-button" id="read-latest">Derniers messages ↓</button>
          </div>
          <div class="dialogue-choices" aria-label="Réponses possibles"></div>
          <div class="window-status dialogue-typing" role="status"></div>
        `,
      },
      onDismiss: ({ reason }) => {
        const complete = reason === 'close' && this.session.state.finished;
        this.dispose();
        if (complete) this.onComplete(this.dialogue.id);
      },
    });
    this.element = this.manager.windows.get(id).element;
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
    this.element.querySelector('.window-title > span').textContent =
      `${this.dialogue.contact.nickname} — Conversation`;
    this.element
      .querySelector('.close-button')
      .setAttribute('aria-label', `Fermer ${applicationName('messenger')}`);
    this.element.querySelector('.contact-name').textContent = this.dialogue.contact.nickname;
    this.element.querySelector('.contact-avatar').alt = `Avatar de ${this.dialogue.contact.name}`;
    this.element.querySelector('.contact-status').textContent =
      `${this.dialogue.contact.status} · ${this.dialogue.contact.personalMessage ?? ''}`;
    for (const [selector, path] of [
      ['.contact-avatar', this.dialogue.contact.avatar],
      ['.player-avatar', this.dialogue.player.avatar],
    ]) {
      if (!/^\.\/avatars\/[a-z0-9-]+\.svg$/i.test(path)) throw new Error('Avatar local invalide.');
      this.element.querySelectorAll(selector).forEach((image) => {
        image.src = new URL(path, document.baseURI).href;
      });
    }
    this.log = this.element.querySelector('.conversation-log');
    this.choices = this.element.querySelector('.dialogue-choices');
    this.typing = this.element.querySelector('.dialogue-typing');
    this.paused = false;
    this.followLatest = true;
    this.reader = this.element.querySelector('#pause-messages');
    this.reader.addEventListener('click', () => {
      this.paused = !this.paused;
      this.reader.textContent = this.paused ? 'Reprendre les messages' : 'Pause messages';
      this.reader.setAttribute('aria-pressed', String(this.paused));
    });
    this.log.addEventListener('scroll', () => {
      this.followLatest = this.log.scrollHeight - this.log.clientHeight - this.log.scrollTop < 24;
    });
    this.element.querySelector('#read-latest').addEventListener('click', () => {
      this.followLatest = true;
      this.scrollLatest();
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
  renderTranscript() {
    this.log.replaceChildren();
    this.renderedKeys = new Set();
    this.appendHistory();
  }
  appendHistory() {
    for (const message of this.thread.sync()) {
      if (this.renderedKeys.has(message.key)) continue;
      this.renderedKeys.add(message.key);
      this.appendMessage(message);
    }
  }
  refresh() {
    if (!this.element?.isConnected || !this.log) return;
    this.appendHistory();
    this.renderResponses();
    const definition = this.thread.activeDefinition;
    if (this.dialogue.id === definition.id) {
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
    const author = document.createElement('small');
    author.textContent = `${message.speaker === 'player' ? this.dialogue.player.nickname : this.dialogue.contact.nickname} dit :`;
    const copy = document.createElement('p');
    appendMessageText(copy, message.text);
    row.append(author, copy);
    if (message.type === 'file') this.renderTransfer(row, message.fileKey);
    this.log.append(row);
    this.scrollLatest();
    return row;
  }
  scrollLatest() {
    if (this.followLatest) this.log.scrollTop = this.log.scrollHeight;
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
    this.renderResponses();
    for (let transitions = 0; transitions < 100; transitions++) {
      const message = this.session.nextMessage();
      if (message) {
        this.pending = message;
        this.stage = 'waiting';
        this.remaining = message.delayMs;
        this.typing.textContent = 'Dernier message reçu · connexion à 56k';
        this.scrollLatest();
        return;
      }
      if (this.session.advance()) continue;
      if (this.session.state.finished) {
        this.element.classList.add('contact-away');
        this.typing.textContent = `${this.dialogue.contact.name} est absente · à tout à l’heure !`;
        this.element.querySelector('.contact-status').textContent =
          'Partie choisir une image perso';
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
        if (!this.thread.pendingResponses.length) {
          this.choices.replaceChildren(button);
          this.responseSignature = JSON.stringify([]);
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
  renderResponses() {
    if (!this.choices || this.ghost) return;
    const groups = this.thread.pendingResponses;
    const signature = JSON.stringify(
      groups.map((group) => [
        group.definition.id,
        this.progression.data.dialogues[group.definition.id].node,
        group.choices.map((choice) => choice.id),
        group.position,
      ]),
    );
    if (signature === this.responseSignature) return;
    this.responseSignature = signature;
    this.choices.replaceChildren();
    this.log.querySelectorAll('.dialogue-history-choices').forEach((panel) => panel.remove());
    for (const [index, group] of groups.entries()) {
      const { definition } = group;
      const session = this.sessionFor(definition);
      session.offerChoices();
      const panel = index === groups.length - 1 ? this.choices : document.createElement('div');
      panel.dataset.eventId = definition.id;
      if (panel !== this.choices) {
        panel.className = 'dialogue-history-choices';
        const label = document.createElement('small');
        label.textContent = 'Tu peux encore répondre à ce message :';
        panel.append(label);
        const anchor = this.thread.state.history[group.position];
        const row = [...this.log.querySelectorAll('[data-message-key]')].find(
          (element) => element.dataset.messageKey === anchor?.key,
        );
        (row ?? this.log).append(panel);
      }
      for (const choice of group.choices) {
        const button = document.createElement('button');
        button.className = 'xp-button dialogue-choice';
        button.dataset.choiceId = choice.id;
        appendMessageText(button, choice.text);
        button.addEventListener('click', () => {
          if (!button.isConnected || button.disabled) return;
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
    if (!this.element?.isConnected) return;
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
    if (
      !document.hidden &&
      !this.element.hidden &&
      !this.paused &&
      this.followLatest &&
      !this.ghost &&
      this.pending
    ) {
      this.remaining -= delta;
      if (this.remaining <= 0) {
        if (this.stage === 'waiting') {
          this.stage = 'typing';
          this.remaining = this.pending.typingMs;
          this.typing.textContent = `${this.dialogue.contact.name} est en train d’écrire…`;
        } else {
          const message = this.session.deliver();
          this.pending = null;
          this.appendHistory();
          if (message.speaker === 'contact') this.sounds.play('message');
          this.pump();
        }
      }
    }
    this.frame = requestAnimationFrame((next) => this.tick(next));
  }
  dispose() {
    this.logObserver?.disconnect();
    cancelAnimationFrame(this.frame);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.pending = null;
    this.ghost = null;
    this.transfer = null;
    this.lastFrame = null;
    this.element = null;
    this.log = null;
    this.choices = null;
    this.session = null;
    this.renderedKeys = null;
    this.responseSignature = null;
    this.sessions.clear();
    this.onWindowState({ open: false, minimized: false });
  }
  openContacts() {
    const id = this.manager.spawn('narrative', {
      preview: true,
      x: 0.35,
      y: 0.15,
      content: {
        title: applicationName('messenger'),
        iconName: 'msn',
        body: `<div class="msn-contact"><div><strong>${applicationName('messenger')}</strong><small><i class="online-dot"></i> En ligne</small></div></div><div class="msn-contacts-empty"><h3>Mes contacts</h3><p>Aucun contact connecté pour le moment.</p><p>Tes conversations apparaîtront ici quand tes amis se connecteront :)</p></div>`,
      },
      onDismiss: () => this.dispose(),
    });
    this.element = this.manager.windows.get(id).element;
    this.element
      .querySelector('.close-button')
      .setAttribute('aria-label', `Fermer ${applicationName('messenger')}`);
    const minimize = document.createElement('button');
    minimize.className = 'msn-minimize';
    minimize.textContent = '−';
    minimize.setAttribute('aria-label', 'Réduire MSN');
    minimize.addEventListener('click', () => {
      this.element.hidden = true;
      this.onWindowState({ open: true, minimized: true });
    });
    this.element
      .querySelector('.titlebar')
      .insertBefore(minimize, this.element.querySelector('.close-button'));
    this.onWindowState({ open: true, minimized: false });
  }
}
