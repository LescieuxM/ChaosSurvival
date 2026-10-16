export function bombArenaRedownloadDialogue(id, group) {
  return {
    id,
    version: 1,
    revision: 1,
    contact: group.contact,
    participants: group.participants,
    player: group.player,
    start: 'offer',
    completion: { stayOnline: true },
    nodes: {
      offer: {
        messages: [
          {
            speaker: 'contact',
            author: 'xX_PixelGirl_Xx',
            text: 'tiens tu peux le télécharger',
            delayMs: 450,
            typingMs: 400,
          },
          {
            speaker: 'contact',
            author: 'xX_PixelGirl_Xx',
            type: 'file',
            text: 'BombArena.zip',
            file: {
              id: 'bomb-arena',
              name: 'BombArena.zip',
              sizeLabel: '18 Mo',
              size: 18874368,
              description: 'Archive ZIP',
              deletable: true,
              extractable: 'bomb-arena',
              reusableAfterDelete: true,
            },
            delayMs: 300,
            typingMs: 350,
          },
        ],
        transfer: { fileId: 'bomb-arena', accept: 'done', refuse: 'done' },
      },
      done: { messages: [], end: true },
    },
  };
}
