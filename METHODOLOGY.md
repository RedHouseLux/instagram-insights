# Methodology

***English** · [Italiano](METHODOLOGY.it.md)*

How Instagram Insights turns an export into numbers about you, and — the point of this document — how it keeps
**what Instagram showed you** apart from **what you did**. Every formula below is the one in `Code.gs`; the
function or constant to look for is named in each section.

## The problem this solves

Most of an Instagram export is a log of what reached your screen: posts, videos, stories and ads. What reaches
your screen is chosen mostly by the recommender, from what you and people like you engaged with before. A score
built from it describes the feed at least as much as it describes you.

Earlier versions did exactly that. Nine of the eleven personality and "desire" scores were the share of a theme
in what you were shown — *Agreeableness* was the share of Local & Community and Environment posts in your feed,
*Autonomy* the share of AI & Tech. Only two (late-night use, and the rate of likes and searches) came from
anything you did.

So the analysis is now split into **four layers**, plus the **influence** between them, and personality and
needs are read from behaviour only.

## The four layers

| Layer | The question | Read from |
|---|---|---|
| **Exposure** | What reached you? | posts viewed, videos watched, ads viewed, stories viewed — split into accounts you follow, recommended accounts, ads and stories |
| **Consumption behaviour** | How did you use it? | sessions, minutes, time of day, regularity, repeated viewing, searches, saves, links opened, unfollows, "not interested" |
| **Social behaviour** | What did you do toward people? | likes, liked comments, story likes, comments you wrote, direct messages you sent, conversations you started, follows, your own posts, stories and reels |
| **Inbound** | What did people do toward you? | direct messages you received, whether and how fast your messages were answered, reach, profile visits, interactions, followers |
| **Influence** | How do the first layer and the next two relate? | exposure against your chosen actions, per theme and over time |

The layers are never averaged into one score. Each dashboard section and each Profile row says which layer it
reads (`Layer` column).

### Where each export file goes

