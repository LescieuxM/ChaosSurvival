const GROUP_AVATARS = [
  ['./avatars/pixelgirl.svg', 'PixelGirl'],
  ['./avatars/turbo.svg', 'Turb0'],
  ['./avatars/luna.svg', 'Luna'],
];

export function createContactAvatar(contact, className = '') {
  if (contact.id !== 'plumber-group') {
    const image = document.createElement('img');
    if (className) image.className = className;
    image.src = contact.avatar;
    image.alt = `Avatar de ${contact.nickname}`;
    return image;
  }

  const composition = document.createElement('span');
  composition.className = `${className} contact-avatar-composition`.trim();
  composition.setAttribute('role', 'img');
  composition.setAttribute('aria-label', 'Avatars de PixelGirl, Turb0 et Luna');
  for (const [path, name] of GROUP_AVATARS) {
    const image = document.createElement('img');
    image.src = path;
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.dataset.avatar = name.toLowerCase();
    composition.append(image);
  }
  return composition;
}
