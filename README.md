# Reading Rush

A local SAT Reading and Writing practice app. Double-click **Start Reading Rush.cmd**, leave its terminal running, and open http://127.0.0.1:8765. Close the terminal to stop the server. Requires Python (already installed on this computer). You can also open `app/index.html` directly, but use the launcher consistently so saved progress stays under the same browser origin.

Includes four official questions from the supplied PDF: f1bfbed3 (B), a15b3219 (B), ed314256 (C), and 2903668a (D). All are Hard, Information and Ideas. The app caps each round at the number of unique matching questions. No questions are invented or repeated to fill a longer session.

Features: skill and difficulty filters, previous-mistake and flagged-question pools, optional exclusion of attempted questions, randomized rounds, three timer settings, answer elimination, checking, stars, streaks, marking questions, results charts, original explanations, history, and progress export/restore.

Progress is saved in this browser's local storage. It is not synced between browsers or computers. Export a backup before clearing browser data. An unfinished session is not saved if the tab closes; completed and early-ended sessions are saved. The timer continues when the tab is in the background. Timeout records a zero-star incorrect answer; explanation and feedback time do not count toward question time. Results time sums time spent answering questions. Analytics reflect only your attempts; no population averages are fabricated.

Pace settings are original to this reconstruction: Relaxed 120 seconds, Steady 75 seconds, Blitz 45 seconds. A correct answer earns 3 stars in the first third of the allowance, 2 in the second third, and 1 in the final third. These are not verified OnePrep timer/scoring formulas.

Question text, choices, graph, and rationales are rendered from the supplied PDF to preserve its original appearance. They are images, so text selection and full screen-reader reading are not supported. Layout adapts to mobile, but long PDF lines may need browser zoom. Fonts fall back to system fonts offline. No OnePrep backend or login is required.

## Add more official questions

Save another College Board question-bank PDF export **including answers and rationales** in this folder, then run:

```powershell
python tools/import_questions.py "new-export.pdf"
```

The importer requires PyMuPDF (`python -m pip install pymupdf`). It merges questions by question ID. It supports the layout in the supplied export, including page continuations. Check imported pages visually after adding a new export; other export layouts may require adjustments. Reload the app after importing. Keep your original PDF files. Content remains for your personal study use.

This is an independent personal study tool, not affiliated with OnePrep or College Board.
