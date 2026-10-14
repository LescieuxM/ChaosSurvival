import { skyPages } from './skypage/index.js';
import { forumPages } from './forumjeu/index.js';
import { flashPages } from './flashzone/index.js';
import { videoPages } from './videotube/index.js';
import { wikiPages } from './wiki/index.js';

// Preserve registration order: it also breaks ties in XD Search results.
export const sitePages = [skyPages, forumPages, flashPages, videoPages, wikiPages].flat();
