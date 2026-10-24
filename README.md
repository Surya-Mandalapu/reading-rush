# DosPrep

Website: **https://dosprep.vercel.app/**. Hosting, free-tier asset limits, browser-data migration, deployment, recovery, and rollback are documented in [HOSTING.md](HOSTING.md). The Firebase project and all backend data remain unchanged.

Personal SAT practice with a library of **3,769 unique questions**: **1,844 Reading and Writing** and **1,925 Math**, imported from the supplied College Board exports. Questions are deduplicated by their College Board IDs, preserving existing practice history and timing benchmarks.

| Subject | Easy | Medium | Hard | Total |
| --- | ---: | ---: | ---: | ---: |
| Reading and Writing | 611 | 624 | 609 | 1,844 |
| Math | 685 | 630 | 610 | 1,925 |

Choose Easy, Medium, Hard, or All in solo practice and Live Quiz. Every imported question includes its original explanation; Math supports both multiple-choice and typed responses.

Website: https://suryamandalapu-boop.github.io/reading-rush/

Practice: https://suryamandalapu-boop.github.io/reading-rush/practice.html

For Firebase/GA4 activation and SEO configuration, see [SETUP.md](SETUP.md). Firebase Authentication is configured for Google and email/password sign-in. Google Analytics is connected through the Firebase-linked GA4 measurement ID and loads only after visitor consent.

## Practice and review

Choose a subject, category, skills, difficulty, question count, and pace. Sessions use each matching question once. Practice from the full library, previous mistakes, or marked questions; optionally skip previously attempted questions. Typed Math answers accept numbers, decimals, fractions, and equivalent numeric values. Where the official export gives multiple accepted responses, those responses are preserved. Invalid numeric input is rejected.

Incorrect answers do **not** reveal the right answer or highlight the correct choice. Choose **Try again** for another attempt, or **Reveal answer & explanation** when ready. Revealing during a retry lets you continue to the next question. Accuracy and stars retain the first attempt; retries and their outcomes are saved for review. Missed answers also stay hidden in session review until explicitly revealed.

Select passage text with the mouse (or text selection on touch), then choose **Highlight selection**. Highlights persist for each question, including in review. **Clear highlights** removes that question's highlights. Question visuals retain the original PDF typography, equations, and diagrams; the invisible selection layer supports normal PDF text, but equations rendered as graphics cannot be selected. Some source PDF text has imperfect character encoding; the visible question remains the original rendered page.

## Insights and videos

**Category insights** shows accuracy, attempts, average answer time, and timeouts by category, with skill-level summaries and practice shortcuts. Recommendations require at least three attempts in a skill and prioritize lower accuracy, then slower pacing. Repeated attempts count separately. Metrics use your saved answers, including partial rounds, not population benchmarks or SAT score estimates. Old four-question session history is still supported.

Each of the 29 skills has **one to three reusable video lessons**, linked from post-answer feedback, review, and insights. These explain the skill rather than the exact question. Direct YouTube links come from the publisher's [SAT Climb video library](https://satclimb.com/lessons); the per-skill mapping and source lesson URLs are in `app/videos.js`. Third-party videos may change availability. The app does not embed players or send practice history to a video provider.

## Storage and timing

Guest progress stays in this browser. Signed-in account history, marked questions, and highlights sync privately to Firestore, with a local copy and a durable pending-edit queue for offline use. Existing account progress migrates automatically; guest data stays separate unless the user selects **Bring guest progress into account**. Each answer and retry saves a partial round, so closing a tab retains answered questions for review. The unanswered question and live timer are not resumed. Finishing updates the same session instead of adding a duplicate. Wait for **Progress synced** before clearing browser data; export/restore remains available as a backup. Restoring while signed in replaces synced progress, including removal markers for excluded records. The timer waits for initial question images and the opening countdown, continues in the background, and stops for feedback. **Pause** hides the question and stops timing until **Resume** (or Escape). Results time includes retries and excludes pauses and feedback time.

