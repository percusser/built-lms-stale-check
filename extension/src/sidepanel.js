import { hashText } from '@stale-check/shared';
import { checkFact, isFlag } from './check.js';
import { factById, factsForUrl, pageKey } from './facts.js';
import { selectModel } from './models/index.js';
import { read, update } from './store.js';

const VERDICTS = {
  still_true: { label: 'Still true', icon: '✓', tone: 'ok' },
  changed: { label: 'Changed', icon: '↻', tone: 'warn' },
  removed: { label: 'Removed', icon: '✕', tone: 'bad' },
  unverified: { label: 'Could not verify', icon: '?', tone: 'plain' },
  not_checked: { label: 'Not checked', icon: '–', tone: 'plain' },
};
const SOURCES = {
  ON_DEVICE: { label: 'On device', icon: '▣' },
  IN_CLOUD: { label: 'Cloud', icon: '☁' },
};
const REASONS = {
  too_long: 'This page is too long for the on-device model, and the cloud model could not be reached.',
  model_error: 'The model returned an error.',
  needs_cloud: 'The on-device model is not available, and the cloud model could not be reached.',
};

const params = new URLSearchParams(location.search);
const state = { tabId: undefined, page: undefined, facts: [], running: false, progress: 0, results: undefined, modelStatus: undefined, downloadProgress: undefined, error: undefined, incomplete: undefined };
const canCheck = (s) => s?.state === 'available' || s?.cloud === true;
const model = selectModel({
  onDownloadProgress(loaded) {
    state.downloadProgress = loaded;
    renderModel();
  },
});

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== false) el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== undefined && c !== null && c !== false) el.append(c);
  return el;
}

function pill(tone, icon, label) {
  return h('span', { class: `pill ${tone}` }, h('span', { 'aria-hidden': 'true' }, icon), label);
}

function verdictPill(verdict) {
  const v = VERDICTS[verdict] ?? VERDICTS.unverified;
  return pill(v.tone, v.icon, v.label);
}

function sourcePill(source) {
  const s = SOURCES[source];
  return s ? pill('info', s.icon, s.label) : undefined;
}

async function activeTab() {
  if (params.has('tab')) return chrome.tabs.get(Number(params.get('tab')));
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function readPage(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'get-page-text' });
  } catch {
    return undefined;
  }
}

async function load() {
  if (state.running) return;
  const tab = await activeTab();
  state.tabId = tab?.id;
  state.results = undefined;
  state.error = undefined;
  state.incomplete = undefined;
  state.facts = tab?.url ? safeFacts(tab.url) : [];
  state.page = undefined;
  if (state.facts.length && tab) {
    const snap = await readPage(tab.id);
    if (snap) {
      const key = pageKey(snap.url);
      const hash = await hashText(snap.text);
      const pages = await read('pages', {});
      const saved = (await read('results', {}))[key];
      state.page = { key, title: snap.title, text: snap.text, hash, checkedHash: pages[key]?.checkedHash, checkedAt: pages[key]?.checkedAt };
      if (saved?.hash === hash) state.results = saved.facts;
    } else {
      state.page = { key: pageKey(tab.url), title: tab.title, missing: true };
    }
  }
  state.modelStatus = await model.status();
  render();
  if (state.page && !state.page.missing && state.page.hash !== state.page.checkedHash && canCheck(state.modelStatus)) runCheck();
}

function safeFacts(url) {
  try {
    return factsForUrl(url);
  } catch {
    return [];
  }
}

