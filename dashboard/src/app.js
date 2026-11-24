import { stripHtml } from '@stale-check/shared';
import { block, courseTitle, fact, lessonTitle, propAt, quizQuestion } from './course.js';
import { createFirestoreBackend } from './data/firestore.js';
import { createLocalBackend } from './data/local.js';
import { firebaseApp, isAdminUser, signInAdmin, signOutUser, watchUser } from './firebase.js';
import { wordDiff } from './diff.js';
import { safeHtmlFragment } from './sanitize.js';

const fbApp = firebaseApp();
const backend = fbApp ? createFirestoreBackend(fbApp) : createLocalBackend();
const app = document.getElementById('app');

const VERDICTS = {
  changed: { label: 'Changed', icon: '↻', tone: 'warn' },
  removed: { label: 'Removed', icon: '✕', tone: 'bad' },
};
const STATUSES = {
  open: { label: 'Open', icon: '●', tone: 'warn' },
  approved: { label: 'Approved', icon: '…', tone: 'info' },
  fixed: { label: 'Fixed', icon: '✓', tone: 'ok' },
  dismissed: { label: 'Dismissed', icon: '–', tone: 'plain' },
  confirmed: { label: 'Confirmed', icon: '!', tone: 'warn' },
};
const SOURCES = {
  ON_DEVICE: { label: 'On device', icon: '▣' },
  IN_CLOUD: { label: 'Cloud', icon: '☁' },
  IN_CLOUD_AFTER_REFUSAL: { label: 'Cloud (on-device refused)', icon: '☁' },
};
const ORIGINS = {
  extension: 'Chrome extension',
  iphone: 'iPhone',
};

function isWebUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== false && v !== null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) if (c !== undefined && c !== null && c !== false) el.append(c);
  return el;
}

const pill = (tone, icon, label) => h('span', { class: `pill ${tone}` }, h('span', { 'aria-hidden': 'true' }, icon), label);
const verdictPill = (v) => pill(VERDICTS[v].tone, VERDICTS[v].icon, VERDICTS[v].label);
const statusPill = (s) => pill(STATUSES[s].tone, STATUSES[s].icon, STATUSES[s].label);
const sourcePill = (s) => SOURCES[s] && pill('info', SOURCES[s].icon, SOURCES[s].label);
const date = (ms) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const people = (n) => `${n} ${n === 1 ? 'person' : 'people'}`;

function changeLine(flag) {
  return flag.verdict === 'changed'
    ? h('p', { class: 'change-line' }, h('span', { class: 'old' }, flag.oldValue), h('span', { 'aria-hidden': 'true' }, ' → '), h('span', { class: 'visually-hidden' }, ' is now '), h('span', { class: 'new' }, flag.newValue))
    : h('p', { class: 'change-line' }, 'The source no longer mentions ', h('span', { class: 'old' }, flag.oldValue), '.');
}

function diffNodes(before, after) {
  return wordDiff(before, after).map((op) =>
    op.type === 'same' ? op.text : op.type === 'removed' ? h('del', {}, op.text) : h('ins', {}, op.text),
  );
}

async function listView(filter) {
  const all = await backend.listFlags();
  const shown = filter === 'all' ? all : all.filter((f) => f.status === filter);
  const open = all.filter((f) => f.status === 'open');
  const trained = await Promise.all(open.map((f) => backend.trainedOnOldVersion(f)));
  const lessons = new Set(open.map((f) => f.moduleId));
  const counts = await Promise.all(shown.map((f) => backend.trainedOnOldVersion(f).then((r) => r.length)));
  const tabs = ['open', 'approved', 'fixed', 'dismissed', 'all'];

  return [
    h('div', { class: 'page-head' },
      h('h1', {}, 'Flagged training'),
      h('p', { class: 'muted' }, `${courseTitle} for ${backend.org.name.replace(/\.$/, "")}. Facts whose source changed, found by the Chrome extension and the iPhone app.`),
    ),
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('div', { class: 'stat-value' }, String(open.length)), h('div', { class: 'stat-label' }, 'Open flags')),
      h('div', { class: 'stat' }, h('div', { class: 'stat-value' }, String(lessons.size)), h('div', { class: 'stat-label' }, 'Lessons affected')),
      h('div', { class: 'stat' }, h('div', { class: 'stat-value' }, String(new Set(trained.flat().map((c) => c.learnerId)).size)), h('div', { class: 'stat-label' }, 'People trained on an old version')),
    ),
    h('nav', { class: 'tabs', 'aria-label': 'Filter flags' }, tabs.map((t) =>
      h('a', { href: `#/?status=${t}`, class: t === filter ? 'tab active' : 'tab', 'aria-current': t === filter ? 'page' : undefined }, t === 'all' ? 'All' : STATUSES[t].label),
    )),
    shown.length
      ? h('ul', { class: 'flag-list' }, shown.map((flag, i) => {
          const f = fact(flag.factId);
          return h('li', {},
            h('a', { class: 'flag-card', href: `#/flags/${encodeURIComponent(flag.id)}`, 'data-flag': flag.id },
              h('div', { class: 'row' }, verdictPill(flag.verdict), statusPill(flag.status), h('span', { class: 'muted' }, lessonTitle(flag.moduleId))),
              h('p', { class: 'statement' }, f.statement),
              changeLine(flag),
              h('div', { class: 'row muted small' },
                h('span', {}, `Found by the ${ORIGINS[flag.origin]} on ${date(flag.createdAt)}`),
                sourcePill(flag.inferenceSource),
                h('span', {}, `${people(counts[i])} trained on the old version`),
              ),
            ),
          );
        }))
      : h('div', { class: 'empty' }, h('p', {}, filter === 'open' ? 'No open flags. Your training matches its sources.' : 'Nothing here yet.'), filter !== 'all' ? h('a', { href: '#/?status=all' }, 'Show all flags') : undefined),
  ];
}

