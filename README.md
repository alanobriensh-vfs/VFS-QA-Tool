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
- Stores progress in browser local storage.
- Exports QA results to CSV.
- Exports the current session to JSON.

## Version 4 updates

- Reworked the UI into a smoother app-style workflow.
- Added step navigation so only the active stage is shown.
- Added a dedicated sample roster page.
- Added a cleaner single-task review card.
- Added a review progress bar.
- Added drag-and-drop file upload.
- Added toast notifications.
- Added clearer status pills, cards, and dashboard styling.
- Kept the v3 workbook parsing fixes, including CSV parsing, Windows-1252 fallback decoding, blank row preservation, and explicit `VENUE_ID` / `VENUE_CONFIG_ID` detection.

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
