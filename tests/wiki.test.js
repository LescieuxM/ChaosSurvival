import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localPages } from '../src/browser/registry.js';
import { BrowserSession } from '../src/browser/session.js';
import { Progression } from '../src/story/progression.js';
import { wikiData } from '../src/browser/sites/wiki/index.js';
import {
  WIKI_URL,
  articleUrl,
  findArticles,
  randomArticle,
} from '../src/browser/sites/wiki/model.js';
import { renderWikiArticles } from '../src/browser/sites/wiki/render.js';
const titles = [
  'Internet',
  'Windows XD',
  'Messagerie instantanée',
  'Adobe Flash',
  'Blog',
  'Jeu vidéo',
  'Pixel art',
  'Musique électronique',
  'Forum Internet',
  'Réseau social',
  'Chat domestique',
  'Tour Eiffel',
  'Système solaire',
  'Dinosaures',
  'Photographie numérique',
  'Primates',
];
const wordCount = (article) =>
  [article.intro, ...article.sections.flatMap((section) => section.paragraphs)]
    .join(' ')
    .split(/\s+/).length;
const context = (url = WIKI_URL, navigate = () => {}) => ({ url: new URL(url), navigate });
function dom(t) {
  const previous = globalThis.document;
  globalThis.document = {
    createElement(tag) {
      return {
        tag,
        children: [],
        dataset: {},
        handlers: {},
        append(...children) {
          this.children.push(...children);
        },
        addEventListener(name, fn) {
          this.handlers[name] = fn;
        },
        setAttribute(name, value) {
          this[name] = value;
        },
        scrollIntoView() {
          this.scrolled = true;
        },
        set innerHTML(_) {
          throw new Error('Unsafe HTML');
        },
      };
    },
  };
  t.after(() => {
    globalThis.document = previous;
  });
}
const walk = (n) => [n, ...n.children.flatMap(walk)];
const find = (root, cls) => walk(root).find((n) => n.className === cls);

test('all sixteen requested subjects are developed, internally linked and available/indexed from the start', () => {
  assert.deepEqual(
    wikiData.articles.map((a) => a.title),
    titles,
  );
  assert.equal(new Set(wikiData.articles.map((a) => a.id)).size, 16);
  assert.equal(localPages.resolve('www.wiki.fr', {}).page.url, WIKI_URL);
  assert.ok(localPages.sites({}).some((p) => p.url === WIKI_URL));
  for (const article of wikiData.articles) {
    assert.match(article.id, /^[a-z0-9-]+$/);
    assert.ok(
      wordCount(article) >= 250 && wordCount(article) <= 450,
      `${article.title}: ${wordCount(article)}`,
    );
    assert.ok(article.sections.length >= 3);
    assert.equal(new Set(article.sections.map((s) => s.id)).size, article.sections.length);
    for (const id of article.related) assert.ok(wikiData.articles.some((a) => a.id === id));
    assert.ok(localPages.resolve(articleUrl(article), {}).page);
    assert.ok(localPages.search(article.title, {}).some((p) => p.url === articleUrl(article)));
  }
  for (const fact of wikiData.facts)
    assert.ok(wikiData.articles.some((a) => a.id === fact.article));
  assert.ok(wikiData.articles.some((a) => a.id === wikiData.featured));
  assert.equal(localPages.resolve('wiki.fr/article/inexistant', {}).error, 'not-found');
  const text = JSON.stringify(wikiData);
  assert.doesNotMatch(
    text,
    /ARCHIVE|Raph|Wikipédia|Windows XP|MSN Messenger|Skyblog|YouTube|Google|202[0-9]|201[0-9]/,
  );
  assert.match(wikiData.articles.find((a) => a.id === 'systeme-solaire').intro, /Soleil/);
  assert.match(wikiData.articles.find((a) => a.id === 'primates').intro, /humain appartient/);
});

test('title search ignores case and accents; random selection uses only existing articles', () => {
  assert.equal(
    findArticles(wikiData.articles, ' MUSIQUE ELECTRONIQUE ')[0].id,
    'musique-electronique',
  );
  assert.equal(findArticles(wikiData.articles, 'messagerie')[0].id, 'messagerie-instantanee');
  assert.equal(findArticles(wikiData.articles, 'huit planètes').length, 0); // Titles only, not article text.
  assert.equal(findArticles(wikiData.articles, 'xxxxxxxx').length, 0);
  for (let i = 0; i <= 100; i++)
    assert.ok(wikiData.articles.includes(randomArticle(wikiData.articles, () => i / 100)));
  assert.equal(
    randomArticle([], () => 0),
    null,
  );
});

