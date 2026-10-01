// Writes synthetic Instagram "Download your information" exports (HTML format) for testing without real data.
// Usage: node test/make-fake-exports.js <output folder> [weeks=3]
//
// Every account, caption and message here is invented. The pages follow the markup the parsers in Code.gs read,
// both English and Italian (the last week is written in Italian, the way Meta localises a delivery), and the
// activity is simulated session by session so the behaviour the dashboard measures — sessions, what opens them,
// what keeps them going, what gets liked, searched or answered — has real structure to find. The simulation
// deliberately builds in a few context effects (long sessions after recommended videos, searches after heavy
// news, messages after someone's story) so the trigger analysis has something to detect.
const fs = require('fs');
const path = require('path');

const out = process.argv[2];
if (!out) {
  console.error('usage: node test/make-fake-exports.js <output folder> [weeks]');
  process.exit(1);
}
const WEEKS = Math.max(1, +process.argv[3] || 3);

// ── Deterministic randomness ────────────────────────────────────────────────
let seed = 20260913;
const rnd = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = list => list[Math.floor(rnd() * list.length)];
const chance = p => rnd() < p;
const between = (lo, hi) => lo + rnd() * (hi - lo);
const int = (lo, hi) => Math.floor(between(lo, hi + 1));
let idCounter = 1000;
const mediaId = () => 'DF' + (idCounter++).toString(36).toUpperCase() + 'x' + Math.floor(rnd() * 1e6).toString(36);

