/**
 * Instagram Insights
 *
 * Turns your monthly Instagram "Download your information" export (HTML format) into a
 * Google Sheets dashboard: what you watched and when, what you chose to like, follow and
 * search, rule-based behavioural indicators and risk signals, month over month.
 *
 * Everything runs inside your Google account; nothing is sent to an AI or any third party.
 * Setup steps are in README.md.
 */

// ── Configuration ────────────────────────────────────────────────────────────

const CONFIG = {
  // Drive folder you drop exports into. Leave the ID empty to use (or create) a folder with this name.
  EXPORTS_FOLDER_ID: '',
  EXPORTS_FOLDER_NAME: 'Instagram Exports',
  // Your timezone. Every hour and date in the sheet is shown in it.
  LOCAL_TIMEZONE: 'Europe/Rome',
  // Meta prints times in US Pacific time while labelling them "UTC". 'auto' works out the real
  // offset from each export's header. Put a timezone id here (e.g. 'America/Los_Angeles') to force one.
  EXPORT_TIMEZONE: 'auto',
  // Hour of the daily check for new exports, in LOCAL_TIMEZONE.
  CHECK_HOUR: 8,
  // Rows kept per ranking (top accounts, hashtags, advertisers).
  TOP_N: 25,
  // "Quiet interests": accounts seen at least this many times in the viewing window with no like, search or follow.
  QUIET_MIN_VIEWS: 5,
  // The viewing window (Instagram keeps about a week of view history) starts on the first day with this many items seen.
  VIEW_WINDOW_MIN_ITEMS: 5,
  // Network tab: the latest months that count as "recent" when deciding whether an account is active, quiet or dormant.
  NETWORK_RECENT_MONTHS: 3,
  // Language of the text this script WRITES into the sheet: 'en' or 'it'. It does not rename tabs or
  // columns — those are identifiers the rest of the code reads by, and translating them would break both
  // the pipeline and every sheet already in existence. The dashboard has its own, independent switch.
  // After changing this, run "Reprocess everything" so past buckets are rewritten in the new language.
  LANGUAGE: 'en',
  // Belonging → Connected: the number of distinct reciprocal contacts that scores 100. Not a finding about
  // people in general — it is the reference this dashboard measures breadth against, and the score is
  // meaningless without it, which is why the tab prints it beside every score.
  BELONGING_TIES_FULL: 15,
  // How much of a month's viewing history must be present before it is compared with another month. Coverage
  // is counted in days of view history (see mergeForMonth_), and Instagram only keeps about a week of it per
  // delivery — so a month reaches a high figure by accumulating several weekly deliveries, and one built from
  // a single delivery never will. Comparing a month seen for 7 days against one seen for 28 would read as a
  // behaviour change when it is only a difference in how much was collected. Below this, a month is still
  // written and still shown; it just doesn't carry a trend or stand in as the thing to compare against.
  MIN_TREND_COVERAGE: 0.5,
  // Stop starting new exports after this long, to stay under Apps Script's 6-minute limit.
  MAX_RUN_MS: 4.5 * 60 * 1000,
  // Looker Studio report to copy with "Create Looker Studio report": the ID in its URL
  // (lookerstudio.google.com/reporting/<ID>/...). Empty = a blank report with the tabs connected.
  LOOKER_TEMPLATE_REPORT_ID: '',
};

// ── Sheet layout ─────────────────────────────────────────────────────────────

const HEADERS = {
  Monthly: ['Month', 'Period start', 'Period end', 'Days', 'Coverage', 'Posts viewed', 'Videos watched', 'Items seen', 'Ads viewed',
    'Liked posts', 'Liked comments', 'New follows', 'Following total', 'New followers', 'Blocked', 'Reported / not interested',
    'Profile searches', 'Word searches', 'Seen per day', 'Active ratio', 'Late-night share', 'Late-night days', 'Active days',
    'Peak hour', 'Distinct accounts', 'Focus spread', 'Top theme', 'Top theme share',
    'Emerging theme', 'Emerging change', 'Ignored theme', 'Ignored gap', 'Cared-for theme', 'Cared-for gap',
    'Inherited tags', 'News share', 'Money & Work share',
    'Body-discomfort per 100', 'Anxiety & fear per 100', 'Sales-funnel per 100', 'Advertisers with your data',
    'Meta ad categories', 'New Meta labels', 'Quiet interests', 'Quiet share',
    'Est. minutes per active day', 'Sessions per active day', 'Top-5 accounts share', 'Risk index',
    'View window start', 'Viewing days', 'Month date'],
  Risks: ['Month', 'Code', 'Risk', 'Category', 'Likelihood', 'Impact', 'Score', 'Rating', 'Previous score', 'Trend', 'Evidence', 'Mitigation', 'Month date'],
  Signals: ['Month', 'Area', 'Signal', 'Value', 'Previous', 'Level', 'What it means', 'Try'],
  Profile: ['Month', 'Framework', 'Dimension', 'Score', 'Previous', 'Change', 'How it is computed', 'Month date'],
  Themes: ['Month', 'Theme', 'Seen', 'Seen share', 'Liked', 'Month date'],
  Subthemes: ['Month', 'Theme', 'Subtopic', 'Seen', 'Share of theme', 'Liked', 'Month date'],
  // Four dimensions of belonging, one row each, every bucket. Status is the load-bearing column: two of the
  // four dimensions have no substrate in an Instagram export at all, and the tab says so in a row rather
  // than dropping them — an absent row reads as "nothing to report", which is the opposite of the truth.
  Belonging: ['Month', 'Dimension', 'Status', 'Score', 'Headline', 'Evidence', 'What it measures', 'What it would take', 'Month date'],
  Rhythm: ['Month', 'Kind', 'Bucket', 'Label', 'Count'],
  Daily: ['Month', 'Date', 'Weekday', 'Items seen', 'Actions', 'Sessions', 'Est. minutes', 'Late-night items', 'In view window', 'Month date', 'Day'],
  Hourly: ['Month', 'Weekday no', 'Weekday', 'Hour', 'Count', 'Month date'],
  Top: ['Month', 'List', 'Rank', 'Name', 'Count', 'Liked', 'Themes', 'Month date'],
  'Quiet interests': ['Month', 'Rank', 'Account', 'Times seen', 'Posts', 'Videos', 'You follow', 'Themes', 'Vs previous', 'Latest caption', 'Month date'],
  Network: ['Account', 'Relation', 'Status', 'Cluster', 'Themes', 'Seen', 'Liked', 'Searched', 'Attention', 'Active months',
    'Last active', 'You follow since', 'Follows you since', 'Close friend', 'Blocked since', 'Region', 'Note', 'Profile',
    'In following list', 'In followers list', 'In close friends list'],
  Actions: ['Month', 'Date', 'Time', 'Type', 'Account / term', 'Themes', 'Detail', 'URL', 'Month date', 'Day'],
  Accounts: ['Month', 'Account', 'Seen', 'Posts', 'Videos', 'Liked', 'Searched', 'You follow', 'Themes', 'Month date'],
  Meta: ['Month', 'Type', 'Value', 'Status'],
  Prompt: ['Month', 'Text'],
  Settings: ['Kind', 'Name', 'Keywords'],
  Log: ['Source ID', 'Source name', 'Month', 'Period', 'Processed at', 'Result', 'Kind', 'Period start', 'Period end'],
};

// Weekly buckets carry the same measurements as monthly ones — they run through the same analyzeExport_ —
// so the columns are derived from Monthly rather than restated, and can never drift out of step with it.
// Each weekly child tab is its monthly twin with the two key columns swapped, which keeps column POSITIONS
// identical between the buckets. That is the invariant the rest of the weekly path leans on: writeWeekResult_
// stores a monthly-shaped row with only column 0 changed, and bucketFromRows_ reads either bucket with one
// set of indexes. Break the position match and both quietly read the wrong columns.
const weeklyHeadersOf_ = name =>
  HEADERS[name].map(h => (h === 'Month' ? 'Week' : h === 'Month date' ? 'Week start' : h));

HEADERS.Weekly = ['Week', 'Week start'].concat(HEADERS.Monthly.filter(h => h !== 'Month' && h !== 'Month date'));
HEADERS['Weekly themes'] = weeklyHeadersOf_('Themes');
HEADERS['Weekly subthemes'] = weeklyHeadersOf_('Subthemes');
HEADERS['Weekly top'] = weeklyHeadersOf_('Top');
// Seven days is a thin window for a risk register or a personality proxy, and an earlier version of this file
// withheld them for that reason. But analyzeExport_ computes all of it per bucket either way, so withholding
// only hid the numbers rather than making them sounder — and it hid them exactly when the dashboard went
// weekly-first, leaving five of its sections blank. They are stored now, and carry the same Coverage caveat a
// partial month does: read one week's Profile or Risks as provisional, not as a verdict.
HEADERS['Weekly risks'] = weeklyHeadersOf_('Risks');
HEADERS['Weekly signals'] = weeklyHeadersOf_('Signals');
HEADERS['Weekly profile'] = weeklyHeadersOf_('Profile');
HEADERS['Weekly quiet'] = weeklyHeadersOf_('Quiet interests');
HEADERS['Weekly hourly'] = weeklyHeadersOf_('Hourly');
HEADERS['Weekly belonging'] = weeklyHeadersOf_('Belonging');
// Rhythm and Meta earn a twin for one reason each, both about the PREVIOUS bucket rather than the current one:
// Rhythm is where bucketFromRows_ reads hours/weekdays back from, and Meta is what "New Meta labels" diffs
// against — without a weekly Meta every ad label would read as new again every single week.
HEADERS['Weekly rhythm'] = weeklyHeadersOf_('Rhythm');
HEADERS['Weekly meta'] = weeklyHeadersOf_('Meta');
// Daily and Actions need no weekly twin: their rows are keyed by real date, so a week selects them by range
// (see drawDaily). Accounts must NOT get one — updateNetwork_ sums that whole tab into per-account attention,
// so weekly rows beside monthly ones would count the same viewing twice. Prompt stays monthly on purpose.
const WEEKLY_CHILD_TABS = {
  'Weekly themes': 'Themes', 'Weekly subthemes': 'Subthemes', 'Weekly top': 'Top', 'Weekly risks': 'Risks', 'Weekly signals': 'Signals',
  'Weekly profile': 'Profile', 'Weekly quiet': 'Quiet interests', 'Weekly hourly': 'Hourly',
  'Weekly belonging': 'Belonging',
  'Weekly rhythm': 'Rhythm', 'Weekly meta': 'Meta',
};

const TEXT_COLUMNS = {
  Monthly: ['Month', 'Period start', 'Period end', 'Top theme', 'Emerging theme', 'Ignored theme', 'Cared-for theme', 'View window start'],
  Risks: ['Month', 'Code', 'Risk', 'Category', 'Rating', 'Trend', 'Evidence', 'Mitigation'],
  Signals: ['Month', 'Value', 'Previous'],
  Profile: ['Month'],
  Themes: ['Month'],
  Subthemes: ['Month', 'Theme', 'Subtopic'],
  Belonging: ['Month', 'Dimension', 'Status', 'Headline', 'Evidence', 'What it measures', 'What it would take'],
  Rhythm: ['Month', 'Label'],
  Daily: ['Month', 'Date', 'Weekday', 'In view window'],
  Hourly: ['Month', 'Weekday'],
  Top: ['Month', 'Name'],
  'Quiet interests': ['Month', 'Account', 'You follow', 'Themes', 'Vs previous', 'Latest caption'],
  Network: ['Account', 'Relation', 'Status', 'Cluster', 'Themes', 'Last active', 'You follow since', 'Follows you since',
    'Close friend', 'Blocked since', 'Region', 'Note', 'Profile', 'In following list', 'In followers list', 'In close friends list'],
  Actions: ['Month', 'Date', 'Time', 'Account / term', 'Detail'],
  Accounts: ['Month', 'Account', 'You follow', 'Themes'],
  Meta: ['Month', 'Value'],
  Prompt: ['Month', 'Text'],
  Settings: ['Keywords'],
  Log: ['Source ID', 'Month', 'Period', 'Processed at'],
};

const NUMBER_FORMATS = {
  Monthly: {
    Coverage: '0.0%',
    'Seen per day': '0.0', 'Active ratio': '0.0%', 'Late-night share': '0.0%', 'Focus spread': '0.00',
    'Top theme share': '0.0%', 'News share': '0.0%', 'Money & Work share': '0.0%', 'Quiet share': '0.0%',
    'Emerging change': '+0.0%;-0.0%;0.0%', 'Ignored gap': '0.0%', 'Cared-for gap': '0.0%',
    'Est. minutes per active day': '0.0', 'Sessions per active day': '0.0', 'Top-5 accounts share': '0.0%',
  },
  Themes: { 'Seen share': '0.0%' },
  Subthemes: { 'Share of theme': '0.0%' },
  Profile: { Score: '0', Previous: '0', Change: '+0;-0;0' },
  Log: { 'Period start': 'yyyy-mm-dd', 'Period end': 'yyyy-mm-dd' },
};
// Weekly tabs measure the same things as their monthly twins, so they format and protect the same columns.
// Deriving both tables rather than restating them is what stops a new Monthly column from being formatted
// correctly in one bucket and not the other.
NUMBER_FORMATS.Weekly = Object.assign({ 'Week start': 'yyyy-mm-dd' }, NUMBER_FORMATS.Monthly);
TEXT_COLUMNS.Weekly = ['Week'].concat(TEXT_COLUMNS.Monthly.filter(h => h !== 'Month'));
Object.keys(WEEKLY_CHILD_TABS).forEach(weekly => {
  const monthly = WEEKLY_CHILD_TABS[weekly];
  TEXT_COLUMNS[weekly] = (TEXT_COLUMNS[monthly] || []).map(h => (h === 'Month' ? 'Week' : h));
  const fmt = Object.assign({}, NUMBER_FORMATS[monthly] || {});
  if (HEADERS[weekly].indexOf('Week start') >= 0) fmt['Week start'] = 'yyyy-mm-dd';
  NUMBER_FORMATS[weekly] = fmt;
});

const DASHBOARD = 'Dashboard';
const CHART_DATA = '_charts';

// Chart palette (validated for colour-vision deficiency) and chrome.
const COLORS = {
  surface: '#fcfcfb', header: '#f0efec', ink: '#0b0b0b', ink2: '#52514e', muted: '#898781',
  grid: '#e1e0d9', baseline: '#c3c2b7', series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'], previous: '#c3c2b7',
  heatHigh: '#86b6ef',
  level: { OK: '#e3f4e3', Info: '#e8f1fc', Watch: '#fdf0cf', Alert: '#f9dcdc' },
};
const LEVEL = { OK: '✅ OK', Info: 'ℹ️ Info', Watch: '⚠️ Watch', Alert: '🔴 Alert' };

// ── Risk register ────────────────────────────────────────────────────────────
//
// Score = likelihood (1–5, from this month's data) × impact (1–5, fixed per risk).
// Likelihood starts at 1 and gains a point for every step the metric reaches (or falls below, when lowerIsWorse),
// plus one when `bump` applies. Rating: 1–4 Low · 5–9 Medium · 10–15 High · 16–25 Critical.

const RATING = [[4, '🟢 Low'], [9, '🟡 Medium'], [15, '🟠 High'], [25, '🔴 Critical']];
const RATING_COLORS = { Low: '#e3f4e3', Medium: '#fdf0cf', High: '#fde2d4', Critical: '#f9dcdc' };

/**
 * Italian for the text this script writes into the sheet, keyed by the exact English string. A key that is
 * missing falls through to English, so a half-finished translation degrades to readable rather than blank.
 *
 * Deliberately NOT covered: the one-line "evidence" and "what it means" sentences, which are built at
 * runtime with numbers interpolated into them. Those need the sentence itself parameterised before they can
 * be translated, which is a change to every risk and signal rather than a dictionary entry. They stay in
 * English for now, and that is visible rather than hidden.
 */
const SHEET_STRINGS = {
  it: {
    // ── Risk names ───────────────────────────────────────────────────────────
    'Excessive use': 'Uso eccessivo',
    'Sleep disruption': 'Disturbo del sonno',
    'Attention fragmentation': 'Frammentazione dell’attenzione',
    'Passive consumption': 'Consumo passivo',
    'Emotional load': 'Carico emotivo',
    'Negative news diet': 'Dieta di notizie negative',
    'Physical strain': 'Sforzo fisico',
    'Commercial manipulation': 'Manipolazione commerciale',
    'Data exposure': 'Esposizione dei dati',
    'Feed concentration': 'Concentrazione del feed',
    'Unwanted contact': 'Contatti indesiderati',
    // ── Categories and signal areas ──────────────────────────────────────────
    'Digital wellbeing': 'Benessere digitale',
    'Attention': 'Attenzione',
    'Mental health': 'Salute mentale',
    'Physical health': 'Salute fisica',
    'Money': 'Denaro',
    'Privacy': 'Privacy',
    'Information': 'Informazione',
    'Safety': 'Sicurezza',
    'Wellbeing': 'Benessere',
    'Body': 'Corpo',
    'Mind': 'Mente',
    'Social': 'Sociale',
    // ── Mitigations ──────────────────────────────────────────────────────────
    'Set a daily limit (Instagram → Settings → Time management, or Digital Wellbeing) and keep the app off the home screen.':
      'Imposta un limite giornaliero (Instagram → Impostazioni → Gestione del tempo, o Benessere digitale) e tieni l’app fuori dalla schermata principale.',
    'Phone out of the bedroom; app limit after 23:30.':
      'Telefono fuori dalla camera da letto; limite all’app dopo le 23:30.',
    'Choose 2–3 themes that serve your current goals; mute the rest for a month.':
      'Scegli 2–3 temi utili ai tuoi obiettivi attuali; silenzia il resto per un mese.',
    'Unfollow accounts you only scroll past; search for what you actually want to see.':
      'Smetti di seguire gli account che scorri e basta; cerca ciò che vuoi davvero vedere.',
    'Mute the accounts driving it (Top tab) and notice how you feel after scrolling.':
      'Silenzia gli account che lo alimentano (scheda Top) e osserva come ti senti dopo aver scrollato.',
    'Batch news into one daily slot, ideally not in bed.':
      'Concentra le notizie in un solo momento della giornata, possibilmente non a letto.',
    'If a symptom is real, book a physio or dentist; check desk and phone posture.':
      'Se un sintomo è reale, prenota un fisioterapista o un dentista; controlla la postura alla scrivania e col telefono.',
    'Wait 48 hours before paying for any course, coaching or product found in the feed.':
      'Aspetta 48 ore prima di pagare qualsiasi corso, percorso di coaching o prodotto trovato nel feed.',
    'Accounts Center → Ad preferences: remove advertisers and ad topics; disconnect off-Meta activity.':
      'Centro gestione account → Preferenze per le inserzioni: rimuovi inserzionisti e argomenti; scollega l’attività fuori da Meta.',
    'Balance the top accounts with sources that see things differently.':
      'Bilancia gli account principali con fonti che la vedono diversamente.',
    'Tighten who can message and tag you (Settings → Messages and story replies).':
      'Restringi chi può scriverti e taggarti (Impostazioni → Messaggi e risposte alle storie).',
    // ── Signal names ─────────────────────────────────────────────────────────
    'Late-night activity (00:00–05:59)': 'Attività notturna (00:00–05:59)',
    'Items seen per day': 'Elementi visti al giorno',
    'Active vs passive': 'Attivo contro passivo',
    'Quiet interests': 'Interessi silenziosi',
    'Focus spread': 'Dispersione del focus',
    'Body-discomfort content': 'Contenuti su disturbi fisici',
    'Anxiety & fear tone': 'Tono di ansia e paura',
    'News load': 'Carico di notizie',
    'Sales-funnel exposure': 'Esposizione a funnel di vendita',
    'Money & work focus': 'Focus su denaro e lavoro',
    'Advertisers holding your data': 'Inserzionisti che detengono i tuoi dati',
    'New Meta labels': 'Nuove etichette Meta',
    'Blocked or reported': 'Bloccati o segnalati',
    // ── Signal tips ──────────────────────────────────────────────────────────
    'Phone out of the bedroom, or an app limit after 23:30.':
      'Telefono fuori dalla camera, o un limite all’app dopo le 23:30.',
    'If it jumped, see which theme grew in Themes.':
      'Se è salito di colpo, guarda quale tema è cresciuto nella scheda Themes.',
    'Unfollow accounts you never engage with.':
      'Smetti di seguire gli account con cui non interagisci mai.',
    'Ask why you keep watching the top ones; mute any that drain you.':
      'Chiediti perché continui a guardare i primi; silenzia quelli che ti prosciugano.',
    'Pick the 2–3 themes that serve what you are building now.':
      'Scegli i 2–3 temi utili a ciò che stai costruendo adesso.',
    'If the symptom is real, a physio or dentist beats more reels.':
      'Se il sintomo è reale, un fisioterapista o un dentista vale più di altri reel.',
    'Mute the accounts driving it (see Top).':
      'Silenzia gli account che lo alimentano (vedi Top).',
    'Batch news into one daily slot.':
      'Concentra le notizie in un solo momento della giornata.',
    'Treat coaching funnels as ads, not as care or a plan.':
      'Tratta i funnel di coaching come pubblicità, non come cura o come un piano.',
    'Name the decision behind it and give it a date.':
      'Dai un nome alla decisione che c’è dietro e mettici una data.',
    'Accounts Center → Ad preferences: review and hide advertisers.':
      'Centro gestione account → Preferenze per le inserzioni: controlla e nascondi gli inserzionisti.',
    'Full list in the Meta tab.': 'Elenco completo nella scheda Meta.',
    'Details in Actions.': 'Dettagli nella scheda Actions.',
    // ── Belonging ────────────────────────────────────────────────────────────
    'Connected': 'Connesso',
    'Seen': 'Visto',
    'Heard': 'Ascoltato',
    'Invested in': 'Investito',
    'Measured': 'Misurato',
    'Proxy only': 'Solo indiretto',
    'Not measurable yet': 'Non ancora misurabile',
    'Not in this export': 'Non presente in questo export',
    'No data this bucket': 'Nessun dato in questo intervallo',
  },
};

/** Translate one sheet string. Unknown keys and English both return the input unchanged. */
function T_(text) {
  const table = SHEET_STRINGS[CONFIG.LANGUAGE];
  return (table && table[text] !== undefined) ? table[text] : text;
}