Custom pace targets: Reading and Writing uses 120 / 75 / 45 seconds for Relaxed / Steady / Blitz. Math uses 150 / 95 / 60 seconds. The timer continues into overtime without submitting or locking the question. Correct first responses earn 3 stars in the first third of the target, 2 in the second third, and 1 in the final third. Overtime responses and retries earn zero stars. These are independent rules, not verified OnePrep scoring formulas. Historical timeout records remain supported.

## Local launch

Double-click **Start Reading Rush.cmd** and leave the terminal open. Requires Python. Alternatively run `python -m http.server 8765 --bind 127.0.0.1 --directory app` from this folder, then visit http://127.0.0.1:8765. Guest local and hosted progress are separate; use export/restore to move it. Signed-in accounts sync on either origin when the Firebase sign-in domain is authorized.

## Private account synchronization

`cloud-progress.js` listens only to `userProgress/{uid}/records` for a non-anonymous signed-in user. Standard realtime listeners are necessary so edits on another device update local history and pending offline edits reconcile. Sessions merge by ID; bookmarks and highlights use the latest local edit time with a UUID tie-break. A transaction checks the server version before writing, avoiding stale overwrites. Clock skew can affect conflicting edits to the same record. Independent records merge; removed data has a tombstone so stale browsers do not resurrect it. Same-question highlight edits use the latest full selection, rather than merging conflicting removals.

Each record has kind/key, bounded JSON value fragments, part/parts, changedAt/revision, deleted, and updatedAt. Large sessions split at 50,000 Unicode characters and commit atomically; only a complete matching revision is applied. Client validators check reconstructed progress before it enters the app. Rules require account ownership and a non-anonymous provider, exact field schemas, immutable identity fields, bounded values, and a server timestamp. JSON payload values are not indexed. Clean local ledgers keep revision metadata rather than duplicating all history; pending edits retain values until acknowledged. Guest identities used for Live Quiz and community counters cannot read private progress.

Only changed records are written, with a short debounce; timer ticks and unchanged saves produce no cloud writes. Initial sign-in reads the user's existing record fragments, and later snapshots carry changes. This uses the existing free-tier Enterprise database, with no Functions, paid Storage, billing upgrade, or new database. Free quotas are shared with Live Quiz and community statistics; see [Enterprise Native free quotas](https://firebase.google.com/docs/firestore/enterprise/quotas-native-mode). Free usage is bounded and quota errors leave pending changes on the device. Cloud deletion/account deletion controls are not yet provided; clearing browser storage does not delete the cloud account history.

Run `node tools/verify-cloud-progress.cjs` with local Auth/Firestore emulators and the app on port 8876. It refuses production URLs and tests independent browser contexts, account migration, explicit guest import, per-answer/retry checkpoints, concurrent edits, tombstones, offline restart recovery, no echo writes, sessions over 1 MiB, and rule denials for other accounts/anonymous users and malformed updates.

## Community count and timing benchmarks

The homepage and practice setup show a realtime count of recorded submissions since October 22, 2026. Starting October 23, all new submissions, including solo retries and repeat questions, count automatically; replayed uploads never count twice. Earlier browser history is not backfilled. Automated QA sets `DOSPREP_TEST_MODE` to keep synthetic traffic out of production.

Community timing collection is automatic. There is no sharing switch, and previous sharing preferences do not gate new submissions. `answer-events.js` measures a visible, unpaused clock after images/countdown are ready. Every retry gets its own active clock; repeats are included. All submitted answers count, while timings outside 1–7,200 seconds do not enter histograms. Live Quiz measures question-view time before submission, excluding upload delay, and uses separate `liveQuestionStats` aggregates so it does not mix with solo pacing. Google Analytics remains independently opt-in.

`questionStats/{qid}/groups/{all,correct,incorrect}` and the equivalent `liveQuestionStats` store only samples, totalSeconds, bins, and updatedAt. No account identifiers, event references, answer text, or individual timing rows are stored in these aggregates. Whole-second histograms preserve exact median/quartile calculations; personal comparisons appear after 20 samples in the selected group. Samples are attempts, not distinct people. Small samples are labeled early estimates. Private account progress continues to retain the user's own timings for review.