// ── Who is in the feed ──────────────────────────────────────────────────────
const CAPTIONS = {
  tech: ['Nuovo modello di intelligenza artificiale: ChatGPT contro Claude #ai #coding', 'Come ho costruito una startup SaaS in 30 giorni #startup #founder',
    'Python developer tips: open source API in 5 minuti #programming', 'Il nuovo iPhone e il chip Nvidia #tech', 'Prompt engineering per principianti #chatgpt'],
  money: ['Investire in ETF: guida per principianti #finanza #investing', 'Colloquio di lavoro: 5 errori da evitare #carriera', 'Inflazione e economia italiana nel 2026',
    'Risparmiare sul mutuo e sulle bollette #budget', 'Stipendio e RAL: quanto si guadagna davvero #lavoro'],
  psych: ['Ansia e terapia: cosa funziona davvero #psicologia', 'Relazione di coppia e gelosia: parliamone', 'Autostima e crescita personale #mindfulness',
    'Attaccamento ansioso nelle relazioni #psychology', 'Famiglia e genitori: confini sani'],
  news: ['Notizie dal mondo: Europa e Cina al vertice #news', 'Cronaca: arresto a Napoli dopo la rapina', 'Breaking news: il governo approva la manovra',
    'Attualità: cosa succede in Medio Oriente', 'Le notizie del giorno in 60 secondi #notizie'],
  heavy: ['Guerra a Gaza: bombardamenti e paura tra i civili', 'Omicidio a Roma, indagini in corso: la violenza continua', 'Allarme clima: catastrofe e minaccia per il futuro',
    'Ansia e panico: il burnout è ovunque #stress', 'Femminicidio a Milano: rabbia e ingiustizia', 'War in Ukraine: missiles, fear and danger'],
  health: ['Allenamento in palestra: workout per la schiena #fitness', 'Mal di schiena? Postura e dolore cervicale #backpain', 'Sonno e recupero dopo la palestra',
    'Alimentazione e proteine: la dieta giusta #nutrizione', 'Yoga e pilates per la postura #workout'],
  politics: ['Elezioni e governo: il parlamento vota la riforma', 'Diritti e giustizia: il pride di Roma #lgbt', 'Migranti e frontiere: il nuovo decreto',
    'Referendum: come si vota #politica', 'Disuguaglianza e diritti dei lavoratori'],
  music: ['Techno festival this weekend #dj #rave', 'Nuovo album in uscita venerdì #rap', 'DJ set al club stasera #housemusic', 'Concerto live a Napoli #musica', 'Il singolo dell\'estate #spotify'],
  comedy: ['Meme del giorno 😂 #memes #funny', 'Stand-up comedy: la battuta migliore #comedy', 'Parodia del reality show #satira', 'Sketch comico sui colleghi #divertente'],
  arts: ['Design e illustrazione: il mio processo #graphicdesign', 'Cinema: il trailer del nuovo film #movie', 'Fotografia di strada a Roma #photography', 'Libri da leggere questo autunno #book'],
  env: ['Solarpunk: energia solare e rinnovabili #climate', 'Riparare invece di buttare #zerowaste #repair', 'Orto urbano e permacultura #garden', 'Biodiversità e natura in città #nature'],
  local: ['Letino e il Matese: comunità e volontariato', 'Festa del borgo sabato in piazza #community', 'Associazione di quartiere: raccolta fondi', 'Il mercato locale della domenica #local'],
  travel: ['Viaggio in montagna: trekking e rifugio #hiking', 'Itinerario di tre giorni in Lussemburgo #travel', 'Spiaggia e vacanza al sud #vacanze', 'Volo low cost per Berlino #trip'],
  science: ['Fisica quantistica e universo spiegati semplice #science', 'Neuroscienze: come funziona il cervello #brain', 'La NASA e il nuovo pianeta #space', 'Evoluzione e DNA #biologia'],
  funnel: ['Commenta "GUIDA" e ti mando il link in bio #workshop', 'Webinar gratuito: posti limitati, iscriviti! #masterclass', 'Scrivimi in DM per il percorso che ti ho riservato'],
};
const FRIENDS = [
  ['giulia.rossi.fake', 'Giulia Rossi'], ['marco_bianchi_fake', 'Marco Bianchi'], ['sara.verdi.fake', 'Sara Verdi'],
  ['luca.neri.fake', 'Luca Neri'], ['anna_galli_fake', 'Anna Galli'],
];
const CREATORS = [];
const THEME_KEYS = ['tech', 'money', 'psych', 'news', 'health', 'politics', 'music', 'comedy', 'arts', 'env', 'local', 'travel', 'science'];
THEME_KEYS.forEach((theme, t) => {
  for (let k = 0; k < (['tech', 'news', 'comedy', 'psych', 'money'].includes(theme) ? 5 : 3); k++) {
    CREATORS.push({
      user: `${theme}_creator_${k + 1}`, name: `${theme[0].toUpperCase() + theme.slice(1)} Creator ${k + 1}`, theme,
      // A followed account is part of your own circle; the rest reach you only because the recommender sends them.
      followed: (t + k) % 3 !== 0,
      // Half of what Instagram logs has no caption, so some accounts are known only by their name.
      captionRate: k === 2 ? 0.45 : 0.85,
      heavy: theme === 'news' ? 0.45 : theme === 'politics' ? 0.2 : theme === 'psych' ? 0.15 : 0.02,
    });
  }
});
CREATORS.push({ user: 'funnel_coach_fake', name: 'Coach Funnel', theme: 'money', followed: false, captionRate: 1, heavy: 0, funnel: true });
FRIENDS.forEach(([user, name]) => CREATORS.push({ user, name, theme: pick(['local', 'travel', 'music']), followed: true, captionRate: 0.7, heavy: 0, friend: true }));
const followedCreators = CREATORS.filter(c => c.followed);
const recommended = CREATORS.filter(c => !c.followed);
const ADVERTISERS = [['brand_shoes_fake', 'Scarpe Fake'], ['bank_fake', 'Banca Finta'], ['course_fake', 'Corso Online'], ['travel_fake', 'Viaggi Finti'],
  ['phone_fake', 'Telefono Fake'], ['food_fake', 'Cibo Finto']];
const OLD_FOLLOWS = Array.from({ length: 200 }, (_, i) => `old_follow_${i + 1}`);
const FOLLOWERS = Array.from({ length: 110 }, (_, i) => (i < 40 ? OLD_FOLLOWS[i] : `follower_${i + 1}`));
const SEARCH_TERMS = ['intelligenza artificiale', 'ansia', 'guerra', 'trekking matese', 'etf', 'techno', 'mal di schiena', 'solarpunk', 'notizie', 'claude'];
const ME = { user: 'fake_user_ii', name: 'Edu Test' };