const RISKS = [
  { code: 'R1', name: 'Excessive use', category: 'Digital wellbeing', impact: 3,
    metric: 'Est. minutes per active day', steps: [15, 30, 60, 120],
    bump: (m, pm) => pm && pm['Seen per day'] > 0 && m['Seen per day'] > pm['Seen per day'] * 1.4,
    evidence: m => `About ${m['Est. minutes per active day']} min per active day in ${m['Sessions per active day']} sessions; ${m['Seen per day']} items a day. A floor: Instagram logs only a sample.`,
    mitigation: 'Set a daily limit (Instagram → Settings → Time management, or Digital Wellbeing) and keep the app off the home screen.' },
  { code: 'R2', name: 'Sleep disruption', category: 'Digital wellbeing', impact: 4,
    metric: 'Late-night share', steps: [0.02, 0.05, 0.12, 0.25],
    evidence: m => `${fmtVal_(m['Late-night share'], 'pct')} of activity between 00:00 and 05:59, on ${m['Late-night days']} days.`,
    mitigation: 'Phone out of the bedroom; app limit after 23:30.' },
  { code: 'R3', name: 'Attention fragmentation', category: 'Attention', impact: 2,
    metric: 'Focus spread', steps: [0.85, 0.9, 0.95, 0.97],
    evidence: m => `Focus spread ${m['Focus spread']} across ${m['Distinct accounts']} accounts.`,
    mitigation: 'Choose 2–3 themes that serve your current goals; mute the rest for a month.' },
  { code: 'R4', name: 'Passive consumption', category: 'Attention', impact: 2,
    metric: 'Active ratio', steps: [0.10, 0.05, 0.02, 0.01], lowerIsWorse: true,
    bump: m => m['Quiet share'] >= 0.4,
    evidence: m => `You acted on ${fmtVal_(m['Active ratio'], 'pct')} of items; ${fmtVal_(m['Quiet share'], 'pct')} came from quiet interests.`,
    mitigation: 'Unfollow accounts you only scroll past; search for what you actually want to see.' },
  { code: 'R5', name: 'Emotional load', category: 'Mental health', impact: 3,
    metric: 'Anxiety & fear per 100', steps: [5, 10, 15, 20],
    evidence: m => `${m['Anxiety & fear per 100']} items per 100 with anxiety, danger or threat language.`,
    mitigation: 'Mute the accounts driving it (Top tab) and notice how you feel after scrolling.' },
  { code: 'R6', name: 'Negative news diet', category: 'Mental health', impact: 3,
    metric: 'News share', steps: [0.10, 0.15, 0.25, 0.35],
    evidence: m => `${fmtVal_(m['News share'], 'pct')} of items from news and current-affairs sources.`,
    mitigation: 'Batch news into one daily slot, ideally not in bed.' },
  { code: 'R7', name: 'Physical strain', category: 'Physical health', impact: 3,
    metric: 'Body-discomfort per 100', steps: [1, 2, 4, 7],
    evidence: m => `${m['Body-discomfort per 100']} items per 100 about pain, posture, jaw or sleep problems.`,
    mitigation: 'If a symptom is real, book a physio or dentist; check desk and phone posture.' },
  { code: 'R8', name: 'Commercial manipulation', category: 'Money', impact: 3,
    metric: 'Sales-funnel per 100', steps: [5, 8, 12, 18],
    evidence: m => `${m['Sales-funnel per 100']} items per 100 push "comment X", workshops or link-in-bio offers; ${m['Ads viewed']} ads seen.`,
    mitigation: 'Wait 48 hours before paying for any course, coaching or product found in the feed.' },
  { code: 'R9', name: 'Data exposure', category: 'Privacy', impact: 3,
    metric: 'Advertisers with your data', steps: [100, 500, 1000, 2000],
    bump: m => m['New Meta labels'] >= 3,
    evidence: m => `${m['Advertisers with your data']} advertisers hold data that matched you; ${m['New Meta labels']} new Meta labels this month.`,
    mitigation: 'Accounts Center → Ad preferences: remove advertisers and ad topics; disconnect off-Meta activity.' },
  { code: 'R10', name: 'Feed concentration', category: 'Information', impact: 2,
    metric: 'Top-5 accounts share', steps: [0.15, 0.25, 0.35, 0.5],
    evidence: m => `Your 5 most-seen accounts make up ${fmtVal_(m['Top-5 accounts share'], 'pct')} of items.`,
    mitigation: 'Balance the top accounts with sources that see things differently.' },
  { code: 'R11', name: 'Unwanted contact', category: 'Safety', impact: 3,
    metric: 'Blocked or reported', steps: [1, 3, 6, 11],
    evidence: m => `${m['Blocked']} accounts blocked, ${m['Reported / not interested']} posts reported or marked not interested.`,
    mitigation: 'Tighten who can message and tag you (Settings → Messages and story replies).' },
];

// ── Themes and word lists (seeded into the Settings tab, edit them there) ────
//
// Keyword syntax:  word  → matches words starting with it (psicolog → psicologia, psicologo)
//                  "word" → whole word only            @account → posts from that account
//                  #tag   → that hashtag

const T = {
  tech: 'AI & Tech', money: 'Money & Work', psych: 'Psychology & Relationships', science: 'Science & Brain',
  health: 'Health & Body', politics: 'Politics & Society', news: 'News', music: 'Music & Nightlife',
  comedy: 'Comedy & TV', arts: 'Arts, Film & Design', env: 'Environment & Solarpunk', local: 'Local & Community',
  travel: 'Travel & Places',
};

const DEFAULT_RULES = [
  ['Theme', T.tech, '"ai", intelligenza artificiale, artificial intelligence, chatgpt, openai, anthropic, "claude", "gemini", "llm", machine learning, coding, coder, "code", developer, sviluppator, programmazione, programmatore, programming, programmer, software, startup, "tech", techy, tecnolog, technolog, robot, automazion, automation, vibecoding, dataviz, "data", nocode, "saas", @datapizza, @power.ai, @codingknowledge, @it.italiantech, @wired, @wireditalia, @codeebot'],
  ['Theme', T.money, 'soldi, "money", finanz, financ, econom, invest, borsa, "stock", trading, crypto, bitcoin, risparm, "saving", stipend, salar, lavoro, lavorat, "job", "jobs", carriera, career, concors, posto fisso, business, "impresa", "imprese", imprendit, entrepreneur, "azienda", "aziende", "tasse", "tax", patrimonial, mutuo, inflazion, inflation, pension, @startingfinance, @pillole.di.economia, @ingegneri_in_borsa, @the_financial_adviser, @nabila.finanza, @moneysurfers, @obiettivo_postofisso'],
  ['Theme', T.psych, 'psicolog, psycholog, psichiatr, psychiatr, psicoterap, terapi, therap, ansia, anxiety, trauma, relazion, relationship, coppia, "partner", gelosia, jealous, compersion, attaccament, attachment, autostima, self-esteem, selfconfidence, crescitapersonale, crescita personale, personal growth, benessere emotivo, benessereemotivo, benesserepsicologico, salute mentale, salutementale, mental health, mentalhealth, mindfulness, meditazion, meditation, burnout, emozion, emotion, sessuolog, educazionesessuale, educazione sessuale, sessualit, sexual, consenso, lovebombing, love bombing, narcis, bambino interiore, inner child, journaling, @psicoadvisor, @sessuologia, @mysecretcase, @psicologi.italia'],
  ['Theme', T.science, 'scienz, scientif, science, neuro, cervello, brain, ricerca, research, fisica, physics, astronom, astrofis, "spazio", "space", nasa, biolog, chimic, chemistr, genetic, "dna", evoluzion, evolution, @geopop, @neuroscienza.it, @thereasonroomphysics'],
  ['Theme', T.health, 'salute, health, "pain", dolore, schiena, back pain, backpain, postur, cervical, allenament, workout, fitness, palestra, "gym", "abs", addominal, obliqu, dimagr, weight loss, alimentazion, nutrizion, nutrition, dieta, "diet", sonno, "sleep", caffein, longevit, biohack, bruxism, "denti", dentist, oralhealth, skincare, @backpainadvice, @longevity.swiss, @palestraculture, @abs_exercise, @teodora.wellnesscoach'],
  ['Theme', T.politics, 'politic, elezion, election, governo, government, parlament, "destra", sinistra, partito, diritti, "rights", societa, society, sociolog, antropolog, anthropolog, migra, guerra, "war", riarmo, israel, palestin, gaza, ucrain, ukrain, trump, meloni, schlein, "europa", "europe", "ue", "eu", mattarella, sindacat, sciopero, protest, attivis, activis, femmin, feminis, patriarc, transgender, "lgbt", razzism, racism, mafia, disuguaglianz, inequal, salario minimo, minimum wage, @_poterealpopolo, @europeancommission, @europeanparliament, @piueuropa, @oxfamitalia, @scomodo'],
  ['Theme', T.news, 'notizi, "news", attualit, cronaca, breaking, "tg", giornal, @fanpage.it, @torcha, @internazionale, @il_post, @lindipendente.online, @factanza, @factanza.academy, @ilsole_24ore, @will_ita, @vdnews, @rivistastudio, @irpimedia, @column.news, @reportrai3, @siamozeta'],
  ['Theme', T.music, 'music, musica, festival, "dj", djset, dj set, techno, "house", techhouse, housemusic, "rave", concert, "live", "album", "rap", "trap", sound, electronic, elettronic, @woodstarzfestival, @culturrave, @waofestivalofficial, @soundofhousemusic, @napolitan_sound'],
  ['Theme', T.comedy, 'comedy, comic, sitcom, "funny", divertent, "meme", memes, memeitalian, satira, satire, "lol", ridere, risate, standup, stand-up, cabaret, serie tv, serietv, tvseries, familyguy, @_the_jackal, @thatsfabofficial, @dadaemarcolino, @edoardo.tavassi'],
  ['Theme', T.arts, '"art", "arte", artist, artwork, design, cinema, "film", "films", movie, fotograf, photograph, "photo", animazion, animation, "anime", illustraz, illustrat, museo, museum, mostra, exhibition, teatro, theatre, theater, filmmak, videomak, cinematic, "camera", motion design, digitalart, projectionmapping, videomapping, @arundo.art, @low_budget_filmmaking, @video_production_school, @camera.setup, @refikanadol, @studioghibli.it'],
  ['Theme', T.env, 'solarpunk, "clima", climate, climatic, crisiclimatica, ambiente, environment, ecolog, sostenib, sustainab, "green", "natura", "nature", rinnovabil, renewable, zero waste, zerowaste, riciclo, recycl, biodivers, fairtrade, commercio equo, permacult, agricoltura, @greenpeace, @italiachecambia, @vivovero.it, @wfto_europe'],
  ['Theme', T.local, 'letino, forzaletino, matese, gallo matese, "caserta", "campania", "napoli", napoletan, "sud", mezzogiorno, "borgo", "borghi", comunita, community, associazion, volontar, oratori, youthwork, youth work, educazione non formale, educazionenonformale, politiche giovanili, politichegiovanili, pro loco, sagra, @asd_letino, @jobba_letino, @letino_fresh_memes, @comune_di_gallo_matese_, @network_giovani_campania, @onlus_matese_vita'],
  ['Theme', T.travel, 'viagg, "travel", travell, "trip", vacanz, holiday, "volo", flight, "hike", hiking, trekking, backpack, relocat, trasferir, expat, "abroad", "estero", "roma", "rome", milano, "milan", berlin, luxembourg, lussemburgo, "ibiza", "tulum", airbnb, "booking", @relocante.life, @relocante.it, @hikealex, @travelbloggers.co'],

  // Subtopics: "Parent > Child". Share is of the parent theme, so these answer "what KIND of AI & Tech",
  // which a flat list of thirteen themes cannot. Italian and English keywords both, because Meta localises
  // the export while keeping its structure — an Italian-only feed would otherwise match almost nothing.
  // Seeded thinly on purpose: three or four per theme that are worth separating, not an exhaustive taxonomy.
  // Add your own rows in the Settings tab; the parent must match a Theme row's name exactly.
  ['Subtopic', 'AI & Tech > AI models & tools', 'chatgpt, openai, claude, anthropic, gemini, "llm", "gpt", copilot, midjourney, prompt, intelligenza artificiale, artificial intelligence, machine learning, "ai"'],
  ['Subtopic', 'AI & Tech > Startups & product', 'startup, founder, fondator, "saas", "mvp", prodotto digitale, product manager, venture, "vc", round, seed, pitch'],
  ['Subtopic', 'AI & Tech > Code & building', 'codic, coding, programmaz, programming, sviluppator, developer, "dev", github, python, javascript, "api", open source, opensource'],
  ['Subtopic', 'AI & Tech > Gadgets & platforms', 'iphone, android, samsung, apple, visore, headset, smartphone, tablet, laptop, "chip", nvidia, tesla'],
  ['Subtopic', 'Money & Work > Investing & markets', 'invest, borsa, azioni, "etf", "bond", mercat, market, portafogli, portfolio, dividend, cripto, crypto, bitcoin, trading'],
  ['Subtopic', 'Money & Work > Careers & jobs', 'lavoro, "job", career, carriera, colloqui, interview, assunz, hiring, curriculum, "cv", licenziam, layoff, stipendio, salary, "ral"'],
  ['Subtopic', 'Money & Work > Business & economy', 'azienda, impresa, business, fatturato, revenue, economia, economy, "pil", "gdp", inflazion, inflation, acquisiz, acquisition, fondo, private equity'],
  ['Subtopic', 'Money & Work > Personal finance', 'risparmi, saving, budget, mutuo, mortgage, prestit, loan, tasse, "tax", pension, debito, "debt", bolletta'],
  ['Subtopic', 'Politics & Society > Rights & justice', 'diritti, rights, giustizi, justice, discrimin, razzism, racism, femminis, feminis, "lgbt", queer, disabilit, uguaglianz, equality'],
  ['Subtopic', 'Politics & Society > War & conflict', 'guerra, "war", conflitt, conflict, gaza, palestin, israel, ucrain, ukrain, russia, missil, bombard, armi, "nato"'],
  ['Subtopic', 'Politics & Society > Institutions & elections', 'govern, parlament, elezion, election, vot, "voto", partito, party, ministr, sindac, mayor, referendum, "ue", european union'],
  ['Subtopic', 'Politics & Society > Migration & borders', 'migrant, migrazion, immigra, rifugiat, refugee, frontier, border, "cpr", sbarchi, asilo, asylum'],
  ['Subtopic', 'Psychology & Relationships > Anxiety & therapy', 'ansia, anxiety, terapi, therap, psicolog, psycholog, panico, "panic", trauma, "ptsd", counseling, psichiatr'],
  ['Subtopic', 'Psychology & Relationships > Couples & dating', 'coppia, "partner", relazion, relationship, dating, fidanzat, matrimoni, marriage, gelosi, jealous, lovebombing, love bombing, ghosting'],
  ['Subtopic', 'Psychology & Relationships > Self & growth', 'autostima, self-esteem, selfconfidence, crescita personale, crescitapersonale, personal growth, bambino interiore, inner child, journaling, mindfulness, meditazion, meditation, abitudin, habit'],
  ['Subtopic', 'Psychology & Relationships > Family & parenting', 'famigli, family, genitor, parent, figli, mamma, papà, madre, padre, infanzi, childhood, educazion'],
  ['Subtopic', 'News > Italy', 'italia, italian, roma, milano, napoli, torino, sicilia, campania, lombardia, "rai", comune, regione, questura'],
  ['Subtopic', 'News > World', 'mondo, world, internazional, international, "usa", stati uniti, cina, china, europa, europe, africa, medio oriente, middle east'],
  ['Subtopic', 'News > Crime & safety', 'omicid, murder, femminicid, rapina, furto, arrest, indagin, processo, "trial", violenz, aggress, sicurezza'],
  ['Subtopic', 'Health & Body > Fitness & movement', 'palestra, "gym", allenamento, workout, training, corsa, running, "yoga", pilates, forza, strength, muscol, muscle'],
  ['Subtopic', 'Health & Body > Food & nutrition', 'aliment, nutrizion, nutrition, diet, protein, cibo, "food", ricett, recipe, zucchero, sugar, integrator, supplement'],
  ['Subtopic', 'Health & Body > Sleep & rest', 'sonno, "sleep", dormire, riposo, "rest", insonn, insomnia, stanchezz, fatigue, recupero, recovery'],
  ['Subtopic', 'Health & Body > Medicine & symptoms', 'medic, doctor, dottor, sintom, symptom, malatti, disease, dolor, "pain", diagnos, farmac, terapia, ospedal'],
  ['Subtopic', 'Arts, Film & Design > Film & series', 'film, "movie", cinema, serie, series, "netflix", regist, director, attore, attrice, actor, trailer, oscar'],
  ['Subtopic', 'Arts, Film & Design > Design & visual', 'design, grafic, graphic, illustrazion, illustration, tipograf, typograph, brand, logo, architettur, architecture, fotograf, photograph'],
  ['Subtopic', 'Arts, Film & Design > Books & writing', 'libro, libri, "book", lettura, reading, scrittur, writing, autor, author, romanzo, novel, poesia, poetry, editori'],
  ['Subtopic', 'Local & Community > Neighbourhood & city', 'quartiere, "neighbourhood", vicinato, comune, città, "city", piazza, mercato, "market", locale, "local"'],
  ['Subtopic', 'Local & Community > Volunteering & mutual aid', 'volontari, volunteer, associazion, association, mutuo soccorso, mutual aid, raccolta fondi, fundrais, donazion, solidarietà, solidarity, "onlus", "aps"'],
  ['Subtopic', 'Local & Community > Events & gatherings', 'event, "festa", festival, incontro, meetup, assemblea, raduno, sagra, workshop, laboratorio'],
  ['Subtopic', 'Environment & Solarpunk > Climate & energy', 'clima, climate, riscaldamento globale, global warming, emission, "co2", rinnovabil, renewable, solare, "solar", eolic, wind, energia'],
  ['Subtopic', 'Environment & Solarpunk > Repair & reuse', 'riparaz, repair, riuso, reuse, ricicl, recycl, second hand, usato, rigenerat, refurbish, zero waste, "riparare"'],
  ['Subtopic', 'Environment & Solarpunk > Nature & food growing', 'orto, "garden", giardin, permacultur, permacultur, semina, coltiv, "grow", biodivers, foresta, forest, natura, "nature"'],
  ['Subtopic', 'Science & Brain > Physics & space', 'fisica, physics, quantis, quantum, spazio, "space", astronom, universo, universe, pianeta, planet, "nasa", relativit'],
  ['Subtopic', 'Science & Brain > Biology & brain', 'cervell, "brain", neuro, neuron, biolog, biology, genetic, "dna", evoluzion, evolution, cellul, "cell"'],
  ['Subtopic', 'Music & Nightlife > Live & clubs', 'concerto, concert, "live", "dj", "club", discotec, festival, palco, "stage", tour, biglietti, tickets'],
  ['Subtopic', 'Music & Nightlife > Artists & releases', 'album, singolo, single, brano, "track", canzone, "song", cantante, singer, rapper, band, uscita, release, "spotify"'],
  ['Subtopic', 'Comedy & TV > Stand-up & sketch', 'comic, comedy, standup, stand-up, cabaret, sketch, parodia, parody, satira, satire, battuta, "meme"'],
  ['Subtopic', 'Comedy & TV > Shows & reality', 'programma, "show", reality, talent, puntata, episode, "tv", conduttor, host, televisione'],
  ['Subtopic', 'Travel & Places > Trips & destinations', 'viaggio, viaggi, "travel", vacanz, holiday, volo, "flight", hotel, itinerari, destinazion, destination, spiaggia, beach'],
  ['Subtopic', 'Travel & Places > Outdoors & hiking', 'montagna, mountain, trekking, hiking, sentier, "trail", escursion, cammino, bivacco, camping, campeggio, rifugio'],
  ['Emotion', 'Anxiety & stress', 'ansia, ansios, anxiety, anxious, stress, panico, "panic", preoccup, "worry", worried, burnout, overthink, insonn, insomnia, agitazion, sopraffatt, overwhelm'],
  ['Emotion', 'Sadness & loneliness', 'triste, tristezz, "sad", sadness, solitudin, "lonely", loneliness, depress, pianto, piangere, "cry", crying, lutto, "grief", vuoto interiore, delusion, disappoint, nostalgi, abbandon'],
  ['Emotion', 'Anger & injustice', 'rabbia, arrabbi, "anger", "angry", ingiust, injustic, indign, furios, "furious", scandal, vergogn, sfrutt, exploit, disuguaglianz, inequal, corrot, corrupt, "odio", "hate"'],
  ['Emotion', 'Fear & threat', 'paura, "fear", pericol, danger, minacc, threat, violen, crimin, omicid, murder, femminicid, guerra, "war", terror, allarm, "alarm", catastrof, apocal'],
  ['Emotion', 'Hope & growth', 'speranz, "hope", futur, cresc, growth, rinasc, possibil, cambiament, "change", sogn, "dream", solarpunk, ispira, inspir, obiettiv, "goal", improve, opportunit'],
  ['Emotion', 'Joy & fun', 'gioia, "joy", felic, happy, happiness, divert, "fun", funny, ridere, "laugh", risate, festa, "party", "vibes", bellezz, beautiful, meraviglios, wonderful, entusias'],
  ['Emotion', 'Love & connection', 'amore, "love", amicizi, "amico", "amici", friend, insieme, together, comunita, communit, famigli, family, relazion, relationship, affett, abbracc, "hug", legame, "bond", gratitud, grateful, "grazie"'],

  ['Signal', 'Body discomfort', 'dolore, "pain", back pain, backpain, schiena, cervical, postur, lombal, sciatic, ernia, bruxism, digrign, mal di testa, emicrania, headache, migrain, insonn, insomnia, reflusso, gastrit, tendinit, @backpainadvice'],
  ['Signal', 'Sales funnel', '"commenta", "comment", link in bio, linkinbio, workshop gratuito, free workshop, webinar, masterclass, scrivimi, "dm me", posti limitati, limited spots, iscriviti, "sign up", percorso che ti ho riservato, sconto esclusivo'],
];

// ── Menu, setup and the scheduled job ────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Instagram Insights')
    .addItem('Setup (run once)', 'setup')
    .addItem('Process new exports now', 'processNewExports')
    .addItem('Rebuild dashboard', 'buildDashboard')
    .addItem('Create Looker Studio report', 'createLookerStudioReport')
    .addItem('Open network view', 'openNetworkView')
    .addSeparator()
    .addItem('Reprocess everything', 'reprocessAll')
    .addItem('Start fresh (wipe, then rebuild from Drive)', 'startFresh')
    .addToUi();
}

function setup() {
  const ss = SpreadsheetApp.getActive();
  const folder = getExportsFolder_();
  Object.keys(HEADERS).forEach(name => ensureSheet_(name));
  seedSettings_();
  ['Sheet1', 'Foglio1', 'Foglio 1'].forEach(n => {
    const s = ss.getSheetByName(n);
    if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });

  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'processNewExports')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('processNewExports').timeBased().everyDays(1)
    .atHour(CONFIG.CHECK_HOUR).inTimezone(CONFIG.LOCAL_TIMEZONE).create();

  buildDashboard();
  alert_('Setup done.\n\nDrop each monthly Instagram export (the .zip, HTML format) into this Drive folder:\n'
    + folder.getUrl() + '\n\nNew exports are picked up every day around ' + CONFIG.CHECK_HOUR
    + ':00, or right away with Instagram Insights → Process new exports now.');
}

/** The tabs a Looker Studio report reads, in the order they are connected. */
const LOOKER_TABS = ['Monthly', 'Risks', 'Daily', 'Hourly', 'Themes', 'Top', 'Quiet interests', 'Profile', 'Actions'];

/**
 * Opens a new Looker Studio report with every tab in LOOKER_TABS already connected as a data source,
 * using the Looker Studio Linking API. Charts and pages are then built in Looker Studio (see LOOKER_STUDIO.md).
 * With LOOKER_TEMPLATE_REPORT_ID set, it opens a copy of that report instead: the template's data sources
 * (aliases ds0…ds8, in LOOKER_TABS order) are swapped for this sheet's tabs, keeping their fields and calculated fields.
 */
function createLookerStudioReport() {
  const ss = SpreadsheetApp.getActive();
  const template = CONFIG.LOOKER_TEMPLATE_REPORT_ID;
  const params = ['r.reportName=' + encodeURIComponent('Instagram Insights'), 'c.mode=edit'];
  if (template) params.push('c.reportId=' + encodeURIComponent(template));
  LOOKER_TABS.forEach((name, i) => {
    const ds = 'ds.ds' + i + '.';
    params.push(ds + 'connector=googleSheets', ds + 'spreadsheetId=' + ss.getId(),
      ds + 'worksheetId=' + ensureSheet_(name).getSheetId(), ds + 'datasourceName=' + encodeURIComponent('Instagram Insights · ' + name));
    if (template) params.push(ds + 'refreshFields=false');
  });
  const url = 'https://lookerstudio.google.com/reporting/create?' + params.join('&');
  try {
    SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(
      `<p style="font:14px Arial">${template ? 'A copy of the Instagram Insights report, connected to this sheet,' : `A new report with ${LOOKER_TABS.length} data sources`} is ready.</p>`
      + `<p style="font:14px Arial"><a href="${url}" target="_blank">Open it in Looker Studio</a>, then click <b>Edit and share</b> to save it.</p>`)
      .setWidth(420).setHeight(140), 'Create Looker Studio report');
  } catch (e) {
    console.log(url);
  }
  return url;
}

/**
 * Empties every computed tab, then rebuilds from whatever Drive currently holds. Deleting an export from
 * Drive does not remove what was already computed from it — the two drift apart silently — and this is what
 * brings them back into line. Deliberately kept separate from "Reprocess everything", which recomputes the
 * same exports and never destroys anything.
 *
 * Two things survive on purpose: Settings, which holds the keyword rules you wrote, and the Region and Note
 * columns of the Network tab, which are the only fields in the whole spreadsheet a person types by hand.
 * Everything else can be rebuilt from the exports; those cannot.
 */
function startFresh() {
  const keep = { Settings: true, Network: true, Dashboard: true, _charts: true };
  Object.keys(HEADERS).filter(name => !keep[name]).forEach(name => {
    const sh = ensureSheet_(name);
    const rows = sh.getLastRow() - 1;
    if (rows > 0) sh.getRange(2, 1, rows, HEADERS[name].length).clearContent();
  });
  resetNetworkLists_(); // clears the network's own counts while keeping what you typed into it
  setPendingMonths_([]);
  processNewExports();
}