`answerContributions/{hashedEventId}` stores only uid, questionId, mode, eligible, and createdAt for private replay protection; it never stores duration or correctness. `contributors/{uid}` stores a private last-event pointer. Batched writes and rules bind every count increase to a new event and validate the aggregate histogram delta directly, requiring All plus exactly one matching outcome group. Legacy duration/correctness fields were redacted from production duplicate-check records without altering aggregate totals or private progress. Legacy first-seen markers remain private and read-only; repeats are now allowed. Auth still processes identity and service metadata; this is aggregate-only application storage, not a claim that traffic or small aggregate changes cannot be correlated.

The offline queue temporarily retains event timing locally for up to 24 hours and 100 submissions. Backend failures retry when online. An authenticated client can still fabricate its own valid-looking timing; these are study benchmarks, not tamper-proof measurements. Existing private cloud history and optional analytics use their separate privacy rules.

The existing Enterprise Native database `dosprep-rooms` uses standard snapshot listeners because realtime count and threshold updates are required. `node tools/verify-benchmarks.cjs` runs only with local Auth/Firestore emulators and clears only that disposable database. It verifies automatic collection despite old opt-out preferences, retries/repeats, pause/visibility timing, aggregates with no per-account time fields, outcome validation, replay protection, concurrent updates, Live separation, offline delivery, and 20-sample comparisons. Never seed production statistics.

## Practice modules

Open Practice → Practice modules (also available in the sidebar). Both subjects offer Easy + Medium, Module 1, Module 2 Easy, and Module 2 Hard. Reading and Writing sets have 27 questions and a 32-minute active-practice target; Math sets have 22 questions and a 35-minute target. Preset Forms A–C use deterministic seeds and stable question-ID ordering; a fresh randomized set uses a new seed. Every run contains unique question IDs. Presets repeat until their blueprint or question library changes; fresh runs can overlap previous runs. Existing rush filters do not alter module blueprints.

College Board's [structure](https://satsuite.collegeboard.org/sat/whats-on-the-test/structure) and [adaptive scoring description](https://satsuite.collegeboard.org/scores/what-scores-mean/how-scores-calculated) support module sizes, durations, mixed Module 1, and easier/harder Module 2. They do not specify these exact difficulty quotas. DosPrep's approximations (Easy / Medium / Hard) are:

| Practice type | Reading and Writing | Math |
| --- | --- | --- |
| Easy + Medium | 14 / 13 / 0 | 11 / 11 / 0 |
| Module 1 | 9 / 12 / 6 | 7 / 10 / 5 |
| Module 2 Easy | 16 / 9 / 2 | 13 / 8 / 1 |
| Module 2 Hard | 3 / 9 / 15 | 2 / 7 / 13 |

All sets cover four domains: Reading and Writing uses 8 Craft and Structure, 7 Information and Ideas, 7 Standard English Conventions, and 5 Expression of Ideas; Math uses 8 Algebra, 8 Advanced Math, 3 Problem-Solving and Data Analysis, and 3 Geometry and Trigonometry. These category counts are practice targets. Reading and Writing groups similar skills and sorts difficulty within them; Math progresses by difficulty. Sampling fails explicitly rather than silently changing quotas if a bank category is insufficient.

This is learning practice: immediate feedback, retries, explanations, pause, and overtime remain available. The module clock accumulates active question time, including retries, and excludes loading, explicit pauses, and time reviewing between submissions. There is no SAT score prediction or automatic adaptive routing. Module submissions call the normal solo answer recorder, and use existing history, category insights, question/community benchmarks, site-wide totals, and signed-in private cloud progress. History includes module type, form, seed, target, and difficulty blueprint; only submitted answers count. No backend schema or rules changes are required. Run `node tools/verify-modules.cjs` with the Auth/Firestore emulators and a local static server; `MODULE_UNIT_ONLY=1` checks generation without a browser.

## Live Quiz rooms