// ── Clocks: activity is planned in Rome time, printed the way Meta prints it ──
// Meta prints entry times in US Pacific time while its header says "UTC"; the parser works the real offset
// out of the header, so the pages here do exactly the same.
const romeToUtc = (y, mo, d, h, mi) => new Date(Date.UTC(y, mo, d, h - 2, mi)); // CEST in September
const pacific = date => {
  const p = {};
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true, weekday: 'long' })
    .formatToParts(date).forEach(x => { p[x.type] = x.value; });
  return p;
};
const IT_MONTHS = { Jan: 'gen', Feb: 'feb', Mar: 'mar', Apr: 'apr', May: 'mag', Jun: 'giu', Jul: 'lug', Aug: 'ago', Sep: 'set', Oct: 'ott', Nov: 'nov', Dec: 'dic' };
const stamp = (date, it) => {
  const p = pacific(date);
  return `${it ? IT_MONTHS[p.month] : p.month} ${p.day}, ${p.year} ${p.hour}:${p.minute} ${p.dayPeriod.toLowerCase()}`;
};
const stampSeconds = (date, it) => {
  const p = pacific(date);
  return `${it ? IT_MONTHS[p.month] : p.month} ${p.day}, ${p.year} ${p.hour}:${p.minute}:${p.second}${p.dayPeriod.toLowerCase()}`;
};

// ── Simulation ──────────────────────────────────────────────────────────────
const views = []; // { kind: post|video|story|ad, time, url, owner, name, caption }
const likes = []; const saves = []; const comments = []; const wordSearches = []; const profileSearches = [];
const links = []; const storyLikes = []; const newFollows = []; const messages = []; const ownStories = [];
const likedComments = []; const notInterested = []; const unfollows = [];
const followedNow = new Set(followedCreators.map(c => c.user));
const seenCount = {};

const captionFor = c => {
  if (c.funnel) return pick(CAPTIONS.funnel);
  if (!chance(c.captionRate)) return '';
  return chance(c.heavy) ? pick(CAPTIONS.heavy) : pick(CAPTIONS[c.theme]);
};
const isHeavy = caption => CAPTIONS.heavy.includes(caption);

const firstDay = Date.UTC(2026, 8, 6); // Sunday Sep 6, 2026
const endAt = new Date(firstDay + WEEKS * 7 * 86400000 + 10 * 3600000);

