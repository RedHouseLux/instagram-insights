# Looker Studio setup

Looker Studio (free) turns the Instagram Insights sheet into an interactive, multi-page report with filters. It reads the sheet directly, so new months appear automatically.

**Before you start:** paste the latest `Code.gs` into Apps Script, save, reload the sheet, and run **Instagram Insights → Reprocess everything** once. That creates every tab and the date columns.

---

## Step 1: Create the report (1 click)

1. In the sheet, choose **Instagram Insights → Create Looker Studio report** and click **Open it in Looker Studio**.
2. Looker Studio opens a new report called **Instagram Insights** with all 9 tabs already connected: Monthly, Risks, Daily, Hourly, Themes, Top, Quiet interests, Profile and Actions. The first time, accept the terms and allow access to your sheet.
3. Click **Edit and share**, then confirm, to save the report to your account.

If the menu item is missing, reload the sheet. The menu only appears after the new `Code.gs` is saved.

## Step 2: Check the field types (usually nothing to do)

The sheet now writes real dates and formatted percentages, so Looker Studio picks the right types by itself:
- **`Month date`** is on every tab and **`Day`** is on Daily and Actions. Both should show a calendar icon. In time-series charts, set the dimension's **Date granularity** to **Year Month** for `Month date`.
- **Percent columns** such as `Active ratio`, `Late-night share` and `Seen share` should show as **%**.

If a field shows the wrong icon, open **Resource → Manage added data sources → Edit** on that source, change the type in the field list, and click **Done**.

**Sheet made with an older script (no `Month date` column)?** Add it as a calculated field instead, to every source you build charts from. The date range control (Step 3) filters each chart through this field.
1. In the **Data** panel, expand the source.
2. At the bottom of its field list, click **Add a field**.
3. Name the field `Month date` and use the formula `PARSE_DATE("%Y-%m-%d", CONCAT(Month, "-01"))`.
4. Click **Save**, then **Finished**.

Check that `Month date` now shows a calendar icon. On **Daily**, if `Date` shows **ABC**, add a field `Day` with the formula `PARSE_DATE("%Y-%m-%d", Date)`.

With the date range control (Step 3) set to one month, each chart sees one month of rows, so aggregation only matters for scorecards (use **Average**).

## Step 3: Theme and month selector (one control for everything)

1. **Theme and layout → Theme:** pick a light theme such as *Simple*.
2. **Add a control → Date range control**, placed at the top right of the page.
   - **Setup → Default date range:** **Custom**, then choose the preset **Last month**. Exports are labelled by the month they mostly cover and arrive early the next month, so "Last month" follows the newest export on its own.
3. In every chart's **Setup**, set **Date range dimension** to `Month date`. It's often picked automatically; check it.
   - A date range control filters every chart on the page, **whatever its data source**, as long as that chart has a date range dimension. That's why one control is enough.
   - A source without `Month date` isn't filtered. Add the calculated field from Step 2 to each source when you build its page.
4. Month-by-month trend charts must show every month. Select the control and all the *other* charts, press **⌘G** (**Arrange → Group**), and leave the trend charts out. A control only affects charts in its own group.
5. Copy the control onto each page with ⌘C / ⌘V, and group it the same way where there's a trend.

**To switch month:** in **View** mode, click the control, then click the first and last day of the month you want, for example 1 Jul and 31 Jul 2026.

---

## Step 4: Build the pages

Use **Page → New page** for each page. For every chart: **Insert → chart type**, then set the fields in the **Setup** panel on the right.

