# Outreach: local places to meet people, ranked by a comfort-zone dial

## Context

The dashboard currently describes consumption. This adds the first feature that points *outward* — a weekly list of nearby places and groups where you could meet people who are into a topic, with whatever contact route they have published.

This is the "3a" scope settled in the brainstorm. Two boundaries define it:

- **It lists doors, not people.** Rows are organisations, clubs and venues with a *published* contact route (`contact:email`, `phone`, `website` on OpenStreetMap). If that route reaches a named person, it's because they published it in a public capacity. The tool never assembles profiles of individuals, never infers anyone's interests, and never produces a list of strangers to DM. This was the one point of genuine disagreement in the brainstorm and it's the line the design holds.
- **Reach strangers through a room.** You don't message a permaculture enthusiast; you email the association and meet fifteen. Higher yield than a cold DM, and no dossier.

Deliberately **out of scope for now**: audience/follower interests (the export doesn't carry the data — a ranged export's `followers_1.html` holds only followers gained in that window; confirmed: 1 entry in the Sept export, 4 in the Aug one), plus grants, contents, and the activities list as separate features.

Three user decisions already made: coordinate **snapped to a ~1km grid** before it leaves; home position **hand-typed as `lat,lon`** in the Settings tab; venues with **no published contact are included**, marked "just show up".

### The thing to be careful about

`Code.gs:8` currently states the project's invariant: *"Everything runs inside your Google account; nothing is sent to an AI or any third party."* There is no `UrlFetchApp`, `CacheService`, or outbound call anywhere in the repo today — this feature breaks that invariant and it must be broken honestly, not quietly.

The design keeps the breach as small as it can be:

- **The outbound query is identical for every user and every run.** It asks for *all* place categories, never the subset matching your themes — so the request carries no signal about your interests. Theme matching, ranking and distance all happen locally, after the response lands.
- **Only a snapped coordinate and a radius go out.** No account name, caption, theme, or anything derived from Instagram data.
- Every refresh writes a `Log` row recording exactly what was sent, so it is auditable from the Sheet.
- `Code.gs:8` gets amended to say what is now true.

Also: `appsscript.json` declares no `oauthScopes` block (scopes are inferred from the code), so adding `UrlFetchApp` silently adds `script.external_request` and **Google will re-prompt for authorisation** on the next run. Expected, but it should not be a surprise.

## Design

### 1. Settings — three new rows, reusing the existing tab

`Settings` is a rules table (`Kind | Name | Keywords`, `Code.gs:74`), not key/value — but `compileRules_` (`Code.gs:1114`) dispatches on `Kind` and **silently ignores unknown kinds**. So new rows slot in with no change to the rules engine:

```
Kind    Name      Keywords
Place   Home      40.8518, 14.2681
Place   Radius    15
Place   <theme>   amenity=community_centre, club=social, office=association
```

One row per theme whose `Name` matches a `Theme` row's `Name` (`DEFAULT_RULES`, `Code.gs:209-234`), so the two stay in step by construction. Representative mappings — the full set covers the 13 default themes; `Other` maps to nothing:

| Theme | OSM selectors |
|---|---|
| `Local & Community` | `amenity=community_centre`, `amenity=social_centre`, `club=social`, `office=association`, `amenity=marketplace`, `amenity=public_bookcase` |
| `Environment & Solarpunk` | `leisure=garden`, `landuse=allotments`, `club=nature`, `shop=charity`, `shop=second_hand` |
| `Health & Body` | `leisure=sports_centre`, `leisure=fitness_centre`, `leisure=pitch`, `club=sport` |
| `AI & Tech` | `leisure=hackerspace`, `office=coworking`, `club=computer` |
| `Arts, Film & Design` | `amenity=arts_centre`, `club=art`, `tourism=museum`, `craft=*` |

**`seedSettings_` cannot be used for this** — it is gated on `getLastRow() <= 1` (`Code.gs:2180`), so an existing spreadsheet would never receive new defaults. Add **`ensureSettingRows_(triples)`**: read `Settings`, append any `Kind|Name` pair not already present, leave every existing `Keywords` cell untouched. Call it from `setup()` and from the refresh path. `Home` seeds blank — a blank `Home` is the feature's off switch.

### 2. `PLACE_KINDS` — a code-level constant, not user config

