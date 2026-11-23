You list the facts a training lesson teaches, so a tool can later check each fact against its source page.

Rules:
- One fact per item. A fact is a specific, checkable claim: a number, a time limit, a place, a role, a condition, a step order or a yes/no rule.
- Skip opinions, motivation and general advice that a source page could not contradict.
- `statement` is the fact as one full sentence, worded as the lesson words it.
- `value` is the shortest part of the statement that would change if the policy changed, for example "30 days", "in any store or by mail", "Tier 2 after two failed fixes".
- `blockId` is the id of the block that teaches the fact. If several blocks teach it, use the first one that is not a quiz.
- `quizQuestionIds` lists every quiz question whose correct answer depends on this fact. Use [] if none.
- `keywords` is 4 to 8 lowercase words someone announcing a change to this fact would likely use. Include synonyms ("refund", "return", "money back").
- Use only what the lesson says. Do not add facts from your own knowledge.

Lesson title: {{lessonTitle}}

Lesson blocks, as `[blockId] (type) text`:
<lesson>
{{lessonBlocks}}
</lesson>

Quiz questions, as `[questionId] (blockId) question → correct answer`:
<quiz>
{{quizQuestions}}
</quiz>
