// The dashboard UI. Data comes from the real Sheet, via google.script.run into Dashboard.gs — this file only
// draws it. Every draw* function below only ever reads plain-object arrays from table(name); it has no idea
// whether those came from a live server call, so the rendering logic never has to change when the data source does.
(function () {
  'use strict';

  const TABLE_KEY = {
    Monthly: 'months', Risks: 'risks', Daily: 'daily', Hourly: 'hourly', Themes: 'themes',
    Top: 'top', 'Quiet interests': 'quiet', Profile: 'profile', Signals: 'signals', Log: 'log',
    Weekly: 'weeks', 'Weekly themes': 'weeklyThemes', 'Weekly top': 'weeklyTop',
    Subthemes: 'subthemes', 'Weekly subthemes': 'weeklySubthemes',
    'Weekly risks': 'weeklyRisks', 'Weekly signals': 'weeklySignals', 'Weekly profile': 'weeklyProfile',
    'Weekly quiet': 'weeklyQuiet', 'Weekly hourly': 'weeklyHourly',
    Belonging: 'belonging', 'Weekly belonging': 'weeklyBelonging',
  };
  // Monthly tab name → its weekly twin. bucketTable() below picks between them off the current mode, so each
  // draw* function names the monthly tab once and stays bucket-agnostic.
  const WEEKLY_TWIN = {
    Themes: 'Weekly themes', Subthemes: 'Weekly subthemes', Top: 'Weekly top', Risks: 'Weekly risks', Signals: 'Weekly signals',
    Profile: 'Weekly profile', 'Quiet interests': 'Weekly quiet', Hourly: 'Weekly hourly',
    Belonging: 'Weekly belonging',
  };
  // ── Language ─────────────────────────────────────────────────────────────────────────────────────────
  // The Sheet's tab and column names stay English on purpose: they are the keys this file reads data by
  // (row['What it measures'], bucketTable('Themes')), and every sheet already in existence uses them. So
  // translation happens at the display layer only — nothing here renames data.
  const STRINGS = {
    it: {
      'lede': 'Letto direttamente dal tuo Foglio e dalla tua cartella Drive. Niente da caricare, niente da trascinare.',
      'refresh': 'Controlla Drive ora',
      'refresh.title': 'Controlla Drive adesso. Non ricarica questa pagina — dopo un aggiornamento del codice, ricarica prima la scheda.',
      'mode.title': 'Passa fra intervalli settimanali e mensili',
      'mode.week': 'Settimanale',
      'mode.month': 'Mensile',
      'empty.h': 'In attesa del tuo primo export',
      'empty.btn': 'Controlla ora',
      'sec.feed': 'Cosa ti ha mostrato il feed',
      'sec.time': 'Quando ti ha preso tempo',
      'sec.people': 'Chi lo ha riempito',
      'sec.feeling': 'Come ci si sentiva',
      'sec.profile': 'Chi pensa che tu sia',
      'sec.belonging': 'Se senti di appartenere',
      'sec.risks': "Dov'è l'attrito",
      'sec.signals': 'Cosa tenere d’occhio',
      'slope.h': 'Movimento rispetto all’intervallo precedente · sopra la linea è cresciuto, sotto è calato',
      'daily.h': 'Minuti al giorno, nella finestra conservata da Instagram',
      'hours.h': 'Ora per ora',
      'top.h': 'Più visti',
      'quiet.h': 'Interessi silenziosi · visti spesso, mai like né ricerche',
      'net.h': 'La tua rete, in miniatura',
      'net.link': 'Apri la vista di rete completa →',
      'footer.net': 'Apri la vista di rete →',
      'emo.h': 'Tono emotivo delle didascalie che ti sono state mostrate · elementi ogni 100 visti',
      'radar.big5': 'Personalità · approssimazione Big Five',
      'radar.desire': 'Cosa alimenta · approssimazioni dei desideri',
      'bel.needs': 'Cosa renderebbe tutto questo misurabile',
      'bel.lede': 'Quattro elementi di cui è fatta l’appartenenza. Un export Instagram può dire qualcosa su due di essi ed è muto sugli altri due — quelle righe lo dichiarano invece di sparire, perché una riga assente si legge come "niente da segnalare", che è l’opposto della verità.',
      // Hero and tiles
      'hero.week': 'La settimana in sintesi',
      'hero.month': 'Il mese in sintesi',
      'hero.week.of': 'Settimana del',
      'cov.complete': 'cronologia di visualizzazione completa',
      'cov.of': 'di',
      'cov.days': 'giorni di cronologia di visualizzazione',
      'items.seen': 'elementi visti',
      'accounts': 'account',
      'liked': 'like',
      // Donut
      'donut.centre': 'TAG TEMATICI',
      'donut.note': 'Ogni tema ha la sua fetta. I sei più grandi portano i colori con un nome; sotto di essi la tonalità segue il posto in classifica invece di rappresentare un tema. È la quota dei tag tematici, non dei post — un post su AI e lavoro porta entrambi i temi, quindi queste percentuali sono più basse delle quote per elemento qui accanto.',
      'donut.untagged': 'Elementi che nessuna regola ha intercettato — circa metà di ciò che Instagram registra non ha alcuna didascalia. Aggiungi regole nella scheda Settings per raggiungere quelli che ce l’hanno.',
      'donut.nosub': 'Nessuna regola di sottotema ha ancora trovato corrispondenza dentro questo tema.',
      'donut.tags': 'tag tematici',
      'donut.rank': 'posizione',
      // Profile of the week
      'pow.week': 'Profilo più coinvolgente della settimana',
      'pow.month': 'Profilo più coinvolgente del mese',
      'pow.why.mutual': 'In base a note e repost — l’unico punto dell’export in cui vi siete presentati entrambi. Questo è contatto, non consumo.',
      'pow.why.seen': 'In questo intervallo non è arrivato nessuno scambio di note o repost, quindi questo è l’account che ha riempito più schermo. Vedere spesso qualcosa non equivale a interagirci.',
      'pow.exchanges': 'scambi',
      'pow.seen': 'visto',
      'pow.liked': 'like',
      'pow.status': 'stato',
      // Network preview
      'net.say': '{n} account compongono la tua rete in tutti gli export elaborati finora, {e} dei quali hai apprezzato o cercato almeno una volta. Gli anelli vanno dalle persone più vicine a te al centro verso gli account che il feed ti spinge. Qui ne sono disegnati {s} — apri la vista completa per vederli tutti, con nomi, temi e filtri.',
      'net.legend.engaged': 'gli hai messo like o li hai cercati',
      'net.legend.seen': 'visti, nessuna reazione',
      'net.legend.unseen': 'non visti in nessun export',
      // Belonging
      'bel.noscore': 'nessun punteggio',
      'bel.status.Measured': 'Misurato',
      'bel.status.Proxy only': 'Solo indiretto',
      'bel.status.Not measurable yet': 'Non ancora misurabile',
      'bel.status.Not in this export': 'Non presente in questo export',
      'bel.status.No data this bucket': 'Nessun dato in questo intervallo',
      'bel.dim.Connected': 'Connesso',
      'bel.dim.Seen': 'Visto',
      'bel.dim.Heard': 'Ascoltato',
      'bel.dim.Invested in': 'Investito',
      // Misc
      // Tiles
      'tile.risk': 'Indice di rischio', 'tile.risk.sub': 'su 100',
      'tile.min': 'Minuti al giorno', 'tile.min.sub': 'stima minima',
      'tile.items': 'Elementi al giorno', 'tile.items.sub': 'post e video',
      'tile.active': 'Rapporto di attività', 'tile.active.sub': 'like, follow e ricerche per elemento',
      'tile.quiet': 'Interessi silenziosi', 'tile.quiet.sub': 'visti spesso, mai toccati',
      'tile.sessions': 'Sessioni al giorno', 'tile.sessions.sub': 'volte che l’hai ripreso in mano',
      'delta.same.week': 'come la settimana scorsa', 'delta.same.month': 'come il mese scorso',
      'delta.vs.week': 'rispetto alla settimana scorsa', 'delta.vs.month': 'rispetto al mese scorso',
      'pts': 'punti',
      // Chrome
      'chrome.checked': 'Ultimo controllo', 'chrome.folder': 'Cartella Drive', 'chrome.sheet': 'Apri il Foglio',
      'chrome.window': 'finestra di visualizzazione dal',
      'week.note': 'Rischi, indicatori e segnali qui sotto sono calcolati solo su questa settimana e confrontati con la settimana precedente. Sette giorni sono poche prove — leggili come provvisori, e passa a Mensile per la versione più stabile.',
      'week.note.first': 'Questa è la prima settimana registrata, quindi non c’è ancora nulla con cui confrontarla: rischi, indicatori e segnali qui sotto mostrano i livelli senza una tendenza.',
      'net.menu': 'Aprila dal Foglio: Instagram Insights \u2192 Apri la vista di rete',
      'quiet.none': 'Nessun account è stato visto abbastanza spesso senza like, ricerche o follow.',
      'profile.how': 'Come viene calcolato ciascuno',
      'signal.try': 'Prova:',
      'was': 'era',
    },
  };

  // Browser language on first visit, then whatever the reader chose.
  let lang = 'en';
  try {
    lang = localStorage.getItem('ii-lang')
      || (/^it\b/i.test(navigator.language || '') ? 'it' : 'en');
  } catch (e) { /* blocked storage: fall back to English */ }

  /** Translate a key. Unknown keys and English both return the fallback, so a missing string is never blank. */
  function t(key, fallback, vars) {
    const table = STRINGS[lang] || {};
    let out = table[key] !== undefined ? table[key] : (fallback !== undefined ? fallback : key);
    if (vars) Object.keys(vars).forEach(k => { out = out.split('{' + k + '}').join(vars[k]); });
    return out;
  }

  /** Stamp every data-i18n / data-i18n-title element. Runs on boot and on every language switch. */
  function applyStaticStrings() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(node => {
      const key = node.getAttribute('data-i18n');
      if (!node.dataset.en) node.dataset.en = node.textContent;
      node.textContent = t(key, node.dataset.en);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(node => {
      const key = node.getAttribute('data-i18n-title');
      if (!node.dataset.enTitle) node.dataset.enTitle = node.getAttribute('title') || '';
      node.setAttribute('title', t(key, node.dataset.enTitle));
    });
    const btn = $('#lang');
    // The button shows the language you would switch TO, which is what a one-key toggle has to say.
    if (btn) btn.textContent = lang === 'it' ? 'EN' : 'IT';
  }

  const $ = sel => document.querySelector(sel);
  const el = (tag, attrs, children) => {
    const node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(k => {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(c => node.appendChild(c));
    return node;
  };
  /** BCP-47 tag for the chosen language, for Intl date formatting. */
  const locale = () => (lang === 'it' ? 'it-IT' : 'en-GB');
  const fmt = {
    int: v => (v === '' || v === null || isNaN(v) ? '—' : Math.round(v).toLocaleString()),
    one: v => (v === '' || v === null || isNaN(v) ? '—' : (+v).toFixed(1)),
    pct: v => (v === '' || v === null || isNaN(v) ? '—' : (100 * +v).toFixed(1) + '%'),
    // Dates follow the CHOSEN language, not the browser's. Passing `undefined` as the locale meant an
    // Italian reader on an English-locale machine got "Week of 14 Sept 2026" sitting above Italian prose.
    month: m => {
      const [y, mm] = String(m).split('-');
      return new Date(Date.UTC(+y, +mm - 1, 1))
        .toLocaleString(locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' });
    },
    // "2026-W38" reads as the Monday it starts on, which is what anyone actually recognises a week by.
    week: (key, start) => (start
      ? t('hero.week.of', 'Week of') + ' ' + new Date(start + 'T12:00:00Z').toLocaleString(locale(),
        { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
      : String(key)),
  };

  /** How many real calendar days a named month ("2026-09") has. */
  function daysInMonth(ym) {
    const [y, m] = String(ym).split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }

  let payload = null;
  let current = '';
  // Weekly is the default: Instagram keeps about a week of view history, so a week is the window its data
  // is actually shaped like, while a month has to be assembled out of several deliveries and sits partial
  // until the last one lands.
  let mode = 'week';
  const isWeek = () => mode === 'week';
  const bucketKey = () => (isWeek() ? 'Week' : 'Month');
  const bucketRows = () => table(isWeek() ? 'Weekly' : 'Monthly');
  let toastTimer = null;
  let checkTimer = null;

  // Shown one at a time, rotating, while a check is in flight — so "Refresh now" reads as doing
  // something, not as having silently frozen. Long enough to reward actually reading them.
  const CHECKING_PHRASES = [
    'You didn’t watch the feed. The feed, as it turns out, was watching you — and taking excellent notes.',
    'Meta already knows what you like, who you follow, and roughly when you’re awake. Counting it twice seems only fair.',
    'Somewhere in Menlo Park, a spreadsheet grew a little happier each time you opened this app. We’re here to even the score.',
    'Reading your exports. Sorting your months. Judging absolutely nothing — that part is still your job.',
    'Every post counted. Every pause counted. Every “2am, just one more” — especially that one.',
    'How many advertisers does it take to conclude you might want a new mattress? Forty-one, apparently, and still counting.',
    'This won’t take forever. Probably. Instagram’s memory is longer than most marriages.',
    'Your Drive folder has been very patient with you. Return the favor for a few more seconds.',
    'Nothing builds character quite like learning exactly how many hours you handed to a rectangle.',
    'Sifting a year of scrolling like a monk illuminating a manuscript — if the manuscript were mostly reels and regret.',
    'Sorting the scroll, separating the signal from the sales pitch.',
    'You never asked the algorithm what it thought of you. It’s about to tell you anyway.',
    'Somewhere, an advertiser is grateful you exist. Somewhere else, so is this dashboard — for entirely different reasons.',
    'Think of this as an audit conducted by the one auditor who isn’t secretly trying to sell you something.',
    'Meta spent a year quietly learning your habits. This should take considerably less than a year to read back.',
    'The feed decided what you’d see. You’re about to decide what it meant.',
    'Nothing here ever leaves your own Google account — which already makes it more discreet than the app you’re auditing.',
    'Checking for exports Meta left lying around outside the folder, the way it leaves everything else lying around, everywhere.',
  ];

  // If a check runs long enough for the first tier to feel repetitive, the copy stops being coy about the
  // wait and starts making the wait itself the joke — a big export just genuinely takes longer to read
  // honestly than a small one, and pretending otherwise would be the one dishonest number in this whole app.
  const LONG_CHECK_PHRASES = [
    'Still here. A year of scrolling doesn’t summarize itself in the time it takes to summarize a week — patience is the toll for thoroughness.',
    'This is taking a moment, which is only fair: Instagram took considerably longer to collect all of it in the first place.',
    'Somewhere between “almost done” and “actually done” lies most of software. At last check, we’re somewhere in that gap.',
    'Good things come to those who wait. So, reportedly, does an honest risk index.',
    'The bigger the export, the longer the count — the same arithmetic that made your feed feel endless is, for once, working in your favor.',
    'Rome wasn’t built in a day, and apparently neither is an honest tally of your year on Instagram.',
    'If this feels slow, consider: nobody made you scroll for a year, but someone is now reading all of it back to you, without complaint. Mostly.',
    'Hang on a little longer — thoroughness and instant gratification were never going to be friends, and this dashboard chose thoroughness.',
  ];
  // How long a check runs before the copy stops being merely witty and starts being witty about the wait.
  const LONG_CHECK_AFTER_MS = 17000;
  // Mirrors CONFIG.MIN_TREND_COVERAGE in Code.gs. The server already applies it when choosing a baseline;
  // the client needs it only to explain WHY a comparison is missing, never to compute one.
  const MIN_TREND_COVERAGE = 0.5;

  function table(name) {
    const key = TABLE_KEY[name];
    return (payload && payload[key]) || [];
  }
  /** Rows of a tab for the bucket currently selected, already filtered to it. */
  function bucketTable(monthlyName) {
    const name = isWeek() && WEEKLY_TWIN[monthlyName] ? WEEKLY_TWIN[monthlyName] : monthlyName;
    return table(name).filter(r => r[bucketKey()] === current);
  }
  function note(message) {
    document.querySelectorAll('#note, #note2').forEach(box => {
      box.textContent = message;
      box.hidden = !message;
    });
  }
  const TOAST_HOLD_MS = 9000;
  // Rotation is slow enough to actually read a full sentence, with a crossfade so one thought visibly
  // leaves before the next arrives, instead of the text just snapping from one line to another.
  const CHECKING_INTERVAL_MS = 4300;
  const TOAST_FADE_MS = 350;
  function setToastText(message) {
    const label = $('#toast-text');
    if (!label) { $('#toast').textContent = message; return; } // defensive: template out of sync
    if (!label.textContent) { label.textContent = message; return; } // first show, nothing to fade from
    label.classList.add('is-changing');
    window.setTimeout(() => {
      label.textContent = message;
      label.classList.remove('is-changing');
    }, TOAST_FADE_MS);
  }
  function toast(message, isError) {
    const box = $('#toast');
    box.hidden = false;
    box.classList.toggle('toast-error', !!isError);
    setToastText(message);
    armToastTimer();
  }
  function armToastTimer() {
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, TOAST_HOLD_MS);
  }
  function startChecking() {
    const box = $('#toast');
    clearTimeout(toastTimer);
    box.classList.remove('toast-error');
    box.hidden = false;
    $('#toast-text').textContent = ''; // so the very first phrase of this run fades in too, not just appears
    const startedAt = Date.now();
    let i = Math.floor(Math.random() * CHECKING_PHRASES.length);
    let j = Math.floor(Math.random() * LONG_CHECK_PHRASES.length);
    const show = () => {
      if (Date.now() - startedAt < LONG_CHECK_AFTER_MS) {
        setToastText(CHECKING_PHRASES[i % CHECKING_PHRASES.length]);
        i++;
      } else {
        // The wait outlasted the first tier's patience, not just the user's — from here the copy is about
        // the wait itself instead of pretending this is still a quick check.
        setToastText(LONG_CHECK_PHRASES[j % LONG_CHECK_PHRASES.length]);
        j++;
      }
    };
    show();
    checkTimer = setInterval(show, CHECKING_INTERVAL_MS);
  }
  function stopChecking() {
    clearInterval(checkTimer);
    checkTimer = null;
    $('#toast').hidden = true;
  }

  // ── Talking to the server ────────────────────────────────────────────────────
  function callServer(fn) {
    return new Promise((resolve, reject) => {
      if (typeof google === 'undefined' || !google.script || !google.script.run) {
        reject(new Error('This page only works when opened through its Apps Script web app URL, not as a local file.'));
        return;
      }
      google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[fn]();
    });
  }
  const fetchPayload = () => callServer('getDashboardPayload');
  const runCheck = () => callServer('checkForNewExports');

  function setSkeleton(show) {
    $('#skeleton').hidden = !show;
    if (show) {
      $('#empty').hidden = true;
      $('#dash').hidden = true;
    }
  }
  function setBusy(busy) {
    $('#dash').classList.toggle('busy', busy);
  }

  function updateIdentity() {
    const box = $('#identity');
    box.innerHTML = '';
    if (!payload) return;
    box.appendChild(document.createTextNode(`${t('chrome.checked', 'Last checked')} ${payload.generatedAt}  ·  `));
    box.appendChild(el('a', { href: payload.exportsFolderUrl, target: '_blank', text: t('chrome.folder', 'Drive folder') }));
    box.appendChild(document.createTextNode('  ·  '));
    box.appendChild(el('a', { href: payload.sheetUrl, target: '_blank', text: t('chrome.sheet', 'Open Sheet') }));
    const folderLink = $('#folder-link');
    if (folderLink) folderLink.href = payload.exportsFolderUrl;
    // Both entry points to the network view take the same URL — but only a deployed web app HAS one. Opened
    // as a dialog inside the Sheet (the normal case now), there is no URL to link to, and a link that goes
    // nowhere is worse than a sentence saying where to click instead.
    ['#network-link', '#netprev-link'].forEach(sel => {
      const a = $(sel);
      if (!a) return;
      if (payload.webAppUrl) {
        a.href = payload.webAppUrl + '?view=network';
        a.removeAttribute('aria-disabled');
      } else {
        a.removeAttribute('href');
        a.setAttribute('aria-disabled', 'true');
        a.textContent = t('net.menu', 'Open it from the Sheet: Instagram Insights → Open network view');
      }
    });
  }

  async function afterLoad() {
    setSkeleton(false);
    note('');
    const months = bucketRows().map(r => r[bucketKey()]);
    if (!months.includes(current)) current = months[months.length - 1] || '';
    render();
    updateIdentity();
  }

  async function init() {
    setSkeleton(true);
    startChecking();
    try {
      payload = await fetchPayload();
      await afterLoad();
    } catch (e) {
      setSkeleton(false);
      $('#empty').hidden = false;
      $('#dash').hidden = true;
      note('Could not load your dashboard: ' + e.message);
    } finally {
      stopChecking();
    }
    wireControls();
  }

  function strayText(stray) {
    if (!stray) return '';
    // The tidying is reported first, because it's the part that changed your Drive. Whether a delivery could
    // then be read is a separate sentence - it never stops the delivery being filed.
    const bits = [];
    if (stray.moved) {
      const what = stray.moved === 1 ? 'delivery' : 'deliveries';
      bits.push(`Filed ${stray.moved} Meta ${what} into Instagram Exports.`);
    }
    if (stray.jsonFormat) {
      const n = stray.jsonFormat === 1 ? 'One of them is' : `${stray.jsonFormat} of them are`;
      bits.push(`${n} Meta's JSON export, which this can't read — request that month again from`
        + ' Instagram choosing Format: HTML.');
    }
    if (stray.watching) bits.push(`${stray.watching} has nothing readable in it yet; Drive may still be filling it in.`);
    if (!bits.length) return '';
    if (stray.timedOut) bits.push('Stopped early on its time limit — it will carry on next check.');
    return ' ' + bits.join(' ');
  }

  async function refreshNow() {
    const btn = $('#refresh');
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Checking Drive…';
    setBusy(true);
    startChecking();
    try {
      const check = await runCheck();
      payload = await fetchPayload();
      await afterLoad();
      stopChecking();
      toast((check.busy ? 'Another check is already running — try again shortly.'
        : check.processed > 0 ? `Processed ${check.processed} export${check.processed > 1 ? 's' : ''}.`
        : 'No new exports.') + strayText(check.stray));
    } catch (e) {
      stopChecking();
      toast('Could not check for new exports: ' + e.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = original;
      setBusy(false);
    }
  }

  // ── Drawing ─────────────────────────────────────────────────────────────────
  function render() {
    const rows = bucketRows();
    const key = bucketKey();
    // Falling back matters on a first run: weeks only exist once an export has been processed under a build
    // that writes them, so an older sheet has months and no weeks at all.
    if (!rows.length && isWeek()) { mode = 'month'; return render(); }
    $('#empty').hidden = rows.length > 0;
    $('#dash').hidden = rows.length === 0;
    $('#mode').textContent = isWeek() ? t('mode.week', 'Weekly') : t('mode.month', 'Monthly');
    if (!rows.length) return;

    if (!rows.some(r => r[key] === current)) current = rows[rows.length - 1][key];
    const picker = $('#month');
    picker.innerHTML = '';
    rows.slice().reverse().forEach(r => picker.appendChild(el('option', {
      value: r[key],
      text: isWeek() ? fmt.week(r.Week, r['Week start']) : fmt.month(r.Month),
    })));
    picker.value = current;

    const row = rows.find(r => r[key] === current);
    const index = rows.findIndex(r => r[key] === current);
    const before = index > 0 ? rows[index - 1] : null;
    // Coverage is counted in days of viewing history, out of seven for a week and out of the calendar for a
    // month — so the denominator follows whichever bucket is on screen.
    const span = isWeek() ? 7 : daysInMonth(row.Month);
    const coverage = row.Coverage;
    const partial = coverage !== '' && coverage !== null && coverage !== undefined && +coverage < 1;
    const coverageNote = partial
      ? ` · ${Math.round(+coverage * span)} of ${span} days of viewing history`
      : '';
    $('#period').textContent = `${row['Period start']} → ${row['Period end']} · ${t('chrome.window', 'viewing window from')} ${row['View window start']}`
      + ` · ${fmt.int(row['Items seen'])} ${t('items.seen', 'items seen')}${coverageNote}`;

    // Every section now has data in both buckets, so nothing is hidden by mode. What a week cannot give is
    // confidence: risks, indicators and signals read seven days of evidence rather than thirty, and the first
    // bucket of all has nothing behind it to compare against. Both facts are said out loud instead of being
    // handled by hiding the sections, which is what left five of them blank before.
    ['#sec-risks', '#sec-hours', '#sec-quiet', '#sec-profile', '#sec-signals'].forEach(sel => {
      const n = $(sel);
      if (n) n.hidden = false;
    });
    const weekNote = $('#week-note');
    if (weekNote) {
      weekNote.hidden = !isWeek();
      weekNote.textContent = before
        ? t('week.note', 'Risks, indicators and signals below are computed from this week alone and compared '
          + 'with the week before. Seven days is thin evidence — read them as provisional, and switch to '
          + 'Monthly for the steadier version.')
        : t('week.note.first', 'This is the first week on record, so there is nothing yet to compare it '
          + 'against: risks, indicators and signals below show levels without a trend.');
    }

    drawSectionIcons();
    drawHero(row, coverage, span);
    drawTiles(row, before);
    drawThemeDonut();
    drawThemes();
    drawThemeHighlights(row, before);
    drawThemeSlope(row, before);
    drawAccounts();
    drawProfileOfWeek();
    drawNetworkPreview();
    drawBelonging();
    drawDaily();
    drawEmotions();
    drawRadars();
    drawRiskMatrix();
    drawRisks();
    drawHours();
    drawProfile();
    drawSignals();
    drawLog();
  }

  /** Section-heading icons, stamped once from the data-icon attribute the template carries. */
  function drawSectionIcons() {
    document.querySelectorAll('.sec-i[data-icon]').forEach(slot => {
      if (slot.firstChild) return;
      slot.appendChild(CH.icon(slot.getAttribute('data-icon'), 22));
    });
  }

  function drawHero(row, coverage, span) {
    const covered = coverage === '' || coverage === null || coverage === undefined ? null : +coverage;
    $('#hero-eyebrow').textContent = isWeek() ? t('hero.week', 'Week in review') : t('hero.month', 'Month in review');
    $('#hero-title').textContent = isWeek() ? fmt.week(row.Week, row['Week start']) : fmt.month(row.Month);
    $('#hero-sub').textContent = `${fmt.int(row['Items seen'])} ${t('items.seen', 'items seen')}`
      + ` · ${fmt.int(row['Distinct accounts'])} ${t('accounts', 'accounts')}`
      + ` · ${fmt.int(row['Liked posts'])} ${t('liked', 'liked')}`;
    const fill = $('#cov-fill');
    fill.style.width = covered === null ? '100%' : `${Math.round(100 * covered)}%`;
    $('#cov-label').textContent = covered === null
      ? t('cov.complete', 'viewing history complete')
      : `${Math.round(covered * span)} ${t('cov.of', 'of')} ${span} ${t('cov.days', 'days of viewing history')}`;
  }

  // Every theme gets its own slice. The six largest take the categorical hues, in fixed assignment order.
  // The rest do NOT get invented hues — six is where a categorical palette stops being separable, and an
  // eighth and ninth hue would only look like information. They take steps of one ramp instead, light to
  // dark, so the step encodes the theme's RANK rather than pretending to be an identity: the tail is sorted
  // by size, so ramp and order agree by construction. Below the ramp's depth a theme still gets a slice and
  // still gets its own hover card — it shares the last step, which is honest, because by then the slices are
  // a fraction of a percent each and the card is what is actually being read.
  const SERIES = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6'];
  const TAIL = ['--t1', '--t2', '--t3', '--t4', '--t5', '--t6', '--t7'];
  function themeSlices() {
    const rows = bucketTable('Themes').filter(t => t.Theme !== 'Other' && t.Seen > 0)
      .sort((a, b) => b.Seen - a.Seen);
    const named = rows.map((t, i) => ({
      label: t.Theme,
      value: +t.Seen,
      color: i < SERIES.length
        ? `var(${SERIES[i]})`
        : `var(${TAIL[Math.min(i - SERIES.length, TAIL.length - 1)]})`,
      theme: t.Theme,
      tail: i >= SERIES.length,
      rank: i + 1,
    }));
    // Untagged is not a theme and never shares the themes' colours: it is the share no keyword rule reached,
    // which is a fact about the rules rather than about the feed.
    const other = bucketTable('Themes').find(t => t.Theme === 'Other');
    if (other && +other.Seen > 0) {
      named.push({ label: 'No theme matched', value: +other.Seen, color: 'var(--untagged)', untagged: true, rank: named.length + 1 });
    }
    return named;
  }

  /**
   * The hover card. One node, reused: building it per slice would mean a new element on every mouseenter,
   * and the card is the thing the reader looks at most in this section.
   */
  const tip = {
    node: () => $('#tipcard'),
    show(build, evt, anchorTo) {
      const card = tip.node();
      if (!card) return;
      card.innerHTML = '';
      build(card);
      card.classList.add('is-on');
      if (evt) {
        card.classList.remove('is-anchored');
        tip.place(evt);
      } else if (anchorTo) {
        // Keyboard: there is no pointer, so sit the card under the chart rather than wherever the mouse
        // happens to have been left — which is usually off-screen or over a different section entirely.
        const box = anchorTo.getBoundingClientRect();
        card.classList.remove('is-anchored');
        card.style.left = `${box.left}px`;
        card.style.top = `${box.bottom + 8}px`;
      }
    },
    place(evt) {
      const card = tip.node();
      if (!card) return;
      const box = card.getBoundingClientRect();
      const pad = 14;
      // Flip rather than clamp near an edge: a clamped card sits under the cursor and the slice it is
      // describing stops being hoverable, which reads as the chart flickering.
      let x = evt.clientX + pad;
      let y = evt.clientY + pad;
      if (x + box.width > window.innerWidth - 8) x = evt.clientX - box.width - pad;
      if (y + box.height > window.innerHeight - 8) y = evt.clientY - box.height - pad;
      card.style.left = `${Math.max(8, x)}px`;
      card.style.top = `${Math.max(8, y)}px`;
    },
    hide() {
      const card = tip.node();
      if (card) { card.classList.remove('is-on'); card.innerHTML = ''; }
    },
  };

  /** What one theme slice reveals: its subtopics, or why it has none. */
  function sliceCard(slice, total) {
    const subs = bucketTable('Subthemes');
    return card => {
      card.appendChild(el('div', { class: 'tipcard-h' }, [
        el('i', { style: `background:${slice.color}` }),
        el('b', { text: slice.label }),
        el('span', { class: 'tipcard-v', text: `${(100 * slice.value / total).toFixed(1)}%` }),
      ]));
      if (slice.untagged) {
        card.appendChild(el('p', {
          class: 'tipcard-note',
          text: t('donut.untagged', 'Items no keyword rule matched — about half of what Instagram logs '
            + 'carries no caption at all. Add rules in the Settings tab to reach the ones that do.'),
        }));
        return;
      }
      const mine = subs.filter(x => x.Theme === slice.theme).sort((a, b) => b.Seen - a.Seen).slice(0, 6);
      if (!mine.length) {
        card.appendChild(el('p', { class: 'tipcard-note', text: t('donut.nosub', 'No subtopic rule matched inside this theme yet.') }));
      } else {
        mine.forEach(x => card.appendChild(el('div', { class: 'tipcard-sub' }, [
          el('span', { text: x.Subtopic }),
          el('span', { text: fmt.pct(x['Share of theme']) }),
        ])));
      }
      card.appendChild(el('p', {
        class: 'tipcard-note',
        style: 'margin-top:6px',
        text: `${fmt.int(slice.value)} ${t('donut.tags', 'theme tags')} · ${t('donut.rank', 'rank')} ${slice.rank}`,
      }));
    };
  }

  function drawThemeDonut() {
    const box = $('#theme-donut');
    const legend = $('#theme-legend');
    if (!box) return;
    box.innerHTML = '';
    legend.innerHTML = '';
    const slices = themeSlices();
    if (!slices.length) return;
    const total = slices.reduce((n, s) => n + s.value, 0);
    // A donut asserts parts of one whole, and theme TAGS are that whole — items are not, because one post can
    // carry two themes and be counted under both. Sizing the slices by tags and then labelling the middle
    // "items seen" would put 651 next to a bar list saying 321, with the same theme reading 12% here and 25%
    // there. The centre names what is actually being divided up, and the note below says why they differ.
    const svg = CH.donut(slices, {
      centre: fmt.int(total),
      centreLabel: t('donut.centre', 'THEME TAGS'),
      onMove: (slice, evt) => tip.place(evt),
      onPick: (slice, evt) => {
        if (!slice) { tip.hide(); return; }
        tip.show(sliceCard(slice, total), evt, box);
      },
    });
    box.appendChild(svg);
    // A card left open while the page scrolls away under it points at nothing.
    window.addEventListener('scroll', tip.hide, { passive: true });
    // Identity is never carried by colour alone: every slice is also named here, in the same order. With the
    // tail disaggregated this list is now the chart's index — which is why it stays full-length rather than
    // being trimmed to the hues that happen to be categorical.
    slices.forEach(s => {
      legend.appendChild(el('span', {}, [
        el('i', { style: `background:${s.color}` }),
        el('span', { text: `${s.label} · ${(100 * s.value / total).toFixed(0)}%` }),
      ]));
    });
    legend.appendChild(el('p', {
      class: 'mono legend-note',
      text: t('donut.note', 'Every theme is its own slice. The six largest carry the named colours; below '
        + 'those, the shade steps with rank rather than standing for a theme. Share of theme tags, not of '
        + 'posts — a post about AI at work carries both themes, so these percentages are smaller than the '
        + 'per-item shares beside them.'),
    }));
  }

  function drawThemeSlope(row, before) {
    const sec = $('#sec-slope');
    const box = $('#theme-slope');
    if (!box) return;
    box.innerHTML = '';
    // A slope chart needs two moments. With only one bucket on record there is nothing to slope between,
    // so the section goes away rather than drawing a flat line that implies stability nobody measured.
    if (!before) { sec.hidden = true; return; }
    sec.hidden = false;
    const now = bucketTable('Themes').filter(t => t.Theme !== 'Other');
    const prevRows = (isWeek() ? table('Weekly themes') : table('Themes'))
      .filter(t => t[bucketKey()] === before[bucketKey()]);
    const prevShare = name => {
      const found = prevRows.find(t => t.Theme === name);
      return found ? +found['Seen share'] : 0;
    };
    const items = now.map(t => ({
      label: t.Theme,
      from: prevShare(t.Theme),
      to: +t['Seen share'],
      highlight: t.Theme === row['Emerging theme'] ? 'up' : t.Theme === row['Ignored theme'] ? 'down' : null,
    })).filter(i => i.from > 0 || i.to > 0);
    if (!items.length) { sec.hidden = true; return; }
    // Scatter rather than slope. Thirteen themes make thirteen crossing lines, and reading one of them means
    // tracing it across the gap; as points against the line y = x, the side tells you grew-or-shrank and the
    // distance tells you by how much, with no tracing at all. The diagonal IS the chart here.
    box.appendChild(CH.scatter(items.map(i => ({
      label: i.label, x: i.from, y: i.to, highlight: i.highlight,
    })), {
      xLabel: isWeek() ? 'share last week' : 'share last month',
      yLabel: isWeek() ? 'share this week' : 'share this month',
    }));
  }

  // The seven emotion rules split into a heavy and a light pole. Which side a name sits on is fixed here
  // rather than inferred, so a rule renamed in Settings lands on the neutral side instead of silently
  // flipping the chart's meaning.
  const EMO = [
    { name: 'Anxiety & stress', icon: 'anxiety', side: 'heavy' },
    { name: 'Fear & threat', icon: 'fear', side: 'heavy' },
    { name: 'Anger & injustice', icon: 'anger', side: 'heavy' },
    { name: 'Sadness & loneliness', icon: 'sadness', side: 'heavy' },
    { name: 'Hope & growth', icon: 'hope', side: 'light' },
    { name: 'Love & connection', icon: 'love', side: 'light' },
    { name: 'Joy & fun', icon: 'joy', side: 'light' },
  ];
  function drawEmotions() {
    const box = $('#emotions');
    if (!box) return;
    box.innerHTML = '';
    const rows = bucketTable('Profile').filter(p => /Emotional tone/i.test(p.Framework));
    if (!rows.length) return;
    const valueOf = name => {
      const found = rows.find(r => r.Dimension === name);
      return found ? +found.Score : 0;
    };
    const max = Math.max(1, Math.max.apply(null, rows.map(r => +r.Score)));
    const head = el('div', { class: 'emo-head' }, [
      el('b', { class: 'h-l', text: 'heavier' }),
      el('b', { class: 'h-r', text: 'lighter' }),
    ]);
    box.appendChild(head);
    EMO.forEach(e => {
      const v = valueOf(e.name);
      const width = `${(100 * v / max).toFixed(1)}%`;
      const leftBar = el('div', { class: 'emo-l' }, e.side === 'heavy' ? [el('i', { style: `width:${width}` })] : []);
      const rightBar = el('div', { class: 'emo-r' }, e.side === 'light' ? [el('i', { style: `width:${width}` })] : []);
      const iconSlot = el('span', { class: 'emo-i' });
      iconSlot.appendChild(CH.icon(e.icon, 18));
      box.appendChild(el('div', { class: 'emo', title: `${e.name}: ${v} items per 100 seen` }, [
        iconSlot,
        el('span', { class: 'emo-n', text: e.name }),
        leftBar,
        rightBar,
        el('span', { class: 'emo-v', text: String(v) }),
      ]));
    });
  }

  function drawRadars() {
    const groups = [
      { box: '#radar-big5', match: /Big Five/i },
      // The two desire frameworks share one 0–100 scale and describe one thing, so they read as one shape
      // rather than two three-spoke fragments that would each be too sparse to have a form at all.
      { box: '#radar-desire', match: /Desire/i },
    ];
    const rows = bucketTable('Profile');
    groups.forEach(g => {
      const box = $(g.box);
      if (!box) return;
      box.innerHTML = '';
      const axes = rows.filter(p => g.match.test(p.Framework))
        .map(p => ({ label: String(p.Dimension).split('·')[0].trim(), value: +p.Score }));
      if (axes.length < 3) return; // fewer than three spokes is a shape with no area to read
      box.appendChild(CH.radar(axes, { max: 100 }));
    });
  }

  function drawRiskMatrix() {
    const box = $('#risk-matrix');
    if (!box) return;
    box.innerHTML = '';
    const rows = bucketTable('Risks').filter(r => r.Likelihood && r.Impact);
    if (!rows.length) return;
    // Several risks routinely share a cell — five sat on 3×3 in the first real month — so a cell carries
    // every code that lands in it. One dot per cell would hide four of them.
    const byCell = {};
    rows.forEach(r => {
      const key = r.Likelihood + 'x' + r.Impact;
      (byCell[key] = byCell[key] || { likelihood: +r.Likelihood, impact: +r.Impact, codes: [] }).codes.push(r.Code);
    });
    box.appendChild(CH.matrix(Object.keys(byCell).map(k => byCell[k])));
  }

  function delta(now, then, kind) {
    if (then === '' || then === null || then === undefined || isNaN(then) || !before0(then)) return null;
    const diff = +now - +then;
    const sameKey = isWeek() ? 'delta.same.week' : 'delta.same.month';
    const vsKey = isWeek() ? 'delta.vs.week' : 'delta.vs.month';
    if (!isFinite(diff) || Math.abs(diff) < 1e-9) {
      return { text: t(sameKey, `same as last ${isWeek() ? 'week' : 'month'}`), dir: 'flat' };
    }
    const up = diff > 0;
    const size = kind === 'pct' ? (100 * Math.abs(diff)).toFixed(1) + ' ' + t('pts', 'pts')
      : Math.abs(diff) >= 10 ? fmt.int(Math.abs(diff)) : fmt.one(Math.abs(diff));
    return {
      text: `${up ? '▲' : '▼'} ${size} ${t(vsKey, 'vs last ' + (isWeek() ? 'week' : 'month'))}`,
      dir: up ? 'up' : 'down',
    };
  }
  function before0(v) {
    return v !== '' && v !== null && v !== undefined;
  }

  function drawTiles(row, before) {
    const tiles = [
      // The risk index is left out of a week for the same reason the Risks section is: it is scored against
      // month-scale thresholds and the month before, and seven days is not enough for it to mean anything.
      { k: 'Risk index', label: t('tile.risk', 'Risk index'), value: fmt.int(row['Risk index']), sub: t('tile.risk.sub', 'out of 100'), worse: 'up', monthOnly: true },
      { k: 'Est. minutes per active day', label: t('tile.min', 'Minutes a day'), value: fmt.one(row['Est. minutes per active day']), sub: t('tile.min.sub', 'estimated floor'), worse: 'up' },
      { k: 'Seen per day', label: t('tile.items', 'Items a day'), value: fmt.one(row['Seen per day']), sub: t('tile.items.sub', 'posts and videos'), worse: 'up' },
      { k: 'Active ratio', label: t('tile.active', 'Active ratio'), value: fmt.pct(row['Active ratio']), sub: t('tile.active.sub', 'likes, follows, searches per item'), worse: 'down', kind: 'pct' },
      { k: 'Quiet interests', label: t('tile.quiet', 'Quiet interests'), value: fmt.int(row['Quiet interests']), sub: t('tile.quiet.sub', 'seen often, never touched'), worse: 'up' },
      { k: 'Sessions per active day', label: t('tile.sessions', 'Sessions a day'), value: fmt.one(row['Sessions per active day']), sub: t('tile.sessions.sub', 'times you picked it up'), worse: 'up' },
    ];
    const box = $('#tiles');
    box.innerHTML = '';
    tiles.filter(t => !(t.monthOnly && isWeek())).forEach(t => {
      const d = before ? delta(row[t.k], before[t.k], t.kind) : null;
      const cls = d && d.dir !== 'flat' ? (d.dir === t.worse ? 'worse' : 'better') : 'flat';
      const parts = [
        el('div', { class: 'tile-v', text: t.value }),
        el('div', { class: 'tile-k', text: t.label }),
        el('div', { class: 'tile-s', text: t.sub }),
      ];
      // With nothing before it there is no comparison to draw, so none is drawn — a placeholder like
      // "first week" is just an empty promise taking up the space a real number will occupy later.
      if (d) parts.push(el('div', { class: 'tile-d ' + cls, text: d.text }));
      box.appendChild(el('div', { class: 'tile' }, parts));
    });
  }

  function ratingClass(rating) {
    const name = String(rating).replace(/[^A-Za-z]/g, '');
    return 'r-' + (name || 'Low').toLowerCase();
  }
  function trendClass(trend) {
    if (!trend) return 'flat';
    if (trend.indexOf('▲') === 0) return 'worse';
    if (trend.indexOf('▼') === 0) return 'better';
    return 'flat';
  }

  function drawRisks() {
    const rows = bucketTable('Risks').sort((a, b) => b.Score - a.Score);
    const box = $('#risks');
    box.innerHTML = '';
    rows.forEach(r => {
      const bar = el('div', { class: 'bar' }, [el('i', { class: ratingClass(r.Rating), style: `width:${(100 * r.Score / 25).toFixed(1)}%` })]);
      const head = [
        // The code is what ties this row to its square on the matrix beside it. Without it the matrix is a
        // grid of R-numbers with nothing to look them up in, which is how it shipped.
        el('span', { class: 'risk-c', text: r.Code }),
        el('span', { class: 'risk-n', text: r.Risk }),
        el('span', { class: 'chip ' + ratingClass(r.Rating), text: String(r.Rating).replace(/[^A-Za-z]/g, '') }),
      ];
      if (r.Trend) {
        const isPartial = r.Trend === 'Partial month';
        head.push(el('span', {
          class: 'trend ' + trendClass(r.Trend),
          title: isPartial ? 'Built from an incomplete set of deliveries so far — no trend shown' : 'vs last month',
          text: r.Trend,
        }));
      }
      head.push(el('span', { class: 'risk-s', text: `${r.Likelihood}×${r.Impact} = ${r.Score}` }));
      box.appendChild(el('div', { class: 'risk' }, [
        el('div', { class: 'risk-h' }, head),
        bar,
        el('div', { class: 'risk-e', text: r.Evidence }),
        el('div', { class: 'risk-m', text: r.Mitigation }),
      ]));
    });
  }

  function drawDaily() {
    // Daily rows are stored per real date under their month, so a week selects them by date range rather
    // than by key — the same seven days the weekly bucket was built from.
    const all = table('Daily').filter(d => d['In view window'] === 'Yes');
    let rows;
    if (isWeek()) {
      const row = bucketRows().find(r => r.Week === current);
      const start = row && row['Week start'];
      if (!start) return;
      const end = new Date(new Date(start + 'T12:00:00Z').getTime() + 6 * 86400000)
        .toISOString().slice(0, 10);
      rows = all.filter(d => d.Date >= start && d.Date <= end);
    } else {
      rows = all.filter(d => d.Month === current);
    }
    const box = $('#daily');
    box.innerHTML = '';
    if (!rows.length) return;
    const max = Math.max.apply(null, rows.map(d => d['Est. minutes'])) || 1;
    rows.forEach(d => {
      const height = Math.max(2, Math.round(100 * d['Est. minutes'] / max));
      box.appendChild(el('div', { class: 'day', title: `${d.Date} (${d.Weekday}) · ${d['Est. minutes']} min · ${d['Items seen']} items · ${d.Sessions} sessions` }, [
        el('i', { style: `height:${height}%` }),
        el('span', { text: d.Date.slice(8) }),
      ]));
    });
    $('#daily-note').textContent = `${rows.length} days Instagram kept, ${fmt.int(rows.reduce((n, d) => n + d['Est. minutes'], 0))} minutes in total.`;
  }

  function drawThemes() {
    const rows = bucketTable('Themes')
      .filter(t => t.Theme !== 'Other')
      .sort((a, b) => b['Seen share'] - a['Seen share']).slice(0, 10);
    const box = $('#themes');
    box.innerHTML = '';
    const max = rows.length ? rows[0]['Seen share'] : 1;
    const subs = bucketTable('Subthemes');
    rows.forEach(t => {
      box.appendChild(el('div', { class: 'theme' }, [
        el('span', { class: 'theme-n', text: t.Theme }),
        el('div', { class: 'bar' }, [el('i', { class: 'r-seen', style: `width:${(100 * t['Seen share'] / max).toFixed(1)}%` })]),
        el('span', { class: 'theme-v', text: fmt.pct(t['Seen share']) }),
        el('span', { class: 'theme-l', text: t.Liked ? `${t.Liked} liked` : '' }),
      ]));
      // Subtopics answer "what KIND of this theme", which the bar above cannot. Three at most: past that
      // they stop being a summary of the theme and become a second chart competing with the first.
      const mine = subs.filter(s => s.Theme === t.Theme)
        .sort((a, b) => b.Seen - a.Seen).slice(0, 3);
      if (!mine.length) return;
      box.appendChild(el('div', { class: 'subs' }, mine.map(s => el('span', {
        class: 'sub-chip',
        title: `${s.Subtopic}: ${s.Seen} of the ${t.Seen} items tagged ${t.Theme}`,
      }, [
        el('b', { text: s.Subtopic }),
        el('span', { text: fmt.pct(s['Share of theme']) }),
      ]))));
    });
  }

  /**
   * The two themes worth naming out of the ten bars above: the one climbing fastest, and the one filling the
   * most of the feed while earning the least of the attention. Both are single facts, so they are stated as
   * sentences rather than drawn as another chart.
   */
  function drawThemeHighlights(row, before) {
    const box = $('#theme-highlights');
    if (!box) return;
    box.innerHTML = '';
    const period = isWeek() ? 'week' : 'month';
    const cards = [];

    if (row['Emerging theme']) {
      cards.push({
        kind: 'up',
        label: 'Rising fastest',
        name: row['Emerging theme'],
        stat: `+${(100 * +row['Emerging change']).toFixed(1)} pts of your feed vs last ${period}`,
        why: 'Bigger share of what you were shown than it held before.',
      });
    } else {
      // Three different reasons produce an empty "Emerging theme", and saying the wrong one is worse than
      // saying nothing. The server refuses a baseline whose coverage is below CONFIG.MIN_TREND_COVERAGE, so
      // a previous bucket can exist and still be unusable — reporting that as "nothing rose" would be false.
      const prevCov = before ? +before.Coverage : null;
      const thin = before && !isNaN(prevCov) && prevCov < MIN_TREND_COVERAGE;
      const prevSpan = isWeek() ? 7 : daysInMonth(before ? before.Month : '');
      cards.push({
        kind: 'flat',
        label: 'Rising fastest',
        name: '—',
        stat: !before ? `Needs a previous ${period} to compare against`
          : thin ? `Last ${period} covered ${Math.round(prevCov * prevSpan)} of ${prevSpan} days`
            : `No theme gained share this ${period}`,
        why: thin ? 'Too little viewing history behind it to be a fair baseline.' : '',
      });
    }

    // A gap measured against very few likes is arithmetic, not evidence. Both cards say which it is.
    const likes = +row['Liked posts'] || 0;
    const thinLikes = likes < 5
      ? `Only ${likes} like${likes === 1 ? '' : 's'} this ${period} — thin evidence, read it as a hint.` : '';

    if (row['Cared-for theme']) {
      cards.push({
        kind: 'care',
        label: 'Cared about most',
        name: row['Cared-for theme'],
        stat: `${(100 * +row['Cared-for gap']).toFixed(1)} pts more of your likes than of your feed`,
        why: thinLikes || 'You go out of your way for this one.',
      });
    }

    if (row['Ignored theme']) {
      cards.push({
        kind: 'down',
        label: 'Most ignored',
        name: row['Ignored theme'],
        stat: `${(100 * +row['Ignored gap']).toFixed(1)} pts more of your feed than of your likes`,
        why: thinLikes || 'Shown to you constantly, acted on rarely.',
      });
    }

    cards.forEach(c => {
      box.appendChild(el('div', { class: 'hl hl-' + c.kind }, [
        el('span', { class: 'hl-k', text: c.label }),
        el('b', { class: 'hl-n', text: c.name }),
        el('span', { class: 'hl-s', text: c.stat }),
        el('span', { class: 'hl-w', text: c.why }),
      ]));
    });
  }

  function drawHours() {
    const rows = bucketTable('Hourly');
    const box = $('#hours');
    box.innerHTML = '';
    if (!rows.length) return;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const max = Math.max.apply(null, rows.map(r => r.Count)) || 1;
    const grid = el('div', { class: 'heat' });
    grid.appendChild(el('span', {}));
    for (let h = 0; h < 24; h++) grid.appendChild(el('span', { class: 'h', text: h % 3 === 0 ? String(h) : '' }));
    days.forEach((day, i) => {
      grid.appendChild(el('span', { class: 'wd', text: day }));
      for (let h = 0; h < 24; h++) {
        const found = rows.find(r => r['Weekday no'] === i + 1 && r.Hour === h);
        const count = found ? found.Count : 0;
        const cell = el('div', { class: 'cell', title: `${day} ${String(h).padStart(2, '0')}:00 · ${count} items` });
        if (count) {
          cell.style.background = 'var(--seen)';
          cell.style.opacity = (0.18 + 0.82 * Math.sqrt(count / max)).toFixed(2);
        }
        grid.appendChild(cell);
      }
    });
    box.appendChild(grid);
    const busiest = rows.slice().sort((a, b) => b.Count - a.Count)[0];
    $('#hours-note').textContent = busiest
      ? `Busiest hour: ${busiest.Weekday} at ${String(busiest.Hour).padStart(2, '0')}:00 with ${busiest.Count} items. Times are local.`
      : '';
  }

  function drawAccounts() {
    const top = bucketTable('Top').filter(t => t.List === 'Accounts seen').slice(0, 8);
    const topBox = $('#top');
    topBox.innerHTML = '';
    const maxSeen = top.length ? top[0].Count : 1;
    top.forEach(t => {
      topBox.appendChild(el('div', { class: 'item' }, [
        el('b', { text: t.Name }),
        el('span', { class: 'n', text: `${t.Count} seen${t.Liked ? ` · ${t.Liked} liked` : ''}` }),
        el('div', { class: 'bar' }, [el('i', { class: 'r-seen', style: `width:${(100 * t.Count / maxSeen).toFixed(1)}%` })]),
        el('span', { class: 'm', text: t.Themes || '' }),
      ]));
    });
    const quiet = bucketTable('Quiet interests').slice(0, 8);
    const quietBox = $('#quiet');
    quietBox.innerHTML = '';
    if (!quiet.length) quietBox.appendChild(el('p', { class: 'm', text: t('quiet.none', 'No account was seen often enough without a like, search or follow.') }));
    quiet.forEach(q => {
      quietBox.appendChild(el('div', { class: 'item' }, [
        el('b', { text: q.Account }),
        el('span', { class: 'n', text: `${q['Times seen']} seen` }),
        el('span', { class: 'm', text: [q['You follow'] === 'Yes' ? 'you follow them' : 'not followed', q['Vs previous'], q.Themes].filter(Boolean).join(' · ') }),
      ]));
    });
  }

  /**
   * Every score in this section is now a shape — two radars and a diverging chart — so repeating them as
   * bars would say the same thing twice and make the page longer without making it clearer. What the bars
   * did carry, and the shapes cannot, is the arithmetic behind each number: that is what stays here.
   * These are proxies built from keyword rules over what you were SHOWN, not a measurement of you, and the
   * method being readable at a glance is the only thing that keeps that honest.
   */
  /**
   * The one account worth naming this bucket. Ranked on reciprocal contact first — notes and reposts are
   * the only surface in an export where both sides showed up — and only when there is none does it fall
   * back to who filled the most screen. Those two answer different questions ("who did you meet" versus
   * "what was pushed at you"), so the card always says which rule fired rather than presenting them as the
   * same kind of finding. Without that line, an account the algorithm insisted on would read as a friend.
   */
  function drawProfileOfWeek() {
    const box = $('#pow');
    if (!box) return;
    box.innerHTML = '';
    const top = bucketTable('Top');
    const mutual = top.filter(t => t.List === 'Notes & reposts').sort((a, b) => b.Count - a.Count)[0];
    const seen = top.filter(t => t.List === 'Accounts seen').sort((a, b) => b.Count - a.Count)[0];
    const pick = mutual || seen;
    if (!pick) { box.hidden = true; return; }
    box.hidden = false;
    const net = (payload.network && payload.network.nodes) || [];
    const node = net.find(n => String(n.account).toLowerCase() === String(pick.Name).toLowerCase());
    const stats = [];
    if (mutual) stats.push([t('pow.exchanges', 'exchanges'), pick.Count]);
    else stats.push([t('pow.seen', 'seen'), pick.Count]);
    if (pick.Liked) stats.push([t('pow.liked', 'liked'), pick.Liked]);
    if (node) {
      if (node.status) stats.push([t('pow.status', 'status'), node.status]);
      if (node.seen && mutual) stats.push([t('pow.seen', 'seen'), node.seen]);
    }
    box.appendChild(el('div', { class: 'pow-mark', text: String(pick.Name).replace(/^@/, '').slice(0, 2).toUpperCase() }));
    box.appendChild(el('div', { class: 'pow-body' }, [
      el('span', { class: 'eyebrow', text: isWeek() ? t('pow.week', 'Most engaging profile this week') : t('pow.month', 'Most engaging profile this month') }),
      el('p', { class: 'pow-h', text: '@' + String(pick.Name).replace(/^@/, '') }),
      el('p', {
        class: 'pow-why',
        text: mutual
          ? t('pow.why.mutual', 'Ranked on notes and reposts — the one surface in the export where you and '
            + 'they both showed up. This is contact, not consumption.')
          : t('pow.why.seen', 'No note or repost exchange landed in this bucket, so this is the account that '
            + 'filled the most screen instead. Being shown something often is not the same as engaging with it.'),
      }),
      el('div', { class: 'pow-stats' }, stats.map(([k, v]) =>
        el('span', { class: 'pow-stat' }, [el('b', { text: String(v) }), document.createTextNode(' ' + k)]))),
      pick.Themes ? el('p', { class: 'bel-ev', style: 'margin-top:8px', text: pick.Themes }) : el('span', {}),
    ]));
  }

  /**
   * A still of the network graph, at a size that fits beside text. Deliberately not interactive and
   * deliberately unlabelled: its job is to show that a shape exists and is worth opening, not to be read.
   * Same rings, same colour rule and same dot sizing as the full view, so the preview is not a different
   * picture of the same data — only a smaller one.
   */
  const NET_RINGS = [
    ['Close friend', 'Inner circle'],
    ['Engaged follow', 'Quiet follow', 'Active follow'],
    ['Dormant follow', 'Fan'],
    ['Chosen, not followed', 'Pushed by feed'],
  ];
  function drawNetworkPreview() {
    const sec = $('#sec-netprev');
    const box = $('#netprev');
    if (!sec || !box) return;
    const nodes = (payload.network && payload.network.nodes) || [];
    if (!nodes.length) { sec.hidden = true; return; }
    sec.hidden = false;
    box.innerHTML = '';
    const S = 210, c = S / 2;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${S} ${S}`);
    svg.setAttribute('width', S);
    svg.setAttribute('height', S);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${nodes.length} accounts, arranged in rings by how close they are to you`);
    const mk = (tag, attrs) => {
      const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.keys(attrs).forEach(k => n.setAttribute(k, attrs[k]));
      return n;
    };
    let shown = 0;
    NET_RINGS.forEach((statuses, ri) => {
      const radius = 24 + ri * 26;
      svg.appendChild(mk('circle', { cx: c, cy: c, r: radius, class: 'ch-ring' }));
      const ring = nodes.filter(n => statuses.indexOf(n.status) >= 0)
        .sort((a, b) => b.attention - a.attention)
        // One ring of 400 dots is a filled disc, not a network. The cap keeps each ring readable at this
        // size; the caption below says how many accounts the whole picture actually stands for.
        .slice(0, 8 + ri * 14);
      ring.forEach((n, i) => {
        const a = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
        const kind = n.liked + n.searched > 0 ? 'engaged' : n.seen > 0 ? 'seen' : 'unseen';
        svg.appendChild(mk('circle', {
          cx: (c + Math.cos(a) * radius).toFixed(1),
          cy: (c + Math.sin(a) * radius).toFixed(1),
          r: Math.min(5, 1.6 + Math.sqrt(n.attention) * 0.5).toFixed(1),
          class: 'np-dot',
          fill: kind === 'engaged' ? 'var(--seen)' : kind === 'seen' ? 'var(--accent)' : 'var(--other)',
        }));
        shown += 1;
      });
    });
    svg.appendChild(mk('circle', { cx: c, cy: c, r: 5, fill: 'var(--ink)' }));
    box.appendChild(svg);

    const engaged = nodes.filter(n => n.liked + n.searched > 0).length;
    $('#netprev-say').textContent = t('net.say',
      '{n} accounts sit in your network across every export processed so far, {e} of which you have liked or '
      + 'searched at least once. Rings run from the people closest to you at the centre outward to accounts '
      + 'the feed pushes at you. {s} of them are drawn here — open the full view for all of them, with '
      + 'names, themes and filters.',
      { n: fmt.int(nodes.length), e: fmt.int(engaged), s: shown });
    const legend = $('#netprev-legend');
    legend.innerHTML = '';
    [['var(--seen)', t('net.legend.engaged', 'you liked or searched them')],
     ['var(--accent)', t('net.legend.seen', 'seen, no reaction')],
     ['var(--other)', t('net.legend.unseen', 'not seen in any export')]]
      .forEach(([col, text]) => legend.appendChild(el('li', {}, [
        el('i', { style: `background:${col}` }), el('span', { text: text }),
      ])));
  }

  /**
   * Belonging. Two of these four dimensions are measured, two are not measurable from an Instagram export at
   * all — and the unmeasurable pair is rendered at the same size as the others, with a dashed border and no
   * score, rather than being left out. Leaving them out would let the section read as "belonging, measured",
   * when the honest reading is "belonging, two-quarters visible". The row itself carries what would have to
   * arrive for it to become real.
   */
  function drawBelonging() {
    const sec = $('#sec-belonging');
    const box = $('#belonging');
    if (!sec || !box) return;
    const rows = bucketTable('Belonging');
    if (!rows.length) { sec.hidden = true; return; }
    sec.hidden = false;
    box.innerHTML = '';
    rows.forEach(r => {
      const measured = r.Status === 'Measured';
      const proxy = r.Status === 'Proxy only';
      const scored = r.Score !== '' && r.Score !== null && !isNaN(r.Score);
      const card = el('div', { class: 'bel' + (scored ? '' : ' is-absent') });
      card.appendChild(el('div', { class: 'bel-h' }, [
        el('span', { class: 'bel-n', text: t('bel.dim.' + r.Dimension, r.Dimension) }),
        el('span', { class: 'bel-chip' + (measured ? ' is-measured' : proxy ? ' is-proxy' : ''),
          text: t('bel.status.' + r.Status, r.Status) }),
        scored
          ? el('span', { class: 'bel-score', text: String(Math.round(r.Score)) })
          : el('span', { class: 'bel-score is-none', text: t('bel.noscore', 'no score') }),
      ]));
      if (scored) {
        card.appendChild(el('div', { class: 'bel-track' + (proxy ? ' is-proxy' : '') }, [
          el('i', { style: `width:${Math.max(2, Math.min(100, +r.Score))}%` }),
        ]));
      }
      card.appendChild(el('p', { class: 'bel-head', text: r.Headline }));
      card.appendChild(el('p', { class: 'bel-m', text: r['What it measures'] }));
      if (r.Evidence && r.Evidence !== '—') card.appendChild(el('div', { class: 'bel-ev', text: r.Evidence }));
      box.appendChild(card);
    });

    // The same "what it would take" text, gathered — so the answer to "how do I improve this" is one list
    // rather than something to reassemble from four cards.
    const needs = $('#bel-needs-list');
    needs.innerHTML = '';
    rows.forEach(r => needs.appendChild(el('div', { class: 'method' }, [
      el('span', { class: 'method-v', text: r.Status === 'Measured' ? '✓' : '—' }),
      el('div', {}, [
        el('b', { text: t('bel.dim.' + r.Dimension, r.Dimension) }),
        el('span', { class: 'method-h', text: r['What it would take'] }),
      ]),
    ])));
  }

  function drawProfile() {
    const rows = bucketTable('Profile').filter(p => !/Emotional tone/i.test(p.Framework));
    const box = $('#profile');
    box.innerHTML = '';
    if (!rows.length) return;
    box.appendChild(el('h3', { class: 'sub', text: t('profile.how', 'How each of these is computed') }));
    rows.forEach(p => {
      const change = p.Previous === '' || p.Previous === null || isNaN(p.Previous)
        ? '' : ` · was ${fmt.int(p.Previous)}`;
      box.appendChild(el('div', { class: 'method' }, [
        el('span', { class: 'method-v', text: fmt.int(p.Score) }),
        el('div', {}, [
          el('b', { text: String(p.Dimension).split('·')[0].trim() }),
          el('span', { class: 'method-h', text: p['How it is computed'] + change }),
        ]),
      ]));
    });
  }

  function drawSignals() {
    const rows = bucketTable('Signals');
    const order = { '🔴 Alert': 0, '⚠️ Watch': 1, 'ℹ️ Info': 2, '✅ OK': 3 };
    rows.sort((a, b) => (order[a.Level] === undefined ? 4 : order[a.Level]) - (order[b.Level] === undefined ? 4 : order[b.Level]));
    const box = $('#signals');
    box.innerHTML = '';
    rows.forEach(s => {
      box.appendChild(el('div', { class: 'signal' }, [
        el('span', { class: 'signal-l', text: s.Level }),
        el('div', {}, [
          el('div', { class: 'signal-n' }, [
            el('b', { text: s.Signal }),
            el('span', { class: 'signal-v', text: s.Previous === '' ? String(s.Value) : `${s.Value} (was ${s.Previous})` }),
          ]),
          el('div', { class: 'signal-m', text: s['What it means'] }),
          el('div', { class: 'signal-t', text: t('signal.try', 'Try:') + ' ' + s.Try }),
        ]),
      ]));
    });
  }

  function drawLog() {
    const rows = table('Log').filter(l => l.Month);
    $('#log').textContent = rows.length
      ? `${rows.length} export${rows.length > 1 ? 's' : ''} processed: ` + rows.map(l => l.Month).join(', ')
      : '';
  }

  // ── Theme toggle ──────────────────────────────────────────────────────────────
  function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') document.documentElement.dataset.theme = saved;
    $('#theme').addEventListener('click', () => {
      const current = document.documentElement.dataset.theme
        || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('theme', next);
    });
  }

  // ── Language toggle ───────────────────────────────────────────────────────────
  // A full re-render rather than a live text swap: every dynamic string is produced inside a draw*
  // function, so re-running them is both simpler and the only way to be sure nothing is left behind in
  // the old language. Re-stamping the static markup first keeps the two in step.
  function initLang() {
    applyStaticStrings();
    const btn = $('#lang');
    if (!btn) return;
    btn.addEventListener('click', () => {
      lang = lang === 'it' ? 'en' : 'it';
      try { localStorage.setItem('ii-lang', lang); } catch (e) { /* blocked storage: lasts this visit only */ }
      applyStaticStrings();
      if (payload && current) render();
    });
  }

  // ── Wiring ──────────────────────────────────────────────────────────────────
  function wireControls() {
    $('#month').addEventListener('change', e => { current = e.target.value; render(); });
    $('#refresh').addEventListener('click', refreshNow);
    const checkEmpty = $('#check-empty');
    if (checkEmpty) checkEmpty.addEventListener('click', refreshNow);
    initTheme();
    initLang();
    const modeBtn = $('#mode');
    if (modeBtn) {
      try {
        const saved = window.localStorage.getItem('insights-bucket');
        if (saved === 'month' || saved === 'week') mode = saved;
      } catch (e) { /* private window, blocked storage: the default stands */ }
      modeBtn.addEventListener('click', () => {
        mode = isWeek() ? 'month' : 'week';
        current = ''; // keys aren't interchangeable between buckets, so reselect the latest one
        try { window.localStorage.setItem('insights-bucket', mode); } catch (e) { /* not worth failing over */ }
        render();
      });
    }

    // The result toast holds for a while on its own, but pauses for as long as you're actually reading
    // it, and a click dismisses it outright. Only for the held result, not the rotating "checking" phrases.
    const toastBox = $('#toast');
    toastBox.addEventListener('mouseenter', () => { if (!checkTimer) clearTimeout(toastTimer); });
    toastBox.addEventListener('mouseleave', () => { if (!checkTimer) armToastTimer(); });
    toastBox.addEventListener('click', () => { if (!checkTimer) toastBox.hidden = true; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.__insights = { table: table, reload: refreshNow, payload: () => payload };
})();
