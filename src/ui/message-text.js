const emoticons = {
  ':)': '☺',
  ':D': '☻',
  ';)': '😉',
  ':P': '😛',
  ':$': '😊',
  '<3': '♥',
  xD: '☻',
  ":')": '😂',
};
export function appendMessageText(element, text) {
  for (const part of text.split(/(:'\)|:\)|:D|;\)|:P|:\$|<3|xD)/g)) {
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
