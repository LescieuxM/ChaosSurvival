const { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { resolveLocalAsset } = require('./local-assets.cjs');

const productionUrl = 'chaos://game/index.html';
// A packaged executable always loads its own bundled game.
const devUrl = !app.isPackaged ? process.env.CHAOS_DEV_URL : undefined;
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'chaos',
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

async function createWindow() {
  const window = new BrowserWindow({
    title: 'Chaos Survival',
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    useContentSize: true,
    backgroundColor: '#3a95d7',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  window.chaosReady = new Promise((resolve) =>
    window.once('ready-to-show', () => {
      window.show();
      resolve();
    }),
  );
  for (const event of ['enter-full-screen', 'leave-full-screen'])
    window.on(event, () => {
      window.webContents.send('chaos:fullscreen-changed', window.isFullScreen());
    });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== (devUrl || productionUrl)) event.preventDefault();
  });
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.isAutoRepeat) return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
      event.preventDefault();
      window.setFullScreen(!window.isFullScreen());
    }
    if (devUrl && input.key === 'F12') {
      event.preventDefault();
      window.webContents.toggleDevTools();
    }
  });

  await window.loadURL(devUrl || productionUrl);
}

app
  .whenReady()
  .then(async () => {
    ipcMain.handle(
      'chaos:get-fullscreen',
      (event) => BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false,
    );
    ipcMain.handle('chaos:set-fullscreen', async (event, value) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) await window.chaosReady;
      if (window && typeof value === 'boolean') window.setFullScreen(value);
      return window?.isFullScreen() ?? false;
    });
    Menu.setApplicationMenu(null);
    app.setAppUserModelId('com.chaossurvival.game');
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
      callback(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);

    if (!devUrl) {
      // The shipped game only needs bundled files, even when Windows is online.
      session.defaultSession.webRequest.onBeforeRequest(
        { urls: ['<all_urls>'] },
        (details, callback) => callback({ cancel: /^(https?|wss?|ftp):/i.test(details.url) }),
      );
    }

    const assetRoot = path.join(app.getAppPath(), 'dist');
    protocol.handle('chaos', async (request) => {
      if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      try {
        const filename = resolveLocalAsset(assetRoot, request.url);
        if (!filename) return new Response('Forbidden', { status: 403 });
        return await net.fetch(pathToFileURL(filename).href);
      } catch {
        return new Response('Not found', { status: 404 });
      }
    });

    await createWindow();
    app.on('activate', () => {
      if (!BrowserWindow.getAllWindows().length) createWindow().catch(showStartupError);
    });
  })
  .catch(showStartupError);

function showStartupError(error) {
  dialog.showErrorBox('Chaos Survival — démarrage impossible', error.message);
  app.quit();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
