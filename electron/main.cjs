const { app, BrowserWindow, dialog, Menu, net, protocol, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { resolveLocalAsset } = require('./local-assets.cjs');

const productionUrl = 'chaos://game/index.html';
// A packaged executable always loads its own bundled game.
const devUrl = !app.isPackaged ? process.env.CHAOS_DEV_URL : undefined;

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
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  window.once('ready-to-show', () => window.show());
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
