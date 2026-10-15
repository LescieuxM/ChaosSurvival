import data from './data.json' with { type: 'json' };
import secondaryBlogs from './secondary-blogs.json' with { type: 'json' };
import forumBlogs from './forum-blogs.json' with { type: 'json' };
import { renderSkyHome, renderSkyBlog } from './render.js';
import { SKY_URL, blogUrl } from './urls.js';
export { SKY_URL, blogUrl, articleUrl } from './urls.js';
export const skyPageData = { ...data, blogs: [...data.blogs, ...secondaryBlogs, ...forumBlogs] };
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
