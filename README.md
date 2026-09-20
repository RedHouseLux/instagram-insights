# Instagram Insights

***English** · [Italiano](README.it.md) · [Project site](https://redhouselux.github.io/instagram-insights/)*

A Google Sheet that reads your monthly Instagram data export from a Drive folder and builds a dashboard with themes, activity rhythm, behavioural indicators and risk signals, compared month over month. It runs entirely inside your Google account; nothing is sent to an AI or any other service.

## One-time setup (about 5 minutes)

1. **Create the sheet.** Go to [sheets.new](https://sheets.new) and name it `Instagram Insights`.
2. **Add the script.** In the sheet, open **Extensions → Apps Script**. Delete the sample code, paste all of [Code.gs](Code.gs), and save (⌘S).
   - For the network graph, click **+ → HTML**, name the file `NetworkView` (Apps Script adds `.html`), paste all of [NetworkView.html](NetworkView.html), and save.
3. **Run setup.** In the Apps Script toolbar, pick `setup` from the function list and click **Run**.
   - Google asks for permission to use Drive, Sheets and triggers. Choose your account.
   - On "Google hasn't verified this app", click **Advanced → Go to (project name)**. It's your own script.
4. Back in the sheet, setup shows the link to your **`Instagram Exports`** folder in Drive. It creates the folder unless you already have one with that name. To use a different folder, paste its ID into `EXPORTS_FOLDER_ID` at the top of `Code.gs` and run `setup` again.
5. **Load the past months.** Upload the exports you already have into that folder, either the `.zip` files or the unzipped folders. Then reload the sheet and choose **Instagram Insights → Process new exports now**.

## Every month

1. In Instagram, go to **Accounts Centre → Your information and permissions → Export your information**, then **Create export**. Request your Instagram information with:
   - **Format: HTML.** JSON exports are skipped.
   - **Date range:** last month.
   - **Media quality:** low. Media isn't needed.
   - Keep Instagram in **English**; the dates are parsed in English.
2. When Meta's email arrives, download the `.zip` and put it in the `Instagram Exports` folder. The Drive app on your phone works too.
3. That's it. The script checks the folder every day around 08:00 and updates everything. To run it immediately, use **Instagram Insights → Process new exports now**.

**Better: schedule it.** Instagram can export straight to Google Drive on a repeating schedule, which is what
actually builds a record over time — each export only holds about a week of viewing history. In the export
flow choose **Esporta su un servizio esterno → Google Drive → Weekly**, for at least a year. The
[project site](https://redhouselux.github.io/instagram-insights/) has the step-by-step with screenshots.

## What's in the sheet

| Tab | What it holds |
|---|---|
| **Dashboard** | KPI tiles with sparklines, the risk matrix and register, signals, quiet interests, 16 charts, and heatmaps for themes by month and hour × weekday. Rebuilt on every run. |
| **Monthly** | One row per month with every metric. Use it as the data source for Looker Studio. |
| **Risks** | The risk register: 11 risks scored likelihood × impact, with evidence, trend and mitigation (see below). |
| **Signals** | Rule-based risk flags (✅ OK / ℹ️ Info / ⚠️ Watch / 🔴 Alert), what each means, and something to try. |
| **Profile** | 0–100 indicators mapped to the Big Five and Self-Determination Theory, plus the emotional tone of captions. Each row explains its formula. |
| **Themes** | Share of items seen and liked per theme. One post can count toward several themes. |
| **Rhythm** | Activity by hour and weekday, in your timezone. |
| **Daily** | Per day: items seen, actions, sessions and estimated minutes, with the viewing window flagged. |
| **Hourly** | Activity for each hour × weekday, used by the heatmap. |
| **Top** | Most-seen accounts, liked accounts, hashtags, advertisers in the ads you saw, and the accounts you exchanged notes or reposts with. |
| **Quiet interests** | Accounts you kept seeing without any visible action from you (see below). |
| **Belonging** | Four dimensions of belonging — Seen, Heard, Invested in, Connected — scored where the export supports it and marked unmeasurable where it does not (see below). |
| **Network** | One row per account you follow, follow you or keep meeting, with its relation, status, theme cluster and attention. Region and Note are yours to fill in and are kept on every rebuild. See below. |
| **Actions** | What you chose to do: likes, follows, searches, blocks, reports. |
| **Accounts** | Every account you saw, liked or searched, month by month. The Network tab adds these up. |
| **Meta** | Ad labels, advertisers holding your data, and locations Meta links to you, each marked New / Same / Removed. |
| **Prompt** | A ready-made text summary of the month. Paste it into Claude for a written personality / emotions / desires / risks profile. |
| **Settings** | The keyword lists behind themes, emotions and signals. Edit freely. |
| **Log** | Each export processed, with its result. |

## Quiet interests, explained

A **quiet interest** is an account whose posts or videos you saw at least 5 times in the viewing window (`QUIET_MIN_VIEWS`, about the last week of the export) while doing nothing visible about it all month: no like, no search, no new follow.

- **Why it matters.** Likes are what you are willing to show. Repeated viewing is what actually holds your attention. Instagram doesn't export watch time, so repeated views are the best signal available for attention you give but don't express. These accounts often point closer to current worries, curiosities or guilty pleasures than your likes do.
- **Columns.**
  - **Times seen**, split into posts and videos.
  - **You follow**: *Yes* means passive loyalty to an account you once chose. *No* means the feed keeps pushing it at you.
  - **Vs last month**: *Continuing* means it was quiet last month too, which is a stronger signal. *New* means it just appeared.
  - **Latest caption**, to jog your memory.
- **Caveat.** "Seen" means Instagram logged it on your screen. It doesn't mean you watched it through, so an account the algorithm insists on can appear even if you scroll past it.

## Belonging, explained

Four things belonging is made of, one row each per month and week. The export can speak to two of them and is
silent on the other two — and the silent rows stay in the tab rather than being dropped, because a missing row
reads as "nothing to report" when the truth is "nothing was ever measured".

| Dimension | Status | Built from |
|---|---|---|
| **Connected** | Measured | `note_and_repost_interactions.html` — notes and reposts you and the other account both showed up for. Scored as breadth of distinct reciprocal contacts against `BELONGING_TIES_FULL` (default 15), capped at 100. The named partners also appear in the **Top** tab as the *Notes & reposts* list. |
| **Seen** | Proxy only | `profiles_reached.html` and `content_interactions.html`. The score is accounts that engaged ÷ accounts reached — a response rate. It measures being *looked at*, not being *recognised*, which is a different thing and is labelled as such. |
| **Heard** | Not measurable yet | Nothing but a story-reply count. `your_instagram_activity/comments/` ships empty and the messages folder carries no DM content or metadata, so there is no conversation in the export to read. |
| **Invested in** | Not measurable yet | Nothing at all. No file in an Instagram export describes anyone acting for your benefit. |

Notes and reposts carry **no timestamps**, and the three "past Instagram insights" cards are Instagram's own
rolling ~90-day aggregates over a window that is not your month. All four are therefore treated as snapshots —
newest delivery wins — never split across days. That is why the Belonging tab's numbers do not move with the
daily view window the way the rest of the dashboard does.

## Network, explained

**Instagram Insights → Open network view** draws the Network tab as a graph, inside the dialog, with nothing loaded from other sites.
- **Rings**, from the centre: closest · you follow, seen lately · dormant follows and fans · not followed · unfollowed (hidden until you switch it on).
- **Sectors:** each account's main theme.
- **Colour:** blue = you liked or searched them · orange = seen, no reaction · grey = not seen in any export.
- **Dot size:** attention, meaning times seen + 5× likes + 3× searches.
- **Controls:** hover a dot for details, click it to open the profile, use the chips to filter by status, and scroll to zoom.

| Status | Meaning ("lately" = the last 3 months of exports, `NETWORK_RECENT_MONTHS`) |
|---|---|
| Close friend | On your close friends list |
| Inner circle | You follow each other, and you liked or searched them lately |
| Engaged follow | You follow them, and liked or searched them lately |
| Quiet follow | You follow them and saw them 5+ times lately, without reacting |
| Active follow | You follow them and saw them lately |
| Dormant follow | You follow them, but they haven't appeared lately |
| Fan | They follow you; you don't follow back |
| Chosen, not followed | You liked or searched them without following |
| Pushed by feed | Seen 3+ times lately, and you don't follow them |
| Unfollowed · Blocked | No longer in your following list · on your blocked list |

**Get the full followers list once.** Monthly exports include everyone you follow, but only that month's *new* followers, so mutual follows and fans start out undercounted.
1. In Instagram, go to **Accounts Centre → Your information and permissions → Export your information** and choose **Some of your information**.
2. Tick only **Followers and following**.
3. Pick **Date range: All time** and **Format: HTML**, then drop the `.zip` in the folder.

The Log tab then shows *connections only*, and no month is added. Repeat once a year to catch people who stopped following you.

The export has no information about who *your* contacts follow. So clusters group accounts by shared theme and status, not by links between them.

## Customising

- **Themes and word lists:** edit the `Settings` tab. In the keyword syntax, `word` matches words starting with it, `"word"` matches the whole word only, `@account` matches posts from that account, and `#tag` matches that hashtag. Then run **Reprocess everything** so past months use the new rules.
- **Thresholds and formulas** are in `analyzeExport_` in `Code.gs`. Search for `signal(` and `profileDefs`.
- **Timezone** is `LOCAL_TIMEZONE` at the top of `Code.gs`. Meta prints export times in US Pacific time while labelling them "UTC"; the script reads the real offset from each export's header.

## Risk analysis, explained

Each month, 11 risks are scored **likelihood × impact**:
- **Likelihood (1–5)** comes from your data: one point, plus one for each threshold the metric crosses.
- **Impact (1–5)** is fixed per risk.
- **Score (max 25):** 1–4 🟢 Low · 5–9 🟡 Medium · 10–15 🟠 High · 16–25 🔴 Critical.
- **Risk index (0–100):** the month's total score as a share of the maximum possible.

| Code | Risk | Driven by |
|---|---|---|
| R1 | Excessive use | estimated minutes per active day; +1 if items seen per day jumped 40% |
| R2 | Sleep disruption | share of activity between 00:00 and 05:59 |
| R3 | Attention fragmentation | focus spread across themes |
| R4 | Passive consumption | active ratio (lower is worse); +1 if quiet interests are 40%+ of items |
| R5 | Emotional load | anxiety and fear language per 100 items |
| R6 | Negative news diet | news share |
| R7 | Physical strain | pain, posture and sleep content per 100 items |
| R8 | Commercial manipulation | sales-funnel content per 100 items |
| R9 | Data exposure | advertisers holding your data; +1 with 3+ new Meta labels |
| R10 | Feed concentration | share of items from your top 5 accounts |
| R11 | Unwanted contact | blocks and reports |

Thresholds, impacts and mitigations live in `RISKS` at the top of `Code.gs`. These are behavioural risk indicators from Instagram data, not a clinical or security assessment.

## Nicer infographics (optional, free)

[LOOKER_STUDIO.md](LOOKER_STUDIO.md) has a step-by-step guide to a five-page Looker Studio report (overview, time, content, risks, profile) built on this sheet.

## The dashboard (free, connected to your own Drive and Sheet)

A page that reads live from the tabs `processNewExports()` already keeps current — nothing to drop, nothing to upload. Open it, and it's already showing your latest month; a **Refresh now** button re-checks Drive on demand, on top of the daily automatic check.

- **It's live.** Deployed via `clasp` (Google's official CLI) at `Execute as: Me`, `Who has access: Only myself` — see [.clasp-deploy/DEPLOY_NOTES.md](.clasp-deploy/DEPLOY_NOTES.md) for the URL and the 3-command update flow (`clasp push` → `clasp create-version` → `clasp redeploy`), so a future change reaches the same URL.
- **No deployment needed.** `Instagram Insights → Open dashboard` shows the same page in a modal dialog inside the sheet, running as you and reading the same tabs over `google.script.run`. Deploying it as a web app is optional, and only buys it a URL of its own (handy on a phone, or to open without the spreadsheet).
- **Setting it up from scratch** (a fresh copy, or by hand instead of `clasp`): in the sheet's Apps Script project (**Extensions → Apps Script**), add [Dashboard.gs](Dashboard.gs), replace `WebApp.gs` with [webapp/WebApp.gs](webapp/WebApp.gs), add an HTML file named exactly `Index` holding [webapp/Index.html](webapp/Index.html). For the optional URL: **Deploy → New deployment → Web app**, **Execute as: Me**, **Who has access: Only myself**. It runs under your own already-granted Sheets/Drive access — the same one `setup()` uses — so no one else ever sees a permission screen, and Google's app-verification rules (which only govern a script acting on *other people's* accounts) don't apply.
- **After changing `Code.gs`, `Dashboard.gs` or the `webapp/` files,** run `node build/build-webapp.js` to rebuild `webapp/Index.html`, then push the update (see above).
- **Finding your exports automatically:** because Instagram's own "send to Google Drive" option can't be pointed at a specific folder, every check also looks across "My Drive" for anything named with "meta" in it, confirms it's really an Instagram export before touching it, and moves a real one into the `Instagram Exports` folder. Anything else with "meta" in its name is left exactly where it is.

What it shows: the month's tiles with month-over-month changes, the 11 risks with evidence and a trend arrow per risk, minutes per day, themes, the hour × weekday heatmap, most-seen accounts, quiet interests, the indicators, the signals, and a link to the network view.

## Share it with a friend

Each person runs their own copy, so nobody sees anyone else's data.

**You, once:**
1. **Protect your data in the report.** Open **Resource → Manage added data sources**, then on each source click **Edit** and set **Data credentials** to **Viewer**.
2. **Check the data sources.** In that same list there must be exactly 9 sources, with the **Alias** column reading `ds0`…`ds8` in this order: Monthly, Risks, Daily, Hourly, Themes, Top, Quiet interests, Profile, Actions. Click an alias to change it.
3. **Share the report** with your friend's Google account as **Viewer**. Copy the report ID from its URL: `lookerstudio.google.com/reporting/<ID>/page/…`.
4. **Make a data-free template sheet.** Create a new sheet, open **Extensions → Apps Script**, paste `Code.gs` and add the `NetworkView` HTML file (see step 2 of the one-time setup). Set `LOOKER_TEMPLATE_REPORT_ID` to the report ID and save. Don't run anything.
5. **Share the template.** Set **General access** to **Anyone with the link · Viewer**. In the link, replace everything from `/edit` onwards with `/copy`.
6. **Test it yourself first.** Open the `/copy` link and follow your friend's steps below with one of your own exports, then check every page.

**Your friend:**
1. Open the `/copy` link and click **Make a copy**.
2. Choose **Instagram Insights → Setup (run once)** and allow access. If nothing happens after allowing, click it again.
3. Request the Instagram export (see *Every month* above) and drop the `.zip` into the `Instagram Exports` folder.
4. Choose **Instagram Insights → Process new exports now**. The Dashboard tab fills in.
5. Choose **Instagram Insights → Create Looker Studio report**, open the link, and click **Edit and share**. The report is a copy of yours, running on their own data.

## Limits worth knowing

- **Each export holds only about the last 7 days of viewing history** (posts, videos, ads), while likes, follows and searches cover the whole month. The script detects this *viewing window*; rates, rhythm and time estimates use only those days. Themes and quiet interests describe that week.
- Estimated minutes come from logged timestamps, with a session ending after 15 minutes of silence. Treat them as a floor, not a measurement.
- Themes, emotions and indicators come from **keyword rules**. They are proxies for patterns, not a psychological assessment.
- If Meta changes the export layout, parsing may break. The Log tab shows an error instead of silently writing wrong numbers.
- If you add an older month after newer ones, run **Reprocess everything** so month-to-month comparisons are recalculated.
- After pasting a new version of `Code.gs`, run **Reprocess everything** once so past months get the new columns and tabs.

## Testing locally

`node test/run-local.js <folder with exports>` runs the whole pipeline on local exports, using in-memory stand-ins for Drive and Sheets. It checks the parsed counts against the raw HTML and confirms that re-running doesn't duplicate rows.
