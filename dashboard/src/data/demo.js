import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { org } from './sample.js';

export function createDemoBackend(app) {
  const db = getFirestore(app);
  const read = (name) => getDocs(collection(db, 'demo', org.id, name)).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })));
  let data;
  const load = () => {
    data ??= Promise.all(['flags', 'learners', 'completions', 'drafts'].map(read)).then(([flags, learners, completions, drafts]) => ({
      flags,
      learners: new Map(learners.map((l) => [l.id, l])),
      completions,
      drafts: new Map(drafts.map((d) => [d.flagId, d])),
    }));
    return data;
  };

  return {
    org,
    readOnly: true,
    async listFlags() {
      const { flags } = await load();
      return [...flags].sort((a, b) => b.createdAt - a.createdAt);
    },
    async getFlag(id) {
      const { flags } = await load();
      return flags.find((f) => f.id === id);
    },
    async hasDraft(id) {
      const { drafts } = await load();
      return drafts.has(id);
    },
    async trainedOnOldVersion(flag) {
      const { completions, learners } = await load();
      return completions
        .filter((c) => c.moduleId === flag.moduleId && c.completedAt < (flag.fixedAt ?? Infinity))
        .sort((a, b) => b.completedAt - a.completedAt)
        .map((c) => ({ ...c, learner: learners.get(c.learnerId) ?? { name: 'Learner' } }));
    },
    async draftFix(flagId) {
      const { drafts } = await load();
      const draft = drafts.get(flagId);
      return draft ? { draft } : { reason: 'needs_cloud' };
    },
  };
}
