import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { localPages } from '../src/browser/registry.js';
import { videoCatalog, VIDEO_URL, videoRoute } from '../src/browser/sites/videotube/index.js';
import { renderVideo } from '../src/browser/sites/videotube/render.js';
const require = createRequire(import.meta.url);
const { videoUrl, createVideoOpener } = require('../electron/video-links.cjs');
const { securityPolicy } = require('../electron/security.cjs');
const titles = [
  'Numa Numa Dance',
  'Chocolate Rain',
  'LEAVE BRITNEY ALONE!',
  'Dramatic Chipmunk',
  'Laughing Baby',
  'Sneezing Baby Panda',
  'What What (In the Butt)',
];
const expectedLinks = {
  'numa-numa': 'https://www.youtube.com/watch?v=Cqd1Gvq-RBY',
  'chocolate-rain': 'https://www.youtube.com/watch?v=EwTZ2xpQwpA',
  'leave-britney-alone': 'https://www.youtube.com/watch?v=ElXi7yDHyWo',
  'dramatic-chipmunk': 'https://www.youtube.com/watch?v=y8Kyi0WNg40',
  'laughing-baby': 'https://www.youtube.com/watch?v=HttF5HVYtlQ',
  'sneezing-baby-panda': 'https://www.youtube.com/watch?v=8d6voO-na6w',
  'what-what': 'https://www.youtube.com/watch?v=fbGkxcY7YFU',
};
function dom(t) {
  const previous = globalThis.document;
  globalThis.document = {
    createElement(tag) {
      return {
        tag,
        children: [],
        dataset: {},
        handlers: {},
        append(...children) {
          this.children.push(...children);
        },
        addEventListener(name, fn) {
          this.handlers[name] = fn;
        },
        setAttribute(name, value) {
          this[name] = value;
        },
        set innerHTML(_) {
          throw new Error('Unsafe HTML');
        },
      };
    },
  };
  t.after(() => {
    globalThis.document = previous;
  });
}
const walk = (n) => [n, ...n.children.flatMap(walk)];
const find = (root, cls) => walk(root).find((n) => n.className === cls);

test('exactly seven videos use local original assets and existing routes, directory and search', () => {
  assert.deepEqual(
    videoCatalog.videos.map((v) => v.title),
    titles,
  );
  assert.equal(new Set(videoCatalog.videos.map((v) => v.id)).size, 7);
  assert.equal(localPages.resolve('www.videotube.fr', {}).page.url, VIDEO_URL);
  assert.ok(localPages.sites({}).some((p) => p.url === VIDEO_URL));
  for (const video of videoCatalog.videos) {
    assert.ok(video.year >= 2004 && video.year <= 2009);
    assert.ok(video.rating >= 1 && video.rating <= 5);
    assert.ok(existsSync(new URL(`../public/${video.thumbnail.slice(2)}`, import.meta.url)));
    assert.equal(
      localPages.resolve(videoRoute(video), {}).page.title,
      `${video.title} — VideoTube`,
    );
    assert.ok(localPages.search(video.title, {}).some((p) => p.url === videoRoute(video)));
    assert.equal(videoUrl(video.id), video.youtubeUrl);
    assert.equal(video.youtubeUrl, expectedLinks[video.id]);
  }
});

test('home links go only to internal watch pages; metadata and comments are text, with no player/network embeds', (t) => {
  dom(t);
  const home = localPages.resolve(VIDEO_URL, {}).page.render({});
  assert.equal(walk(home).filter((n) => n.className === 'videotube-card').length, 7);
  assert.equal(walk(home).filter((n) => n.tag === 'button').length, 0);
  for (const video of videoCatalog.videos) {
    const tree = localPages.resolve(videoRoute(video), {}).page.render({});
    const nodes = walk(tree);
    assert.ok(nodes.some((n) => n.textContent === video.title));
    assert.equal(find(tree, 'videotube-watch').disabled, !video.youtubeUrl);
    assert.equal(find(tree, 'videotube-comments').children.length, video.comments.length + 1);
    assert.equal(find(tree, 'videotube-stars')['aria-label'], `Note : ${video.rating} sur 5`);
    for (const n of [...walk(home), ...nodes]) {
      assert.ok(!['iframe', 'webview', 'video', 'script', 'object'].includes(n.tag));
      if (n.tag === 'a') {
        assert.equal(n.href, '#');
        assert.ok(n.dataset.browserLink.startsWith(VIDEO_URL));
        assert.ok(localPages.resolve(n.dataset.browserLink, {}).page);
      }
    }
  }
});

test('watch sends only its fixed ID, prevents duplicate pending clicks and reports failures without navigating', async (t) => {
  dom(t);
  const previous = globalThis.chaosVideo;
  t.after(() => {
    globalThis.chaosVideo = previous;
  });
  const ids = [];
  let complete, cleanup;
  globalThis.chaosVideo = {
    open: (id) => {
      ids.push(id);
      return new Promise((resolve) => {
        complete = resolve;
      });
    },
  };
  const root = localPages.resolve(videoRoute(videoCatalog.videos[1]), {}).page.render({
    onDispose: (fn) => {
      cleanup = fn;
    },
  });
  const button = find(root, 'videotube-watch');
  const first = button.handlers.click();
  await button.handlers.click();
  assert.deepEqual(ids, ['chocolate-rain']);
  complete({ ok: true });
  await first;
  assert.equal(button.disabled, false);
  assert.match(find(root, 'videotube-open-status').textContent, /Vidéo ouverte/);
  globalThis.chaosVideo.open = () => Promise.reject(new Error('OS failure'));
  await button.handlers.click();
  assert.match(find(root, 'videotube-open-status').textContent, /Impossible/);
  cleanup();
  await button.handlers.click();
  assert.deepEqual(ids, ['chocolate-rain']);
  const disabled = renderVideo({}, { ...videoCatalog.videos[2], youtubeUrl: null }, VIDEO_URL);
  await find(disabled, 'videotube-watch').handlers.click();
  assert.deepEqual(ids, ['chocolate-rain']);
});

