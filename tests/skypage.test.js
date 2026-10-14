import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { localPages } from '../src/browser/registry.js';
import {
  skyPageData,
  skyPages,
  SKY_URL,
  blogUrl,
  articleUrl,
} from '../src/browser/sites/skypage/index.js';
import { BrowserSession } from '../src/browser/session.js';
import { Progression } from '../src/story/progression.js';
import { InternetAdventurer } from '../src/ui/browser.js';
import { renderSkyHome } from '../src/browser/sites/skypage/render.js';
const story = JSON.parse(readFileSync(new URL('../src/config/story.json', import.meta.url)));
const articleCounts = { pixelgirl: 6, luna: 5, sk8er_du_93: 4, 'oo_bubble-princess_oo': 6 };
const walk = (node) => [node, ...(node.children ?? []).flatMap(walk)];
function dom(t) {
  const previous = globalThis.document;
  globalThis.document = {
    createElement(tag) {
      return {
        tag,
        className: '',
        children: [],
        dataset: {},
        setAttribute() {},
        append(...nodes) {
          this.children.push(...nodes);
        },
      };
    },
  };
  t.after(() => {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  });
}
test('SkyPage exposes home and four available blog routes without narrative prerequisites', () => {
  assert.equal(skyPages.length, 5);
  for (const url of [
    'skypage.fr',
    'www.skypage.fr',
    'http://www.skypage.fr/pixelgirl',
    'skypage.fr/luna',
    'skypage.fr/sk8er_du_93',
    'skypage.fr/oo_bubble-princess_oo',
  ])
    assert.ok(localPages.resolve(url, {}).page);
  assert.equal(localPages.resolve('skypage.fr/turbo', {}).error, 'not-found');
  assert.equal(localPages.resolve('skypage.fr/missing', {}).error, 'not-found');
  assert.deepEqual(
    skyPageData.blogs.map((blog) => blog.nickname),
    ['xX_PixelGirl_Xx', '°•.LuNa.°•', 'Sk8er_du_93', 'Oo_bubble-princess_oO'],
  );
});
test('twenty-one articles follow the requested distribution, with valid dates and MSN comment authors', () => {
  const contacts = JSON.parse(
    readFileSync(new URL('../src/config/contacts.json', import.meta.url)),
  );
  const allowedAuthors = new Set(
    contacts
      .filter((contact) => contact.id !== 'turbo')
      .map(
        (contact) =>
          contact.nickname ??
          JSON.parse(
            readFileSync(new URL(`../src/dialogues/${contact.dialogue}.json`, import.meta.url)),
          ).contact.nickname,
      ),
  );
  const images = new Set([
    './skypage/sparkle.svg',
    './skypage/heart.svg',
    './skypage/candy-sparkle.svg',
  ]);
  for (const blog of skyPageData.blogs) {
    assert.equal(blog.articles.length, articleCounts[blog.id]);
    const dates = blog.articles.map((article) => article.date);
    assert.deepEqual(dates, [...dates].sort());
    assert.equal(new Set(blog.articles.map((article) => article.id)).size, blog.articles.length);
    images.add(blog.avatar);
    for (const article of blog.articles) {
      assert.match(article.date, /^2009-\d{2}-\d{2}$/);
      assert.equal(new Date(article.date).toISOString().slice(0, 10), article.date);
      assert.ok(article.paragraphs.length > 0);
      if (article.image) images.add(article.image);
      for (const comment of article.comments) {
        assert.ok(comment.date >= article.date);
        assert.match(comment.date, /^2009-/);
        assert.ok(comment.author && comment.text);
        assert.ok(
          allowedAuthors.has(comment.author),
          `Comment author must be an exact MSN nickname: ${comment.author}`,
        );
        assert.doesNotMatch(comment.author, /turbo/i, 'TURBO never posts on SkyPage');
      }
    }
  }
  for (const path of images) {
    const file = new URL(`../public/${path.slice(2)}`, import.meta.url);
    assert.ok(existsSync(file));
    if (path.endsWith('.svg'))
      assert.doesNotMatch(readFileSync(file, 'utf8'), /<script|href=|<foreignObject/i);
    else assert.equal(readFileSync(file).subarray(0, 2).toString('hex'), 'ffd8');
  }
  assert.doesNotMatch(JSON.stringify(skyPageData), /ARCHIVE|Buddy|effacement|joueur/i);
  const pixel = skyPageData.blogs[0],
    luna = skyPageData.blogs[1];
  assert.ok(
    pixel.articles
      .flatMap((article) => article.paragraphs)
      .join(' ')
      .includes('Bring Me to Life'),
  );
  assert.ok(
    luna.articles.reduce((sum, article) => sum + article.comments.length, 0) <
      pixel.articles.reduce((sum, article) => sum + article.comments.length, 0),
  );
});
test('XD Search indexes implemented blogs with relevant results and no fabricated Turbo blog', () => {
  for (const term of ['skypage', 'blog', 'pixelgirl', 'luna', 'dessins', 'evanescence'])
    assert.ok(localPages.search(term, {}).length > 0, term);
  assert.equal(localPages.search('PIXELGIRL', {})[0].url, `${SKY_URL}pixelgirl`);
  assert.equal(localPages.search('LUNA', {})[0].url, `${SKY_URL}luna`);
  assert.equal(localPages.search('evanescence', {})[0].url, `${SKY_URL}pixelgirl`);
  assert.equal(
    localPages
      .search('dessins', {})
      .filter((page) => page.url === `${SKY_URL}pixelgirl` || page.url === `${SKY_URL}luna`).length,
    2,
  );
  assert.ok(!localPages.search('turbo', {}).some((page) => page.url === `${SKY_URL}turbo`));
});
test('rendered pages have only valid internal links and show articles, local graphics and comments without editing controls', (t) => {
  dom(t);
  for (const definition of skyPages) {
    const result = localPages.resolve(definition.url, {});
    const rendered = definition.render({
      url: result.url,
      data: {},
      registry: localPages,
      navigate() {},
    });
    const nodes = walk(rendered);
    const nav = nodes.find((node) => node.className === 'sky-nav');
    assert.equal(nav.children.length, 1);
    assert.equal(nav.children[0].textContent, 'Accueil');
    assert.equal(nav.children[0].dataset.browserLink, SKY_URL);
    assert.equal(
      nodes.filter((node) =>
        ['input', 'textarea', 'form', 'button', 'iframe', 'script'].includes(node.tag),
      ).length,
      0,
    );
    for (const link of nodes.filter((node) => node.tag === 'a')) {
      assert.equal(link.href, '#');
      assert.ok(localPages.resolve(link.dataset.browserLink, {}).page);
    }
    if (definition.url !== SKY_URL) {
      const blog = skyPageData.blogs.find((blog) => blogUrl(blog) === definition.url);
      assert.equal(
        nodes.filter((node) => node.className === 'sky-post').length,
        articleCounts[blog.id],
      );
      assert.ok(nodes.some((node) => node.className === 'sky-comments'));
    }
  }
  const blog = skyPageData.blogs[0],
    article = blog.articles.find((article) => article.id === 'paint');
  const route = localPages.resolve(articleUrl(blog, article), {});
  const nodes = walk(route.page.render({ url: route.url }));
  assert.equal(nodes.filter((node) => node.className === 'sky-post').length, 1);
  assert.ok(nodes.some((node) => node.src === article.image));
  assert.equal(
    nodes.filter((node) => node.className === 'sky-comment').length,
    article.comments.length,
  );
});

