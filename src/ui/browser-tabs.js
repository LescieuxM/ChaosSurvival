import { textElement } from '../browser/dom.js';

export function renderBrowserTabs(list, session) {
  list.replaceChildren();
  for (const tab of session.tabs) {
    const group = textElement('div', undefined, 'browser-tab');
    group.setAttribute('role', 'tab');
    group.setAttribute('aria-selected', String(tab.id === session.active));
    const select = textElement('button', tab.title);
    select.dataset.browserAction = 'select';
    select.dataset.tabId = tab.id;
    select.title = tab.title;
    const close = textElement('button', '×');
    close.dataset.browserAction = 'close';
    close.dataset.tabId = tab.id;
    close.setAttribute('aria-label', `Fermer l'onglet ${tab.title}`);
    group.append(select, close);
    list.append(group);
  }
  const add = textElement('button', '+');
  add.dataset.browserAction = 'new';
  add.setAttribute('aria-label', 'Nouvel onglet');
  list.append(add);
}
