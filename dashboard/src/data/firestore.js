import { renderPrompt } from '@stale-check/shared';
import { createFirebaseModel } from '@stale-check/shared/firebase-model';
import draftFixTemplate from '@stale-check/shared/prompts/draft-fix.md';
import draftFixSchema from '@stale-check/shared/schemas/draft-fix.response.schema.json';
import { getAuth } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, onSnapshot, updateDoc } from 'firebase/firestore';
import { fact, moduleBlocks } from '../course.js';
import { org } from './sample.js';

export function createFirestoreBackend(app) {
  const db = getFirestore(app);
  const flags = collection(db, 'flags');
  const model = createFirebaseModel(app);
  const drafts = new Map();
  let roster;
  const loadRoster = () => {
    roster ??= Promise.all([getDocs(collection(db, 'completions')), getDocs(collection(db, 'learners'))]).then(([c, l]) => ({
      completions: c.docs.map((d) => d.data()),
      learners: new Map(l.docs.map((d) => [d.id, d.data()])),
    }));
    return roster;
  };
  const toFlag = (snap) => ({ id: snap.id, changedAt: snap.data().createdAt, ...snap.data() });

  return {
    org,
    live: true,
    subscribe(onChange) {
      const stopFlags = onSnapshot(flags, () => onChange(), () => {});
      const stopCompletions = onSnapshot(collection(db, 'completions'), () => { roster = undefined; onChange(); }, () => {});
      return () => { stopFlags(); stopCompletions(); };
    },
    async listFlags() {
      const snap = await getDocs(flags);
      return snap.docs.map(toFlag).sort((a, b) => b.createdAt - a.createdAt);
    },
    async getFlag(id) {
      const snap = await getDoc(doc(flags, id));
      return snap.exists() ? toFlag(snap) : undefined;
    },
    async setFlagStatus(id, status) {
      await updateDoc(doc(flags, id), { status });
    },
    async trainedOnOldVersion(flag) {
      const { completions, learners } = await loadRoster();
      const cutoff = flag.fixedAt ?? Infinity;
      return completions
        .filter((c) => c.moduleId === flag.moduleId && c.completedAt < cutoff)
        .sort((a, b) => b.completedAt - a.completedAt)
        .map((c) => ({ ...c, learner: learners.get(c.learnerId) ?? { name: 'Learner' } }));
    },
    async draftFix(flagId) {
      if (drafts.has(flagId)) return { draft: drafts.get(flagId) };
      const flag = await this.getFlag(flagId);
      const f = flag && fact(flag.factId);
      if (!f) return { reason: 'model_error' };
      const blocks = moduleBlocks(flag.moduleId).filter((b) => b.block_id === f.blockId || b.type === 'SimpleQuizBlock');
      const prompt = renderPrompt(draftFixTemplate, {
        statement: f.statement,
        oldValue: flag.oldValue,
        newValue: flag.verdict === 'changed' ? flag.newValue : '(removed from the source)',
        quote: flag.quote,
        sourceUrl: flag.sourceUrl ?? flag.sourceLabel ?? '',
        blocksJson: JSON.stringify(blocks.map((b) => ({ block_id: b.block_id, type: b.type, props: b.props }))),
      });
      const out = await model.generate({ prompt, schema: draftFixSchema, meta: { needsCloud: true } });
      if (!out.result) return { reason: out.reason ?? 'model_error' };
      const draft = { flagId, inferenceSource: out.inferenceSource, createdAt: Date.now(), ...out.result };
      drafts.set(flagId, draft);
      return { draft };
    },
    async approveFix(flagId, { correctionNotice, recipients }) {
      const draft = drafts.get(flagId);
      if (!draft) throw new Error('The draft is gone. Draft the fix again before you approve it.');
      await updateDoc(doc(flags, flagId), {
        status: 'approved',
        approvedAt: Date.now(),
        approvedBy: getAuth(app).currentUser?.email,
        correctionNotice,
        noticeRecipients: recipients,
        fix: { changeSummary: draft.changeSummary, blocks: draft.blocks, quizQuestions: draft.quizQuestions },
      });
    },
  };
}
