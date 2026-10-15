import catalog from '../../../../electron/videotube-catalog.json' with { type: 'json' };
import { renderVideoHome, renderVideo } from './render.js';
export const VIDEO_URL = 'http://www.videotube.fr/';
export const videoCatalog = catalog;
export const videoRoute = (video) => `${VIDEO_URL}watch/${video.id}`;
export const videoPages = [
  {
    url: VIDEO_URL,
    title: catalog.name,
    description: catalog.description,
    keywords: ['videotube', 'vidéos', 'internet', '2009'],
    render: () => renderVideoHome(catalog, VIDEO_URL, videoRoute),
  },
  ...catalog.videos.map((video) => ({
    url: videoRoute(video),
    title: `${video.title} — ${catalog.name}`,
    description: video.description,
    keywords: ['videotube', video.title, video.author ?? '', String(video.year)],
    render: (context) => renderVideo(context, video, VIDEO_URL),
  })),
];
