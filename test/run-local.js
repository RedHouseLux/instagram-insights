// Runs Code.gs end to end on local Instagram export folders, with in-memory stand-ins for
// Drive, Sheets and Utilities. Usage: node test/run-local.js <folder containing exports>
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const exportsRoot = process.argv[2];
if (!exportsRoot) {
  console.error('usage: node test/run-local.js <folder containing Instagram exports>');
  process.exit(1);
}

// ── Utilities.formatDate (Java SimpleDateFormat subset used by Code.gs) ─────
function formatDate(date, tz, pattern) {
  const parts = {};
  new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
  }).formatToParts(date).forEach(p => { parts[p.type] = p.value; });
  const dow = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[parts.weekday];
  return pattern.replace(/'([^']*)'|yyyy|MM|dd|HH|mm|ss|u/g, (tok, lit) => {
    if (lit !== undefined) return lit;
    return { yyyy: parts.year, MM: parts.month, dd: parts.day, HH: parts.hour, mm: parts.minute, ss: parts.second, u: String(dow) }[tok];
  });
}

// ── Chainable stub: any unknown method returns the same object ──────────────
function chain(extra = {}) {
  const p = new Proxy(extra, {
    get: (target, prop) => (prop in target ? target[prop] : () => p),
  });
  return p;
}

// ── In-memory spreadsheet ───────────────────────────────────────────────────
function a1(ref) {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  const col = m[1].split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  return [+m[2], col];
}
function makeSheet(name) {
  const sheet = { name, cells: new Map(), maxRows: 1000, maxCols: 26, charts: [], hidden: false, rules: [] };
  const key = (r, c) => r + ':' + c;
  const range = (row, col, nr = 1, nc = 1) => {
    if (typeof row === 'string') [row, col] = a1(row);
    if (row < 1 || col < 1 || row + nr - 1 > sheet.maxRows || col + nc - 1 > sheet.maxCols) {
      throw new Error(`Range outside sheet ${name}: ${row},${col} ${nr}x${nc} (max ${sheet.maxRows}x${sheet.maxCols})`);
    }
    const r = chain({
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => {
        const v = sheet.cells.get(key(row + i, col + j));
        return v === undefined ? '' : v;
      })),
      setValues: vals => {
        assert.strictEqual(vals.length, nr, `setValues rows on ${name}`);
        vals.forEach((rowVals, i) => {
          assert.strictEqual(rowVals.length, nc, `setValues cols on ${name}`);
          rowVals.forEach((v, j) => sheet.cells.set(key(row + i, col + j), v));
        });
        return r;
      },
      setValue: v => { sheet.cells.set(key(row, col), v); return r; },
      setFormula: f => { sheet.cells.set(key(row, col), f); return r; },
      clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) sheet.cells.delete(key(row + i, col + j)); return r; },
      getNumColumns: () => nc,
      getNumRows: () => nr,
    });
    return r;
  };
  const api = chain({
    getName: () => name,
    getSheetId: () => sheets.indexOf(api) + 1000,
    getRange: range,
    getLastRow: () => { let last = 0; sheet.cells.forEach((v, k) => { if (v !== '') last = Math.max(last, +k.split(':')[0]); }); return last; },
    getMaxRows: () => sheet.maxRows,
    getMaxColumns: () => sheet.maxCols,
    insertRowsAfter: (_, n) => { sheet.maxRows += n; return api; },
    insertColumnsAfter: (_, n) => { sheet.maxCols += n; return api; },
    clear: () => { sheet.cells.clear(); return api; },
    getCharts: () => sheet.charts.slice(),
    removeChart: c => { sheet.charts.splice(sheet.charts.indexOf(c), 1); },
    newChart: () => {
      const spec = { options: {}, ranges: [] };
      const b = chain({
        setOption: (k, v) => { spec.options[k] = v; return b; },
        addRange: rg => { spec.ranges.push(rg); return b; },
        setChartType: t => { spec.type = t; return b; },
        build: () => spec,
      });
      return b;
    },
    insertChart: spec => { sheet.charts.push(spec); },
    hideSheet: () => { sheet.hidden = true; return api; },
    setConditionalFormatRules: rules => { sheet.rules = rules; return api; },
    _sheet: sheet,
  });
  return api;
}
const sheets = [];
const spreadsheet = chain({
  getSheetByName: n => sheets.find(s => s.getName() === n) || null,
  insertSheet: (n, idx) => { const s = makeSheet(n); if (idx === 0) sheets.unshift(s); else sheets.push(s); return s; },
  getSheets: () => sheets.slice(),
  deleteSheet: s => sheets.splice(sheets.indexOf(s), 1),
});

// ── Drive over the local filesystem ─────────────────────────────────────────
function fileMock(p) {
  return {
    getId: () => 'file:' + p,
    getName: () => path.basename(p),
    getMimeType: () => (p.endsWith('.zip') ? 'application/zip' : 'text/html'),
    getBlob: () => ({ path: p, getDataAsString: () => fs.readFileSync(p, 'utf8'), setContentType() { return this; } }),
  };
}
function iterator(list) {
  let i = 0;
  return { hasNext: () => i < list.length, next: () => list[i++] };
}
function folderMock(dir) {
  const entries = () => fs.readdirSync(dir).filter(n => !n.startsWith('.')).map(n => path.join(dir, n));
  return {
    getId: () => 'folder:' + dir,
    getName: () => path.basename(dir),
    getUrl: () => 'file://' + dir,
    getFiles: () => iterator(entries().filter(p => fs.statSync(p).isFile()).map(fileMock)),
    getFolders: () => iterator(entries().filter(p => fs.statSync(p).isDirectory()).map(folderMock)),
    getFilesByName: n => iterator(entries().filter(p => path.basename(p) === n).map(fileMock)),
  };
}

// What the sweep sees at the top of "My Drive". Filled in by the stray-export test at the end.
let driveRoot = { folders: [], files: [] };

const properties = new Map();
const scriptProperties = {
  getProperty: k => (properties.has(k) ? properties.get(k) : null),
  setProperty: (k, v) => { properties.set(k, String(v)); },
  deleteProperty: k => { properties.delete(k); },
};

const context = vm.createContext({
  console,
  Utilities: {
    formatDate,
    // Same shape as Apps Script: one blob per entry, named with its path inside the zip.
    unzip: blob => require('child_process').execFileSync('unzip', ['-Z1', blob.path], { encoding: 'utf8' })
      .split('\n').filter(n => n && !n.endsWith('/'))
      .map(name => ({
        getName: () => name,
        getDataAsString: () => require('child_process').execFileSync('unzip', ['-p', blob.path, name], { encoding: 'utf8', maxBuffer: 64 << 20 }),
      })),
  },
  SpreadsheetApp: {
    getActive: () => spreadsheet,
    getUi: () => { throw new Error('no UI'); },
    newConditionalFormatRule: () => chain(),
    InterpolationType: { NUMBER: 'NUMBER', MAX: 'MAX' },
    BorderStyle: { SOLID: 'SOLID' },
    WrapStrategy: { CLIP: 'CLIP' },
  },
  Charts: { ChartType: { BAR: 'BAR', COLUMN: 'COLUMN', LINE: 'LINE' } },
  HtmlService: { createHtmlOutput: () => chain(), createTemplateFromFile: () => chain() },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  PropertiesService: { getScriptProperties: () => scriptProperties },
  DriveApp: {
    getFolderById: () => folderMock(exportsRoot),
    getFoldersByName: () => iterator([folderMock(exportsRoot)]),
    // The top of "My Drive", where Meta drops its deliveries. Empty for every check except the sweep test
    // below, which fills it in to exercise sweepStrayExports_ directly.
    getRootFolder: () => ({
      getId: () => 'root', getName: () => 'My Drive',
      getFolders: () => iterator(driveRoot.folders),
      getFiles: () => iterator(driveRoot.files),
    }),
  },
  ScriptApp: {
    getProjectTriggers: () => [], newTrigger: () => chain(),
    getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec' }),
  },
});
// Real Apps Script concatenates every .gs file in the project into one global scope; do the same here.
const code = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8')
  + '\n' + fs.readFileSync(path.join(__dirname, '..', 'Dashboard.gs'), 'utf8');