test('secondary blogs use exact identities, searchable themes and recent-visit/last-article integration', (t) => {
  dom(t);
  for (const [id, name, terms] of [
    ['sk8er_du_93', 'Sk8er_du_93', ['sk8er_du_93', 'skate', 'skateboard', 'kickflip', 'baskets']],
    [
      'oo_bubble-princess_oo',
      'Oo_bubble-princess_oO',
      ['oo_bubble-princess_oo', 'bonbons', 'princesse', 'mode', 'coque téléphone'],
    ],
  ]) {
    const address = `${SKY_URL}${id}`;
    const blog = skyPageData.blogs.find((blog) => blog.id === id);
    assert.equal(blog.nickname, name);
    assert.equal(localPages.resolve(address, {}).page.title, `${name} — SkyPage`);
    for (const term of terms)
      assert.ok(
        localPages.search(term, {}).some((page) => page.url === address),
        term,
      );
    for (const post of blog.articles) {
      if (post.image) assert.ok(post.image.endsWith('.jpg'));
      assert.doesNotMatch(JSON.stringify(post), /Sk8erboy|BubblePrincess|ARCHIVE|Buddy|TURBO/i);
    }
  }
  const home = localPages.resolve(SKY_URL, {}).page;
  const initial = walk(home.render({ data: {} }));
  assert.equal(initial.filter((n) => n.className === 'sky-discovery').length, 0);
  const latest = initial.filter((n) => n.className === 'sky-latest');
  assert.equal(latest.length, 4);
  for (const id of ['sk8er_du_93', 'oo_bubble-princess_oo'])
    assert.ok(
      latest.some((n) => n.children[0].dataset.browserLink.startsWith(`${SKY_URL}${id}?article=`)),
    );
  const visited = [blogUrl(skyPageData.blogs[3]), blogUrl(skyPageData.blogs[2])];
  const rendered = walk(home.render({ data: { browser: { recentPages: visited } } }));
  assert.deepEqual(
    rendered
      .filter((n) => n.className === 'sky-discovery')
      .map((n) => walk(n).find((n) => n.tag === 'a').dataset.browserLink),
    visited,
  );
});
test('normal browser history, tabs, restart and New Game keep static blogs available without narrative changes', () => {
  const values = new Map(),
    storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
  const progression = new Progression(story, storage);
  const before = JSON.stringify([
    progression.data.dialogues,
    progression.data.choices,
    progression.data.completed,
  ]);
  const browser = new BrowserSession(progression);
  browser.navigate(SKY_URL);
  browser.navigate(blogUrl(skyPageData.blogs[0]));
  browser.move(-1);
  assert.equal(browser.address, SKY_URL);
  browser.move(1);
  browser.add(blogUrl(skyPageData.blogs[1]));
  const restored = new BrowserSession(new Progression(story, storage));
  assert.deepEqual(restored.tabs, browser.tabs);
  assert.ok(localPages.resolve(restored.address, {}).page);
  assert.equal(
    JSON.stringify([
      progression.data.dialogues,
      progression.data.choices,
      progression.data.completed,
    ]),
    before,
  );
  progression.newGame();
  browser.restore();
  for (const page of skyPages) assert.ok(localPages.resolve(page.url, progression.data).page);
});