function lessonBlockView(blockId, propName) {
  const b = block(blockId);
  if (!b) return undefined;
  const html = propName ? propAt(b.props, propName) : undefined;
  return h('div', { class: 'lesson-block' }, h('div', { class: 'muted small' }, b.type.replace(/Block$/, '')), html ? h('div', { class: 'prose' }, safeHtmlFragment(html)) : h('p', {}, stripHtml(JSON.stringify(b.props))));
}

function questionView(q, other) {
  return h('div', { class: 'question' },
    h('p', { class: 'q-text' }, other ? diffNodes(other.question, q.question) : q.question),
    h('ul', { class: 'options' }, q.options.map((o) => {
      const correct = o === q.correctAnswer;
      return h('li', { class: correct ? 'correct' : undefined }, h('span', { 'aria-hidden': 'true' }, correct ? '✓ ' : '○ '), o, correct ? h('span', { class: 'visually-hidden' }, ' (correct answer)') : undefined);
    })),
    q.feedback ? h('p', { class: 'muted small' }, 'Feedback: ', other?.feedback ? diffNodes(other.feedback, q.feedback) : q.feedback) : undefined,
  );
}

function findTextProp(b, value) {
  const walk = (v, path) => {
    if (typeof v === 'string') return stripHtml(v).toLowerCase().includes(value.toLowerCase()) ? path : undefined;
    if (Array.isArray(v)) for (const [i, x] of v.entries()) { const r = walk(x, `${path}[${i}]`); if (r) return r; }
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { const r = walk(x, path ? `${path}.${k}` : k); if (r) return r; }
    return undefined;
  };
  return walk(b.props, '') ?? 'text';
}

