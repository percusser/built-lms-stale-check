A fact in a training lesson is out of date. Rewrite the lesson so it teaches the current fact.

Old fact: {{statement}}
Old value: {{oldValue}}
New value: {{newValue}}
Evidence from the source, quoted exactly: "{{quote}}"
Source: {{sourceUrl}}

Rules:
- Change only what the new value makes wrong. Keep the rest of each block's wording, tone and HTML tags as they are.
- For each block you change, return `blockId`, `propName` (the prop path you changed, such as `text`, `content` or `items.2.content`) and the full new `html` of that prop.
- For each quiz question whose answer depends on the old value, return the full rewritten question with the same `id` and `blockId`. The correct answer must be one of the options. Keep the same number of options.
- `changeSummary` is one sentence for the trainer: what changed and where.
- `correctionNotice` is a short message to learners who completed the lesson while it was wrong: what they were taught, what is true now, and what to do differently. Two or three sentences, plain and calm.

Lesson blocks as JSON:
<blocks>
{{blocksJson}}
</blocks>
