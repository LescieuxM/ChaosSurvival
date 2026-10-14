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
import { smileyIcon } from '../src/minigames/smiley-icons.js';

const rulesOnly = process.argv.includes('--rules-only');
const typingOnly = process.argv.includes('--typing-only');
const messengerOnly = process.argv.includes('--messenger-only');
const notepadOnly = process.argv.includes('--notepad-only');
const movementOnly = process.argv.includes('--window-movement-only');
const minigameOnly =
  process.argv.includes('--minigame-only') ||
  typingOnly ||
  rulesOnly ||
  messengerOnly ||
  notepadOnly ||
  movementOnly;
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
async function verifyNotepad() {
  const story = JSON.parse(await readFile(path.join(root, 'src/config/story.json')));
  const progression = new Progression(story);
  progression.begin();
  progression.complete('arcade-1');
  progression.complete('pixelgirl-hello');
  await command('Page.enable');
  const injection = await command('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('chaos-survival-story-v1',${JSON.stringify(JSON.stringify(progression.data))});window.__notepadFixture=true`,
  });
  await command('Page.reload');
  await until(
    () =>
      evaluate("window.__notepadFixture&&window.chaosDebug?.snapshot().phase==='menu'").catch(
        () => false,
      ),
    'notepad fixture',
  );
  await command('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier });
  async function desktop() {
    await click('#menu-play');
    await until(() => evaluate("window.chaosDebug.snapshot().phase==='desktop'"), 'desktop');
    await doubleClick('[data-shortcut=folder]');
  }
  const names = ['devoir_final_v7_VRAIMENT_FINAL.txt', 'liens_trop_biens.txt'];
  const selector = (name) => `[data-file-path="folder/${name}"]`;
  const area = (name) => `${selector(name)} .notepad-content`;
  const value = (name) => evaluate(`document.querySelector(${JSON.stringify(area(name))}).value`);
  async function open(name) {
    await evaluate(`(() => {
      const row=[...document.querySelectorAll('.explorer-item')].find(row=>row.querySelector('strong').textContent===${JSON.stringify(name)});
      row.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
    })()`);
  }
  async function edit(name, text) {
    await evaluate(`(() => {
      const editor=document.querySelector(${JSON.stringify(area(name))});
      editor.value=${JSON.stringify(text)};editor.dispatchEvent(new Event('input',{bubbles:true}));editor.focus();
    })()`);
  }
  async function ctrlS() {
    await command('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 's',
      code: 'KeyS',
      modifiers: 2,
    });
    await command('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 's',
      code: 'KeyS',
      modifiers: 2,
    });
  }
  const saved = () =>
    evaluate("JSON.parse(localStorage.getItem('chaos-survival-story-v1')).textFiles");
  const title = (name) =>
    evaluate(
      `document.querySelector(${JSON.stringify(selector(name) + ' .window-title > span')}).textContent`,
    );
  await desktop();
  await open(names[0]);
  const original = await value(names[0]);
  const payload =
    '<script>window.__notepadExecuted=true</script>\nnew Function("alert(1)")\nété 😃 日本語';
  await edit(names[0], payload);
  assert.ok((await title(names[0])).startsWith('*'));
  await ctrlS();
  assert.equal((await saved())[`folder/${names[0]}`].text, payload);
  assert.ok(!(await title(names[0])).startsWith('*'));
  assert.equal(await evaluate('window.__notepadExecuted===undefined'), true);
  await click(selector(names[0]) + ' .close-button');
  await open(names[0]);
  assert.equal(await value(names[0]), payload);
  await edit(names[0], 'discard me');
  await click(selector(names[0]) + ' .close-button');
  assert.equal(
    await evaluate(
      `document.querySelector(${JSON.stringify(selector(names[0]) + ' .notepad-confirm')}).hidden`,
    ),
    false,
  );
  await click(selector(names[0]) + ' [data-answer=cancel]');
  assert.equal(await value(names[0]), 'discard me');
  await click(selector(names[0]) + ' .close-button');
  await capture('notepad-save-confirmation.png');
  await click(selector(names[0]) + ' [data-answer=no]');
  await open(names[0]);
  assert.equal(await value(names[0]), payload);
  await edit(names[0], 'saved with Yes');
  // Exercise the real shared menu, including File > Quit.
  await click(selector(names[0]) + ' .messenger-menu-group > button');
  await evaluate(
    `[...document.querySelectorAll(${JSON.stringify(selector(names[0]) + ' .messenger-dropdown button')})].find(b=>b.textContent==='Quitter').click()`,
  );
  await evaluate(
    `window.__realTextSave=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='chaos-survival-story-v1')throw new Error('quota');return window.__realTextSave.call(this,key,value)}`,
  );
  await click(selector(names[0]) + ' [data-answer=yes]');
  assert.equal(await value(names[0]), 'saved with Yes');
  assert.ok((await title(names[0])).startsWith('*'));
  assert.equal((await saved())[`folder/${names[0]}`].text, payload);
  await evaluate('Storage.prototype.setItem=window.__realTextSave;delete window.__realTextSave');
  await click(selector(names[0]) + ' [data-answer=yes]');
  await open(names[0]);
  assert.equal(await value(names[0]), 'saved with Yes');
  await open(names[1]);
  await edit(names[0], 'first dirty');
  await edit(names[1], 'second saved');
  await ctrlS();
  assert.equal((await saved())[`folder/${names[0]}`].text, 'saved with Yes');
  assert.equal((await saved())[`folder/${names[1]}`].text, 'second saved');
  const boundary = '😃'.repeat(25600);
  await edit(names[1], boundary);
  await ctrlS();
  await edit(names[1], boundary + 'é');
  assert.equal(await value(names[1]), boundary);
  assert.ok(
    (
      await evaluate(
        `document.querySelector(${JSON.stringify(selector(names[1]) + ' .window-status')}).textContent`,
      )
    ).includes('refusée'),
  );
  await evaluate(`document.querySelector(${JSON.stringify(area(names[1]))}).select()`);
  await command('Input.insertText', { text: 'x'.repeat(102401) });
  assert.equal(await value(names[1]), boundary);
  await edit(names[1], 'small again');
  await click(selector(names[1]) + ' .messenger-menu-group > button');
  await evaluate(
    `[...document.querySelectorAll(${JSON.stringify(selector(names[1]) + ' .messenger-dropdown button')})].find(b=>b.textContent==='Enregistrer').click()`,
  );
  // An active explorer must not save a minimized or background Notepad.
  await edit(names[1], 'not saved behind explorer');
  await click(selector(names[1]) + ' .msn-minimize');
  await doubleClick('[data-shortcut=folder]');
  await ctrlS();
  assert.equal((await saved())[`folder/${names[1]}`].text, 'small again');
  await open(names[1]);
  await capture('notepad-editor.png');
  // A new JS context reloads the saved story, not the editors' unsaved buffers.
  await evaluate('window.__notepadBeforeReload=true');
  await command('Page.reload');
  await until(
    () =>
      evaluate("!window.__notepadBeforeReload&&window.chaosDebug?.snapshot().phase==='menu'").catch(
        () => false,
      ),
    'notepad restart',
  );
  await desktop();
  await open(names[0]);
  await open(names[1]);
  assert.equal(await value(names[0]), 'saved with Yes');
  assert.equal(await value(names[1]), 'small again');
  assert.notEqual(original, 'saved with Yes');
  assert.deepEqual(
    await evaluate("JSON.parse(localStorage.getItem('chaos-survival-story-v1')).completed"),
    ['arcade-1', 'pixelgirl-hello'],
  );
  console.log(
    'Bloc-notes : édition, Ctrl+S actif, menus, Oui/Non/Annuler, Unicode, limite UTF-8, texte inerte et relance validés.',
  );
}
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
    if (movementOnly) await verifyArcadeMovement();
    else if (notepadOnly) await verifyNotepad();
    else if (messengerOnly) {
      await verifyTypingIndicator();
      await verifyMessengerWindows();
    } else if (rulesOnly) await verifyRulesFlow();
    else if (typingOnly) await verifyTypingIndicator();
    else await verifyMiniGameLaunch();
  } else {
    await click('#menu-play');
    await until(() => evaluate("!!document.querySelector('.rules-confirm')"), 'first rules');
    await click('.rules-confirm');
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
    await click('[data-app=\"messenger:contacts\"]');
    assert.ok(await evaluate("!document.querySelector('.popup-narrative').hidden"));
    await click('.popup-narrative .close-button');
    assert.equal(
      await evaluate('!!document.querySelector(\'[data-app="messenger:contacts"]\')'),
      false,
    );
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
    await click('#windows-start');
    await click('#menu-messenger');
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
    await doubleClick('[data-contact-id=pixelgirl]');
    assert.equal(await evaluate("document.querySelectorAll('.dialogue-choice').length"), 3);
    await click('[data-messenger-contact=pixelgirl] .close-button');
    await doubleClick('[data-shortcut=arcade]');
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
    await click('[data-messenger-contact=pixelgirl] .close-button');
    await evaluate(
      "window.__closedLog.dispatchEvent(new Event('scroll'));delete window.__closedLog",
    );
    await click('#windows-start');
    await click('#menu-messenger');
    await doubleClick('[data-contact-id=pixelgirl]');
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
  await until(() => evaluate("!!document.querySelector('.rules-confirm')"), 'Smiley first rules');
  assert.equal(
    await evaluate("document.querySelector('#rules-title').textContent"),
    'Smiley Catcher 2009',
  );
  assert.equal(await evaluate("document.querySelectorAll('.popup-minigame').length"), 0);
  await physicalClick('.rules-confirm');
  await until(
    () => evaluate("document.querySelectorAll('.popup-minigame .catch-smiley').length>0"),
    'smiley game started',
  );
  const artwork = [0, 1, 2, 3].map(smileyIcon);
  const centered = await evaluate(`(() => {
    const original = document.querySelector('.catch-smiley');
    const artwork = ${JSON.stringify(artwork)};
    return [42, 58, 76].flatMap(size => artwork.map((markup, variant) => {
      const target = original.cloneNode(true);
      target.innerHTML = markup;
      Object.assign(target.style, { width: size + 'px', height: size + 'px', animation: 'none' });
      original.parentElement.append(target);
      const svg = target.querySelector('svg');
      const bounds = svg.getBBox();
      const point = new DOMPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
        .matrixTransform(svg.getScreenCTM());
      const circle = target.getBoundingClientRect();
      const dx = point.x - circle.left - circle.width / 2;
      const dy = point.y - circle.top - circle.height / 2;
      const valid = Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1;
      target.remove();
      return {size, variant, valid, dx, dy};
    }));
  })()`);
  assert.ok(
    centered.every((item) => item.valid),
    JSON.stringify(centered),
  );
  await evaluate(`(() => {
    const arena = document.querySelector('.smiley-arena');
    const gallery = document.createElement('div');
    gallery.id = 'qa-smiley-gallery';
    Object.assign(gallery.style, { position: 'absolute', inset: '0', zIndex: '100', background: '#fab5ec' });
    ${JSON.stringify(artwork)}.forEach((markup, index) => {
      const target = document.createElement('button');
      target.className = 'catch-smiley';
      target.innerHTML = markup;
      Object.assign(target.style, { left: (12 + index * 70) + 'px', top: '24px', animation: 'none' });
      gallery.append(target);
    });
    arena.append(gallery);
  })()`);
  await capture('smiley-centering.png');
  await evaluate("document.querySelector('#qa-smiley-gallery').remove()");
  await wait(300);
  await physicalClick('.flash-rules');
  const pausedTime = await evaluate("document.querySelector('.flash-time').textContent");
  await wait(300);
  assert.equal(await evaluate("document.querySelector('.flash-time').textContent"), pausedTime);
  await physicalClick('.rules-confirm');
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
  await command('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: 5,
    y: 5,
    button: 'left',
    clickCount: 1,
  });
  await command('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: 125,
    y: 216,
    button: 'left',
    buttons: 1,
  });
  assert.equal(await evaluate("document.querySelectorAll('.desktop-selection').length"), 1);
  assert.equal(
    await evaluate(
      "document.querySelectorAll('#desktop .desktop-icons [aria-pressed=true]').length",
    ),
    2,
  );
  await command('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: 125,
    y: 216,
    button: 'left',
    clickCount: 1,
  });
  assert.equal(await evaluate("document.querySelectorAll('.desktop-selection').length"), 0);
  await physicalDrag('[data-shortcut=computer]', 140, 20);
  assert.equal(
    await evaluate("document.querySelector('[data-shortcut=computer]').style.left"),
    '140px',
  );
  assert.equal(
    await evaluate("document.querySelector('[data-shortcut=folder]').style.left"),
    '140px',
  );
  await physicalDrag('[data-shortcut=computer]', 260, 20); // The unlocked game occupies this cell.
  assert.equal(
    await evaluate("document.querySelector('[data-shortcut=computer]').style.left"),
    '140px',
  );
  await command('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: 900,
    y: 50,
    button: 'left',
    clickCount: 1,
  });
  await command('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: 900,
    y: 50,
    button: 'left',
    clickCount: 1,
  });
  assert.equal(
    await evaluate(
      "document.querySelectorAll('#desktop .desktop-icons [aria-pressed=true]').length",
    ),
    0,
  );
  await physicalDrag('[data-shortcut=computer]', 380, 20);
  await physicalClick('[data-shortcut=computer]', true);
  await until(
    () => evaluate("document.querySelectorAll('.popup-desktopapp').length===1"),
    'computer after drag',
  );
  assert.equal(await evaluate("document.querySelectorAll('.desktop-app-task').length"), 1);
  await verifyWindowOverIcons('.popup-desktopapp');
  await evaluate(`(() => {
    const enter = name => [...document.querySelectorAll('.popup-desktopapp .explorer-item')]
      .find(row => row.querySelector('strong').textContent === name)
      .dispatchEvent(new MouseEvent('dblclick', {bubbles:true}));
    enter('Disque local (C:)'); enter('WINDOWS'); enter('win.ini');
  })()`);
  await verifyWindowOverIcons('.file-generic');
  await physicalClick('.file-generic .close-button');
  await physicalClick('.popup-desktopapp .close-button');
  await physicalClick('[data-shortcut=msn]', true);
  await until(
    () => evaluate("document.querySelectorAll('.popup-narrative').length===1"),
    'Messenger double click',
  );
  await verifyWindowOverIcons('[data-messenger-view=contacts]');
  const narrative = await evaluate(
    "JSON.stringify(JSON.parse(localStorage.getItem('chaos-survival-story-v1')).dialogues)",
  );
  await physicalClick('[data-contact-id=skater]', true);
  assert.equal(
    await evaluate("document.querySelector('.contact-name').textContent"),
    'Sk8er_du_93',
  );
  assert.ok(
    await evaluate(
      "document.querySelector('.contact-status').textContent.startsWith('Hors ligne')",
    ),
  );
  assert.equal(
    await evaluate("document.querySelectorAll('.conversation-log .conversation-message').length"),
    0,
  );
  assert.equal(await evaluate("document.querySelectorAll('.dialogue-choice').length"), 0);
  assert.ok(
    await evaluate(
      "document.querySelector('.dialogue-typing').textContent.includes('indisponible')",
    ),
  );
  assert.equal(await evaluate("document.querySelectorAll('.popup-narrative').length"), 2);
  await verifyWindowOverIcons('[data-messenger-contact=skater]');
  await physicalClick('[data-messenger-contact=skater] .msn-minimize');
  await physicalClick('[data-app=\"messenger:conversation:skater\"]');
  assert.equal(
    await evaluate("document.querySelector('.contact-name').textContent"),
    'Sk8er_du_93',
  );
  assert.equal(
    await evaluate(
      "JSON.stringify(JSON.parse(localStorage.getItem('chaos-survival-story-v1')).dialogues)",
    ),
    narrative,
  );
  await physicalClick('[data-app=\"messenger:contacts\"]');
  await physicalClick('[data-contact-id=pixelgirl]', true);
  assert.ok(await evaluate("document.querySelectorAll('.conversation-message').length>0"));
  await physicalClick('[data-messenger-contact=pixelgirl] .close-button');
  await click('[data-messenger-contact=skater] .close-button');
  await click('[data-messenger-view=contacts] .close-button');
  await physicalClick('#windows-start');
  await physicalClick('#return-main-menu');
  assert.equal(
    await evaluate("document.querySelector('.menu-desktop-background .desktop-icons').innerHTML"),
    menuIcons,
  );
  await click('#menu-play');
  await until(() => evaluate("window.chaosDebug.snapshot().phase==='desktop'"), 'desktop again');
  assert.equal(
    await evaluate("document.querySelector('[data-shortcut=arcade] span').textContent"),
    'ChaosSurvival.exe',
  );
  assert.equal(await evaluate("!!document.querySelector('[data-shortcut=music]')"), false);
  const launches = await evaluate(
    "JSON.parse(localStorage.getItem('chaos-survival-story-v1')).level1Launches",
  );
  await physicalClick('[data-shortcut=arcade]', true);
  await until(
    () => evaluate("window.chaosDebug.snapshot().phase==='playing'"),
    'rhythmic EXE double click',
  );
  await until(
    () => evaluate('window.chaosDebug.snapshot().audioTime > 0'),
    'level music advancing',
  );
  assert.equal(
    await evaluate("JSON.parse(localStorage.getItem('chaos-survival-story-v1')).level1Launches"),
    launches + 1,
  );
  assert.equal(exceptions.length, 0, JSON.stringify(exceptions));
  console.log(
    'OK: desktop grid, icon selection/dragging, windows covering icons and releasing their clicks, taskbar access, saved positions, Smiley, applications, Messenger, Start/menu and rhythmic EXE; no Electron.',
  );
}

