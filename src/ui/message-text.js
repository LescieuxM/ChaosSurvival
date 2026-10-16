const emoticons = {
  ':)': 'smile',
  ':D': 'smile',
  ':|': 'neutral',
  '>:)': 'devil',
  ';)': '😉',
  ':P': '😛',
  ':$': '😊',
  '<3': '♥',
  xD: '☻',
  ":')": '😂',
};
export function appendMessageText(element, text) {
  for (const part of text.split(/(>:\)|:'\)|:\)|:D|:\||;\)|:P|:\$|<3|xD)/g)) {
    if (!emoticons[part]) {
      element.append(document.createTextNode(part));
      continue;
    }
    const imageEmoticon = ['smile', 'neutral', 'devil'].includes(emoticons[part]);
    const face = document.createElement(imageEmoticon ? 'img' : 'span');
    face.className = `msn-emoticon${part === '<3' ? ' heart' : ''}`;
    if (imageEmoticon) {
      face.src = new URL(`./emoticons/msn-${emoticons[part]}.svg`, document.baseURI).href;
      face.alt = part;
    } else face.textContent = emoticons[part];
    face.title = part;
    face.setAttribute('role', 'img');
    face.setAttribute('aria-label', part);
    element.append(face);
  }
}
