import contacts from '../config/contacts.json' with { type: 'json' };

export function visibleContacts(definitions, unlocked, roster = contacts) {
  return roster.flatMap((contact) => {
    if (contact.kind === 'decorative') return [{ ...contact, online: false }];
    if (!unlocked.includes(contact.dialogue) || !definitions[contact.dialogue]) return [];
    return [{ ...contact, ...definitions[contact.dialogue].contact, id: contact.id, online: true }];
  });
}