function reprocessAll() {
  const log = ensureSheet_('Log');
  if (log.getLastRow() > 1) log.getRange(2, 1, log.getLastRow() - 1, HEADERS.Log.length).clearContent();
  resetNetworkLists_();
  setPendingMonths_([]); // a fresh pass owes nothing from before; every month is rediscovered from the sources
  processNewExports();
}

/**
 * Checks the exports folder (after sweeping strays into it, see sweepStrayExports_) and processes anything
 * new. Called by the daily trigger and the "Process new exports now" menu item, neither of which reads a
 * return value, and by the dashboard's "Refresh now" button (via checkForNewExports, in Dashboard.gs), which
 * does: { busy: true } if another run is already in progress, otherwise { busy: false, sourcesFound, processed }.
 */
function processNewExports() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { busy: true, sourcesFound: 0, processed: 0 };
  try {
    const started = Date.now();
    PARSE_CACHE = {};
    const exportsFolder = getExportsFolder_();
    const stray = sweepStrayExports_(exportsFolder);
    const done = processedSourceIds_();
    const sources = findExportSources_(exportsFolder).filter(s => !done.has(s.id));
    // Months left owing by an earlier run that ran out of budget are work in their own right: this run has
    // something to do even when Drive holds nothing new.
    const pending = pendingMonths_();
    if (!sources.length && !pending.length) {
      toast_('No new exports in the folder.');
      return { busy: false, sourcesFound: 0, processed: 0, stray: stray };
    }
    const rules = loadRules_();
    const parsed = [];
    for (const src of sources) {
      if (Date.now() - started > CONFIG.MAX_RUN_MS) break;
      try {
        const files = readExportFiles_(src);
        if (!files['start_here.html']) {
          const why = files.__json ? 'this export is in JSON format; request it again as HTML' : 'no Instagram HTML export found';
          writeLog_(src, '', '', 'Skipped: ' + why);
          continue;
        }
        parsed.push({ src: src, exp: parseExport_(files) });
      } catch (e) {
        writeLog_(src, '', '', 'Error: ' + e.message);
      }
    }
    // Oldest first, so each month can compare itself with the one before.
    parsed.sort((a, b) => a.exp.periodStart - b.exp.periodStart);
    const dated = parsed.filter(item => hasDatedActivity_(item.exp));
    const undated = parsed.filter(item => !hasDatedActivity_(item.exp));
    // What writeLog_'s `dated` argument needs to find this exact source again later, as a contributor to
    // whichever month(s) it touches (see sourcesForMonth_) — independent of what a given run's Result summarizes.
    const sourceLog = item => ({ kind: item.src.kind, periodStart: item.exp.periodStart, periodEnd: item.exp.periodEnd });
    // Says so plainly when the dates came from the activity rather than from the export's own header, so a
    // month built on an inferred span is never mistaken for one Instagram actually dated.
    const periodLabel = item => fmtDate_(item.exp.periodStart) + ' → ' + fmtDate_(item.exp.periodEnd)
      + (item.exp.periodInferred ? ' (inferred from activity)' : '');

    undated.forEach(item => {
      // No `dated` argument here, deliberately: an all-time export must never be discoverable as a month
      // contributor (sourcesForMonth_ only considers Log rows that have Kind/Period start/Period end), since
      // its "period" is really just its request timestamp, not a real span of days to decompose or own.
      writeLog_(item.src, '', item.exp.allTime ? 'All time' : periodLabel(item),
        `OK: connections only (${item.exp.following.length} following, ${item.exp.followers.length} followers)`);
    });

    // Every dated source is recorded the moment it parses, rather than only once all of its months finish.
    // The old rule lost entire runs: a delivery touching more months than one 4.5-minute budget allows was
    // never written to the Log at all, so the next run rediscovered it as new, re-read it from scratch, and
    // got no further — forever. A real run left the Log holding one error row and nothing else while six
    // parsed deliveries went unrecorded. Logging here also makes each source resolvable by sourcesForMonth_
    // on later runs, which is what lets a backlog of months be finished without the source in hand.
    dated.forEach(item => {
      const months = monthsTouched_(item.exp);
      writeLog_(item.src, months.join(', '), periodLabel(item),
        `OK: ${months.length} month(s) queued`, sourceLog(item));
    });

    // One calendar month is processed exactly once per run, no matter how many of this run's dated sources
    // touch it — a delivery whose period crosses a month boundary (or a yearly export touching a dozen)
    // otherwise reprocesses the same month repeatedly, each time redoing work the previous pass already did.
    // Months owed from earlier runs go first so a backlog drains instead of growing.
    // Months and weeks go through the identical loop below — mergeForMonth_, analyzeExport_ and
    // sourcesForMonth_ all read the bucket type off the key's shape. Weeks come from where activity actually
    // is (weeksTouched_), so a delivery adds one or two of them rather than one per week it nominally spans.
    const monthsThisRun = unique_(pending
      .concat(dated.reduce((acc, item) => acc.concat(monthsTouched_(item.exp)), []))
      .concat(dated.reduce((acc, item) => acc.concat(weeksTouched_(item.exp)), []))).sort();
    let remaining = monthsThisRun.slice();
    const perSource = {};
    dated.forEach(item => { perSource[item.src.id] = []; });

    for (const month of monthsThisRun) {
      if (Date.now() - started > CONFIG.MAX_RUN_MS) break; // what's left stays in PENDING_MONTHS for the next run
      const contributors = sourcesForMonth_(month, dated);
      if (!contributors.length) {
        remaining = remaining.filter(m => m !== month);
        setPendingMonths_(remaining);
        continue;
      }
      const merged = mergeForMonth_(month, contributors);
      // A month the delivery's period spans but carries no activity for gets no row at all. A yearly export
      // touches 13 months and only holds view history for about one of them, so writing the rest would add a
      // dozen months of zeroes to the Monthly tab and the dashboard's month picker. It still counts as done
      // for the source, or the source would never finish all its months and would be reprocessed forever.
      const note = merged.itemCount === 0 ? `${month} (nothing in it)`
        : merged.coverage < 1 ? `${month} (partial, ${Math.round(merged.coverage * 100)}% of the month)` : month;
      if (merged.itemCount) {
        const result = analyzeExport_(merged, rules, loadPreviousBucket_(month));
        if (WEEK_KEY.test(month)) writeWeekResult_(month, result);
        else writeResult_(result);
      }
      contributors.forEach(c => { if (perSource[c.src.id]) perSource[c.src.id].push(note); });
      // Saved per month, not once at the end: an execution killed at Apps Script's own 6-minute ceiling never
      // reaches the end, and Properties writes land immediately where Sheet writes are still buffered. This is
      // what makes progress survive a kill.
      remaining = remaining.filter(m => m !== month);
      setPendingMonths_(remaining);
    }
    setPendingMonths_(remaining);

    // Sources that got at least one month done this run have their queued row replaced with what actually
    // landed. Ones still waiting keep the queued row, which already records their period and kind.
    dated.forEach(item => {
      const done = perSource[item.src.id];
      if (!done.length) return;
      writeLog_(item.src, monthsTouched_(item.exp).join(', '),
        periodLabel(item),
        `OK: ${done.join('; ')}`, sourceLog(item));
    });
    if (parsed.length) {
      const network = { id: 'network', name: 'Network' };
      try {
        const count = updateNetwork_(parsed.map(p => p.exp));
        writeLog_(network, '', '', `OK: network rebuilt (${count} accounts)`);
      } catch (e) {
        writeLog_(network, '', '', 'Error building the network: ' + e.message);
      }
      const dashboard = { id: 'dashboard', name: 'Dashboard' };
      try {
        buildDashboard();
        writeLog_(dashboard, '', '', 'OK: dashboard rebuilt');
      } catch (e) {
        writeLog_(dashboard, '', '', 'Error building the dashboard: ' + e.message);
      }
      toast_(`Processed ${parsed.length} export(s).`);
    }
    return { busy: false, sourcesFound: sources.length, processed: parsed.length, stray: stray };
  } finally {
    lock.releaseLock();
  }
}

// ── Drive ────────────────────────────────────────────────────────────────────

function getExportsFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = CONFIG.EXPORTS_FOLDER_ID || props.getProperty('EXPORTS_FOLDER_ID');
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (e) {
      // Folder deleted or not accessible: fall through and find or create one by name.
    }
  }
  const byName = DriveApp.getFoldersByName(CONFIG.EXPORTS_FOLDER_NAME);
  const folder = byName.hasNext() ? byName.next() : DriveApp.createFolder(CONFIG.EXPORTS_FOLDER_NAME);
  props.setProperty('EXPORTS_FOLDER_ID', folder.getId());
  return folder;
}

/**
 * Meta's own "send to Google Drive" delivery can't be pointed at a specific folder: it drops a folder named
 * like "meta-2026-Sep-15-08-24-40" at the top of My Drive, holding the export folder itself one level down.
 * This finds those by name and moves every one of them into the exports folder, so they end up grouped in one
 * place and the normal pipeline below picks up the readable ones in the same run. Grouping is the whole point
 * and is decided on the name alone: whether a delivery can actually be *parsed* is a separate question, asked
 * afterwards only to report the answer, never to decide whether the delivery moves. (An earlier version had
 * it the other way round, and a JSON delivery therefore sat at the root forever - tidy Drive is worth having
 * even for a month this can't read.) Anything not named like a Meta delivery is left untouched. Returns
 * counts so the caller (and the dashboard's "Check Drive now") can show what happened, not run invisibly.
 *
 * It reads the top of My Drive directly rather than searching Drive for "meta". A search is both slower and
 * far less precise: on a real account, "name contains 'meta'" matched 1,697 items, nearly all of them files
 * called METADATA inside a synced Python virtualenv. Listing the root is bounded by how many things you keep
 * at the top of your Drive, which is always small.
 */
// Meta's own Drive delivery names what it creates like "meta-2026-Sep-15-08-30-00": "meta", then straight
// into a 4-digit year, then a month. Matching that shape - not just "the name contains meta" - is what keeps
// this both fast and safe: Drive's search has to be a broad substring match ("meta" alone also matches
// "Metadata", "MetaMask", "Automated", and so on), but this second, local check means we only ever open a
// file or walk into a folder for something that actually looks like Meta's own naming, never a same-named
// but unrelated (and possibly sensitive, e.g. a wallet backup) folder that happened to match the substring.
// The year/month are unconstrained (any year, any month), so this keeps matching every future export on its
// own - nothing here is tied to any one date. The month accepts a 3-9 letter name (Sep, September, dec, ...)
// or a 1-2 digit number (09), to allow for Meta changing the exact date format without changing the prefix.
// (No trailing \b: for regex, "_" counts as a word character, so "...dec_31" is not a word boundary after
// "dec" - a plain unanchored match avoids that trap rather than relying on one.)
const META_DELIVERY_NAME = /^meta[-_ ]?\d{4}[-_ ]?(?:[a-z]{3,9}|\d{1,2})/i;
// A hard ceiling on how long this may run, independent of CONFIG.MAX_RUN_MS (which budgets the whole
// processNewExports call), so an unexpectedly crowded Drive root can never make this feel hung.
const SWEEP_MAX_MS = 20 * 1000;

function sweepStrayExports_(exportsFolder) {
  const started = Date.now();
  const exportsId = exportsFolder.getId();
  const stats = { found: 0, ignored: 0, moved: 0, alreadyIn: 0, watching: 0, jsonFormat: 0, timedOut: false };

  // These only ever *describe* a delivery that has already been moved - none of them decides whether it moves.
  // They're logged with a "Noted:" prefix, deliberately not "OK"/"Skipped", because processedSourceIds_ treats
  // those two as "never look at this again"; a delivery still filling up needs to stay re-checkable.
  const note = (item, name, message) => writeLog_({ id: item.getId(), name: name }, '', '', `Noted: ${message}`);

  const consider = (item, isFolder) => {
    if (Date.now() - started > SWEEP_MAX_MS) { stats.timedOut = true; return; }
    stats.found++;
    const name = item.getName();
    // A name that isn't shaped like Meta's own delivery is left completely untouched: not opened, not
    // moved, not logged - it's someone else's folder that merely happens to start with "meta".
    if (!META_DELIVERY_NAME.test(name)) { stats.ignored++; return; }
    // Being in the folder already is the only thing that makes this a no-op, and it's also what makes the
    // sweep idempotent: once something is moved it is inside, so no later run touches it again. Notably this
    // does NOT consult the Log - tidying Drive is about where a delivery sits, not about whether it was ever
    // read, and gating the move on the Log is what previously stranded an unreadable delivery at the root.
    if (isInsideFolder_(item, exportsId)) { stats.alreadyIn++; return; }

    // The move is the job: everything Meta names like a delivery gets grouped under Instagram Exports,
    // readable or not, because Instagram's own settings give no way to choose a destination folder.
    moveIntoFolder_(item, exportsFolder, isFolder);
    stats.moved++;

    // Only now, and only to report it: can the pipeline actually read what just moved? A zip is left to the
    // normal pass right after this (which opens it anyway) rather than unzipped twice.
    if (!isFolder) return;
    const found = classifyDelivery_(item);
    if (found && found.ref) return; // readable HTML - the normal pass picks it up from its new home
    if (found && found.kind === 'json') {
      // Meta will happily deliver JSON instead of HTML, and every parser here reads HTML - starting with
      // start_here.html, the only place the account name, period and timezone come from.
      stats.jsonFormat++;
      note(item, name, `moved "${name}" into ${exportsFolder.getName()}. It's Meta's JSON export and this `
        + 'needs HTML - request that month again from Instagram choosing Format: HTML');
    } else {
      stats.watching++;
      note(item, name, `moved "${name}" into ${exportsFolder.getName()}. Nothing readable inside it yet - `
        + 'Drive may still be filling it in');
    }
  };

  const root = DriveApp.getRootFolder();
  const folders = root.getFolders();
  while (folders.hasNext() && !stats.timedOut) consider(folders.next(), true);
  const files = root.getFiles();
  while (files.hasNext() && !stats.timedOut) consider(files.next(), false);

  stats.checked = stats.moved + stats.alreadyIn;
  return stats;
}

/**
 * Works out what a Meta delivery folder actually holds: a readable HTML export (as a folder or a .zip),
 * Meta's JSON export (which nothing here can read), or nothing recognisable yet. The export sits one level
 * down, in a folder of its own like "instagram-<name>-2026-09-15-96i1YbQm", so this checks the delivery
 * folder itself and then its immediate subfolders.
 */
function classifyDelivery_(wrapper) {
  const direct = findExportInFolder_(wrapper);
  if (direct) return direct;
  let sawJson = folderHasJson_(wrapper);
  const subs = wrapper.getFolders();
  while (subs.hasNext()) {
    const sub = subs.next();
    const found = findExportInFolder_(sub);
    if (found) return found;
    if (!sawJson) sawJson = folderHasJson_(sub);
  }
  return sawJson ? { kind: 'json' } : null;
}

/**
 * True if this folder, or any of its immediate subfolders, holds a .json file — the shape of Meta's JSON
 * export. Deliberately bounded: it only ever looks at a handful of folders and files, never a whole tree.
 */
function folderHasJson_(folder) {
  if (hasJsonFile_(folder)) return true;
  const subs = folder.getFolders();
  let seen = 0;
  while (subs.hasNext() && seen++ < 12) {
    if (hasJsonFile_(subs.next())) return true;
  }
  return false;
}

function hasJsonFile_(folder) {
  const files = folder.getFiles();
  let seen = 0;
  while (files.hasNext() && seen++ < 50) {
    if (/\.json$/i.test(files.next().getName())) return true;
  }
  return false;
}

/** True if `item` opens as a zip and contains start_here.html — the one real signature of an export. */
function validatedZip_(item, name) {
  const mime = item.getMimeType();
  const looksLikeZip = /\.zip$/i.test(name) || mime === 'application/zip' || mime === 'application/x-zip-compressed';
  if (!looksLikeZip || item.getSize() > 25 * 1024 * 1024) return false;
  try {
    return !!readExportFiles_({ id: item.getId(), name: name, kind: 'zip', ref: item })['start_here.html'];
  } catch (e) {
    return false; // not a readable zip, or some other surprise
  }
}

/**
 * Looks directly inside `folder` (not recursively) for the export itself: either start_here.html sitting
 * right there (an already-unzipped export), or a .zip file that validates. Covers both shapes Meta's own
 * "send to Google Drive" delivery might produce: the export dropped loose, or wrapped in a folder first.
 */
function findExportInFolder_(folder) {
  if (folder.getFilesByName('start_here.html').hasNext()) return { kind: 'folder', ref: folder };
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    if (validatedZip_(f, f.getName())) return { kind: 'zip', ref: f };
  }
  return null;
}


function isInsideFolder_(item, folderId) {
  const parents = item.getParents();
  while (parents.hasNext()) if (parents.next().getId() === folderId) return true;
  return false;
}

/** Moves a File or Folder into `destination`, using DriveApp's oldest, most universally available API. */
function moveIntoFolder_(item, destination, isFolder) {
  const parents = item.getParents();
  while (parents.hasNext()) {
    const parent = parents.next();
    if (isFolder) parent.removeFolder(item); else parent.removeFile(item);
  }
  if (isFolder) destination.addFolder(item); else destination.addFile(item);
}

/** Exports are .zip files, or unzipped folders with start_here.html at their top, up to three folders deep. */
function findExportSources_(folder) {
  const sources = [];
  const walk = (parent, depth, prefix) => {
    const files = parent.getFiles();
    while (files.hasNext()) {
      const f = files.next();
      const mime = f.getMimeType();
      if (/\.zip$/i.test(f.getName()) || mime === 'application/zip' || mime === 'application/x-zip-compressed') {
        sources.push({ id: f.getId(), name: prefix + f.getName(), kind: 'zip', ref: f });
      }
    }
    const subs = parent.getFolders();
    while (subs.hasNext()) {
      const sub = subs.next();
      if (sub.getFilesByName('start_here.html').hasNext()) {
        sources.push({ id: sub.getId(), name: prefix + sub.getName(), kind: 'folder', ref: sub });
      } else if (depth < 3) {
        walk(sub, depth + 1, prefix + sub.getName() + '/');
      }
    }
  };
  walk(folder, 1, '');
  return sources;
}

function readExportFiles_(src) {
  const files = {};
  if (src.kind === 'zip') {
    Utilities.unzip(src.ref.getBlob().setContentType('application/zip'))
      .forEach(b => addExportFile_(files, b.getName(), () => b.getDataAsString('UTF-8')));
  } else {
    const walk = folder => {
      const it = folder.getFiles();
      while (it.hasNext()) {
        const f = it.next();
        addExportFile_(files, f.getName(), () => f.getBlob().getDataAsString('UTF-8'));
      }
      const subs = folder.getFolders();
      while (subs.hasNext()) walk(subs.next());
    };
    walk(src.ref);
  }
  return files;
}

/**
 * The only pages parseExport_ ever reads. Everything else in an export is skipped without being downloaded:
 * a real delivery carries ~320 HTML files and this list is 18 of them, so fetching the rest cost one Drive
 * round trip each and held megabytes of strings in memory for nothing. In a yearly export the single
 * largest file is stories_viewed.html at 3.4 MB — which nothing here parses.
 * Keep this in step with parseExport_: a page added there but missing here silently reads as empty.
 */
const WANTED_EXPORT_FILES = new Set([
  'start_here.html',
  'posts_viewed.html', 'videos_watched.html', 'ads_viewed.html', 'posts_you_re_not_interested_in.html',
  'liked_posts.html', 'saved_posts.html', 'liked_comments.html',
  'following.html', 'followers.html', 'blocked_profiles.html', 'close_friends.html',
  'profile_searches.html', 'word_or_phrase_searches.html',
  'other_categories_used_to_reach_you.html', 'locations_of_interest.html',
  'advertisers_using_your_activity_or_information.html', 'profile_based_in.html',
  // The belonging sources. These four are the only pages in an export that carry anything INBOUND — what
  // other people did toward you — as opposed to the consumption telemetry every other page holds.
  'note_and_repost_interactions.html',
  'content_interactions.html', 'profiles_reached.html', 'audience_insights.html',
]);

/** Collects export files by base name; followers_1.html, followers_2.html… are grouped as followers.html. */
function addExportFile_(files, path, read) {
  const base = String(path).split('/').pop();
  if (/\.json$/i.test(base)) files.__json = true;
  if (!/\.html$/i.test(base)) return;
  const key = /^followers_\d+\.html$/i.test(base) ? 'followers.html' : base;
  // Checked before read() is called, so an unwanted page is never fetched at all — this is the whole saving.
  if (!WANTED_EXPORT_FILES.has(key.toLowerCase())) return;
  (files[key] = files[key] || []).push(read());
}

// ── Parsing the HTML export ──────────────────────────────────────────────────

/**
 * Month abbreviations as Instagram writes them, keyed by their first three letters in lower case.
 * Meta localises the export to the account's language while leaving the surrounding structure in place, so
 * an Italian export dates its entries "set 13, 2026 3:28 am" — English shape, Italian month. With only the
 * English names here every timestamp in such an export silently became the Unix epoch: the entries parsed,
 * the counts were right, and every date was 1970.
 *
 * Only English and Italian are listed because those are the two this has been checked against. Adding more
 * languages blind would be a mistake, not a kindness: French "jui" is the first three letters of both juin
 * and juillet, so a guessed entry would quietly file June activity under July. parseEntryTime_ returns null
 * for anything absent here, which loses the timestamp honestly instead of inventing one.
 */
const MONTHS = {
  jan: 0, gen: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4, mag: 4,
  jun: 5, giu: 5,
  jul: 6, lug: 6,
  aug: 7, ago: 7,
  sep: 8, set: 8,
  oct: 9, ott: 9,
  nov: 10,
  dec: 11, dic: 11,
};
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ENTRY_TIME_RE = />\s*([A-Z][a-z]{2} \d{1,2}, \d{4} \d{1,2}:\d{2}[\s\u202f]*[ap]m)\s*</gi;

function parseExport_(files) {
  const header = parseHeader_(files['start_here.html'][0]);
  const tz = CONFIG.EXPORT_TIMEZONE === 'auto' ? header.tz : CONFIG.EXPORT_TIMEZONE;
  const ts = s => parseEntryTime_(s, tz);
  const each = (name, fn) => (files[name] || []).flatMap(html => fn(html, ts));

  const lists = each('other_categories_used_to_reach_you.html', html => parseLists_(html));
  const locations = each('locations_of_interest.html', html => parseLists_(html));
  const advertisers = each('advertisers_using_your_activity_or_information.html', html => parseLists_(html))
    .flatMap(section => section.items.map(name => ({
      name: name,
      type: /interaction|website|app or store/i.test(section.label)
        ? 'Advertiser (your visits to their site or app)' : 'Advertiser (uploaded a list that matched you)',
    })));
  const basedIn = (files['profile_based_in.html'] || []).map(html =>
    ['City', 'Region', 'Country'].map(label => field_(html, label)).filter(Boolean).join(', '))[0] || '';

  const exp = {
    owner: header.owner,
    allTime: header.allTime,
    exportTimezone: tz,
    periodStart: header.periodStart,
    periodEnd: header.periodEnd,
    month: '', // set below, once the period is known — it may still have to be inferred
    likedPosts: each('liked_posts.html', parseMedia_).concat(each('saved_posts.html', parseMedia_)),
    likedComments: each('liked_comments.html', parsePeople_),
    postsViewed: each('posts_viewed.html', parseMedia_),
    videosWatched: each('videos_watched.html', parseMedia_),
    adsViewed: each('ads_viewed.html', parseMedia_),
    notInterested: each('posts_you_re_not_interested_in.html', parseMedia_),
    following: each('following.html', parsePeople_),
    followers: each('followers.html', parsePeople_),
    blocked: each('blocked_profiles.html', parsePeople_),
    // null when the export has no close friends page, so an absent page doesn't read as "no close friends".
    closeFriends: files['close_friends.html'] ? each('close_friends.html', parsePeople_) : null,
    profileSearches: each('profile_searches.html', parsePeople_),
    wordSearches: each('word_or_phrase_searches.html', parseWordSearches_),
    metaCategories: unique_(lists.flatMap(s => s.items)),
    locationsOfInterest: unique_(locations.flatMap(s => s.items)),
    advertisers: advertisers,
    basedIn: basedIn,
    // ── Belonging sources ──────────────────────────────────────────────────────────────────────────────
    // notes carries named, reciprocal contact; the three cards carry Instagram's own inbound counts. Each
    // card is null when its page is absent from the delivery, which is normal — Meta only ships the
    // "past Instagram insights" pages for accounts that have them, and a missing card must not read as 0.
    notes: each('note_and_repost_interactions.html', html => parseNotes_(html)),
    reachCard: (files['profiles_reached.html'] || []).map(parseInsightCard_)[0] || null,
    interactionCard: (files['content_interactions.html'] || []).map(parseInsightCard_)[0] || null,
    audienceCard: (files['audience_insights.html'] || []).map(parseInsightCard_)[0] || null,
  };

  // Some exports arrive with no date range at all: Meta ships more than one start_here.html template, and one
  // of them is a plain index of the download with no "Generated by … on" header and no <time> tags (confirmed
  // against a real delivery — three <time> tags in one export, zero in another from the same account). Rather
  // than lose the whole delivery, take the period from the activity itself, which is the same evidence every
  // other part of this pipeline already trusts: items carry their own timestamps, and months are assembled
  // from those, not from what the header claimed.
  if (!exp.periodStart || !exp.periodEnd) {
    const found = inferPeriod_(exp);
    if (!found) throw new Error('export has no date range in its header and no dated activity to infer one from');
    exp.periodStart = found.start;
    exp.periodEnd = found.end;
    exp.periodInferred = true;
  }
  exp.month = Utilities.formatDate(new Date((exp.periodStart.getTime() + exp.periodEnd.getTime()) / 2),
    CONFIG.LOCAL_TIMEZONE, 'yyyy-MM');
  return exp;
}