async function detailView(id) {
  const flag = await backend.getFlag(id);
  if (!flag) return [h('p', {}, 'This flag does not exist. '), h('a', { href: '#/' }, 'Back to flags')];
  const f = fact(flag.factId);
  const trained = await backend.trainedOnOldVersion(flag);
  const b = block(f.blockId);

  const setStatus = async (status) => {
    await backend.setFlagStatus(flag.id, status);
    route();
  };

  return [
    h('a', { class: 'back', href: '#/' }, '← All flags'),
    h('div', { class: 'page-head' },
      h('div', { class: 'row' }, verdictPill(flag.verdict), statusPill(flag.status), h('span', { class: 'muted' }, `${courseTitle} · ${lessonTitle(flag.moduleId)}`)),
      h('h1', {}, f.statement),
      changeLine(flag),
    ),
    h('div', { class: 'actions' },
      flag.status === 'open' ? h('a', { class: 'button', href: `#/flags/${encodeURIComponent(flag.id)}/fix` }, 'Draft fix') : undefined,
      flag.status === 'open' ? h('button', { class: 'secondary', onclick: () => setStatus('dismissed') }, 'Dismiss, the lesson is right') : undefined,
      flag.status === 'dismissed' || flag.status === 'approved' ? h('button', { class: 'secondary', onclick: () => setStatus('open') }, 'Reopen') : undefined,
    ),
    flag.status === 'approved' ? h('section', { class: 'card notice-sent' }, h('h2', {}, 'Fix approved'), flag.correctionNotice ? h('p', {}, flag.correctionNotice) : undefined, h('p', { class: 'muted small' }, flag.applyError ? `The lesson was not updated: ${flag.applyError}` : 'Waiting for the sync script to write the fix to the lesson in Built LMS.')) : undefined,
    flag.status === 'fixed' && flag.correctionNotice ? h('section', { class: 'card notice-sent' }, h('h2', {}, 'Lesson corrected'), h('p', {}, flag.correctionNotice), h('p', { class: 'muted small' }, flag.appliedBlocks ? `The fix was written to the lesson in Built LMS on ${date(flag.fixedAt)}. Correction notice for ${people(flag.noticeRecipients?.length ?? 0)}; sending it is not connected yet.` : `For ${people(flag.noticeRecipients?.length ?? 0)}.`)) : undefined,
    h('div', { class: 'grid' },
      h('section', { class: 'card' },
        h('h2', {}, 'Evidence'),
        h('dl', { class: 'facts' },
          h('dt', {}, 'Lesson says'), h('dd', {}, flag.oldValue),
          h('dt', {}, 'Source now says'), h('dd', {}, flag.verdict === 'changed' ? flag.newValue : 'Nothing about this'),
          h('dt', {}, 'Source'), h('dd', {}, isWebUrl(flag.sourceUrl) ? h('a', { href: flag.sourceUrl, target: '_blank', rel: 'noopener' }, flag.sourceLabel) : flag.sourceLabel),
          h('dt', {}, 'Found by'), h('dd', {}, `${[ORIGINS[flag.origin], flag.createdBy, date(flag.createdAt)].filter(Boolean).join(', ')} `, sourcePill(flag.inferenceSource)),
          h('dt', {}, 'Changed on'), h('dd', {}, date(flag.changedAt)),
        ),
        flag.quote ? h('blockquote', {}, flag.quote) : undefined,
      ),
      h('section', { class: 'card' },
        h('h2', {}, 'Where the lesson teaches it'),
        b ? lessonBlockView(f.blockId, findTextProp(b, flag.oldValue.split(' / ')[0])) : undefined,
        f.quizQuestionIds.map((qid) => quizQuestion(qid)).filter(Boolean).map((q) => h('div', { class: 'lesson-block' }, h('div', { class: 'muted small' }, 'Quiz question'), questionView(q))),
      ),
    ),
    h('section', { class: 'card' },
      h('h2', {}, `People trained on the old version (${trained.length})`),
      h('p', { class: 'muted' }, flag.fixedAt ? `Completed ${lessonTitle(flag.moduleId)} before it was corrected on ${date(flag.fixedAt)}.` : `Completed ${lessonTitle(flag.moduleId)} while it still says "${flag.oldValue}".`),
      trained.length
        ? peopleTable(trained)
        : h('p', {}, 'Nobody completed this lesson before it was corrected.'),
    ),
  ];
}

