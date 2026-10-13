import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { projectRoot, verifyArchive } from './verify-package.mjs';
import { verifyStoryUI } from './story-ui-check.mjs';
import { verifyMenuUI } from './menu-ui-check.mjs';

assert.equal(process.platform, 'win32', 'Cette vérification doit être exécutée sur Windows.');
const run = promisify(execFile);
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const isInside = (directory, filename) => {
  const relative = path.relative(directory, filename);
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
};

const temporaryRoot = await realpath(os.tmpdir());
const testRoot = await mkdtemp(path.join(temporaryRoot, 'ChaosSurvival-check-'));
const shareDirectory = path.join(testRoot, 'Jeu portable à partager');
const runtimeDirectory = path.join(testRoot, 'Extraction temporaire');
const profileDirectory = path.join(testRoot, 'Profil de test');
const artifact = path.join(projectRoot, 'release/ChaosSurvival.exe');
const copiedExecutable = path.join(shareDirectory, 'ChaosSurvival.exe');
let child,
  socket,
  spawnError,
  stderr = '',
  sequence = 0;
const pending = new Map();
const exceptions = [];
const requests = new Map();
const networkFailures = [];
const verifyMusic = process.argv.includes('--music') || process.argv.includes('--story');
let musicalChecks;
let storyChecks;
let menuChecks;

