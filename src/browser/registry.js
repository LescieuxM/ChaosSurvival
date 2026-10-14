import { renderSearch } from './pages/xd-search.js';
import { foldText as fold } from './text.js';
import { sitePages } from './sites/index.js';

export const HOME_URL = 'http://www.xdsearch.fr/';
export function normalizeUrl(input) {
  if (typeof input !== 'string' || input.length > 2048) return null;
  const value = input.trim();
  if (!value || /[\u0000-\u001f]/.test(value)) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `http://${value}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port)
      return null;
    url.protocol = 'http:';
    url.hostname = `www.${url.hostname.toLowerCase().replace(/^www\./, '')}`;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}
export class PageRegistry {
  constructor() {
    this.pages = new Map();
  }
  register(page) {
    const address = normalizeUrl(page.url);
    if (
      !address ||
      typeof page.render !== 'function' ||
      typeof page.title !== 'string' ||
      !page.title ||
      (page.siteName !== undefined && typeof page.siteName !== 'string') ||
      (page.description !== undefined && typeof page.description !== 'string') ||
      (page.keywords !== undefined &&
        (!Array.isArray(page.keywords) ||
          !page.keywords.every((word) => typeof word === 'string'))) ||
      (page.available !== undefined && typeof page.available !== 'function')
    )
      throw new Error('Page locale invalide.');
    this.pages.set(address, { ...page, url: address });
    return () => this.pages.delete(address);
  }
  accessible(page, data) {
    return !page.available || page.available(data);
  }
  sites(data) {
    return [...this.pages.values()].filter((page) => {
      const url = new URL(page.url);
      return url.pathname === '/' && !url.search && !page.error && this.accessible(page, data);
    });
  }
  resolve(input, data) {
    const address = normalizeUrl(input);
    if (!address) return { error: 'connection' };
    const url = new URL(address);
    const key = new URL(address);
    key.search = '';
    const page = this.pages.get(key.href);
    if (page && this.accessible(page, data))
      return page.error ? { error: page.error } : { page, url };
    return {
      error: [...this.pages.values()].some((page) => new URL(page.url).hostname === url.hostname)
        ? 'not-found'
        : 'connection',
    };
  }
  search(query, data) {
    const terms = [...new Set(fold(query).match(/[\p{L}\p{N}]+/gu) ?? [])];
    if (!terms.length) return [];
    return [...this.pages.values()]
      .filter((page) => page.indexable !== false && !page.error && this.accessible(page, data))
      .map((page) => ({
        page,
        score: terms.reduce(
          (score, term) =>
            score +
            (fold(
              `${page.title} ${page.description ?? ''} ${(page.keywords ?? []).join(' ')}`,
            ).includes(term)
              ? 1
              : 0),
          0,
        ),
      }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((result) => result.page);
  }
}
export const localPages = new PageRegistry();
localPages.register({
  url: HOME_URL,
  title: 'XD Search',
  description: 'Le moteur de recherche de votre Internet Windows XD.',
  keywords: ['recherche', 'internet', 'moteur', '2009'],
  render: renderSearch,
});
for (const page of sitePages) localPages.register(page);