A second small table keyed by OSM selector, giving each one a human label and a social-exposure level 1-3. Exposure is a design judgement about how much the place asks of you, not something to tune per-theme:

```js
const PLACE_KINDS = {
  'amenity=library':          { label: 'Library',          exposure: 1 },
  'leisure=garden':           { label: 'Community garden', exposure: 2 },
  'amenity=community_centre': { label: 'Community centre', exposure: 2 },
  'club=social':              { label: 'Social club',      exposure: 3 },
  // …
};
```

Exposure 1 = you can go and say nothing. 2 = small group, drop-in, low commitment. 3 = you have to write first or speak on arrival.

### 3. Fetch — one fixed Overpass query, weekly

New `refreshOutreach_()` in `Code.gs`:

- Reads `Home` and `Radius` via `readRows_('Settings')`. No `Home` → return `{skipped: 'no home set'}`.
- **Snaps** the coordinate to 2 decimal places (~1.1km) and widens the search radius by 1.5km to compensate for the snap.
- Builds a union query over **every** selector in `PLACE_KINDS`, capped at 25km regardless of the `Radius` setting (the client filters down; see §5):

```
[out:json][timeout:60];
(
  nwr[amenity=community_centre](around:R,LAT,LON);
  nwr[club](around:R,LAT,LON);
  …
);
out center tags;
```

  `out center tags` (not full geometry) keeps the response to a few hundred KB.
- `UrlFetchApp.fetch('https://overpass-api.de/api/interpreter', {method:'post', payload:{data: q}, muteHttpExceptions:true})`. Non-200 or a parse failure → write a `Log` row and **return without touching the `Outreach` tab**, so last week's rows survive.
- Reuses existing infrastructure for everything else: `isoWeekKey_`/`isoWeekStart_` (`Code.gs:1677`, `1689`) for the week key, `writeMonthRows_` (`Code.gs:2096`) for replace-by-key, `dateCell_`/`safeCell_` (`Code.gs:2156`, `2162`), `writeLog_` (`Code.gs:2204`).

**Scheduling:** no new trigger. `processNewExports` already runs daily at `CONFIG.CHECK_HOUR` (`Code.gs:261-265`). Call `refreshOutreach_()` near the end of that run, guarded two ways — skip unless the `OUTREACH_AT` script property is more than 7 days old *or* `Home`/`Radius` changed since last fetch, and skip if the run has less than `OUTREACH_MAX_MS` (45s, its own ceiling in the style of `SWEEP_MAX_MS`, `Code.gs:529`) left in `CONFIG.MAX_RUN_MS`. A skipped day is harmless; it only has to land once a week.

### 4. Scoring — computed server-side, dial applied client-side

Per candidate place:

- `theme` — from the selector, via the `Place` settings rows.
- `distanceKm` — haversine from your **real** coordinate (never the snapped one; snapping only affects what goes out).
- `exposure` — from `PLACE_KINDS`.
- `familiarity` — that theme's share in your own `Themes` rows.
- `bridge` — `circleShare(theme) × (1 − familiarity)`, where `circleShare` is the theme's share of `Cluster` values across the `Network` tab. High when the people you follow carry a topic that you personally never watch. This is the de-polarization signal: cross-cutting, not random.

The dial is *not* baked into the stored rows, because the stored rows must serve every dial position without a re-fetch. The tab stores `familiarity` and `bridge`; the client picks which one ranks. Cap at 300 candidate rows per week.

### 5. Surfacing — a weekly-only dashboard section

New `Outreach` tab:

```
Week | Name | Kind | Theme | Distance km | Exposure | Familiarity | Bridge |
Contact | Website | Hours | Address | Map | Week start
```

`Week` is column 0 so `writeMonthRows_`'s replace-by-key partitioning works unchanged. Register it in the three places a new tab must be registered — `HEADERS` (`Code.gs:49-86`, plus `TEXT_COLUMNS` for `Contact`/`Website`/`Map`/`Hours` and `NUMBER_FORMATS` for the numerics and `Week start`), `getDashboardPayload` (`Dashboard.gs:37-61`, one line: `outreach: sheetRows_('Outreach')`), and `TABLE_KEY` (`webapp/app.js:7-11`).

Client side, following the existing `draw*` pattern exactly (`table()` → filter by `bucketKey()` → sort → `innerHTML=''` → append via `el()`, as in `drawAccounts`, `app.js:484-497`):

