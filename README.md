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
- Lets QA agents record the QA decision, notes, and a 0-100 image brightness score.
- Stores progress in browser local storage.
- Exports QA results to CSV.
- Exports the current session to JSON.

## Version 7 updates

- Added a full dark visual refresh with glass-style cards, glow accents, and a cleaner app feel.
- Reworked dashboard charts so they look more visual and less like plain tables.
- Added a donut chart for QA decisions.
- Added a lighting score gauge-style chart that shows agent averages against the ideal score of 50.
- Added stronger visual bar charts for error rate, duration, and brightness distribution.
- Added dashboard insight cards for quality signal, lighting signal, and training watch.
- Kept the v6 numeric 0-100 lighting score model.
- Kept the existing upload, sampling, review, export, and local-save logic intact.

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
