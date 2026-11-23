const LAYOUT_PROPS = new Set(['widthConstraint', 'padding', 'elementStyles', 'quizStyle', 'variant', 'type', 'level', 'icon', 'showIcon', 'showIcons', 'presentationMode', 'animationSpeed']);

export function stripHtml(html) {
  return String(html)
    .replace(/<\/(td|th)>/gi, ' ')
    .replace(/<\/(p|li|h[1-6]|div|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function collectStrings(value, key, out) {
  if (key && LAYOUT_PROPS.has(key)) return;
  if (typeof value === 'string') {
    const text = stripHtml(value);
    if (text) out.push(text);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, null, out);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) collectStrings(v, k, out);
  }
}

export function blockText(block) {
  if (block.type === 'SimpleQuizBlock') return stripHtml(block.props?.title ?? '');
  const out = [];
  collectStrings(block.props ?? {}, null, out);
  return out.join('\n');
}

export function quizQuestions(blocks) {
  return blocks
    .filter((b) => b.type === 'SimpleQuizBlock')
    .flatMap((b) => (b.props?.questions ?? []).map((q) => ({ ...q, blockId: b.block_id })));
}

export function lessonPromptInput(blocksResponse) {
  const blocks = blocksResponse.data ?? blocksResponse;
  const lessonBlocks = blocks
    .filter((b) => b.type !== 'SimpleQuizBlock')
    .map((b) => `[${b.block_id}] (${b.type}) ${blockText(b).replace(/\n/g, ' ')}`)
    .join('\n');
  const quiz = quizQuestions(blocks)
    .map((q) => `[${q.id}] (${q.blockId}) ${stripHtml(q.question)} → ${q.correctAnswer ?? 'answer hidden'}`)
    .join('\n');
  return { lessonBlocks, quizQuestions: quiz || '(none)' };
}

export function renderPrompt(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    if (!(name in vars)) throw new Error(`Missing prompt variable: ${name}`);
    return String(vars[name]);
  });
}

export function normalizeForMatch(text) {
  return String(text)
    .normalize('NFKC')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function verifyQuote(quote, sourceText) {
  const q = normalizeForMatch(quote);
  return q.length > 0 && normalizeForMatch(sourceText).includes(q);
}

export function acceptPageVerdict(result, pageText, fact) {
  const valueStillOnPage = Boolean(fact?.value) && verifyQuote(fact.value, pageText);
  if (result.verdict === 'still_true') return { ...result, accepted: true };
  if (result.verdict === 'removed') return { ...result, accepted: !valueStillOnPage };
  const sameValue = Boolean(fact?.value) && normalizeForMatch(result.newValue) === normalizeForMatch(fact.value);
  return { ...result, accepted: Boolean(result.newValue) && !sameValue && verifyQuote(result.quote, pageText) };
}

export async function hashText(text) {
  const bytes = new TextEncoder().encode(normalizeForMatch(text));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const STOPWORDS = new Set('a an and are as at be by for from has have in is it of on or that the this to was we will with you your our from now'.split(' '));

export function tokenize(text) {
  return normalizeForMatch(text)
    .split(/[^a-z0-9$]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

export function prefilterFacts(message, facts, limit = 15) {
  const words = new Set(tokenize(message));
  return facts
    .map((fact) => {
      const keywordHits = fact.keywords.filter((k) => tokenize(k).every((w) => words.has(w))).length;
      const statementHits = tokenize(`${fact.statement} ${fact.value}`).filter((w) => words.has(w)).length;
      return { fact, score: keywordHits * 3 + statementHits };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.fact);
}

export function factsPromptList(facts) {
  return facts.map((f) => `[${f.id}] ${f.statement}`).join('\n');
}

function valueInSource(value, source) {
  if (verifyQuote(value, source)) return true;
  const words = tokenize(value);
  const sourceWords = new Set(tokenize(source));
  return words.length > 0 && words.filter((w) => sourceWords.has(w)).length / words.length >= 0.75;
}

function slug(text) {
  return normalizeForMatch(text).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

export function extractFactsPrompt(template, lessonTitle, blocksResponse) {
  return renderPrompt(template, { lessonTitle, ...lessonPromptInput(blocksResponse) });
}

export function acceptExtractedFacts(result, { moduleId, blocksResponse }) {
  const blocks = blocksResponse.data ?? blocksResponse;
  const textById = new Map(blocks.map((b) => [b.block_id, blockText(b)]));
  const questionIds = new Set(quizQuestions(blocks).map((q) => q.id));
  const seen = new Set();
  const accepted = [];
  const rejected = [];
  for (const raw of result?.facts ?? []) {
    const source = textById.get(raw.blockId);
    const problem = !source
      ? 'unknown_block'
      : !raw.value || !valueInSource(raw.value, source)
        ? 'value_not_in_block'
        : null;
    if (problem) {
      rejected.push({ ...raw, problem });
      continue;
    }
    let id = `f-${slug(raw.value)}`;
    while (seen.has(id)) id += '-2';
    seen.add(id);
    accepted.push({
      id,
      moduleId,
      blockId: raw.blockId,
      statement: raw.statement,
      value: raw.value,
      quizQuestionIds: (raw.quizQuestionIds ?? []).filter((q) => questionIds.has(q)),
      keywords: [...new Set((raw.keywords ?? []).map((k) => k.toLowerCase().trim()).filter(Boolean))],
    });
  }
  return { facts: accepted, rejected };
}

export async function extractFacts(model, { template, schema, lessonTitle, moduleId, blocksResponse }) {
  const prompt = extractFactsPrompt(template, lessonTitle, blocksResponse);
  const out = await model.generate({ prompt, schema, meta: { needsCloud: true } });
  if (!out.result) return { facts: [], rejected: [], reason: out.reason ?? 'model_error', inferenceSource: out.inferenceSource };
  return { ...acceptExtractedFacts(out.result, { moduleId, blocksResponse }), inferenceSource: out.inferenceSource };
}
