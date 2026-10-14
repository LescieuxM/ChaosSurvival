import { FORUM_URL, categoryUrl, topicUrl, activeTopics, messageCount, topicPage, displayDate } from './model.js';
import { renderError } from '../../pages/error.js';
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function link(text,url) {
  const element = node('a',text);
  element.href = '#';
  element.dataset.browserLink = url;
  return element;
}
function shell(data,category,topic) {
  const root = node('section', undefined, 'forumjeu');
  const header = node('header',undefined,'forum-header');
  header.append(link(data.name,FORUM_URL),node('span','Les forums des joueurs · 2009'));
  const breadcrumb = node('nav',undefined,'forum-breadcrumb');
  breadcrumb.setAttribute('aria-label','Navigation ForumJeu');
  breadcrumb.append(link('Accueil',FORUM_URL));
  if(category)breadcrumb.append(node('span',' › '),link(category.name,categoryUrl(category)));
  if(topic)breadcrumb.append(node('span',` › ${topic.title}`));
  root.append(header,breadcrumb);
  return root;
}
function table(headings,rows,className) {
  const element=node('table',undefined,className),head=node('thead'),tr=node('tr'),body=node('tbody');
  for(const text of headings){const cell=node('th',text);cell.setAttribute('scope','col');tr.append(cell);}
  head.append(tr);
  for(const cells of rows){const row=node('tr');for(const value of cells){const cell=node('td');cell.append(value);row.append(cell);}body.append(row);}
  element.append(head,body);return element;
}
export function renderForumHome(_context,data) {
  const root=shell(data);
  root.append(node('h2','Forums'),node('p',data.description));
  const rows=data.categories.map(category=>{
    const title=node('div');title.append(link(`▤ ${category.name}`,categoryUrl(category)),node('p',category.description));
    const latest=activeTopics(category)[0],last=node('div');
    if(latest)last.append(link(latest.title,topicUrl(category,latest)),node('small',displayDate(latest.date,latest.posts.at(-1).time)));
    else last.append(node('span','Aucun sujet.'));
    return [title,node('span',String(category.topics.length)),node('span',String(messageCount(category))),last];
  });
  root.append(table(['Forum','Sujets','Messages','Dernier sujet actif'],rows,'forum-categories'));
  return root;
}
export function renderCategory(_context,data,category) {
  const root=shell(data,category);
  root.append(node('h2',category.name),node('p',category.description));
  const rows=activeTopics(category).map(topic=>{
    const title=node('div');title.append(link(`${topic.locked?'[Verrouillé] ':''}${topic.title}`,topicUrl(category,topic)));
    const last=topic.posts.at(-1),activity=node('div');activity.append(node('span',displayDate(topic.date,last.time)),node('small',last.author));
    return [title,node('span',topic.posts[0].author),node('span',String(topic.posts.length-1)),activity];
  });
  root.append(table(['Sujet','Auteur','Réponses','Dernier message'],rows,'forum-topics'));
  return root;
}
function pagination(category,topic,state) {
  const nav=node('nav',undefined,'forum-pagination');nav.setAttribute('aria-label','Pages de la discussion');
  nav.append(node('span','Pages : '));
  for(let page=1;page<=state.pages;page++) {
    const item=page===state.page?node('strong',String(page)):link(String(page),`${topicUrl(category,topic)}?page=${page}`);
    if(page===state.page)item.setAttribute('aria-current','page');
    nav.append(item);
  }
  return nav;
}
export function renderTopic({url},data,category,topic) {
  const state=topicPage(topic,url);
  if(!state)return renderError('not-found');
  const root=shell(data,category,topic);
  root.append(node('h2',topic.title),node('p',`Sujet créé par ${topic.posts[0].author} · ${displayDate(topic.date,topic.posts[0].time)} · ${topic.posts.length-1} réponse(s)`));
  if(state.pages>1)root.append(pagination(category,topic,state));
  for(const [index,post] of state.posts.entries()){
    const message=node('article',undefined,'forum-message');
    const author=node('div',undefined,'forum-author');author.append(node('strong',post.author));
    const body=node('div',undefined,'forum-body');
    body.append(node('small',`#${state.offset+index+1} · ${displayDate(topic.date,post.time)}`),node('p',post.text));
    message.append(author,body);root.append(message);
  }
  if(state.pages>1)root.append(pagination(category,topic,state));
  if(topic.locked)root.append(node('p','Ce sujet est verrouillé.','forum-locked'));
  root.append(link(`Retour à ${category.name}`,categoryUrl(category)));
  return root;
}