test('friends directory includes all actual blogs and future data additions without changing visits or navigation', (t) => {
  dom(t);
  const render = (data) => walk(renderSkyHome({ data: {} }, data));
  const nodes = render(skyPageData);
  const friends = nodes.find((node) => node.className === 'sky-box sky-friends');
  assert.equal(friends.children[0].textContent, 'Vos ami(e)s');
  const links = walk(friends).filter((node) => node.tag === 'a');
  assert.deepEqual(
    links.map((link) => link.textContent),
    skyPageData.blogs.map((blog) => blog.nickname),
  );
  assert.deepEqual(
    links.map((link) => link.dataset.browserLink),
    skyPageData.blogs.map(blogUrl),
  );
  assert.ok(
    links.every(
      (link) => link.href === '#' && localPages.resolve(link.dataset.browserLink, {}).page,
    ),
  );
  assert.ok(links.every((link) => !/turbo/i.test(link.textContent)));
  assert.equal(nodes.filter((node) => node.className === 'sky-discovery').length, 0);
  assert.equal(nodes.filter((node) => node.className === 'sky-latest').length, 4);
  assert.equal(nodes.find((node) => node.className === 'sky-nav').children.length, 1);
  const future = { ...skyPageData.blogs[0], id: 'future-blog', nickname: 'Future contact' };
  const expanded = render({ ...skyPageData, blogs: [...skyPageData.blogs, future] });
  const added = expanded.find((node) => node.className === 'sky-box sky-friends');
  assert.equal(walk(added).filter((node) => node.tag === 'a').length, 5);
  assert.ok(walk(added).some((node) => node.dataset?.browserLink === blogUrl(future)));
});

