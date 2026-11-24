# Demo video script

Three minutes. The story is one policy change going stale and getting caught the same day, once in Chrome and once on an iPhone, then fixed in the Built LMS course.

All data is fictional: Larkspur Supply Co., an outdoor retailer, and its course Returns 101. The course lives on the Built LMS staging tenant.

## Before recording

- Demo wiki running (`npm run wiki`) and set to v1 (`http://localhost:5050/__state/v1`).
- Chrome with the extension loaded, Gemini Nano downloaded, and the side panel closed.
- The dashboard open in a second Chrome window, signed in as the course owner, with no open flags left from rehearsals.
- iPhone with Stale Check installed from TestFlight, screen recording on, and the team announcements page open in Safari holding the Legal message: "From Dec 1, exchanges are in-store only. We're retiring the prepaid mail label for exchanges."
- A terminal in the repository root, ready to run `npm run sync --workspace sync -- fixes`.
- The Returns 101 course open on Built LMS staging in a third tab, on Lesson 2: Refunds.

## Shots

| Time | Shot | On screen | Voiceover |
| --- | --- | --- | --- |
| 0:00 | Title card | "Your training was right the day you published it." | A new support rep tells a customer they have 30 days to return an item. The policy changed to 14 days last month. The course was right when it was written. Nobody told it. |
| 0:15 | Built LMS course | Returns 101, Lesson 2: Refunds, showing "within 30 days". | This is the Returns 101 course in Built LMS. Every lesson was built from a page in the company wiki, and each lesson block is tied to the facts it teaches and the page they came from. |
| 0:30 | Wiki edit | The Larkspur refund policy page. Switch to v2 so it reads 14 days. | Legal updates the refund policy in the wiki. They don't tell the training team. They don't have to. |
| 0:45 | Chrome catch | A support lead opens the refund page for an unrelated reason. Open the side panel. It turns amber with the On device badge: Lesson 2 teaches 30 days, the page now says 14 days, with the quoted sentence. | Later, someone opens that page for an unrelated reason. Gemini Nano, running in Chrome on this laptop, checks the page against what the lessons teach. It found the change, it quotes the sentence that proves it, and the page never left the laptop. |
| 1:05 | Reworded check (quick) | Switch the wiki to reworded and reload. The panel stays green. | Rewording alone isn't a change. A changed verdict only counts when the quote is really on the page and the value is really different. |
| 1:15 | iPhone share | The Legal message on the team announcements page. Select it, Share, Stale Check, "Saved for checking". Open the app. Result shows On device, Lesson 3: Exchanges, the quoted sentence, and "Sent to the dashboard for review." appears on its own. | Some changes never touch a document. Legal sends a message. Share it to Stale Check. Apple's on-device model checks it against the lesson facts cached on the phone and says which lesson it changes before anything is sent. Only the fact and the one quoted sentence go to the dashboard. |
| 1:45 | Dashboard list | Flagged training: two open flags, one from Chrome, one from iPhone, each with its badge. | Both land in the trainer's dashboard, one from the laptop and one from the phone. |
| 1:55 | Who trained on it | Open the refund flag. Evidence, Where the lesson teaches it, and People trained on the old version, listing the learners from the staging tenant. | And here's the part no LMS tells you: everyone who completed this lesson while it was wrong. |
| 2:10 | Draft fix | Click Draft fix. The cloud rewrites the lesson block and the quiz question side by side, with a correction notice for those learners. Click Approve fix and correction. | Draft fix goes to Gemini in the cloud, because rewriting is rare and quality matters. It rewrites the lesson block and the quiz question that tested the old answer. The trainer reviews it and approves. |
| 2:30 | Write to Built LMS | Terminal: run the sync. It shows the before and after, answer y. Then the Built LMS staging tab: reload Lesson 2, which now says 14 days. The dashboard flag shows Lesson corrected. | A small sync script writes the approved fix to the course in Built LMS through its API. Reload the lesson, and it teaches 14 days. |
| 2:45 | Under the hood | Split screen: the On device and Cloud badges, and the Firebase AI Logic and App Check names. | Checking runs on the device because it's constant and private. Rewriting runs in the cloud. Firebase AI Logic routes between them, and App Check makes sure only the real apps can call it. |
| 2:55 | Close | Built LMS logo. "Your training is only as good as it is current." | Your training is only as good as it is current. |

## Notes

- The correction notice is drafted and shown, but sending it to learners is not connected yet. Do not show a notification arriving on a learner's phone.
- If Gemini Nano is not ready on the recording laptop, the panel shows the Cloud badge instead. Re-record the Chrome shot rather than narrate over a Cloud badge.
- Reset between takes: switch the wiki back to v1, and dismiss or delete the rehearsal flags in the dashboard.
