import course from '@stale-check/shared/fixtures/returns-101/course.json';
import golden from '@stale-check/shared/fixtures/returns-101/facts.golden.json';
import m1 from '@stale-check/shared/fixtures/returns-101/modules/7c1e4a52-3b0d-4f6e-9a8b-2d5f0c9e1a11.blocks.json';
import m2 from '@stale-check/shared/fixtures/returns-101/modules/7c1e4a52-3b0d-4f6e-9a8b-2d5f0c9e1a12.blocks.json';
import m3 from '@stale-check/shared/fixtures/returns-101/modules/7c1e4a52-3b0d-4f6e-9a8b-2d5f0c9e1a13.blocks.json';
import m4 from '@stale-check/shared/fixtures/returns-101/modules/7c1e4a52-3b0d-4f6e-9a8b-2d5f0c9e1a14.blocks.json';

const blocksByModule = Object.fromEntries(course.modules.map((m, i) => [m.id, [m1, m2, m3, m4][i].data]));

export const courseTitle = course.title;

export function lessonTitle(moduleId) {
  return course.modules.find((m) => m.id === moduleId)?.title ?? '';
}

export function fact(id) {
  return golden.facts.find((f) => f.id === id);
}

export function block(blockId) {
  for (const blocks of Object.values(blocksByModule)) {
    const found = blocks.find((b) => b.block_id === blockId);
    if (found) return found;
  }
  return undefined;
}

export function propAt(props, path) {
  return path.split(/\.|\[(\d+)\]/).filter(Boolean).reduce((v, key) => v?.[key], props);
}

export function quizQuestion(questionId) {
  for (const blocks of Object.values(blocksByModule)) {
    for (const b of blocks.filter((x) => x.type === 'SimpleQuizBlock')) {
      const q = b.props.questions.find((x) => x.id === questionId);
      if (q) return { ...q, blockId: b.block_id };
    }
  }
  return undefined;
}

export function moduleBlocks(moduleId) {
  return blocksByModule[moduleId] ?? [];
}
