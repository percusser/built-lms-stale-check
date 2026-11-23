# Sync

A local script that connects the dashboard to a Built LMS tenant. It runs on your own machine, so the Built LMS API key never reaches the browser or the repo.

It does two things:

- **completions** reads who finished each lesson of Returns 101 from Built LMS and writes it to Firestore. The dashboard uses this for "People trained on the old version".
- **fixes** finds flags you approved in the dashboard, checks each fix, shows you the before and after, and writes it to the lesson in Built LMS when you confirm. The flag is then marked fixed.

## Setup

Two files in the repo root, both ignored by git:

- `builtlms-staging.local.json` with `host` and `apiKey` (a Built LMS API key with `courses:read`, `courses:write` and `enrollments:read`).
- `staging-map.local.json` mapping the fixture module and block IDs to the ones in your tenant.

Firestore access uses your Google login: run `gcloud auth application-default login` once.

## Run

```bash
npm run sync --workspace sync
npm run sync --workspace sync -- completions
npm run sync --workspace sync -- fixes --dry-run
```

`--dry-run` prints what would change and writes nothing. `--yes` skips the confirmation.

A fix can only touch blocks in the map, only the text props of paragraph, callout, heading and list blocks, and only existing quiz questions. HTML is reduced to paragraphs, lists, bold, italic and line breaks.
