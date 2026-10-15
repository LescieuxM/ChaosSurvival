export const SKY_URL = 'http://www.skypage.fr/';
export const blogUrl = (blog) => `${SKY_URL}${blog.id}`;
// A deterministic local route for a commenter without a published SkyPage.
export const commentProfileUrl = (nickname) =>
  `${SKY_URL}profil/${encodeURIComponent(nickname)}`;
export const articleUrl = (blog, article) =>
  `${blogUrl(blog)}?article=${encodeURIComponent(article.id)}`;
