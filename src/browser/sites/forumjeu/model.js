export const FORUM_URL = 'http://www.forumjeu.fr/';
export const POSTS_PER_PAGE = 8;
export const categoryUrl = category => `${FORUM_URL}forums/${category.id}`;
export const topicUrl = (category, topic) => `${categoryUrl(category)}/sujets/${topic.id}`;
export const lastPost = topic => `${topic.date}T${topic.posts.at(-1).time}`;
export const activeTopics = category => [...category.topics].sort((a,b) => lastPost(b).localeCompare(lastPost(a)));
export const messageCount = category => category.topics.reduce((sum, topic) => sum + topic.posts.length, 0);
export function topicPage(topic, url) {
  const value = url.searchParams.get('page') ?? '1';
  const pages = Math.ceil(topic.posts.length / POSTS_PER_PAGE);
  if (!/^[1-9]\d*$/.test(value) || Number(value) > pages) return null;
  const page = Number(value);
  return { page, pages, offset: (page - 1) * POSTS_PER_PAGE, posts: topic.posts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE) };
}
export function displayDate(date, time) {
  const [year,month,day] = date.split('-');
  return `${day}/${month}/${year}${time ? ` à ${time}` : ''}`;
}
