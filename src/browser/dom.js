// Site content is text. Navigation is interpreted only by Internet Adventurer.
export function textElement(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
export function internalLink(text, url) {
  const element = textElement('a', text);
  element.href = '#';
  element.dataset.browserLink = url;
  return element;
}
