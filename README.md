# VFS QA Tool

A static GitHub Pages web app for QA sampling VFS workbook tasks.

## What it does

- Upload a VFS CSV or Excel workbook in the browser.
- Uses row 3 as the default task header row and row 4 onward as task data.
- Auto-detects the header row if the configured row does not contain the expected columns.
- Filters QA candidates to rows where:
  - `AGENT` is populated.
  - `STATUS` is `Done` or `Skipped`.
- Keeps skipped tasks in the QA sample.
- Builds the VFS page link from `VENUE_ID` and `VENUE_CONFIG_ID`.
- Generates a QA sample using balanced, proportional, or random sampling.
- Provides a guided four-step interface:
  1. Upload
  2. Sample
  3. Review
  4. Dashboard
- Lets QA agents record the QA decision, notes, and image brightness feedback.
- Stores progress in browser local storage.
- Exports QA results to CSV.
- Exports the current session to JSON.

## Version 5 updates

- Added an image brightness slider to each task review.
- Brightness scale runs from `Too dark` to `Too bright`, with `Perfect` in the middle.
- Brightness feedback is saved per task and included in CSV/session exports.
- Added dashboard charts for:
  - QA decision breakdown.
  - Error rate by agent.
  - Brightness feedback distribution.
  - Average duration by agent.
- Added a dashboard metric for brightness issues.
- Agent stats now include brightness issue counts.
- Reviewed tasks table now includes brightness feedback.
- Kept the v4 guided workflow and the v3 workbook parsing fixes.

## GitHub Pages setup

Upload these files to the root of the repository:

- `index.html`
- `styles.css`
- `app.js`
- `README.md`
- `.nojekyll`

Then go to the repository's **Settings > Pages** and publish from the `main` branch root.

## Privacy note

This app runs fully in the browser. Uploaded workbooks and QA notes are not sent to a server by this app.
