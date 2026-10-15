import test from 'node:test';
import assert from 'node:assert/strict';
import { textElement, internalLink } from '../src/browser/dom.js';
import { foldText } from '../src/browser/text.js';
import { renderBrowserTabs } from '../src/ui/browser-tabs.js';

test('shared site primitives preserve text, optional attributes and strictly internal navigation', (t) => {
  const previous = globalThis.document;
  globalThis.document = {
    createElement(tag) {
      return {
        tag,
        dataset: {},
        set innerHTML(_) {
          throw Error('HTML sink');
        },
      };
    },
  };
  t.after(() => {
    globalThis.document = previous;
  });
  const text = '<img src=x onerror=alert(1)> & "texte"';
  const element = textElement('p', text, 'example');
  assert.equal(element.textContent, text);
  assert.equal(element.className, 'example');
  const empty = textElement('span');
  assert.equal(empty.textContent, undefined);
  assert.equal(empty.className, undefined);
  const link = internalLink(text, 'http://www.wiki.fr/article/internet');
  assert.equal(link.textContent, text);
  assert.equal(link.href, '#');
  assert.equal(link.dataset.browserLink, 'http://www.wiki.fr/article/internet');
});

test('shared normalization preserves whitespace and punctuation for callers to handle', () => {
  assert.equal(foldText(' ÉLECTRONIQUE & Wiki '), ' electronique & wiki ');
  assert.equal(foldText(2009), '2009');
});

test('tab rendering keeps stable IDs/order, active selection, close actions and literal titles', (t) => {
  const previous = globalThis.document;
  const element = (tag) => ({
    tag,
    children: [],
    dataset: {},
    attributes: {},
    append(...children) {
      this.children.push(...children);
    },
    replaceChildren(...children) {
      this.children = children;
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    set innerHTML(_) {
      throw Error('HTML sink');
    },
  });
  globalThis.document = { createElement: element };
  t.after(() => {
    globalThis.document = previous;
  });
  const list = element('div');
  const session = {
    active: 'second',
    tabs: [
      { id: 'first', title: '<script>alert(1)</script>' },
      { id: 'second', title: 'Wiki' },
    ],
  };
  renderBrowserTabs(list, session);
  assert.equal(list.children.length, 3);
  assert.deepEqual(
    list.children.slice(0, 2).map((n) => n.children[0].dataset.tabId),
    ['first', 'second'],
  );
  assert.deepEqual(
    list.children.slice(0, 2).map((n) => n.attributes['aria-selected']),
    ['false', 'true'],
  );
  assert.equal(list.children[0].children[0].textContent, session.tabs[0].title);
  assert.equal(list.children[0].children[1].dataset.browserAction, 'close');
  assert.equal(list.children[0].children[1].dataset.tabId, 'first');
  assert.equal(list.children[2].dataset.browserAction, 'new');
  session.tabs.shift();
  renderBrowserTabs(list, session);
  assert.equal(list.children.length, 2);
  assert.equal(list.children[0].children[0].dataset.tabId, 'second');
});
