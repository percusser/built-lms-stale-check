# Built LMS Stale Training Detector

Training is right on the day it is published. A few months later the refund window changes, the escalation process gets rewritten, a menu gets renamed, and the course keeps teaching the old version. Nobody notices until a new hire repeats the old answer to a customer.

This project catches that moment. When a source that a Built LMS course was built from changes, it flags the lesson that now teaches something untrue, shows the sentence that proves it, lists who learned the old version, and drafts the corrected lesson for the trainer to approve.

It has four parts: a Chrome extension, an iPhone app with a share extension, a web dashboard for the trainer, and a small sync script that connects the dashboard to a Built LMS tenant.

## Try it

All three parts run against our hosted Firebase project with fictional demo data. You do not need to build anything.

### Trainer dashboard (judge view)

Open https://built-lms-stale-check-572e3.web.app/judge. No sign-in is needed.

It is a read-only copy of the trainer dashboard with the fictional Larkspur Supply Co. data: four flags with On device and Cloud badges, the quoted sentence that proves each change, the people who completed the lesson while it taught the old version, and a sample draft fix for the refund window flag. Approving, dismissing and editing are turned off. The live dashboard at https://built-lms-stale-check-572e3.web.app/ needs the course owner's Google sign-in.

### Chrome extension

1. Download `stale-check-extension-v1.0.0.zip` from the [v1.0.0 release](https://github.com/percusser/built-lms-stale-check/releases/tag/v1.0.0) and unzip it.
2. In Chrome, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select the unzipped folder.
3. Open https://built-lms-stale-check-572e3.web.app/wiki/refunds, the hosted demo wiki. Legal has changed the return window on this page from 30 days to 14 days.
4. Click the extension's toolbar icon to open the side panel, then click **Check this page**. The side panel flags the refund window lesson and shows the sentence that proves the change, with an On device or Cloud badge.
5. To see that rewording is not flagged, open https://built-lms-stale-check-572e3.web.app/wiki/refunds-reworded. It says the same policy in different words. The exchanges and escalation pages in the wiki have not changed.

The zip is already set up for our Firebase project. It holds no keys: its cloud calls go through the hosted bridge page, which is protected by App Check. Flags you create go to the project's flag collection, which only the course owner can read.

**Gemini Nano requirements.** On-device checks use Gemini Nano through Chrome's built-in Prompt API. You need:

- Chrome 138 or later on Windows 10 or 11, macOS 13 or later, Linux, or ChromeOS on a Chromebook Plus.
- At least 22 GB of free space on the drive that holds your Chrome profile.
- A GPU with more than 4 GB of VRAM, or a CPU with 16 GB of RAM and 4 or more cores.
- An unmetered network connection for the first download.

The first time you check a page, Chrome downloads Gemini Nano, which is roughly 4 GB. The side panel shows the download progress. If your computer cannot run Gemini Nano, or the download has not finished, the same check runs in the cloud and the result shows a Cloud badge.

### iPhone app

Join the TestFlight beta at https://testflight.apple.com/join/BRnk1s3P. On-device checks need an iPhone with Apple Intelligence turned on (iPhone 15 Pro or later, iOS 26). On other iPhones the check runs in the cloud. Share a Slack message, an email or a screenshot to Stale Check, then open the app to see which lessons it changes.

## Built during the hackathon

Built LMS is our existing corporate learning platform. Everything in this repository was built during #BuildHybridAI, starting November 23, 2026.

**New for the hackathon:**

- The Chrome extension, with on-device fact checks through Gemini Nano and the cloud fallback through Firebase AI Logic.
- The iPhone app and share extension, with on-device checks through Apple Foundation Models, Vision text recognition and the cloud fallback.
- The trainer dashboard, the judge view, and the bridge page that gives the extension App Check.
- The draft-fix flow that rewrites a lesson block and its quiz questions with Gemini.
- The shared prompts, response schemas and verdict checks that reject a "changed" verdict without a real quote.
- The sync script that reads completions from Built LMS and writes approved fixes back through its API.
- The Firestore rules and their tests, the demo wiki, and the Returns 101 sample course.

**Already in Built LMS before the hackathon:**

- The learning platform itself: courses, lessons, lesson blocks, quizzes, enrollments and completion records.
- The Built LMS API that the sync script calls to read completions and update lesson blocks.
- AI course generation, which records which source chunks each generated lesson block came from.

## The hybrid design

The checking is constant, so it runs on the device. The rewriting is rare and needs quality, so it runs in the cloud. Every result carries an On device or Cloud badge so you can see which one ran.

- **Chrome.** The extension checks pages with Gemini Nano through Firebase AI Logic hybrid inference (`InferenceMode.PREFER_ON_DEVICE`). If the laptop cannot run Gemini Nano, or the page is too long for its context window, the same request goes to the cloud model instead (`gemini-3.5-flash-lite` through the Gemini Developer API).
- **iPhone.** The app checks shared messages with Apple's on-device Foundation Models. It narrows the organization's lesson facts to the closest matches first so the prompt fits the on-device limit. If the on-device model is not available, the check falls back to the same cloud model through Firebase AI Logic.
- **Cloud.** Drafting a fix, which rewrites a lesson block and the quiz questions that tested the old fact, always runs in the cloud.

Page text and shared messages are checked on the device whenever the device can run the model. When it cannot, the text goes to the cloud model for that one check, and the result is marked Cloud. Only the matched fact and the single quoted sentence that proves the change are saved as a flag. The extension reads pages only on the domains listed in its manifest.

A small model can mistake rewording for a change, so the verdict is not taken on trust. A "changed" verdict is accepted only when it names a different value and its quote really appears in the page or message, and a "removed" verdict is rejected when the old value is still on the page. The demo wiki includes a reworded version of the refund policy to test exactly that.

## App Check

Calls to Firebase AI Logic and Firestore carry an App Check token, so only the real apps can use the project's model quota and data.

- **Web.** The dashboard and the bridge page use reCAPTCHA Enterprise.
- **iPhone.** The app uses App Attest. Share extensions cannot use App Attest, so the share extension only saves the shared item to the app group, and the app runs the check when it opens.
- **Chrome extension.** App Check has no documented provider for extensions, so the extension runs its cloud calls through the bridge, a page on Firebase Hosting that holds the reCAPTCHA Enterprise provider. The extension talks to it through a hidden frame, and the bridge accepts messages only from the extension IDs in its config.
- **Development.** Debug tokens are used only in development builds. The iPhone Release build does not include one.

The dashboard also requires Google sign-in. Firestore rules let devices create new flags without signing in, but reading flags, approving fixes and reading learner records are limited to the course owner's verified Google account.

## How it works

1. **Facts.** Each lesson block in the sample course is tied to the specific facts it teaches, such as "refunds are accepted within 30 days" or "escalate to Tier 2 after two failed fixes", and to the source page it came from. Built LMS already records which source chunks each AI-generated block came from, which is what makes that tie exact. In this repository the facts for the sample course are listed in `shared/fixtures/returns-101/facts.golden.json`, and the cloud extraction prompt that produces them is checked against that list.
2. **Watch (Chrome, on device).** When someone with the extension opens one of those source pages, the side panel reads the page text and checks whether it changed since the last check. If it did, Gemini Nano checks each fact tied to that page and answers with structured output: still true, changed or removed, with the new value and the exact sentence that shows it.
3. **Catch announcements (iPhone, on device).** Many changes arrive as a Slack message or an email before anyone updates a document. Share the message, or a screenshot of it, to Stale Check. The phone reads the text (Vision text recognition for screenshots), checks it against the lesson facts cached on the phone, and says which lessons it changes before anything is sent.
4. **Review (dashboard).** The trainer sees every flag with its evidence, where it came from (Chrome or iPhone), and the people who completed that lesson while it taught the old version.
5. **Fix (cloud).** Draft fix sends the old fact, the quote and the lesson block to Gemini, which rewrites the block and the quiz questions that tested the old fact. The trainer compares them side by side and approves.
6. **Write back (sync).** The sync script picks up approved fixes, shows the before and after, and after you confirm, writes the fix to the lesson in Built LMS through its API. A correction notice for the affected learners is drafted with the fix; sending it is not connected yet.

## Architecture

| Folder | What is in it |
| --- | --- |
| `extension/` | Chrome extension (Manifest V3, side panel). Reads allowed pages, detects changes, checks facts on device, and saves flags. |
| `ios/` | iPhone app and share extension (SwiftUI, Firebase iOS SDK, Foundation Models, Vision text recognition). |
| `dashboard/` | The trainer's web app and the extension's bridge page, both on Firebase Hosting. |
| `sync/` | A local Node script that reads lesson completions from Built LMS and writes approved fixes back. The Built LMS API key stays on your machine. |
| `shared/` | Prompts, JSON response schemas, the verdict checks every client shares, and the Returns 101 sample course. |
| `demo-wiki/` | The small fictional support wiki the sample course is built from. |
| `firestore.rules` | Who can read and write flags, learners and completions. Tested in `test/firestore.rules.test.mjs`. |

The response schemas use a small subset of JSON Schema, so the same schema works as a cloud `responseSchema`, as Chrome's `responseConstraint`, and as a Swift `@Generable` type.

## Demo data

The demo uses Larkspur Supply Co., a fictional outdoor retailer, and its four-lesson course, Returns 101. The people, policies and wiki pages are made up. No real customer or company data is in this repository.

## Setup

You need Node.js 20 or later and the Firebase CLI. For the iPhone app you need Xcode and an iPhone with Apple Intelligence.

### 1. Try the sample data

```bash
npm install
npm run check:fixtures
npm run wiki
```

The wiki runs on `http://localhost:5050`. Opening `http://localhost:5050/__state/v2` switches to the refund policy after Legal changes the window from 30 to 14 days, `/__state/reworded` shows the same policy in different words, and `/__state/v1` switches back.

### 2. Create a Firebase project

1. Create a Firebase project and add a web app and an iOS app (bundle ID `com.builtlms.stalecheck`).
2. Turn on Firebase AI Logic with the Gemini Developer API.
3. Turn on Firestore, and Authentication with the Google provider.
4. In App Check, register the web app with reCAPTCHA Enterprise and the iOS app with App Attest.
5. Deploy the hosting and the rules:

```bash
npx firebase deploy --only hosting,firestore:rules --project <your-project-id>
```

The judge view at `/judge` reads fictional demo data from the `demo/larkspur` collection, which anyone can read and nobody can write. To fill it in your own project, run `npm run seed:demo --workspace sync`, which copies `dashboard/src/data/sample.js` there with your Google login.

### 3. Configure the web clients

Copy `firebase-config.example.json` to `firebase-config.local.json` and fill in the web app's config, the reCAPTCHA Enterprise site key, and the bridge URL (`https://<your-project-id>.web.app/bridge`). For local development, register a debug token in the App Check console and put it in `appCheckDebugToken`. This file is ignored by git.

The admin email in `dashboard/src/firebase.js`, `sync/src/sync.mjs` and `firestore.rules` is the course owner who can sign in to the dashboard. Change it to your own Google account.

### 4. Build the extension and the dashboard

```bash
npm run build --workspace extension
npm run build --workspace dashboard
```

Load `extension/dist` as an unpacked extension in Chrome and open the side panel on a demo wiki page. When `bridgeUrl` is set, the build also allows the hosted demo wiki at `https://<your-project-id>.web.app/wiki/`, which the dashboard build copies from `demo-wiki/` with the 14-day refund policy as the current page. To watch other sites, add them to `host_permissions` and `content_scripts` in `extension/static/manifest.json`. On-device checks need Chrome 138 or later on a laptop that meets Gemini Nano's hardware requirements; without them, checks go to the cloud.

### 5. Build the iPhone app

Download `GoogleService-Info.plist` for the iOS app, put it in `ios/StaleCheck/`, open `ios/StaleCheck.xcodeproj`, set your team, and run on a device. Development builds use an App Check debug token, which you register in the App Check console.

### 6. Connect a Built LMS tenant (optional)

The dashboard works with the sample data alone. To read real completions and write approved fixes to a Built LMS course, follow `sync/README.md`.

### 7. Run the rules tests

```bash
npm run test:rules
```

This starts the Firestore emulator, which needs Java.

## License

Apache License 2.0. See [LICENSE](LICENSE).
