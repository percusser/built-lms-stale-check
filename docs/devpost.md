# Built LMS Stale Training Detector

## Inspiration

Corporate training goes out of date quietly. A course is accurate on the day it is published, and then the refund window changes, an escalation step gets rewritten, or a product menu gets renamed. The course keeps teaching the old version, and nobody finds out until a new hire repeats the old answer to a customer. We build Built LMS, a corporate learning platform, and our customers kept telling us that keeping courses current was harder than writing them in the first place.

The changes themselves are rarely hidden. They show up in a wiki edit or a message from Legal. What is missing is something that connects that change to the lesson that now teaches something untrue.

## What it does

Stale Check watches for the moment a source changes and tells the trainer which lesson is now wrong. It shows the sentence that proves the change, lists the people who completed the lesson while it taught the old version, and drafts the corrected lesson and quiz question for the trainer to approve. After approval, the fix is written back to the course in Built LMS.

Changes can come from two places. In Chrome, a side panel checks a source page whenever someone opens it. On iPhone, anyone can share a chat message, an email or a screenshot to the Stale Check app, which checks it against the lesson facts cached on the phone. Both send their findings to a web dashboard where the trainer reviews them.

## How we built it

The design follows one rule. Checking happens constantly, so it runs on the device. Rewriting happens rarely and needs quality, so it runs in the cloud.

The Chrome extension uses Firebase AI Logic hybrid inference with `PREFER_ON_DEVICE`, so checks run on Gemini Nano in the browser and fall back to Gemini 3.5 Flash-Lite in the cloud when the laptop cannot run Nano or the page is too long. The iPhone app uses Apple's on-device Foundation Models and narrows the lesson facts to the closest matches first so the prompt fits the on-device context. When the on-device model is unavailable or refuses a message, the same check goes to the cloud model through Firebase AI Logic. Drafting a fix always runs in the cloud. Every result carries an On device or Cloud badge, so you can always see which model answered.

The response schemas use a small subset of JSON Schema, so a single schema works as a cloud `responseSchema`, as Chrome's `responseConstraint`, and as a Swift `@Generable` type. App Check protects every call: reCAPTCHA Enterprise on the web, App Attest on iPhone, and a bridge page on Firebase Hosting for the extension, since App Check has no provider for extensions. Flags live in Firestore, and the rules limit reading and approving to the course owner's Google account.

A small Node sync script connects the dashboard to a Built LMS tenant. It reads lesson completions and writes approved fixes back through the Built LMS API, and the API key never leaves the trainer's machine.

## Challenges we ran into

Small models mistake rewording for a change. If the wiki says "you have two weeks" instead of "14 days", a naive check flags it. We stopped taking the verdict on trust. A "changed" verdict now counts only when it names a different value and its quote really appears in the page or message, and a "removed" verdict is rejected when the old value is still there. The demo wiki includes a reworded copy of the refund policy to test exactly that.

The on-device context limit was the other constraint. A whole course does not fit in a Foundation Models prompt, so the iPhone app ranks the lesson facts against the message and sends only the closest ones.

Share extensions on iOS cannot use App Attest, so the extension only saves the shared item, and the app runs the check when it opens.

## Accomplishments that we're proud of

The private case and the fast case are the same case. A support lead opening a wiki page or sharing a message gets an answer in seconds, and the page or message never leaves the device. Only the matched fact and the one quoted sentence are saved.

We are also proud of the "who trained on it" view. Most learning platforms can tell you who completed a course. This one tells you who learned something that is no longer true.

## What we learned

Hybrid inference is most useful when the split follows the work and not the model. Deciding what has to be private and constant, and what can be slow and careful, made every later choice easier. We also learned that small on-device models are dependable when the output is checked against the source, and much less so when it is not.

## What's next for Built LMS Stale Training Detector

Sending the correction notice to affected learners is drafted but not connected yet. After that, we want the facts for every course to come straight from Built LMS, which already records the source chunks each AI-generated lesson block came from, so any customer can turn this on without preparing anything.

## Built with

Firebase AI Logic, Gemini Nano, Gemini 3.5 Flash-Lite, Apple Foundation Models, Vision, SwiftUI, Chrome Extensions (Manifest V3), Firestore, Firebase Authentication, Firebase App Check, reCAPTCHA Enterprise, App Attest, Firebase Hosting, Node.js, Built LMS API.

## Try it

- Source code: https://github.com/percusser/built-lms-stale-check
- iPhone app on TestFlight: https://testflight.apple.com/join/BRnk1s3P