/**
 * The span of an export's own dated activity: first timestamp to last. Deliberately not rounded up to the
 * following day — that would push the period into the next calendar month whenever the last activity fell on
 * a month's final day, and monthsTouched_ would then process a month the export holds nothing for. The last
 * day still counts as covered: mergeForMonth_ marks a day known when an item lands on it, not only when the
 * declared period steps over it. Returns null when nothing carries a date, the one case that can't be saved.
 */
function inferPeriod_(exp) {
  let min = null;
  let max = null;
  DAY_LOG_FIELDS.forEach(field => (exp[field] || []).forEach(item => {
    if (!item.time) return;
    if (min === null || item.time < min) min = item.time;
    if (max === null || item.time > max) max = item.time;
  }));
  return min === null ? null : { start: min, end: max };
}

function parseHeader_(html) {
  // "Generated by <name> on" in English, "Archivio generato da <name> in data:" in Italian.
  const owner = ((html || '').match(/Generated by\s+([^\s<]+)\s+on/)
    || (html || '').match(/generato da\s+([^\s<]+)\s+in data/i) || [])[1] || '';
  const times = Array.from((html || '').matchAll(/<time datetime="([^"]+)">([^<]+)<\/time>/g));
  // No timestamps at all means Meta used its index-style start_here.html, which states no dates anywhere.
  // Hand back a period-less header and let parseExport_ infer the span from the activity instead of losing
  // the delivery. There is no offset to read either, so fall back to the sheet's own timezone: Instagram
  // renders these pages in the account's local time, which is the same clock CONFIG.LOCAL_TIMEZONE names.
  if (!times.length) {
    return {
      owner: owner,
      allTime: false,
      periodStart: null,
      periodEnd: null,
      offsetMin: 0,
      tz: CONFIG.LOCAL_TIMEZONE,
    };
  }
  const generated = new Date(times[0][1]);
  const shown = parseHeaderDate_(decodeHtml_(times[0][2]));
  const offsetMin = shown === null ? 0 : Math.round((shown - generated.getTime()) / 60000);
  // An "All time" export may print no date range at all.
  const allTime = times.length < 3;
  return {
    owner: owner,
    allTime: allTime,
    periodStart: allTime ? generated : new Date(times[1][1]),
    periodEnd: allTime ? generated : new Date(times[2][1]),
    offsetMin: offsetMin,
    tz: timezoneForOffset_(offsetMin),
  };
}

/** "Saturday, September 5, 2026 at 12:29 PM UTC" → wall-clock millis (as if UTC). */
function parseHeaderDate_(s) {
  const text = String(s || '');
  // English: "Saturday, September 5, 2026 at 12:29 PM UTC"
  const en = text.match(/([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})[\s\u202f]*([AP]M)/i);
  if (en) {
    const month = MONTHS[en[1].slice(0, 3).toLowerCase()];
    return month === undefined ? null
      : Date.UTC(+en[3], month, +en[2], (+en[4] % 12) + (/pm/i.test(en[6]) ? 12 : 0), +en[5]);
  }
  // Italian: "Domenica 20 settembre 2026 alle ore 03:07 UTC" — day before month, 24-hour clock, no meridiem.
  // This is only read to work out how far the printed times sit from the export's own UTC stamp, but that
  // offset is what every entry timestamp is then interpreted through (see timezoneForOffset_). Failing to
  // read it defaults the offset to zero, and a real export turned out to print its times seven hours off
  // UTC — enough to file a late-evening scroll under the following day.
  const it = text.match(/(\d{1,2})\s+([A-Za-zàèéìòù]+)\s+(\d{4})\s+alle\s+ore\s+(\d{1,2}):(\d{2})/i);
  if (it) {
    const month = MONTHS[it[2].slice(0, 3).toLowerCase()];
    return month === undefined ? null : Date.UTC(+it[3], month, +it[1], +it[4], +it[5]);
  }
  return null;
}

function timezoneForOffset_(minutes) {
  if (minutes === -420 || minutes === -480) return 'America/Los_Angeles';
  if (minutes === 0) return 'UTC';
  const hours = Math.round(minutes / 60);
  return 'Etc/GMT' + (hours > 0 ? '-' : '+') + Math.abs(hours);
}

/** "Aug 30, 2026 12:25 am" printed in `tz` → Date. */
function parseEntryTime_(s, tz) {
  const m = String(s || '').match(/([A-Z][a-z]{2}) (\d{1,2}), (\d{4}) (\d{1,2}):(\d{2})[\s\u202f]*([ap]m)/i);
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  // A month name this doesn't recognise means no timestamp, not a timestamp of zero. Passing undefined
  // through to the date builder produced the Unix epoch, which is worse than useless: it reads as a real
  // date, lands every item in "1970-W01", and drags a whole export's worth of activity out of the months it
  // belongs to. No date at all is visible as missing; a wrong one is not.
  if (month === undefined) return null;
  const hour = (+m[4] % 12) + (/pm/i.test(m[6]) ? 12 : 0);
  return wallTimeToDate_(+m[3], month, +m[2], hour, +m[5], tz);
}

/** Splits a list page into entries, each ending at its timestamp. */
function splitEntries_(html) {
  const main = mainOf_(html);
  const out = [];
  const re = new RegExp(ENTRY_TIME_RE.source, 'gi');
  let last = 0;
  let m;
  while ((m = re.exec(main))) {
    out.push({ chunk: main.slice(last, m.index), stamp: m[1] });
    last = re.lastIndex;
  }
  return out;
}

