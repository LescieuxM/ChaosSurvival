import test from 'node:test';
import assert from 'node:assert/strict';
import { localPages } from '../src/browser/registry.js';
import { forumData, forumPages } from '../src/browser/sites/forumjeu/index.js';
import { FORUM_URL, topicUrl } from '../src/browser/sites/forumjeu/model.js';

test('M0RBID threads are accessible in existing ForumJeu categories and indexed by author', () => {
  assert.equal(forumData.categories.length, 4);
  const expected = [
    ['jeux-pc', 'jeux-flash-horreur'],
    ['blabla-15-18', 'histoires-web-minuit'],
  ];
  for (const [categoryId, topicId] of expected) {
    const category = forumData.categories.find((entry) => entry.id === categoryId);
    const topic = category.topics.find((entry) => entry.id === topicId);
    assert.ok(topic);
    assert.ok(topic.posts.length >= 5);
    assert.ok(topic.posts.some((post) => post.author === 'x_M0RBID_x'));
    assert.ok(forumPages.some((page) => page.url === topicUrl(category, topic)));
    assert.ok(localPages.resolve(topicUrl(category, topic), {}).page);
  }
  for (const id of ['gratuit', 'virus-xp']) {
    const topic = forumData.categories.flatMap((category) => category.topics).find((entry) => entry.id === id);
    assert.ok(topic.posts.some((post) => post.author === 'x_M0RBID_x'));
  }
  assert.ok(forumPages.some((page) => page.url === FORUM_URL));
  assert.doesNotMatch(JSON.stringify(forumData), /ARCHIVE|screamer|gore/i);
});
