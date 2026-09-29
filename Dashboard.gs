// ── Dashboard web app ────────────────────────────────────────────────────────
//
// Serves the live, Drive-connected dashboard (see webapp/). Runs in the same Apps Script project as Code.gs,
// so it freely reuses HEADERS, readRows_, networkViewData_, getExportsFolder_, CONFIG and processNewExports
// unchanged. Nothing here writes to the sheet; it only reads what processNewExports() already keeps current.

/**
 * Formats the two Date-typed columns (Month date, Day) as plain yyyy-MM-dd strings, in CONFIG.LOCAL_TIMEZONE,
 * so the client never has to guess how the google.script.run bridge marshals a Date. Every other column is
 * already plain text or a number (per TEXT_COLUMNS/NUMBER_FORMATS) and passes through unchanged.
 */
/** The deployed web app's URL, or '' when there is no deployment. Never throws. */
function webAppUrl_() {
  try {
    return ScriptApp.getService().getUrl() || '';
  } catch (e) {
    return '';
  }
}

function serializeCell_(v) {
  return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)
    ? Utilities.formatDate(v, CONFIG.LOCAL_TIMEZONE, 'yyyy-MM-dd')
    : v;
}

/**
 * A tab's data rows as plain objects keyed by its headers — the same row-to-object conversion
 * networkViewData_() already does for the Network tab, generalized to any tab in HEADERS.
 *
 * A tab that does not exist yet reads as no rows, rather than being created on the spot. readRows_ goes
 * through ensureSheet_, which creates what it cannot find — so before this guard, merely opening the
 * dashboard built any tab a release had added, racing the processing run that was creating the same ones.
 * It also quietly broke the promise at the top of this file that nothing here writes to the sheet.
 */
function sheetRows_(name) {
  const headers = HEADERS[name];
  if (!SpreadsheetApp.getActive().getSheetByName(name)) return [];
  return readRows_(name).map(row => {
    const out = {};
    headers.forEach((h, i) => { out[h] = serializeCell_(row[i]); });
    return out;
  });
}

/**
 * Everything the dashboard needs for one load, called via google.script.run from webapp/app.js. Every tab
 * comes back with all months at once — at most a few hundred rows per tab across a handful of months — and
 * the client filters by month itself, exactly as it already did when reading a locally-dropped file.
 */
function getDashboardPayload() {
  return {
    months: sheetRows_('Monthly'),
    // Weekly buckets, for the view that matches how the data actually arrives. Every monthly child tab has a
    // twin here, so Weekly mode shows the same sections Monthly does rather than hiding five of them.
    weeks: sheetRows_('Weekly'),
    weeklyThemes: sheetRows_('Weekly themes'),
    weeklySubthemes: sheetRows_('Weekly subthemes'),
    weeklyTop: sheetRows_('Weekly top'),
    weeklyRisks: sheetRows_('Weekly risks'),
    weeklySignals: sheetRows_('Weekly signals'),
    weeklyProfile: sheetRows_('Weekly profile'),
    weeklyQuiet: sheetRows_('Weekly quiet'),
    weeklyHourly: sheetRows_('Weekly hourly'),
    weeklyBelonging: sheetRows_('Weekly belonging'),
    weeklyConversations: sheetRows_('Weekly conversations'),
    conversations: sheetRows_('Conversations'),
    // Per 90-day insights window rather than per bucket: the dashboard draws it on its own time axis.
    performance: sheetRows_('Performance'),
    risks: sheetRows_('Risks'),
    daily: sheetRows_('Daily'),
    hourly: sheetRows_('Hourly'),
    themes: sheetRows_('Themes'),
    subthemes: sheetRows_('Subthemes'),
    top: sheetRows_('Top'),
    quiet: sheetRows_('Quiet interests'),
    belonging: sheetRows_('Belonging'),
    profile: sheetRows_('Profile'),
    signals: sheetRows_('Signals'),
    log: sheetRows_('Log'),
    network: networkViewData_(),
    sheetUrl: SpreadsheetApp.getActive().getUrl(),
    exportsFolderUrl: getExportsFolder_().getUrl(),
    // The page is served inside a sandboxed iframe on its own domain, so a plain relative link like
    // "?view=network" would resolve against that iframe's own URL, not the web app's real one. Handing
    // the client this absolute URL is what makes the network-view link actually work.
    // Null whenever the script has no web-app deployment — which, now that the dashboard opens in a dialog,
    // is the normal state rather than an error. The client hides the links that need a real URL.
    webAppUrl: webAppUrl_(),
    generatedAt: Utilities.formatDate(new Date(), CONFIG.LOCAL_TIMEZONE, 'yyyy-MM-dd HH:mm'),
  };
}

/**
 * The dashboard inside the Sheet, as a modal dialog — the same page a web-app deployment would serve, but
 * with nothing to deploy. This exists because "Deploy → New deployment → Web app → Execute as → Who has
 * access" was the single hardest step of the setup, and it is not a step that earns its difficulty: the
 * dialog runs as the person who opened it, reads the same Sheet, and talks to the same getDashboardPayload
 * over google.script.run. A deployment is still worth doing if you want the dashboard on its own URL, on a
 * phone, or without opening the spreadsheet first — so it stays documented as optional, not as step one.
 */
function openDashboard() {
  // Apps Script clamps a dialog to the browser window, so asking for more than fits is how you get "as big
  // as this window allows" rather than a fixed, too-small box.
  const page = HtmlService.createHtmlOutputFromFile('Index').setWidth(1600).setHeight(1000);
  SpreadsheetApp.getUi().showModalDialog(page, 'Instagram Insights');
}

/** The dashboard's "Refresh now" button: runs the same check the daily trigger runs, and reports what it found. */
function checkForNewExports() {
  return processNewExports();
}
