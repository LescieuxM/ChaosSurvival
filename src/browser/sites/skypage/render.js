import { SKY_URL as HOME, blogUrl, articleUrl } from './urls.js';
import contacts from '../../../config/contacts.json' with { type: 'json' };
const contactIds = new Set(
  contacts.filter((contact) => contact.id !== 'turbo').map((contact) => contact.id),
);
function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function link(text, url, className = '') {
  const element = node('a', className, text);
  element.href = '#';
  element.dataset.browserLink = url;
  return element;
}
function image(path, alt, className = '') {
  if (!/^\.\/(?:avatars|skypage)\/[a-z0-9-]+\.(?:svg|gif|png|jpg)$/.test(path))
    throw new Error('Image SkyPage locale invalide.');
  const element = node('img', className);
  element.src = path;
  element.alt = alt;
  return element;
}
function date(value) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}
function shell(data, theme = 'home') {
  const root = node('section', `skypage sky-${theme}`);
  const header = node('header', 'sky-header');
  header.append(
    link('SkyPage', HOME, 'sky-logo'),
    node('span', 'sky-slogan', 'Les blogs ont la parole !'),
  );
  const nav = node('nav', 'sky-nav');
  nav.setAttribute('aria-label', 'Navigation SkyPage');
  nav.append(link('Accueil', HOME));
  root.append(header, nav);
  return root;
}
export function renderSkyHome(context, data) {
  const root = shell(data);
  const welcome = node('section', 'sky-box sky-welcome');
  welcome.append(node('h2', '', data.welcome), node('p', '', data.description));
  root.append(welcome);
  const contactBlogs = data.blogs.filter((blog) => contactIds.has(blog.contactId));
  const friends = node('section', 'sky-box sky-friends');
  friends.append(node('h2', '', 'Vos ami(e)s'));
  const friendList = node('ul');
  for (const blog of contactBlogs) {
    const item = node('li');
    item.append(link(blog.nickname, blogUrl(blog)));
    friendList.append(item);
  }
  friends.append(friendList);
  root.append(friends);
  const columns = node('div', 'sky-home-columns'),
    discover = node('section', 'sky-box');
  discover.append(node('h2', '', 'Blogs visités récemment'));
  const visits = context.data?.browser?.recentPages;
  const blogs = Array.isArray(visits)
    ? [...new Set(visits)]
        .map((url) => data.blogs.find((blog) => blogUrl(blog) === url))
        .filter(Boolean)
    : [];
  if (!blogs.length) discover.append(node('p', '', 'Aucun blog visité récemment.'));
  for (const blog of blogs) {
    const row = node('div', 'sky-discovery');
    row.append(image(blog.avatar, `Avatar de ${blog.nickname}`, 'sky-avatar'));
    const copy = node('div');
    copy.append(link(blog.nickname, blogUrl(blog)), node('p', '', blog.subtitle));
    row.append(copy);
    discover.append(row);
  }
  const latest = node('section', 'sky-box');
  latest.append(node('h2', '', 'Derniers articles'));
  const articles = contactBlogs
    .flatMap((blog) => blog.articles.map((article) => ({ blog, article })))
    .sort((a, b) => b.article.date.localeCompare(a.article.date))
    .slice(0, 4);
  for (const { blog, article } of articles) {
    const row = node('div', 'sky-latest');
    row.append(
      link(article.title, articleUrl(blog, article)),
      node('small', '', `${date(article.date)} · ${blog.nickname}`),
    );
    latest.append(row);
  }
  columns.append(discover, latest);
  root.append(
    columns,
    node(
      'footer',
      'sky-footer',
      `${data.blogs.length} blogs · ${data.blogs.reduce((count, blog) => count + blog.articles.length, 0)} articles · SkyPage 2009`,
    ),
  );
  return root;
}
export function renderSkyBlog({ url }, data, blog) {
  const root = shell(data, blog.theme),
    title = node('div', 'sky-blog-title');
  title.append(node('h2', '', blog.nickname), node('p', '', blog.subtitle));
  if (blog.theme === 'pixelgirl')
    title.append(
      image('./skypage/sparkle.svg', 'Étoiles scintillantes', 'sky-decoration'),
      image('./skypage/heart.svg', 'Petit cœur animé', 'sky-decoration'),
    );
  if (blog.theme === 'princess')
    title.append(image('./skypage/candy-sparkle.svg', 'Bonbon scintillant', 'sky-decoration'));
  root.append(title);
  const layout = node('div', 'sky-blog-layout'),
    sidebar = node('aside', 'sky-sidebar');
  sidebar.append(
    image(blog.avatar, `Avatar de ${blog.nickname}`, 'sky-avatar'),
    node('h3', '', blog.nickname),
    node('p', '', blog.subtitle),
    link('Tous les articles', blogUrl(blog)),
    link('Accueil SkyPage', HOME),
  );
  const archive = node('div', 'sky-archive');
  archive.append(node('h3', '', 'Janvier 2009'));
  for (const article of blog.articles)
    archive.append(link(article.title, articleUrl(blog, article)));
  sidebar.append(archive);
  const posts = node('div', 'sky-posts');
  const selected = blog.articles.find((article) => article.id === url.searchParams.get('article'));
  const articles = selected ? [selected] : [...blog.articles].reverse();
  for (const article of articles) {
    const post = node('article', 'sky-post');
    post.dataset.articleId = article.id;
    const header = node('header', 'sky-post-header');
    header.append(node('h3', '', article.title), node('time', '', date(article.date)));
    post.append(header);
    const body = node('div', 'sky-post-body');
    for (const paragraph of article.paragraphs) body.append(node('p', '', paragraph));
    if (article.image) body.append(image(article.image, article.imageAlt, 'sky-illustration'));
    post.append(body);
    const comments = node('section', 'sky-comments');
    comments.append(node('h4', '', `Commentaires (${article.comments.length})`));
    for (const comment of article.comments) {
      const row = node('div', 'sky-comment');
      row.append(
        node('strong', '', comment.author),
        node('small', '', date(comment.date)),
        node('p', '', comment.text),
      );
      comments.append(row);
    }
    if (!article.comments.length) comments.append(node('p', '', 'Pas encore de commentaire.'));
    post.append(comments);
    posts.append(post);
  }
  layout.append(sidebar, posts);
  root.append(layout, node('footer', 'sky-footer', 'SkyPage · 2009'));
  return root;
}