async function freePort() {
  const listener = createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

function command(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Le diagnostic ne répond pas : ${method}`));
    }, 15000);
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

async function until(check, description, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await wait(100);
  }
  let diagnostic;
  if (socket?.readyState === WebSocket.OPEN) {
    try {
      diagnostic = await evaluate('window.chaosDebug?.snapshot()');
    } catch {
      /* Keep original error. */
    }
  }
  throw new Error(`Délai dépassé : ${description}. ${JSON.stringify(diagnostic)}`);
}

async function waitForExit() {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Le jeu ne se ferme pas.')), 10000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

try {
  await mkdir(shareDirectory);
  await mkdir(runtimeDirectory);
  await mkdir(profileDirectory);
  await copyFile(artifact, copiedExecutable);
  assert.ok(!isInside(projectRoot, shareDirectory), 'Le test doit être extérieur au projet.');
  assert.deepEqual(await readdir(shareDirectory), ['ChaosSurvival.exe']);
  const artifactBytes = await readFile(artifact);
  const executableSha256 = digest(artifactBytes);
  assert.equal(digest(await readFile(copiedExecutable)), executableSha256);

  const port = await freePort();
  const env = {
    ...process.env,
    PATH: path.join(process.env.SystemRoot || 'C:/Windows', 'System32'),
    TEMP: runtimeDirectory,
    TMP: runtimeDirectory,
    CHAOS_DEV_URL: 'http://127.0.0.1:1/',
  };
  for (const key of [
    'NODE_OPTIONS',
    'NODE_PATH',
    'ELECTRON_RUN_AS_NODE',
    'ELECTRON_OVERRIDE_DIST_PATH',
    'ELECTRON_NO_ASAR',
  ])
    delete env[key];
  async function launchPortable() {
    spawnError = undefined;
    child = spawn(
      copiedExecutable,
      [`--remote-debugging-port=${port}`, `--user-data-dir=${profileDirectory}`],
      { cwd: shareDirectory, env, windowsHide: false, stdio: ['ignore', 'ignore', 'pipe'] },
    );
    child.once('error', (error) => {
      spawnError = error;
    });
    child.stderr.on('data', (data) => {
      stderr = (stderr + data).slice(-8192);
    });

    let target;
    await until(
      async () => {
        if (spawnError) throw spawnError;
        assert.equal(
          child.exitCode,
          null,
          `Le portable s’est arrêté avant le chargement. ${stderr}`,
        );
        try {
          const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
            signal: AbortSignal.timeout(1000),
          });
          const targets = await response.json();
          target = targets.find(
            (item) => item.type === 'page' && item.url.startsWith('chaos://game/'),
          );
          return Boolean(target);
        } catch {
          return false;
        }
      },
      'démarrage du portable',
      45000,
    );

    socket = new WebSocket(target.webSocketDebuggerUrl);
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      const request = pending.get(message.id);
      if (request) {
        clearTimeout(request.timer);
        pending.delete(message.id);
        if (message.error) request.reject(new Error(JSON.stringify(message.error)));
        else request.resolve(message.result);
      }
      if (message.method === 'Runtime.exceptionThrown')
        exceptions.push(message.params.exceptionDetails);
      if (message.method === 'Network.requestWillBeSent')
        requests.set(message.params.requestId, message.params.request.url);
      if (message.method === 'Network.loadingFailed')
        networkFailures.push({
          url: requests.get(message.params.requestId),
          error: message.params.errorText,
        });
    });
    await once(socket, 'open');
    await command('Runtime.enable');
    await command('Network.enable');
    // Keep the diagnostic page visible when the host desktop changes focus.
    // This only affects the test; normal gameplay still pauses when minimized.
    await command('Emulation.setFocusEmulationEnabled', { enabled: true });
    await until(() => evaluate("!!document.querySelector('#start-button')"), 'interface du jeu');
    await until(() => evaluate("!!document.querySelector('#main-menu')"), 'menu principal');
  }
  await launchPortable();
  if (process.argv.includes('--menu')) {
    const outputDirectory = path.join(projectRoot, '.qa');
    await mkdir(outputDirectory, { recursive: true });
    menuChecks = await verifyMenuUI({
      evaluate,
      command,
      until,
      wait,
      outputDirectory,
      restart: async () => {
        await evaluate('window.close()');
        await waitForExit();
        socket.close();
        await wait(200);
        await launchPortable();
      },
    });
  }
  assert.equal(await evaluate('location.protocol'), 'chaos:');
  assert.equal(await evaluate('typeof process'), 'undefined');
  console.log(
    'OK : un seul EXE, lancé hors du projet avec espaces et accents, sans Node.js dans le PATH.',
  );

  // Inspect only this test's processes; leave any existing game session alone.
  const processQuery = `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); Get-CimInstance Win32_Process -Filter "Name = 'ChaosSurvival.exe'" | Where-Object { $_.CommandLine -like '*--remote-debugging-port=${port}*' -and $_.CommandLine -notlike '*--type=*' } | Select-Object ProcessId,ExecutablePath | ConvertTo-Json -Compress`;
  const { stdout } = await run(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(processQuery, 'utf16le').toString('base64'),
    ],
    { windowsHide: true, encoding: 'utf8' },
  );
  const candidates = JSON.parse(stdout);
  const processes = Array.isArray(candidates) ? candidates : [candidates];
  const application = processes.find(
    (item) => item.ExecutablePath && isInside(runtimeDirectory, item.ExecutablePath),
  );
  assert.ok(
    application,
    'Le moteur Electron doit provenir de l’extraction temporaire du portable.',
  );
  const actualArchive = path.join(path.dirname(application.ExecutablePath), 'resources/app.asar');
  assert.ok(isInside(runtimeDirectory, actualArchive));
  const archive = await verifyArchive(actualArchive);
  console.log(
    `OK : les ${archive.files.length} ressources du portable réellement lancé correspondent au build.`,
  );

  const assets = archive.files.filter((file) => file.path.startsWith('dist/'));
  const assetRequests = assets.map((file) => ({
    ...file,
    url: `chaos://game/${file.path.slice(5)}`,
  }));
  const loadedAssets = await evaluate(`(async () => {
    const assets = ${JSON.stringify(assetRequests)};
    const loaded = [];
    for (const asset of assets) {
      const response = await fetch(asset.url, { cache: 'no-store' });
      const bytes = await response.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const sha256 = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
      loaded.push({ path: asset.path, url: asset.url, status: response.status, bytes: bytes.byteLength, sha256 });
    }
    return loaded;
  })()`);
  for (const asset of loadedAssets) {
    const expected = assets.find((file) => file.path === asset.path);
    assert.equal(asset.status, 200, asset.path);
    assert.equal(asset.sha256, expected.sha256, asset.path);
    assert.equal(asset.bytes, expected.bytes, asset.path);
  }
  const pageAssets = await evaluate(
    "[...document.scripts].map(script => script.src).concat([...document.querySelectorAll('link[href]')].map(link => link.href))",
  );
  assert.ok(pageAssets.length > 0 && pageAssets.every((url) => url.startsWith('chaos://game/')));
  console.log(
    'OK : HTML, JavaScript, CSS, images et musique chargent exclusivement depuis le portable.',
  );

  const offlineProbe = 'https://example.invalid/chaos-survival-offline-check';
  assert.equal(
    await evaluate(`fetch(${JSON.stringify(offlineProbe)}).then(() => false, () => true)`),
    true,
  );
  await until(
    () => networkFailures.some((failure) => failure.url === offlineProbe),
    'blocage réseau',
  );
  const blocked = networkFailures.find((failure) => failure.url === offlineProbe);
  assert.equal(blocked.error, 'net::ERR_BLOCKED_BY_CLIENT', JSON.stringify(blocked));
  console.log('OK : accès réseau bloqué dans le jeu ; aucun serveur de développement nécessaire.');

  await evaluate("document.querySelector('#menu-play').click()");
  await until(
    () =>
      evaluate(
        "document.querySelector('#intro-layer').hidden && !document.querySelector('#pause-button').disabled",
      ),
    'démarrage de la musique',
  );
  await wait(1800);
  const playback = await evaluate("document.querySelector('#track-time').textContent");
  assert.ok(!playback.startsWith('00:00'), playback);
  await evaluate("document.querySelector('#pause-button').click()");
  await until(
    () => evaluate("document.querySelector('#dialog-title').textContent === 'Une petite pause ?'"),
    'pause',
  );
  const paused = await evaluate("document.querySelector('#track-time').textContent");
  await wait(1200);
  assert.equal(await evaluate("document.querySelector('#track-time').textContent"), paused);
  await evaluate("document.querySelector('#dialog-action').click()");
  await until(
    () =>
      evaluate(`document.querySelector('#track-time').textContent !== ${JSON.stringify(paused)}`),
    'reprise de la musique',
  );
  await until(
    () => evaluate("!!document.querySelector('.popup:not(.preview-window) .close-button')"),
    'apparition des fenêtres',
  );
  await evaluate("document.querySelector('.popup:not(.preview-window) .close-button').click()");
  assert.ok(Number(await evaluate("document.querySelector('#score').textContent")) >= 100);
  assert.equal(exceptions.length, 0, JSON.stringify(exceptions));
  console.log('OK : musique décodée, pause/reprise et gameplay avec score, sans réseau.');

  if (verifyMusic) {
    await mkdir(path.join(projectRoot, '.qa'), { recursive: true });
    const music = JSON.parse(
      await readFile(path.join(projectRoot, 'src/config/music-lvl1.analysis.json'), 'utf8'),
    );
    const snapshot = () => evaluate('window.chaosDebug.snapshot()');
    const initial = await snapshot();
    assert.equal(initial.sourceHash, music.source.sha256);
    assert.equal(initial.beatCount, music.beats.length);
    await evaluate("document.querySelector('#music-debug-button').click()");
    assert.ok(await evaluate("!document.querySelector('#music-debug').hidden"));
    assert.ok(
      (await evaluate("document.querySelector('#music-debug-status').textContent")).includes(
        String(music.bpm),
      ),
    );
    await evaluate("document.querySelector('#pause-button').click()");
    await until(
      () =>
        evaluate("document.querySelector('#dialog-title').textContent === 'Une petite pause ?'"),
      'pause musicale',
    );
    const frozen = await snapshot();
    await wait(700);
    assert.equal((await snapshot()).audioTime, frozen.audioTime);
    await evaluate(
      "const offset = document.querySelector('#sync-offset'); offset.value = '120'; offset.dispatchEvent(new Event('input', { bubbles: true }))",
    );
    const calibrated = await snapshot();
    assert.equal(calibrated.offset, 0.12);
    assert.ok(Math.abs(calibrated.time - (calibrated.audioTime - 0.12)) < 0.0001);
    await evaluate(
      "document.querySelector('#reset-sync').click(); document.querySelector('#music-debug-button').click(); document.querySelector('#dialog-secondary').click()",
    );
    await until(
      () => evaluate("window.chaosDebug.snapshot().phase === 'playing'"),
      'redémarrage musical',
    );
    const restarted = await snapshot();
    assert.ok(restarted.audioTime < 0.5);
    assert.equal(restarted.open, 0);
    assert.equal(restarted.skipped, 0);
    assert.equal(Number(await evaluate("document.querySelector('#score').textContent")), 0);
    console.log(
      'OK : debug intégré, calibration, pause exacte et redémarrage sans événement précédent.',
    );

    await until(async () => (await snapshot()).open === 3, 'trois fenêtres de tutoriel', 12000);
    await command('Emulation.setDeviceMetricsOverride', {
      width: 800,
      height: 600,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await wait(250);
    const accessible =
      await evaluate(`Array.from(document.querySelectorAll('.popup .close-button')).map(button => {
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      return { x, y, accessible: document.elementFromPoint(x, y) === button };
    })`);
    assert.equal(accessible.length, 3);
    assert.ok(
      accessible.every((item) => item.accessible),
      JSON.stringify(accessible),
    );
    const smallScreenshot = await command('Page.captureScreenshot');
    await writeFile(
      path.join(projectRoot, '.qa/music-small.png'),
      Buffer.from(smallScreenshot.data, 'base64'),
    );
    await command('Emulation.clearDeviceMetricsOverride');
    await wait(200);
    // Actual pointer events confirm that titlebars remain clickable after resize.
    for (let i = 0; i < 3; i++) {
      const point = await evaluate(
        `(() => { const r = document.querySelector('.popup .close-button').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`,
      );
      await command('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        button: 'left',
        clickCount: 1,
        ...point,
      });
      await command('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        button: 'left',
        clickCount: 1,
        ...point,
      });
    }
    assert.equal((await snapshot()).open, 0);
    console.log('OK : trois croix accessibles à 800 × 600, clics réels et redimensionnement.');

    let nextClick = (await snapshot()).audioTime + 2.5;
    let stalled = false;
    let peakOpen = 0;
    let maxChaos = 0;
    const deadline = Date.now() + 100000;
    while (Date.now() < deadline) {
      const data = await snapshot();
      peakOpen = Math.max(peakOpen, data.open);
      maxChaos = Math.max(
        maxChaos,
        Number(
          await evaluate(
            "document.querySelector('#chaos-meter')?.getAttribute('aria-valuenow') ?? document.querySelector('.chaos-meter').getAttribute('aria-valuenow')",
          ),
        ),
      );
      assert.ok(data.open <= 3);
      assert.ok(data.maxLateness <= 0.18, JSON.stringify(data));
      if (data.phase === 'ended') break;
      assert.equal(data.phase, 'playing');
      if (!stalled && data.audioTime > 24) {
        await evaluate(
          '(() => { const end = performance.now() + 1200; while (performance.now() < end) {} })()',
        );
        stalled = true;
      }
      if (data.audioTime >= nextClick && data.open) {
        await evaluate("document.querySelector('.popup .close-button').click()");
        nextClick = data.audioTime + 2.5;
      }
      await wait(200);
    }
    const final = await snapshot();
    assert.equal(final.phase, 'ended');
    assert.equal(
      await evaluate("document.querySelector('#dialog-title').textContent"),
      'Tu as survécu !',
    );
    assert.ok(stalled);
    assert.ok(final.skipped > 0);
    musicalChecks = {
      bpm: music.bpm,
      beats: music.beats.length,
      fullLevelWon: true,
      maxLatenessSeconds: final.maxLateness,
      skippedWindows: final.skipped,
      peakOpen,
      maxChaos,
      debug: true,
      calibration: true,
      restart: true,
      smallWindow: true,
      rendererStall: true,
    };
    console.log(
      `OK : niveau complet réussi à un clic / 2,5 s, y compris après un blocage de 1,2 s ; retard max ${Math.round(final.maxLateness * 1000)} ms.`,
    );
    if (process.argv.includes('--story'))
      storyChecks = await verifyStoryUI({
        evaluate,
        command,
        until,
        wait,
        outputDirectory: path.join(projectRoot, '.qa'),
        victory: true,
      });
  }

  const qaDirectory = path.join(projectRoot, '.qa');
  await mkdir(qaDirectory, { recursive: true });
  const screenshot = await command('Page.captureScreenshot');
  await writeFile(
    path.join(qaDirectory, 'portable-verification.png'),
    Buffer.from(screenshot.data, 'base64'),
  );
  await evaluate('window.close()');
  await waitForExit();
  assert.equal(child.exitCode, 0, 'Le portable doit se fermer sans erreur.');
  await assert.rejects(
    readFile(actualArchive),
    'L’extraction temporaire doit être nettoyée à la fermeture.',
  );
  await writeFile(
    path.join(qaDirectory, 'portable-verification.json'),
    JSON.stringify(
      {
        passed: true,
        verifiedAt: new Date().toISOString(),
        executable: { path: artifact, bytes: artifactBytes.length, sha256: executableSha256 },
        environment: {
          copiedExecutable,
          cwd: shareDirectory,
          PATH: env.PATH,
          runtimeArchive: actualArchive,
          visibilityEmulated: true,
        },
        loadedAssets,
        musicalChecks,
        storyChecks,
        menuChecks,
        checks: {
          exeOnly: true,
          outsideProject: true,
          embeddedArchiveVerified: true,
          networkBlocked: true,
          audio: true,
          pauseResume: true,
          gameplay: true,
          temporaryFilesCleaned: true,
        },
      },
      null,
      2,
    ) + '\n',
  );
  console.log('VÉRIFICATION PORTABLE RÉUSSIE. Rapport : .qa/portable-verification.json');
} finally {
  if (socket?.readyState === WebSocket.OPEN && child?.exitCode === null) {
    try {
      await evaluate('window.close()');
      await waitForExit();
    } catch {
      /* Terminate only our test below. */
    }
  }
  socket?.close();
  for (const request of pending.values()) clearTimeout(request.timer);
  if (child?.pid && child.exitCode === null && child.signalCode === null) {
    await run('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }).catch(
      () => {},
    );
  }
  const resolvedTestRoot = await realpath(testRoot);
  assert.ok(
    isInside(temporaryRoot, resolvedTestRoot) &&
      path.basename(resolvedTestRoot).startsWith('ChaosSurvival-check-'),
    'Nettoyage limité au dossier temporaire créé par ce test.',
  );
  await rm(resolvedTestRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
}
