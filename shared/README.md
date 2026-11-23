# Shared

Everything the extension, the iPhone app and the dashboard agree on.

## Prompts and schemas

| Job | Runs | Prompt | Response schema |
| --- | --- | --- | --- |
| List the facts a lesson teaches | Cloud, once per course | `prompts/extract-facts.md` | `schemas/extract-facts.response.schema.json` |
| Check one fact against a page | Chrome, on device first | `prompts/check-page.md` | `schemas/check-page.response.schema.json` |
| Check a shared message against about 15 facts | iPhone, on device first | `prompts/check-message.md` | `schemas/check-message.response.schema.json` |
| Draft the corrected lesson and quiz | Cloud | `prompts/draft-fix.md` | `schemas/draft-fix.response.schema.json` |

The response schemas use only `type`, `properties`, `required`, `items` and `enum`, so the same schema works as a cloud `responseSchema`, as Chrome's `responseConstraint` and as a Swift `@Generable` type. Empty strings stand in for missing values instead of nullable fields.

A `changed` verdict is only accepted when it names a different value and its quote appears in the page or message text. A `removed` verdict is rejected when the fact's value still appears on the page. `acceptPageVerdict` and `verifyQuote` in `src/index.js` enforce both in code rather than trusting the model. The check-page schema lists `quote` first so the model picks its evidence before it picks a verdict.

`fact.schema.json` describes a stored fact. The model returns only `blockId`, `statement`, `value`, `keywords` and `quizQuestionIds`; the course, lesson and source URL are filled in by code from the course data, never by the model.

## Firestore layout

```
orgs/{orgId}/courses/{courseId}              title, builtLmsCourseId, sources
orgs/{orgId}/courses/{courseId}/facts/{id}   a stored fact (fact.schema.json)
orgs/{orgId}/pages/{urlHash}                 url, textHash, checkedAt
orgs/{orgId}/flags/{flagId}                  factId, courseId, verdict, oldValue, newValue, quote,
                                             origin (extension | iphone), inferenceSource (ON_DEVICE | IN_CLOUD),
                                             status (open | confirmed | dismissed | fixed), createdAt, createdBy
orgs/{orgId}/drafts/{flagId}                 the draft-fix response and its review status
```

## Sample course

`fixtures/returns-101/` is a four-lesson course modeled on what the Built LMS API returns from `GET /api/v1/modules/{id}/blocks`: one file per lesson, each `{ data: [{ block_id, type, props, location }], meta: { total } }`. `source-map.json` stands in for Built LMS source tracking and maps each block to the wiki page it came from. `facts.golden.json` is the hand-checked list of facts the extraction prompt should find, and `fixtures/messages.json` holds sample Slack and email messages for the phone check, with the expected result for each.

Note that the Built LMS API hides quiz answer keys from callers without course edit access, so the API key used for fact extraction needs that access.

`shared/scripts/generate-returns-101.mjs` regenerates it. `npm run check:fixtures` from the repository root checks that all of these agree with each other and with the demo wiki.