### Page 1: Overview
| Chart | Data source | Setup |
|---|---|---|
| Scorecard: Risk index | Monthly | Metric `Risk index` (Average) |
| Scorecard: Minutes a day | Monthly | Metric `Est. minutes per active day` (Average) |
| Scorecard: Items a day | Monthly | Metric `Seen per day` (Average) |
| Scorecard: Active ratio | Monthly | Metric `Active ratio` (Average, Percent) |
| *All four scorecards* | | **Sort** (below Filter in Setup) must be the card's own metric with the same aggregation (Average). If you change the metric or copy a card, update the sort too, or the card shows "Invalid sort". |
| *Card descriptions* | | **Insert → Text** below each card: font 10, grey `#52514e`, same width as the card. See the texts below the table. |
| Time series: Risk index trend | Monthly | Dimension `Month date` · Metric `Risk index`. **Style:** show points. Keep it out of the month control's group, so it shows every month. |
| Bar chart: Themes | Themes | Dimension `Theme` · Metric `Seen share` · Sort `Seen share` descending · Date range dimension `Month date` |

Card descriptions:
- **Risk index (0–100):** All 11 risk scores as a share of the maximum. Higher means more risk; details on the Risks page.
- **Minutes per active day:** Estimated from Instagram's timestamps over the export's last ~7 days. A floor: real use is likely higher.
- **Items seen per day:** Posts and videos Instagram logged on your screen per day, in that same week.
- **Active ratio:** Likes, follows and searches per item seen. Below 2% means mostly passive scrolling.

### Page 2: Time and rhythm
First add calculated fields: `Month date` on **Daily** and **Hourly** (Step 2 formula); on **Hourly**, `Weekday label` = `CONCAT(CAST(Weekday no AS TEXT), CONCAT(" ", Weekday))` (CONCAT takes two arguments, and the number must be cast to text), so columns sort Mon→Sun. Use **Date range dimension** `Month date` on every chart except the trends.

| Chart | Data source | Setup |
|---|---|---|
| Column chart: Minutes per day | Daily | Dimension `Date` (or `Day`), granularity **Date** · Metric `Est. minutes` (Sum) · Sort `Date` ascending · **Filter** Include `In view window` equals `Yes` |
| Stacked column: Items and actions per day | Daily | Dimension `Date` · Metrics `Items seen`, `Actions` (Sum) · same filter · Sort `Date` ascending |
| Pivot table with heatmap: Hour × weekday | Hourly | Row dimension `Hour` (ascending) · Column dimension `Weekday label` (ascending) · Metric `Count` (Sum) · totals off |
| Time series: Late-night share | Monthly | Dimension `Month date` (Year Month) · Metric `Late-night share` (Average, Percent) · outside the control's group |
| Time series: Minutes per active day | Monthly | Dimension `Month date` (Year Month) · Metric `Est. minutes per active day` (Average) · outside the control's group |

Trend charts outside the group still use their own **Default date range**. If one shows **No data**, remove its **Date range dimension** (✕), or set **Default date range** to **Custom**, starting on 1 Jan 2026 (before your first export) and ending **Today**.

### Page 3: Content and attention
First add `Month date` to **Top**, **Quiet interests** and **Actions** (Step 2 formula). The date control's group holds the three tables. The theme heatmap stays outside, because it shows every month.

| Chart | Data source | Setup |
|---|---|---|
| Table with bars: Most-seen accounts | Top | Dimensions `Name`, `Themes` · Metrics `Count` (bar), `Liked` · **Filter** Include `List` equals `Accounts seen` · Sort `Count` descending · 10 rows |
| Table: Quiet interests | Quiet interests | Dimensions `Account`, `You follow`, `Vs last month`, `Themes` · Metric `Times seen` (shown as bar) · Sort `Times seen` descending · 10 rows |
| Table: What you did | Actions | Dimensions `Date`, `Time`, `Type`, `Account / term`, `Detail` · no metric · Sort `Date` then `Time`, descending · 15 rows, wrap text |
| Pivot table with heatmap: Theme share by month | Themes | Row `Theme` · Column `Month date` (Year Month, ascending) · Metric `Seen share` (Average, Percent) · **Filter** Exclude `Theme` equals `Other` · Default date range Custom from 1 Jan 2026 · outside the group |

The theme mix is a heatmap, not a 100% stacked column: 13 themes would need 13 colours, too many to tell apart. One post can count toward several themes, so a month's column adds up to more than 100%.

