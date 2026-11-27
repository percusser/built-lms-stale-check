# Devpost submission: every field

Draft: https://devpost.com/submit-to/31808-buildhybridai-2026/manage/submissions/1315323/edit

Status I read from the draft on Nov 26:

- Project overview: done (name and elevator pitch are filled in).
- Project details: done (story, built-with tags, 4 links, 9 gallery images, video https://youtu.be/8YTpenTp30E). One fix below.
- Additional info: every field is empty. All answers are below.
- Submit: one checkbox, then the Submit project button.

---

## Step 3: Additional info

### Submitter type (individual, team, organization)

Select: **Individual**

### Submitter country of residence

Select: **United States**

### Organization name (if applicable)

```
Built LMS
```

### What date did you start this project? (MM-DD-YY)

```
11-23-26
```

### Is your project new, or did it exist before Nov 11, 2026

Select: **Existing. This project did exist before Nov 11, 2026**

Why Existing: the rules say an entry that uses an app from before the submission period must say what was built during it. Stale Check reads completions from Built LMS and writes fixes back through the Built LMS API, so it uses an existing app. Stale Check itself is all new.

### If it existed before, explain what already existed and what you built or changed during the submission period.

```
Built LMS, our corporate learning platform, existed before the hackathon. It is pre-launch and has no public usage yet. Stale Check is new: its first commit is November 23, 2026, and everything in the public repository was built during the submission period.

Already in Built LMS before the hackathon:
- The learning platform: courses, lessons, lesson blocks, quizzes, enrollments and completion records.
- The Built LMS API that Stale Check calls to read completions and update lesson blocks.
- AI course generation, which records which source chunks each lesson block came from. This is what lets Stale Check tie a lesson to the exact source page it was built from.

Built during the submission period:
- The Chrome extension (Manifest V3 side panel). It checks source pages on device with Gemini Nano through Firebase AI Logic hybrid inference (PREFER_ON_DEVICE), with cloud fallback to gemini-3.5-flash-lite.
- The iPhone app and share extension. They check shared Slack messages, emails and screenshots on device with Apple Foundation Models and Vision text recognition, with cloud fallback through Firebase AI Logic.
- The trainer dashboard, the public judge view, and the bridge page that gives the extension App Check.
- The draft-fix flow, which uses Gemini through Firebase AI Logic in the cloud to rewrite the lesson block and the quiz questions that tested the old fact.
- The shared prompts, response schemas and verdict checks. A "changed" verdict is rejected unless its quote really appears in the source.
- The sync script that connects the dashboard to a Built LMS tenant.
- Firestore rules and their tests, App Check on web (reCAPTCHA Enterprise) and iOS (App Attest), the demo wiki, and the fictional Returns 101 sample course.
```

### Which Platform(s) did you use to build your project?

Select both: **Web (Chrome)** and **iOS**

### Explain how your project meets the main technology requirement.

```
Stale Check is a Gen AI app built on Firebase AI Logic, with App Check, Firestore, Authentication and Hosting.

Web (Chrome): The Chrome extension checks each fact a lesson teaches against the current source page with Gemini Nano through Firebase AI Logic hybrid inference (getGenerativeModel with InferenceMode.PREFER_ON_DEVICE, in shared/src/firebase-model.js). Answers use structured output: still true, changed or removed, with the new value and the exact quoted sentence. If the laptop cannot run Gemini Nano, or the page is too long for its context window, the same request runs in the cloud on gemini-3.5-flash-lite through the Gemini Developer API. Every result shows an On device or Cloud badge.

iOS: The iPhone app checks shared messages and screenshots on device with the Apple Foundation Models API (LanguageModelSession) and Vision text recognition. When Apple Intelligence is not available, it falls back to the cloud through the Firebase AI Logic iOS SDK (ios/StaleCheck/Checking/FirebaseCloudChecker.swift).

Cloud: Drafting a fix, which rewrites the lesson block and its quiz questions, always runs in the cloud with Gemini through Firebase AI Logic. Checking is frequent and private, so it runs on the device. Rewriting is rare and needs quality, so it runs in the cloud.

Other Firebase products:
- App Check: reCAPTCHA Enterprise for the dashboard and the extension's bridge page, App Attest on iPhone, and limited-use App Check tokens on every Firebase AI Logic call.
- Firestore: stores flags, with rules that let devices create flags but only the course owner read them. The rules have tests.
- Authentication: Google sign-in for the trainer dashboard.
- Hosting: serves the dashboard, the judge view, the bridge page and the demo wiki.
```

### Provide a URL to a working demo, hosted application or test build of your project.

```
https://built-lms-stale-check-572e3.web.app/judge
```

### Testing instructions or credentials the judges need to test your project, if any.

```
No sign-in or credentials are needed. All demo data is fictional (Larkspur Supply Co.).

1. Trainer dashboard: open https://built-lms-stale-check-572e3.web.app/judge. It is a read-only copy of the dashboard with four flags, On device and Cloud badges, the quoted evidence, the learners who completed each lesson while it was wrong, and a sample draft fix.

2. Chrome extension:
   a. Download stale-check-extension-v1.0.0.zip from https://github.com/percusser/built-lms-stale-check/releases/tag/v1.0.0 and unzip it.
   b. Open chrome://extensions, turn on Developer mode, click Load unpacked, and select the unzipped folder.
   c. Open https://built-lms-stale-check-572e3.web.app/wiki/refunds. Legal changed the return window on this page from 30 days to 14 days.
   d. Click the extension's toolbar icon to open the side panel, then click Check this page. It flags the refund window lesson with the proving sentence and an On device or Cloud badge.
   e. Open https://built-lms-stale-check-572e3.web.app/wiki/refunds-reworded. It states the same policy in different words, and it is not flagged.
   On-device checks need Chrome 138 or later and hardware that can run Gemini Nano (22 GB free disk, a GPU with more than 4 GB of VRAM or 16 GB of RAM with 4 or more CPU cores). The first check downloads Gemini Nano (about 4 GB) and the side panel shows progress. On other computers the same check runs in the cloud and shows a Cloud badge.

3. iPhone app: join the TestFlight beta at https://testflight.apple.com/join/BRnk1s3P. Share a Slack message, an email or a screenshot to Stale Check, then open the app to see which lessons it changes. On-device checks need Apple Intelligence (iPhone 15 Pro or later, iOS 26). Other iPhones use the cloud fallback.

Source and setup: https://github.com/percusser/built-lms-stale-check
```

### Provide a URL to your open-source license within your code repository.

```
https://github.com/percusser/built-lms-stale-check/blob/main/LICENSE
```

The repo is public and GitHub detects it as Apache License 2.0, so it shows in the About section.

### The three eligibility checkboxes

Check all three. Only you can confirm them:

- At least the age of majority where you live.
- From an eligible jurisdiction.
- Not an employee, representative or agent of the sponsor or administrator.

Then click **Save & continue**.

---

## Step 1: Project overview (already filled in, no change needed)

Project name:

```
Stale Check by Built LMS
```

Elevator pitch:

```
Catches training that went stale when a policy changes. Gemini Nano in Chrome and Apple on-device AI on iPhone check sources privately; Firebase AI Logic drafts the fix in the cloud.
```

---

## Step 2: Project details (already filled in, one fix)

- About the project: filled in (4,956 characters). No change needed.
- **Built with: fix this.** The last three tags are `built`, `lms` and `api`. They look like "Built LMS API" was split into three tags. Delete those three and add one tag: `built-lms-api`.
- Try it out links (4, all correct):
  - https://built-lms-stale-check-572e3.web.app/judge
  - https://testflight.apple.com/join/BRnk1s3P
  - https://github.com/percusser/built-lms-stale-check/releases/tag/v1.0.0
  - https://github.com/percusser/built-lms-stale-check
- Image gallery: 9 images uploaded. Upload order and captions are the ones I sent earlier; the files are in `docs/devpost-gallery/`.
- Demo video URL: https://youtu.be/8YTpenTp30E. Make sure the YouTube video is Public or Unlisted.

---

## Step 5: Submit

Check "I, and all of my team members, have read and agree to be bound by the Official Rules and the Devpost Terms of Service", then click **Submit project**. You can still edit until Nov 30, 2:00 PM PT.