test('external handler refuses URLs, malformed IDs, subframes and foreign senders', async () => {
  const policy = securityPolicy(),
    mainFrame = { url: policy.documentUrl };
  const trusted = { senderFrame: mainFrame, sender: { mainFrame } };
  const calls = [],
    open = createVideoOpener(policy, (url) => {
      calls.push(url);
    });
  for (const id of [
    null,
    {},
    [],
    1,
    '__proto__',
    'constructor',
    'unknown',
    'javascript:alert(1)',
    'file:///C:/Windows/',
    'https://www.youtube.com/watch?v=EwTZ2xpQwpA',
    'chocolate-rain\n',
  ])
    assert.equal((await open(trusted, id)).ok, false);
  for (const senderFrame of [null, { url: policy.documentUrl }, { url: 'https://example.com/' }])
    assert.equal((await open({ ...trusted, senderFrame }, 'chocolate-rain')).ok, false);
  assert.equal(calls.length, 0);
  for (const video of videoCatalog.videos.filter((v) => v.youtubeUrl))
    assert.equal((await open(trusted, video.id)).ok, true);
  assert.deepEqual(
    calls,
    videoCatalog.videos.filter((v) => v.youtubeUrl).map((v) => v.youtubeUrl),
  );
  assert.equal(
    (
      await createVideoOpener(policy, () => {
        throw new Error('private details');
      })(trusted, 'numa-numa')
    ).ok,
    false,
  );
});

test('actual main IPC registration and sandbox preload round-trip an ID from a watch button to shell.openExternal', async (t) => {
  dom(t);
  const handlers = new Map(),
    exposed = {},
    opened = [],
    windows = [];
  const policy = securityPolicy(),
    mainFrame = { url: policy.documentUrl };
  const event = { senderFrame: mainFrame, sender: { mainFrame } };
  const electron = {
    app: {
      isPackaged: true,
      commandLine: { appendSwitch() {} },
      whenReady: () => Promise.resolve(),
      setAppUserModelId() {},
      getAppPath: () => '.',
      on() {},
    },
    BrowserWindow: class {
      constructor(config) {
        windows.push(config);
        this.webContents = { on() {}, setWindowOpenHandler() {} };
      }
      once() {}
      on() {}
      loadURL() {
        return Promise.resolve();
      }
    },
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    ipcRenderer: {
      invoke: (name, ...args) => handlers.get(name)(event, ...args),
      on() {},
      removeListener() {},
    },
    contextBridge: {
      exposeInMainWorld: (name, api) => {
        exposed[name] = api;
      },
    },
    Menu: { setApplicationMenu() {} },
    protocol: { registerSchemesAsPrivileged() {}, handle() {} },
    session: {
      defaultSession: {
        setPermissionRequestHandler() {},
        setPermissionCheckHandler() {},
        on() {},
        webRequest: { onBeforeRequest() {}, onHeadersReceived() {} },
      },
    },
    shell: {
      openExternal: (url) => {
        opened.push(url);
        return Promise.resolve();
      },
    },
  };
  const mainRequire = createRequire(new URL('../electron/main.cjs', import.meta.url));
  const requireMock = (name) => (name === 'electron' ? electron : mainRequire(name));
  runInNewContext(readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8'), {
    require: requireMock,
    __dirname: '.',
    process: { env: {}, platform: 'win32' },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(handlers.has('chaos:open-video'));
  assert.equal(windows[0].webPreferences.nodeIntegration, false);
  assert.equal(windows[0].webPreferences.contextIsolation, true);
  assert.equal(windows[0].webPreferences.sandbox, true);
  runInNewContext(readFileSync(new URL('../electron/preload.cjs', import.meta.url), 'utf8'), {
    require: requireMock,
  });
  assert.deepEqual(Object.keys(exposed.chaosVideo), ['open']);
  const previous = globalThis.chaosVideo;
  globalThis.chaosVideo = exposed.chaosVideo;
  t.after(() => {
    globalThis.chaosVideo = previous;
  });
  for (const [id, url] of Object.entries(expectedLinks)) {
    const page = localPages.resolve(`${VIDEO_URL}watch/${id}`, {}).page.render({});
    const button = find(page, 'videotube-watch');
    assert.equal(button.disabled, false);
    await button.handlers.click();
    assert.equal(opened.at(-1), url);
    assert.match(find(page, 'videotube-open-status').textContent, /Vidéo ouverte/);
  }
  assert.deepEqual(opened, Object.values(expectedLinks));
  assert.equal((await exposed.chaosVideo.open('https://attacker.example/')).ok, false);
  assert.equal((await exposed.chaosVideo.open({ id: 'chocolate-rain' })).ok, false);
  assert.equal(opened.length, 7);
});