for (let day = 0; day < WEEKS * 7 + 1; day++) {
  const date = new Date(firstDay + day * 86400000);
  const y = date.getUTCFullYear(); const mo = date.getUTCMonth(); const d = date.getUTCDate();
  // Inbound messages land through the day whether or not you are on the app; some of them pull you in.
  const inbound = [];
  for (let k = int(3, 7); k > 0; k--) inbound.push(romeToUtc(y, mo, d, int(9, 23), int(0, 59)));
  inbound.sort((a, b) => a - b);
  // Each friend posts stories on some days and not others, and you write to people without a story to answer too.
  const storiesToday = CREATORS.filter(x => x.friend && chance(0.35));
  if (chance(0.5)) {
    const [, name] = pick(FRIENDS);
    messages.push({ thread: name, sender: ME.name, time: romeToUtc(y, mo, d, int(9, 22), int(0, 59)), text: pick(['Come va?', 'Ti ricordi quel posto?', 'Domani pranzo?']) });
  }
  inbound.forEach(t => {
    const [, name] = pick(FRIENDS);
    messages.push({ thread: name, sender: name, time: t, text: pick(['Ci vediamo stasera?', 'Hai visto questo?', 'Che ansia domani, il colloquio', 'Ahah troppo bello', 'Sei libero sabato?', 'Grazie mille!']) });
  });

  // Session starts: morning, lunch, evening, and some nights a late one.
  const starts = [];
  for (let k = int(1, 2); k > 0; k--) starts.push({ at: romeToUtc(y, mo, d, int(7, 9), int(0, 59)) });
  for (let k = int(1, 2); k > 0; k--) starts.push({ at: romeToUtc(y, mo, d, int(12, 14), int(0, 59)) });
  for (let k = int(1, 3); k > 0; k--) starts.push({ at: romeToUtc(y, mo, d, int(17, 22), int(0, 59)) });
  if (chance(0.35)) starts.push({ at: romeToUtc(y, mo, d + 1, int(0, 1), int(0, 59)), late: true });
  // A message that arrives while you are away opens the app a few minutes later.
  inbound.filter(() => chance(0.3)).forEach(t => starts.push({ at: new Date(t.getTime() + int(1, 8) * 60000), pulledBy: true }));
  starts.sort((a, b) => a.at - b.at);

  let lastEnd = 0;
  starts.forEach(s => {
    let t = s.at.getTime();
    if (t < lastEnd + 16 * 60000) t = lastEnd + int(16, 25) * 60000; // sessions are at least 15 minutes apart
    if (t > endAt.getTime() - 3600000) return;
    const opener = s.pulledBy ? 'messages' : chance(0.08) ? 'search' : chance(0.45) ? 'stories' : 'feed';
    const recVideoStart = opener === 'feed' && chance(0.5);
    let minutes = Math.exp(between(Math.log(4), Math.log(14)));
    if (recVideoStart) minutes *= 1.9;
    if (s.late) minutes *= 1.6;
    if (chance(0.04)) minutes = between(45, 80);
    const until = t + Math.max(1, minutes) * 60000;
    const step = () => { t += int(8, 35) * 1000; };

    if (opener === 'messages') {
      const lastIn = messages.filter(m => m.sender !== ME.name && m.time.getTime() <= t).pop();
      if (lastIn) messages.push({ thread: lastIn.thread, sender: ME.name, time: new Date(t + 30000), text: pick(['Sì! A che ora?', 'Ahah vero', 'Ok perfetto', 'Domani ti chiamo']) });
      step();
    }
    if (opener === 'search') {
      wordSearches.push({ time: new Date(t), term: pick(SEARCH_TERMS) });
      step();
    }
    if (opener === 'stories' || chance(0.3)) {
      for (let k = int(4, 14); k > 0 && t < until; k--) {
        const c = storiesToday.length && chance(0.4) ? pick(storiesToday) : pick(followedCreators.filter(x => !x.friend));
        const v = { kind: 'story', time: new Date(t), url: `https://www.instagram.com/stories/${c.user}/${mediaId()}/`, owner: c.user, name: c.name, caption: '' };
        views.push(v);
        if (chance(0.06)) storyLikes.push({ time: new Date(t + 5000), account: c.user });
        // Seeing a friend's story is what most often starts a conversation with them.
        if (c.friend && chance(0.12)) messages.push({ thread: c.name, sender: ME.name, time: new Date(t + int(1, 50) * 60000), text: pick(['Che bella storia!', 'Dove sei??', 'Ahah questa è fantastica']) });
        t += int(4, 12) * 1000;
      }
    }
    let n = 0;
    while (t < until) {
      n++;
      if (n % int(6, 10) === 0) {
        const [user, name] = pick(ADVERTISERS);
        views.push({ kind: 'ad', time: new Date(t), url: `https://www.instagram.com/p/${mediaId()}/`, owner: user, name: name, caption: chance(0.3) ? pick(CAPTIONS.funnel) : 'Offerta speciale' });
        step();
        continue;
      }
      const firstMinutes = t - s.at.getTime() < 5 * 60000;
      const video = recVideoStart && firstMinutes ? true : chance(0.55);
      const c = video ? (chance(recVideoStart && firstMinutes ? 0.85 : 0.6) ? pick(recommended) : pick(followedCreators))
        : (chance(0.7) ? pick(followedCreators) : pick(recommended));
      const caption = captionFor(c);
      const url = `https://www.instagram.com/${video ? 'reel' : 'p'}/${mediaId()}/`;
      const v = { kind: video ? 'video' : 'post', time: new Date(t), url, owner: c.user, name: c.name, caption };
      views.push(v);
      seenCount[c.user] = (seenCount[c.user] || 0) + 1;
      const heavy = isHeavy(caption);
      // What you act on: posts from people you follow, light tone, mostly in the evening.
      const hourRome = (new Date(t).getUTCHours() + 2) % 24;
      const pLike = (c.followed ? 0.06 : 0.02) * (heavy ? 0.3 : 1) * (hourRome >= 18 ? 1.5 : 1) * (video ? 0.7 : 1.3);
      if (chance(pLike)) likes.push({ time: new Date(t + int(5, 120) * 1000), url, owner: c.user, name: c.name, caption });
      if (chance(['tech', 'money', 'science'].includes(c.theme) ? 0.012 : 0.003)) saves.push({ time: new Date(t + 20000), url, owner: c.user, name: c.name, caption });
      if (chance(c.followed ? 0.004 : 0.001)) comments.push({ time: new Date(t + 60000), owner: c.user, text: pick(['Bellissimo!', 'Verissimo 👏', 'Ma è vero? Fonte?', 'Grazie per averlo condiviso']) });
      // Heavy news sends you looking things up.
      if (heavy && chance(0.12)) wordSearches.push({ time: new Date(t + int(1, 6) * 60000), term: pick(['guerra', 'notizie', 'ansia', 'gaza']) });
      if (c.funnel && chance(0.4)) links.push({ time: new Date(t + 40000), url: 'https://corso-online-finto.example/webinar', title: 'Webinar gratuito', seconds: int(20, 200) });
      if (!c.followed && seenCount[c.user] >= 6 && chance(0.004) && newFollows.length < WEEKS * 2 && !followedNow.has(c.user)) {
        followedNow.add(c.user);
        newFollows.push({ time: new Date(t + 30000), account: c.user });
      }
      if (!c.followed && chance(0.004)) profileSearches.push({ time: new Date(t + int(1, 8) * 60000), account: c.user });
      if (chance(0.0015)) notInterested.push({ time: new Date(t + 10000), url, owner: c.user, name: c.name, caption });
      step();
    }
    lastEnd = t;
  });
  // Likes on things the view log never recorded (from a profile, a share, the web).
  if (chance(0.5)) {
    const c = pick(followedCreators);
    likes.push({ time: romeToUtc(y, mo, d, int(10, 20), int(0, 59)), url: `https://www.instagram.com/p/${mediaId()}/`, owner: c.user, name: c.name, caption: captionFor(c) });
  }
  if (chance(0.25)) likedComments.push({ time: romeToUtc(y, mo, d, int(10, 22), int(0, 59)), account: pick(recommended).user, text: 'Commento divertente' });
  if (chance(0.2)) {
    const t = romeToUtc(y, mo, d, int(18, 21), int(0, 59));
    ownStories.push({ time: t });
  }
}
// One unfollow a week, of a recommended-turned-followed account or an old follow.
for (let w = 0; w < WEEKS; w++) unfollows.push({ time: new Date(firstDay + (w * 7 + 3) * 86400000 + 15 * 3600000), account: OLD_FOLLOWS[w] });