vm.runInContext(code + '\n;globalThis.__t = { CONFIG, HEADERS, META_DELIVERY_NAME, WANTED_EXPORT_FILES, WEEKLY_CHILD_TABS };', context, { filename: 'Code.gs' });

// ── Run ──────────────────────────────────────────────────────────────────────
context.setup();
context.processNewExports();

const read = name => {
  const s = spreadsheet.getSheetByName(name);
  const hdr = context.__t.HEADERS[name];
  return s.getRange(2, 1, Math.max(1, s.getLastRow() - 1), hdr.length).getValues()
    .filter(r => r[0] !== '')
    .map(r => Object.fromEntries(hdr.map((h, i) => [h, r[i]])));
};

console.log('\n== Log');
read('Log').forEach(r => console.log(`${r.Month}  ${r.Period}  ${r.Result}`));

console.log('\n== Monthly');
read('Monthly').forEach(m => console.log(JSON.stringify(m)));

for (const month of read('Monthly').map(m => m.Month)) {
  console.log(`\n== ${month} Themes`);
  read('Themes').filter(t => t.Month === month).sort((a, b) => b.Seen - a.Seen)
    .forEach(t => console.log(`  ${t.Theme.padEnd(28)} ${String(t.Seen).padStart(4)}  ${(100 * t['Seen share']).toFixed(1).padStart(5)}%  liked ${t.Liked}`));
  const mrow = read('Monthly').find(x => x.Month === month);
  console.log(`== ${month} Risks (index ${mrow['Risk index']}, ~${mrow['Est. minutes per active day']} min/active day, ${mrow['Sessions per active day']} sessions, top-5 share ${(100 * mrow['Top-5 accounts share']).toFixed(1)}%)`);
  read('Risks').filter(k => k.Month === month).forEach(k => console.log(`  ${k.Code.padEnd(4)} ${k.Risk.padEnd(24)} ${k.Likelihood}×${k.Impact}=${String(k.Score).padStart(2)} ${k.Rating.padEnd(11)} ${String(k.Trend).padEnd(5)} | ${k.Evidence.slice(0, 80)}`));
  const daily = read('Daily').filter(x => x.Month === month);
  console.log(`== ${month} Daily: ${daily.length} days, minutes ` + daily.map(x => x['Est. minutes']).join(' '));
  console.log(`== ${month} Hourly rows: ${read('Hourly').filter(x => x.Month === month).length}`);
  console.log(`== ${month} Signals`);
  read('Signals').filter(s => s.Month === month).forEach(s => console.log(`  ${s.Level.padEnd(9)} ${s.Signal.padEnd(36)} ${String(s.Value).padStart(7)} prev ${String(s.Previous).padStart(7)} | ${s['What it means'].slice(0, 90)}`));
  console.log(`== ${month} Profile`);
  read('Profile').filter(p => p.Month === month).forEach(p => console.log(`  ${p.Dimension.padEnd(46)} ${String(p.Score).padStart(3)}  prev ${p.Previous}`));
  console.log(`== ${month} Hours`);
  console.log('  ' + read('Rhythm').filter(r => r.Month === month && r.Kind === 'Hour').map(r => `${r.Label}:${r.Count}`).join(' '));
  console.log(`== ${month} Quiet interests`);
  read('Quiet interests').filter(q => q.Month === month).slice(0, 12).forEach(q => console.log(`  ${q.Account.padEnd(24)} seen ${String(q['Times seen']).padStart(2)} (posts ${q.Posts}, videos ${q.Videos})  follow ${q['You follow'].padEnd(3)} ${String(q['Vs previous']).padEnd(10)} [${q.Themes}]`));
  console.log(`== ${month} Top accounts`);
  console.log('  ' + read('Top').filter(t => t.Month === month && t.List === 'Accounts seen').slice(0, 10).map(t => `${t.Name}(${t.Count})`).join(', '));
  const actions = read('Actions').filter(a => a.Month === month);
  console.log(`== ${month} Actions: ${actions.length}`);
  actions.slice(0, 6).forEach(a => console.log(`  ${a.Date} ${a.Time} ${a.Type.padEnd(16)} ${a['Account / term']}  ${a.Detail.slice(0, 60)}`));
  const meta = read('Meta').filter(x => x.Month === month);
  const byStatus = meta.reduce((acc, x) => { const k = x.Type + ' / ' + (x.Status || 'first month'); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  console.log(`== ${month} Meta`, byStatus);
  console.log(`== ${month} New labels: ` + meta.filter(x => x.Type === 'Ad category' && x.Status === 'New').map(x => x.Value).join('; '));
  const prompt = read('Prompt').find(p => p.Month === month);
  console.log(`== ${month} Prompt: ${prompt.Text.length} chars\n` + prompt.Text.split('\n').slice(0, 12).join('\n'));
}

const dash = spreadsheet.getSheetByName('Dashboard')._sheet;
console.log('\n== Dashboard: charts ' + dash.charts.length + ': ' + dash.charts.map(c => c.options.title).join(' | '));
const kpis = [5, 6].map(r => [2, 4, 6, 8, 10, 12].map(c => dash.cells.get(r + ':' + c)));
console.log('KPI values:', kpis[0], '\nKPI deltas:', kpis[1]);
console.log('Sparkline:', dash.cells.get('7:2'));
console.log('Sheet order:', spreadsheet.getSheets().map(s => s.getName()).join(', '));

// ── Checks against counts taken straight from the HTML ──────────────────────
const exportDirs = fs.readdirSync(exportsRoot).map(n => path.join(exportsRoot, n)).filter(p => fs.existsSync(path.join(p, 'start_here.html')));
const stampRe = />\s*([A-Z][a-z]{2} \d{1,2}, \d{4} \d{1,2}:\d{2}[\s\u202f]*[ap]m)\s*</g;
const stampCount = file => (fs.existsSync(file) ? (fs.readFileSync(file, 'utf8').match(stampRe) || []).length : 0);
// Meta sometimes logs the same post twice in the same minute; those count once.
const uniqueEntries = file => {
  if (!fs.existsSync(file)) return 0;
  const parts = fs.readFileSync(file, 'utf8').split(stampRe);
  const keys = new Set();
  for (let i = 0; i + 1 < parts.length; i += 2) keys.add(((parts[i].match(/href="(https:\/\/www\.instagram\.com\/[^"]+)"/) || [])[1] || '') + '|' + parts[i + 1]);
  return keys.size;
};
const monthly = read('Monthly');
// The two real fixture exports turn out to be exactly back-to-back - one's Period end is the other's Period
// start, to the same minute (Jul 7 -> Aug 6, then Aug 6 -> Sep 5) - so this is a real-data instance of the
// same merge multi-granularity export merging exercises above, not a contrived one: neither export lands in
// exactly one calendar month. Combined, they fully cover August (the older export's Aug 1-5 plus the newer
// export's Aug 6-31) while July and September each get only the sliver either export contributes on its own.
// A test that expects one export to match one month's row 1:1 (the old assumption here) no longer holds - what
// should hold is that nothing is lost or double-counted: every item lands in exactly one of the three months.
const rawByDir = {};
exportDirs.forEach(dir => {
  const f = rel => path.join(dir, rel);
  const header = fs.readFileSync(path.join(dir, 'start_here.html'), 'utf8').match(/<time datetime="([^"]+)"/g);
  rawByDir[dir] = {
    postsViewed: uniqueEntries(f('ads_information/ads_and_topics/posts_viewed.html')),
    videosWatched: uniqueEntries(f('ads_information/ads_and_topics/videos_watched.html')),
    adsViewed: uniqueEntries(f('ads_information/ads_and_topics/ads_viewed.html')),
    likedPosts: uniqueEntries(f('your_instagram_activity/likes/liked_posts.html')),
    following: stampCount(f('connections/followers_and_following/following.html')),
    periodEnd: formatDate(new Date(header[2].slice(16, -1)), 'Europe/Rome', 'yyyy-MM-dd'),
  };
});
[['Posts viewed', 'postsViewed'], ['Videos watched', 'videosWatched'], ['Ads viewed', 'adsViewed'], ['Liked posts', 'likedPosts']]
  .forEach(([col, key]) => {
    const total = monthly.filter(m => m.Month >= '2026-07' && m.Month <= '2026-09').reduce((n, m) => n + (+m[col] || 0), 0);
    const expected = Object.values(rawByDir).reduce((n, r) => n + r[key], 0);
    assert.strictEqual(total, expected, `${col}: July+Aug+Sep sums to the two raw exports combined - the day-level split loses or double-counts nothing`);
  });
// 'Following total' is a snapshot (see SNAPSHOT_FIELDS), never summed - each month shows whichever
// contributing export is newest by periodEnd: the older export alone for July, the newer one for both August
// (where it outranks the older export) and September (where it's the only contributor).
const [olderDir, newerDir] = Object.keys(rawByDir).sort((a, b) => rawByDir[a].periodEnd.localeCompare(rawByDir[b].periodEnd));
const byMonth = m => monthly.find(x => x.Month === m);
assert.strictEqual(byMonth('2026-07')['Following total'], rawByDir[olderDir].following, 'July (older export only) shows its following count');
assert.strictEqual(byMonth('2026-08')['Following total'], rawByDir[newerDir].following, 'August (both, newer wins) shows the newer export\'s following count');
assert.strictEqual(byMonth('2026-09')['Following total'], rawByDir[newerDir].following, 'September (newer export only) shows the same following count');
console.log('checks passed for the two real exports merging into July/Aug/Sep: '
  + ['2026-07', '2026-08', '2026-09'].map(m => `${m} coverage ${(100 * byMonth(m).Coverage).toFixed(0)}%`).join(', '));

// ── Looker Studio: date columns are real dates, and the link connects every tab ─────
// Dates made inside the sandbox fail `instanceof Date` out here, so check their type tag instead.
const isDate = d => Object.prototype.toString.call(d) === '[object Date]' && !isNaN(d);
assert(read('Monthly').every(m => isDate(m['Month date'])), 'Monthly month date is a Date');
assert(read('Daily').every(x => isDate(x.Day) && isDate(x['Month date'])), 'Daily date columns are Dates');
assert(read('Actions').every(x => isDate(x['Month date'])), 'Actions month date is a Date');
console.log('date columns: ' + read('Monthly').map(m => m.Month + ' → ' + m['Month date'].toISOString()).join(', '));
spreadsheet.getId = () => 'SPREADSHEET_ID';
const url = context.createLookerStudioReport();
assert.strictEqual((url.match(/connector=googleSheets/g) || []).length, 9, 'nine data sources in the link');
assert(/ds\.ds8\.worksheetId=\d+/.test(url), 'worksheet ids in the link');
assert(!/c\.reportId|refreshFields/.test(url), 'no template parameters without a template id');
context.__t.CONFIG.LOOKER_TEMPLATE_REPORT_ID = 'TEMPLATE_ID';
const templateUrl = context.createLookerStudioReport();
context.__t.CONFIG.LOOKER_TEMPLATE_REPORT_ID = '';
assert(templateUrl.includes('c.reportId=TEMPLATE_ID'), 'template report id in the link');
assert.strictEqual((templateUrl.match(/ds\.ds\d\.refreshFields=false/g) || []).length, 9, 'template fields kept for all nine sources');
console.log('looker check passed: ' + url.slice(0, 160) + '…');

// ── Text that looks like a formula stays text on every rewrite ──────────────
const cells = [...spreadsheet.getSheetByName('Actions')._sheet.cells.values()];
assert(!cells.some(v => typeof v === 'string' && /^[=+\-]/.test(v)), 'formula-like text written without protection');
console.log('formula-safety check passed');

// ── Re-running must not duplicate anything ──────────────────────────────────
const counts = () => ['Monthly', 'Signals', 'Profile', 'Themes', 'Rhythm', 'Top', 'Quiet interests', 'Actions', 'Accounts', 'Network', 'Meta', 'Prompt', 'Log'].map(n => read(n).length).join(',');
const before = counts();
context.processNewExports();
context.reprocessAll();
assert.strictEqual(counts(), before, 'row counts after re-running');
console.log('re-run check passed: ' + before);

// ── Network: accounts add up, statuses follow the lists, and a full followers list creates mutuals ─────
const statusCount = () => read('Network').reduce((o, r) => Object.assign(o, { [r.Status]: (o[r.Status] || 0) + 1 }), {});
const latest = read('Monthly').slice(-1)[0];
read('Monthly').forEach(m => {
  const seenSum = read('Accounts').filter(a => a.Month === m.Month).reduce((n, a) => n + a.Seen, 0);
  assert(seenSum <= m['Items seen'] && seenSum >= m['Items seen'] * 0.95, `Accounts seen adds up for ${m.Month}: ${seenSum} of ${m['Items seen']}`);
});
const network = read('Network');
assert.strictEqual(new Set(network.map(r => r.Account.toLowerCase())).size, network.length, 'one Network row per account');
assert(network.every(r => context.networkViewData_().statuses.includes(r.Status)), 'every Network status is known');
assert.strictEqual(network.filter(r => ['You follow', 'Mutual'].includes(r.Relation)).length, latest['Following total'], 'current follows match the following list');
assert.strictEqual(context.networkViewData_().nodes.length, network.length, 'network view gets every row');
console.log('network check passed:', JSON.stringify(statusCount()));

// A synthetic "All time" export: a full followers list, close friends, and one account no longer followed.
const followingNow = network.filter(r => r.Relation === 'You follow').map(r => r.Account);
const allFollows = network.filter(r => ['You follow', 'Mutual'].includes(r.Relation)).map(r => r.Account);
const entry = (name, when) => `<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder"><div class="_a6-p"><div><div><a target="_blank" href="https://www.instagram.com/${name}">${name}</a></div><div>${when}</div></div></div></div>`;
const page = entries => `<html><body><main class="_a706" role="main">${entries.join('')}</main></body></html>`;
const gone = followingNow[followingNow.length - 1];
const allTimeFiles = {
  'start_here.html': ['<aside>Generated by tester on <time datetime="2026-09-12T08:00Z">Saturday, September 12, 2026 at 1:00 AM UTC</time></aside><main></main>'],
  'following.html': [page(allFollows.filter(a => a !== gone).map(a => entry(a, 'Mar 03, 2021 9:15 pm')))],
  'followers.html': [page(followingNow.slice(0, 150).map(a => entry(a, 'Mar 03, 2021 9:15 pm')).concat([1, 2, 3].map(i => entry('fan_test_' + i, 'Jan 10, 2024 8:00 am'))))],
  'close_friends.html': [page(followingNow.slice(0, 2).map(a => entry(a, 'Feb 02, 2022 10:00 am')))],
};
const allTime = context.parseExport_(allTimeFiles);
assert(allTime.allTime && !context.hasDatedActivity_(allTime), 'an export without a date range is read as All time, not as a month');
context.updateNetwork_([allTime]);
const after = statusCount();
const rel = name => read('Network').find(r => r.Account === name);
assert.strictEqual(read('Network').filter(r => r.Relation === 'Mutual').length, 150, 'mutuals from the full followers list');
assert.strictEqual(after['Close friend'], 2, 'close friends');
assert.strictEqual(after.Fan, 3, 'fans');
assert.strictEqual(rel(gone).Relation, 'Unfollowed', 'an account missing from the newest following list is unfollowed');
assert(context.networkViewData_().followersComplete, 'the view knows the followers list is complete');
console.log('all-time network check passed:', JSON.stringify(after));

// ── Dashboard payload: the web app's google.script.run entry points ─────────────────────────────────────
const payload = context.getDashboardPayload();
assert.strictEqual(payload.months.length, monthly.length, 'payload months count matches Monthly tab');
assert.strictEqual(payload.risks.filter(r => r.Month === latest.Month).length, 11, 'eleven risks for the latest month');
const payloadLatest = payload.months.find(m => m.Month === latest.Month);
assert.strictEqual(payloadLatest['Risk index'], latest['Risk index'], 'payload Monthly fields match the sheet');
assert.strictEqual(typeof payloadLatest['Month date'], 'string', 'Month date leaves the payload as a string');
assert(/^\d{4}-\d{2}-\d{2}$/.test(payloadLatest['Month date']), 'Month date is plain yyyy-MM-dd, not a Date object');
const payloadDay = payload.daily.find(d => d.Day !== '');
assert(payloadDay && /^\d{4}-\d{2}-\d{2}$/.test(payloadDay.Day), 'Daily.Day is plain yyyy-MM-dd, not a Date object');
assert.strictEqual(payload.network.nodes.length, read('Network').length, 'payload network matches networkViewData_');
assert(payload.sheetUrl && payload.exportsFolderUrl && payload.generatedAt, 'payload carries sheet/folder links and a timestamp');
assert.strictEqual(payload.webAppUrl, 'https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec', 'payload carries the real web app URL, for the network-view link');
console.log('dashboard payload check passed: ' + payload.months.length + ' months, ' + payload.risks.length + ' risk rows');

// ── Creating a tab is not exclusive, so losing the race is not an error ─────────────────────────────────
// Reported from the live Sheet as "A sheet with the name 'Weekly profile' already exists": ensureSheet_ asked
// for the tab, did not find it, and by the time it created one another execution had. The web app's payload
// read and the trigger's run share no lock, and a release that adds tabs leaves all of them missing at once.
const collided = [];
const realInsert = spreadsheet.insertSheet;
spreadsheet.insertSheet = (n, idx) => {
  // Behave like Apps Script: the loser of the race is told the name is taken, after it already exists.
  if (sheets.find(s => s.getName() === n)) { collided.push(n); throw new Error(`A sheet with the name '${n}' already exists. Please enter another name.`); }
  if (collided.indexOf(n) < 0) { realInsert(n, idx); collided.push(n); throw new Error(`A sheet with the name '${n}' already exists. Please enter another name.`); }
  return realInsert(n, idx);
};
const raced = context.ensureSheet_('Weekly profile');
assert(raced && raced.getName() === 'Weekly profile', 'the tab the other execution created is returned, not an exception');
spreadsheet.insertSheet = () => { throw new Error('boom'); };
assert.throws(() => context.ensureSheet_('Something Else Entirely'), /boom/,
  'an insert that fails for any other reason still surfaces, rather than being swallowed with the race');
spreadsheet.insertSheet = realInsert;

// And the payload must not be what creates tabs in the first place: reading the dashboard is a read.
const beforeNames = sheets.map(s => s.getName());
assert.strictEqual(context.sheetRows_('Weekly profile').length, read('Weekly profile').length,
  'an existing tab still reads normally through the payload');
delete context.__t.HEADERS['Not A Real Tab'];
context.__t.HEADERS['Not A Real Tab'] = ['Month', 'Value'];
// .length, not deepStrictEqual against []: the array comes back from the vm realm, so its prototype is the
// vm's Array.prototype and a strict deep-equal fails on that alone, with nothing wrong with the value.
assert.strictEqual(context.sheetRows_('Not A Real Tab').length, 0, 'a tab that does not exist reads as no rows');
assert.deepStrictEqual(sheets.map(s => s.getName()), beforeNames, 'and reading it created nothing');
delete context.__t.HEADERS['Not A Real Tab'];
console.log('sheet-race check passed: a lost insert returns the existing tab, and the payload creates none');

const check = context.checkForNewExports();
assert.strictEqual(check.processed, 0, 'checkForNewExports finds nothing new right after a full run');
assert.strictEqual(check.busy, false, 'the lock is free once processNewExports has returned');
// A plain object built inside the vm sandbox has that realm's Object.prototype, not this one's, so
// deepStrictEqual (which compares prototypes) fails even on identical fields; compare them individually.
['found', 'ignored', 'moved', 'alreadyIn', 'watching', 'jsonFormat', 'checked'].forEach(k =>
  assert.strictEqual(check.stray[k], 0, `stray.${k} is 0 (this local Drive mock has nothing outside the exports folder)`));
assert.strictEqual(check.stray.timedOut, false, 'the sweep finishes well inside its own time budget here');

// The naming-shape filter: only Meta's own "meta-2026-Sep-15-..." pattern should pass, not every
// coincidental use of the substring "meta" (Metadata folders, MetaMask wallet backups, etc.).
assert(context.__t.META_DELIVERY_NAME.test('meta-2026-Sep-15-08-30-00'), 'matches Meta\'s real export naming');
assert(context.__t.META_DELIVERY_NAME.test('Meta-2026-aug-06-07-08-28'), 'matches case-insensitively');
assert(context.__t.META_DELIVERY_NAME.test('meta-2027-Jan-01-00-00-00'), 'matches a future year and month, not just this one');
assert(context.__t.META_DELIVERY_NAME.test('Meta_2028_dec_31'), 'matches with underscores ("_" is a \\w char, so a bare \\b after the month would wrongly reject this)');
assert(context.__t.META_DELIVERY_NAME.test('meta-2026-September-15'), 'matches a full month name, not just the 3-letter form');
assert(context.__t.META_DELIVERY_NAME.test('meta-2026-09-15'), 'matches a numeric month');
assert(!context.__t.META_DELIVERY_NAME.test('Metadata Backups'), 'does not match an unrelated "Metadata" folder');
assert(!context.__t.META_DELIVERY_NAME.test('MetaMask wallet seed'), 'does not match an unrelated "MetaMask" folder');
assert(!context.__t.META_DELIVERY_NAME.test('Automated Reports'), 'does not match an unrelated word that merely contains "meta"');
assert(!context.__t.META_DELIVERY_NAME.test('Metaverse gallery'), 'does not match an unrelated "Metaverse" folder');

// ── The stray-export sweep, against the exact folder shapes a real Drive turned out to have ─────────────
// Meta drops "meta-<date>/" at the top of My Drive with the export one level down inside it. A delivery can
// also arrive as JSON, which nothing here can read, and the root holds plenty of unrelated folders.
const moved = [];
const fakeFile = name => ({ getId: () => 'file:' + name, getName: () => name, getMimeType: () => 'text/html' });
const fakeFolder = (name, files, folders, parentId) => {
  const self = {
    getId: () => 'folder:' + name,
    getName: () => name,
    getFiles: () => iterator(files || []),
    getFolders: () => iterator(folders || []),
    getFilesByName: n => iterator((files || []).filter(f => f.getName() === n)),
    getParents: () => iterator([{
      getId: () => parentId || 'root',
      removeFolder: item => moved.push(['removed', item.getName()]),
    }]),
  };
  return self;
};
const exportsTarget = {
  getId: () => 'exports',
  getName: () => 'Instagram Exports',
  addFolder: item => moved.push(['added', item.getName()]),
  addFile: item => moved.push(['added', item.getName()]),
};

const htmlExport = fakeFolder('instagram-user-2026-09-15-abc', [fakeFile('start_here.html')], []);
const jsonExport = fakeFolder('instagram-user-2026-10-01-xyz', [], [
  fakeFolder('ads_information', [fakeFile('posts_viewed.json')], []),
]);
driveRoot = {
  folders: [
    fakeFolder('meta-2026-Sep-15-08-24-40', [], [htmlExport]),   // a real HTML export
    fakeFolder('meta-2026-Oct-01-00-00-00', [], [jsonExport]),   // JSON: unreadable, but still gets filed
    fakeFolder('meta-2026-Nov-02-00-00-00', [], []),             // delivered but still empty: still gets filed
    fakeFolder('Metadata Backups', [fakeFile('METADATA')], []),  // unrelated: never even opened
    fakeFolder('Instagram Exports', [], []),
    // Already filed by an earlier run. This is the sweep's only idempotency guard, so it matters that a
    // second pass leaves it alone - and that it does so on its *location*, never on the Log.
    fakeFolder('meta-2026-Aug-06-07-08-28', [], [], 'exports'),
  ],
  files: [],
};
const sweep = context.sweepStrayExports_(exportsTarget);
// The point of the sweep is tidying Drive, so every Meta-named delivery is filed regardless of whether this
// can read it. An earlier version moved only the readable one, which left a JSON delivery stranded forever.
assert.strictEqual(sweep.moved, 3, 'every Meta-named delivery is filed, readable or not');
assert.strictEqual(sweep.jsonFormat, 1, 'the JSON delivery is still called out as the wrong format');
assert.strictEqual(sweep.watching, 1, 'an empty delivery is called out as not readable yet');
assert.strictEqual(sweep.alreadyIn, 1, 'one already inside the exports folder is left alone');
assert.strictEqual(sweep.ignored, 2, 'unrelated root folders are ignored by name, without being opened');
assert.deepStrictEqual(moved.map(m => m[0]), ['removed', 'added', 'removed', 'added', 'removed', 'added'],
  'each delivery is detached from root and attached to the exports folder');
assert.deepStrictEqual(moved.filter(m => m[0] === 'added').map(m => m[1]),
  ['meta-2026-Sep-15-08-24-40', 'meta-2026-Oct-01-00-00-00', 'meta-2026-Nov-02-00-00-00'],
  'the whole meta- wrapper moves, matching how the already-working months are filed');
const jsonLog = read('Log').find(l => /JSON export/.test(String(l.Result)));
assert(jsonLog && /Format: HTML/.test(jsonLog.Result), 'the log tells you plainly to request the export as HTML');
// Every note must stay outside processedSourceIds_'s OK|Skipped prefixes, or the delivery it describes would
// be skipped by later runs - exactly the bug that stranded the real September folder.
read('Log').filter(l => /^Noted:/.test(String(l.Result))).forEach(l =>
  assert(!/^(OK|Skipped)/.test(String(l.Result)), 'a sweep note never marks a delivery as finished with'));
console.log('stray-sweep check passed: ' + JSON.stringify(sweep));
driveRoot = { folders: [], files: [] };
console.log('meta-naming-pattern check passed');
console.log('checkForNewExports check passed: ' + JSON.stringify(check));

// ── Multi-granularity exports: monthsTouched_ / mergeForMonth_ ───────────────────────────────────────────
// The user's real Drive delivery is weekly recurring, so from here on most months are built from several
// partial deliveries, not one. These test the merge directly, on plain in-memory exp objects, the same way
// the stray-sweep tests above use plain in-memory folder mocks rather than a real Drive.

// ── readExportFiles_ only downloads the pages the parser actually reads ─────────────────────────────────
// A real delivery carries ~320 HTML files and parseExport_ uses 18, so WANTED_EXPORT_FILES is what keeps a
// big export from costing ~300 pointless Drive downloads. The risk of that list is silent drift: a page
// added to parseExport_ but not to the list reads as empty forever, with no error. So derive the parser's
// real appetite straight from its source and require the list to cover it.
const parseSrc = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8')
  .match(/function parseExport_[\s\S]*?\n}/)[0];
const wantedByParser = Array.from(new Set(
  (parseSrc.match(/'[a-z_0-9]+\.html'/g) || []).map(s => s.replace(/'/g, ''))));
assert(wantedByParser.length >= 15, 'sanity: found the parser\'s file list (' + wantedByParser.length + ' pages)');
wantedByParser.forEach(name => assert(context.__t.WANTED_EXPORT_FILES.has(name),
  `parseExport_ reads "${name}" but WANTED_EXPORT_FILES omits it — it would silently read as empty`));
assert(context.__t.WANTED_EXPORT_FILES.has('followers.html'),
  'followers_1.html…followers_N.html are keyed as followers.html, so the grouped name must be listed');
console.log(`export-file filter check passed: parser reads ${wantedByParser.length} pages, filter allows ${context.__t.WANTED_EXPORT_FILES.size}`);

const utcNoon = (y, m, d) => new Date(Date.UTC(y, m - 1, d, 12));
// context.monthsTouched_ returns an array built inside the vm sandbox, so it carries that realm's
// Array.prototype — deepStrictEqual would fail on prototype alone despite identical elements (the same
// cross-realm issue this file's Date checks already work around). Array.from re-homes it in this realm.
const touched = exp => Array.from(context.monthsTouched_(exp));

assert.deepStrictEqual(
  touched({ periodStart: utcNoon(2026, 9, 3), periodEnd: utcNoon(2026, 9, 10) }),
  ['2026-09'], 'a week entirely inside one month touches only that month');
assert.deepStrictEqual(
  touched({ periodStart: utcNoon(2026, 8, 29), periodEnd: utcNoon(2026, 9, 5) }),
  ['2026-08', '2026-09'], 'a week crossing a month boundary touches both months');
assert.deepStrictEqual(
  touched({ periodStart: utcNoon(2026, 1, 1), periodEnd: utcNoon(2026, 12, 31) }),
  ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'],
  'a yearly export decomposes into all twelve real calendar months it touches, not one month or none — ' +
  'this is the exact gap the original plan draft missed (a year was still silently dropped under the ' +
  'unchanged 62-day cutoff) before hasDatedActivity_ replaced it');

assert.strictEqual(context.hasDatedActivity_({ allTime: false }), true, 'any dated export, however long, is eligible for month decomposition');
assert.strictEqual(context.hasDatedActivity_({ allTime: true }), false, 'only a true all-time snapshot skips straight to Network-only');

const item = (time, extra) => Object.assign({ time: time }, extra || {});
const bareExp = over => Object.assign({
  postsViewed: [], videosWatched: [], likedPosts: [], likedComments: [], adsViewed: [], notInterested: [],
  profileSearches: [], wordSearches: [], following: [], followers: [], blocked: [], closeFriends: null,
  metaCategories: [], locationsOfInterest: [], advertisers: [], basedIn: '', owner: '', exportTimezone: 'Europe/Rome',
}, over);

// Two non-overlapping weeks of September, delivered separately.
const weekA = { src: { id: 'weekA' }, exp: bareExp({
  periodStart: utcNoon(2026, 9, 1), periodEnd: utcNoon(2026, 9, 8),
  postsViewed: [item(utcNoon(2026, 9, 3)), item(utcNoon(2026, 9, 6))],
  following: ['a'],
}) };
const weekB = { src: { id: 'weekB' }, exp: bareExp({
  periodStart: utcNoon(2026, 9, 8), periodEnd: utcNoon(2026, 9, 15),
  postsViewed: [item(utcNoon(2026, 9, 10))],
  following: ['a', 'c'],
}) };
const mergedAB = context.mergeForMonth_('2026-09', [weekA, weekB]);
assert.strictEqual(mergedAB.postsViewed.length, 3, 'non-overlapping weeks simply combine their items');
assert.deepStrictEqual(mergedAB.following, ['a', 'c'], 'the snapshot fields come from the later-ending (newer) delivery');
// Coverage counts days of viewing history, not days of declared period: week A reported views on Sep 3 and
// Sep 6 (so Sep 3-6 inclusive, quiet days inside its own window included) and week B on Sep 10 — six of the
// fourteen days the two deliveries nominally span. The declared period is deliberately not what's measured.
assert.strictEqual(mergedAB.coverage, 5 / 30,
  'coverage is the viewing days the deliveries actually reported (Sep 3-6 plus Sep 10), not their declared 14 days');

// A third delivery re-covering part of week A's span with different data, ending later than week A — the
// newest-delivery-wins case. It overlaps Sep 5-7 (both cover them) and extends to Sep 8, which week A does not.
const redelivery = { src: { id: 'redelivery' }, exp: bareExp({
  periodStart: utcNoon(2026, 9, 5), periodEnd: utcNoon(2026, 9, 9),
  postsViewed: [item(utcNoon(2026, 9, 6)), item(utcNoon(2026, 9, 8))],
  following: ['a', 'c'],
}) };
const mergedAR = context.mergeForMonth_('2026-09', [weekA, redelivery]);
// Owned days: 1-4 -> week A (only contributor there); 5-8 -> redelivery (newer, periodEnd Sep 9 > Sep 8).
// So week A's Sep 3 item survives (day 3, A-only) but its Sep 6 item is dropped (day 6, now owned by the
// redelivery) in favour of the redelivery's own Sep 6 and Sep 8 items.
assert.strictEqual(mergedAR.postsViewed.length, 3, 'an overlapping day keeps only the newer delivery\'s item, not both');
assert.deepStrictEqual(Array.from(mergedAR.postsViewed, p => Object.is(p, weekA.exp.postsViewed[0]) ? 'A-Sep3'
  : Object.is(p, weekA.exp.postsViewed[1]) ? 'A-Sep6'
  : Object.is(p, redelivery.exp.postsViewed[0]) ? 'R-Sep6' : 'R-Sep8').sort(),
  ['A-Sep3', 'R-Sep6', 'R-Sep8'], 'specifically: the surviving items are A\'s untouched day plus both of the redelivery\'s, never week A\'s stale Sep 6 item');
// Week A reported views Sep 3-6, the redelivery Sep 6-8; a day both reported counts once, so Sep 3-8 = 6.
assert.strictEqual(mergedAR.coverage, 6 / 30,
  'a day two deliveries both reported viewing history for counts once, not once per contributor');

// A yearly export is the case where a declared period stops being evidence of data: Instagram hands back the
// full year you asked for but only ever keeps about a week of view history, so twelve of its thirteen months
// arrive empty. Measuring coverage off the declaration alone reported every one of them as 100% complete,
// and loadPreviousBucket_ then accepted those empty months as the baseline real months were compared against.
const yearly = { src: { id: 'yearly' }, exp: bareExp({
  periodStart: utcNoon(2025, 9, 19), periodEnd: utcNoon(2026, 9, 19),
  postsViewed: [item(utcNoon(2026, 9, 13)), item(utcNoon(2026, 9, 15))],
}) };
assert.strictEqual(touched(yearly.exp).length, 13, 'a year of declared period is thirteen calendar months');
const emptyMonth = context.mergeForMonth_('2026-03', [yearly]);
assert.strictEqual(emptyMonth.itemCount, 0, 'March holds none of the yearly export\'s activity');
assert.strictEqual(emptyMonth.coverage, 0,
  'a month with nothing in it is 0% covered however much period Instagram declared over it — at 100% it would '
  + 'have passed loadPreviousBucket_\'s completeness test and become a trend baseline made of zeroes');
const realMonth = context.mergeForMonth_('2026-09', [yearly]);
assert.strictEqual(realMonth.itemCount, 2, 'September holds the week Instagram actually kept');
assert(realMonth.coverage > 0 && realMonth.coverage < 1, 'the month that does carry data still reports honestly partial coverage');

console.log('multi-granularity merge check passed: AB coverage=' + mergedAB.coverage.toFixed(3)
  + ', AR coverage=' + mergedAR.coverage.toFixed(3)
  + ', yearly empty-month coverage=' + emptyMonth.coverage);

// ── A run that runs out of budget must still leave progress behind ─────────────────────────────────────
// After a real reprocess the Log held one error row and nothing else, while six deliveries had parsed fine:
// the month loop hit its budget, and the old rule - record a source only once every month it touches has
// finished - meant not one of them was written down. The next run rediscovered them all and got no further,
// indefinitely. Two things prevent that now: a source is recorded the moment it parses, and months not yet
// reached are persisted so a later run can drain them.
const loggedSources = read('Log').filter(l => /^OK:/.test(String(l.Result)) && l.Kind);
assert(loggedSources.length >= 2,
  'every parsed delivery is recorded with its Kind and period, not only those whose months all completed');
loggedSources.forEach(l => assert(l['Period start'] && l['Period end'],
  `"${l['Source name']}" must carry its period, or sourcesForMonth_ can never resolve it as a contributor again`));

assert.deepStrictEqual(Array.from(context.pendingMonths_()), [], 'a run that finished every month owes nothing');
context.setPendingMonths_(['2026-07', '2026-08']);
assert.deepStrictEqual(Array.from(context.pendingMonths_()), ['2026-07', '2026-08'],
  'unfinished months round-trip through Script Properties, which survive an execution being killed');
context.setPendingMonths_([]);
assert.deepStrictEqual(Array.from(context.pendingMonths_()), [], 'and clear again');
console.log(`convergence check passed: ${loggedSources.length} deliveries logged with period+kind, backlog round-trips`);

// ── Trend gating follows coverage, not a hardcoded "complete month" ─────────────────────────────────────
// Coverage is now counted in days of viewing history, which Instagram caps at about a week per delivery, so
// no month reaches 100% off a single delivery and the old ">= 1 to be comparable" rule would have silently
// removed every trend arrow in the dashboard. The bar is CONFIG.MIN_TREND_COVERAGE instead.
const minCov = context.__t.CONFIG.MIN_TREND_COVERAGE;
assert(minCov > 0 && minCov < 1, 'the comparability bar sits below a full month, or nothing is ever comparable');
const thinMonth = context.assessRisks_('2026-09', { Blocked: 0, 'Reported / not interested': 0 }, null, {}, minCov - 0.01);
assert(thinMonth.rows.every(r => r[9] === 'Partial month'),
  'a month under the bar carries no directional trend, only that it is partial');
const seenMonth = context.assessRisks_('2026-09', { Blocked: 0, 'Reported / not interested': 0 }, null, {}, minCov + 0.01);
assert(seenMonth.rows.every(r => r[9] !== 'Partial month'),
  'a month that clears the bar is trended normally, so raising coverage restores the arrows');
console.log(`trend-gating check passed: bar at ${Math.round(minCov * 100)}% viewing days`);

// ── An export whose header states no date range ─────────────────────────────────────────────────────────
// Meta ships more than one start_here.html: one carries "Generated by … on" plus the period as <time> tags,
// another is a plain index of the download with neither. A real delivery of the second kind failed outright
// with "export header not found", losing every month it covered. The period is inferred from the activity
// instead — the same per-item timestamps months are assembled from anyway.
const indexStyleHeader = '<html><head><title>Your information</title></head><body>'
  + '<h1>Your information</h1><p>About your download</p>'
  + '<nav><a href="#">Liked posts</a></nav></body></html>';
assert.strictEqual((indexStyleHeader.match(/<time/g) || []).length, 0, 'the index-style header states no dates');
const noDates = context.parseHeader_(indexStyleHeader);
assert.strictEqual(noDates.periodStart, null, 'a header with no dates yields no period rather than throwing');
assert.strictEqual(noDates.allTime, false, 'and is not mistaken for an All time export, which is a different thing');

const undatedFiles = {
  'start_here.html': [indexStyleHeader],
  'posts_viewed.html': [page([entry('someone', 'Apr 12, 2026 3:45 pm'), entry('someone_else', 'Apr 30, 2026 9:10 am')])],
};
const recovered = context.parseExport_(undatedFiles);
assert(recovered.periodInferred, 'the export is marked as having an inferred period, not a stated one');
assert.strictEqual(formatDate(recovered.periodStart, 'Europe/Rome', 'yyyy-MM-dd'), '2026-04-12', 'period starts at the earliest activity');
assert.strictEqual(recovered.month, '2026-04', 'and the month falls out of the inferred span');
assert.deepStrictEqual(touched(recovered), ['2026-04'], 'so the month it covers is processed like any other');
assert.throws(() => context.parseExport_({ 'start_here.html': [indexStyleHeader] }),
  /no dated activity/, 'an export with neither dates nor activity is the one case that still cannot be salvaged');
console.log('inferred-period check passed: recovered ' + recovered.month + ' from activity alone');

// ── Weekly buckets ─────────────────────────────────────────────────────────────────────────────────────
// Weeks run through the same merge and the same analyzeExport_ as months; only the key's shape differs and
// only three tabs are stored. Instagram keeps about a week of view history, so the week is the window its
// data is actually shaped like — the month is the one that has to be assembled.
assert.strictEqual(context.isoWeekKey_('2026-09-20'), '2026-W38', 'Sunday belongs to the week that began on Monday');
assert.strictEqual(context.isoWeekKey_('2026-09-21'), '2026-W39', 'and Monday starts the next one');
assert.strictEqual(context.isoWeekStart_('2026-W38'), '2026-09-14', 'a week key resolves back to its Monday');
assert.strictEqual(context.isoWeekKey_('2027-01-01'), '2026-W53',
  'the first days of January belong to the ISO week holding their Thursday, which can be the previous year');

const weekly = read('Weekly');
assert(weekly.length > 0, 'the real exports produced weekly rows');
weekly.forEach(w => {
  assert(/^\d{4}-W\d{2}$/.test(w.Week), `"${w.Week}" is an ISO week key`);
  assert.strictEqual(formatDate(w['Week start'], 'Europe/Rome', 'u'), '1', `${w.Week} starts on a Monday`);
  assert(w.Coverage >= 0 && w.Coverage <= 1, `${w.Week} has a sane coverage (${w.Coverage})`);
  // Coverage counts viewing days only, so a week carrying likes but no view history reads 0 — and when it
  // does, there must genuinely be nothing seen, or the two numbers are telling different stories.
  if (!w.Coverage) assert.strictEqual(+w['Items seen'], 0, `${w.Week} reports 0% coverage, so nothing was seen in it`);
});
// A week is seven days, so coverage is out of seven — the denominator follows the bucket, not the calendar.
const fullWeek = weekly.find(w => w.Coverage === 1);
if (fullWeek) assert.strictEqual(Math.round(fullWeek.Coverage * 7), 7, 'a fully covered week is seven days of viewing history');
const themes = read('Weekly themes');
const top = read('Weekly top');
assert(themes.length && top.length, 'the weekly breakdowns are stored alongside the summary');
assert(themes.every(t => /^\d{4}-W\d{2}$/.test(t.Week)), 'weekly themes are keyed by week, not by month');
console.log(`weekly check passed: ${weekly.length} weeks, ${themes.length} theme rows, ${top.length} top rows`
  + ' — ' + weekly.map(w => `${w.Week} ${Math.round(w.Coverage * 7)}/7d`).join(', '));

// ── Subtopics ──────────────────────────────────────────────────────────────────────────────────────────
// The same keyword machinery one level down, so "what KIND of AI & Tech" becomes answerable. Share is of the
// PARENT theme, not of the whole feed, which is what keeps "LLMs is 40% of your AI & Tech" true in a big week
// and a small one alike. Seeded in Italian and English because Meta localises the export.
const subRows = read('Subthemes');
assert(subRows.length > 0, 'the real exports produced subtopic rows — the seeded keywords match actual captions');
const themeNames = new Set(read('Themes').map(t => t.Theme));
subRows.forEach(s => {
  assert(s.Seen > 0, `${s.Subtopic} is only stored when it actually matched something`);
  assert(s['Share of theme'] > 0 && s['Share of theme'] <= 1, `${s.Subtopic} share is a fraction (${s['Share of theme']})`);
  assert(themeNames.has(s.Theme), `${s.Subtopic}'s parent "${s.Theme}" is a real theme — a typo here would silently orphan it`);
  assert(s.Subtopic !== s.Theme, `${s.Subtopic} parsed a child name out of "Parent > Child"`);
});
// A subtopic can never be bigger than the theme it subdivides. Matching on the subtopic rule alone allowed
// exactly that — "palestra" hit four items where the Health & Body theme hit three, reporting 133% of a
// parent — so an item now has to carry the parent theme as well to count.
// Per month AND theme: comparing a max taken across every month against a single month's parent is how the
// first version of this check failed on data that was actually correct.
const themeRows = read('Themes');
subRows.forEach(s => {
  const parent = themeRows.find(t => t.Month === s.Month && t.Theme === s.Theme);
  assert(parent, `${s.Month} ${s.Theme} has a parent row to be a share of`);
  assert(s.Seen <= parent.Seen,
    `${s.Month} ${s.Theme} › ${s.Subtopic} (${s.Seen}) fits inside its parent (${parent.Seen})`);
});
const parsed = context.compileRules_([['Subtopic', 'AI & Tech > LLMs', 'chatgpt, claude'], ['Subtopic', 'Bare', 'x']]);
assert.strictEqual(parsed.subtopics[0].parent, 'AI & Tech', 'parent is the text before ">"');
assert.strictEqual(parsed.subtopics[0].name, 'LLMs', 'child is the text after it');
assert.strictEqual(parsed.subtopics[1].name, 'Bare', 'a name with no ">" becomes its own parent rather than throwing');
console.log(`subtopic check passed: ${subRows.length} rows across `
  + `${new Set(subRows.map(s => s.Theme)).size} themes — e.g. `
  + subRows.slice().sort((a, b) => b.Seen - a.Seen).slice(0, 3)
    .map(s => `${s.Theme} › ${s.Subtopic} ${(100 * s['Share of theme']).toFixed(0)}%`).join(', '));

// ── Every child tab has a weekly twin ──────────────────────────────────────────────────────────────────
// analyzeExport_ computes the whole picture for a week exactly as it does for a month; the earlier version
// stored three tabs of it and dropped the rest, which is what left five dashboard sections blank in Weekly
// mode. The twins must exist, be keyed by week, and line up column-for-column with their monthly originals —
// that position match is the invariant writeWeekResult_ and bucketFromRows_ both depend on.
Object.keys(context.__t.WEEKLY_CHILD_TABS).forEach(weeklyTab => {
  const monthlyTab = context.__t.WEEKLY_CHILD_TABS[weeklyTab];
  const wHeaders = context.__t.HEADERS[weeklyTab];
  const mHeaders = context.__t.HEADERS[monthlyTab];
  assert.strictEqual(wHeaders.length, mHeaders.length, `${weeklyTab} has as many columns as ${monthlyTab}`);
  wHeaders.forEach((h, i) => {
    const expected = mHeaders[i] === 'Month' ? 'Week' : mHeaders[i] === 'Month date' ? 'Week start' : mHeaders[i];
    assert.strictEqual(h, expected, `${weeklyTab} column ${i} matches ${monthlyTab}'s, with the key swapped`);
  });
  const rows = read(weeklyTab);
  assert(rows.length > 0, `${weeklyTab} was actually written, not just declared`);
  assert(rows.every(r => /^\d{4}-W\d{2}$/.test(r.Week)), `${weeklyTab} is keyed by week`);
});

// A week's baseline must be the week before it. The bug this replaces was silent rather than loud: the
// lookup always read the Monthly tab, and '2026-09' < '2026-W38' is true in string order, so every week
// measured itself against a month — seven days of evidence compared with thirty, and no error to notice.
const weekKeys = weekly.map(w => w.Week).sort();
const laterWeek = weekKeys[weekKeys.length - 1];
const baseline = context.loadPreviousBucket_(laterWeek);
if (baseline) {
  assert(/^\d{4}-W\d{2}$/.test(baseline.month),
    `the baseline for ${laterWeek} is a week (${baseline.month}), not a month`);
  assert(baseline.month < laterWeek, 'and it is an earlier one');
}
assert.strictEqual(context.weeklyTabFor_('Quiet interests'), 'Weekly quiet', 'monthly tab names map to their twins');
assert.strictEqual(context.weeklyTabFor_('Daily'), 'Daily', 'a tab with no twin maps to itself');

// "New" vs "Continuing" on a quiet interest only means anything once a bucket has a predecessor — and it has
// to be the previous WEEK, or a week-one account would read as continuing because some month happened to
// carry it. Weeks with no predecessor correctly leave the column blank.
const weeklyQuiet = read('Weekly quiet');
const withBaseline = weeklyQuiet.filter(q => q.Week > weekKeys[0] && q['Vs previous']);
withBaseline.forEach(q => assert(['New', 'Continuing'].indexOf(q['Vs previous']) >= 0,
  `${q.Account} in ${q.Week} is flagged New or Continuing, not "${q['Vs previous']}"`));

// Emerging and ignored themes ride on the bucket row itself, so both buckets get them from one computation.
['Emerging theme', 'Emerging change', 'Ignored theme', 'Ignored gap'].forEach(col => {
  assert(context.__t.HEADERS.Monthly.indexOf(col) >= 0, `Monthly carries ${col}`);
  assert(context.__t.HEADERS.Weekly.indexOf(col) >= 0, `and Weekly inherits ${col} rather than restating it`);
});
// The first bucket has nothing behind it, so nothing can be "rising" in it — a claim with no baseline is the
// one thing this must never invent.
const firstWeek = weekly.find(w => w.Week === weekKeys[0]);
assert.strictEqual(firstWeek['Emerging theme'], '', 'the earliest week names no rising theme, having no predecessor');
// "Ignored" needs no predecessor: it compares two shares inside the same bucket.
const ignoredNamed = weekly.filter(w => w['Ignored theme']);
ignoredNamed.forEach(w => {
  assert(w['Ignored gap'] > 0, `${w.Week} names an ignored theme only when the gap is positive`);
  assert(w['Ignored gap'] <= 1, `${w.Week}'s gap is a share difference, not a count`);
  const row = themes.find(t => t.Week === w.Week && t.Theme === w['Ignored theme']);
  assert(row, `${w.Week}'s ignored theme "${w['Ignored theme']}" is one of its own themes`);
  assert.notStrictEqual(w['Ignored theme'], 'Other', 'and is a real theme, not the untagged bucket');
});
const rising = weekly.filter(w => w['Emerging theme']);
rising.forEach(w => assert(w['Emerging change'] > 0, `${w.Week} names a rising theme only when share actually grew`));
console.log(`weekly-twin check passed: ${Object.keys(context.__t.WEEKLY_CHILD_TABS).length} child tabs mirrored,`
  + ` baseline for ${laterWeek} is ${baseline ? baseline.month : 'none'},`
  + ` ${rising.length} weeks name a rising theme, ${ignoredNamed.length} name an ignored one`);

// ── Start fresh: the Sheet follows Drive, but never destroys what a person typed ────────────────────────
// Deleting an export from Drive leaves everything computed from it sitting in the Sheet, so the two drift
// apart with no warning. startFresh() is what reconciles them — and the two things it must not take with it
// are the keyword rules in Settings and the Region/Note columns someone filled in on the Network tab.
const settingsBefore = read('Settings').length;
const netSheet = spreadsheet.getSheetByName('Network');
const netHdr = context.__t.HEADERS.Network;
netSheet.getRange(2, netHdr.indexOf('Region') + 1).setValue('Roma');
netSheet.getRange(2, netHdr.indexOf('Note') + 1).setValue('met at a gig');
const taggedAccount = read('Network')[0].Account; // the mock range has no getValue()
assert(read('Monthly').length > 0 && read('Weekly').length > 0, 'there is computed data to lose before wiping');
// A month no export in Drive can account for any more — exactly what deleting an export leaves behind.
const orphanSheet = spreadsheet.getSheetByName('Monthly');
const orphanRow = orphanSheet.getLastRow() + 1;
orphanSheet.getRange(orphanRow, 1).setValue('2019-01');

context.startFresh();

assert.strictEqual(read('Settings').length, settingsBefore, 'the keyword rules you wrote survive a wipe');
const keptRow = read('Network').find(r => r.Account === taggedAccount);
assert(keptRow, 'an account you annotated is still listed after the wipe');
assert.strictEqual(keptRow.Region, 'Roma', 'and the Region you typed is still there');
assert.strictEqual(keptRow.Note, 'met at a gig', 'as is the Note');
assert(!read('Monthly').some(m => m.Month === '2019-01'),
  'a month left over from a deleted export is gone — which is the whole point, since Drive can no longer account for it');
assert(read('Monthly').length > 0, 'while months the surviving exports do account for are rebuilt');
console.log('start-fresh check passed: settings and hand-typed network fields survive, computed columns do not');

// ── Localised exports ──────────────────────────────────────────────────────────────────────────────────
// Meta translates the export into the account's language but keeps the structure, so an Italian delivery
// writes "set 13, 2026 3:28 am" — English shape, Italian month. Every string below is copied verbatim from a
// real Italian export. With only English months in the table these parsed "successfully" into the Unix
// epoch: 276 items, correct counts, every single date 1970. The counts being right is what made it look fine.
const itMonths = [['gen', 0], ['feb', 1], ['mar', 2], ['apr', 3], ['mag', 4], ['giu', 5],
  ['lug', 6], ['ago', 7], ['set', 8], ['ott', 9], ['nov', 10], ['dic', 11]];
itMonths.forEach(([abbr, index]) => {
  const parsed = context.parseEntryTime_(`${abbr} 13, 2026 3:28 am`, 'Europe/Rome');
  assert(parsed, `"${abbr}" is a month this can read`);
  assert.strictEqual(formatDate(parsed, 'Europe/Rome', 'yyyy-MM-dd'),
    `2026-${String(index + 1).padStart(2, '0')}-13`, `"${abbr}" maps to month ${index + 1}`);
});
assert.strictEqual(formatDate(context.parseEntryTime_('Sep 13, 2026 3:28 am', 'Europe/Rome'), 'Europe/Rome', 'yyyy-MM-dd'),
  '2026-09-13', 'English months keep working');

// The guard that would have caught this in the first place.
assert.strictEqual(context.parseEntryTime_('zzz 13, 2026 3:28 am', 'Europe/Rome'), null,
  'an unreadable month yields no timestamp rather than the epoch — a missing date is visible, a wrong one is not');

// The Italian header carries the offset the printed times are in; misreading it shifts the whole export.
const itHeader = 'Domenica 20 settembre 2026 alle ore 03:07 UTC';
const itParsed = context.parseHeaderDate_(itHeader);
assert(itParsed, 'the Italian header date is readable');
assert.strictEqual(new Date(itParsed).toISOString().slice(0, 16), '2026-09-20T03:07', 'day-before-month, 24-hour clock');
assert(context.parseHeaderDate_('Saturday, September 5, 2026 at 12:29 PM UTC'), 'the English header still parses');
console.log('localised-export check passed: 12 Italian months, English intact, unknown month fails safely');

// ── Localised field labels ─────────────────────────────────────────────────────────────────────────────
// Markup copied from a real Italian export. The labels are translated while the structure is not, so the
// parser found neither caption nor owner: hay was empty, every item fell into "Other" (430 of 430 in a real
// run), every account read "(unknown)", and Quiet interests came out with no rows at all.
const itEntry = '<table style="table-layout: fixed;"><tr><td colspan="2" class="_a6_q">URL<div>'
  + '<a target="_blank" href="https://www.instagram.com/p/DdOZ59ljTMy/">https://www.instagram.com/p/DdOZ59ljTMy/</a>'
  + '</div></td></tr><tr><td class="_a6_q">Didascalia</td><td class="_2piu _a6_r">Bending Spoons acquisirà Miro'
  + ' #finance #BendingSpoons</td></tr><tr><td class="_a6_q">Nome</td><td class="_2piu _a6_r">Starting Finance</td></tr>'
  + '<tr><td class="_a6_q">Nome utente</td><td class="_2piu _a6_r">startingfinance</td></tr></table>';
assert.strictEqual(context.field_(itEntry, 'Username'), 'startingfinance', 'the username comes from "Nome utente"');
assert.strictEqual(context.field_(itEntry, 'Name'), 'Starting Finance',
  '"Nome" is read as the display name and is not confused with the "Nome utente" row beside it');
assert(/Bending Spoons/.test(context.field_(itEntry, 'Caption')), 'the caption comes from "Didascalia"');

const enEntry = '<table><tr><td class="_a6_q">Caption</td><td class="_2piu">Hello world</td></tr>'
  + '<tr><td class="_a6_q">Name</td><td class="_2piu">Someone</td></tr>'
  + '<tr><td class="_a6_q">Username</td><td class="_2piu">someone_</td></tr></table>';
assert.strictEqual(context.field_(enEntry, 'Username'), 'someone_', 'English exports are unaffected');
assert.strictEqual(context.field_(enEntry, 'Caption'), 'Hello world', 'English captions still read');
assert.strictEqual(context.field_(enEntry, 'Nonexistent'), '', 'an absent field is empty, not a crash');
console.log('localised-label check passed: caption and owner read from both layouts');

// ── Account theme inheritance ──────────────────────────────────────────────────────────────────────────
// Half of what Instagram logs has no caption, so keyword rules can never classify it and "Other" swallowed
// the lot. An item with nothing to read inherits the themes its own account earned elsewhere in the bucket.
{
  const themes = read('Themes');
  const months = Array.from(new Set(themes.map(t => t.Month)));
  const report = months.map(m => {
    const mine = themes.filter(t => t.Month === m);
    const other = mine.find(t => t.Theme === 'Other');
    const total = read('Monthly').find(r => r.Month === m);
    return { m, otherShare: other ? other['Seen share'] : 0, inherited: total ? total['Inherited tags'] : 0 };
  });
  report.forEach(r => {
    assert(r.otherShare >= 0 && r.otherShare <= 1, `${r.m} Other share is a fraction`);
    assert(r.inherited >= 0, `${r.m} reports how many tags were inherited rather than read`);
  });
  const anyInherited = report.some(r => r.inherited > 0);
  assert(anyInherited, 'inheritance actually fired on the real exports — otherwise the guards are too tight');
  console.log('inheritance check passed: ' + report.map(r =>
    `${r.m} Other ${(100 * r.otherShare).toFixed(0)}% (${r.inherited} inherited tags)`).join(', '));
}