test('recent blogs are unique, newest first, persistent and reset by New Game without changing latest articles', (t) => {
  dom(t);
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const progression = new Progression(story, storage);
  const session = new BrowserSession(progression);
  const home = () => localPages.resolve(SKY_URL, {}).page.render({ data: progression.data });
  const rows = (tree) => walk(tree).filter((n) => n.className === 'sky-discovery');
  const latest = (tree) => walk(tree).filter((n) => n.className === 'sky-latest');
  const empty = home();
  assert.equal(rows(empty).length, 0);
  assert.ok(walk(empty).some((n) => n.textContent === 'Aucun blog visité récemment.'));
  const pixel = blogUrl(skyPageData.blogs[0]),
    luna = blogUrl(skyPageData.blogs[1]);
  session.recordVisit(pixel);
  assert.equal(rows(home()).length, 1);
  session.recordVisit(luna);
  session.recordVisit(pixel);
  session.recordVisit(pixel);
  assert.deepEqual(session.recentPages, [pixel, luna]);
  const populated = home();
  assert.deepEqual(
    rows(populated).map((row) => walk(row).find((n) => n.tag === 'a').dataset.browserLink),
    [pixel, luna],
  );
  assert.equal(JSON.stringify(latest(populated)), JSON.stringify(latest(empty)));
  const reopened = new BrowserSession(new Progression(story, storage));
  assert.deepEqual(reopened.recentPages, [pixel, luna]);
  reopened.close(reopened.active);
  assert.deepEqual(new BrowserSession(new Progression(story, storage)).recentPages, [pixel, luna]);
  progression.newGame();
  session.restore();
  assert.deepEqual(session.recentPages, []);
  assert.equal(rows(home()).length, 0);
  progression.data.browser = { recentPages: [null, 'javascript:alert(1)', pixel, pixel] };
  session.restore();
  assert.deepEqual(session.recentPages, [pixel]);
});

test('only successfully displayed blogs enter recents, including article visits; cancelled loads do not', async (t) => {
  dom(t);
  const progression = new Progression(story, { getItem: () => null, setItem() {} });
  const browser = new InternetAdventurer({}, {}, progression);
  browser.tabs = () => {};
  const controls = new Map();
  browser.instance = {
    element: {
      isConnected: true,
      querySelector(selector) {
        if (!controls.has(selector))
          controls.set(selector, { setAttribute() {}, replaceChildren() {} });
        return controls.get(selector);
      },
    },
  };
  t.after(() => clearTimeout(browser.timer));
  const waitForLoad = () => new Promise((resolve) => setTimeout(resolve, 250));
  browser.navigate(blogUrl(skyPageData.blogs[0]));
  browser.navigate(SKY_URL);
  await waitForLoad();
  assert.deepEqual(browser.session.recentPages, []);
  browser.navigate('skypage.fr/missing');
  await waitForLoad();
  assert.deepEqual(browser.session.recentPages, []);
  browser.navigate(blogUrl(skyPageData.blogs[1]));
  await waitForLoad();
  browser.navigate(articleUrl(skyPageData.blogs[0], skyPageData.blogs[0].articles[1]));
  await waitForLoad();
  assert.deepEqual(browser.session.recentPages, skyPageData.blogs.slice(0, 2).map(blogUrl));
  assert.deepEqual(progression.data.browser.recentPages, browser.session.recentPages);
});
