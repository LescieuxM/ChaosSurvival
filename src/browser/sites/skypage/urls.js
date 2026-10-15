export const SKY_URL = 'http://www.skypage.fr/';
export const blogUrl = (blog) => `${SKY_URL}${blog.id}`;
export const articleUrl = (blog, article) =>
  `${blogUrl(blog)}?article=${encodeURIComponent(article.id)}`;