async function verifyArcadeMovement() {
  const story = JSON.parse(await readFile(path.join(root, 'src/config/story.json')));
  const progression = new Progression(story);
  progression.begin();
  progression.complete('arcade-1');
  progression.complete('pixelgirl-hello');
  await command('Page.enable');
  const injected = await command('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('chaos-survival-story-v1',${JSON.stringify(JSON.stringify(progression.data))});window.__movementFixture=true`,
  });
  await command('Page.reload');
  await until(
    () =>
      evaluate("window.__movementFixture&&window.chaosDebug?.snapshot().phase==='menu'").catch(
        () => false,
      ),
    'movement fixture',
  );
  await command('Page.removeScriptToEvaluateOnNewDocument', { identifier: injected.identifier });
  await click('#menu-play');
  await until(() => evaluate("window.chaosDebug.snapshot().phase==='desktop'"), 'desktop');
  await physicalClick('[data-shortcut=arcade]', true);
  await until(() => evaluate("window.chaosDebug.snapshot().phase==='playing'"), 'arcade EXE');
  await until(
    () => evaluate("!!document.querySelector('#playfield > .popup:not(.preview-window)')"),
    'rhythmic window',
  );
  const selector = await evaluate(
    "'[data-window-id=\"'+document.querySelector('#playfield > .popup:not(.preview-window)').dataset.windowId+'\"]'",
  );
  const dimensions = await evaluate(
    `({width:document.querySelector(${JSON.stringify(selector)}).offsetWidth,height:document.querySelector(${JSON.stringify(selector)}).offsetHeight})`,
  );
  await verifyWindowOverIcons(selector, true);
  assert.deepEqual(
    await evaluate(
      `({width:document.querySelector(${JSON.stringify(selector)}).offsetWidth,height:document.querySelector(${JSON.stringify(selector)}).offsetHeight})`,
    ),
    dimensions,
  );
  assert.equal(await evaluate('window.chaosDebug.snapshot().phase'), 'playing');
  const score = await evaluate("Number(document.querySelector('#score').textContent)");
  await physicalClick(selector + ' .close-button');
  assert.equal(await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`), false);
  assert.ok((await evaluate("Number(document.querySelector('#score').textContent)")) > score);
  assert.ok(await evaluate('window.chaosDebug.snapshot().audioTime > 0'));
  // The same manager also handles real desktop applications during a controlled pause.
  await physicalClick('#windows-start');
  await physicalClick('[data-system-app=computer]');
  await until(() => evaluate("!!document.querySelector('.popup-desktopapp')"), 'explorer');
  await verifyWindowOverIcons('.popup-desktopapp', true);
  assert.equal(exceptions.length, 0, JSON.stringify(exceptions));
  console.log(
    'OK: EXE launch, real arcade/explorer dragging across all desktop edges, icon/HUD coverage, taskbar hit testing, normal closing/score/audio; no Electron.',
  );
}

async function verifyWindowOverIcons(selector, allEdges = false) {
  await until(
    () =>
      evaluate(
        `getComputedStyle(document.querySelector(${JSON.stringify(selector)})).transform === 'none'`,
      ),
    'window opening animation',
  );
  const saved = await evaluate(
    "JSON.stringify(JSON.parse(localStorage.getItem('chaos-survival-story-v1')).desktopIcons)",
  );
  const drag = async (left, top) => {
    const start = await evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      const rect = element.getBoundingClientRect();
      const bar = element.querySelector('.titlebar').getBoundingClientRect();
      return { x: bar.left + 60, y: bar.top + bar.height/2, left: rect.left, top: rect.top };
    })()`);
    await command('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: start.x,
      y: start.y,
      button: 'left',
      clickCount: 1,
    });
    for (let step = 1; step <= 6; step++)
      await command('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: start.x + ((left - start.left) * step) / 6,
        y: start.y + ((top - start.top) * step) / 6,
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
  };
  const covered = () =>
    evaluate(`(() => {
    const icon = document.querySelector('[data-shortcut=${allEdges ? 'computer' : 'msn'}]');
    const rect = icon.getBoundingClientRect();
    return document.querySelector(${JSON.stringify(selector)}).contains(document.elementFromPoint(rect.left + rect.width/2, rect.top + rect.height/2));
  })()`);
  await drag(-20, -20);
  assert.equal(
    await evaluate(
      `document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().left`,
    ),
    0,
  );
  assert.equal(await covered(), true, `${selector} covers desktop icons`);
  assert.equal(
    await evaluate(
      `(() => { const start = document.querySelector('#windows-start'); const rect=start.getBoundingClientRect(); return start.contains(document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2)); })()`,
    ),
    true,
  );
  if (allEdges) {
    const edges = () =>
      evaluate(`(() => {
      const rect=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      const desktop=document.querySelector('.desktop').getBoundingClientRect();
      const task=document.querySelector('.taskbar').getBoundingClientRect();
      const start=document.querySelector('#windows-start');const s=start.getBoundingClientRect();
      return {left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,desktopRight:desktop.right,taskTop:task.top,startClickable:start.contains(document.elementFromPoint(s.left+s.width/2,s.top+s.height/2)),taskClickable:!!document.elementFromPoint(task.right-20,task.top+task.height/2)?.closest('.taskbar')};
    })()`);
    assert.equal((await edges()).top, 0);
    await drag(10000, -20);
    let state = await edges();
    assert.equal(state.right, state.desktopRight);
    assert.equal(state.top, 0);
    await drag(10000, 10000);
    state = await edges();
    assert.equal(state.bottom, state.taskTop);
    assert.equal(state.startClickable, true);
    assert.equal(state.taskClickable, true);
    await drag(-10000, 10000);
    state = await edges();
    assert.equal(state.left, 0);
    assert.equal(state.bottom, state.taskTop);
    await drag(0, 0);
    // The titlebar must really be hit-testable in the former HUD exclusion zone.
    assert.equal(
      await evaluate(
        `(() => {const bar=document.querySelector(${JSON.stringify(selector + ' .titlebar')});const r=bar.getBoundingClientRect();return bar.contains(document.elementFromPoint(r.left+60,r.top+r.height/2));})()`,
      ),
      true,
    );
    return;
  }
  await drag(640, 0);
  assert.equal(await covered(), false);
  await physicalClick('[data-shortcut=msn]');
  assert.equal(
    await evaluate("document.querySelector('[data-shortcut=msn]').getAttribute('aria-pressed')"),
    'true',
  );
  assert.equal(
    await evaluate(
      "JSON.stringify(JSON.parse(localStorage.getItem('chaos-survival-story-v1')).desktopIcons)",
    ),
    saved,
  );
}