### Page 4: Risks
Everything reads **Risks** (plus the Risk index card from **Monthly**). The date control's group holds all charts except the month-by-month heatmap.

| Chart | Data source | Setup |
|---|---|---|
| Scorecard: Risk index | Monthly | Copy from Page 1 |
| Bar chart (horizontal): Risk scores | Risks | Dimension `Risk` · Metric `Score` (Average) · Sort `Score` descending · 11 bars, no Others · X axis max 25 · reference lines at **10** "High" and **16** "Critical" |
| Bubble chart: Risk matrix | Risks | Dimension `Code` · X `Likelihood (spread)` · Y `Impact` · Size `Score` (all Average) · both axes 0.5–5.5 · data labels on |
| Table: Risk register | Risks | Dimensions `Code`, `Risk`, `Category`, `Rating`, `Trend` · Metrics `Likelihood`, `Impact`, `Score` · Sort `Score` descending · conditional formatting on `Rating` |
| Table: Act on these first | Risks | Dimensions `Risk`, `Rating`, `Evidence`, `Mitigation` · **Filter** Include `Rating` contains `High` OR `Rating` contains `Critical` · Sort `Score` descending · wrap text |
| Pivot table with heatmap: Risk score by month | Risks | Row `Risk` · Column `Month date` (Year Month, ascending) · Metric `Score` (Average) · Row sort by `Score` descending · Custom date range from 1 Jan 2026 · outside the group |

`Likelihood (spread)` is a calculated field on Risks: `Likelihood + (CAST(REGEXP_EXTRACT(Code, "[0-9]+") AS NUMBER) - 6) * 0.04`. It nudges each bubble sideways by up to ±0.2, so risks sharing a cell don't cover each other.

Risk over time is a heatmap, not an 11-line chart: 11 colours can't be told apart.

### Page 5: Profile
Everything reads **Profile** (add `Month date` first). Bars compare this month (`Score`) with last month (`Previous`). The date control's group holds all charts except the month-by-month heatmap.

| Chart | Data source | Setup |
|---|---|---|
| Bar chart (horizontal): Personality | Profile | **Filter** Include `Framework` contains `Personality` · Dimension `Dimension` · Metrics `Score`, `Previous` (Average) · Sort `Dimension` ascending · axis 0–100 · colours #2a78d6 / #c3c2b7 |
| Bar chart (horizontal): Desires | Profile | Same, **Filter** `Framework` contains `Desire` |
| Bar chart (horizontal): Emotional tone | Profile | Same, **Filter** `Framework` equals `Emotional tone` · no axis max (items per 100) |
| Table: How each score is computed | Profile | Dimensions `Framework`, `Dimension`, `How it is computed` · Metrics `Score`, `Change` · Sort `Framework` ascending |
| Radar (community visualization): Big Five | Profile | Toolbar community-viz icon → **Build your own visualization** → manifest path `gs://analytics_buddy_viz/radar-chart` (Michael Whitaker, MIT). Dimension `Month` · Metrics: 5 calculated fields, one per trait, each `CASE WHEN CONTAINS_TEXT(Dimension, "Openness") THEN Score ELSE NULL END` (Average) · Sort `Month` ascending · Style: colour scheme Tableau 10, max tick value `100`, tick step `20`, line type `linear-closed` |
| Pivot table with heatmap: Indicators by month | Profile | **Filter** Exclude `Framework` equals `Emotional tone` · Row `Dimension` · Column `Month date` (Year Month) · Metric `Score` (Average) · Custom date range from 1 Jan 2026 · outside the group |

---

## Step 5: Keep it fresh

- Looker caches sheet data, 15 minutes by default. To reload now, open **View** mode, click the **⋮** menu at the top right, and choose **Refresh data**.
- When a new export arrives, the date range control's **Last month** default already shows it.
- If a new version of the script adds columns, edit the data source and click **Refresh fields**.

## Privacy

A new report is private. If you share it, open **Resource → Manage added data sources → Edit** on each source and set **Data credentials** to **Viewer**. With the default **Owner** credentials, anyone you share the report with sees your data through your account.