// ── Markup ──────────────────────────────────────────────────────────────────
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const page = (title, body) => `<html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body><div class="_a705"><main class="_a706" role="main">${body}</main></div></body></html>`;
const box = inner => `<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">${inner}</div>`;
const time = (date, it) => `<div class="_3-94 _a6-o">${stamp(date, it)}</div>`;
const row = (label, value) => `<tr><td class="_a6_q">${esc(label)}</td><td class="_2piu _a6_r">${esc(value)}</td></tr>`;
const stacked = (label, value) => `<tr><td colspan="2" class="_a6_q">${esc(label)}<div><div>${esc(value)}</div></div></td></tr>`;
const L = it => (it
  ? { caption: 'Didascalia', user: 'Nome utente', name: 'Nome', search: 'Cerca', comment: 'Commento', owner: 'Proprietario del contenuto multimediale' }
  : { caption: 'Caption', user: 'Username', name: 'Name', search: 'Search', comment: 'Comment', owner: 'Media Owner' });

const mediaPage = (title, items, it) => page(title, items.map(i => box(`<div class="_a6-p"><table style="table-layout: fixed;">`
  + `<tr><td colspan="2" class="_a6_q">URL<div><a target="_blank" href="${i.url}">${i.url}</a></div></td></tr>`
  + (i.caption ? row(L(it).caption, i.caption) : '') + row(L(it).name, i.name || i.owner) + row(L(it).user, i.owner)
  + `</table></div>${time(i.time, it)}`)).join(''));
const peoplePage = (title, people, it) => page(title, people.map(p => box(`<div class="_a6-p"><div><div><a target="_blank" href="https://www.instagram.com/${p.account}">${esc(p.account)}</a></div>`
  + `<div>${stamp(p.time, it)}</div></div></div>`)).join(''));
const headedPage = (title, people, it) => page(title, people.map(p => box(`<h2 class="_3-95 _2pim _a6-h _a6-i">${esc(p.account)}</h2>`
  + `<div class="_a6-p"><div><div><a target="_blank" href="https://www.instagram.com/stories/${p.account}/1/">${esc(p.text || p.account)}</a></div>`
  + `<div>${stamp(p.time, it)}</div></div></div>`)).join(''));