| File | Layer | Notes |
|---|---|---|
| `posts_viewed.html`, `videos_watched.html` | Exposure | ~7 days of history per export — the *viewing window* |
| `ads_viewed.html` | Exposure | |
| `stories_viewed.html` | Exposure | stories come from accounts you follow: the one view log of your own circle |
| `liked_posts.html`, `liked_comments.html`, `story_likes.html` | Social | approval you gave, visible to the author |
| `saved_posts.html` | Consumption | kept separate from likes: a save is a note to your future self, a like a signal to the author |
| `post_comments_N.html` | Social | your comments only; replies to them are not exported |
| `messages/inbox/*/message_N.html` | Social + Inbound | direct messages, both directions (see *Conversations*) |
| `profile_searches.html`, `word_or_phrase_searches.html` | Consumption | the strongest sign of self-initiated interest |
| `following.html`, `recently_unfollowed_profiles.html` | Consumption / Social | follows, unfollows, and who you followed *at the time* |
| `link_history.html` | Consumption | links opened in the in-app browser; account housekeeping (Google sign-in, Meta's Accounts Centre) is excluded |
| `posts_N.html`, `stories.html`, `reels.html`, `instagram_profile_information.html` | Social | what you published; the profile page gives the date of your last story |
| `profiles_reached.html`, `content_interactions.html`, `audience_insights.html` | Inbound | Instagram's own 90-day account numbers (see *Account performance*) |
| `note_and_repost_interactions.html` | Inbound | undated, so it feeds Belonging → Connected rather than any weekly score |

## Evidence rules

- **Every indicator carries its evidence count** (`Evidence` column, `n=` on the dashboard): the number of events
  it rests on.
- **Behaviour scores with fewer than `CONFIG.MIN_EVIDENCE` (3) events are left blank**, not zero. A share of two
  actions is not a measurement. Rate-type scores (per active day) need 3 active days instead.
- **Blank is not zero.** A week with no messages has no "reply rate", and the dashboard says so rather than drawing 0%.
- **Keyword rules are proxies.** Themes and emotional tones come from the word lists in the Settings tab.
  Captionless items inherit an account's usual themes only when that account has 3+ tagged items and the theme
  covers more than half of them.
- **Voice notes carry no text.** Tone of your own or other people's words is read from written text only.

## Personality and needs — from behaviour

Frameworks `Personality · Big Five (behaviour)` and `Needs · Self-Determination Theory (behaviour)`. All scores
are 0–100 and each row prints its own formula. They are indicators of how you *behave on Instagram* in one week or
month, not a personality test.

| Indicator | Formula | Evidence |
|---|---|---|
| **Openness** · breadth of what you seek | Normalised entropy of your chosen actions across themes, weighted by effort (`CONFIG.ACTION_WEIGHTS`: search 3, comment 3, save 2, follow 2, like 1, story like 1, liked comment 1), divided by log(min(themes, actions)) so few actions are not penalised for being few | themed actions |
| **Conscientiousness** · regular, bounded use | Average of: 1 − min(1, 4 × late-night share), and use regularity = 1 − min(1, coefficient of variation of daily minutes across the viewing window, quiet days included) | days in the viewing window |
| **Extraversion** · outbound social acts | (likes + liked comments + story likes + comments + messages sent + follows) per active day; 20 a day = 100 | active days |
| **Agreeableness** · responsiveness to others | Share of the other person's message turns you answered within `CONFIG.REPLY_WINDOW_HOURS` (24h) | their turns |
| **Emotional sensitivity** · strain in behaviour | Average of the parts with enough evidence: min(1, 4 × late-night share); share of your chosen items (likes, saves, comments, searches) carrying heavy tone (anxiety, sadness, anger, fear); share of your own written words carrying heavy tone. *Not a diagnosis.* | chosen items + your texts |
| **Autonomy** · self-directed consumption | (feed items from accounts you followed at the time + stories) ÷ (feed items + stories) | items |
| **Competence** · learning acts | (saves + links opened + questions you asked in comments or messages + word searches) per active day; 3 a day = 100 | active days |
| **Relatedness** · two-way contact | People you exchanged direct messages with in both directions; 5 = 100. Notes and reposts are left to Belonging → Connected: they carry no dates, so every week of a delivery would get the same list | active days |

"Followed at the time": the following list comes from the newest export, so an account you unfollowed *after* a
week is put back into that week's followed set using its unfollow date (`unfollowedAll` in `mergeForMonth_`).

## Feed diet — from exposure

Framework `Feed diet · what you were shown`, layer `Exposure`. These are the old theme-share indicators, renamed
to what they measure:

| Indicator | Formula |
|---|---|
| Curiosity range of the feed | 60% theme spread + 40% variety of accounts in what you were shown |
| Recommended share | items from accounts you did not follow ÷ items with a known account |
| Ad load | ads ÷ (items + ads) |
| Prosocial / Inner-life / Tech & building / Money & work / Community & music / Society & planet / Body & health / Arts & creativity content | the matching themes' share of items, scaled so 30–60% = 100 (each row states its reference) |

The risk register's exposure risks (emotional load, news diet, commercial pressure) read the same layer.

## Emotional tone — three readings

The same seven word lists (Settings → Emotion), read three ways:

- **Shown** (`Emotional tone · shown`, Exposure): items per 100 seen whose captions use the words.
- **Your words** (`Emotional tone · your words`, Social): per 100 of your comments and written messages.
- **Words to you** (`Emotional tone · words to you`, Inbound): per 100 written messages you received.

## Influence — the feed against your choices

**Action share and lift, per theme** (Themes tab). *Action share* is a theme's share of your weighted chosen
actions; *Lift* = action share ÷ seen share. Above 1 you go after the theme more than the feed shows it; below 1
the feed shows it more than you act on it. Lift is blank where the feed showed none of a theme: "sought, never
shown" is a different fact, not a big number. The dashboard draws both shares per theme as a dumbbell.

**Feed alignment** (Profile, `Influence`). 100 × (1 − total-variation distance) between two distributions over
the named themes: your weighted actions, and the items shown. 100 means you chose exactly in proportion to what
you were shown; lower means you went after things the feed was not giving you. High alignment is ambiguous on
its own — it can mean the feed learned you well, or that it is steering you — which is why the next two exist.

**Self-led discovery** (Profile, `Influence`). For each account you acted on this bucket (liked, saved,
commented, story-liked, followed) without already following it: **self-led** if you searched for it before your
first act, **feed-led** if the feed showed it to you first and you had not searched it. Anything else (met in a
story, a message, off Instagram) is neither and is not counted. Score = self-led ÷ (self-led + feed-led); counts
are in the Monthly/Weekly tabs.

**Direction of influence** (dashboard only, needs 12 consecutive weeks with ≥ 50% viewing coverage). Per theme,
week-to-week changes in seen share (Δe) and action share (Δa), pooled across themes:
- *feed leads you*: correlation of Δe in week *t* with Δa in week *t+1*;
- *you lead the feed*: correlation of Δa in week *t* with Δe in week *t+1*.

A correlation, not proof of cause; until 12 weeks exist the dashboard shows how many are on record.

## Conversations

From direct messages (`conversationStats_`). Message **text is read only to score tone and to count questions,
and is never written** to any tab, the Prompt, or the dashboard. What is stored per person per bucket
(Conversations tab): messages sent and received, voice notes each way, conversations, who started them, turns
answered each way, median reply times, and how many messages carried a heavy tone.

- A **turn** is a run of consecutive messages from one side: twelve voice notes in a row are one turn.
- A **conversation** is a run of turns with no silence longer than `CONFIG.CONVERSATION_GAP_HOURS` (8h).
- A turn is **answered** when the other side's next turn starts within `CONFIG.REPLY_WINDOW_HOURS` (24h).
- A turn that ends less than 24h before the export ends has not had its chance yet and **counts neither way**.
- "You" is recognised by your display name from `personal_information.html`; without that page, by being the one
  sender present in every thread.

**Belonging → Heard** is now measured: the share of your turns answered within 24h, with per-person detail. It
measures being *answered*, not being echoed or credited, and replies to your public comments are still not in
the export.

## Context triggers

What came just before what you did (`contextTriggers_`). Six outcomes, each counted against the contexts it could
have followed. **These are associations, not causes**: they say what goes together in your own data, not what makes
what happen — the feed that pulled you in may also be the feed you would have opened anyway.

| Outcome | Counted per | A hit is |
|---|---|---|
| **Pull** — opening the app | idle minute (a minute you were not already in a session) | a session starting in it |
| **Stay** — long sessions | session | minutes in the top quarter of the bucket's sessions (≥ its 75th percentile) |
| **Late** | session | starting 00:00–05:59 |
| **Act** — like, save, comment, follow, story like | item seen in a session | you acted on that item (same URL) or on its account within 30 minutes |
| **Seek** — search, link | item seen · session | a search or link in the 10 minutes after the item · anywhere in the session |
| **Reach** — message, comment | item seen · session | a message you sent or comment you wrote in the 10 minutes after · anywhere in the session |

**Contexts**, in five families:

- *When*: part of day (night 00–06, morning, afternoon, evening 18–24), weekday or weekend.
- *What came just before*: a message arriving in the 10 minutes before (Pull) or before a session started (Pulled
  by); your own post, story or reel in the hour before; what the session opened into (feed, stories, messages,
  search); coming back within 30 minutes of the last session; another story by the same account in the hour before.
- *What was on screen*: format (post, video, story, ad), whose it was (an account you follow, or one you don't),
  tone (heavy = the anxiety, sadness, anger and fear word lists; light = hope, joy, love), theme.
- *How the session began*: the same four, read over its **first five minutes** — a session's length is read
  against how it began, not against everything it went on to show (a long session shows more of everything).
  A quarter or more heavy items makes a heavy opening.
- *How far into a session*: the first 5 minutes, 5–20, past 20.

Each dimension splits the whole of its outcome's exposure, so its rows add up to the same total. "Opened into" is
left out of Seek and Reach, because a session opened by a search or a message contains one by definition.

**Method.** The sheet stores counts — *Exposure* and *Hits* per context (Triggers, Weekly triggers) — never rates,
so any range of buckets adds up exactly: Σ hits ÷ Σ exposure over its weeks or months. The **lift** of a context
is its rate against the outcome's overall rate across the same dimension, after shrinking it toward that overall
rate with three hits' worth of prior: with `p₀` the overall rate and `m = 3 / p₀`,
`lift = ((hits + m·p₀) / (exposure + m)) / p₀`. Two out of three cannot outrank thirty out of three hundred.

- **Evidence**: fewer than 3 hits is *too few* — shown dotted, never ranked; 3–9 is *some*; 10 or more is
  *strong*. A context that makes something rarer is shown by the absence of hits, so a dampener's evidence is the
  hits it would have had at the usual rate.
- **Ranking**: only lifts ≥ 1.25 (more often) or ≤ 0.8 (less often); strength = |ln lift|, × 0.6 for *some*.
  Contexts that are the absence of one ("nothing seen", "no story first") are counted but never ranked.
- **Social joins** are reported as shares with their counts: conversations you started within a day of that
  person's story (the thread is matched to the story by display name), likes within an hour of that account's
  story, sessions that began within 10 minutes of a message arriving, quick returns.
- **Acts on items seen / elsewhere**: a like or save either lands on something the view log holds (the same post,
  or its account in the half hour before) or comes from somewhere it never recorded — a profile, a share, the web.

Behaviour this rare accumulates slowly: a week holds 40–55 sessions, enough for session patterns within a few
weeks, but only a handful of deliberate acts, so act, seek and reach patterns build over months. The dashboard
says *too few* rather than guessing, and its range filter is how the evidence is pooled.

## Account performance

Performance tab, one row per 90-day window (`performanceRows_`, `upsertPerformance_`).

- **Rolling windows, not weeks.** Each export carries Instagram's cards for the 90 days ending the day before
  it. Weekly exports therefore give windows 7 days apart that **share 83 days**.
- **Sums vs unique counts vs levels.**
  - Impressions, profile visits, content interactions, link taps: sums over the window. Two windows must never
    be added. Their difference is *the week that joined minus the week that left* (13 weeks earlier), not the
    newest week — the dashboard labels it that way.
  - Accounts reached, accounts engaged: unique accounts; not additive at all.
  - Followers: a headcount on the day — the one ordinary time series.
- **Worked-out previous window.** Each card states its change against the previous 90 days. previous =
  value ÷ (1 + change), rounded, stored as a `Worked out` row for the window named in the card's "vs" line. At
  −100% nothing is worked out: the value fell to zero, which says nothing about what it fell from. The first
  export therefore draws a line, not a dot. A reported window always replaces a worked-out one for the same dates.
- **Rates** are steadier than counts: engagement rate = engaged ÷ reached; profile-visit rate = visits ÷ reached;
  non-follower share of reach, as reported.
- **Posting context.** Your last story date (profile information) is marked on the charts, and the dashboard says
  when the rolling window stops including it (last story + 90 days). A fall in interactions after that date is the
  window losing your last post, not your audience leaving.
- **Both languages.** Labels are matched ignoring case (English cards write "Accounts Reached", Italian "Account
  raggiunti"), and numbers are read with both separator conventions: "1,014" (English) and "1.130" (Italian) are
  thousands; "85.5%" and "85,8%" are decimals.

## Time

- **Buckets.** Every export is split by real timestamps into ISO weeks and calendar months (`mergeForMonth_`).
  Where two deliveries cover the same stretch of time, only the newer one's items for it are kept. Ownership is
  by *time*: each delivery owns the span from its first to its last item of each kind. (Ownership by calendar day
  dropped the older delivery's half of the day two weekly exports meet on — every week.)
- **Coverage** is days of viewing history ÷ days in the bucket. Below `CONFIG.MIN_TREND_COVERAGE` (50%) a bucket
  is written and shown, but drawn hollow and never used as a baseline.
- **Range filter.** *Last week* draws days; *8 weeks* and *6 months* draw weeks; *All* draws weeks up to about
  fourteen months, then months; *Custom* picks by length (≤ 14 days by day, ≤ ~6 months by week, else by month).
  Presets never reach back past the first export.
- **Your usual range** (the shaded band) is what the previous 8 usable periods covered, leaving out the single
  highest and lowest once there are six or more; it needs at least four. A ring marks a point outside it.
- **Gaps** are left as gaps: a missing week is not a zero.
- **Sessions** (`sessionsOf_`) are runs of activity with no silence longer than 15 minutes, read off every
  timestamp that shows you on the app: items seen and acted on, stories, ads and the messages you sent. Daily
  minutes, sessions per day and the Sessions tab all come from the one pass, so they always agree. Counting
  stories, ads and messages raised minutes and sessions per day against earlier versions, which counted feed
  items and acts only; the hour-of-day rhythm still counts items and acts.

## Privacy

Everything runs in your own Google account. Direct-message text is read in memory for tone and never stored.
The Prompt tab — the one piece of text meant to be pasted elsewhere — carries message counts and timings, never
content. `node test/run-local.js` checks that no message text appears in any cell.

## Limits

- Instagram keeps about 7 days of viewing history per export; weekly exports are what build a record.
- Minutes are a floor built from logged timestamps (a session ends after 15 minutes of silence). Time spent
  reading a message thread or an in-app link leaves no timestamp until you do something.
- Context triggers are associations within your own data, not causes.
- Your comments are exported; the threads they sat in, and replies to them, are not.
- Own posts, stories and reels are parsed from pages the weekly exports this was built on did not contain; they
  are counted by distinct timestamps and should be checked the first time they appear.
- Nothing here is a psychological assessment. Indicators describe behaviour on one app, in one period, through
  keyword rules.

## Changing it

| What | Where |
|---|---|
| Evidence threshold, reply window, conversation gap, action weights | `CONFIG` at the top of `Code.gs` |
| Indicator formulas | `profileDefs` in `analyzeExport_` |
| Trigger outcomes, contexts and thresholds | `contextTriggers_`, `TRIGGER_MIN_HITS`, `TRIGGER_STRONG` (and `rankTriggers` in `webapp/app.js`) |
| Layer metrics (Monthly/Weekly columns) | `layerColumns` in `analyzeExport_` |
| Themes, emotions, signals word lists | the Settings tab (then *Reprocess everything*) |
| Performance fields and labels | `PERF_FIELDS` |
| Dashboard charts and ranges | `webapp/app.js` (`TREND_LAYERS`, `PERF`, `trendPeriods`), then `node build/build-webapp.js` |