function parseMedia_(html, ts) {
  const seen = new Set();
  return splitEntries_(html).map(({ chunk, stamp }) => {
    const caption = field_(chunk, 'Caption');
    return {
      url: (chunk.match(/href="(https:\/\/www\.instagram\.com\/[^"]+)"/) || [])[1] || '',
      owner: field_(chunk, 'Username'),
      ownerName: field_(chunk, 'Name'),
      caption: caption,
      hashtags: unique_((caption.match(/#[\p{L}\p{N}_]+/gu) || []).map(t => t.slice(1).toLowerCase())),
      source: field_(chunk, 'Source'),
      time: ts(stamp),
    };
  }).filter(item => {
    const key = item.url + '|' + (item.time ? item.time.getTime() : '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parsePeople_(html, ts) {
  return splitEntries_(html).map(({ chunk, stamp }) => {
    const heading = lastMatch_(chunk, /<h2[^>]*>([^<]*)<\/h2>/g);
    const link = lastMatch_(chunk, /<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g);
    const href = link ? link[1] : '';
    const fromHref = (href.match(/instagram\.com\/(?:_u\/)?([^\/?#"]+)\/?$/) || [])[1] || '';
    const account = (heading && decodeHtml_(heading[1]))
      || (fromHref && !/^(p|reel|reels|tv|stories)$/.test(fromHref) ? fromHref : '')
      || field_(chunk, 'Username')
      || (link ? decodeHtml_(link[2]) : '');
    return { account: account, name: field_(chunk, 'Name'), url: href, text: link ? decodeHtml_(link[2]) : '', time: ts(stamp) };
  });
}

function parseWordSearches_(html, ts) {
  return splitEntries_(html).map(({ chunk, stamp }) => ({
    term: decodeHtml_((chunk.match(/>Search<div><div>([\s\S]*?)<\/div>/) || [])[1] || ''),
    time: ts(stamp),
  })).filter(s => s.term);
}

/** Pages that are plain lists (ad categories, advertisers, locations), grouped by their section label. */
function parseLists_(html) {
  const main = mainOf_(html);
  const re = /<td[^>]*colspan="2"[^>]*>([^<]+)<div>|<div[^>]*>([^<]+)<\/div>/g;
  const sections = [];
  let current = null;
  let m;
  while ((m = re.exec(main))) {
    if (m[1] !== undefined) {
      current = { label: decodeHtml_(m[1]), items: [] };
      sections.push(current);
    } else {
      const text = decodeHtml_(m[2]);
      if (!text) continue;
      if (!current) sections.push(current = { label: '', items: [] });
      current.items.push(text);
    }
  }
  return sections;
}

/**
 * Notes and reposts you interacted with, as a flat list of the accounts behind them.
 *
 * This page is the single most relational thing an Instagram export carries. It cannot go through
 * splitEntries_ like every other page here, because Meta ships it WITHOUT timestamps: there is no entry time
 * to split on, so that splitter returns nothing at all. Entries are delimited by their "Author" heading
 * instead, which means an interaction can be counted and attributed but never placed on a day — everything
 * downstream therefore treats these as a per-bucket total, never as daily activity.
 */
function parseNotes_(html) {
  const main = mainOf_(html);
  const re = /<h2[^>]*>\s*(?:Author|Autore)\s*<\/h2>/gi;
  const cuts = [];
  let m;
  while ((m = re.exec(main))) cuts.push(m.index);
  return cuts.map((start, i) => {
    const chunk = main.slice(start, i + 1 < cuts.length ? cuts[i + 1] : main.length);
    return { account: field_(chunk, 'Username'), name: field_(chunk, 'Name'), url: field_(chunk, 'URL') };
  }).filter(n => n.account);
}

/**
 * The "past Instagram insights" pages (reach, content interactions, audience), which are label/value cards
 * rather than entry lists: one <td> holding the label, with the value in a <div> beside it. Returned as a
 * plain label→value map, values left as the raw localised strings — insightNum_ does the reading.
 */
function parseInsightCard_(html) {
  const out = {};
  const re = /<td[^>]*>([^<]+)<div>\s*<div>([\s\S]*?)<\/div>/g;
  let m;
  while ((m = re.exec(mainOf_(html)))) {
    const label = decodeHtml_(m[1]).trim();
    if (label && out[label] === undefined) out[label] = decodeHtml_(m[2]).trim();
  }
  return out;
}

/**
 * A number out of one of those card values. The values are localised the way the account's language writes
 * them, so an Italian export says "1.130" for one thousand one hundred and thirty and "85,8%" for a
 * percentage — parseFloat on either reads 1 and 85, which is why this cannot just be +value. Returns null
 * rather than 0 when the label is absent, so "Instagram did not report this" stays distinguishable from
 * "Instagram reported zero" — a distinction the whole Belonging tab is built on.
 */
function insightNum_(card, labels) {
  for (let i = 0; i < labels.length; i++) {
    const raw = card[labels[i]];
    if (raw === undefined || raw === '') continue;
    // Strip thousands separators, then normalise the decimal comma. Order matters: doing it the other way
    // turns "1.130" into "1130" only by luck and "1,5" into "15".
    const cleaned = String(raw).replace(/[^\d,.\-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    if (!isNaN(n)) return n;
  }
  return null;
}

/**
 * The same field carries a different label in a localised export — an Italian delivery labels a caption
 * "Didascalia" and a username "Nome utente". Verified against a real Italian export for Caption, Username
 * and Name; the rest are the obvious translations and are unverified, which is safe: an alias that never
 * appears simply doesn't match, exactly as today. Getting this wrong is not a cosmetic problem — with no
 * caption and no owner there is nothing for the keyword rules to read, so every item falls into "Other",
 * every account reads "(unknown)", and quiet interests cannot be computed at all.
 */
const FIELD_ALIASES = {
  Caption: ['Didascalia'],
  Username: ['Nome utente'],
  Name: ['Nome'],
  Source: ['Fonte'],
  City: ['Città'],
  Region: ['Regione'],
  Country: ['Paese'],
};

function field_(html, label) {
  const names = [label].concat(FIELD_ALIASES[label] || []);
  for (let i = 0; i < names.length; i++) {
    // Anchored on both sides, so ">Nome</td>" never matches the "Nome utente" row sitting beside it.
    const m = html.match(new RegExp('>' + names[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '</td>\\s*<td[^>]*>([\\s\\S]*?)</td>'));
    if (m) return decodeHtml_(m[1]);
  }
  return '';
}

function mainOf_(html) {
  const i = html.indexOf('<main');
  return i >= 0 ? html.slice(i) : html;
}

function lastMatch_(s, re) {
  let last = null;
  for (const m of s.matchAll(re)) last = m;
  return last;
}

function decodeHtml_(s) {
  return String(s)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .trim();
}

// ── Time helpers ─────────────────────────────────────────────────────────────

function tzOffsetMinutes_(date, tz) {
  const p = Utilities.formatDate(date, tz, 'yyyy-MM-dd-HH-mm-ss').split('-').map(Number);
  return Math.round((Date.UTC(p[0], p[1] - 1, p[2], p[3], p[4], p[5]) - date.getTime()) / 60000);
}

function wallTimeToDate_(year, month, day, hour, minute, tz) {
  const guess = Date.UTC(year, month, day, hour, minute);
  const first = tzOffsetMinutes_(new Date(guess), tz);
  const second = tzOffsetMinutes_(new Date(guess - first * 60000), tz);
  return new Date(guess - second * 60000);
}

function localParts_(date) {
  const s = Utilities.formatDate(date, CONFIG.LOCAL_TIMEZONE, "yyyy-MM-dd'|'HH:mm'|'u").split('|');
  return { date: s[0], time: s[1], hour: +s[1].slice(0, 2), weekday: +s[2] };
}

function fmtDate_(date) {
  return Utilities.formatDate(date, CONFIG.LOCAL_TIMEZONE, 'yyyy-MM-dd');
}

// ── Keyword rules ────────────────────────────────────────────────────────────

function norm_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function compileRule_(keywords) {
  const owners = new Set();
  const tags = new Set();
  const prefixes = [];
  const words = [];
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  String(keywords || '').split(',').map(k => norm_(k).trim()).filter(Boolean).forEach(k => {
    if (k[0] === '@') owners.add(k.slice(1));
    else if (k[0] === '#') tags.add(k.slice(1));
    else if (/^".+"$/.test(k)) words.push(esc(k.slice(1, -1)));
    else prefixes.push(esc(k));
  });
  const parts = [];
  if (prefixes.length) parts.push('(?:' + prefixes.join('|') + ')');
  if (words.length) parts.push('(?:' + words.join('|') + ')(?![\\p{L}\\p{N}])');
  return {
    owners: owners,
    tags: tags,
    re: parts.length ? new RegExp('(?:^|[^\\p{L}\\p{N}])(?:' + parts.join('|') + ')', 'u') : null,
  };
}

function compileRules_(rows) {
  const rules = { themes: [], subtopics: [], emotions: [], body: compileRule_(''), funnel: compileRule_('') };
  rows.forEach(([kind, name, keywords]) => {
    if (!name) return;
    const rule = compileRule_(keywords);
    if (kind === 'Theme') rules.themes.push({ name: String(name), rule: rule });
    // "Parent > Child" keeps the hierarchy in the one column the Settings tab has for a name, so adding
    // subtopics needed no schema change and a row can be typed by hand the same way a theme is. A subtopic
    // whose parent does not match a Theme row is kept and reported under that parent anyway — silently
    // dropping it would make a typo look like "this subtopic never matched anything".
    else if (kind === 'Subtopic') {
      const parts = String(name).split('>');
      rules.subtopics.push({ parent: parts[0].trim(), name: parts.slice(1).join('>').trim() || parts[0].trim(), rule: rule });
    } else if (kind === 'Emotion') rules.emotions.push({ name: String(name), rule: rule });
    else if (kind === 'Signal' && /body/i.test(name)) rules.body = rule;
    else if (kind === 'Signal' && /funnel/i.test(name)) rules.funnel = rule;
  });
  return rules;
}

function matches_(rule, item) {
  return rule.owners.has(item.ownerKey)
    || item.tagKeys.some(t => rule.tags.has(t))
    || (rule.re !== null && rule.re.test(item.hay));
}

// ── Analysis ─────────────────────────────────────────────────────────────────

function analyzeExport_(exp, rules, prev) {
  const month = exp.month;
  const periodLabel = fmtDate_(exp.periodStart) + ' → ' + fmtDate_(exp.periodEnd);
  const days = Math.max(1, Math.round((exp.periodEnd - exp.periodStart) / 86400000));
  // mergeForMonth_ always sets this precisely (distinct covered days ÷ real days in the month, correctly
  // clipped when a contributor's own period straddles a month boundary). This fallback only matters for an
  // exp that skipped the merge step entirely — kept so "days actually covered vs. the real calendar month"
  // is still a sane estimate rather than silently reading as a full month.
  const coverage = typeof exp.coverage === 'number' ? exp.coverage : Math.min(1, days / daysInMonth_(month));
  const ratio = (n, d) => (d ? n / d : 0);
  const inPeriod = e => !e.time || (e.time >= exp.periodStart && e.time <= exp.periodEnd);

  const prepare = item => {
    item.hay = norm_([item.owner, item.ownerName, item.caption, (item.hashtags || []).join(' ')].join(' \n '));
    item.ownerKey = norm_(item.owner);
    item.tagKeys = (item.hashtags || []).map(norm_);
    item.themes = rules.themes.filter(t => matches_(t.rule, item)).map(t => t.name);
    return item;
  };
  exp.postsViewed.forEach(i => { i.kind = 'Post'; });
  exp.videosWatched.forEach(i => { i.kind = 'Video'; });
  const seen = exp.postsViewed.concat(exp.videosWatched).map(prepare);
  exp.likedPosts.forEach(prepare);
  exp.adsViewed.forEach(prepare);
  exp.notInterested.forEach(prepare);
  const newFollows = exp.following.filter(f => f.time && inPeriod(f));
  const followers = exp.followers.filter(inPeriod);
  const blocked = exp.blocked.filter(inPeriod);
  [newFollows, followers, blocked, exp.profileSearches].forEach(list =>
    list.forEach(p => prepare(Object.assign(p, { owner: p.account, ownerName: p.name, caption: '', hashtags: [] }))));
  exp.wordSearches.forEach(s => prepare(Object.assign(s, { owner: '', ownerName: '', caption: s.term, hashtags: [] })));
  const N = seen.length;

  // Half of everything Instagram logs carries no caption at all — 883 of 1709 items in the export this was
  // measured against. No keyword rule can ever reach those, so they all fell into "Other", which is why it
  // was the largest slice on the chart by a distance while only 14% of actual CAPTIONS went untagged.
  // Adding keywords cannot fix that; the text simply is not there.
  //
  // What is there is the account. An account posts about the same handful of things, so an item with nothing
  // to read inherits the themes that account's OWN captioned items earned in this same bucket. The guards are
  // what keep this inference rather than invention: at least three tagged items from that account, and only a
  // theme carried by more than half of them. Inherited tags are counted and reported, so the share of the
  // chart resting on inference is visible instead of quietly blended in.
  let inheritedTags = 0;
  const tagsByOwner = {};
  seen.forEach(i => {
    if (!i.ownerKey || !i.themes.length) return;
    const bucket = tagsByOwner[i.ownerKey] || (tagsByOwner[i.ownerKey] = { tagged: 0, counts: {} });
    bucket.tagged++;
    i.themes.forEach(t => { bucket.counts[t] = (bucket.counts[t] || 0) + 1; });
  });
  seen.concat(exp.likedPosts).forEach(i => {
    if (i.themes.length || !i.ownerKey) return;
    const bucket = tagsByOwner[i.ownerKey];
    if (!bucket || bucket.tagged < 3) return;
    const usual = Object.keys(bucket.counts).filter(t => bucket.counts[t] / bucket.tagged > 0.5);
    if (!usual.length) return;
    i.themes = usual;
    i.themesInherited = true;
    inheritedTags += usual.length;
  });

  // Themes
  const themeRows = rules.themes.map(t => {
    const s = seen.filter(i => i.themes.indexOf(t.name) >= 0).length;
    const l = exp.likedPosts.filter(i => i.themes.indexOf(t.name) >= 0).length;
    return [month, t.name, s, ratio(s, N), l];
  });
  const untagged = seen.filter(i => !i.themes.length).length;
  themeRows.push([month, 'Other', untagged, ratio(untagged, N), exp.likedPosts.filter(i => !i.themes.length).length]);

  // Subtopics: the same keyword machinery one level down. A subtopic's share is of its PARENT's items, not
  // of the whole feed — "LLMs is 40% of your AI & Tech" is the sentence worth reading, and it stays true
  // whether AI & Tech was a big week or a small one.
  //
  // An item counts only where it matches the subtopic AND carries the parent theme. Matching on the subtopic
  // rule alone looks equivalent and is not: "palestra" hit four items while the Health & Body theme rule hit
  // three, so the first version of this reported a subtopic at 133% of its own parent. Anything a subtopic
  // catches outside its parent is a gap in the THEME's keywords — widen that rule, rather than letting a
  // subdivision be larger than the thing it subdivides.
  const subRows = rules.subtopics.map(sub => {
    const inParent = i => i.themes.indexOf(sub.parent) >= 0 && matches_(sub.rule, i);
    const hits = seen.filter(inParent).length;
    const parentSeen = seen.filter(i => i.themes.indexOf(sub.parent) >= 0).length;
    return [month, sub.parent, sub.name, hits, ratio(hits, parentSeen), exp.likedPosts.filter(inParent).length];
  }).filter(r => r[3] > 0);
  const themeShare = name => (themeRows.find(r => r[1] === name) || [0, 0, 0, 0])[3];
  const focus = normalizedEntropy_(themeRows.filter(r => r[1] !== 'Other').map(r => r[2]));
  const named = themeRows.filter(r => r[1] !== 'Other');
  const topTheme = named.slice().sort((a, b) => b[2] - a[2])[0];

  // Emerging theme: the biggest gain in share of what you saw, against the previous bucket. Share rather than
  // count, so a quiet week and a heavy one compare fairly. Needs a previous bucket — the first one has none.
  const prevShare = name => (prev && prev.themes[name] ? +prev.themes[name].share || 0 : 0);
  const emerging = !prev ? null : named
    .map(r => ({ name: r[1], change: r[3] - prevShare(r[1]) }))
    .sort((a, b) => b.change - a.change)
    .filter(e => e.change > 0)[0];

  // Most ignored theme: the widest gap between the share of items it fills and the share of your likes it
  // earns. Comparing two compositions rather than a like RATE is what keeps this readable when you like very
  // little overall — a theme that is 25% of the feed and 0% of the likes scores 25 points whether you handed
  // out two likes that bucket or two hundred. With almost no likes at all it is still thin evidence, so the
  // liked total travels with it and the dashboard says so.
  const likedTotal = exp.likedPosts.length;
  const likeGap = named.map(r => ({ name: r[1], gap: r[3] - (likedTotal ? r[4] / likedTotal : 0) }));
  const ignored = !named.length ? null : likeGap.slice()
    .sort((a, b) => b.gap - a.gap)
    .filter(e => e.gap > 0)[0];
  // The same measure read from the other end: the theme that takes MORE of your likes than of your feed is
  // the one you go out of your way for. Ignored and cared-for are one number with two signs, which is why
  // they are computed together — and why "cared for" is silent when nothing was liked at all, rather than
  // crowning whichever theme happened to collect the single like of a quiet week.
  const caredFor = !likedTotal ? null : likeGap.slice()
    .sort((a, b) => a.gap - b.gap)
    .filter(e => e.gap < 0)[0];

  // Rhythm (local time)
  const actionEvents = [].concat(exp.likedPosts, exp.likedComments, exp.profileSearches, exp.wordSearches, newFollows)
    .filter(e => e.time);
  const events = seen.filter(e => e.time).concat(actionEvents);
  events.forEach(e => { e.local = localParts_(e.time); });

  // Instagram keeps only about a week of view history, while likes, follows and searches cover the whole period.
  // The viewing window runs from the first day with at least VIEW_WINDOW_MIN_ITEMS items seen to the end of the period;
  // rates, rhythm and time estimates use only that window.
  const seenByDate = countBy_(seen.filter(e => e.local), e => e.local.date);
  const seenDates = Object.keys(seenByDate).sort();
  const windowStart = seenDates.find(d => seenByDate[d] >= CONFIG.VIEW_WINDOW_MIN_ITEMS) || seenDates[0] || fmtDate_(exp.periodStart);
  const viewingDays = Math.max(1, Math.round((Date.parse(fmtDate_(exp.periodEnd)) - Date.parse(windowStart)) / 86400000) + 1);
  const inWindow = e => e.local && e.local.date >= windowStart;
  const windowEvents = events.filter(inWindow);
  const windowActions = actionEvents.filter(inWindow);

  const hours = new Array(24).fill(0);
  const weekdays = new Array(7).fill(0);
  const grid = WEEKDAYS.map(() => new Array(24).fill(0));
  const activeDates = new Set();
  const lateDates = new Set();
  windowEvents.forEach(e => {
    const p = e.local;
    hours[p.hour]++;
    weekdays[p.weekday - 1]++;
    grid[p.weekday - 1][p.hour]++;
    activeDates.add(p.date);
    if (p.hour < 6) lateDates.add(p.date);
  });

  // Daily activity and estimated time: a session is activity with no gap longer than 15 minutes
  const dayMap = {};
  const dayOf = p => (dayMap[p.date] = dayMap[p.date]
    || { date: p.date, weekday: p.weekday, items: 0, actions: 0, late: 0, sessions: 0, minutes: 0 });
  for (let t = exp.periodStart.getTime(); t < exp.periodEnd.getTime(); t += 86400000) dayOf(localParts_(new Date(t)));
  seen.filter(e => e.local).forEach(e => {
    const day = dayOf(e.local);
    day.items++;
    if (e.local.hour < 6) day.late++;
  });
  actionEvents.forEach(e => { dayOf(e.local).actions++; });
  const minuteStamps = unique_(windowEvents.map(e => Math.floor(e.time.getTime() / 60000))).sort((a, b) => a - b);
  let sessionStart = null;
  let lastStamp = null;
  const closeSession = () => {
    if (sessionStart === null) return;
    const day = dayOf(localParts_(new Date(sessionStart * 60000)));
    day.sessions++;
    day.minutes += lastStamp - sessionStart + 1;
  };
  minuteStamps.forEach(s => {
    if (lastStamp === null || s - lastStamp > 15) {
      closeSession();
      sessionStart = s;
    }
    lastStamp = s;
  });
  closeSession();
  const dayList = Object.keys(dayMap).sort().map(k => dayMap[k]);
  const usedDays = dayList.filter(d => d.sessions > 0);
  const minutesPerActiveDay = usedDays.length ? round_(usedDays.reduce((n, d) => n + d.minutes, 0) / usedDays.length, 1) : 0;
  const sessionsPerActiveDay = usedDays.length ? round_(usedDays.reduce((n, d) => n + d.sessions, 0) / usedDays.length, 1) : 0;
  const dailyRows = dayList.map(d => [month, d.date, WEEKDAYS[d.weekday - 1], d.items, d.actions, d.sessions, d.minutes, d.late,
    d.date >= windowStart ? 'Yes' : 'No']);
  const hourlyRows = [];
  grid.forEach((row, w) => row.forEach((n, h) => hourlyRows.push([month, w + 1, WEEKDAYS[w], h, n])));
  const lateShare = ratio(hours.slice(0, 6).reduce((a, b) => a + b, 0), windowEvents.length);
  const activeRatio = ratio(windowActions.length, N);

  // Rankings
  const byOwner = countBy_(seen, i => i.owner || '(unknown)');
  const likedByOwner = countBy_(exp.likedPosts, i => i.owner || '(unknown)');
  const themesOf = items => topEntries_(countBy_(items.flatMap(i => i.themes), t => t), 2).map(e => e[0]).join(', ');
  const tagCounts = countBy_(seen.flatMap(i => unique_(i.tagKeys)), t => t);
  const adBy = countBy_(exp.adsViewed, i => i.ownerName || i.owner || '(unknown)');
  // Reciprocal contact, counted once here because two different rankings read it: the Top tab's
  // "Notes & reposts" list just below, and the Belonging tab's Connected row further down.
  const noteCounts = countBy_(exp.notes || [], n => n.account);
  const notePartners = topEntries_(noteCounts, Object.keys(noteCounts).length);
  const noteEvents = (exp.notes || []).length;

  const topRows = []
    .concat(topEntries_(byOwner, CONFIG.TOP_N).map((e, k) =>
      [month, 'Accounts seen', k + 1, e[0], e[1], likedByOwner[e[0]] || 0, themesOf(seen.filter(i => (i.owner || '(unknown)') === e[0]))]))
    .concat(topEntries_(likedByOwner, CONFIG.TOP_N).map((e, k) =>
      [month, 'Accounts liked', k + 1, e[0], e[1], e[1], themesOf(exp.likedPosts.filter(i => (i.owner || '(unknown)') === e[0]))]))
    // Reciprocal contact, ranked. It rides in Top rather than a tab of its own because it is exactly Top's
    // shape — a named ranking with a count — and doing it this way gives it the weekly twin, the number
    // formats and the client payload plumbing for free.
    .concat(notePartners.slice(0, CONFIG.TOP_N).map((e, k) =>
      [month, 'Notes & reposts', k + 1, e[0], e[1], likedByOwner[e[0]] || 0,
        themesOf(seen.filter(i => (i.owner || '(unknown)') === e[0]))]))
    .concat(topEntries_(tagCounts, CONFIG.TOP_N).map((e, k) => [month, 'Hashtags seen', k + 1, '#' + e[0], e[1], '', '']))
    .concat(topEntries_(adBy, CONFIG.TOP_N).map((e, k) =>
      [month, 'Advertisers in ads seen', k + 1, e[0], e[1], '', themesOf(exp.adsViewed.filter(i => (i.ownerName || i.owner || '(unknown)') === e[0]))]));

  // Quiet interests: accounts you kept seeing without any visible action (no like, search or follow)
  const actedOn = new Set([]
    .concat(exp.likedPosts.map(i => i.owner), exp.likedComments.map(c => c.account))
    .concat(exp.profileSearches.map(s => s.account), newFollows.map(f => f.account))
    .concat(exp.wordSearches.map(s => s.term.replace(/\s+/g, '')))
    .map(norm_));
  const following = new Set(exp.following.map(f => norm_(f.account)));
  const quietAll = topEntries_(byOwner, Object.keys(byOwner).length)
    .filter(e => e[0] !== '(unknown)' && e[1] >= CONFIG.QUIET_MIN_VIEWS && !actedOn.has(norm_(e[0])));
  const quietShare = ratio(quietAll.reduce((n, e) => n + e[1], 0), N);
  const quietRows = quietAll.slice(0, CONFIG.TOP_N).map((e, k) => {
    const items = seen.filter(i => i.owner === e[0]).sort((a, b) => (b.time || 0) - (a.time || 0));
    const latest = items.find(i => i.caption);
    return [month, k + 1, e[0], e[1], items.filter(i => i.kind === 'Post').length, items.filter(i => i.kind === 'Video').length,
      following.has(norm_(e[0])) ? 'Yes' : 'No', themesOf(items),
      !prev ? '' : (prev.quiet.has(e[0]) ? 'Continuing' : 'New'), latest ? clip_(latest.caption, 200) : ''];
  });

  // Accounts: every account you saw, liked or searched this month, for the Network tab
  const searchedBy = countBy_(exp.profileSearches, s => s.account);
  const accountRows = unique_(Object.keys(byOwner).concat(Object.keys(likedByOwner), Object.keys(searchedBy)))
    .filter(a => a && a !== '(unknown)')
    .map(a => {
      const items = seen.filter(i => i.owner === a);
      return [month, a, byOwner[a] || 0, items.filter(i => i.kind === 'Post').length, items.filter(i => i.kind === 'Video').length,
        likedByOwner[a] || 0, searchedBy[a] || 0, following.has(norm_(a)) ? 'Yes' : 'No',
        themesOf(items.concat(exp.likedPosts.filter(i => i.owner === a)))];
    })
    .sort((x, y) => (y[2] + y[5] + y[6]) - (x[2] + x[5] + x[6]) || x[1].localeCompare(y[1]));

  // Word lists
  const per100 = n => Math.round(100 * ratio(n, N));
  const bodyPer100 = per100(seen.filter(i => matches_(rules.body, i)).length);
  const funnelPer100 = per100(seen.filter(i => matches_(rules.funnel, i)).length);
  const emotions = rules.emotions.map(e => ({
    name: e.name,
    rule: e.rule,
    per100: per100(seen.filter(i => matches_(e.rule, i)).length),
    liked: exp.likedPosts.filter(i => matches_(e.rule, i)).length,
  }));
  const anxietyRules = emotions.filter(e => /anxiety|fear/i.test(e.name)).map(e => e.rule);
  const anxFear = per100(seen.filter(i => anxietyRules.some(r => matches_(r, i))).length);

  // What Meta holds about you
  const metaNow = []
    .concat(exp.metaCategories.map(v => ['Ad category', v]))
    .concat(exp.advertisers.map(a => [a.type, a.name]))
    .concat(exp.locationsOfInterest.map(v => ['Location of interest', v]))
    .concat(exp.basedIn ? [['Profile based in', exp.basedIn]] : []);
  const nowKeys = new Set(metaNow.map(r => r[0] + '|' + r[1]));
  const metaRows = metaNow.map(r => [month, r[0], r[1], !prev ? '' : (prev.meta[r[0]] && prev.meta[r[0]].has(r[1]) ? 'Same' : 'New')]);
  if (prev) {
    Object.keys(prev.meta).forEach(type => prev.meta[type].forEach(v => {
      if (!nowKeys.has(type + '|' + v)) metaRows.push([month, type, v, 'Removed']);
    }));
  }
  const newLabels = metaRows.filter(r => r[1] === 'Ad category' && r[3] === 'New').map(r => r[2]);
  const advertiserCount = unique_(exp.advertisers.map(a => a.name)).length;

  const monthly = {
    'Month': month, 'Period start': fmtDate_(exp.periodStart), 'Period end': fmtDate_(exp.periodEnd), 'Days': days,
    'Coverage': round_(coverage, 3),
    'Posts viewed': exp.postsViewed.length, 'Videos watched': exp.videosWatched.length, 'Items seen': N,
    'Ads viewed': exp.adsViewed.length, 'Liked posts': exp.likedPosts.length, 'Liked comments': exp.likedComments.length,
    'New follows': newFollows.length, 'Following total': exp.following.length, 'New followers': followers.length,
    'Blocked': blocked.length, 'Reported / not interested': exp.notInterested.length,
    'Profile searches': exp.profileSearches.length, 'Word searches': exp.wordSearches.length,
    'Seen per day': round_(N / viewingDays, 1), 'Active ratio': activeRatio, 'Late-night share': lateShare,
    'Late-night days': lateDates.size, 'Active days': activeDates.size,
    'Peak hour': events.length ? hours.indexOf(Math.max.apply(null, hours)) : '',
    'Distinct accounts': Object.keys(byOwner).length, 'Focus spread': round_(focus, 2),
    'Top theme': topTheme ? topTheme[1] : '', 'Top theme share': topTheme ? topTheme[3] : 0,
    'Emerging theme': emerging ? emerging.name : '', 'Emerging change': emerging ? round_(emerging.change, 4) : 0,
    'Ignored theme': ignored ? ignored.name : '', 'Ignored gap': ignored ? round_(ignored.gap, 4) : 0,
    'Cared-for theme': caredFor ? caredFor.name : '', 'Cared-for gap': caredFor ? round_(-caredFor.gap, 4) : 0,
    'Inherited tags': inheritedTags,
    'News share': themeShare(T.news), 'Money & Work share': themeShare(T.money),
    'Body-discomfort per 100': bodyPer100, 'Anxiety & fear per 100': anxFear, 'Sales-funnel per 100': funnelPer100,
    'Advertisers with your data': advertiserCount, 'Meta ad categories': exp.metaCategories.length,
    'New Meta labels': newLabels.length, 'Quiet interests': quietAll.length, 'Quiet share': quietShare,
    'Est. minutes per active day': minutesPerActiveDay, 'Sessions per active day': sessionsPerActiveDay,
    'Top-5 accounts share': ratio(topEntries_(byOwner, 5).reduce((n, e) => n + e[1], 0), N),
    'View window start': windowStart, 'Viewing days': viewingDays, 'Month date': dateCell_(month + '-01'),
  };
  const pm = prev ? prev.m : null;
  const risks = assessRisks_(month, monthly, pm, prev ? prev.risks : null, coverage);
  monthly['Risk index'] = risks.index;
  const pv = key => (pm && pm[key] !== '' && pm[key] !== undefined ? pm[key] : null);

  // Signals: rule-based risk flags
  const signals = [];
  const signal = (area, name, value, previous, level, meaning, tip, fmt) => signals.push(
    [month, T_(area), T_(name), fmtVal_(value, fmt), previous === null ? '' : fmtVal_(previous, fmt),
      LEVEL[level], meaning, T_(tip)]);
  signal('Wellbeing', 'Late-night activity (00:00–05:59)', lateShare, pv('Late-night share'),
    lateShare >= 0.25 ? 'Alert' : lateShare >= 0.12 ? 'Watch' : 'OK',
    `Share of your logged activity between midnight and 6am; ${lateDates.size} of ${activeDates.size} active days had some.`,
    'Phone out of the bedroom, or an app limit after 23:30.', 'pct');
  const perDay = N / viewingDays;
  const prevPerDay = pv('Seen per day');
  signal('Attention', 'Items seen per day', perDay, prevPerDay,
    prevPerDay && perDay > prevPerDay * 1.4 ? 'Watch' : 'Info',
    (prevPerDay ? 'Change vs last month: ' + changeText_(perDay, prevPerDay) + '. ' : '')
      + `Instagram keeps about a week of view history; this covers ${viewingDays} days from ${windowStart}.`,
    'If it jumped, see which theme grew in Themes.', 'num1');
  signal('Attention', 'Active vs passive', activeRatio, pv('Active ratio'), activeRatio < 0.02 ? 'Watch' : 'OK',
    'Likes, follows and searches in the viewing window per item seen. Below 2% means mostly passive scrolling.',
    'Unfollow accounts you never engage with.', 'pct');
  signal('Attention', 'Quiet interests', quietAll.length, pv('Quiet interests'), 'Info',
    quietAll.length
      ? `Accounts seen ${CONFIG.QUIET_MIN_VIEWS}+ times with no like, search or follow (${fmtVal_(quietShare, 'pct')} of items). Top: `
        + quietAll.slice(0, 4).map(e => `${e[0]} (${e[1]})`).join(', ')
      : `No account was seen ${CONFIG.QUIET_MIN_VIEWS}+ times without a like, search or follow.`,
    'Ask why you keep watching the top ones; mute any that drain you.', 'int');
  signal('Attention', 'Focus spread', focus, pv('Focus spread'), focus >= 0.97 ? 'Watch' : 'Info',
    'How evenly your attention spreads across themes: 0 = a single theme, 1 = every theme equally.',
    'Pick the 2–3 themes that serve what you are building now.', 'num2');
  signal('Body', 'Body-discomfort content', bodyPer100, pv('Body-discomfort per 100'),
    bodyPer100 >= 6 ? 'Alert' : bodyPer100 >= 3 ? 'Watch' : 'OK',
    'Items per 100 about pain, posture, jaw or sleep problems. The feed serves what you linger on, so this often mirrors a real symptom.',
    'If the symptom is real, a physio or dentist beats more reels.', 'int');
  signal('Mind', 'Anxiety & fear tone', anxFear, pv('Anxiety & fear per 100'), anxFear >= 15 ? 'Watch' : 'OK',
    'Items per 100 whose captions use anxiety, danger or threat words.',
    'Mute the accounts driving it (see Top).', 'int');
  const news = themeShare(T.news);
  signal('Mind', 'News load', news, pv('News share'), news >= 0.25 ? 'Watch' : 'OK',
    'Share of items from news and current-affairs sources. Heavy exposure makes the world feel more dangerous than it is.',
    'Batch news into one daily slot.', 'pct');
  signal('Money', 'Sales-funnel exposure', funnelPer100, pv('Sales-funnel per 100'), funnelPer100 >= 12 ? 'Watch' : 'OK',
    'Items per 100 pushing "comment X", free workshops, webinars or link-in-bio offers.',
    'Treat coaching funnels as ads, not as care or a plan.', 'int');
  const money = themeShare(T.money);
  const prevMoney = pv('Money & Work share');
  signal('Money', 'Money & work focus', money, prevMoney,
    prevMoney !== null && money >= 0.1 && money > prevMoney * 1.5 ? 'Watch' : 'Info',
    'A rising money focus often tracks financial pressure or a career decision.',
    'Name the decision behind it and give it a date.', 'pct');
  signal('Privacy', 'Advertisers holding your data', advertiserCount, pv('Advertisers with your data'), 'Info',
    'Advertisers that matched you from their own customer lists or from your visits to their site or app.',
    'Accounts Center → Ad preferences: review and hide advertisers.', 'int');
  signal('Privacy', 'New Meta labels', newLabels.length, pv('New Meta labels'), newLabels.length ? 'Watch' : 'OK',
    newLabels.length ? 'Added since last month: ' + newLabels.slice(0, 12).join('; ')
      : (prev ? 'No new labels since last month.' : 'First month, nothing to compare yet.'),
    'Full list in the Meta tab.', 'int');
  const blockedOrReported = blocked.length + exp.notInterested.length;
  signal('Social', 'Blocked or reported', blockedOrReported, null, blockedOrReported ? 'Info' : 'OK',
    'Accounts you blocked plus posts you reported or marked as not interested.', 'Details in Actions.', 'int');

  // Profile: transparent 0–100 proxies
  const capped = (value, full) => Math.max(0, Math.min(100, Math.round(100 * Math.min(1, value / full))));
  const personality = 'Personality · Big Five proxy';
  const sdt = 'Desire · Self-Determination Theory';
  const beyond = 'Desire · beyond SDT';
  const profileDefs = [
    [personality, 'Openness · curiosity breadth', Math.round(100 * (0.6 * focus + 0.4 * Math.min(1, ratio(Object.keys(byOwner).length, N) * 1.5))), 'Theme spread (60%) + variety of accounts seen (40%)'],
    [personality, 'Conscientiousness · rest-window discipline', Math.round(100 * (1 - Math.min(1, lateShare * 4))), '100 minus 4× the share of activity between 00:00 and 05:59'],
    [personality, 'Extraversion · online expressiveness', capped(activeRatio, 0.10), 'Likes + follows + searches in the viewing window per item seen (10% = 100)'],
    [personality, 'Agreeableness · prosocial content', capped(themeShare(T.local) + themeShare(T.env), 0.60), 'Local & Community + Environment share of items (60% = 100)'],
    [personality, 'Emotional sensitivity · inner-life focus', capped(themeShare(T.psych), 0.40), 'Psychology & Relationships share of items (40% = 100)'],
    [sdt, 'Autonomy · building your own thing', capped(themeShare(T.tech), 0.40), 'AI & Tech share of items (40% = 100)'],
    [sdt, 'Competence & security · money and work', capped(themeShare(T.money), 0.40), 'Money & Work share of items (40% = 100)'],
    [sdt, 'Relatedness · belonging', capped(themeShare(T.local) + themeShare(T.music), 0.60), 'Local & Community + Music & Nightlife share (60% = 100)'],
    [beyond, 'Meaning · society and planet', capped(themeShare(T.politics) + themeShare(T.env), 0.60), 'Politics & Society + Environment share (60% = 100)'],
    [beyond, 'Vitality · body and health', capped(themeShare(T.health), 0.30), 'Health & Body share of items (30% = 100)'],
    [beyond, 'Expression · arts and creativity', capped(themeShare(T.arts), 0.30), 'Arts, Film & Design share of items (30% = 100)'],
  ].concat(emotions.map(e => ['Emotional tone', e.name, e.per100, `Items per 100 seen using these words (in liked posts: ${e.liked})`]));
  const profileRows = profileDefs.map(([framework, dimension, score, how]) => {
    const before = prev && prev.profile[dimension] !== undefined && prev.profile[dimension] !== '' ? prev.profile[dimension] : '';
    return [month, framework, dimension, score, before, before === '' ? '' : score - before, how];
  });

  // Actions: what you chose to do
  const actions = [];
  const act = (e, type, who, detail, url) => {
    const p = e.local || (e.time ? localParts_(e.time) : null);
    actions.push([month, p ? p.date : '', p ? p.time : '', type, who || '', (e.themes || []).join(', '), clip_(detail, 300), url || '']);
  };
  exp.likedPosts.forEach(i => act(i, 'Liked post', i.owner, i.caption, i.url));
  exp.likedComments.forEach(c => act(c, 'Liked comment', c.account, c.text, c.url));
  newFollows.forEach(f => act(f, 'Followed', f.account, '', f.url));
  followers.forEach(f => act(f, 'New follower', f.account, '', f.url));
  exp.profileSearches.forEach(s => act(s, 'Searched profile', s.account, '', s.url));
  exp.wordSearches.forEach(s => act(s, 'Searched words', s.term, '', ''));
  blocked.forEach(b => act(b, 'Blocked', b.account, b.name, ''));
  exp.notInterested.forEach(i => act(i, 'Not interested / reported', i.owner, (i.source ? '[' + i.source + '] ' : '') + i.caption, i.url));
  actions.sort((a, b) => (b[1] + b[2]).localeCompare(a[1] + a[2]));

  // ── Belonging ────────────────────────────────────────────────────────────────────────────────────────
  // Four dimensions, and only one of them has real substrate in an Instagram export. That asymmetry is the
  // point of the tab: Seen and Connected get computed, Heard and Invested in get a row that says what is
  // missing and what would have to arrive for them to become measurable. Inventing a proxy for the other two
  // out of follower counts would be the easy move and the dishonest one — a follower count is not somebody
  // investing in you, and saying so in a score would put a number on something never measured.
  const mutualTies = notePartners.filter(e => following.has(norm_(e[0])));
  const reach = exp.reachCard || {};
  const inter = exp.interactionCard || {};
  const aud = exp.audienceCard || {};
  const reached = insightNum_(reach, ['Accounts reached', 'Account raggiunti']);
  const profileVisits = insightNum_(reach, ['Profile visits', 'Visite al profilo']);
  const engagedAccounts = insightNum_(inter, ['Accounts engaged', 'Account che hanno interagito']);
  const storyReplies = insightNum_(inter, ['Story replies', 'Risposte alla storia']);
  const followerTotal = insightNum_(aud, ['Followers', 'Follower']);

  // Notes and reposts carry no timestamp (see parseNotes_), so these counts belong to the whole delivery and
  // are reported per bucket. Score is breadth of reciprocal contact against the stated reference, capped.
  const connectedScore = notePartners.length
    ? Math.min(100, Math.round(100 * notePartners.length / CONFIG.BELONGING_TIES_FULL)) : 0;
  // "Of everyone who saw you, how many did anything back" — a response rate, not recognition. It is the
  // closest an export gets to being seen, and it is still an audience metric, which the Status column says.
  const seenScore = reached && engagedAccounts !== null ? Math.round(100 * engagedAccounts / reached) : '';

  const tieList = notePartners.slice(0, 8).map(e => e[0] + ' ×' + e[1]).join(' · ');
  // Dimension and Status stay English here on purpose, unlike the risk and signal text above. The dashboard
  // keys off both — `Status === 'Measured'` picks the chip colour, and the dimension name selects a
  // translation — so writing Italian into these two columns would break the dashboard's own language
  // switch, which is the layer that should be translating them. Every other column here is prose and is
  // translated below.
  const belongingRows = [
    [month, 'Connected', notePartners.length ? 'Measured' : 'No data this bucket', connectedScore,
      notePartners.length
        ? notePartners.length + ' accounts, ' + noteEvents + ' exchanges'
        : 'No note or repost exchanges in this delivery',
      tieList || '—',
      'Reciprocal, named, low-ceremony contact: notes and reposts you and they both showed up for. '
        + mutualTies.length + ' of ' + notePartners.length + ' are accounts you follow.',
      'Nothing — this one works. Breadth is scored against ' + CONFIG.BELONGING_TIES_FULL
        + ' distinct contacts, so read the score as "how much of that reference", not as a verdict.'],
    [month, 'Seen', reached === null ? 'Not in this export' : 'Proxy only', seenScore,
      reached === null ? 'Instagram shipped no reach card' : reached + ' accounts reached, ' + (engagedAccounts === null ? '?' : engagedAccounts) + ' did something back',
      [reached !== null ? reached + ' reached' : '', profileVisits !== null ? profileVisits + ' profile visits' : '',
        followerTotal !== null ? followerTotal + ' followers' : ''].filter(Boolean).join(' · ') || '—',
      'Audience reach, which is being looked at — not being recognised. Nothing in an export speaks to '
        + 'identity safety, being named correctly, or whether you had to leave parts of yourself at the door.',
      'Per-account inbound engagement rather than one quarterly total, and any signal at all about how you '
        + 'are addressed. Instagram exports neither.'],
    [month, 'Heard', 'Not measurable yet', '',
      storyReplies === null ? 'Nothing inbound to read' : storyReplies + ' story replies, and that is the whole record',
      storyReplies === null ? '—' : storyReplies + ' story replies (' + (reach['Date range'] || reach['Intervallo di date'] || 'insights window') + ')',
      'Whether what you said changed anything — being echoed, credited, answered. The export carries no '
        + 'comments page and no message content, so there is no conversation in it to read.',
      'Comment threads with their replies, and DM metadata (who, when, who spoke first, who answered). '
        + 'Meta holds both and ships neither in the personal export.'],
    [month, 'Invested in', 'Not measurable yet', '',
      'No substrate of any kind',
      '—',
      'Whether anyone treats you as having a future: mentorship, advocacy, honest feedback. No file in an '
        + 'Instagram export describes anyone doing anything for your benefit.',
      'Longitudinal reciprocity across many months — who keeps showing up for you when nothing is in it '
        + 'for them — which needs a year of exports, not a better parser. It is the one dimension a '
        + 'consumption log may never reach.'],
  ];

  const rhythmRows = hours.map((n, h) => [month, 'Hour', h, pad2_(h) + 'h', n])
    .concat(weekdays.map((n, d) => [month, 'Weekday', d + 1, WEEKDAYS[d], n]));

  const result = {
    month: month,
    periodLabel: periodLabel,
    monthly: monthly,
    rows: {
      Monthly: [HEADERS.Monthly.map(h => monthly[h])],
      Risks: risks.rows,
      Signals: signals,
      Profile: profileRows,
      Themes: themeRows,
      Rhythm: rhythmRows,
      Daily: dailyRows,
      Hourly: hourlyRows,
      Top: topRows,
      Subthemes: subRows,
      'Quiet interests': quietRows,
      Belonging: belongingRows,
      Actions: actions,
      Accounts: accountRows,
      Meta: metaRows,
    },
  };
  result.rows.Prompt = [[month, buildPrompt_(exp, result, prev, hours)]];
  return result;
}

function buildPrompt_(exp, result, prev, hours) {
  const r = result.rows;
  const m = result.monthly;
  const lines = [
    `Instagram data for ${result.month} (${result.periodLabel}, times in ${CONFIG.LOCAL_TIMEZONE}).`,
    '',
    'Using the Big Five and Self-Determination Theory, infer my personality, emotions, desires and risks from this month. '
      + 'Weight my own actions (likes, searches, follows) above what the feed showed me, say how confident you are in each point, '
      + 'and compare with the previous month where given. The numbers below are rule-based summaries, not assessments.',
    '', '== Numbers',
  ];
  HEADERS.Monthly.slice(3).filter(h => h !== 'Month date').forEach(h => lines.push(`${h}: ${fmtAuto_('Monthly', h, m[h])}`));
  lines.push('', '== Themes (share of items seen · liked posts)');
  r.Themes.slice().sort((a, b) => b[2] - a[2]).forEach(t => lines.push(`${t[1]}: ${fmtVal_(t[3], 'pct')} · ${t[4]} liked`));
  lines.push('', `== Risk register (score = likelihood × impact, max 25; risk index ${m['Risk index']}/100)`);
  r.Risks.forEach(k => lines.push(`${k[1]} ${k[2]} (${k[3]}): ${k[4]}×${k[5]} = ${k[6]} ${k[7]}${k[9] ? ', ' + k[9] : ''}. ${k[10]}`));
  lines.push('', '== Signals');
  r.Signals.forEach(s => lines.push(`${s[5]} ${s[1]} · ${s[2]}: ${s[3]}${s[4] !== '' ? ' (previous ' + s[4] + ')' : ''}. ${s[6]}`));
  lines.push('', '== Indicators (0–100 proxies; emotional tone = items per 100)');
  r.Profile.forEach(p => lines.push(`${p[2]}: ${p[3]}${p[4] !== '' ? ' (previous ' + p[4] + ')' : ''}`));
  lines.push('', '== Activity by hour', hours.map((n, h) => pad2_(h) + 'h:' + n).join('  '));
  lines.push('', '== Top accounts seen');
  r.Top.filter(t => t[1] === 'Accounts seen').slice(0, 15).forEach(t => lines.push(`${t[3]}: ${t[4]}${t[5] ? ' (' + t[5] + ' liked)' : ''}${t[6] ? ' [' + t[6] + ']' : ''}`));
  lines.push('', `== Quiet interests (seen ${CONFIG.QUIET_MIN_VIEWS}+ times, no like, search or follow)`);
  r['Quiet interests'].forEach(q => lines.push(`${q[2]}: ${q[3]} times, follow: ${q[6]}${q[7] ? ' [' + q[7] + ']' : ''}${q[8] ? ', ' + q[8] : ''}${q[9] ? ' | ' + clip_(q[9], 120) : ''}`));
  lines.push('', '== Top hashtags seen', r.Top.filter(t => t[1] === 'Hashtags seen').slice(0, 20).map(t => `${t[3]} ${t[4]}`).join(', '));
  lines.push('', '== My actions (newest first)');
  r.Actions.forEach(a => lines.push(`${a[1]} ${a[2]} ${a[3]} ${a[4]}${a[6] ? ': ' + clip_(a[6], 220) : ''}`));
  lines.push('', '== Labels Meta uses to target me (* = new this month)');
  lines.push(r.Meta.filter(x => x[1] === 'Ad category' && x[3] !== 'Removed').map(x => (x[3] === 'New' ? '*' : '') + x[2]).join('; '));
  lines.push('', '== Locations Meta links to me', exp.locationsOfInterest.concat(exp.basedIn ? ['based in ' + exp.basedIn] : []).join('; '));
  if (prev) {
    lines.push('', `== Previous month (${prev.month})`);
    ['Items seen', 'Seen per day', 'Liked posts', 'Active ratio', 'Late-night share', 'Focus spread', 'Top theme', 'Top theme share']
      .forEach(h => lines.push(`${h}: ${fmtAuto_('Monthly', h, prev.m[h])}`));
    lines.push('Themes: ' + Object.keys(prev.themes).map(t => `${t} ${fmtVal_(prev.themes[t].share, 'pct')}`).join(', '));
  }
  const text = lines.join('\n');
  return text.length > 45000 ? text.slice(0, 45000) + '\n…(truncated)' : text;
}

/** Scores every risk in RISKS for one month. Returns register rows and a 0–100 index (share of the maximum possible score). */
function assessRisks_(month, monthly, prevMonthly, prevScores, coverage) {
  const withDerived = m => Object.assign({}, m, { 'Blocked or reported': (+m['Blocked'] || 0) + (+m['Reported / not interested'] || 0) });
  const m = withDerived(monthly);
  const pm = prevMonthly ? withDerived(prevMonthly) : null;
  let total = 0;
  let max = 0;
  const rows = RISKS.map(risk => {
    const value = +m[risk.metric] || 0;
    const reached = risk.steps.filter(step => (risk.lowerIsWorse ? value < step : value >= step)).length;
    const likelihood = Math.min(5, 1 + reached + (risk.bump && risk.bump(m, pm) ? 1 : 0));
    const score = likelihood * risk.impact;
    total += score;
    max += 5 * risk.impact;
    const before = prevScores && prevScores[risk.code] !== undefined && prevScores[risk.code] !== '' ? +prevScores[risk.code] : '';
    // A month without enough viewing history behind it gets no directional trend: against a better-observed
    // month it would read "worse" or "better" when the real difference is only how many days were collected.
    // The other side of the comparison is already handled — loadPreviousBucket_ hands back only a month that
    // clears the same bar.
    const trend = coverage < CONFIG.MIN_TREND_COVERAGE ? 'Partial month'
      : before === '' ? (prevScores ? 'new' : '') : score > before ? `▲ +${score - before}` : score < before ? `▼ −${before - score}` : '＝';
    return [month, risk.code, T_(risk.name), T_(risk.category), likelihood, risk.impact, score, ratingFor_(score),
      before, trend, risk.evidence(m), T_(risk.mitigation)];
  });
  return { rows: rows, index: Math.round(100 * total / max) };
}

function ratingFor_(score) {
  return RATING.find(r => score <= r[0])[1];
}

/** "🟠 High" → "High" */
function ratingKey_(label) {
  return String(label).replace(/^\S+\s/, '');
}

/** Rebuilds the "previous month" view from sheet rows (the same shape analyzeExport_ writes). */
function bucketFromRows_(month, rows, isWeekBucket) {
  const mRow = (rows.Monthly || []).find(r => String(r[0]) === month);
  if (!mRow) return null;
  const view = { month: month, m: {}, profile: {}, themes: {}, hours: new Array(24).fill(0), weekdays: new Array(7).fill(0), meta: {}, quiet: new Set(), risks: {} };
  // The parent row is the one place the two buckets are NOT position-identical: Weekly carries 'Week start' in
  // column 1 where Monthly carries 'Period start'. Read it through its own header, then alias the key column so
  // every caller downstream can keep saying prev.m['Month'].
  HEADERS[isWeekBucket ? 'Weekly' : 'Monthly'].forEach((h, k) => { view.m[h] = mRow[k]; });
  if (isWeekBucket) view.m.Month = view.m.Week;
  const mine = name => (rows[name] || []).filter(r => String(r[0]) === month);
  mine('Profile').forEach(r => { view.profile[r[2]] = r[3]; });
  mine('Themes').forEach(r => { view.themes[r[1]] = { seen: r[2], share: r[3], liked: r[4] }; });
  mine('Rhythm').forEach(r => {
    if (r[1] === 'Hour') view.hours[+r[2]] = +r[4];
    else view.weekdays[+r[2] - 1] = +r[4];
  });
  mine('Quiet interests').forEach(r => { view.quiet.add(String(r[2])); });
  mine('Risks').forEach(r => { view.risks[String(r[1])] = r[6]; });
  mine('Meta').filter(r => r[3] !== 'Removed').forEach(r => { (view.meta[r[1]] = view.meta[r[1]] || new Set()).add(String(r[2])); });
  return view;
}

// ── Small helpers ────────────────────────────────────────────────────────────

function countBy_(items, key) {
  const out = {};
  items.forEach(i => {
    const k = key(i);
    if (k) out[k] = (out[k] || 0) + 1;
  });
  return out;
}

function topEntries_(counts, n) {
  return Object.keys(counts).map(k => [k, counts[k]]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
}

function unique_(arr) {
  return Array.from(new Set(arr));
}

function normalizedEntropy_(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total || counts.length < 2) return 0;
  const h = counts.filter(c => c > 0).reduce((acc, c) => acc - (c / total) * Math.log(c / total), 0);
  return h / Math.log(counts.length);
}

function round_(v, digits) {
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
}

function pad2_(n) {
  return (n < 10 ? '0' : '') + n;
}

function clip_(s, n) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function fmtVal_(v, fmt) {
  if (v === '' || v === null || v === undefined) return '';
  if (fmt === 'pct') return (v * 100).toFixed(1) + '%';
  if (fmt === 'num1') return (+v).toFixed(1);
  if (fmt === 'num2') return (+v).toFixed(2);
  if (fmt === 'int') return String(Math.round(v));
  return String(v);
}

function fmtAuto_(sheet, header, v) {
  const f = (NUMBER_FORMATS[sheet] || {})[header];
  if (typeof v !== 'number') return String(v);
  if (f && f.indexOf('%') >= 0) return fmtVal_(v, 'pct');
  if (f === '0.00') return fmtVal_(v, 'num2');
  if (f === '0.0') return fmtVal_(v, 'num1');
  return String(v);
}

function changeText_(cur, prev) {
  if (!prev) return '';
  const pct = Math.round(100 * (cur - prev) / prev);
  return (pct > 0 ? '+' : '') + pct + '%';
}

function monthName_(ym) {
  const [y, mo] = String(ym).split('-');
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+mo - 1] + ' ' + y;
}

// ── Network ──────────────────────────────────────────────────────────────────
//
// One row per account you are connected to or keep meeting. The follow lists say who follows whom; the Accounts
// tab, summed over every month, says how much attention each account gets. Monthly exports carry your full
// following list but only that month's new followers; an "All time" export of Followers and following fills in
// the rest. Each account keeps the date of the newest list it appeared in, and each kind of list keeps the date of
// its newest complete copy, so the result doesn't depend on the order exports arrive in.

const NETWORK_LISTS = [
  { key: 'following', column: 'In following list', since: 'You follow since', prop: 'NETWORK_FOLLOWING_AT' },
  { key: 'followers', column: 'In followers list', since: 'Follows you since', prop: 'NETWORK_FOLLOWERS_AT' },
  { key: 'closeFriends', column: 'In close friends list', since: '', prop: 'NETWORK_CLOSE_AT' },
];

/** From closest to farthest. The network view places accounts in this order. */
const NETWORK_STATUSES = ['Close friend', 'Inner circle', 'Engaged follow', 'Quiet follow', 'Active follow',
  'Dormant follow', 'Fan', 'Chosen, not followed', 'Pushed by feed', 'Unfollowed', 'Blocked'];

/**
 * Every dated export — a day, a week, a month, a quarter, a full year — carries real per-item timestamps and
 * gets decomposed into the real calendar month(s) it touches (see monthsTouched_/mergeForMonth_ below). Only
 * "All time" is different: it's a point-in-time snapshot of your followers/following with no dated activity
 * to attribute to any month, so it only feeds the Network tab. (This used to also exclude anything longer
 * than 62 days, on the theory that a long export "isn't really a month" — but that just made a yearly export
 * invisible at the month level instead of decomposing it, which is exactly what this function now does.)
 */
function hasDatedActivity_(exp) {
  return !exp.allTime;
}

/** Tells an ISO week key ("2026-W38") from a month key ("2026-09"), which is how one merge path serves both. */
const WEEK_KEY = /^\d{4}-W\d{2}$/;

/**
 * The ISO week a day belongs to, as "2026-W38". Weeks run Monday to Sunday and belong to the year holding
 * their Thursday, so the first days of January can sit in the previous year's last week — which is why the
 * year in the key is computed from that Thursday rather than from the date itself.
 */
function isoWeekKey_(ymd) {
  const parts = String(ymd).split('-').map(Number);
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const weekday = dt.getUTCDay() || 7; // Sunday is 0 in JS, 7 in ISO
  dt.setUTCDate(dt.getUTCDate() + 4 - weekday); // the Thursday of this week decides the year
  const isoYear = dt.getUTCFullYear();
  const jan1 = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((dt.getTime() - jan1) / 86400000 + 1) / 7);
  return isoYear + '-W' + pad2_(week);
}

/** Monday of an ISO week, as "yyyy-MM-dd" — what the dashboard shows as the week's start. */
function isoWeekStart_(key) {
  const parts = String(key).split('-W').map(Number);
  const jan4 = new Date(Date.UTC(parts[0], 0, 4)); // Jan 4 is always in ISO week 1
  const weekday = jan4.getUTCDay() || 7;
  const week1Monday = jan4.getTime() - (weekday - 1) * 86400000;
  return Utilities.formatDate(new Date(week1Monday + (parts[1] - 1) * 7 * 86400000), 'UTC', 'yyyy-MM-dd');
}

/**
 * The ISO weeks an export actually holds activity for — taken from the items' own dates, not from the
 * declared period. A yearly export declares 52 weeks and carries activity for a handful, and building 52
 * weekly buckets to find 51 of them empty is exactly the waste that made runs unfinishable. Months are
 * still derived from the declared period (monthsTouched_), because a month is a claim about a span; a week
 * here is a claim about activity.
 */
function weeksTouched_(exp) {
  const keys = {};
  DAY_LOG_FIELDS.forEach(field => (exp[field] || []).forEach(item => {
    if (item.time) keys[isoWeekKey_(Utilities.formatDate(item.time, CONFIG.LOCAL_TIMEZONE, 'yyyy-MM-dd'))] = true;
  }));
  return Object.keys(keys).sort();
}

/** How many real calendar days a named month ("2026-09") has. Plain calendar arithmetic, no timezone involved. */
function daysInMonth_(ym) {
  const parts = String(ym).split('-').map(Number);
  return new Date(parts[0], parts[1], 0).getDate();
}

/** Every calendar month ("yyyy-MM") a period touches, inclusive of both ends — one for a day or a week,
 * two for a week that crosses a month boundary, a dozen or more for a year. Always at least one. */
function monthsTouched_(exp) {
  const startYm = Utilities.formatDate(exp.periodStart, CONFIG.LOCAL_TIMEZONE, 'yyyy-MM');
  const endYm = Utilities.formatDate(exp.periodEnd, CONFIG.LOCAL_TIMEZONE, 'yyyy-MM');
  const months = [];
  let [y, m] = startYm.split('-').map(Number);
  const [endY, endM] = endYm.split('-').map(Number);
  while (y < endY || (y === endY && m <= endM)) {
    months.push(y + '-' + pad2_(m));
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

/**
 * Every already-processed OR just-parsed source whose own period overlaps `month`, as `{src, exp}` pairs
 * ready for mergeForMonth_. A source already in memory this run (part of `freshDated`) is reused as-is; an
 * older one is found via the Log (which — see writeLog_ — keeps enough of every dated source's Kind/Period
 * start/Period end to reopen it) and re-parsed the same way findExportSources_/readExportFiles_/parseExport_
 * already turn any Drive source into item lists. Nothing here is thrown away after a run: the original
 * delivery files stay in "Instagram Exports", so a month can always be rebuilt from scratch as more of its
 * weeks arrive, in whatever order they arrive.
 */
/**
 * Parsed exports, keyed by source id, for the length of one run. sourcesForMonth_ is called once per month
 * and re-read every contributing delivery from Drive each time, so six deliveries spanning thirteen months
 * meant about seventy-eight full re-reads in a single execution — on its own enough to guarantee the run
 * never finished. Cleared at the top of processNewExports so nothing is carried between runs.
 */
let PARSE_CACHE = {};

/** Months a previous run ran out of budget before reaching. Kept in Script Properties, which — unlike Sheet
 * writes — land immediately, so they survive an execution being killed at the 6-minute ceiling. */
function pendingMonths_() {
  const raw = PropertiesService.getScriptProperties().getProperty('PENDING_MONTHS');
  try {
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return []; // a corrupted value is not worth failing a run over; the months get rediscovered anyway
  }
}

function setPendingMonths_(months) {
  const props = PropertiesService.getScriptProperties();
  if (months && months.length) props.setProperty('PENDING_MONTHS', JSON.stringify(months));
  else props.deleteProperty('PENDING_MONTHS');
}

function sourcesForMonth_(month, freshDated) {
  // Which deliveries feed this bucket. For a month that is "does its declared period reach into the month";
  // for a week, "does it actually hold activity in that week" — the same asymmetry weeksTouched_ draws.
  const isWeek = WEEK_KEY.test(month);
  const touches = exp => (isWeek ? weeksTouched_(exp) : monthsTouched_(exp)).indexOf(month) >= 0;
  const fresh = freshDated.filter(item => touches(item.exp));
  const freshIds = new Set(fresh.map(item => item.src.id));
  const idCol = HEADERS.Log.indexOf('Source ID'), nameCol = HEADERS.Log.indexOf('Source name'),
    resultCol = HEADERS.Log.indexOf('Result'), kindCol = HEADERS.Log.indexOf('Kind'),
    startCol = HEADERS.Log.indexOf('Period start'), endCol = HEADERS.Log.indexOf('Period end');
  const older = readRows_('Log')
    .filter(r => /^OK:/.test(String(r[resultCol])) && r[kindCol] && r[startCol] instanceof Date && r[endCol] instanceof Date)
    .filter(r => !freshIds.has(String(r[idCol])))
    // A logged source stores only its period, not its items, so week membership is tested as an overlap of
    // the week's seven days with that period; whether it really has activity there is settled after parsing.
    .filter(r => (isWeek
      ? isoWeekStart_(month) <= fmtDate_(r[endCol])
        && Utilities.formatDate(new Date(dateCell_(isoWeekStart_(month)).getTime() + 6 * 86400000),
          CONFIG.LOCAL_TIMEZONE, 'yyyy-MM-dd') >= fmtDate_(r[startCol])
      : monthsTouched_({ periodStart: r[startCol], periodEnd: r[endCol] }).indexOf(month) >= 0))
    .map(r => {
      const id = String(r[idCol]), kind = String(r[kindCol]);
      // A file the pipeline already parsed successfully once shouldn't normally fail to re-open — but it can
      // (moved out of Drive, trashed, edited by hand), and one bad historical contributor must not abort the
      // whole run over a month that would otherwise merge fine from its other contributors.
      try {
        const src = { id: id, name: String(r[nameCol]), kind: kind, ref: kind === 'zip' ? DriveApp.getFileById(id) : DriveApp.getFolderById(id) };
        if (!PARSE_CACHE[id]) PARSE_CACHE[id] = parseExport_(readExportFiles_(src));
        return { src: src, exp: PARSE_CACHE[id] };
      } catch (e) {
        // A synthetic id distinct from the source's own, deliberately: writeLog_ upserts by id, and reusing
        // the real source id here would overwrite its existing "OK: ..." row (erasing its Kind/Period start/
        // end and dropping it out of processedSourceIds_'s "done" set, which would just retry — and re-fail —
        // this same read forever).
        writeLog_({ id: 'reread-failed:' + id + ':' + month, name: String(r[nameCol]) }, '', '',
          `Noted: "${r[nameCol]}" could no longer be re-read while rebuilding ${month} (${e.message}); left out of that month`);
        return null;
      }
    })
    .filter(Boolean);
  return fresh.concat(older);
}

// Item-level activity logs: each entry is one dated thing that happened, so these are split across
// contributors day by day (see mergeForMonth_). Not included: entries with no `.time` at all are kept
// wherever they appear, since there's no day to own them or reassign them to.
const DAY_LOG_FIELDS = ['postsViewed', 'videosWatched', 'likedPosts', 'likedComments', 'adsViewed',
  'notInterested', 'profileSearches', 'wordSearches'];
// The feed-viewing history specifically — the subset Instagram only keeps about a week of, and the subset
// nearly every headline number is derived from. Coverage is measured in these days alone (see mergeForMonth_).
const VIEW_FIELDS = ['postsViewed', 'videosWatched'];
// State as of a delivery, not a dated event log — a following/followers/blocked list is a complete,
// internally-consistent snapshot (each entry may carry its own "since" date, but the *list itself* isn't
// something a single day belongs to), so these come wholesale from whichever contributor was processed most
// recently, never split across contributors by day.
// The belonging sources belong here for the same reason, and each for its own: notes and reposts carry no
// timestamp at all (see parseNotes_), so there is no day to split them across; and the three insight cards
// are Instagram's own rolling ~90-day aggregates, already computed over a window that is not this month and
// cannot be cut into days without inventing numbers. Both take "newest delivery wins" unchanged. Leaving
// them off this list does not fail loudly — the merged export simply has no such field, and every belonging
// row reads "no data" while the parsers are working perfectly. That is exactly what happened first.
const SNAPSHOT_FIELDS = ['following', 'followers', 'blocked', 'closeFriends', 'metaCategories',
  'locationsOfInterest', 'advertisers', 'basedIn', 'owner', 'exportTimezone',
  'notes', 'reachCard', 'interactionCard', 'audienceCard'];

/**
 * Builds one synthetic export, shaped exactly like parseExport_'s output, representing everything known
 * about `month` across every contributor that touches it. Per the confirmed "newest delivery wins" rule:
 * contributors are ordered by their own periodEnd (the one covering later days is the newer delivery), and
 * for each calendar day in the month, only the latest contributor covering that day keeps its items for that
 * day — so two non-overlapping weeks simply combine, and an overlapping day only counts once, from the
 * fresher delivery. `coverage` (distinct covered days ÷ real days in the month) rides along on the result so
 * the caller can flag a month built from an incomplete set of deliveries instead of showing it as if it were
 * whole.
 */
function mergeForMonth_(month, contributors) {
  const ordered = contributors.slice().sort((a, b) => a.exp.periodEnd - b.exp.periodEnd);
  const dateOf = item => (item.time ? Utilities.formatDate(item.time, CONFIG.LOCAL_TIMEZONE, 'yyyy-MM-dd') : null);
  // The only two things in this whole function that know what a "month" is: which days belong to the bucket,
  // and how many days a full bucket holds. Both switch on the key's shape, so an ISO week key ("2026-W38")
  // runs the identical day-ownership, newest-wins and coverage logic with nothing else changed.
  const isWeek = WEEK_KEY.test(month);
  const inMonth = d => d && (isWeek ? isoWeekKey_(d) === month : d.slice(0, 7) === month);
  const bucketDays = isWeek ? 7 : daysInMonth_(month);

  // "Known" days feed Coverage and the merged period's bounds: every day any contributor's own DECLARED
  // period spans, whether or not that contributor happens to have an item on it (a real, legitimately quiet
  // day still counts as known) — plus, since Meta's own exports aren't always tidy, any day an item actually
  // turns up on even if it falls just outside its own contributor's declared window (confirmed against real
  // export files, not a hypothetical: the single-export code path never checked this, it just summed the
  // whole file).
  const knownDays = new Set();
  ordered.forEach(c => {
    for (let t = c.exp.periodStart.getTime(); t < c.exp.periodEnd.getTime(); t += 86400000) {
      const d = Utilities.formatDate(new Date(t), CONFIG.LOCAL_TIMEZONE, 'yyyy-MM-dd');
      if (inMonth(d)) knownDays.add(d);
    }
  });

  const merged = {};
  DAY_LOG_FIELDS.forEach(field => {
    // Ownership is decided PER FIELD, by which contributor actually HAS an item that day — never by whose
    // declared period merely spans it. Deciding it by declared period alone was the bug this replaced: a
    // newer delivery's period can nominally cover a day it has zero real items for, and doing that let it
    // silently wipe out an older delivery's real items for that same day instead of just losing a tiebreak
    // it was never actually part of. Iterating oldest to newest and letting a later write plainly overwrite
    // an earlier one is what makes "newest delivery wins" fall out for a day two contributors both have data
    // for, with no separate tie-break logic needed.
    const dayOwner = {};
    ordered.forEach((c, idx) => (c.exp[field] || []).forEach(item => {
      const d = dateOf(item);
      if (inMonth(d)) { dayOwner[d] = idx; knownDays.add(d); }
    }));
    merged[field] = [];
    ordered.forEach((c, idx) => (c.exp[field] || []).forEach(item => {
      const d = dateOf(item);
      if (d === null || (inMonth(d) && dayOwner[d] === idx)) merged[field].push(item);
    }));
  });
  const newest = ordered[ordered.length - 1].exp;
  SNAPSHOT_FIELDS.forEach(field => { merged[field] = newest[field]; });

  merged.allTime = false;
  merged.month = month;
  const coveredDays = Array.from(knownDays).sort();
  if (coveredDays.length) {
    merged.periodStart = dateCell_(coveredDays[0]);
    merged.periodEnd = new Date(dateCell_(coveredDays[coveredDays.length - 1]).getTime() + 86400000);
  } else {
    // Shouldn't happen (a contributor only gets here because monthsTouched_ says it touches `month`), but
    // fall back to the newest contributor's own span rather than producing an export with no period at all.
    merged.periodStart = newest.periodStart;
    merged.periodEnd = newest.periodEnd;
  }
  merged.itemCount = DAY_LOG_FIELDS.reduce((n, f) => n + merged[f].length, 0);

  // Coverage is measured in days of *viewing* history, not days of declared period, because those are the
  // days almost everything on the dashboard is computed from — minutes, items seen, themes, top accounts,
  // quiet interests, the risk index. Instagram keeps only about a week of view history however long a period
  // you request, while likes and searches span the whole of it, so the two run on completely different
  // clocks: a yearly export declares 365 days, carries likes across most of them, and holds view history for
  // about seven. Measuring off the declaration called month after empty month 100% complete, and those
  // months then passed loadPreviousBucket_'s completeness test and became the baseline real months were
  // compared against. A month whose likes arrived but whose viewing history did not is honestly 0% covered;
  // its like data is still written and still visible, it just never stands in as a month to compare against.
  const viewDays = new Set();
  ordered.forEach(c => {
    const days = [];
    VIEW_FIELDS.forEach(f => (c.exp[f] || []).forEach(item => {
      const d = dateOf(item);
      if (inMonth(d)) days.push(d);
    }));
    if (!days.length) return;
    days.sort();
    // Every day from this delivery's first viewing day to its last counts as reported on, including ones it
    // recorded no activity for — a quiet day inside the window is a real quiet day, not a gap in the data.
    // Done per delivery rather than across all of them, so a genuine gap between two deliveries stays a gap.
    for (let t = dateCell_(days[0]).getTime(); t <= dateCell_(days[days.length - 1]).getTime(); t += 86400000) {
      const d = Utilities.formatDate(new Date(t), CONFIG.LOCAL_TIMEZONE, 'yyyy-MM-dd');
      if (inMonth(d)) viewDays.add(d);
    }
  });
  merged.viewDays = viewDays.size;
  merged.coverage = Math.min(1, viewDays.size / bucketDays);
  return merged;
}

/** Rebuilds the Network tab from the follow lists in `exps` plus every month in the Accounts tab. Returns the row count. */
function updateNetwork_(exps) {
  const h = HEADERS.Network;
  const col = name => h.indexOf(name);
  const props = PropertiesService.getScriptProperties();
  const existing = readRows_('Network');
  const rows = new Map(existing.filter(r => r[0]).map(r => [String(r[0]).toLowerCase(), r.slice()]));
  const rowFor = account => {
    const key = String(account).toLowerCase();
    if (!rows.has(key)) rows.set(key, h.map(name => (name === 'Account' ? account : '')));
    return rows.get(key);
  };
  const earliest = (row, name, day) => {
    if (!row[col(name)] || day < String(row[col(name)])) row[col(name)] = day;
  };

  exps.forEach(exp => {
    const end = fmtDate_(exp.periodEnd);
    NETWORK_LISTS.forEach(list => {
      const people = exp[list.key];
      if (!people) return;
      // A list with entries older than the export's period is the full list, not just that period's additions.
      const complete = exp.allTime || list.key === 'closeFriends' || people.some(p => p.time && p.time < exp.periodStart);
      people.filter(p => p.account).forEach(p => {
        const row = rowFor(p.account);
        const day = p.time ? fmtDate_(p.time) : end;
        if (list.since) earliest(row, list.since, day);
        const listed = complete ? end : day;
        if (listed > String(row[col(list.column)])) row[col(list.column)] = listed;
      });
      if (complete && end > (props.getProperty(list.prop) || '')) props.setProperty(list.prop, end);
    });
    exp.blocked.filter(b => b.account && b.time).forEach(b => earliest(rowFor(b.account), 'Blocked since', fmtDate_(b.time)));
  });

  const accountRows = readRows_('Accounts');
  const recent = new Set(unique_(accountRows.map(r => String(r[0]))).sort().slice(-CONFIG.NETWORK_RECENT_MONTHS));
  const activity = new Map();
  accountRows.forEach(([month, account, seen, , , liked, searched, , themes]) => {
    const key = String(account).toLowerCase();
    const a = activity.get(key) || { account: account, seen: 0, liked: 0, searched: 0, months: new Set(), recentSeen: 0, recentActs: 0, themes: {} };
    const total = (+seen || 0) + (+liked || 0) + (+searched || 0);
    a.seen += +seen || 0;
    a.liked += +liked || 0;
    a.searched += +searched || 0;
    if (total) a.months.add(String(month));
    if (recent.has(String(month))) {
      a.recentSeen += +seen || 0;
      a.recentActs += (+liked || 0) + (+searched || 0);
    }
    String(themes).split(', ').filter(Boolean).forEach(t => { a.themes[t] = (a.themes[t] || 0) + total; });
    activity.set(key, a);
  });
  activity.forEach(a => { if (a.recentActs || a.recentSeen >= 3) rowFor(a.account); });

  const current = (row, list) => {
    const listed = String(row[col(list.column)]);
    const snapshot = props.getProperty(list.prop);
    return !!listed && (!snapshot || listed >= snapshot);
  };
  const none = { seen: 0, liked: 0, searched: 0, months: new Set(), recentSeen: 0, recentActs: 0, themes: {} };
  const out = [];
  rows.forEach((row, key) => {
    const a = activity.get(key) || none;
    const youFollow = current(row, NETWORK_LISTS[0]);
    const followsYou = current(row, NETWORK_LISTS[1]);
    const close = current(row, NETWORK_LISTS[2]);
    const blocked = !!row[col('Blocked since')];
    const relation = blocked ? 'Blocked' : youFollow && followsYou ? 'Mutual' : youFollow ? 'You follow'
      : followsYou ? 'Follows you' : row[col('You follow since')] ? 'Unfollowed' : 'Not connected';
    const status = blocked ? 'Blocked'
      : close ? 'Close friend'
      : relation === 'Mutual' && a.recentActs ? 'Inner circle'
      : youFollow && a.recentActs ? 'Engaged follow'
      : youFollow && a.recentSeen >= CONFIG.QUIET_MIN_VIEWS ? 'Quiet follow'
      : youFollow && a.recentSeen ? 'Active follow'
      : youFollow ? 'Dormant follow'
      : followsYou ? 'Fan'
      : a.recentActs ? 'Chosen, not followed'
      : a.recentSeen >= 3 ? 'Pushed by feed'
      : relation === 'Unfollowed' ? 'Unfollowed'
      : 'Passing';
    // Accounts met only in passing drop out, unless you wrote something about them.
    if (status === 'Passing' && !row[col('Region')] && !row[col('Note')]) return;
    const themes = topEntries_(a.themes, 3).filter(e => e[1] > 0).map(e => e[0]);
    const set = (name, v) => { row[col(name)] = v; };
    set('Relation', relation);
    set('Status', status);
    set('Cluster', themes[0] || (a.seen + a.liked ? 'Other' : 'No content seen'));
    set('Themes', themes.join(', '));
    set('Seen', a.seen);
    set('Liked', a.liked);
    set('Searched', a.searched);
    set('Attention', a.seen + 5 * a.liked + 3 * a.searched);
    set('Active months', a.months.size);
    set('Last active', a.months.size ? Array.from(a.months).sort().pop() : '');
    set('Close friend', close ? 'Yes' : '');
    set('Profile', 'https://www.instagram.com/' + row[0]);
    out.push(row);
  });

  const rank = s => (NETWORK_STATUSES.indexOf(s) >= 0 ? NETWORK_STATUSES.indexOf(s) : NETWORK_STATUSES.length);
  out.sort((x, y) => rank(x[col('Status')]) - rank(y[col('Status')])
    || y[col('Attention')] - x[col('Attention')] || String(x[0]).localeCompare(String(y[0])));
  writeBody_(ensureSheet_('Network'), 'Network', out, existing.length, h.length);
  return out.length;
}

/** Before reprocessing everything: forget list dates and totals, keeping only what you typed (Region, Note). */
function resetNetworkLists_() {
  const props = PropertiesService.getScriptProperties();
  NETWORK_LISTS.forEach(list => props.deleteProperty(list.prop));
  const h = HEADERS.Network;
  const existing = readRows_('Network');
  const kept = existing.filter(r => r[h.indexOf('Region')] || r[h.indexOf('Note')])
    .map(r => h.map((name, i) => (['Account', 'Region', 'Note'].indexOf(name) >= 0 ? r[i] : '')));
  writeBody_(ensureSheet_('Network'), 'Network', kept, existing.length, h.length);
}

/** Opens the network graph. It is drawn inside the dialog from the Network tab; nothing loads from other sites. */
function openNetworkView() {
  const view = HtmlService.createTemplateFromFile('NetworkView');
  view.data = JSON.stringify(networkViewData_()).replace(/</g, '\\u003c');
  SpreadsheetApp.getUi().showModalDialog(view.evaluate().setWidth(1200).setHeight(820), 'Your Instagram network');
}

function networkViewData_() {
  const h = HEADERS.Network;
  const get = (r, name) => r[h.indexOf(name)];
  return {
    followersComplete: !!PropertiesService.getScriptProperties().getProperty('NETWORK_FOLLOWERS_AT'),
    statuses: NETWORK_STATUSES,
    nodes: readRows_('Network').filter(r => NETWORK_STATUSES.indexOf(get(r, 'Status')) >= 0).map(r => ({
      account: String(get(r, 'Account')), relation: get(r, 'Relation'), status: get(r, 'Status'), cluster: get(r, 'Cluster'),
      themes: get(r, 'Themes'), seen: +get(r, 'Seen') || 0, liked: +get(r, 'Liked') || 0, searched: +get(r, 'Searched') || 0,
      attention: +get(r, 'Attention') || 0, lastActive: String(get(r, 'Last active') || ''),
      followSince: String(get(r, 'You follow since') || ''), followerSince: String(get(r, 'Follows you since') || ''),
      region: String(get(r, 'Region') || ''),
    })),
  };
}

// ── Writing to the spreadsheet ───────────────────────────────────────────────

function ensureSheet_(name) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    // Two executions can find the same tab missing and both try to create it: the web app's payload read and
    // the trigger's own run share no lock. The window is normally shut — every tab already exists — but the
    // first run after a release that adds tabs has all of them missing at once, which is when this bites.
    // Losing that race is not a failure: the tab exists either way, which is all the caller asked for.
    try {
      sh = ss.insertSheet(name);
    } catch (e) {
      sh = ss.getSheetByName(name);
      if (!sh) throw e; // the insert failed for some other reason, and that is worth surfacing
    }
  }
  const headers = HEADERS[name];
  if (headers) {
    if (sh.getMaxColumns() < headers.length) sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
    const current = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    if (current.join('|') !== headers.join('|')) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers])
        .setFontWeight('bold').setBackground(COLORS.header).setFontColor(COLORS.ink);
      sh.setFrozenRows(1);
    }
  }
  return sh;
}

function readRows_(name) {
  const sh = ensureSheet_(name);
  const width = HEADERS[name].length;
  return sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, width).getValues() : [];
}

/** Replaces one month's rows in a tab, keeping the tab sorted by month. */
function writeMonthRows_(name, month, rows) {
  const sh = ensureSheet_(name);
  const width = HEADERS[name].length;
  const existing = readRows_(name);
  const data = existing.filter(r => String(r[0]) !== month)
    .concat(rows)
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  writeBody_(sh, name, data, existing.length, width);
}

function writeBody_(sh, name, data, oldCount, width) {
  if (oldCount) sh.getRange(2, 1, oldCount, width).clearContent();
  if (!data.length) return;
  const needed = data.length + 1;
  if (sh.getMaxRows() < needed) sh.insertRowsAfter(sh.getMaxRows(), needed - sh.getMaxRows());
  const headers = HEADERS[name];
  (TEXT_COLUMNS[name] || []).forEach(h => {
    const c = headers.indexOf(h) + 1;
    if (c) sh.getRange(2, c, data.length).setNumberFormat('@');
  });
  const body = sh.getRange(2, 1, data.length, width);
  body.setValues(data.map(r => r.map(safeCell_)));
  const formats = Object.assign({ 'Month date': 'yyyy-mm-dd', Day: 'yyyy-mm-dd' }, NUMBER_FORMATS[name] || {});
  Object.keys(formats).forEach(h => {
    const c = headers.indexOf(h) + 1;
    if (c) sh.getRange(2, c, data.length).setNumberFormat(formats[h]);
  });
  if (name === 'Prompt' || name === 'Actions') body.setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
}

/**
 * Persists a week from a full analyzeExport_ result. The analysis is identical to a month's — same merge,
 * same measurements — so every child tab a month writes has a weekly twin here, and nothing the pipeline
 * computed is thrown away. Previously only Weekly/themes/top were stored, which is why the dashboard's risk,
 * signal, indicator, quiet-interest and hourly sections were blank in Weekly mode: the numbers existed and
 * were being discarded one line before the write.
 */
function writeWeekResult_(week, result) {
  const start = dateCell_(isoWeekStart_(week));
  const metrics = HEADERS.Weekly.slice(2); // everything after Week / Week start
  writeMonthRows_('Weekly', week, [[week, start].concat(metrics.map(h => result.monthly[h]))]);
  Object.keys(WEEKLY_CHILD_TABS).forEach(weekly => {
    const source = result.rows[WEEKLY_CHILD_TABS[weekly]];
    if (!source) return;
    // The month key sits in column 0 of every row analyzeExport_ produced; swap it for the week it belongs to.
    // Signals has no trailing date column, so the week start is appended only where the header asks for one.
    const trailing = HEADERS[weekly][HEADERS[weekly].length - 1] === 'Week start' ? [start] : [];
    writeMonthRows_(weekly, week, source.map(r => [week].concat(r.slice(1, HEADERS[weekly].length - trailing.length), trailing)));
  });
}

function writeResult_(result) {
  Object.keys(result.rows).forEach(name =>
    writeMonthRows_(name, result.month, result.rows[name].map(row => withDateColumns_(name, row))));
}

/** Fills the trailing "Month date" and "Day" columns with real dates, so Looker Studio reads them as dates. */
function withDateColumns_(name, row) {
  const headers = HEADERS[name];
  return row.concat(headers.slice(row.length).map(h => {
    if (h === 'Month date') return dateCell_(String(row[0]) + '-01');
    if (h === 'Day') return dateCell_(String(row[headers.indexOf('Date')]));
    return '';
  }));
}

/** "2026-08-01" → a Date at midday UTC, which shows as that same day in any sheet timezone. */
function dateCell_(ymd) {
  const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)) : '';
}

/** Text that starts like a formula is stored as text. */
function safeCell_(v) {
  return typeof v === 'string' && /^[=+\-]/.test(v) ? "'" + v : v;
}

/**
 * The bucket immediately before this one, as the baseline every trend, delta and "New vs Continuing" flag
 * compares against — or null when there is nothing comparable behind it.
 *
 * A week's baseline is the previous WEEK and a month's is the previous MONTH. That sounds obvious, but the
 * earlier version of this read the Monthly tab whatever it was handed, and `'2026-09' < '2026-W38'` is true
 * in string order, so every week quietly measured itself against a month — a seven-day bucket compared to a
 * thirty-day one, with no error to notice.
 *
 * The weekly child tabs are handed to bucketFromRows_ under their MONTHLY names. That is not a shortcut: the
 * two sets of headers are position-identical by construction (see weeklyHeadersOf_), so one set of column
 * indexes reads either bucket.
 */
function loadPreviousBucket_(key) {
  const week = WEEK_KEY.test(key);
  const parentTab = week ? 'Weekly' : 'Monthly';
  const rows = { Monthly: readRows_(parentTab) };
  const covCol = HEADERS[parentTab].indexOf('Coverage');
  // Only a bucket with enough viewing history behind it is a fair baseline — see CONFIG.MIN_TREND_COVERAGE.
  // A row from before Coverage existed has '' there and is taken at face value, since it was a genuine single
  // monthly export processed under the old one-export-one-month code.
  const isComparable = r => r[covCol] === '' || r[covCol] === undefined || +r[covCol] >= CONFIG.MIN_TREND_COVERAGE;
  const earlier = rows.Monthly.filter(r => String(r[0]) && String(r[0]) < key && isComparable(r))
    .map(r => String(r[0])).sort();
  if (!earlier.length) return null;
  ['Profile', 'Themes', 'Rhythm', 'Meta', 'Quiet interests', 'Risks'].forEach(name => {
    rows[name] = readRows_(week ? weeklyTabFor_(name) : name);
  });
  return bucketFromRows_(earlier[earlier.length - 1], rows, week);
}

/** The weekly twin of a monthly tab name, e.g. 'Quiet interests' → 'Weekly quiet'. */
function weeklyTabFor_(monthlyName) {
  const found = Object.keys(WEEKLY_CHILD_TABS).filter(w => WEEKLY_CHILD_TABS[w] === monthlyName);
  return found.length ? found[0] : monthlyName;
}

function seedSettings_() {
  const sh = ensureSheet_('Settings');
  if (sh.getLastRow() > 1) {
    // A sheet that already has rules predates any Kind it is missing entirely — Subtopic, for a sheet set up
    // before subtopics existed — so those defaults are added once. Keyed on the KIND and not on individual
    // rows on purpose: topping up row by row would resurrect every default anyone had deliberately deleted,
    // on every single run, and there would be no way to refuse a rule.
    const rows = readRows_('Settings');
    const kinds = {};
    rows.forEach(r => { kinds[String(r[0])] = true; });
    const missing = DEFAULT_RULES.filter(r => !kinds[r[0]]);
    if (missing.length) writeBody_(sh, 'Settings', rows.concat(missing), rows.length, HEADERS.Settings.length);
    return;
  }
  if (sh.getLastRow() <= 1) {
    writeBody_(sh, 'Settings', DEFAULT_RULES, 0, HEADERS.Settings.length);
    sh.setColumnWidth(1, 90).setColumnWidth(2, 210).setColumnWidth(3, 900);
    sh.getRange('C1').setNote('Comma-separated.\nword → words starting with it\n"word" → whole word only\n@account → posts from that account\n#tag → that hashtag\n\nAfter editing, run Instagram Insights → Reprocess everything.');
  }
}

function loadRules_() {
  seedSettings_();
  return compileRules_(readRows_('Settings'));
}

function processedSourceIds_() {
  return new Set(readRows_('Log').filter(r => /^(OK|Skipped)/.test(String(r[5]))).map(r => String(r[0])));
}

/**
 * `dated`, when given, is `{kind, periodStart, periodEnd}` for a real export source — recorded so a later
 * run can find this source again as a contributor to any calendar month its period touches (see
 * sourcesForMonth_) without re-walking Drive. Omitted for non-source log rows (the sweep's notes, the
 * network/dashboard rebuild markers), which leave Kind/Period start/Period end blank.
 */
function writeLog_(src, month, period, result, dated) {
  const sh = ensureSheet_('Log');
  const rows = readRows_('Log');
  const stamp = Utilities.formatDate(new Date(), CONFIG.LOCAL_TIMEZONE, 'yyyy-MM-dd HH:mm');
  const row = [src.id, src.name, month, period, stamp, result,
    dated ? dated.kind : '',
    dated ? dateCell_(fmtDate_(dated.periodStart)) : '',
    dated ? dateCell_(fmtDate_(dated.periodEnd)) : ''];
  const i = rows.findIndex(r => String(r[0]) === src.id);
  if (i >= 0) rows[i] = row;
  else rows.push(row);
  writeBody_(sh, 'Log', rows, rows.length - (i >= 0 ? 0 : 1), HEADERS.Log.length);
}

function toast_(msg) {
  try {
    SpreadsheetApp.getActive().toast(msg, 'Instagram Insights', 8);
  } catch (e) {
    // No UI when running from a trigger.
  }
}

function alert_(msg) {
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    console.log(msg);
  }
}

// ── Dashboard ────────────────────────────────────────────────────────────────

function buildDashboard() {
  const ss = SpreadsheetApp.getActive();
  const d = ss.getSheetByName(DASHBOARD) || ss.insertSheet(DASHBOARD, 0);
  ss.setActiveSheet(d);
  ss.moveActiveSheet(1);
  d.getCharts().forEach(c => d.removeChart(c));
  d.getRange(1, 1, d.getMaxRows(), d.getMaxColumns()).breakApart();
  d.clear();
  d.setConditionalFormatRules([]);
  d.setHiddenGridlines(true);
  if (d.getMaxColumns() < 14) d.insertColumnsAfter(d.getMaxColumns(), 14 - d.getMaxColumns());
  d.setColumnWidth(1, 16);
  for (let c = 2; c <= 13; c++) d.setColumnWidth(c, 104);
  d.setColumnWidth(14, 16);
  d.getRange(1, 1, d.getMaxRows(), 14).setFontFamily('Arial').setFontColor(COLORS.ink).setVerticalAlignment('middle');

  const rows = {
    Monthly: readRows_('Monthly'), Themes: readRows_('Themes'), Profile: readRows_('Profile'),
    Rhythm: readRows_('Rhythm'), Signals: readRows_('Signals'), 'Quiet interests': readRows_('Quiet interests'),
    Risks: readRows_('Risks'), Daily: readRows_('Daily'), Hourly: readRows_('Hourly'), Top: readRows_('Top'),
  };
  d.getRange('B1').setValue('Instagram Insights').setFontSize(20).setFontWeight('bold');
  const months = rows.Monthly.map(r => String(r[0])).filter(Boolean).sort();
  if (!months.length) {
    d.getRange('B2').setValue(`No data yet. Drop an Instagram export (.zip, HTML format) into the "${CONFIG.EXPORTS_FOLDER_NAME}" Drive folder, then use Instagram Insights → Process new exports now.`)
      .setFontColor(COLORS.ink2);
    return;
  }
  const curM = months[months.length - 1];
  const prevM = months.length > 1 ? months[months.length - 2] : null;
  const cur = bucketFromRows_(curM, rows, false);
  const prev = prevM ? bucketFromRows_(prevM, rows, false) : null;
  const curLabel = monthName_(curM);
  const prevLabel = prevM ? monthName_(prevM) : '';
  d.getRange('B2').setValue(`${curLabel} · ${cur.m['Period start']} → ${cur.m['Period end']} · times in ${CONFIG.LOCAL_TIMEZONE} · updated ${Utilities.formatDate(new Date(), CONFIG.LOCAL_TIMEZONE, 'yyyy-MM-dd HH:mm')}`)
    .setFontColor(COLORS.ink2);

  // KPI tiles
  const lastDataRow = rows.Monthly.length + 1;
  const monthlyCol = h => columnLetter_(HEADERS.Monthly.indexOf(h) + 1);
  const tiles = [
    ['Risk index (0–100)', 'Risk index', '0', 'int'],
    ['Est. minutes per active day', 'Est. minutes per active day', '0', 'rel'],
    ['Items seen per day', 'Seen per day', '0', 'rel'],
    ['Active ratio', 'Active ratio', '0.0%', 'pts'],
    ['Quiet share', 'Quiet share', '0%', 'pts'],
    ['Top theme', 'Top theme', null, 'text'],
  ];
  tiles.forEach(([label, key, format, deltaKind], k) => {
    const c = 2 + k * 2;
    d.getRange(4, c, 4, 2).setBackground(COLORS.surface)
      .setBorder(true, true, true, true, false, false, COLORS.grid, SpreadsheetApp.BorderStyle.SOLID);
    d.getRange(4, c, 1, 2).merge().setValue(label).setFontSize(9).setFontColor(COLORS.ink2);
    const value = d.getRange(5, c, 1, 2).merge();
    if (deltaKind === 'text') {
      value.setNumberFormat('@').setValue(cur.m[key]).setFontSize(12).setFontWeight('bold').setWrap(true);
      d.getRange(6, c, 1, 2).merge().setNumberFormat('@')
        .setValue(fmtVal_(cur.m['Top theme share'], 'pct') + ' of items').setFontSize(9).setFontColor(COLORS.ink2);
    } else {
      value.setValue(cur.m[key]).setNumberFormat(format).setFontSize(20).setFontWeight('bold');
      d.getRange(6, c, 1, 2).merge().setNumberFormat('@')
        .setValue(deltaText_(cur.m[key], prev ? prev.m[key] : null, deltaKind, prevLabel)).setFontSize(9).setFontColor(COLORS.ink2);
      if (months.length > 1) {
        const col = monthlyCol(key);
        d.getRange(7, c, 1, 2).merge().setFormula(`=SPARKLINE(Monthly!${col}2:${col}${lastDataRow})`);
      }
    }
  });
  d.setRowHeight(3, 10);
  d.setRowHeight(5, 36);
  d.setRowHeight(7, 26);

  // Risk analysis: matrix on the left, register on the right, then what to act on first
  let r = 9;
  d.getRange(r, 2).setValue(`Risk analysis · ${curLabel} · risk index ${cur.m['Risk index']}/100`).setFontSize(13).setFontWeight('bold');
  r++;
  const riskRows = rows.Risks.filter(k => String(k[0]) === curM);
  const top = r;
  d.getRange(top, 2).setValue('Impact ↓ Likelihood →').setFontSize(8).setFontColor(COLORS.muted).setWrap(true);
  for (let l = 1; l <= 5; l++) d.getRange(top, 2 + l).setValue(l).setFontSize(9).setFontColor(COLORS.ink2).setHorizontalAlignment('center');
  for (let i = 5; i >= 1; i--) {
    const row = top + 6 - i;
    d.getRange(row, 2).setValue(i).setFontSize(9).setFontColor(COLORS.ink2).setHorizontalAlignment('center');
    for (let l = 1; l <= 5; l++) {
      d.getRange(row, 2 + l).setNumberFormat('@')
        .setValue(riskRows.filter(k => +k[4] === l && +k[5] === i).map(k => k[1]).join(' '))
        .setBackground(RATING_COLORS[ratingKey_(ratingFor_(l * i))])
        .setHorizontalAlignment('center').setFontSize(9).setFontWeight('bold')
        .setBorder(true, true, true, true, false, false, COLORS.surface, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    }
    d.setRowHeight(row, 30);
  }
  const regSpans = [[8, 1], [9, 2], [11, 1], [12, 1], [13, 1]];
  const regRow = (values, row) => regSpans.forEach(([c, w], k) => {
    const cell = d.getRange(row, c, 1, w);
    if (w > 1) cell.merge();
    cell.setNumberFormat('@').setValue(values[k]);
  });
  regRow(['Code', 'Risk', 'Score', 'Rating', prevM ? 'vs ' + prevLabel : 'Trend'], top);
  d.getRange(top, 8, 1, 6).setFontWeight('bold').setFontSize(9).setFontColor(COLORS.ink2)
    .setBorder(false, false, true, false, false, false, COLORS.baseline, SpreadsheetApp.BorderStyle.SOLID);
  const ranked = riskRows.slice().sort((a, b) => b[6] - a[6]);
  ranked.forEach((k, i) => {
    regRow([k[1], k[2], `${k[6]} (${k[4]}×${k[5]})`, k[7], k[9] || '—'], top + 1 + i);
    d.getRange(top + 1 + i, 8, 1, 6).setFontSize(9);
    d.getRange(top + 1 + i, 12).setBackground(RATING_COLORS[ratingKey_(k[7])]);
  });
  r = top + Math.max(6, ranked.length) + 2;
  const urgent = ranked.filter(k => /High|Critical/.test(k[7]));
  if (urgent.length) {
    d.getRange(r, 2).setValue('Act on these first').setFontSize(11).setFontWeight('bold');
    r++;
    const actSpans = [[2, 1], [3, 2], [5, 4], [9, 5]];
    const actRow = (values, row) => actSpans.forEach(([c, w], k) => {
      const cell = d.getRange(row, c, 1, w);
      if (w > 1) cell.merge();
      cell.setNumberFormat('@').setValue(values[k]).setWrap(true);
    });
    actRow(['Code', 'Risk', 'Evidence', 'Mitigation'], r);
    d.getRange(r, 2, 1, 12).setFontWeight('bold').setFontSize(9).setFontColor(COLORS.ink2)
      .setBorder(false, false, true, false, false, false, COLORS.baseline, SpreadsheetApp.BorderStyle.SOLID);
    r++;
    urgent.forEach(k => {
      actRow([k[1], `${k[2]} · ${k[7]}`, k[10], k[11]], r);
      d.getRange(r, 2, 1, 12).setFontSize(9).setVerticalAlignment('top')
        .setBorder(false, false, true, false, false, false, COLORS.grid, SpreadsheetApp.BorderStyle.SOLID);
      d.setRowHeight(r, 44);
      r++;
    });
  }
  r += 1;

  // Signals table
  d.getRange(r, 2).setValue('Signals · ' + curLabel).setFontSize(13).setFontWeight('bold');
  r++;
  const spans = [[2, 1], [3, 1], [4, 2], [6, 1], [7, 1], [8, 4], [12, 2]];
  const head = ['Level', 'Area', 'Signal', 'This month', prevM ? prevLabel : 'Previous', 'What it means', 'Try'];
  const writeRow = (values, row) => spans.forEach(([c, w], k) => {
    const cell = d.getRange(row, c, 1, w);
    if (w > 1) cell.merge();
    cell.setNumberFormat('@').setValue(values[k]).setWrap(true);
  });
  writeRow(head, r);
  d.getRange(r, 2, 1, 12).setFontWeight('bold').setFontSize(9).setFontColor(COLORS.ink2)
    .setBorder(false, false, true, false, false, false, COLORS.baseline, SpreadsheetApp.BorderStyle.SOLID);
  r++;
  rows.Signals.filter(s => String(s[0]) === curM).forEach(s => {
    writeRow([s[5], s[1], s[2], s[3], s[4], s[6], s[7]], r);
    const levelKey = Object.keys(LEVEL).find(k => LEVEL[k] === s[5]) || 'Info';
    d.getRange(r, 2).setBackground(COLORS.level[levelKey]).setFontWeight('bold');
    d.getRange(r, 2, 1, 12).setFontSize(9).setVerticalAlignment('top')
      .setBorder(false, false, true, false, false, false, COLORS.grid, SpreadsheetApp.BorderStyle.SOLID);
    d.setRowHeight(r, 44);
    r++;
  });

  // Quiet interests table
  r += 2;
  d.getRange(r, 2).setValue('Quiet interests · ' + curLabel).setFontSize(13).setFontWeight('bold');
  r++;
  d.getRange(r, 2, 1, 12).merge().setNumberFormat('@').setFontSize(9).setFontColor(COLORS.ink2).setWrap(true)
    .setValue(`Accounts you saw at least ${CONFIG.QUIET_MIN_VIEWS} times in the viewing window (about the last week of the export) without liking, searching for or newly following them this month: attention you give but don't show.`);
  r++;
  const quietSpans = [[2, 2], [4, 1], [5, 1], [6, 3], [9, 1], [10, 4]];
  const quietRow = (values, row) => quietSpans.forEach(([c, w], k) => {
    const cell = d.getRange(row, c, 1, w);
    if (w > 1) cell.merge();
    cell.setNumberFormat('@').setValue(values[k]);
  });
  const quiet = rows['Quiet interests'].filter(q => String(q[0]) === curM).slice(0, 8);
  if (quiet.length) {
    quietRow(['Account', 'Times seen', 'You follow', 'Themes', prevM ? 'vs ' + prevLabel : 'vs last month', 'Latest caption'], r);
    d.getRange(r, 2, 1, 12).setFontWeight('bold').setFontSize(9).setFontColor(COLORS.ink2)
      .setBorder(false, false, true, false, false, false, COLORS.baseline, SpreadsheetApp.BorderStyle.SOLID);
    r++;
    quiet.forEach(q => {
      quietRow([q[2], String(q[3]), q[6], q[7], q[8] || '—', q[9]], r);
      d.getRange(r, 2, 1, 12).setFontSize(9).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP)
        .setBorder(false, false, true, false, false, false, COLORS.grid, SpreadsheetApp.BorderStyle.SOLID);
      d.getRange(r, 2).setFontWeight('bold');
      r++;
    });
  } else {
    d.getRange(r, 2).setValue('None this month.').setFontColor(COLORS.muted);
    r++;
  }

  // Chart data lives on a hidden tab; each table gets the next free columns
  const cd = ss.getSheetByName(CHART_DATA) || ss.insertSheet(CHART_DATA);
  cd.getCharts().forEach(c => cd.removeChart(c));
  cd.clear();
  let nextCol = 1;
  const table = (head, data, format) => {
    const col = nextCol;
    nextCol += head.length + 1;
    if (cd.getMaxColumns() < nextCol) cd.insertColumnsAfter(cd.getMaxColumns(), nextCol - cd.getMaxColumns());
    const body = data.length ? data : [[''].concat(head.slice(1).map(() => 0))];
    if (cd.getMaxRows() < body.length + 1) cd.insertRowsAfter(cd.getMaxRows(), body.length + 1 - cd.getMaxRows());
    cd.getRange(1, col, body.length + 1, 1).setNumberFormat('@');
    const range = cd.getRange(1, col, body.length + 1, head.length);
    range.setValues([head].concat(body));
    if (format) cd.getRange(2, col + 1, body.length, head.length - 1).setNumberFormat(format);
    return range;
  };
  const monthly = mo => bucketFromRows_(mo, { Monthly: rows.Monthly }, false).m;
  const withPrev = (label, curVal, prevVal) => (prev ? [label, curVal, prevVal] : [label, curVal]);
  const header = first => (prev ? [first, curLabel, prevLabel] : [first, curLabel]);
  const prevOf = (obj, key) => (prev && obj[key] !== undefined && obj[key] !== '' ? obj[key] : 0);

  const riskRange = table(header('Risk'), ranked.map(k => withPrev(`${k[1]} ${k[2]}`, k[6], prev ? prevOf(prev.risks, k[1]) : 0)), '0');
  const riskTrendRange = table(['Month', 'Risk index'], months.map(mo => [monthName_(mo), monthly(mo)['Risk index']]), '0');
  const windowDays = rows.Daily.filter(x => String(x[0]) === curM && x[8] === 'Yes');
  const dayLabel = x => String(x[1]).slice(5) + ' ' + x[2];
  const minutesRange = table(['Day', 'Est. minutes'], windowDays.map(x => [dayLabel(x), x[6]]), '0');
  const dayItemsRange = table(['Day', 'Items seen', 'Actions'], windowDays.map(x => [dayLabel(x), x[3], x[4]]), '0');
  const themeNames = Object.keys(cur.themes).filter(t => t !== 'Other').sort((a, b) => cur.themes[b].share - cur.themes[a].share);
  const themesRange = table(header('Theme'),
    themeNames.map(t => withPrev(t, cur.themes[t].share, prev && prev.themes[t] ? prev.themes[t].share : 0)), '0%');
  const likedTotal = +cur.m['Liked posts'] || 0;
  const engagementRange = table(['Theme', 'Share of items seen', 'Share of liked posts'],
    themeNames.map(t => [t, cur.themes[t].share, likedTotal ? cur.themes[t].liked / likedTotal : 0]), '0%');
  const hoursRange = table(header('Hour'), cur.hours.map((n, h) => withPrev(pad2_(h) + 'h', n, prev ? prev.hours[h] : 0)), '0');
  const weekdayRange = table(header('Day'), WEEKDAYS.map((day, i) => withPrev(day, cur.weekdays[i], prev ? prev.weekdays[i] : 0)), '0');
  const topRange = table(['Account', 'Times seen'],
    rows.Top.filter(t => String(t[0]) === curM && t[1] === 'Accounts seen').slice(0, 10).map(t => [String(t[3]), t[4]]), '0');
  const quietRange = table(['Account', 'Times seen'],
    rows['Quiet interests'].filter(q => String(q[0]) === curM).slice(0, 10).map(q => [String(q[2]), q[3]]), '0');
  const emotionDims = rows.Profile.filter(p => String(p[0]) === curM && p[1] === 'Emotional tone').map(p => p[2]);
  const profileRange = table(header('Indicator'),
    Object.keys(cur.profile).filter(k => emotionDims.indexOf(k) < 0).map(k => withPrev(k, cur.profile[k], prevOf(prev ? prev.profile : {}, k))), '0');
  const emotionRange = table(header('Emotion'), emotionDims.map(k => withPrev(k, cur.profile[k], prevOf(prev ? prev.profile : {}, k))), '0');
  const mixRange = table(['Month', 'Posts viewed', 'Videos watched', 'Ads viewed'],
    months.map(mo => { const v = monthly(mo); return [monthName_(mo), v['Posts viewed'], v['Videos watched'], v['Ads viewed']]; }), '0');
  const actionsRange = table(['Month', 'Liked posts', 'Liked comments', 'New follows', 'Profile searches', 'Word searches'],
    months.map(mo => { const v = monthly(mo); return [monthName_(mo), v['Liked posts'], v['Liked comments'], v['New follows'], v['Profile searches'], v['Word searches']]; }), '0');
  const trendRange = table(['Month', 'Late-night share', 'Active ratio'],
    months.map(mo => { const v = monthly(mo); return [monthName_(mo), v['Late-night share'], v['Active ratio']]; }), '0.0%');
  const minutesTrendRange = table(['Month', 'Est. minutes per active day'], months.map(mo => [monthName_(mo), monthly(mo)['Est. minutes per active day']]), '0.0');
  cd.hideSheet();

  // Charts, two per row
  r += 2;
  d.getRange(r, 2).setValue('Charts').setFontSize(13).setFontWeight('bold');
  r++;
  const BAR = Charts.ChartType.BAR;
  const COLUMN = Charts.ChartType.COLUMN;
  const LINE = Charts.ChartType.LINE;
  const trend = months.length > 1;
  const charts = [
    [BAR, riskRange, 'Risk scores · likelihood × impact (max 25)', { max: 25 }],
    trend ? [LINE, riskTrendRange, 'Risk index by month (0–100)', { max: 100 }] : null,
    [COLUMN, minutesRange, 'Estimated minutes per day · viewing window', {}],
    [COLUMN, dayItemsRange, 'Items seen and actions per day · viewing window', { stacked: true, colors: COLORS.series.slice(0, 2) }],
    [BAR, themesRange, 'What you watched · share of items by theme', { format: '#%' }],
    [BAR, engagementRange, 'Seen vs liked · share by theme', { format: '#%', colors: COLORS.series.slice(0, 2) }],
    [COLUMN, hoursRange, `Activity by hour (${CONFIG.LOCAL_TIMEZONE})`, {}],
    [COLUMN, weekdayRange, 'Activity by weekday', {}],
    [BAR, topRange, 'Most-seen accounts', {}],
    [BAR, quietRange, 'Quiet interests · times seen with no like, search or follow', {}],
    [BAR, profileRange, 'Behavioural indicators · 0–100 proxies', { max: 100 }],
    [BAR, emotionRange, 'Emotional tone of captions · items per 100', {}],
    [COLUMN, mixRange, 'Content mix by month', { stacked: true, colors: COLORS.series.slice(0, 3) }],
    [COLUMN, actionsRange, 'Your actions by month', { stacked: true, colors: COLORS.series.slice(0, 5) }],
    trend ? [LINE, trendRange, 'Late-night share and active ratio by month', { format: '#.#%', colors: COLORS.series.slice(0, 2) }] : null,
    trend ? [LINE, minutesTrendRange, 'Estimated minutes per active day by month', {}] : null,
  ];
  const rowStep = 17;
  charts.forEach((c, k) => {
    const pos = [r + Math.floor(k / 2) * rowStep, k % 2 === 0 ? 2 : 8];
    if (c) chart_(d, c[0], c[1], pos, c[2], Object.assign({ height: 330 }, c[3]));
    else d.getRange(pos[0] + 1, pos[1]).setValue('This trend appears once a second month is processed.').setFontColor(COLORS.muted);
  });
  r += Math.ceil(charts.length / 2) * rowStep + 1;

  // Heatmap: theme share by month
  d.getRange(r, 2).setValue('Theme share by month').setFontSize(13).setFontWeight('bold');
  r++;
  const shown = months.slice(-10);
  const heatHead = ['Theme', ''].concat(shown.map(monthName_));
  d.getRange(r, 2, 1, heatHead.length).setNumberFormat('@').setValues([heatHead])
    .setFontWeight('bold').setFontSize(9).setFontColor(COLORS.ink2);
  d.getRange(r, 2, 1, 2).merge();
  const heatRanges = [];
  const allThemes = unique_(rows.Themes.map(t => String(t[1])));
  const heat = allThemes.map(t => [t, ''].concat(shown.map(mo => {
    const row = rows.Themes.find(x => String(x[0]) === mo && String(x[1]) === t);
    return row ? row[3] : '';
  })));
  if (heat.length) {
    d.getRange(r + 1, 2, heat.length, heatHead.length).setValues(heat).setFontSize(9);
    heat.forEach((_, i) => d.getRange(r + 1 + i, 2, 1, 2).merge());
    const values = d.getRange(r + 1, 4, heat.length, shown.length).setNumberFormat('0%').setHorizontalAlignment('center');
    heatRanges.push(values);
  }
  r += heat.length + 2;

  // Heatmap: hour × weekday in the viewing window
  d.getRange(r, 2).setValue('When you scroll · hour × weekday (viewing window)').setFontSize(13).setFontWeight('bold');
  r++;
  d.getRange(r, 2, 1, 8).setNumberFormat('@').setValues([['Hour'].concat(WEEKDAYS)])
    .setFontWeight('bold').setFontSize(9).setFontColor(COLORS.ink2).setHorizontalAlignment('center');
  const hourly = rows.Hourly.filter(x => String(x[0]) === curM);
  const cell = (w, h) => {
    const x = hourly.find(y => +y[1] === w && +y[3] === h);
    return x ? +x[4] : 0;
  };
  d.getRange(r + 1, 2, 24, 1).setNumberFormat('@');
  d.getRange(r + 1, 2, 24, 8)
    .setValues(Array.from({ length: 24 }, (_, h) => [pad2_(h) + 'h'].concat(WEEKDAYS.map((_, w) => cell(w + 1, h)))))
    .setFontSize(8).setHorizontalAlignment('center');
  heatRanges.push(d.getRange(r + 1, 3, 24, 7));
  for (let h = 0; h < 24; h++) d.setRowHeight(r + 1 + h, 18);
  r += 26;
  d.setConditionalFormatRules(heatRanges.map(range => SpreadsheetApp.newConditionalFormatRule()
    .setGradientMinpointWithValue(COLORS.surface, SpreadsheetApp.InterpolationType.NUMBER, '0')
    .setGradientMaxpoint(COLORS.heatHigh)
    .setRanges([range]).build()));
  d.getRange(r, 2, 1, 12).merge().setWrap(true).setFontSize(9).setFontColor(COLORS.muted)
    .setValue('Indicators are rule-based proxies computed from what Instagram logged, not a psychological assessment. '
      + 'Edit themes and word lists in Settings, then run Reprocess everything. For a written profile, copy this month’s text from the Prompt tab into Claude.');
  d.setRowHeight(r, 36);
}

function chart_(sheet, type, range, pos, title, opts) {
  const seriesCount = range.getNumColumns() - 1;
  const horizontal = type === Charts.ChartType.BAR;
  const valueAxis = {
    minValue: 0,
    format: opts.format || '#',
    gridlines: { color: COLORS.grid, count: 5 },
    baselineColor: COLORS.baseline,
    textStyle: { color: COLORS.muted, fontSize: 9 },
  };
  if (opts.max) valueAxis.maxValue = opts.max;
  const labelAxis = { textStyle: { color: COLORS.ink2, fontSize: 9 }, gridlines: { color: 'transparent' } };
  const builder = sheet.newChart()
    .setChartType(type)
    .addRange(range)
    .setNumHeaders(1)
    .setPosition(pos[0], pos[1], 0, 0)
    .setOption('title', title)
    .setOption('titleTextStyle', { color: COLORS.ink, fontSize: 12, bold: true })
    .setOption('width', 620)
    .setOption('height', opts.height || 320)
    .setOption('backgroundColor', COLORS.surface)
    .setOption('fontName', 'Arial')
    .setOption('legend', { position: seriesCount > 1 ? 'top' : 'none', textStyle: { color: COLORS.ink2, fontSize: 9 } })
    .setOption('colors', opts.colors || (seriesCount > 1 ? [COLORS.series[0], COLORS.previous] : [COLORS.series[0]]))
    .setOption('hAxis', horizontal ? valueAxis : labelAxis)
    .setOption('vAxis', horizontal ? labelAxis : valueAxis);
  if (type === Charts.ChartType.LINE) builder.setOption('lineWidth', 2).setOption('pointSize', 8);
  else builder.setOption('bar', { groupWidth: '70%' });
  if (opts.stacked) builder.setOption('isStacked', true);
  sheet.insertChart(builder.build());
}

function deltaText_(cur, prev, kind, prevLabel) {
  if (prev === null || prev === '' || prev === undefined) return 'first month';
  const diff = cur - prev;
  const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '＝';
  if (kind === 'pts') return `${arrow} ${Math.abs(diff * 100).toFixed(1)} pts vs ${prevLabel}`;
  if (kind === 'abs') return `${arrow} ${Math.abs(diff).toFixed(2)} vs ${prevLabel}`;
  if (kind === 'int') return `${arrow} ${Math.abs(Math.round(diff))} vs ${prevLabel}`;
  if (!prev) return `${arrow} vs ${prevLabel}`;
  return `${arrow} ${Math.abs(Math.round(100 * diff / prev))}% vs ${prevLabel}`;
}

function columnLetter_(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
