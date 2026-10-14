import { visibleContacts } from './contacts.js';
import { MessengerContacts } from './messenger-contacts.js';
import { messengerMenu } from './messenger-menu.js';
import { applicationName } from './identity.js';
import { playerIdentity } from './player-identity.js';

export class Messenger {
  constructor({
    manager,
    applications,
    progression,
    sounds,
    player = playerIdentity,
    definitions,
    primary,
    createConversation,
    settings,
    onWindowState,
    onMessage = () => {},
  }) {
    Object.assign(this, {
      manager,
      applications,
      progression,
      sounds,
      player,
      definitions,
      primary,
      createConversation,
      settings,
      onWindowState,
      onMessage,
    });
    this.conversations = new Map();
    this.views = new Map();
  }
  contacts() {
    return visibleContacts(
      this.definitions(),
      this.progression.data.unlockedConversations,
      undefined,
      this.progression.data.contactConnections,
      this.progression.data.contactProfiles,
    );
  }
  open() {
    const existing = this.views.get('contacts');
    if (existing?.element.isConnected) {
      this.applications.restore(existing);
      this.roster.renderContacts();
      return existing;
    }
    const instance = this.panel(
      'contacts',
      applicationName('messenger'),
      '<div class="msn-menu"></div><div class="msn-contact msn-self"><img class="story-avatar" alt="Votre avatar" /><div><strong></strong><small><i class="online-dot"></i> En ligne</small></div></div><div class="messenger-contact-list"></div><div class="window-status">Connecté · Windows Love Messenger</div>',
    );
    instance.element.classList.add('messenger-roster');
    instance.element.querySelector('.msn-self img').src = this.player.avatar;
    instance.element.querySelector('.msn-self strong').textContent = this.player.nickname;
    this.roster = new MessengerContacts({
      element: instance.element,
      progression: this.progression,
      thread: this.primary().thread,
      getContactDefinitions: this.definitions,
      onContactSelected: (contact) => this.openContact(contact),
      getUnread: (contact) => this.progression.data.conversations?.[contact.id]?.unread.length ?? 0,
    });
    this.installMenus(instance.element, () => this.roster.selectedContact);
    this.roster.renderContacts();
    return instance;
  }
  openContact(contact) {
    contact = this.contacts().find((entry) => entry.id === contact.id);
    if (!contact) return;
    let view = contact.id === 'pixelgirl' ? this.primary() : this.conversations.get(contact.id);
    if (!view) {
      view = this.createConversation(contact);
      this.conversations.set(contact.id, view);
    }
    if (contact.kind === 'decorative' || contact.available === false) view.openOffline(contact);
    else view.open();
    return view;
  }
  attachConversation(view, contactId) {
    const key = `messenger:conversation:${contactId}`;
    const instance = this.applications.attachWindow(
      key,
      Number(view.element.dataset.windowId),
      `${view.dialogue.contact.nickname} — Conversation`,
      'msn',
    );
    view.messengerInstance = instance;
    view.element.dataset.messengerContact = contactId;
    this.installMenus(
      view.element,
      () => view.dialogue.contact,
      () => Boolean(view.offlineContact),
    );
  }
  disposeConversation(view) {
    view.element?.disposeMenu?.();
    const instance = view.messengerInstance;
    if (!instance) return;
    instance.task.remove();
    this.applications.instances.delete(instance.kind);
    view.messengerInstance = null;
    this.onWindowState();
  }
  panel(key, title, body) {
    const existing = this.views.get(key);
    if (existing?.element.isConnected) {
      this.applications.restore(existing);
      return existing;
    }
    let instance;
    const id = this.manager.spawn('narrative', {
      preview: true,
      content: { title, iconName: 'msn', body },
      onDismiss: () => {
        instance.element.disposeMenu?.();
        instance.task.remove();
        this.views.delete(key);
        this.applications.instances.delete(instance.kind);
        this.onWindowState();
      },
    });
    instance = this.applications.attachWindow(`messenger:${key}`, id, title, 'msn');
    instance.element.classList.add('messenger-panel');
    instance.element.dataset.messengerView = key;
    this.views.set(key, instance);
    this.onWindowState();
    return instance;
  }
  profile(contact) {
    if (!contact)
      return this.panel(
        'profile-help',
        'Profil du contact',
        '<div class="messenger-profile"><p>Sélectionne un contact dans la liste puis choisis Contacts → Consulter le profil.</p></div>',
      );
    contact =
      this.contacts().find(
        (entry) => entry.id === contact.id || entry.nickname === contact.nickname,
      ) ?? contact;
    const instance = this.panel(
      `profile:${contact.id ?? contact.name}`,
      'Profil du contact',
      '<div class="messenger-profile messenger-contact-profile"><div class="profile-header"><div class="profile-avatar-frame"><img class="story-avatar" alt="Avatar du contact" /></div><div class="profile-identity"><h3></h3><p class="profile-status"></p></div></div><p class="profile-message"></p></div>',
    );
    instance.profileContactId = contact.id;
    this.renderProfile(instance, contact);
    return instance;
  }
  renderProfile(instance, contact) {
    const signature = JSON.stringify([
      contact.avatar,
      contact.nickname,
      contact.status,
      contact.personalMessage,
    ]);
    if (signature === instance.profileSignature) return;
    instance.profileSignature = signature;
    const element = instance.element;
    element.querySelector('.messenger-profile img').src = contact.avatar;
    element.querySelector('h3').textContent = contact.nickname;
    element.querySelector('.profile-status').textContent = contact.status;
    element.querySelector('.profile-message').textContent = contact.personalMessage ?? '';
    element.querySelector('.profile-message').hidden = !contact.personalMessage;
  }
  options() {
    const instance = this.panel(
      'options',
      'Options de Messenger',
      '<div class="messenger-profile"><h3>Sons et notifications</h3><label>Volume des effets sonores <input class="messenger-volume" type="range" min="0" max="100" /></label><p>Ce volume est partagé avec les effets du jeu. Les messages restent disponibles après fermeture de Messenger.</p></div>',
    );
    const input = instance.element.querySelector('input');
    input.value = Math.round(this.settings.data.effectsVolume * 100);
    input.oninput = () => this.settings.update({ effectsVolume: Number(input.value) / 100 });
  }
  emoticons() {
    const instance = this.panel(
      'emoticons',
      'Émoticônes',
      '<div class="messenger-profile"><h3>Mes émoticônes préférées</h3><div class="messenger-emoticons"></div><p class="emoticon-preview">Choisis une émoticône pour son aperçu. Les messages se choisissent dans la zone de réponse.</p></div>',
    );
    const list = instance.element.querySelector('.messenger-emoticons');
    list.replaceChildren();
    for (const text of [':)', ':D', ';)', ':3', '<3', " :')", 'xD']) {
      const button = document.createElement('button');
      button.className = 'xp-button';
      button.textContent = text;
      button.onclick = () => {
        instance.element.querySelector('.emoticon-preview').textContent = text;
      };
      list.append(button);
    }
  }
  sendWizz(contactId, { speaker = 'player', eventId, now } = {}) {
    const contact = this.contacts().find((entry) => entry.id === contactId);
    if (
      !contact ||
      contact.kind === 'decorative' ||
      contact.online === false ||
      contact.status === 'Hors ligne'
    )
      return false;
    let view = contactId === 'pixelgirl' ? this.primary() : this.conversations.get(contactId);
    if (!view) {
      view = this.createConversation(contact);
      this.conversations.set(contactId, view);
    }
    const sender = speaker === 'player' ? this.player : contact;
    if (!view.thread.appendWizz(speaker, sender.nickname, eventId, now)) return false;
    view.refresh();
    const element = view.element;
    if (element?.isConnected) {
      element.classList.remove('messenger-wizz');
      void element.offsetWidth;
      element.classList.add('messenger-wizz');
    }
    this.sounds.unlock().then(() => this.sounds.play('wizz'));
    if (speaker === 'contact' && !this.isVisible(view)) this.onMessage(contact);
    return true;
  }
  receiveWizz(contactId, eventId) {
    return this.sendWizz(contactId, { speaker: 'contact', eventId });
  }
  installMenus(element, contact, offline = () => false) {
    element.disposeMenu?.();
    const wizz = () => {
      if (offline() || element.classList.contains('messenger-roster')) return;
      this.sendWizz(element.dataset.messengerContact);
    };
    const wizzButton = element.querySelector('[data-msn-action="wizz"]');
    if (wizzButton) {
      wizzButton.disabled = offline();
      wizzButton.addEventListener('click', wizz);
    }
    element.disposeMenu = messengerMenu(element, [
      [
        'Fichier',
        [
          {
            label: 'Fermer la fenêtre',
            run: () => this.manager.close(Number(element.dataset.windowId)),
          },
        ],
      ],
      [
        'Contacts',
        [
          { label: 'Liste des contacts', run: () => this.open() },
          {
            label: 'Consulter le profil',
            run: () => this.profile(contact()),
            disabled: !contact() && !element.classList.contains('messenger-roster'),
          },
        ],
      ],
      [
        'Actions',
        [
          { label: 'Émoticônes', run: () => this.emoticons() },
          {
            label: 'Wizz !',
            disabled: offline() || element.classList.contains('messenger-roster'),
            run: wizz,
          },
        ],
      ],
      ['Outils', [{ label: 'Options de Messenger', run: () => this.options() }]],
      [
        'Aide',
        [
          {
            label: 'À propos',
            run: () =>
              this.panel(
                'about',
                'À propos de Windows Love Messenger',
                '<div class="messenger-profile"><h3>Windows Love Messenger ♥</h3><p>Édition Windows XD · 2009</p><p>Les amis, les smileys et les Wizz ! Une application fictive de Chaos Survival. Sons originaux synthétisés localement.</p></div>',
              ),
          },
        ],
      ],
    ]);
  }
  isVisible(view) {
    if (!view.element?.isConnected || view.element.hidden) return false;
    return ![...this.manager.windows.values()].some(
      ({ element }) =>
        element.isConnected &&
        !element.hidden &&
        Number(element.style.zIndex) > Number(view.element.style.zIndex),
    );
  }
  update() {
    this.roster?.renderContacts();
    const contacts = this.contacts();
    for (const instance of this.views.values()) {
      if (!instance.profileContactId) continue;
      const contact = contacts.find((entry) => entry.id === instance.profileContactId);
      if (contact) this.renderProfile(instance, contact);
    }
    for (const view of [this.primary(), ...this.conversations.values()]) {
      if (view !== this.primary() && !view.offlineContact) {
        const incoming = view.thread.receive();
        if (incoming.length) {
          this.sounds.unlock().then(() => this.sounds.play('message'));
          if (!this.isVisible(view)) this.onMessage(view.dialogue.contact);
        }
      }
      view.refresh();
      if (view.offlineContact) continue;
      if (this.isVisible(view) && view.followLatest) view.thread.markRead();
      const task = view.messengerInstance?.task;
      const unread = view.thread.state.unread.length;
      task?.classList.toggle('messenger-unread', unread > 0 && !this.isVisible(view));
      if (task)
        task.title = unread ? `${unread} message(s) non lu(s)` : view.dialogue.contact.nickname;
    }
  }
}