test('all rendered pages have valid internal links, articles contain working local TOCs and no external/HTML sinks', (t) => {
  dom(t);
  const pages = [
    WIKI_URL,
    `${WIKI_URL}articles`,
    `${WIKI_URL}recherche`,
    ...wikiData.articles.map(articleUrl),
  ];
  for (const url of pages) {
    let navigations = 0;
    const root = localPages.resolve(url, {}).page.render(
      context(url, () => {
        navigations++;
      }),
    );
    for (const n of walk(root)) {
      assert.ok(!['script', 'iframe', 'webview', 'object'].includes(n.tag));
      if (n.dataset.browserLink) {
        assert.ok(n.dataset.browserLink.startsWith(WIKI_URL));
        assert.ok(localPages.resolve(n.dataset.browserLink, {}).page);
        assert.equal(n.href, '#');
      }
    }
    const toc = find(root, 'wiki-toc');
    if (toc) {
      const buttons = walk(toc).filter((n) => n.tag === 'a');
      const sections = walk(root).filter((n) => n.className === 'wiki-article-section');
      assert.equal(buttons.length, sections.length);
      for (let i = 0; i < buttons.length; i++) {
        let prevented = false;
        buttons[i].handlers.click({
          preventDefault() {
            prevented = true;
          },
        });
        assert.ok(prevented && sections[i].scrolled);
      }
      assert.equal(navigations, 0);
    }
  }
});

test('search submits an encoded internal route and hostile queries remain literal with empty results', (t) => {
  dom(t);
  const attacks = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///C:/Windows/',
    '../../../../',
  ];
  for (const query of attacks) {
    const url = `${WIKI_URL}recherche?q=${encodeURIComponent(query)}`;
    let target;
    const root = localPages.resolve(url, {}).page.render(
      context(url, (value) => {
        target = value;
      }),
    );
    assert.ok(find(root, 'wiki-empty'));
    assert.equal(find(root, 'wiki-search-query').textContent, `Résultats pour « ${query} » :`);
    const form = find(root, 'wiki-search');
    assert.equal(form.children[0].value, query);
    form.handlers.submit({ preventDefault() {} });
    assert.equal(target, url);
    assert.ok(localPages.resolve(target, {}).page);
  }
});

test('random button navigates immediately; catalogue rendering and selection include future data additions', (t) => {
  dom(t);
  let target;
  const home = localPages.resolve(WIKI_URL, {}).page.render(
    context(WIKI_URL, (value) => {
      target = value;
    }),
  );
  find(home, 'wiki-random').handlers.click();
  assert.ok(localPages.resolve(target, {}).page);
  const extra = {
    ...wikiData.articles[0],
    id: 'futur',
    title: 'Article futur',
    theme: 'Autre thème',
  };
  const data = { ...wikiData, articles: [...wikiData.articles, extra] };
  const catalogue = renderWikiArticles(context(), data);
  assert.ok(walk(catalogue).some((n) => n.dataset.browserLink === articleUrl(extra)));
  assert.equal(
    randomArticle(data.articles, () => 0.999),
    extra,
  );
  assert.deepEqual(findArticles(data.articles, 'article futur'), [extra]);
});

test('Wiki navigation uses existing previous/next, survives restart and never changes narrative data', () => {
  const values = new Map(),
    storage = {
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => values.set(k, v),
      removeItem: (k) => values.delete(k),
    };
  const story = JSON.parse(readFileSync(new URL('../src/config/story.json', import.meta.url)));
  const p = new Progression(story, storage),
    session = new BrowserSession(p);
  p.save(); // Initialize the existing chapter metadata before comparing navigation.
  const before = JSON.stringify(p.data);
  session.add(WIKI_URL);
  session.navigate(articleUrl(wikiData.articles[0]));
  session.navigate(articleUrl(wikiData.articles[15]));
  session.move(-1);
  assert.equal(session.address, articleUrl(wikiData.articles[0]));
  session.move(1);
  assert.equal(session.address, articleUrl(wikiData.articles[15]));
  const restored = new BrowserSession(new Progression(story, storage));
  assert.equal(restored.address, session.address);
  const after = { ...p.data };
  delete after.browser;
  assert.equal(JSON.stringify(after), before);
});
