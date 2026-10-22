# DosPrep

Personal SAT practice with a library of **1,219 unique Hard questions**: **609 Reading and Writing** and **610 Math**, imported from the supplied College Board exports. Math includes 387 multiple-choice and 223 typed-response questions. Four questions from the initial export also appear in the full Reading and Writing export and are deduplicated by question ID.

Website: https://suryamandalapu-boop.github.io/reading-rush/

Practice: https://suryamandalapu-boop.github.io/reading-rush/practice.html

For Firebase/GA4 activation and SEO configuration, see [SETUP.md](SETUP.md). Firebase Authentication is configured for Google and email/password sign-in. Google Analytics is connected through the Firebase-linked GA4 measurement ID and loads only after visitor consent.

## Practice and review

Choose a subject, category, skills, question count, and pace. Sessions use each matching question once. Practice from the full library, previous mistakes, or marked questions; optionally skip previously attempted questions. Typed Math answers accept numbers, decimals, fractions, and equivalent numeric values. Where the official export gives multiple accepted responses, those responses are preserved. Invalid numeric input is rejected.

Incorrect answers do **not** reveal the right answer or highlight the correct choice. Choose **Try again** for another attempt, or **Reveal answer & explanation** when ready. Revealing during a retry lets you continue to the next question. Accuracy and stars retain the first attempt; retries and their outcomes are saved for review. Missed answers also stay hidden in session review until explicitly revealed.

Select passage text with the mouse (or text selection on touch), then choose **Highlight selection**. Highlights persist for each question, including in review. **Clear highlights** removes that question's highlights. Question visuals retain the original PDF typography, equations, and diagrams; the invisible selection layer supports normal PDF text, but equations rendered as graphics cannot be selected. Some source PDF text has imperfect character encoding; the visible question remains the original rendered page.

## Insights and videos

**Category insights** shows accuracy, attempts, average answer time, and timeouts by category, with skill-level summaries and practice shortcuts. Recommendations require at least three attempts in a skill and prioritize lower accuracy, then slower pacing. Repeated attempts count separately. Metrics use your completed sessions, not population benchmarks or SAT score estimates. Old four-question session history is still supported.

Each of the 29 skills has **one to three reusable video lessons**, linked from post-answer feedback, review, and insights. These explain the skill rather than the exact question. Direct YouTube links come from the publisher's [SAT Climb video library](https://satclimb.com/lessons); the per-skill mapping and source lesson URLs are in `app/videos.js`. Third-party videos may change availability. The app does not embed players or send practice history to a video provider.

## Storage and timing

Progress, flags, and highlights stay in this browser's local storage on this origin. Export a backup before clearing browser data or changing browsers. Export/restore includes highlights. Unfinished sessions are not saved if the tab closes; completed and early-ended sessions are saved. The timer waits for initial question images and the opening countdown, continues in the background, and stops for feedback. **Pause** hides the question and stops timing until **Resume** (or Escape). Results time includes retries and excludes pauses and feedback time.

Custom pace targets: Reading and Writing uses 120 / 75 / 45 seconds for Relaxed / Steady / Blitz. Math uses 150 / 95 / 60 seconds. The timer continues into overtime without submitting or locking the question. Correct first responses earn 3 stars in the first third of the target, 2 in the second third, and 1 in the final third. Overtime responses and retries earn zero stars. These are independent rules, not verified OnePrep scoring formulas. Historical timeout records remain supported.

## Local launch

Double-click **Start Reading Rush.cmd** and leave the terminal open. Requires Python. Alternatively run `python -m http.server 8765 --bind 127.0.0.1 --directory app` from this folder, then visit http://127.0.0.1:8765. Local and hosted progress are separate; use export/restore to move progress.

## Community count and timing benchmarks

The homepage and practice setup show a realtime count of recorded first submissions since October 22, 2026. Solo submissions and each player's Live Quiz answers count; retries and replayed uploads do not. Local history from before this feature is never backfilled. Automated QA sets `DOSPREP_TEST_MODE` to avoid adding synthetic traffic to the production counter.

Timing sharing is a separate opt-in preference on the practice setup and Privacy page. `answer-events.js` captures a visible, unpaused clock starting after question images/countdown are ready. Only first submissions can contribute to timing benchmarks, and the database permits at most one timing sample per question per Firebase identity. Previously seen questions in local history and questions first seen with sharing off are excluded from later sampling. Overtime is included; samples outside 1–7,200 seconds are excluded. Live Quiz contributes to the total only, so synchronized/host delays do not distort solo benchmarks.

