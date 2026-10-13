import { visibleContacts } from './contacts.js';
import { bindFileActivation } from '../utils/activation.js';

export class MessengerContacts {
  constructor(options) {
    Object.assign(this, options);
  }
  renderContacts() {
    if (!this.element?.isConnected) return;
    const list = this.element?.querySelector('.messenger-contact-list');
    if (!list) return;
    const definitions = this.getContactDefinitions();
    const contacts = visibleContacts(definitions, this.progression.data.unlockedConversations);
    const unreadFor = (contact) => this.getUnread?.(contact) ?? this.thread.state.unread.length;
    const signature = JSON.stringify(contacts);
    if (signature === this.contactsSignature) {
      // Updating badges must not replace a focused row during a double-click.
      for (const row of list.querySelectorAll('.messenger-contact-row')) {
        const contact = contacts.find((entry) => entry.id === row.dataset.contactId);
        const badge = row.querySelector('.contact-unread');
        if (badge && contact)
          badge.textContent = unreadFor(contact) ? String(unreadFor(contact)) : '☺';
      }
      return;
    }
    this.contactsSignature = signature;
    const collapsed = new Map(
      [...list.querySelectorAll('details')].map((group) => [group.dataset.group, !group.open]),
    );
    list.replaceChildren();
    for (const online of [true, false]) {
      const members = contacts.filter((contact) => contact.online === online);
      const group = document.createElement('details');
      group.dataset.group = String(online);
      group.open = !collapsed.get(String(online));
      const summary = document.createElement('summary');
      summary.textContent = `${online ? 'En ligne' : 'Hors ligne'} (${members.length})`;
      group.append(summary);
      for (const contact of members) {
        const row = document.createElement('button');
        row.className = `messenger-contact-row ${online ? 'online' : 'offline'}`;
        row.dataset.contactId = contact.id;
        const image = document.createElement('img');
        image.src = contact.avatar;
        image.alt = `Avatar de ${contact.nickname}`;
        const copy = document.createElement('span');
        const nickname = document.createElement('strong');
        nickname.textContent = contact.nickname;
        const status = document.createElement('small');
        status.textContent = `${contact.status} · ${contact.personalMessage ?? ''}`;
        copy.append(nickname, status);
        row.append(image, copy);
        if (contact.kind === 'narrative') {
          const badge = document.createElement('b');
          badge.className = 'contact-unread';
          badge.textContent = unreadFor(contact) ? String(unreadFor(contact)) : '☺';
          row.append(badge);
          bindFileActivation(row, () => this.onContactSelected(contact));
        } else {
          bindFileActivation(row, () => this.onContactSelected(contact));
        }
        row.addEventListener('click', () => {
          this.selectedContact = contact;
        });
        group.append(row);
      }
      if (!members.length) {
        const empty = document.createElement('p');
        empty.textContent = 'Personne en ligne pour le moment. Mes amis arrivent bientôt :)';
        group.append(empty);
      }
      list.append(group);
    }
  }
}
