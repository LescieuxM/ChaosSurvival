import definition from '../config/credits.json' with { type: 'json' };

function textNode(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

export class CreditsPage {
  constructor(root, { content = definition, onOpenSource } = {}) {
    this.root = root;
    this.element = document.createElement('section');
    this.element.className = 'credits-screen';
    this.element.tabIndex = 0;
    this.element.setAttribute('role', 'region');
    this.element.setAttribute('aria-label', `${content.title} — ${content.heading}`);
    const panel = document.createElement('article');
    panel.className = 'credits-panel';
    const header = document.createElement('header');
    header.append(textNode('p', content.title), textNode('h1', content.heading));
    panel.append(header);
    for (const section of content.sections) {
      const block = document.createElement('section');
      block.append(textNode('h2', section.title));
      for (const line of section.lines) block.append(textNode('p', line));
      if (section.sourceLink) {
        const url = new URL(section.sourceLink.url);
        if (
          url.protocol !== 'https:' ||
          url.hostname !== 'pixabay.com' ||
          url.port ||
          url.username ||
          url.password ||
          !/^\/music\/[a-z0-9-]+-\d+\/$/.test(url.pathname)
        )
          throw new Error('Invalid credits source URL.');
        const reference = document.createElement('p');
        reference.className = 'credits-source';
        const link = textNode('a', section.sourceLink.label);
        link.href = url.href;
        link.rel = 'noopener noreferrer';
        // Never navigate the Electron document or bypass its external-navigation policy.
        link.addEventListener('click', (event) => {
          event.preventDefault();
          onOpenSource?.(url.href);
        });
        reference.append(link, textNode('small', url.href));
        block.append(reference);
      }
      panel.append(block);
    }
    this.element.append(panel);
  }
  show() {
    if (this.element.parentNode !== this.root) {
      this.previousFocus = document.activeElement;
      this.root.append(this.element);
      this.element.scrollTop = 0;
      this.element.focus();
    }
    return this.element;
  }
  hide() {
    if (!this.element.parentNode) return;
    this.element.remove();
    if (this.previousFocus?.isConnected) this.previousFocus.focus();
    this.previousFocus = null;
  }
}