Open `live.html` to host or join by a six-character code. Hosts choose Reading and Writing or Math, a category, difficulty, and 5/10/20 questions. Up to 20 players join with nicknames; the host can spectate or answer too. Joining closes when the quiz starts. Everyone sees the same question, submits one private answer, and automatically sees all answers when everyone submits or the 100-second deadline arrives. Only the author can read a response before reveal, including against direct database requests; the host may explicitly reveal early for absent players. The host advances questions. Correct responses earn 100 base points plus a linear speed bonus of up to 100: `100 + round(100 × (1 − elapsedMilliseconds / 100000))`. Wrong, missing, and late answers earn zero. Elapsed time uses immutable Firebase server timestamps, from the shared round start to submission; refreshing cannot reset the timer. Each round stores immutable start metadata and a fixed 100-second duration, and rules reject submissions at or after the deadline. Completed legacy untimed rounds keep 100 points per correct response; a legacy active round receives a one-time shared clock, preserving already submitted answers at 100 points. Numeric answers accept equivalent decimals/fractions.

Rooms use Firebase anonymous or existing account authentication and the Firestore Enterprise Native database `dosprep-rooms` in `us-west1`. Snapshot listeners are necessary for synchronized room updates, so this uses the standard realtime SDK rather than pipelines. Live answers are separate from solo history. Anonymous room identities preserve the existing solo guest progress store. Refreshing reconnects a participant or host; if the host disconnects, players can still finish answering or reach the deadline and trigger the reveal, then wait for the host to return and advance. Hosts can reveal early or end a quiz to handle absent participants. Any connected participant can trigger a reveal after the server deadline. If everyone is offline, late answers are still rejected and reconnecting triggers the reveal. This needs no Cloud Functions or billing upgrade. Countdown ticks change only local UI and perform no database writes until a reveal transition is needed.

Room access expires after approximately 23 hours. Hosts can delete all documents and answers from a finished room, including rooms ended early. Expiry restricts access and does not erase stored documents automatically. `firestore.rules` defaults to deny, validates bounded documents, restricts host transitions, and requires each immutable response to be written atomically with its public submission status. These prototype rules should be reviewed before broad public use. The public question library already contains answer keys; this is a study game, with no claim to prevent clients inspecting that library.

Deploy backend rules with `firebase deploy --only firestore --project dosprep-study-a7f31`. For a fresh project, create the named database first with `firebase firestore:databases:create dosprep-rooms --edition enterprise --location us-west1 --firestore-data-access ENABLED --mongodb-compatible-data-access DISABLED --realtime-updates ENABLED`; realtime updates must be explicitly enabled at creation. Anonymous auth is declared in `firebase.json`; deploy provider changes with `--only auth`. For local tests, start Auth and Firestore emulators, serve `app/`, and run `node tools/verify-live-quiz.cjs`. The test connects only localhost to emulators and uses separate browser contexts to verify privacy, synchronized rounds, reconnects, grading, speed scoring, deadline enforcement, reveal with an offline host, and cleanup. `node tools/verify-live-points.cjs` checks score boundaries and legacy scoring. Production smoke checks require explicit `LIVE_QUIZ_REAL=1` and `LIVE_QUIZ_URL`; disposable test rooms/accounts are deleted afterward.

## Import more questions

Install dependencies with `python -m pip install pymupdf Pillow`, then run:

```powershell
python tools/import_questions.py "another-export.pdf"
```

Include answers and rationales in the export. The importer merges by ID, preserves diagrams and vector math with rendered WebP assets, and extracts selectable word positions and category metadata. It reads missing answer headers from the official rationale when possible and fails validation if an answer remains unavailable. The Easy Reading and Writing export prints question `e3bbf2bf`'s fourth option as an unlabeled bullet; the importer separates it as D based on its order and the official Choice D rationale. Image rendering stays on the main thread while independent WebP encoding jobs run in parallel. After importing a different export, inspect the rendered pages to verify layout and metadata. Original PDFs and recordings remain local and are ignored by Git. Source files in `app/` deploy to GitHub Pages on pushes to `main`.

This independent personal study tool is not affiliated with OnePrep, College Board, or video publishers.
