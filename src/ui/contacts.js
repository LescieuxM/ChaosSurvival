import contacts from '../config/contacts.json' with { type: 'json' };

export function visibleContacts(definitions, unlocked, roster = contacts, connections = {}) {
  return roster.flatMap((contact) => {
    if (contact.connection && connections[contact.id]?.status !== 'online') return [];
    if (contact.kind === 'decorative') return [{ ...contact, online: Boolean(contact.connection) }];
    if (!unlocked.includes(contact.dialogue) || !definitions[contact.dialogue]) return [];
    return [{ ...contact, ...definitions[contact.dialogue].contact, id: contact.id, online: true }];
  });
}