const listPage = (title, label, items) => page(title, `<table>${`<tr><td colspan="2" class="_a6_q">${esc(label)}<div>`
  + items.map(i => `<div>${esc(i)}</div>`).join('') + '</div></td></tr>'}</table>`);
const cardPage = (title, pairs) => page(title, `<table>${pairs.map(([k, v]) => stacked(k, v)).join('')}</table>`);

const inRange = (list, from, to) => list.filter(x => x.time >= from && x.time < to).sort((a, b) => b.time - a.time);
const write = (dir, rel, html) => {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html);
};
const fmtCardDay = (d, it) => {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', month: 'short', day: 'numeric' }).formatToParts(d);
  const mon = p.find(x => x.type === 'month').value; const day = p.find(x => x.type === 'day').value;
  return it ? `${day} ${IT_MONTHS[mon]}` : `${mon} ${day}`;
};

fs.mkdirSync(out, { recursive: true });
for (let w = 0; w < WEEKS; w++) {
  const it = w === WEEKS - 1 && WEEKS > 1; // the newest delivery arrives in Italian
  const from = new Date(firstDay + w * 7 * 86400000 + 10 * 3600000);
  const to = new Date(from.getTime() + 7 * 86400000);
  const generated = new Date(to.getTime() + 3600000);
  const ymd = to.toISOString().slice(0, 10);
  const dir = path.join(out, `instagram-${ME.user}-${ymd}-fake${w + 1}`);
  const lab = L(it);
  const shown = (d) => {
    const p = pacific(d);
    if (!it) return `${p.weekday}, ${({ Sep: 'September', Oct: 'October', Aug: 'August' })[p.month] || p.month} ${p.day}, ${p.year} at ${p.hour}:${p.minute} ${p.dayPeriod} UTC`;
    const days = { Sunday: 'Domenica', Monday: 'Lunedì', Tuesday: 'Martedì', Wednesday: 'Mercoledì', Thursday: 'Giovedì', Friday: 'Venerdì', Saturday: 'Sabato' };
    const months = { Sep: 'settembre', Oct: 'ottobre', Aug: 'agosto' };
    const h24 = (+p.hour % 12) + (p.dayPeriod === 'PM' ? 12 : 0);
    return `${days[p.weekday]} ${p.day} ${months[p.month]} ${p.year} alle ore ${String(h24).padStart(2, '0')}:${p.minute} UTC`;
  };
  const tag = d => `<time datetime="${d.toISOString()}">${shown(d)}</time>`;
  write(dir, 'start_here.html', `<html><body><aside>${it ? `Archivio generato da ${ME.user} in data:` : `Generated by ${ME.user} on`} ${tag(generated)}`
    + `<p>${it ? 'Periodo' : 'Date range'}: ${tag(from)} – ${tag(to)}</p></aside><main></main></body></html>`);

  const v = inRange(views, from, to);
  write(dir, 'ads_information/ads_and_topics/posts_viewed.html', mediaPage('Posts viewed', v.filter(x => x.kind === 'post'), it));
  write(dir, 'ads_information/ads_and_topics/videos_watched.html', mediaPage('Videos watched', v.filter(x => x.kind === 'video'), it));
  write(dir, 'ads_information/ads_and_topics/ads_viewed.html', mediaPage('Ads viewed', v.filter(x => x.kind === 'ad'), it));
  write(dir, 'ads_information/ads_and_topics/stories_viewed.html', mediaPage('Stories viewed', v.filter(x => x.kind === 'story'), it));
  write(dir, 'ads_information/ads_and_topics/posts_you_re_not_interested_in.html', mediaPage('Not interested', inRange(notInterested, from, to), it));
  write(dir, 'your_instagram_activity/likes/liked_posts.html', mediaPage('Liked posts', inRange(likes, from, to), it));
  write(dir, 'your_instagram_activity/saved/saved_posts.html', mediaPage('Saved posts', inRange(saves, from, to), it));
  write(dir, 'your_instagram_activity/likes/liked_comments.html', headedPage('Liked comments', inRange(likedComments, from, to), it));
  write(dir, 'your_instagram_activity/story_interactions/story_likes.html', headedPage('Story likes', inRange(storyLikes, from, to), it));
  write(dir, 'your_instagram_activity/comments/post_comments_1.html', page('Comments', inRange(comments, from, to).map(c => box(`<div class="_a6-p"><table>`
    + stacked(lab.comment, c.text) + stacked(lab.owner, c.owner) + `<tr><td class="_a6_q">Time</td><td class="_2piu _a6_r">${stamp(c.time, it)}</td></tr></table></div>`)).join('')));
  write(dir, 'logged_information/recent_searches/word_or_phrase_searches.html', page('Word searches', inRange(wordSearches, from, to).map(s => box(`<div class="_a6-p"><table>`
    + stacked(lab.search, s.term) + `</table></div>${time(s.time, it)}`)).join('')));
  write(dir, 'logged_information/recent_searches/profile_searches.html', peoplePage('Profile searches', inRange(profileSearches, from, to), it));
  const linkLabels = it ? ['Link al sito web che hai visitato', 'Titolo della pagina del sito web che hai visitato', 'Ora di inizio della sessione sul sito web', 'Ora di fine della sessione sul sito web']
    : ['Website link you visited', 'Title of website page you visited', 'Website session start time', 'Website session end time'];
  write(dir, 'logged_information/link_history/link_history.html', page('Link history', inRange(links, from, to).map(l => box(`<table>`
    + row(linkLabels[0], l.url) + row(linkLabels[1], l.title) + row(linkLabels[2], stampSeconds(l.time, it))
    + row(linkLabels[3], stampSeconds(new Date(l.time.getTime() + l.seconds * 1000), it)) + '</table>')).join('')));

  // Snapshots as of the end of this delivery.
  const followsUntil = newFollows.filter(f => f.time < to);
  const unfollowedUntil = new Set(unfollows.filter(u => u.time < to).map(u => u.account));
  const following = OLD_FOLLOWS.filter(a => !unfollowedUntil.has(a)).map(a => ({ account: a, time: new Date(Date.UTC(2023, 2, 3, 20, 15)) }))
    .concat(followedCreators.map(c => ({ account: c.user, time: new Date(Date.UTC(2024, 5, 10, 18, 0)) })))
    .concat(followsUntil.map(f => ({ account: f.account, time: f.time })));
  write(dir, 'connections/followers_and_following/following.html', peoplePage('Following', following.sort((a, b) => b.time - a.time), it));
  const followers = FOLLOWERS.map((a, i) => ({ account: a, time: i % 37 === 0 ? new Date(from.getTime() + (i % 6) * 86400000 + 3600000) : new Date(Date.UTC(2023, 4, 1 + (i % 27), 9, 0)) }));
  write(dir, 'connections/followers_and_following/followers_1.html', peoplePage('Followers', followers, it));
  write(dir, 'connections/followers_and_following/recently_unfollowed_profiles.html', peoplePage('Unfollowed', inRange(unfollows, new Date(0), to), it));
  write(dir, 'connections/followers_and_following/blocked_profiles.html', peoplePage('Blocked', [{ account: 'spam_account_fake', time: new Date(Date.UTC(2025, 1, 2, 10, 0)) }], it));

  // Direct messages: one folder per thread, newest message first, as Meta writes them.
  const byThread = {};
  inRange(messages, from, to).forEach(m => { (byThread[m.thread] = byThread[m.thread] || []).push(m); });
  Object.keys(byThread).forEach((thread, k) => {
    write(dir, `your_instagram_activity/messages/inbox/${thread.toLowerCase().replace(/\s+/g, '')}_${1000 + k}/message_1.html`,
      page(thread, byThread[thread].map(m => box(`<h2 class="_3-95 _2pim _a6-h _a6-i">${esc(m.sender)}</h2>`
        + `<div class="_3-95 _a6-p"><div><div></div><div>${esc(m.text)}</div><div></div><div></div></div></div>${time(m.time, it)}`)).join('')));
  });
  write(dir, 'your_instagram_activity/media/stories.html', page('Stories', inRange(ownStories, from, to).map(s => box(`<div class="_a6-p">Story</div>${time(s.time, it)}`)).join('')));

  write(dir, 'ads_information/instagram_ads_and_businesses/other_categories_used_to_reach_you.html',
    listPage('Categories', it ? 'Nome' : 'Name', ['Tecnologia', 'Viaggi', 'Musica elettronica'].concat(w ? ['Finanza personale'] : [])));
  write(dir, 'ads_information/instagram_ads_and_businesses/advertisers_using_your_activity_or_information.html',
    page('Advertisers', `<table><tr><td colspan="2" class="_a6_q">Advertisers who uploaded a list<div>${ADVERTISERS.slice(0, 3).map(a => `<div>${esc(a[1])}</div>`).join('')}</div></td></tr>`
      + `<tr><td colspan="2" class="_a6_q">Interacted with website, app or store<div>${ADVERTISERS.slice(3).map(a => `<div>${esc(a[1])}</div>`).join('')}</div></td></tr></table>`));
  write(dir, 'personal_information/information_about_you/locations_of_interest.html', listPage('Locations', it ? 'Luoghi' : 'Locations', ['Roma', 'Caserta']));
  write(dir, 'personal_information/information_about_you/profile_based_in.html', page('Based in', `<table>${row(it ? 'Città' : 'City', 'Roma')}${row(it ? 'Paese' : 'Country', 'Italia')}</table>`));
  write(dir, 'your_instagram_activity/threads/note_and_repost_interactions.html', page('Notes', FRIENDS.slice(0, 3).map(([user, name]) => box(`<h2>${it ? 'Autore' : 'Author'}</h2><table>${row(lab.user, user)}${row(lab.name, name)}</table>`)).join('')));
  write(dir, 'personal_information/personal_information/personal_information.html', cardPage('Personal information', [[it ? 'Nome utente' : 'Username', ME.user], [it ? 'Nome' : 'Name', ME.name]]));
  const lastStory = ownStories.filter(s => s.time < to).pop();
  if (lastStory) write(dir, 'personal_information/personal_information/instagram_profile_information.html',
    page('Profile', `<table>${row(it ? 'Data e ora del reel più recente' : 'Last Story Time', stamp(lastStory.time, it))}</table>`));

  // Instagram's own creator cards for the 90 days before the delivery.
  const winEnd = new Date(to.getTime() - 86400000); const winStart = new Date(winEnd.getTime() - 89 * 86400000);
  const range = `${fmtCardDay(winStart, it)} - ${fmtCardDay(winEnd, it)}`;
  const prevRange = `${fmtCardDay(new Date(winStart.getTime() - 90 * 86400000), it)} - ${fmtCardDay(new Date(winStart.getTime() - 86400000), it)}`;
  const reach = 260 + w * 15; const engaged = 40 + w * 3;
  const thousands = n => (it ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','));
  const pct = x => (it ? String(x).replace('.', ',') : String(x)) + '%';
  write(dir, 'logged_information/past_instagram_insights/profiles_reached.html', cardPage('Reach', it
    ? [['Intervallo di date', range], ['Account raggiunti', thousands(reach)], ['Differenza di account raggiunti', `${pct(-4.5)} rispetto a ${prevRange}`], ['Impression', thousands(1130 + w * 40)], ['Visite al profilo', String(31 + w)], ['Non follower', pct(35.2)]]
    : [['Date Range', range], ['Accounts Reached', thousands(reach)], ['Accounts Reached Delta', `You reached ${pct(-4.5)} more accounts compared to ${prevRange}.`], ['Impressions', thousands(1014 + w * 40)], ['Profile Visits', String(31 + w)], ['Non-Followers', pct(35.2)]]));
  write(dir, 'logged_information/past_instagram_insights/content_interactions.html', cardPage('Interactions', it
    ? [['Intervallo di date', range], ['Interazioni con i contenuti', String(120 + w * 5)], ['Account che hanno interagito', String(engaged)], ['Risposte alla storia', String(6 + w)]]
    : [['Date Range', range], ['Content Interactions', String(120 + w * 5)], ['Accounts engaged', String(engaged)], ['Story Replies', String(6 + w)]]));
  write(dir, 'logged_information/past_instagram_insights/audience_insights.html', cardPage('Audience', it
    ? [['Intervallo di date', range], ['Follower', String(FOLLOWERS.length)], ['Percentuale totale di follower uomini', pct(48.5)], ['Percentuale totale di follower donne', pct(51.5)]]
    : [['Date Range', range], ['Followers', String(FOLLOWERS.length)], ['Total Follower Percentage for Men', pct(48.5)], ['Total Follower Percentage for Women', pct(51.5)]]));
  console.log(`${path.basename(dir)}: ${v.length} views, ${inRange(likes, from, to).length} likes, ${inRange(messages, from, to).length} messages, `
    + `${inRange(wordSearches, from, to).length} word searches${it ? ' (Italian)' : ''}`);
}
