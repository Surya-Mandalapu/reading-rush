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

## Import more questions

Install dependencies with `python -m pip install pymupdf Pillow`, then run:

```powershell
python tools/import_questions.py "another-export.pdf"
```

Include answers and rationales in the export. The importer merges by ID, preserves diagrams and vector math with rendered WebP assets, and extracts selectable word positions and category metadata. It reads missing answer headers from the official rationale when possible and fails validation if an answer remains unavailable. After importing a different export, inspect the rendered pages to verify layout and metadata. Original PDFs and recordings remain local and are ignored by Git. Source files in `app/` deploy to GitHub Pages on pushes to `main`.

This independent personal study tool is not affiliated with OnePrep, College Board, or video publishers.
