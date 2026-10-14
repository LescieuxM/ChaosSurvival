import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { CreditsPage } from '../src/ui/credits-view.js';
const content = JSON.parse(readFileSync(new URL('../src/config/credits.json', import.meta.url)));
const walk = (node) => [node, ...node.children.flatMap(walk)];
function dom(t) {
  const previous = globalThis.document;
  globalThis.document = {
    activeElement: null,
    createElement(tag) {
      return {
        tag,
        children: [],
        handlers: {},
        parentNode: null,
        isConnected: false,
        set innerHTML(value) {
          throw new Error('Unsafe HTML rendering');
        },
        setAttribute() {},
        addEventListener(type, fn) {
          this.handlers[type] = fn;
        },
        append(...nodes) {
          for (const n of nodes) {
            n.parentNode = this;
            n.isConnected = this.isConnected;
            this.children.push(n);
          }
        },
        remove() {
          this.parentNode.children = this.parentNode.children.filter((n) => n !== this);
          this.parentNode = null;
          this.isConnected = false;
        },
        focus() {
          document.activeElement = this;
        },
      };
    },
  };
  t.after(() => {
    globalThis.document = previous;
  });
  const root = document.createElement('main');
  root.isConnected = true;
  return root;
}

test('credits are inert until shown, show once, hide cleanly and restore focus', (t) => {
  const root = dom(t),
    previousFocus = document.createElement('button');
  previousFocus.isConnected = true;
  document.activeElement = previousFocus;
  const credits = new CreditsPage(root);
  assert.equal(root.children.length, 0);
  credits.show();
  credits.show();
  assert.equal(root.children.length, 1);
  assert.equal(document.activeElement, credits.element);
  const nodes = walk(credits.element);
  for (const text of [
    'CRÉATION ET DÉVELOPPEMENT',
    'Création et développement : Pixe',
    'RESSOURCES GRAPHIQUES',
    'MUSIQUE',
    'Best Game Console — DJARTMUSIC',
    'Source : Pixabay',
  ])
    assert.ok(
      nodes.some((node) => node.textContent === text),
      text,
    );
  assert.ok(
    nodes.some(
      (node) =>
        node.textContent?.includes('Certaines ressources graphiques') &&
        node.textContent.includes('OpenAI') &&
        node.textContent.includes('Codex'),
    ),
  );
  credits.hide();
  credits.hide();
  assert.equal(root.children.length, 0);
  assert.equal(document.activeElement, previousFocus);
  credits.show();
  assert.equal(root.children.length, 1);
});

test('credit content stays textual and the verified source never navigates the host automatically', (t) => {
  const root = dom(t);
  const credits = new CreditsPage(root);
  const source = walk(credits.element).find((node) => node.tag === 'a');
  assert.equal(source.href, 'https://pixabay.com/music/video-games-best-game-console-301284/');
  let prevented = false;
  source.handlers.click({
    preventDefault() {
      prevented = true;
    },
  });
  assert.ok(prevented);
  let received;
  const connected = new CreditsPage(root, { onOpenSource: (url) => (received = url) });
  walk(connected.element)
    .find((node) => node.tag === 'a')
    .handlers.click({ preventDefault() {} });
  assert.equal(received, source.href);
  const hostile = structuredClone(content);
  hostile.sections[0].lines = ['<img src=x onerror=alert(1)>'];
  assert.ok(
    walk(new CreditsPage(root, { content: hostile }).element).some(
      (node) => node.textContent === hostile.sections[0].lines[0],
    ),
  );
  hostile.sections[2].sourceLink.url = 'javascript:alert(1)';
  assert.throws(() => new CreditsPage(root, { content: hostile }), /Invalid credits/);
});

test('credits entry is not imported by runtime applications or exposed in normal navigation', () => {
  function sources(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);
      return entry.isDirectory() ? sources(url) : [url];
    });
  }
  for (const file of sources(new URL('../src/', import.meta.url))) {
    if (!file.pathname.endsWith('.js') || /\/credits(?:-view)?\.js$/.test(file.pathname)) continue;
    assert.doesNotMatch(
      readFileSync(file, 'utf8'),
      /CreditsPage|import\s*\([^)]*credits|(?:from|import)\s*['"][^'"]*credits/,
      file.pathname,
    );
  }
  for (const file of [
    '../src/config/story.json',
    '../src/config/desktop-apps.json',
    '../src/config/menu.json',
    '../index.html',
  ])
    assert.doesNotMatch(
      readFileSync(new URL(file, import.meta.url), 'utf8'),
      /credits\.js|credits-screen|CreditsPage/,
    );
});
