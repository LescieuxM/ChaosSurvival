import contacts from '../config/contacts.json' with { type: 'json' };
import displayOrder from '../config/messenger-contact-order.json' with { type: 'json' };

export function orderedContacts(contacts) {
  const rank = new Map(displayOrder.map((id, index) => [id, index]));
  return [...contacts].sort(
    (a, b) => (rank.get(a.id) ?? displayOrder.length) - (rank.get(b.id) ?? displayOrder.length),
  );
}

export function visibleContacts(
  definitions,
  unlocked,
  roster = contacts,
  connections = {},
  profiles = {},
  flags = {},
) {
  return roster.flatMap((contact) => {
    const message = profiles?.[contact.id]?.personalMessage;
    const personalMessage = typeof message === 'string' ? { personalMessage: message } : {};
    const connected = contact.connection && connections[contact.id]?.status === 'online';
    if (contact.kind === 'decorative') {
      if (contact.connection && !connected && !contact.visibleInitially) return [];
      return [
        {
          ...contact,
          ...personalMessage,
          online: Boolean(connected),
          available: false,
          status: connected ? contact.status : 'Hors ligne',
        },
      ];
    }
    const definition = definitions[contact.dialogue];
    const available = Boolean(
      definition &&
        (unlocked.includes(contact.dialogue) ||
          (contact.unlockFlag && flags[contact.unlockFlag] === true)),
    );
    if (!available && !contact.visibleInitially) return [];
    const metadata = { ...contact, ...definition?.contact, id: contact.id };
    Object.assign(metadata, personalMessage);
    const online =
      !contact.alwaysOffline &&
      metadata.status !== 'Hors ligne' &&
      (contact.connection ? connected : available);
    return [{ ...metadata, online, available, status: online ? metadata.status : 'Hors ligne' }];
  });
}
