# Built LMS Stale Training Detector

Training is right on the day it is published. A few months later the refund window changes, the escalation process gets rewritten, a menu gets renamed, and the course keeps teaching the old version. Nobody notices until a new hire repeats the old answer to a customer.

This project catches that moment. It is a Chrome extension, an iPhone app and a small web dashboard that work with Built LMS courses. All three use Firebase AI Logic hybrid inference: the frequent, private checking runs on the device, and the rare, heavy writing runs in the cloud.

## How it works

1. **Connect a course (cloud, once).** The trainer picks a Built LMS course and links each lesson to the page it was built from. Gemini lists the specific facts each lesson block teaches, such as "refunds within 30 days" or "escalate to Tier 2 after two failed fixes", and ties every fact to its block, its quiz questions and its source page.
2. **Watch (Chrome, on device).** When anyone with the extension opens one of those source pages, the side panel reads the page text and checks whether it changed. If it did, Gemini Nano checks each fact tied to that page and answers with structured output: still true, changed or removed, with the new value and the exact sentence that shows it. Pages too long for the on-device model, and laptops without Gemini Nano, fall back to the cloud, and every result shows a badge saying which one ran.
3. **Catch announcements (iPhone, on device).** Many changes arrive as a Slack message or an email before anyone updates a document. Share the message, or a screenshot of it, to the app. Apple's on-device model checks it against the lesson facts cached on the phone and says which lessons it changes before anything is sent.
4. **Fix (cloud).** The dashboard lists every flagged fact with its evidence. Draft fix sends the old fact, the quote and the lesson block to Gemini, which rewrites the block and the quiz questions that tested the old fact. The trainer compares them side by side and approves.
5. **Correct the people.** The dashboard shows how many learners completed the lesson while it was wrong and sends them a short correction.

## Repository layout

| Folder | What is in it |
| --- | --- |
| `shared/` | Prompts, JSON schemas, the helpers every client shares, and the Returns 101 sample course |
| `extension/` | Chrome extension (Manifest V3, side panel) |
| `ios/` | iPhone app and share extension (SwiftUI) |
| `dashboard/` | Trainer dashboard (web, Firebase Hosting) |
| `demo-wiki/` | A small fictional support wiki that the sample course is built from |

## Try the sample data

You need Node.js 20 or later.

```bash
npm run check:fixtures
npm run wiki
```

The second command serves the demo wiki on `http://localhost:5050`. Start it with `WIKI_STATE=v2` to see the refund policy after Legal changes the window from 30 to 14 days, or with `WIKI_STATE=reworded` to see the same policy reworded with no change in meaning. The reworded version is there to test that rewording alone does not get flagged. While the wiki is running, opening `http://localhost:5050/__state/v2`, `/__state/reworded` or `/__state/v1` switches versions without a restart.

## Privacy

Page text and shared messages are checked on the device whenever the device can run the model. When it cannot, the text goes to the cloud model for that one check, and the result is marked Cloud. Only the matched fact and the single quoted sentence that proves the change are sent to the dashboard. The extension reads pages only on domains the trainer allows.

## License

Apache License 2.0. See [LICENSE](LICENSE).
