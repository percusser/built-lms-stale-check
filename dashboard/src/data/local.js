import { completions, drafts, flags, learners, org } from './sample.js';

const KEY = 'stale-check-dashboard';

function overlay() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

function save(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export function createLocalBackend() {
  const withOverlay = (flag) => ({ ...flag, ...overlay().flags?.[flag.id] });
  const patchFlag = (id, patch) => {
    const o = overlay();
    save({ ...o, flags: { ...o.flags, [id]: { ...o.flags?.[id], ...patch } } });
  };

  return {
    org,
    async listFlags() {
      return flags.map(withOverlay).sort((a, b) => b.createdAt - a.createdAt);
    },
    async getFlag(id) {
      const flag = flags.find((f) => f.id === id);
      return flag && withOverlay(flag);
    },
    async setFlagStatus(id, status) {
      patchFlag(id, { status });
    },
    async trainedOnOldVersion(flag) {
      return completions
        .filter((c) => c.moduleId === flag.moduleId && c.completedAt < (flag.fixedAt ?? Infinity))
        .sort((a, b) => b.completedAt - a.completedAt)
        .map((c) => ({ ...c, learner: learners.find((l) => l.id === c.learnerId) }));
    },
    async draftFix(flagId) {
      const draft = drafts[flagId];
      return draft ? { draft } : { reason: 'needs_cloud' };
    },
    async approveFix(flagId, { correctionNotice, recipients }) {
      patchFlag(flagId, { status: 'fixed', fixedAt: Date.now(), correctionNotice, noticeRecipients: recipients });
    },
    async reset() {
      save({});
    },
  };
}