async function verifyTypingIndicator() {
  const story = JSON.parse(await readFile(path.join(root, 'src/config/story.json')));
  const intro = JSON.parse(await readFile(path.join(root, 'src/dialogues/pixelgirl-intro.json')));
  const progression = new Progression(story);
  progression.begin();
  progression.complete('arcade-1');
  const session = new DialogueSession(intro, progression);
  session.deliver();
  session.deliver(); // Start with the next existing message, whose typing window lasts 900 ms.
  const fixture = JSON.stringify(progression.data);
  async function start() {
    // Inject before the new app starts; a live conversation must not overwrite this fixture.
    const marker = String(Date.now());
    await command('Page.enable');
    const injected = await command('Page.addScriptToEvaluateOnNewDocument', {
      source: `localStorage.setItem('chaos-survival-story-v1',${JSON.stringify(fixture)});window.__typingFixture=${JSON.stringify(marker)}`,
    });
    await command('Page.reload');
    await until(
      () =>
        evaluate(
          `window.__typingFixture===${JSON.stringify(marker)}&&window.chaosDebug?.snapshot().phase==='menu'`,
        ).catch(() => false),
      'typing fixture reload',
    ).catch(async (error) => {
      throw new Error(
        error.message +
          JSON.stringify(
            await evaluate(
              `({marker: window.__typingFixture, phase: window.chaosDebug?.snapshot().phase, expected: ${JSON.stringify(marker)}})`,
            ),
          ) +
          JSON.stringify(exceptions),
      );
    });
    await command('Page.removeScriptToEvaluateOnNewDocument', { identifier: injected.identifier });
    await click('#menu-play');
    await until(
      () => evaluate("!!document.querySelector('.contact-typing.is-typing')"),
      'NPC is typing',
    ).catch(async (error) => {
      const state = await evaluate(
        `({phase: window.chaosDebug?.snapshot().phase, log: !!document.querySelector('.conversation-log'), indicator: document.querySelector('.contact-typing')?.outerHTML, saved: JSON.parse(localStorage.getItem('chaos-survival-story-v1'))?.dialogues['pixelgirl-intro'], exceptions: ${JSON.stringify(exceptions)}})`,
      );
      throw new Error(error.message + JSON.stringify(state));
    });
    assert.equal(
      await evaluate("document.querySelector('.contact-typing').textContent"),
      "xX_PixelGirl_Xx est en train d'\u00e9crire...",
    );
    assert.ok(
      await evaluate(
        "document.querySelector('.conversation-flow') === document.querySelector('.contact-typing').parentElement",
      ),
    );
    assert.equal(
      await evaluate("!!document.querySelector('.conversation-log .contact-typing')"),
      true,
    );
    assert.equal(await evaluate("document.querySelectorAll('.dialogue-choice').length"), 0);
    const inline = await evaluate(`(() => {
      const flow = document.querySelector('.conversation-flow');
      flow.closest('.popup').style.animation = 'none';
      const log = document.querySelector('.conversation-log');
      const indicator = document.querySelector('.contact-typing');
      const last = [...flow.querySelectorAll('.conversation-message')].at(-1);
      const lastBounds = last.getBoundingClientRect();
      const bounds = indicator.getBoundingClientRect();
      const spacer = document.createElement('div');
      spacer.style.height = '2000px';
      flow.prepend(spacer);
      log.scrollTop = 0;
      const before = indicator.getBoundingClientRect().top;
      log.scrollTop += 40;
      const after = indicator.getBoundingClientRect().top;
      const diagnostics = { before, after, scroll: log.scrollTop, height: log.clientHeight, content: log.scrollHeight };
      spacer.remove();
      return { diagnostics, last: flow.lastElementChild === indicator,
        underMessage: bounds.top >= lastBounds.bottom,
        followsScroll: Math.abs(before - after - 40) < 1 };
    })()`);
    assert.ok(inline.last && inline.underMessage && inline.followsScroll, JSON.stringify(inline));
  }
  async function received() {
    await until(
      () =>
        evaluate(
          "JSON.parse(localStorage.getItem('chaos-survival-story-v1')).dialogues['pixelgirl-intro'].cursor===4",
        ),
      'messages continue in background',
    );
  }
  await start();
  await click('.popup-narrative .msn-minimize');
  await received();
  await click('[data-app=\"messenger:conversation:pixelgirl\"]');
  assert.equal(await evaluate("!!document.querySelector('.contact-typing')"), false);
  assert.equal(await evaluate("document.querySelectorAll('.dialogue-choice').length"), 3);
  await command('Emulation.setDeviceMetricsOverride', {
    width: 800,
    height: 600,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await start();
  await click('.popup-narrative .close-button');
  await received();
  await click('#windows-start');
  await click('#menu-messenger');
  await evaluate(
    "document.querySelector('[data-contact-id=pixelgirl]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))",
  );
  assert.equal(await evaluate("!!document.querySelector('.contact-typing')"), false);
  assert.equal(await evaluate("document.querySelectorAll('.dialogue-choice').length"), 3);
  assert.equal(
    await evaluate("document.querySelectorAll('.conversation-log .from-contact').length"),
    4,
  );
  assert.equal(exceptions.length, 0, JSON.stringify(exceptions));
  console.log(
    'OK: typing follows messages in the chat, respects reading history, nickname, background reception after minimize/close, restoration and persistent choices; no Electron.',
  );
}

async function verifyMessengerWindows() {
  await command('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const roster = '[data-messenger-view="contacts"]';
  const pixel = '[data-messenger-contact="pixelgirl"]';
  const skater = '[data-messenger-contact="skater"]';
  const bubble = '[data-messenger-contact="princess"]';
  await click('#windows-start');
  await click('#menu-messenger');
  assert.ok(await evaluate(`!!document.querySelector('${roster} .messenger-contact-list')`));
  await capture('messenger-contacts-list.png');
  const saved = await evaluate(
    "JSON.stringify(JSON.parse(localStorage.getItem('chaos-survival-story-v1')).dialogues)",
  );
  const openContact = async (id) =>
    evaluate(
      `document.querySelector('[data-contact-id=${id}]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`,
    );
  await openContact('skater');
  await openContact('princess');
  await openContact('pixelgirl');
  assert.equal(await evaluate("document.querySelectorAll('[data-messenger-contact]').length"), 3);
  assert.equal(await evaluate(`document.querySelector('${roster}').hidden`), false);
  assert.equal(await evaluate("!!document.querySelector('#messenger-contacts')"), false);
  assert.equal(
    await evaluate(
      `document.querySelectorAll('${skater} .conversation-message, ${bubble} .conversation-message').length`,
    ),
    0,
  );
  assert.equal(
    await evaluate(
      `document.querySelectorAll('${skater} .dialogue-choice, ${bubble} .dialogue-choice').length`,
    ),
    0,
  );
  assert.equal(await evaluate(`document.querySelectorAll('${pixel} .dialogue-choice').length`), 3);
  assert.equal(
    await evaluate(
      "JSON.stringify(JSON.parse(localStorage.getItem('chaos-survival-story-v1')).dialogues)",
    ),
    saved,
  );
  await openContact('skater');
  assert.equal(await evaluate("document.querySelectorAll('[data-messenger-contact]').length"), 3);
  await click(`${skater} .msn-minimize`);
  assert.equal(await evaluate(`document.querySelector('${skater}').hidden`), true);
  assert.equal(await evaluate(`document.querySelector('${bubble}').hidden`), false);
  await click('[data-app="messenger:conversation:skater"]');
  assert.equal(await evaluate(`document.querySelector('${skater}').hidden`), false);
  await click(`${skater} .close-button`);
  assert.equal(
    await evaluate('!!document.querySelector(\'[data-app="messenger:conversation:skater"]\')'),
    false,
  );
  await openContact('skater');
  const menuAction = async (windowSelector, group, action) => {
    await evaluate(`(() => { const element = document.querySelector(${JSON.stringify(windowSelector)});
      [...element.querySelectorAll('.messenger-menu-group > button')].find(button => button.textContent === ${JSON.stringify(group)}).click();
      [...element.querySelectorAll('.messenger-dropdown:not([hidden]) button')].find(button => button.textContent === ${JSON.stringify(action)}).click(); })()`);
  };
  await menuAction(pixel, 'Contacts', 'Consulter le profil');
  assert.equal(
    await evaluate('document.querySelector(\'[data-messenger-view^="profile:"] h3\').textContent'),
    'xX_PixelGirl_Xx',
  );
  await click('[data-messenger-view^="profile:"] .close-button');
  await menuAction(pixel, 'Actions', 'Émoticônes');
  await click('[data-messenger-view=emoticons] .messenger-emoticons button');
  assert.equal(await evaluate("document.querySelector('.emoticon-preview').textContent"), ':)');
  await click('[data-messenger-view=emoticons] .close-button');
  await menuAction(pixel, 'Actions', 'Wizz !');
  assert.equal(
    await evaluate(`document.querySelector('${pixel}').classList.contains('messenger-wizz')`),
    true,
  );
  assert.equal(
    await evaluate(`document.querySelector('${skater} [data-msn-action=wizz]').disabled`),
    true,
  );
  await menuAction(pixel, 'Outils', 'Options de Messenger');
  await evaluate(
    "const input = document.querySelector('.messenger-volume'); input.value = 37; input.dispatchEvent(new Event('input')); ",
  );
  await click('[data-messenger-view=options] .close-button');
  await menuAction(pixel, 'Outils', 'Options de Messenger');
  assert.equal(await evaluate("document.querySelector('.messenger-volume').value"), '37');
  await click('[data-messenger-view=options] .close-button');
  await menuAction(pixel, 'Aide', 'À propos');
  assert.ok(
    await evaluate(
      "document.querySelector('[data-messenger-view=about]').textContent.includes('2009')",
    ),
  );
  await click('[data-messenger-view=about] .close-button');
  await evaluate(`document.querySelector('${pixel} .messenger-menu-group > button').focus();`);
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown' });
  assert.equal(
    await evaluate(
      `document.querySelectorAll('${pixel} .messenger-dropdown:not([hidden])').length`,
    ),
    1,
  );
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  assert.equal(
    await evaluate(
      `document.querySelectorAll('${pixel} .messenger-dropdown:not([hidden])').length`,
    ),
    0,
  );
  await click(`${pixel} .messenger-menu-group > button`);
  await evaluate(
    `document.querySelector('${pixel} .contact-name').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));`,
  );
  assert.equal(
    await evaluate(
      `document.querySelectorAll('${pixel} .messenger-dropdown:not([hidden])').length`,
    ),
    0,
  );
  await menuAction(roster, 'Fichier', 'Fermer la fenêtre');
  assert.equal(await evaluate(`!!document.querySelector('${roster}')`), false);
  assert.equal(await evaluate(`!!document.querySelector('${pixel}')`), true);
  await click(`${pixel} .close-button`);
  await click(`${skater} .close-button`);
  await click(`${bubble} .close-button`);
  const historyBefore = await evaluate(
    "JSON.parse(localStorage.getItem('chaos-survival-story-v1')).conversations.pixelgirl.history.length",
  );
  await evaluate(
    "document.querySelector('[data-shortcut=arcade]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))",
  );
  await until(() => evaluate("window.chaosDebug.snapshot().phase==='playing'"), 'replay started');
  await until(
    () =>
      evaluate(
        `JSON.parse(localStorage.getItem('chaos-survival-story-v1')).conversations.pixelgirl.history.length > ${historyBefore}`,
      ),
    'replay received with Messenger closed',
  );
  await click('#windows-start');
  await click('#menu-messenger');
  await openContact('pixelgirl');
  await until(
    () =>
      evaluate(
        `document.querySelector('${pixel} .conversation-log').textContent.includes('et bah !!!')`,
      ),
    'replay in unique history',
  );
  // Let the remaining replay messages arrive while the roster covers the chat.
  await click('#windows-start');
  await click('#menu-messenger');
  await evaluate("window.__contactRow = document.querySelector('[data-contact-id=pixelgirl]')");
  await until(
    () =>
      evaluate(
        `document.querySelector('[data-app="messenger:conversation:pixelgirl"]').classList.contains('messenger-unread')`,
      ),
    'unread conversation task flashes behind roster',
  );
  assert.equal(
    await evaluate("window.__contactRow === document.querySelector('[data-contact-id=pixelgirl]')"),
    true,
  );
  await click('[data-app="messenger:conversation:pixelgirl"]');
  await until(
    () =>
      evaluate(
        `!document.querySelector('[data-app="messenger:conversation:pixelgirl"]').classList.contains('messenger-unread')`,
      ),
    'reading clears flashing',
  );
  await until(
    () => evaluate(`document.querySelectorAll('${pixel} .dialogue-choice').length===3`),
    'original unanswered choices preserved after message-only replay',
  );
  await capture('messenger-independent-windows.png');
  const history = await evaluate(
    "JSON.stringify(JSON.parse(localStorage.getItem('chaos-survival-story-v1')).conversations.pixelgirl.history)",
  );
  await click(`${pixel} .close-button`);
  await openContact('pixelgirl');
  assert.equal(
    await evaluate(
      "JSON.stringify(JSON.parse(localStorage.getItem('chaos-survival-story-v1')).conversations.pixelgirl.history)",
    ),
    history,
  );
  const launches = await evaluate(
    "JSON.parse(localStorage.getItem('chaos-survival-story-v1')).level1Launches",
  );
  await command('Page.reload');
  await until(() => evaluate("window.chaosDebug?.snapshot().phase==='menu'"), 'restart menu');
  await click('#menu-play');
  await until(
    () => evaluate(`!!document.querySelector('${pixel} .conversation-log')`),
    'restored narrative chat',
  );
  assert.equal(
    await evaluate(
      "JSON.stringify(JSON.parse(localStorage.getItem('chaos-survival-story-v1')).conversations.pixelgirl.history)",
    ),
    history,
  );
  assert.equal(
    await evaluate("JSON.parse(localStorage.getItem('chaos-survival-story-v1')).level1Launches"),
    launches,
  );
  assert.equal(await evaluate(`document.querySelectorAll('${pixel} .dialogue-choice').length`), 3);
  assert.equal(exceptions.length, 0, JSON.stringify(exceptions));
  console.log(
    'OK: independent roster and conversations, duplicate prevention, taskbar restore/close, profiles, menus/keyboard/outside click, options, emoticons, Wizz, closed-window replay reception, unread flashing and preserved history/choices; no Electron.',
  );
}

async function verifyRulesFlow() {
  await click('#menu-play');
  await until(() => evaluate("!!document.querySelector('.rules-confirm')"), 'arcade first rules');
  assert.equal(await evaluate('window.chaosDebug.snapshot().phase'), 'rules');
  assert.equal(await evaluate('window.chaosDebug.snapshot().audioTime'), 0);
  assert.equal(await evaluate('window.chaosDebug.snapshot().launches'), 0);
  assert.equal(await evaluate("document.querySelectorAll('#playfield .popup').length"), 0);
  await wait(300);
  assert.equal(await evaluate('window.chaosDebug.snapshot().audioTime'), 0);
  await click('.rules-confirm');
  await until(
    () => evaluate("window.chaosDebug.snapshot().phase==='playing'"),
    'arcade starts after confirmation',
  );
  assert.equal(
    await evaluate(
      "JSON.parse(localStorage.getItem('chaos-survival-story-v1')).tutorials['arcade-1']",
    ),
    true,
  );
  await click('#help-button');
  await until(
    () =>
      evaluate(
        "!!document.querySelector('.rules-confirm')&&window.chaosDebug.snapshot().phase==='paused'",
      ),
    'voluntary rules pause',
  );
  const time = await evaluate('window.chaosDebug.snapshot().audioTime');
  await wait(300);
  assert.equal(await evaluate('window.chaosDebug.snapshot().audioTime'), time);
  await click('.rules-confirm');
  await until(
    () => evaluate("window.chaosDebug.snapshot().phase==='playing'"),
    'controlled resume',
  );
  await click('#windows-start');
  assert.equal(await evaluate("!!document.querySelector('#menu-help')"), false);
  await click('#return-main-menu');
  await click('#menu-play');
  await until(
    () => evaluate("window.chaosDebug.snapshot().phase==='playing'"),
    'continue without mandatory rules',
  );
  assert.equal(await evaluate("!!document.querySelector('.rules-layer')"), false);
  await click('#windows-start');
  await click('#return-main-menu');
  await verifyMiniGameLaunch();
  console.log(
    'OK: first arcade rules before audio, persisted approval, direct replay, paused voluntary review, Smiley tutorial and Start menu cleanup.',
  );
}