- A new `#sec-outreach` section in `webapp/index.template.html`, placed after the `#themes` panel and before `#sec-hours` (everything below that point is the monthly-only cluster).
- `render()` (`app.js:271-327`) gains a `weeklyOnly = ['#sec-outreach']` array mirroring the existing `monthlyOnly` at `app.js:307`, hidden when `!isWeek()`.
- Three controls in the section header, all client-side: a radius range input (1-25km, default 15), a **comfort dial** (1 Familiar / 2 Stretch / 3 Edge, default 2), and a topic select populated from the themes actually present in the week's rows.
- The dial applies as: **L1** rank by `familiarity`, `exposure ≤ 1`. **L2** rank by `bridge`, `exposure ≤ 2`. **L3** rank by `bridge` restricted to themes where `familiarity ≈ 0`, `exposure ≤ 3`. All three then apply a mild distance penalty and a bonus for having a contact route, and take the top 10.
- Rows with no `Contact`/`Website` render with a "just show up" note and their opening hours, per the decision made.
- State persists to `localStorage`, matching the existing `'theme'` / `'insights-bucket'` pattern (`app.js:569-579`, `591-597`) with the same try/catch guards. **No write-back to the Sheet** — `callServer` passes no arguments (`app.js:162-172`) and `Dashboard.gs:5` states it never writes; that contract stays intact.
- `webapp/app.css` has no `input[type=range]` styling today (only `select, button` at line 29) — add it, using the existing tokens, and covering both dark-mode blocks (lines 9-18).

## Files touched

- **`Code.gs`** — amend the privacy note at line 8; `HEADERS`/`TEXT_COLUMNS`/`NUMBER_FORMATS` for `Outreach`; `DEFAULT_RULES` gains the `Place` rows; new `PLACE_KINDS`, `ensureSettingRows_`, `refreshOutreach_`, `snapCoord_`, `haversineKm_`, `overpassQuery_`, `scoreOutreach_`; `setup()` calls `ensureSettingRows_`; `processNewExports()` calls `refreshOutreach_` under its budget guard; `OUTREACH_MAX_MS` beside `SWEEP_MAX_MS`.
- **`Dashboard.gs`** — one payload line.
- **`webapp/index.template.html`** — the `#sec-outreach` block.
- **`webapp/app.js`** — `TABLE_KEY` entry, `drawOutreach()`, `weeklyOnly` in `render()`, control wiring in `wireControls()` (`app.js:582-608`).
- **`webapp/app.css`** — range-input styling, both themes.
- **`test/run-local.js`** + **`webapp/shim.js`** — a `UrlFetchApp` stub.
- **`test/fixtures/overpass-sample.json`** (new) — a real captured response.

## Verification

1. **Capture a real fixture first**, before writing the parser, so the code is written against actual Overpass output rather than an assumption:
   `curl -s -d @query.txt https://overpass-api.de/api/interpreter > test/fixtures/overpass-sample.json`
   Inspect how many results actually carry `contact:*`/`website`/`opening_hours` in the target area — this number decides whether the "just show up" path is the common case or the exception, and the UI copy should match reality.
2. `node test/run-local.js <path to a folder of exports>` — existing suites still green, plus new ones for: coordinate snapping (and that the *real* coordinate is used for distance), haversine against known points, selector → kind/exposure mapping, theme assignment from `Place` rows, `bridge` math against a hand-built `Themes`/`Network` pair, week partitioning through `writeMonthRows_`, and a non-200 response leaving the prior week's rows intact.
3. `node build/build-webapp.js`, copy the six tracked files into `.clasp-deploy/`, then from inside it: `clasp push --force` → `clasp create-version "outreach"` → `clasp redeploy <your deployment id> -V <n> -d "outreach"`.
4. On the live Sheet: run **Setup** once (this is when Google re-prompts for the new `script.external_request` scope), fill `Place | Home` with a real `lat,lon`, then **Process new exports now**. Confirm: a `Log` row recording the snapped coordinate sent; the `Outreach` tab populated for the current ISO week; the dashboard's new section appearing in Weekly mode only, with the dial and radius changing the list with no reload.
5. Sanity-check a handful of rows by hand against openstreetmap.org — right place, right distance, contact route that actually resolves.
