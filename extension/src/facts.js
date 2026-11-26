import course from '@stale-check/shared/fixtures/returns-101/course.json';
import golden from '@stale-check/shared/fixtures/returns-101/facts.golden.json';

const lessonTitles = Object.fromEntries(course.modules.map((m) => [m.id, m.title]));

export function pageKey(url) {
  const u = new URL(url);
  return `${u.origin}${u.pathname}`;
}

const LOCAL_WIKI = 'http://localhost:5050';
const WIKI_ALIASES = { '/refunds-reworded': '/refunds' };

function sourceKey(url) {
  const key = pageKey(url);
  if (!WIKI_BASE || !key.startsWith(`${WIKI_BASE}/`)) return key;
  const path = key.slice(WIKI_BASE.length).replace(/\.html$/, '');
  return `${LOCAL_WIKI}${WIKI_ALIASES[path] ?? path}.html`;
}

export function factsForUrl(url) {
  const key = sourceKey(url);
  return golden.facts
    .filter((f) => pageKey(f.sourceUrl) === key)
    .map((f) => ({ ...f, courseId: golden.courseId, courseTitle: course.title, lessonTitle: lessonTitles[f.moduleId] ?? '' }));
}

export function factById(id) {
  const f = golden.facts.find((x) => x.id === id);
  return f && { ...f, courseId: golden.courseId, courseTitle: course.title, lessonTitle: lessonTitles[f.moduleId] ?? '' };
}
