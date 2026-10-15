const PRODUCTION_URL = 'chaos://game/index.html';

function developmentUrl(value) {
  if (!value) return undefined;
  const url = new URL(value);
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('CHAOS_DEV_URL must point to the local Vite server.');
  return url.href;
}

function securityPolicy(devUrl) {
  const origin = devUrl && new URL(devUrl).origin;
  const socket = origin?.replace(/^http:/, 'ws:');
  const documentUrl = devUrl || PRODUCTION_URL;
  return {
    documentUrl,
    csp: [
      "default-src 'none'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self'",
      "media-src 'self'",
      "font-src 'self'",
      `connect-src 'self'${socket ? ` ${socket}` : ''}`,
      "object-src 'none'",
      "frame-src 'none'",
      "worker-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
    allowsRequest(value) {
      try {
        const url = new URL(value);
        if (url.username || url.password) return false;
        if (origin) return url.origin === origin || url.origin === socket;
        return url.protocol === 'chaos:' && url.host === 'game';
      } catch {
        return false;
      }
    },
    trustedSender(event) {
      return Boolean(
        event.senderFrame &&
        event.senderFrame === event.sender.mainFrame &&
        event.senderFrame.url === documentUrl,
      );
    },
  };
}

function protectSession(session, policy) {
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.setPermissionCheckHandler(() => false);
  session.on('will-download', (event) => event.preventDefault());
  session.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) =>
    callback({ cancel: !policy.allowsRequest(details.url) }),
  );
  session.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (details, callback) =>
    callback({
      responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [policy.csp] },
    }),
  );
}

function protectWindow(contents) {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  // The game is a single document. All fictitious navigation stays in its DOM.
  for (const name of [
    'will-navigate',
    'will-frame-navigate',
    'will-redirect',
    'will-attach-webview',
  ])
    contents.on(name, (event) => event.preventDefault());
}

module.exports = { PRODUCTION_URL, developmentUrl, securityPolicy, protectSession, protectWindow };
