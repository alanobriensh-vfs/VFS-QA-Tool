# VFS QA Tool

A static GitHub Pages app for QA sampling VFS workbook exports.

## What it does

- Uploads `.csv`, `.xlsx`, `.xls`, or `.xlsm` files in the browser.
- Uses row 3 as the default header row.
- Preserves blank spreadsheet rows so the header row number matches the real workbook row.
- Auto-detects the real header row as a fallback if required columns are not found.
- Treats the row after the detected header as task data.
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


## v3 fix

Fixed CSV uploads that use Windows-1252/Excel-style encoding. CSV files now use a built-in parser instead of sending CSVs through the XLSX parser, which makes detection of `VENUE_ID` and `VENUE_CONFIG_ID` more reliable. The app also cache-busts `app.js` and `styles.css` so GitHub Pages does not keep serving an older script.

## v2 fix

Fixed CSV parsing for VFS workbook exports that contain a blank first row. The app now preserves blank rows and can auto-detect the actual header row containing `AGENT`, `STATUS`, `VENUE_ID`, and `VENUE_CONFIG_ID`.
