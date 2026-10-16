import data from './data.json' with { type: 'json' };
import secondaryBlogs from './secondary-blogs.json' with { type: 'json' };
import forumBlogs from './forum-blogs.json' with { type: 'json' };
import contacts from '../../../config/contacts.json' with { type: 'json' };
import { renderSkyHome, renderSkyBlog } from './render.js';
import { SKY_URL, blogUrl, commentProfileUrl } from './urls.js';
export { SKY_URL, blogUrl, articleUrl, commentProfileUrl } from './urls.js';
export const skyPageData = { ...data, blogs: [...data.blogs, ...secondaryBlogs, ...forumBlogs] };
const contactIds = new Set(contacts.filter((contact) => contact.id !== 'turbo').map((c) => c.id));
const publishedAuthors = new Set(
  skyPageData.blogs
    .filter((blog) => blog.contactId && contactIds.has(blog.contactId))
    .map((blog) => blog.nickname),
);
const commentAuthors = new Set(
  skyPageData.blogs.flatMap((blog) =>
    blog.articles.flatMap((article) => article.comments.map((comment) => comment.author)),
  ),
);
export const skyProfileErrors = [...commentAuthors]
  .filter((author) => !publishedAuthors.has(author))
  .map((author) => ({
    url: commentProfileUrl(author),
    title: 'Internet Adventurer',
    error: 'skypage-timeout',
    indexable: false,
    render: () => null,
  }));
export const skyPages = [
  {
    url: SKY_URL,
    siteName: data.title,
    title: 'SkyPage — Blogs et amis',
    description: 'Des blogs personnels, des photos et des dessins sur le Web de 2009.',
    keywords: ['skypage', 'blog', 'blogs', '2009'],
    render: (context) => renderSkyHome(context, skyPageData),
  },
  ...skyPageData.blogs.map((blog) => ({
    url: blogUrl(blog),
    rememberVisit: true,
    title: `${blog.nickname} — SkyPage`,
    description: blog.description,
    keywords: [...blog.keywords, ...blog.articles.map((article) => article.title)],
    render: (context) => renderSkyBlog(context, skyPageData, blog),
  })),
];
