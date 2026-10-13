// Focused UI check against the local production build; no portable packaging.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import electron from 'electron';
import { Progression } from '../src/story/progression.js';
import { DialogueSession } from '../src/story/dialogue.js';
import { ConversationThread } from '../src/story/conversation-thread.js';

const minigameOnly = process.argv.includes('--minigame-only');
let browserServer;
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.qa');
await mkdir(output, { recursive: true });
const profile = await mkdtemp(path.join(output, 'desktop-profile-'));
const listener = createServer().listen(0, '127.0.0.1');
await once(listener, 'listening');
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.CHAOS_DEV_URL;
if (minigameOnly) {
  const { preview } = await import('vite');
  browserServer = await preview({ preview: { host: '127.0.0.1', port: 0 } });
}
const gameUrl = minigameOnly ? browserServer.resolvedUrls.local[0] : 'chaos://game/';
const executable = minigameOnly
  ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  : electron;
const child = spawn(
  executable,
  minigameOnly
    ? [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profile}`,
        gameUrl,
      ]
    : [root, `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`],
  { env, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
);
let stderr = '',
  socket,
  sequence = 0;
child.stderr.on('data', (bytes) => {
  stderr = (stderr + bytes).slice(-4096);
});
const pending = new Map(),
  exceptions = [];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, description, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await wait(50);
  }
  throw new Error(`Délai dépassé : ${description}. ${stderr}`);
}
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP : ${method} ${params.expression ?? ''}`));
    }, 10000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
const click = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const doubleClick = (selector) =>
  evaluate(
    `document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new MouseEvent('dblclick', {bubbles:true}))`,
  );
