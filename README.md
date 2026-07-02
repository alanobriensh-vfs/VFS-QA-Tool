# VFS QA Tool

A static GitHub Pages app for QA sampling VFS workbook exports.

## What it does

- Uploads `.csv`, `.xlsx`, `.xls`, or `.xlsm` files in the browser.
- Uses row 3 as the default header row.
- Treats row 4 onward as task data.
- Filters QA candidates to tasks where:
  - `AGENT` is populated.
  - `STATUS` is `Done` or `Skipped`.
- Keeps skipped tasks in the QA pool.
- Generates VFS links from `VENUE_ID` and `VENUE_CONFIG_ID`.
- Creates a QA sample using balanced, proportional, or random sampling.
- Lets QA reviewers mark tasks as:
  - Pass
  - Error
  - Correctly skipped
  - Incorrectly skipped
- Tracks notes/error reasons.
- Shows agent-level QA stats and duration metrics.
- Exports QA results as CSV.
- Saves the current session in browser local storage.

## GitHub Pages setup

1. Upload these files to the root of your repository:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `.nojekyll`
   - `README.md`
2. In GitHub, go to **Settings > Pages**.
3. Under **Build and deployment**, choose:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
4. Save.
5. Open the Pages URL GitHub gives you.

## Privacy note

This first version is fully static. Uploaded workbooks and QA notes are processed in the browser and are not sent to a server by this app.

## Current limitation

Because this is hosted on GitHub Pages without a backend, QA results are stored locally in the reviewer's browser and/or exported as CSV. For a shared team dashboard later, add a backend such as Google Sheets, Supabase, Firebase, or a small API.
