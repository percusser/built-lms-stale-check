import course from '@stale-check/shared/fixtures/returns-101/course.json';
import golden from '@stale-check/shared/fixtures/returns-101/facts.golden.json';

const lessonTitles = Object.fromEntries(course.modules.map((m) => [m.id, m.title]));

export function pageKey(url) {
  const u = new URL(url);
  return `${u.origin}${u.pathname}`;
}

export function factsForUrl(url) {
  const key = pageKey(url);
  return golden.facts
    .filter((f) => pageKey(f.sourceUrl) === key)
    .map((f) => ({ ...f, courseId: golden.courseId, courseTitle: course.title, lessonTitle: lessonTitles[f.moduleId] ?? '' }));
}

export function factById(id) {
  const f = golden.facts.find((x) => x.id === id);
  return f && { ...f, courseId: golden.courseId, courseTitle: course.title, lessonTitle: lessonTitles[f.moduleId] ?? '' };
}
