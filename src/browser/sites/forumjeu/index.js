import data from './data.json' with { type: 'json' };
import { FORUM_URL,categoryUrl,topicUrl } from './model.js';
import { renderForumHome,renderCategory,renderTopic } from './render.js';
export const forumData=data;
export const forumPages=[
  {url:FORUM_URL,title:data.name,description:data.description,keywords:['forumjeu','forum','jeux vidéo','2009'],render:context=>renderForumHome(context,data)},
  ...data.categories.flatMap(category=>[
    {url:categoryUrl(category),title:`${category.name} — ${data.name}`,description:category.description,keywords:['forumjeu','forum',category.name],render:context=>renderCategory(context,data,category)},
    ...category.topics.map(topic=>({url:topicUrl(category,topic),title:`${topic.title} — ${data.name}`,description:`Discussion du forum ${category.name}. ${topic.posts.length-1} réponse(s).`,keywords:['forumjeu',category.name,...new Set(topic.posts.map(post=>post.author))],render:context=>renderTopic(context,data,category,topic)}))
  ])
];
