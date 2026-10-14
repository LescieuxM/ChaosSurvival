import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { localPages, HOME_URL } from '../src/browser/registry.js';
import { renderSearch } from '../src/browser/pages/xd-search.js';
const require = createRequire(import.meta.url);
const {
  securityPolicy,
  developmentUrl,
  protectWindow,
  protectSession,
} = require('../electron/security.cjs');
const attacks = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  'javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'file:///C:/Windows/',
  '../../../../',
  'devtools://devtools/',
  'https://example.com',
];

test('all hostile addresses resolve to fictitious errors, never an executable route', () => {
  for (const value of attacks) assert.ok(localPages.resolve(value, {}).error, value);
});

test('oversized, malformed and lookalike addresses never select an allowed site', () => {
  for (const value of [
    'x'.repeat(1000000),
    'http://[',
    'http://www.wiki.fr.evil.example/',
    'http://www.wiki.fr@evil.example/',
    'http://evil.example@www.wiki.fr/',
    'http://www.wiki.fr%00.evil.example/',
    'http://www.wiki.fr:81/',
    'http://www.wіki.fr/', // Cyrillic i, not the registered Latin hostname.
    'http://www.wiki.fr/\u0000',
    'http://www.wiki.fr/%3Cscript%3Ealert(1)%3C/script%3E',
  ])
    assert.ok(localPages.resolve(value, {}).error);
  assert.equal(localPages.resolve('https://WIKI.FR/', {}).page.title, 'Wiki');
});

test('search renders attacks only as text, without HTML sinks or native URL links', (t) => {
  const previous = globalThis.document;
  globalThis.document = {
    createElement(tag) {
      return {
        tag,
        children: [],
        dataset: {},
        classList: { toggle() {} },
        set innerHTML(_) {
          throw new Error('HTML sink used');
        },
        append(...nodes) {
          this.children.push(...nodes);
        },
        addEventListener() {},
        setAttribute() {},
      };
    },
  };
  t.after(() => {
    globalThis.document = previous;
  });
  const walk = (n) => [n, ...n.children.flatMap(walk)];
  for (const query of attacks) {
    const tree = renderSearch({
      url: new URL(`${HOME_URL}?q=${encodeURIComponent(query)}`),
      registry: localPages,
      data: {},
      navigate() {},
    });
    assert.equal(tree.children[1].children[0].value, query);
    for (const n of walk(tree)) {
      assert.ok(!['script', 'iframe', 'webview', 'object'].includes(n.tag));
      if (n.tag === 'a') {
        assert.equal(n.href, '#');
        assert.ok(localPages.resolve(n.dataset.browserLink, {}).page);
      }
    }
  }
});

test('production allows only the bundled scheme; development only exact loopback HTTP/WS origin', () => {
  const prod = securityPolicy();
  assert.ok(prod.allowsRequest('chaos://game/assets/game.js'));
  for (const value of [
    ...attacks,
    'chaos://other/index.html',
    'chaos://u:p@game/index.html',
    'ftp://example.com',
    'ws://127.0.0.1:5173/',
    'blob:chaos://game/xyz',
  ])
    assert.equal(prod.allowsRequest(value), false, value);
  const dev = securityPolicy(developmentUrl('http://127.0.0.1:5173/'));
  for (const url of ['http://127.0.0.1:5173/src/main.js', 'ws://127.0.0.1:5173/'])
    assert.ok(dev.allowsRequest(url));
  for (const url of [
    'http://localhost:5173/',
    'http://127.0.0.1:5174/',
    'https://127.0.0.1:5173/',
    ...attacks,
  ])
    assert.equal(dev.allowsRequest(url), false);
  for (const url of [
    'https://example.com/',
    'file:///C:/',
    'http://127.0.0.1:5173/else',
    'http://u:p@localhost/',
  ])
    assert.throws(() => developmentUrl(url));
  assert.match(prod.csp, /script-src 'self';/);
  assert.doesNotMatch(prod.csp, /unsafe-eval|script-src[^;]*unsafe-inline|https?:|wss?:/);
});

test('native window, navigation, downloads, requests and permissions are denied by installed handlers', () => {
  const events = new Map();
  let popup, request, headers, permission, check;
  protectWindow({
    on: (name, fn) => events.set(name, fn),
    setWindowOpenHandler: (fn) => (popup = fn),
  });
  assert.deepEqual(popup(), { action: 'deny' });
  for (const name of [
    'will-navigate',
    'will-frame-navigate',
    'will-redirect',
    'will-attach-webview',
  ]) {
    let blocked = false;
    events.get(name)({
      preventDefault() {
        blocked = true;
      },
    });
    assert.ok(blocked, name);
  }
  const policy = securityPolicy();
  protectSession(
    {
      on: (name, fn) => events.set(name, fn),
      setPermissionRequestHandler: (fn) => (permission = fn),
      setPermissionCheckHandler: (fn) => (check = fn),
      webRequest: {
        onBeforeRequest: (_, fn) => (request = fn),
        onHeadersReceived: (_, fn) => (headers = fn),
      },
    },
    policy,
  );
  permission({}, 'filesystem', (result) => assert.equal(result, false));
  assert.equal(check(), false);
  let blocked = false;
  events.get('will-download')({
    preventDefault() {
      blocked = true;
    },
  });
  assert.ok(blocked);
  for (const value of attacks)
    request({ url: value }, (result) => assert.equal(result.cancel, true));
  request({ url: 'chaos://game/avatars/luna.svg' }, (result) => assert.equal(result.cancel, false));
  headers({ responseHeaders: { 'Content-Type': ['text/html'] } }, (result) => {
    assert.equal(result.responseHeaders['Content-Security-Policy'][0], policy.csp);
    assert.deepEqual(result.responseHeaders['Content-Type'], ['text/html']);
  });
});

test('preload IPC trusts only the main frame of the game document', () => {
  const policy = securityPolicy(),
    mainFrame = { url: policy.documentUrl };
  assert.ok(policy.trustedSender({ senderFrame: mainFrame, sender: { mainFrame } }));
  for (const frame of [{ url: policy.documentUrl }, { url: 'https://example.com' }, null])
    assert.equal(policy.trustedSender({ senderFrame: frame, sender: { mainFrame } }), false);
  mainFrame.url = 'file:///C:/Windows/';
  assert.equal(policy.trustedSender({ senderFrame: mainFrame, sender: { mainFrame } }), false);
});