async function runCheck() {
  if (state.running || !state.page || state.page.missing) return;
  state.running = true;
  state.progress = 0;
  state.results = [];
  state.error = undefined;
  state.incomplete = undefined;
  render();
  try {
    if (state.modelStatus?.state !== 'available') {
      await model.prepare();
      state.modelStatus = await model.status();
    }
    const { key, hash, text } = state.page;
    for (const fact of state.facts) {
      state.results.push(await checkFact(model, fact, text));
      state.progress = state.results.length / state.facts.length;
      render();
    }
    const checkedAt = Date.now();
    const failed = state.results.filter((r) => r.verdict === 'not_checked');
    if (failed.length) {
      state.incomplete = { count: failed.length, total: state.results.length, reason: failed[0].reason };
    } else {
      await update('results', {}, (all) => ({ ...all, [key]: { hash, checkedAt, facts: state.results } }));
      await update('pages', {}, (all) => ({ ...all, [key]: { ...all[key], url: key, hash, checkedHash: hash, checkedAt } }));
    }
    const created = [];
    await update('flags', {}, (all) => {
      const next = { ...all };
      for (const r of state.results.filter(isFlag)) {
        const fact = factById(r.factId);
        const id = `${r.factId}:${hash.slice(0, 12)}`;
        next[id] ??= {
          id,
          factId: r.factId,
          courseId: fact.courseId,
          moduleId: fact.moduleId,
          sourceLabel: state.page.title || new URL(key).hostname,
          changedAt: Number.isInteger(state.page.checkedAt) ? state.page.checkedAt : undefined,
          verdict: r.verdict,
          oldValue: fact.value,
          newValue: r.newValue,
          quote: r.quote,
          sourceUrl: key,
          origin: 'extension',
          inferenceSource: r.inferenceSource,
          status: 'open',
          createdAt: checkedAt,
        };
        created.push(next[id]);
      }
      return next;
    });
    if (created.length) await model.saveFlags?.(created);
    if (!state.incomplete) {
      state.page = { ...state.page, checkedHash: hash, checkedAt };
      chrome.runtime.sendMessage({ type: 'page-checked', tabId: state.tabId }).catch(() => {});
    }
  } catch (err) {
    state.error = err?.message ?? String(err);
  } finally {
    state.running = false;
    render();
  }
}

function renderPage() {
  const root = document.getElementById('page');
  root.replaceChildren();
  if (!state.facts.length) {
    root.append(h('h2', {}, 'No training comes from this page'), h('p', { class: 'muted' }, 'Open a page that one of your lessons was built from, and this panel checks whether the lesson still matches it.'));
    return;
  }
  const lessons = [...new Set(state.facts.map((f) => f.lessonTitle))];
  root.append(
    h('div', { class: 'page-title' }, state.page?.title ?? ''),
    h('div', { class: 'muted' }, `${state.facts.length} facts in ${lessons.join(', ')} (${state.facts[0].courseTitle}) come from this page.`),
  );
  if (state.page?.missing) {
    root.append(h('p', {}, 'Reload this page so the extension can read it.'));
    return;
  }
  const failed = state.incomplete || state.error;
  const status = state.running
    ? pill('info', '…', 'Checking')
    : failed
      ? pill('bad', '!', 'Check did not finish')
      : state.page.hash === state.page.checkedHash
      ? pill('ok', '✓', 'Checked, no change since then')
      : state.page.checkedHash
        ? pill('warn', '!', 'Page changed since last check')
        : pill('plain', '•', 'Not checked yet');
  root.append(...[
    h('div', { class: 'row' }, status, state.page.checkedAt ? h('span', { class: 'muted' }, `Last checked ${new Date(state.page.checkedAt).toLocaleString()}`) : undefined),
    state.running ? h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(state.progress * 100)) }, h('div', { style: `transform: scaleX(${state.progress})` })) : undefined,
    h('div', { class: 'row' }, h('button', { id: 'check', disabled: state.running || (state.modelStatus?.state === 'unavailable' && !canCheck(state.modelStatus)), onclick: runCheck }, state.running ? 'Checking…' : failed ? 'Try again' : state.page.checkedHash ? 'Check again' : 'Check this page')),
    state.incomplete ? h('p', { class: 'alert', role: 'alert' }, `${state.incomplete.count} of ${state.incomplete.total} facts could not be checked. ${REASONS[state.incomplete.reason] ?? REASONS.model_error} The page is not marked as checked.`) : undefined,
    state.error ? h('p', { class: 'alert', role: 'alert' }, state.error) : undefined,
  ].filter(Boolean));
}

