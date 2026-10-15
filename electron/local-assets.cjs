const path = require('node:path');

function resolveLocalAsset(root, requestUrl) {
  const url = new URL(requestUrl);
  if (url.protocol !== 'chaos:' || url.host !== 'game' || url.username || url.password) return null;

  const pathname = decodeURIComponent(url.pathname);
  // Windows treats backslashes and drive letters as path syntax too.
  if (/[\\\u0000-\u001f:]/.test(pathname)) return null;
  const filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  const relative = path.relative(root, filename);
  if (
    !relative ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    return null;
  return filename;
}

module.exports = { resolveLocalAsset };