async function capture(name) {
  await wait(250); // Capture settled windows, not their translucent opening animation.
  const shot = await command('Page.captureScreenshot');
  await writeFile(path.join(output, name), Buffer.from(shot.data, 'base64'));
}
try {
  let target;
  await until(async () => {
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(
        (item) => item.type === 'page' && item.url.startsWith(gameUrl),
      );
      return !!target;
    } catch {
      return false;
    }
  }, 'Electron');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data),
      request = pending.get(message.id);
    if (request) {
      clearTimeout(request.timer);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown')
      exceptions.push(message.params.exceptionDetails);
  });
  await once(socket, 'open');
  await command('Runtime.enable');
  await command('Emulation.setFocusEmulationEnabled', { enabled: true });
  await until(() => evaluate("window.chaosDebug?.snapshot().phase==='menu'"), 'menu');
  if (minigameOnly) {
    await verifyMiniGameLaunch();
  } else {
    await click('#menu-play');
    await until(() => evaluate("window.chaosDebug.snapshot().phase==='playing'"), 'niveau');
    await click('#windows-start');
    await click('#menu-messenger');
    await until(() => evaluate("!!document.querySelector('.messenger-contact-list')"), 'contacts');
    assert.equal(
      await evaluate("document.querySelectorAll('.messenger-contact-row.offline').length"),
      3,
    );
    assert.equal(await evaluate("!!document.querySelector('[data-contact-id=pixelgirl]')"), false);
    assert.equal(
      await evaluate("document.querySelectorAll('.messenger-contact-row.offline button').length"),
      0,
    );
    await click('.messenger-contact-list details[data-group="false"] summary');
    assert.equal(
      await evaluate(
        "document.querySelector('.messenger-contact-list details[data-group=false]').open",
      ),
      false,
    );
    await click('.messenger-contact-list details[data-group="false"] summary');
    await capture('messenger-contacts-offline.png');
    await click('.msn-minimize');
    await click('#msn-task');
    assert.ok(await evaluate("!document.querySelector('.popup-narrative').hidden"));
    await click('.popup-narrative .close-button');
    assert.ok(await evaluate("document.querySelector('#msn-task').hidden"));
    for (const kind of ['computer', 'folder', 'bin']) {
      await doubleClick(`[data-shortcut=${kind}]`);
      await until(
        () => evaluate(`!!document.querySelector('.desktop-app-task[data-app=${kind}]')`),
        kind,
      );
      await doubleClick(`[data-shortcut=${kind}]`);
      assert.equal(
        await evaluate(`document.querySelectorAll('.desktop-app-task[data-app=${kind}]').length`),
        1,
      );
      if (kind === 'computer') {
        await doubleClick('.popup-desktopapp:last-of-type .explorer-item:first-child');
        assert.ok(
          await evaluate(
            "document.querySelector('.popup-desktopapp:last-of-type .explorer-address strong').textContent.startsWith('C:')",
          ),
        );
        await click('.popup-desktopapp:last-of-type .explorer-back');
      }
      if (kind === 'folder') {
        const folderId = await evaluate(
          "document.querySelector('.popup-desktopapp:last-of-type').dataset.windowId",
        );
        await doubleClick('.popup-desktopapp:last-of-type .explorer-item:nth-child(3)');
        assert.ok(
          await evaluate(
            "document.querySelector('.notepad-content').value.includes('Devoir pour lundi')",
          ),
        );
        await click('.file-notepad .msn-minimize');
        await evaluate(
          "[...document.querySelectorAll('.desktop-app-task')].find(task=>task.title.includes('Bloc-notes')).click()",
        );
        assert.equal(await evaluate("document.querySelector('.file-notepad').hidden"), false);
        await click('.file-notepad .close-button');
        assert.ok(
          await evaluate(
            `!!document.querySelector('[data-window-id="${folderId}"] .explorer-items')`,
          ),
        );
        await doubleClick('.popup-desktopapp:last-of-type .explorer-item:first-child');
        await doubleClick('.popup-desktopapp:last-of-type .explorer-item:first-child');
        await until(
          () => evaluate("document.querySelector('.picture-content')?.naturalWidth>0"),
          'image',
        );
        await capture('desktop-picture-viewer.png');
        await click('.file-image .close-button');
        await click('.popup-desktopapp:last-of-type .explorer-back');
      }
    }

    assert.equal(await evaluate("document.querySelectorAll('.popup-desktopapp').length"), 3);
    assert.ok(
      await evaluate(
        "document.querySelector('.popup-desktopapp:last-of-type .explorer-empty').textContent.includes('vide')",
      ),
    );
    await capture('desktop-explorer.png');
    await click('.popup-desktopapp:last-of-type .msn-minimize');
    assert.ok(await evaluate("document.querySelector('.popup-desktopapp:last-of-type').hidden"));
    await click('.desktop-app-task[data-app=bin]');
    assert.equal(
      await evaluate("document.querySelector('.popup-desktopapp:last-of-type').hidden"),
      false,
    );
    await click('.popup-desktopapp:last-of-type .close-button');
    assert.equal(
      await evaluate("!!document.querySelector('.desktop-app-task[data-app=bin]')"),
      false,
    );
    await click('#return-main-menu');
    assert.equal(await evaluate("document.querySelectorAll('.desktop-app-task').length"), 0);

    const story = JSON.parse(await readFile(path.join(root, 'src/config/story.json')));
    const intro = JSON.parse(await readFile(path.join(root, 'src/dialogues/pixelgirl-intro.json')));
    const progression = new Progression(story);
    progression.begin();
    progression.complete('arcade-1');
    const session = new DialogueSession(intro, progression);
    while (session.nextMessage()) session.deliver();
    session.offerChoices();
    new ConversationThread('pixelgirl', progression, () => [intro]).sync();
    await evaluate(
      `localStorage.setItem('chaos-survival-story-v1',${JSON.stringify(JSON.stringify(progression.data))});window.__uiReload=true`,
    );
    await command('Page.reload');
    await until(
      () =>
        evaluate("window.__uiReload!==true&&window.chaosDebug?.snapshot().phase==='menu'").catch(
          () => false,
        ),
      'save fixture',
    );
    await click('#menu-play');
    await until(() => evaluate("!!document.querySelector('[data-choice-id=greeting-1]')"), 'intro');
    assert.equal(await evaluate("!!document.querySelector('#pause-messages')"), false);
    await click('#messenger-contacts');
    assert.equal(
      await evaluate("document.querySelectorAll('[data-contact-id=pixelgirl]').length"),
      1,
    );
    await command('Emulation.setDeviceMetricsOverride', {
      width: 800,
      height: 600,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await capture('messenger-contacts-online.png');
    await click('[data-contact-id=pixelgirl]');
    assert.equal(await evaluate("document.querySelectorAll('.dialogue-choice').length"), 3);
    await click('.popup-narrative .close-button');
    await doubleClick('[data-shortcut=music]');
    await until(
      () =>
        evaluate(
          "!!JSON.parse(localStorage.getItem('chaos-survival-story-v1')).conversations.pixelgirl.history.find(m=>m.text==='et bah !!!')",
        ),
      'premier message de replay',
      5000,
    );
    await click('#toast-open');
    await until(() => evaluate("!!document.querySelector('.conversation-log')"), 'MSN');
    assert.equal(await evaluate("document.querySelectorAll('.dialogue-choice').length"), 0);
    await until(
      () => evaluate("document.querySelectorAll('.dialogue-choices .dialogue-choice').length===3"),
      'choix narratifs conserv?s apr?s le replay',
    );
    assert.equal(
      await evaluate("document.querySelectorAll('.conversation-log .dialogue-choice').length"),
      0,
    );
    assert.equal(
      await evaluate("!!document.querySelector('[data-choice-id=replay-music]')"),
      false,
    );
    await capture('messenger-queued-choices.png');
    await evaluate("window.__closedLog=document.querySelector('.conversation-log')");
    await click('.popup-narrative .close-button');
    await evaluate(
      "window.__closedLog.dispatchEvent(new Event('scroll'));delete window.__closedLog",
    );
    await click('#windows-start');
    await click('#menu-messenger');
    assert.equal(
      await evaluate("document.querySelectorAll('.dialogue-choice:not(:disabled)').length"),
      3,
    );
    assert.equal(exceptions.length, 0, JSON.stringify(exceptions));
    console.log(
      'OK : contacts, groupes, PixelGirl masquée puis disponible, fermeture/réduction, explorateurs uniques, barre des tâches, replay progressif et choix en attente.',
    );
  }
} finally {
  if (socket?.readyState === WebSocket.OPEN) await evaluate('window.close()').catch(() => {});
  socket?.close();
  for (const request of pending.values()) clearTimeout(request.timer);
  if (child.exitCode === null) {
    await Promise.race([once(child, 'exit'), wait(2000)]);
    if (child.exitCode === null) child.kill();
  }
  await new Promise((resolve) =>
    browserServer ? browserServer.httpServer.close(resolve) : resolve(),
  );
  const relative = path.relative(output, profile);
  assert.ok(relative.startsWith('desktop-profile-') && !relative.includes(path.sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

async function physicalClick(selector, twice = false) {
  const point = await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    const rect = element.getBoundingClientRect();
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    return {x, y, hit: element.contains(document.elementFromPoint(x, y)),
      blocker: document.elementFromPoint(x, y)?.id};
  })()`);
  assert.ok(point.hit, `Click intercepted for ${selector} by ${point.blocker}`);
  for (let count = 1; count <= (twice ? 2 : 1); count++) {
    for (const type of ['mousePressed', 'mouseReleased'])
      await command('Input.dispatchMouseEvent', {
        type,
        x: point.x,
        y: point.y,
        button: 'left',
        clickCount: count,
      });
  }
}

async function physicalDrag(selector, left, top) {
  const start = await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    const rect = element.getBoundingClientRect();
    const image = element.querySelector('.icon').getBoundingClientRect();
    return { x: image.x + image.width / 2, y: image.y + image.height / 2, left: rect.x, top: rect.y };
  })()`);
  await command('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: start.x,
    y: start.y,
    button: 'left',
    clickCount: 1,
  });
  for (let step = 1; step <= 8; step++)
    await command('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: start.x + ((left - start.left) * step) / 8,
      y: start.y + ((top - start.top) * step) / 8,
      button: 'left',
      buttons: 1,
    });
  await command('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: start.x + left - start.left,
    y: start.y + top - start.top,
    button: 'left',
    clickCount: 1,
  });
}