function renderModel() {
  const root = document.getElementById('model');
  const s = state.modelStatus;
  if (!s) return root.replaceChildren();
  const text = {
    available: `${model.label} is ready. Checks run on this device.`,
    downloadable: `${model.label} needs a one-time download. It starts when you check a page.`,
    downloading: `Downloading ${model.label}${state.downloadProgress !== undefined ? ` (${Math.round(state.downloadProgress * 100)}%)` : ''}.`,
    unavailable: s.cloud ? `${model.label} is not available here. Checks run in the cloud with ${model.cloudLabel}.` : `${model.label} is not available here. ${s.detail ?? ''} The cloud model is not connected.`,
  }[s.state] ?? s.state;
  root.replaceChildren(h('span', { 'aria-hidden': 'true' }, s.state === 'available' ? '▣' : '○'), text);
}

function renderResults() {
  const root = document.getElementById('results');
  root.replaceChildren();
  if (!state.results?.length) return;
  const byId = Object.fromEntries(state.facts.map((f) => [f.id, f]));
  const sorted = [...state.results].sort((a, b) => Number(isFlag(b)) - Number(isFlag(a)));
  root.append(
    h('h2', {}, 'Lesson facts on this page'),
    h('div', { class: 'list' }, sorted.map((r) => {
      const fact = byId[r.factId];
      return h('article', { class: `fact${isFlag(r) ? ' flagged' : ''}`, 'data-fact': r.factId, 'data-verdict': r.verdict },
        h('div', { class: 'row' }, verdictPill(r.verdict), sourcePill(r.inferenceSource), h('span', { class: 'muted' }, fact.lessonTitle)),
        h('p', { class: 'statement' }, fact.statement),
        r.verdict === 'changed' ? h('dl', { class: 'change' }, h('dt', {}, 'Lesson says'), h('dd', {}, fact.value), h('dt', {}, 'Page now says'), h('dd', {}, r.newValue)) : undefined,
        r.quote ? h('blockquote', {}, r.quote) : undefined,
        r.reason ? h('p', { class: 'muted' }, REASONS[r.reason] ?? r.reason) : undefined,
        isFlag(r) && fact.quizQuestionIds.length ? h('p', { class: 'muted' }, `${fact.quizQuestionIds.length} quiz question${fact.quizQuestionIds.length > 1 ? 's' : ''} also teach${fact.quizQuestionIds.length > 1 ? '' : 'es'} this.`) : undefined,
      );
    })),
  );
}

async function renderFlags() {
  const root = document.getElementById('flags');
  const flags = Object.values(await read('flags', {})).filter((f) => f.status === 'open').sort((a, b) => b.createdAt - a.createdAt);
  root.replaceChildren();
  if (!flags.length) return;
  root.append(
    h('h2', {}, `Open flags (${flags.length})`),
    h('div', { class: 'list' }, flags.map((f) => {
      const fact = factById(f.factId);
      return h('article', { class: 'fact', 'data-flag': f.id },
        h('div', { class: 'row' }, verdictPill(f.verdict), sourcePill(f.inferenceSource), h('span', { class: 'muted' }, fact?.lessonTitle ?? '')),
        h('p', { class: 'statement' }, fact?.statement ?? f.factId),
        f.verdict === 'changed' ? h('p', { class: 'muted' }, `${f.oldValue} → ${f.newValue}`) : undefined,
        h('div', { class: 'row' }, h('button', { class: 'secondary', onclick: () => dismiss(f.id) }, 'Dismiss')),
      );
    })),
  );
}

async function dismiss(id) {
  await update('flags', {}, (all) => ({ ...all, [id]: { ...all[id], status: 'dismissed' } }));
  renderFlags();
}

function render() {
  renderPage();
  renderModel();
  renderResults();
  renderFlags();
}

chrome.tabs.onActivated.addListener(() => !params.has('tab') && load());
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (tabId === state.tabId && info.status === 'complete') setTimeout(load, 300);
});
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'page-seen' && message.url === state.page?.key && !state.running) load();
});

load();
