import { foldText } from '../../text.js';
export const WIKI_URL = 'http://www.wiki.fr/';
export const articleUrl = (article) => `${WIKI_URL}article/${article.id}`;
const fold = (text) => foldText(text).trim();
export function findArticles(articles, query) {
  const value = fold(query);
  return articles.filter((article) => fold(article.title).includes(value));
}
export function randomArticle(articles, random = Math.random) {
  if (!articles.length) return null;
  return articles[
    Math.min(articles.length - 1, Math.max(0, Math.floor(random() * articles.length)))
  ];
}
