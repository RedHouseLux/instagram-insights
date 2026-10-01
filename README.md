# Instagram Insights

***English** · [Italiano](README.it.md) · [Project site](https://redhouselux.github.io/instagram-insights/)*

A Google Sheet that reads your monthly Instagram data export from a Drive folder and builds a dashboard with themes, activity rhythm, behavioural indicators and risk signals, compared month over month. It runs entirely inside your Google account; nothing is sent to an AI or any other service.

## Setting it up

You do this once. After that it runs on its own and you never touch it again.

There are two parts: **ask Instagram for your data**, and **set up the sheet that reads it**. Do them in
that order, because Instagram takes a few hours to send the first export and you may as well wait for it
with everything else already done.

The [project site](https://redhouselux.github.io/instagram-insights/) has the same instructions with a
screenshot for every tap. If you are doing this on a phone, use that.

### Part 1 — ask Instagram for your data

Open Instagram on your phone.

1. Tap the **☰** button, top right. Then tap **Settings and activity**.
2. Tap **Accounts Centre**. (It's the first thing on the list, with the Meta logo beside it.)
3. Tap **Your information and permissions**.
4. Tap **Export your information**.
5. Tap **Create export**. Instagram asks which account. Pick the one you want to look at.
6. It asks *where* to send the export. Tap **Export to a third-party service**.
7. Pick **Google Drive** from the list.
8. It asks how often. Tap **Weekly**. Then it asks for how long — pick **1 year** or more.
   Tap **Link**, then sign in to Google and say yes when it asks for permission.
9. One last screen, with four settings. Set all four:

   | Setting | Set it to |
   |---|---|
   | Customise information | everything ticked |
   | Date range | **Last week** |
   | Format | **HTML** |
   | Media quality | **Lower quality** |

   Then tap **Start export**.

That's Instagram done. It will now send your data to your own Google Drive every week, by itself.

**Two things people get wrong here**, and both quietly break everything:

- **Format must be HTML**, not JSON. A JSON export is skipped and nothing happens.
- **Weekly, not monthly.** Instagram only remembers about *seven days* of what you looked at. A monthly
  export does not contain a month of viewing — it contains the last week, and you lose the other three.
  Weekly is what actually builds a record.

Media quality doesn't break anything; it just makes the files enormous for no reason. Leave it low.

Your Instagram can be in **English or Italian** — both are read correctly. Other languages will partly work:
the numbers will be right, but some dates and labels may not be understood.

### Part 2 — set up the sheet

**The easy way** is one click, if a ready-made copy has been shared with you: open the link, click
**Make a copy**, and skip to *"Now turn it on"* below.

**The manual way**, if you'd rather paste the code yourself (or no copy link exists yet):

1. Go to **[sheets.new](https://sheets.new)**. A blank spreadsheet opens. Name it `Instagram Insights` at
   the top left.
2. In the menu bar, click **Extensions → Apps Script**. A new tab opens with a code editor in it.
3. There is a little sample code already in there (`function myFunction() { }`). Select it all and delete it.
4. Open [Code.gs](Code.gs), copy **everything** in it, and paste it into that empty editor. Press **⌘S**
   (or **Ctrl+S**) to save.
5. Now add a second file. On the left there's a **+** next to "Files" — click it and choose **HTML**.
   Name it exactly `NetworkView` (Apps Script adds the `.html` itself). Delete whatever is in it, paste
   all of [NetworkView.html](NetworkView.html), and save.
6. Add a third file the same way, but choose **Script** this time. Name it `Dashboard`. Paste all of
   [Dashboard.gs](Dashboard.gs) and save.
7. Add a fourth file, **HTML**, named exactly `Index`. Paste all of [webapp/Index.html](webapp/Index.html)
   and save.

Now close the code tab and go back to your spreadsheet.

### Now turn it on

1. **Reload the spreadsheet tab.** This matters — the menu only appears when the sheet opens.
2. Look at the menu bar. There is a new menu called **Instagram Insights**, after "Help". Click it.
3. Click **Setup (run once)**.
4. Google will ask for permission. Click through it and pick your Google account.
5. You will then see a scary-looking screen saying **"Google hasn't verified this app"**. This is expected
   and it is fine. It is *your* copy of the script, running as you, on your own data. Google hasn't checked
   it because nobody ever submitted it to be checked. Click **Advanced**, then
   **Go to (project name)**, then **Allow**.

That's it. Setup makes a folder in your Drive called **Instagram Exports** and links it to the sheet.

> If clicking **Setup** seems to do nothing after you allow access, click it once more. The first click is
> sometimes used up by the permission screen.

### What happens now

Nothing, from you. This is the whole point.

Instagram sends an export to your Drive each week. The script looks in your Drive once a day, finds it,
moves it into the **Instagram Exports** folder and reads it. You don't move files and you don't press
anything.

To look at your data: **Instagram Insights → Open dashboard**.

To make it check right now instead of waiting for tomorrow: **Instagram Insights → Process new exports now**.

**If you already have old exports** sitting on your computer, drag them into the **Instagram Exports** folder
in Drive — `.zip` files or unzipped folders, both work — then run **Process new exports now**. They'll be
read and added to the history.

**If you skipped the weekly schedule** and asked for a one-off export instead, this is the one part that
stays manual: when Meta emails you, put the `.zip` into the **Instagram Exports** folder yourself, then run
**Process new exports now**. The Drive app on your phone is fine for this.

## What's in the sheet

| Tab | What it holds |
|---|---|
| **Dashboard** | KPI tiles with sparklines, the risk matrix and register, signals, quiet interests, 16 charts, and heatmaps for themes by month and hour × weekday. Rebuilt on every run. |
| **Monthly** | One row per month with every metric. Use it as the data source for Looker Studio. |
| **Risks** | The risk register: 11 risks scored likelihood × impact, with evidence, trend and mitigation (see below). |
| **Signals** | Rule-based risk flags (✅ OK / ℹ️ Info / ⚠️ Watch / 🔴 Alert), what each means, and something to try. |
| **Profile** | 0–100 indicators in four groups: personality (Big Five) and needs (Self-Determination Theory) read from **what you did**; the **feed diet**, read from what you were shown; and **influence**, the one against the other. Plus emotional tone three ways — of what you were shown, of your own words, of the words sent to you. Each row explains its formula, names its layer and says how many events it rests on; with too few, the score is left blank. See [METHODOLOGY.md](METHODOLOGY.md). |
| **Themes** | Share of items seen per theme, beside what you chose: likes, saves, searches, comments, their weighted **action share**, and **lift** (chosen ÷ shown). One post can count toward several themes. |
| **Rhythm** | Activity by hour and weekday, in your timezone. |
| **Daily** | Per day: items seen, actions, sessions and estimated minutes, with the viewing window flagged. |
| **Hourly** | Activity for each hour × weekday, used by the heatmap. |
| **Sessions** | One row per session: when it began, how long it ran, what it opened into, what its first five minutes showed, whether a message had just pulled you in, and what you did in it. Keyed by date, like Daily. |
| **Triggers** | Context triggers as counts: for each behaviour (opening the app, long and late sessions, acting, looking things up, reaching out) and each context, how much of it there was and how often the behaviour followed. The dashboard turns these into lifts. See [METHODOLOGY.md](METHODOLOGY.md#context-triggers). |
| **Top** | Most-seen accounts, liked accounts, hashtags, advertisers in the ads you saw, and the accounts you exchanged notes or reposts with. |
| **Quiet interests** | Accounts you kept seeing without any visible action from you (see below). |
| **Performance** | Your account as others meet it: followers, reach, impressions, profile visits, interactions and audience, one row per 90-day window Instagram reports — plus the window before each, worked out from the card's own "% vs". See below. |
| **Conversations** | One row per person you exchanged direct messages with: sent, received, who started, how many turns were answered each way and how fast. Counts and timings only — message text is never stored. |
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
  - **You follow**: *Yes* means passive loyalty to an account you once chose. *No* means the feed keeps pushing it at you. *Unfollowed* means you chose to stop following it, and the feed kept showing it anyway.
  - **Vs last month**: *Continuing* means it was quiet last month too, which is a stronger signal. *New* means it just appeared.
  - **Latest caption**, to jog your memory.
- **Caveat.** "Seen" means Instagram logged it on your screen. It doesn't mean you watched it through, so an account the algorithm insists on can appear even if you scroll past it.

## Belonging, explained

Four things belonging is made of, one row each per month and week. The export measures two of them, reaches a
third only by proxy, and is silent on the fourth — and the silent row stays in the tab rather than being dropped,
because a missing row reads as "nothing to report" when the truth is "nothing was ever measured".

| Dimension | Status | Built from |
|---|---|---|
| **Connected** | Measured | `note_and_repost_interactions.html` — notes and reposts you and the other account both showed up for. Scored as breadth of distinct reciprocal contacts against `BELONGING_TIES_FULL` (default 15), capped at 100. The named partners also appear in the **Top** tab as the *Notes & reposts* list. |
| **Seen** | Proxy only | `profiles_reached.html` and `content_interactions.html`. The score is accounts that engaged ÷ accounts reached — a response rate. It measures being *looked at*, not being *recognised*, which is a different thing and is labelled as such. |
| **Heard** | Measured | `messages/inbox/` — the share of your message turns the other person answered within 24h, and how fast, per person (see the **Conversations** tab). It measures being *answered*; replies to your public comments are still not in the export. Weeks without messages say so. |
| **Invested in** | Not measurable yet | Nothing at all. No file in an Instagram export describes anyone acting for your benefit. |

Notes and reposts carry **no timestamps**, and the three "past Instagram insights" cards are Instagram's own
rolling ~90-day aggregates over a window that is not your month. All four are therefore treated as snapshots —
newest delivery wins — never split across days. That is why the Connected and Seen numbers do not move with the
daily view window the way the rest of the dashboard does. Heard is dated message by message, so it does.

## Account performance, explained

The **Performance** tab and the dashboard's *Your account* section read Instagram's own numbers about your profile.
Each export carries them for the **90 days ending the day before it**, so weekly exports give windows 7 days apart
that share 83 days:

- **Never add two windows.** Impressions, profile visits and interactions are totals over 90 days; accounts
  reached and engaged are unique accounts, which cannot be added at all. Followers is a headcount on the day —
  the one ordinary time series.
- **"vs a week earlier"** is the week that joined the window minus the week that left it, thirteen weeks back —
  not the latest week on its own.
- **Worked-out windows.** Each card states its change against the 90 days before. The previous window is worked
  out as value ÷ (1 + change) and drawn hollow, so the very first export already draws a line rather than a dot.
- **Your last story** is marked on the charts. When the 90-day window moves past it, story interactions fall to
  zero unless you post again — read a fall against that date before reading it as your audience leaving.

## Behaviour, exposure and influence

The export mostly logs what reached your screen, which the recommender chose. Personality and needs are
therefore read **only from what you did** — searches, saves, comments, messages, likes, follows, and when — while
what you were shown is reported separately as your feed diet, and **influence** compares the two: which themes
you seek beyond what you are shown, whether new accounts come to you through search or through the feed, and,
after 12 weeks, whether changes in the feed tend to precede changes in what you do or the other way round.
Every formula is in [METHODOLOGY.md](METHODOLOGY.md).

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

What it shows, in seven tabs that each answer one question — they draw when first opened, and the last one you used opens next time:

- **Overview**: the week or month at a glance — tiles with a sparkline of the eight buckets before and the change against the last one; **what stood out** (a measure outside your usual range, the strongest trigger in the range shown, the risk that worsened most, a rising theme, a change in how often you are answered), each with a link to its evidence; the four layers (what reached you, how you used it, what you did toward people, what they did back); and the three signals most worth a look.
- **Over time**: every measure over the range in the filter row (last week by day, 8 weeks, 6 months, all, or a custom range), your usual range shaded, partial weeks hollow and missing weeks left as gaps, and themes over time, shown against chosen. Click a point to open that period's Overview.
- **Triggers**: what tends to come just before you open the app, stay long, act, look something up or write to someone — ranked cards, a context × behaviour matrix, when sessions begin, and every session on one minutes axis.
- **Your feed**: themes shown and how they moved, emotional tone, the feed diet, most-seen accounts and quiet interests.
- **You**: personality, needs and influence as strips against every other bucket on record; minutes per day and the hour × weekday heatmap; how each indicator is computed.
- **People & account**: your account's 90-day performance, who you are close to, belonging and conversations.
- **Wellbeing**: the 11 risks and every signal.

Colour follows the layer a thing belongs to — blue for what reached you, teal for how you used it, pink for what you did toward people, gold for what they did back — and a highlighted border marks the few things worth looking at first. Animations follow your system's reduced-motion setting, and the ∿ button turns them off or on. Every chart has a table view.

## Sharing it with other people

Everyone runs their own copy. Nobody can see anybody else's data — there is no shared server and no shared
sheet, so there is nothing to leak.

Point people at the **[project site](https://redhouselux.github.io/instagram-insights/)**. It walks through
the whole thing with a screenshot for every tap, in English and Italian.

To give them the one-click copy instead of asking them to paste code, you need to make a **template sheet**
once: a copy of your sheet with the script in it and all of your own data removed. The steps, and the
mistakes to avoid, are in [docs/TEMPLATE.md](docs/TEMPLATE.md).

> **Never share your own working sheet.** A bound Apps Script travels with the spreadsheet when someone
> copies it — and so does everything in the tabs. The template has to be a separate, emptied copy.

## Limits worth knowing

- **Each export holds only about the last 7 days of viewing history** (posts, videos, ads), while likes, follows and searches cover the whole month. The script detects this *viewing window*; rates, rhythm and time estimates use only those days. Themes and quiet interests describe that week.
- Estimated minutes come from logged timestamps, with a session ending after 15 minutes of silence. Treat them as a floor, not a measurement.
- Themes, emotions and indicators come from **keyword rules**. They are proxies for patterns, not a psychological assessment.
- **Direct messages are read, never stored.** Their text is scored for tone in memory; only counts and timings reach the sheet, and the Prompt tab carries no message content.
- If Meta changes the export layout, parsing may break. The Log tab shows an error instead of silently writing wrong numbers.
- If you add an older month after newer ones, run **Reprocess everything** so month-to-month comparisons are recalculated.
- After pasting a new version of `Code.gs`, run **Reprocess everything** once so past months get the new columns and tabs.

## Testing locally

`node test/run-local.js <folder with exports>` runs the whole pipeline on local exports, using in-memory stand-ins for Drive and Sheets. It checks the parsed counts against the raw HTML and confirms that re-running doesn't duplicate rows. The folder may hold exports as Meta's Drive delivery nests them, in English or Italian. No exports to hand? `node test/make-fake-exports.js <folder>` writes three weeks of invented ones (two in English, one in Italian) that the checks run on. Add `PAYLOAD_OUT=payload.json` to also write the exact data the dashboard receives, for previewing `webapp/Index.html` without deploying.
