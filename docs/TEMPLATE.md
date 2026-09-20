# Creating the "Make a copy" template

The landing page's step 2 offers a one-click copy. That link needs a **template spreadsheet** — a copy of
your working sheet with the script attached and every trace of your own data removed. Until you create it,
the button falls back to the manual README route, so nothing on the page is broken in the meantime.

This is the one part of the setup that cannot be scripted from here: sharing a file in your Drive is your
action, not the script's.

## Why not just share your own sheet

An Apps Script bound to a spreadsheet travels with it. That is what makes the one-click copy possible — and
it is also the trap: **"Make a copy" copies the data too.** Sharing your working sheet would hand every
visitor your themes, your accounts, your quiet interests and your network. The template has to be a
separate, empty sheet.

## Steps

1. **Duplicate your working sheet.** In the "Instagram Insights" sheet: `File → Make a copy`. Name it
   `Instagram Insights — Template`. The script comes with it.

2. **Empty it.** Open the copy and delete the contents of every data tab — `Monthly`, `Weekly`, `Daily`,
   `Themes`, `Top`, `Network`, `Accounts`, `Actions`, `Belonging`, `Log`, every `Weekly *` tab, and the rest.
   Leave the header row on each, and leave `Settings` alone: those are the default keyword rules and a new
   user needs them.

   The fastest way is from the copy's own script editor: run `resetEverything` if you have it, or select
   each tab's rows below row 1 and delete. **Check the `Log` tab especially** — it names your export files.

3. **Clear the script's memory.** In the copy: `Extensions → Apps Script → Project Settings → Script
   Properties`. Delete every property. These hold your exports-folder ID and the followers snapshot date.

4. **Check `Code.gs`.** At the top, `EXPORTS_FOLDER_ID` must be empty (`''`) so each new user's `setup()`
   creates their own folder rather than pointing at yours. `LOCAL_TIMEZONE` is a sensible default to leave
   as-is; new users can change it.

5. **Delete the copy's deployments.** `Deploy → Manage deployments` — remove any that came along in the
   copy, so nobody inherits a deployment pointing anywhere near your account.

6. **Share it.** `Share → General access → Anyone with the link → Viewer`. Viewer is correct and sufficient:
   copying only needs read access, and Editor would let strangers change the template everyone else copies.

7. **Take the ID** from the URL — the long string between `/d/` and `/edit`:

   ```
   https://docs.google.com/spreadsheets/d/THIS_PART_HERE/edit
   ```

8. **Paste it into the landing page.** In `docs/index.html`, find:

   ```js
   var TEMPLATE_SHEET_ID = '';
   ```

   Put the ID between the quotes and commit. The button becomes a real one-click copy; the page builds the
   `/copy` URL itself.

## Verify it before announcing it

Open the `/copy` link **in a private/incognito window, signed into a different Google account** (or ask
someone). You are checking three things:

- The copy arrives with the script attached and the menu present.
- It contains **none of your data** — walk the tabs.
- `setup()` runs and creates a fresh `Instagram Exports` folder in *that* account's Drive.

If the copy has your rows in it, stop and fix the template before sharing the link anywhere. That mistake is
not recoverable once people have copies.

## When the code changes

Copies are snapshots: people who copied yesterday do not get today's fixes. After a meaningful change,
repeat steps 1–7 to refresh the template, or paste the updated `Code.gs` into the existing template and
re-check it is still empty. The landing page's ID stays the same if you update the template in place.
