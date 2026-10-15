const catalog = require('./videotube-catalog.json');
// Trusted, packaged data only. IPC accepts an ID, never a URL from a renderer.
const allowedVideos = Object.freeze(
  Object.fromEntries(catalog.videos.map((video) => [video.id, video.youtubeUrl])),
);
function videoUrl(id) {
  if (typeof id !== 'string' || !Object.hasOwn(allowedVideos, id)) return null;
  const url = allowedVideos[id];
  return typeof url === 'string' && /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/.test(url)
    ? url
    : null;
}
function createVideoOpener(policy, openExternal) {
  return async (event, id) => {
    if (!policy.trustedSender(event)) return { ok: false };
    const url = videoUrl(id);
    if (!url) return { ok: false };
    try {
      await openExternal(url);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  };
}
module.exports = { videoUrl, createVideoOpener };