Question feedback and history review display All/Correct/Incorrect benchmarks after 20 samples in the selected group. A one-second histogram preserves the exact distribution of whole-second recorded times; median and 25th/75th percentiles use linear interpolation, and mean is total seconds divided by sample count. Small eligible samples are labeled early estimates. No individual timing or identity is exposed by the aggregate panels.

Firestore collections are `siteStats/answers` (aggregate total), `answerContributions/{eventId}` (private immutable deduplication markers), `contributors/{uid}` (private current-write pointer), `timingParticipants/{uid}/questions/{questionId}` (private first-seen marker), and `questionStats/{questionId}/groups/{all,correct,incorrect}` (aggregate histogram/sum/count). Batched writes and rules require every total/statistics increment to match one new contribution. Auth identities are opaque guest/account IDs; records contain no names, emails, or answer text. Stored aggregate samples are not automatically removed on opt-out. Unsent timing values are stripped on withdrawal; the offline queue is limited to 100 events and 24 hours. Like any client-measured metric, this is a study benchmark rather than a tamper-proof measurement system.

The existing Enterprise Native database `dosprep-rooms` and standard snapshot listeners serve realtime totals and panels. `node tools/verify-benchmarks.cjs` runs only against the local Auth/Firestore emulators, uses independent test identities, verifies statistics and write rules, and clears only the local emulator's disposable database. Do not run this seeding test against production.

## Live Quiz

Open `live.html` to host or join by a six-character code. Hosts choose Reading and Writing or Math, a category, and 5/10/20 questions. Up to 20 players join with nicknames; the host can spectate or answer too. Joining closes when the quiz starts. Everyone sees the same question, submits one private answer, and automatically sees all answers when everyone submits. Only the author can read a response before reveal, including against direct database requests; the host may explicitly reveal early for absent players. The host advances questions. Correct responses earn 100 points, with no time limit or speed bonus. Numeric answers accept equivalent decimals/fractions.

Rooms use Firebase anonymous or existing account authentication and the Firestore Enterprise Native database `dosprep-rooms` in `us-west1`. Snapshot listeners are necessary for synchronized room updates, so this uses the standard realtime SDK rather than pipelines. Live answers are separate from solo history. Anonymous room identities preserve the existing solo guest progress store. Refreshing reconnects a participant or host; if the host disconnects, players can still finish answering and trigger the reveal, then wait for the host to return and advance. Hosts can reveal early or end a quiz to handle absent participants.

Room access expires after approximately 23 hours. Hosts can delete all documents and answers from a finished room, including rooms ended early. Expiry restricts access and does not erase stored documents automatically. `firestore.rules` defaults to deny, validates bounded documents, restricts host transitions, and requires each immutable response to be written atomically with its public submission status. These prototype rules should be reviewed before broad public use. The public question library already contains answer keys; this is a study game, with no claim to prevent clients inspecting that library.

Deploy backend rules with `firebase deploy --only firestore --project dosprep-study-a7f31`. For a fresh project, create the named database first with `firebase firestore:databases:create dosprep-rooms --edition enterprise --location us-west1 --firestore-data-access ENABLED --mongodb-compatible-data-access DISABLED --realtime-updates ENABLED`; realtime updates must be explicitly enabled at creation. Anonymous auth is declared in `firebase.json`; deploy provider changes with `--only auth`. For local tests, start Auth and Firestore emulators, serve `app/`, and run `node tools/verify-live-quiz.cjs`. The test connects only localhost to emulators and uses separate browser contexts to verify privacy, synchronized rounds, reconnects, grading, and cleanup. Production smoke checks require explicit `LIVE_QUIZ_REAL=1` and `LIVE_QUIZ_URL`; disposable test rooms/accounts are deleted afterward.

## Import more questions

Install dependencies with `python -m pip install pymupdf Pillow`, then run:

```powershell
python tools/import_questions.py "another-export.pdf"
```

Include answers and rationales in the export. The importer merges by ID, preserves diagrams and vector math with rendered WebP assets, and extracts selectable word positions and category metadata. It reads missing answer headers from the official rationale when possible and fails validation if an answer remains unavailable. After importing a different export, inspect the rendered pages to verify layout and metadata. Original PDFs and recordings remain local and are ignored by Git. Source files in `app/` deploy to GitHub Pages on pushes to `main`.

This independent personal study tool is not affiliated with OnePrep, College Board, or video publishers.