function peopleTable(rows) {
  const teams = rows.some((c) => c.learner.team);
  const scores = rows.some((c) => typeof c.score === 'number');
  return h('table', { class: 'people' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Name'), teams ? h('th', {}, 'Team') : undefined, h('th', {}, 'Completed'), scores ? h('th', {}, 'Quiz score') : undefined)),
    h('tbody', {}, rows.map((c) => h('tr', {},
      h('td', {}, c.learner.name),
      teams ? h('td', {}, c.learner.team ?? '') : undefined,
      h('td', {}, date(c.completedAt)),
      scores ? h('td', {}, typeof c.score === 'number' ? `${c.score}%` : '') : undefined,
    ))),
  );
}

async function fixView(id) {
  const flag = await backend.getFlag(id);
  if (!flag) return [h('p', {}, 'This flag does not exist. '), h('a', { href: '#/' }, 'Back to flags')];
  const f = fact(flag.factId);
  const back = h('a', { class: 'back', href: `#/flags/${encodeURIComponent(flag.id)}` }, '← Back to the flag');
  app.replaceChildren(back, h('div', { class: 'page-head' }, h('h1', {}, 'Draft fix')), h('p', { class: 'muted', role: 'status' }, 'Gemini is drafting the fix…'));
  const out = await backend.draftFix(flag.id);
  if (out.reason) {
    return [back, h('div', { class: 'page-head' }, h('h1', {}, 'Draft fix')), h('div', { class: 'card' }, h('p', {}, out.reason === 'needs_cloud' ? 'Drafting a fix needs the cloud model, which is not connected yet.' : 'The cloud model could not draft a fix. Try again.'), h('a', { href: `#/flags/${encodeURIComponent(flag.id)}` }, 'Back to the flag'))];
  }
  const { draft } = out;
  const trained = await backend.trainedOnOldVersion(flag);
  const notice = h('textarea', { id: 'notice', rows: '5' });
  notice.value = draft.correctionNotice;

  const approveError = h('p', { class: 'error', role: 'alert' });
  const approve = async () => {
    try {
      await backend.approveFix(flag.id, { correctionNotice: notice.value.trim(), recipients: trained.map((c) => c.learnerId) });
      location.hash = `#/flags/${encodeURIComponent(flag.id)}`;
    } catch (err) {
      approveError.textContent = err.message;
    }
  };

  return [
    back,
    h('div', { class: 'page-head' },
      h('div', { class: 'row' }, verdictPill(flag.verdict), h('span', { class: 'muted' }, `${courseTitle} · ${lessonTitle(flag.moduleId)}`), sourcePill(draft.inferenceSource)),
      h('h1', {}, 'Draft fix'),
      h('p', {}, draft.changeSummary),
    ),
    draft.blocks.map((d) => {
      const b = block(d.blockId);
      const before = propAt(b?.props ?? {}, d.propName) ?? '';
      return h('section', { class: 'card', 'data-block': d.blockId },
        h('h2', {}, `${b?.type.replace(/Block$/, '') ?? 'Block'}`),
        h('div', { class: 'side-by-side' },
          h('div', {}, h('div', { class: 'col-label' }, 'Now'), h('div', { class: 'prose' }, safeHtmlFragment(before))),
          h('div', {}, h('div', { class: 'col-label' }, 'Proposed'), h('div', { class: 'prose' }, diffNodes(stripHtml(before), stripHtml(d.html)))),
        ),
      );
    }),
    draft.quizQuestions.map((q) => {
      const current = quizQuestion(q.id);
      return h('section', { class: 'card', 'data-question': q.id },
        h('h2', {}, 'Quiz question'),
        h('div', { class: 'side-by-side' },
          h('div', {}, h('div', { class: 'col-label' }, 'Now'), current ? questionView(current) : h('p', {}, 'New question')),
          h('div', {}, h('div', { class: 'col-label' }, 'Proposed'), questionView(q, current)),
        ),
        current && current.correctAnswer !== q.correctAnswer ? h('p', { class: 'pill warn' }, h('span', { 'aria-hidden': 'true' }, '!'), ` The correct answer changes to “${q.correctAnswer}”.`) : undefined,
      );
    }),
    h('section', { class: 'card' },
      h('h2', {}, 'Correction notice'),
      h('label', { for: 'notice', class: 'muted' }, `Goes to the ${people(trained.length)} who completed ${lessonTitle(flag.moduleId)} before this fix.`),
      notice,
    ),
    h('div', { class: 'actions' },
      h('button', { id: 'approve', onclick: approve }, 'Approve fix and correction'),
      approveError,
      h('a', { class: 'button secondary', href: `#/flags/${encodeURIComponent(flag.id)}` }, 'Cancel'),
    ),
  ];
}

async function route(scroll = true) {
  const [path, query] = location.hash.slice(1).split('?');
  const parts = (path || '/').split('/').filter(Boolean).map(decodeURIComponent);
  let view;
  if (parts[0] === 'flags' && parts[2] === 'fix') view = await fixView(parts[1]);
  else if (parts[0] === 'flags' && parts[1]) view = await detailView(parts[1]);
  else view = await listView(new URLSearchParams(query).get('status') ?? 'open');
  app.replaceChildren(...view.flat(Infinity).filter(Boolean));
  if (scroll) window.scrollTo(0, 0);
}

function signInView(user, error) {
  const wrong = user && !isAdminUser(user);
  const status = h('p', { class: 'muted', role: 'status' }, error ?? (wrong ? `${user.email} does not have access to this dashboard.` : ''));
  const button = h('button', {
    type: 'button',
    onclick: async () => {
      button.disabled = true;
      try {
        if (wrong) await signOutUser(fbApp);
        await signInAdmin(fbApp);
      } catch (err) {
        if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') status.textContent = 'Sign-in failed. Try again.';
      } finally {
        button.disabled = false;
      }
    },
  }, wrong ? 'Use a different Google account' : 'Sign in with Google');
  return [h('h1', {}, 'Sign in'), h('p', {}, 'Flags, approvals and learner records are visible only to the course owner.'), button, status];
}

let started = false;
let stopSubscription;

function start() {
  if (started) return;
  started = true;
  window.addEventListener('hashchange', route);
  route();
  let firstSnapshot = true;
  stopSubscription = backend.subscribe?.(() => {
    if (firstSnapshot) firstSnapshot = false;
    else if (!location.hash.includes('/fix')) route(false);
  });
}

if (!fbApp) start();
else watchUser(fbApp, (user) => {
  if (isAdminUser(user)) return start();
  if (started) {
    started = false;
    stopSubscription?.();
    window.removeEventListener('hashchange', route);
  }
  app.replaceChildren(...signInView(user));
});