async function verifyMiniGameLaunch() {
  await command('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const story = JSON.parse(await readFile(path.join(root, 'src/config/story.json')));
  const intro = JSON.parse(await readFile(path.join(root, 'src/dialogues/pixelgirl-intro.json')));
  const progression = new Progression(story);
  progression.begin();
  progression.complete('arcade-1');
  const session = new DialogueSession(intro, progression);
  function drain() {
    for (let i = 0; i < 150; i++) {
      if (session.nextMessage()) session.deliver();
      else if (!session.advance()) return;
    }
    assert.fail('Dialogue loop');
  }
  for (const choice of ['greeting-1', 'nickname-1', 'table-1', 'game-1']) {
    drain();
    session.choose(choice);
  }
  drain();
  // Before transfer completion, the desktop must not offer the game.
  async function loadSave() {
    await evaluate(
      `localStorage.setItem('chaos-survival-story-v1',${JSON.stringify(JSON.stringify(progression.data))});window.__uiReload=true`,
    );
    await command('Page.reload');
    await until(
      () =>
        evaluate("window.__uiReload!==true&&window.chaosDebug?.snapshot().phase==='menu'").catch(
          () => false,
        ),
      'save reload',
    );
    await click('#menu-play');
    await until(() => evaluate("window.chaosDebug.snapshot().phase==='desktop'"), 'desktop');
  }
  await loadSave();
  assert.equal(await evaluate("document.querySelectorAll('.desktop-file').length"), 0);
  const file = progression.finishTransfer(session.activeTransfer.key);
  drain();
  progression.complete('pixelgirl-hello');
  new ConversationThread('pixelgirl', progression, () => [intro]).sync();
  await loadSave();
  const shortcut = `[data-file-id="${file.id}"]`;
  assert.deepEqual(
    await evaluate(`(() => {
    const button = document.querySelector(${JSON.stringify(shortcut)});
    return {left: button.style.left, top: button.style.top};
  })()`),
    { left: '20px', top: '540px' },
  );
  await physicalDrag(shortcut, 260, 20);
  assert.equal(await evaluate("document.querySelectorAll('.popup-minigame').length"), 0);
  assert.deepEqual(
    await evaluate(
      `JSON.parse(localStorage.getItem('chaos-survival-story-v1')).desktopIcons[${JSON.stringify(`file:${file.id}`)}]`,
    ),
    { col: 2, row: 0 },
  );
  await physicalDrag(shortcut, 20, 20);
  assert.equal(
    await evaluate(`document.querySelector(${JSON.stringify(shortcut)}).style.left`),
    '260px',
  );
  await command('Emulation.setDeviceMetricsOverride', {
    width: 800,
    height: 600,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await wait(50);
  const cells = await evaluate(
    `Array.from(document.querySelectorAll('#desktop .desktop-icons button, #desktop .desktop-file'), button => button.style.left + ':' + button.style.top)`,
  );
  assert.equal(new Set(cells).size, cells.length);
  await command('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await wait(50);
  assert.equal(
    await evaluate(`document.querySelector(${JSON.stringify(shortcut)}).style.left`),
    '260px',
  );
  await physicalClick(shortcut);
  assert.equal(
    await evaluate(
      `document.querySelector(${JSON.stringify(shortcut)}).getAttribute('aria-pressed')`,
    ),
    'true',
  );
  assert.equal(await evaluate("document.querySelectorAll('.popup-minigame').length"), 0);
  await physicalClick(shortcut, true);
  await until(
    () => evaluate("document.querySelectorAll('.popup-minigame .catch-smiley').length>0"),
    'smiley game started',
  );
  await wait(300);
  await physicalClick('.catch-smiley');
  assert.ok(await evaluate("document.querySelector('.flash-score').textContent !== 'SCORE 0'"));
  await physicalClick('.popup-minigame .close-button');
  assert.equal(await evaluate("document.querySelectorAll('.popup-minigame').length"), 0);
  await physicalClick(shortcut, true);
  await until(
    () => evaluate("document.querySelectorAll('.popup-minigame').length===1"),
    'relaunch',
  );
  assert.equal(await evaluate("document.querySelector('.flash-score').textContent"), 'SCORE 0');
  await physicalClick('.popup-minigame .close-button');
  await command('Page.reload');
  await until(
    () => evaluate("window.chaosDebug?.snapshot().phase==='menu'").catch(() => false),
    'restart',
  );
  await click('#menu-play');
  await until(() => evaluate("window.chaosDebug.snapshot().phase==='desktop'"), 'restored desktop');
  assert.equal(
    await evaluate(`document.querySelector(${JSON.stringify(shortcut)}).style.left`),
    '260px',
  );
  await physicalClick(shortcut, true);
  await until(
    () => evaluate("document.querySelectorAll('.popup-minigame .catch-smiley').length>0"),
    'restored game launch',
  );
  await physicalClick('.popup-minigame .close-button');
  const menuIcons = await evaluate(
    "document.querySelector('.menu-desktop-background .desktop-icons').innerHTML",
  );
  await physicalDrag('[data-shortcut=computer]', 380, 20);
  await physicalClick('[data-shortcut=computer]', true);
  await until(
    () => evaluate("document.querySelectorAll('.popup-desktopapp').length===1"),
    'computer after drag',
  );
  assert.equal(await evaluate("document.querySelectorAll('.desktop-app-task').length"), 1);
  await physicalClick('.popup-desktopapp .close-button');
  await physicalClick('[data-shortcut=msn]', true);
  await until(
    () => evaluate("document.querySelectorAll('.popup-narrative').length===1"),
    'Messenger double click',
  );
  await physicalClick('.popup-narrative .close-button');
  await physicalClick('#windows-start');
  await physicalClick('#return-main-menu');
  assert.equal(
    await evaluate("document.querySelector('.menu-desktop-background .desktop-icons').innerHTML"),
    menuIcons,
  );
  await click('#menu-play');
  await until(() => evaluate("window.chaosDebug.snapshot().phase==='desktop'"), 'desktop again');
  await physicalClick('[data-shortcut=music]', true);
  await until(
    () => evaluate("window.chaosDebug.snapshot().phase==='playing'"),
    'rhythmic MP3 double click',
  );
  assert.equal(exceptions.length, 0, JSON.stringify(exceptions));
  console.log(
    'OK: desktop grid, physical dragging, occupied cells, resize, saved positions, Smiley, applications, Messenger, Start/menu and rhythmic MP3; no Electron.',
  );
}
