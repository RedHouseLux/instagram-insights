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
    Conversations: 'conversations', 'Weekly conversations': 'weeklyConversations',
    Performance: 'performance',
    Triggers: 'triggers', 'Weekly triggers': 'weeklyTriggers', Sessions: 'sessions',
  };
  // Monthly tab name → its weekly twin. bucketTable() below picks between them off the current mode, so each
  // draw* function names the monthly tab once and stays bucket-agnostic.
  const WEEKLY_TWIN = {
    Themes: 'Weekly themes', Subthemes: 'Weekly subthemes', Top: 'Weekly top', Risks: 'Weekly risks', Signals: 'Weekly signals',
    Profile: 'Weekly profile', 'Quiet interests': 'Weekly quiet', Hourly: 'Weekly hourly',
    Belonging: 'Weekly belonging', Conversations: 'Weekly conversations',
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
      'bel.needs': 'Cosa renderebbe tutto questo misurabile',
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
      'tile.active': 'Rapporto di attività',
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
      // Range and new sections
      'range.title': 'Quanta storia mostrano i grafici nel tempo',
      'range.w1': 'Ultima settimana', 'range.w8': '8 settimane', 'range.m6': '6 mesi', 'range.all': 'Tutto', 'range.custom': 'Personalizzato',
      'sec.layers': 'Quattro livelli: mostrato, usato, fatto, ricevuto',
      'layers.lede': 'Ciò che il feed ti ha mostrato è soprattutto una scelta dell’algoritmo; ciò che ne hai fatto è tuo. Il cruscotto tiene separate le due cose, e aggiunge ciò che hai fatto verso le persone e ciò che loro hanno fatto in risposta.',
      'sec.trends': 'Nel tempo',
      'sec.account': 'Il tuo profilo, come lo incontrano gli altri',
      'sec.profile': 'Ciò che fai, e ciò che ti viene mostrato',
      'bel.lede': 'Quattro elementi di cui è fatta l’appartenenza. Un export Instagram ne misura due, ne raggiunge un terzo solo in modo indiretto ed è muto sul quarto — quella riga lo dichiara invece di sparire, perché una riga assente si legge come "niente da segnalare", che è l’opposto della verità.',
      'tile.active.sub': 'like, salvataggi, commenti, follow e ricerche per elemento',
      'table.view': 'Vista tabella',
      'word.week': 'settimana', 'word.month': 'mese',
      // Layers
      'layer.exposure': 'Esposizione', 'layer.exposure.sub': 'Ciò che ti ha raggiunto',
      'layer.consumption': 'Comportamento di consumo', 'layer.consumption.sub': 'Come l’hai usato',
      'layer.social': 'Comportamento sociale', 'layer.social.sub': 'Ciò che hai fatto verso le persone',
      'layer.inbound': 'In entrata', 'layer.inbound.sub': 'Ciò che le persone hanno fatto verso di te',
      'lc.items': 'Post e video mostrati', 'lc.stories': 'Storie viste', 'lc.rec': 'Da account che non segui',
      'lc.ads': 'Inserzioni, quota del mostrato', 'lc.min': 'Minuti al giorno', 'lc.sessions': 'Sessioni al giorno',
      'lc.saved': 'Salvati per dopo', 'lc.links': 'Link aperti', 'lc.self': 'Visione scelta da te',
      'lc.likes': 'Like', 'lc.comments': 'Commenti scritti', 'lc.sent': 'Messaggi inviati',
      'lc.started': 'Conversazioni avviate da te', 'lc.posted': 'Post, storie e reel',
      'lc.received': 'Messaggi ricevuti', 'lc.replyrate': 'Tuoi turni con risposta', 'lc.theirwait': 'Loro risposta mediana, minuti',
      'lc.followers': 'Follower',
      // Over time
      'tr.items': 'Elementi mostrati al giorno', 'tr.rec': 'Quota consigliata', 'tr.ads': 'Carico di inserzioni',
      'tr.min': 'Minuti al giorno', 'tr.late': 'Quota notturna', 'tr.self': 'Visione scelta da te',
      'tr.acts': 'Atti sociali', 'tr.comments': 'Commenti scritti', 'tr.sent': 'Messaggi inviati',
      'tr.received': 'Messaggi ricevuti', 'tr.replyrate': 'Tuoi turni con risposta', 'tr.theirwait': 'Loro risposta mediana, minuti',
      'tr.weekof': 'settimana del', 'tr.nodata': 'nessun dato', 'tr.gap': 'Nessun export copre questo periodo.',
      'tr.notviewed': 'Fuori dalla cronologia di visualizzazione conservata da Instagram.',
      'tr.partial': 'Parziale: meno di metà del periodo ha una cronologia di visualizzazione.',
      'tr.usual': 'Il tuo intervallo abituale: {lo} – {hi}', 'tr.outside': 'Fuori dal tuo intervallo abituale.',
      'tr.click': 'Clicca per aprire la panoramica di questo periodo.',
      'tr.byday': 'per giorno', 'tr.byweek': 'per settimana', 'tr.bymonth': 'per mese',
      'tr.key.gap': 'vuoto = nessun export', 'tr.key.day': 'i giorni fuori dalla cronologia di visualizzazione restano vuoti',
      'tr.key.hollow': 'vuoto al centro = settimana parziale', 'tr.key.band': 'fascia = il tuo intervallo abituale',
      'tr.key.ring': 'anello = fuori da esso', 'tr.key.post': 'hai pubblicato', 'tr.key.follow': '3+ follow o unfollow',
      'tr.weeklyonly': 'Contati per settimana, non per giorno — allarga l’intervallo per vederli.',
      'tr.period': 'Periodo',
      'heat.h': 'Temi nel tempo', 'heat.seen': 'Mostrati', 'heat.chosen': 'Scelti',
      'heat.day': 'I temi si contano per settimana — allarga l’intervallo per vederli nel tempo.',
      'heat.note.seen': 'Quota degli elementi mostrati che portano ciascun tema. Più scuro = più feed.',
      'heat.note.chosen': 'Quota delle tue azioni pesate (ricerche e commenti 3, salvataggi e follow 2, like 1) che portano ciascun tema. Una settimana con poche azioni oscilla molto.',
      // Your account
      'perf.lede': 'I numeri di Instagram sul tuo profilo. Ogni punto è un totale dei 90 giorni che finiscono quel giorno, quindi due punti a una settimana di distanza condividono 83 giorni: si muovono lentamente e non vanno mai sommati. I punti vuoti sono ricavati dal "% rispetto ai 90 giorni precedenti" di Instagram stesso.',
      'perf.key': 'Pieno: come riportato · vuoto e tratteggiato: ricavato · ▼ la tua ultima storia · punto scuro con l’anello: la finestra che termina nel periodo aperto in Panoramica. "rispetto a una settimana prima" è la settimana entrata nella finestra meno quella uscita, 13 settimane fa — non questa settimana da sola.',
      'perf.story': 'La tua ultima storia in questi export: {d}. Le interazioni con le storie in queste finestre vengono da lei e da quelle precedenti; da circa il {r} i 90 giorni non la includono più e, senza una nuova, scendono a zero. Leggi un calo di copertura e interazioni alla luce di questo prima di leggerlo come un pubblico che si allontana.',
      'perf.nogap': 'Nessun export copre queste settimane.',
      'perf.tip.rep': 'Come riportato nell’export del {d}.',
      'perf.tip.work': 'Ricavato dall’export del {d}: il suo valore ÷ (1 + il suo "% rispetto al periodo precedente"), arrotondato.',
      'perf.same': 'come una settimana prima', 'perf.vs': 'rispetto a una settimana prima',
      'perf.countries': 'Paesi', 'perf.cities': 'Città', 'perf.ages': 'Età', 'perf.gender': 'Uomini · donne',
      'perf.then': 'Follower allora', 'perf.now': 'Follower ora', 'perf.window': '90 giorni al',
      'perf.reported': 'riportato', 'perf.worked': 'ricavato',
      'perf.level': 'numero nel giorno', 'perf.unique': 'account unici in 90 giorni', 'perf.sum': 'totale su 90 giorni',
      'perf.eng': 'account che hanno interagito ÷ raggiunti', 'perf.visit': 'visite al profilo ÷ raggiunti',
      'perf.nonf': 'della copertura, da non follower',
      // Feeling
      'tone.shown': 'Mostrato a te', 'tone.yours': 'Le tue parole', 'tone.theirs': 'Parole per te',
      'emo.h.yours': 'Tono dei tuoi commenti e messaggi scritti · ogni 100',
      'emo.h.theirs': 'Tono dei messaggi scritti che hai ricevuto · ogni 100',
      'emo.blank': 'Troppo poco testo scritto per leggerne il tono in questa {p}: {n} messaggi o commenti, ne servono {m}. I vocali non contengono testo.',
      // Profile strips and influence
      'strips.do': 'Ciò che fai · personalità e bisogni, dal comportamento',
      'strips.shown': 'Ciò che ti è stato mostrato · la dieta del feed',
      'strips.big5': 'Personalità · Big Five', 'strips.needs': 'Bisogni · Teoria dell’autodeterminazione',
      'strips.thin': 'n={n} · troppo pochi',
      'strips.key': 'Ogni striscia va da 0 a 100. Punti grigi: ogni altra {p} registrata. Punto scuro con l’anello: questa {p}. n: su quanti eventi poggia il punteggio; con meno di {m} resta vuoto invece di essere indovinato. Passa sopra una riga per la sua formula.',
      'infl.h': 'Il feed e te · quota di ciò che ti è stato mostrato contro quota di ciò che hai scelto',
      'db.seen': 'quota di ciò che ti è stato mostrato', 'db.chosen': 'quota di ciò che hai scelto',
      'db.of.seen': 'di ciò che ti è stato mostrato', 'db.of.chosen': 'di ciò che hai scelto',
      'infl.n': 'Lato "scelto" costruito da {n} azioni con un tema in questa {p} — ricerche e commenti contano 3, salvataggi e follow 2, like 1.',
      'infl.dir': 'Direzione, su {w} settimane: quando il feed ti ha mostrato più di un tema, le tue azioni su quel tema la settimana dopo si sono mosse con r = {f}; quando hai agito di più su un tema, il feed te ne ha mostrato di più la settimana dopo con r = {y}. È una correlazione, non una prova di causa.',
      'infl.wait': 'In quale verso va l’influenza — il feed che guida te, o tu che guidi il feed — richiede {need} settimane consecutive utilizzabili; finora {have}.',
      'lw.behaviour': 'dal comportamento', 'lw.exposure': 'da ciò che ti è stato mostrato', 'lw.social': 'dalle tue parole',
      'lw.inbound': 'da ciò che ti hanno scritto', 'lw.influence': 'il feed contro le tue scelte',
      // Quiet interests and conversations
      'quiet.follow': 'li segui', 'quiet.unfollowed': 'hai smesso di seguirli — ti vengono ancora mostrati', 'quiet.notfollowed': 'non seguiti',
      'conv.h': 'Conversazioni · chi ha scritto, chi ha risposto, in quanto tempo',
      'conv.note': 'Solo conteggi e tempi. Il testo dei messaggi viene letto per valutarne il tono e non viene mai salvato.',
      'conv.person': 'Persona', 'conv.msgs': 'Inviati · ricevuti', 'conv.convs': 'Conversazioni (avviate da te)',
      'conv.yours': 'Tuoi turni con risposta', 'conv.theirs': 'Loro turni a cui hai risposto', 'conv.wait': 'Risposta mediana: loro · tu',
      'conv.voice': 'vocali',
      // Tabs, motion, overview
      'tab.overview': 'Panoramica', 'tab.time': 'Nel tempo', 'tab.triggers': 'Fattori', 'tab.feed': 'Il tuo feed',
      'tab.you': 'Tu', 'tab.people': 'Persone e profilo', 'tab.wellbeing': 'Benessere',
      'motion.title': 'Animazioni sì o no', 'motion.off': 'Disattiva le animazioni', 'motion.on': 'Attiva le animazioni',
      'sec.stood': 'Cosa è saltato all’occhio', 'ov.signals': 'Cosa tenere d’occhio', 'ov.signals.all': 'Tutti i segnali →',
      'stood.unusual': 'Insolito', 'stood.usual': 'di solito',
      'stood.higher': 'Più alto del solito: fuori da ciò che hanno coperto i periodi recenti.',
      'stood.lower': 'Più basso del solito: fuori da ciò che hanno coperto i periodi recenti.',
      'stood.trigger': 'Fattore forte', 'stood.trigger.some': 'Fattore',
      'stood.trigger.why': 'Sull’intervallo mostrato. Un’associazione, non una causa.',
      'stood.worse': 'Peggiorato', 'stood.rising': 'In crescita', 'stood.rising.stat': '+{n} punti del tuo feed rispetto al periodo prima',
      'stood.rising.why': 'Una quota più grande di ciò che ti è stato mostrato rispetto a prima.',
      'stood.changed': 'Cambiato', 'stood.reply.why': 'Quanto spesso ciò che scrivi riceve risposta entro un giorno.',
      'stood.none': 'Niente fuori dal tuo intervallo abituale in questa {p}, nessun fattore con abbastanza prove e nessun rischio in peggioramento.',
      'stood.go.time': 'Nel tempo →', 'stood.go.triggers': 'Fattori →', 'stood.go.feed': 'Il tuo feed →',
      'stood.go.people': 'Persone e profilo →', 'stood.go.wellbeing': 'Benessere →',
      'sec.diet': 'La dieta del feed', 'sec.you': 'Personalità, bisogni e influenza', 'sec.method': 'Come si calcola ciascun indicatore',
      'sec.close': 'Chi ti è vicino',
      'strips.key.short': 'Punti grigi: ogni altro periodo registrato; il punto scuro: questo. Da 0 a 100.',
      'well.method': 'Come si calcola ogni numero qui (METHODOLOGY) →',
      // Context triggers
      'sec.triggers': 'Cosa viene subito prima di ciò che fai',
      'trig.lede': 'In quali condizioni apri l’app, ci resti a lungo, agisci su ciò che vedi, cerchi qualcosa o scrivi a qualcuno — letto da ciò che è venuto subito prima. Sono associazioni, non cause: dicono cosa va insieme, non cosa provoca cosa.',
      'trig.empty': 'Qui non c’è ancora nulla: le sessioni e i loro contesti si calcolano durante l’elaborazione. Nel Foglio, usa Instagram Insights → Rielabora tutto.',
      'trig.scope': '{range}: {s} sessioni e {i} elementi visti, su {b} {unit}. Associazioni, non cause.',
      'trig.months': 'mesi', 'trig.weeks': 'settimane',
      'trig.top': 'Ciò che spicca', 'trig.damp': 'Meno spesso del solito',
      'trig.none': 'Per ora non spicca nulla: nessun contesto sposta questi comportamenti di un quarto o più con abbastanza eventi alle spalle. Allarga l’intervallo per avere più prove.',
      'trig.when': 'In questo contesto', 'trig.usual': 'Il tuo ritmo abituale', 'trig.perhour': 'all’ora',
      'trig.n.pull': '{h} aperture in {e} ore libere', 'trig.n': '{h} su {e} {u}',
      'trig.u.sessions': 'sessioni', 'trig.u.items': 'elementi visti',
      'trig.tier.strong': 'Prove solide', 'trig.tier.some': 'Qualche prova', 'trig.tier.few': 'Troppo pochi per dirlo',
      'trig.matrix.h': 'Contesto × comportamento', 'trig.notheme': 'Nessun tema riconosciuto',
      'trig.key': 'Arancione: succede più spesso del tuo ritmo abituale in quel contesto · grigio-blu: meno spesso · grigio: più o meno uguale · punto: troppo pochi eventi per dirlo · bordo tratteggiato: qualche prova (3–9 eventi), pieno: prove solide (10+). Avvicinato al "solito" in proporzione, così una manciata di eventi non sembra mai uno schema.',
      'trig.f.time': 'Quando', 'trig.f.before': 'Cosa è venuto subito prima', 'trig.f.screen': 'Cosa c’era sullo schermo',
      'trig.f.opening': 'Come è iniziata la sessione', 'trig.f.phase': 'Quanto dentro la sessione',
      'trig.t.outcome': 'Comportamento', 'trig.t.dim': 'Contesto', 'trig.t.counts': 'Conteggi', 'trig.t.rate': 'Ritmo',
      'trig.t.usual': 'Abituale', 'trig.t.lift': 'Rapporto', 'trig.t.tier': 'Prove',
      'trig.starts.h': 'Quando apri l’app', 'trig.starts.cell': '{d} {h}:00 · {n} sessioni iniziate',
      'trig.open.h': 'Su cosa si apre',
      'trig.open.note': '{m} sessioni su {n} sono iniziate entro 10 minuti dall’arrivo di un messaggio, {p} entro un’ora da un tuo post, e {q} sono state ritorni rapidi — di nuovo dentro entro 30 minuti dalla precedente.',
      'trig.dots.h': 'Cosa ti tiene a scorrere', 'trig.dots.by': 'Raggruppa per',
      'trig.by.format': 'Formato iniziale', 'trig.by.source': 'Account iniziali', 'trig.by.tone': 'Tono iniziale', 'trig.by.part': 'Momento del giorno',
      'trig.dots.nothing': 'Aperta su messaggi o ricerca', 'trig.dots.sub': '{n} sessioni · mediana {m} min · {l} lunghe',
      'trig.dots.long': 'lunga: {m}+ min',
      'trig.dots.tip': '{i} post e video, {st} storie, {a} inserzioni · aperta su {o}{p}', 'trig.dots.msg': ', dopo un messaggio',
      'trig.dots.acts': 'azioni', 'trig.dots.searches': 'ricerche', 'trig.dots.sent': 'messaggi inviati',
      'trig.dots.note': 'Ogni punto è una sessione; il trattino corto su ogni riga è la sua mediana, la linea tratteggiata segna il quarto più lungo di tutte le sessioni mostrate. Inizio = i primi cinque minuti. Le sessioni oltre {m} min stanno sul bordo destro.',
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

  // ── Time range ───────────────────────────────────────────────────────────────────────────────────────
  // The range scopes the "over time" and "your account" sections; the period picker scopes the snapshot
  // sections. Granularity follows the range rather than the Weekly/Monthly switch: a week is drawn by day,
  // eight weeks or six months by week, and anything longer than about fourteen months by month.
  const DAY_MS = 86400000;
  const dayMs = s => Date.parse(s + 'T12:00:00Z');
  const isoDay = t => new Date(t).toISOString().slice(0, 10);
  const addDays = (s, k) => isoDay(dayMs(s) + k * DAY_MS);
  const mondayOf = s => addDays(s, 1 - (new Date(dayMs(s)).getUTCDay() || 7));
  let range = 'w8';
  let customFrom = '';
  let customTo = '';
  let heatMode = 'seen';
  let toneMode = 'shown';
  try {
    const saved = JSON.parse(localStorage.getItem('ii-range') || 'null');
    if (saved && /^(w1|w8|m6|all|custom)$/.test(saved.range)) {
      range = saved.range;
      customFrom = saved.from || '';
      customTo = saved.to || '';
    }
  } catch (e) { /* blocked storage: the default range stands */ }

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
    initMotion();
    wireTabs();
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
    syncControls();
    drawLog();
    view = { row: row, before: before, coverage: coverage, span: span };
    // Only the tab on screen is drawn; the others are marked stale and draw when they are next shown. A period or
    // range change re-renders the visible tab in place, faded briefly so the change reads as a change.
    drawn = {};
    const panel = $('#panel-' + tab);
    const swap = motionOn() && panel && !panel.hidden && panel.dataset.ever === '1';
    if (swap) panel.classList.add('is-stale');
    showTab(tab, { quiet: true });
    if (swap) requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.remove('is-stale')));
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────────────────────────────────
  // By question rather than by data source: what happened, how it moved, what sets it off, what you were shown,
  // what you do, who is involved, what to watch. Existing sections were moved into them with their ids intact, so
  // every draw function below is unchanged — a tab is simply the list of them it calls.
  const TABS = ['overview', 'time', 'triggers', 'feed', 'you', 'people', 'wellbeing'];
  const TAB_DRAW = {
    overview: v => { drawHero(v.row, v.coverage, v.span); drawTiles(v.row, v.before); drawStoodOut(v.row, v.before); drawLayers(v.row, v.before); drawTopSignals(); },
    time: () => { drawTrends(); },
    triggers: () => { drawTriggers(); },
    feed: v => { drawThemeDonut(); drawThemes(); drawThemeHighlights(v.row, v.before); drawThemeSlope(v.row, v.before); drawEmotions(); drawStrips(); drawAccounts(); },
    you: () => { drawStrips(); drawInfluence(); drawDaily(); drawHours(); drawProfile(); },
    people: () => { drawPerformance(); drawProfileOfWeek(); drawNetworkPreview(); drawBelonging(); drawConversations(); drawClose(); },
    wellbeing: () => { drawRiskMatrix(); drawRisks(); drawSignals(); drawMethodLink(); },
  };
  let tab = 'overview';
  try {
    const saved = localStorage.getItem('ii-tab');
    if (TABS.indexOf(saved) >= 0) tab = saved;
  } catch (e) { /* blocked storage: start on Overview */ }
  let drawn = {};
  let view = null;

  /** Shows a tab, drawing it first if it is stale; entrance motion plays the first time it is shown after a draw. */
  function showTab(name, opts) {
    opts = opts || {};
    if (TABS.indexOf(name) < 0) name = 'overview';
    const changed = name !== tab;
    tab = name;
    try { localStorage.setItem('ii-tab', name); } catch (e) { /* this visit only */ }
    document.querySelectorAll('#tabs [role="tab"]').forEach(b => {
      const on = b.dataset.tab === name;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    const panel = $('#panel-' + name);
    document.querySelectorAll('.tabpanel').forEach(p => { p.hidden = p !== panel; });
    if (!panel || !view) return;
    const fresh = !drawn[name];
    if (fresh) {
      TAB_DRAW[name](view);
      drawn[name] = true;
    }
    if (motionOn() && (changed || (fresh && panel.dataset.ever !== '1'))) {
      // The entrance plays once per draw of a tab: on its first show and after a period change, not on every visit.
      panel.classList.remove('is-entering', 'play');
      void panel.offsetWidth;
      panel.classList.add('is-entering');
      if (fresh) panel.classList.add('play');
      clearTimeout(panel._playTimer);
      panel._playTimer = setTimeout(() => panel.classList.remove('is-entering', 'play'), 1400);
    }
    panel.dataset.ever = '1';
    if (opts.focus) panel.focus({ preventScroll: true });
    if (opts.scroll) {
      const target = opts.scroll === true ? $('#tabs') : $(opts.scroll);
      if (target) target.scrollIntoView({ behavior: motionOn() ? 'smooth' : 'auto', block: 'start' });
    }
  }

  function wireTabs() {
    const list = $('#tabs');
    if (!list) return;
    const buttons = () => Array.from(list.querySelectorAll('[role="tab"]'));
    buttons().forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
    // Arrow keys move along the tabs and select as they go; Home and End jump to either end (WAI-ARIA tabs).
    list.addEventListener('keydown', e => {
      const all = buttons();
      const i = all.indexOf(document.activeElement);
      if (i < 0) return;
      let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % all.length;
      else if (e.key === 'ArrowLeft') j = (i - 1 + all.length) % all.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = all.length - 1;
      if (j === null) return;
      e.preventDefault();
      all[j].focus();
      all[j].scrollIntoView({ block: 'nearest', inline: 'nearest' });
      showTab(all[j].dataset.tab);
    });
    // Any "go to" link inside a panel switches tab and lands on the section it names.
    document.addEventListener('click', e => {
      const go = e.target.closest && e.target.closest('[data-goto]');
      if (!go) return;
      e.preventDefault();
      showTab(go.dataset.goto, { scroll: go.dataset.target || true });
    });
  }

  // ── Motion ───────────────────────────────────────────────────────────────────────────────────────────
  // Follows the system's reduced-motion setting until the reader chooses, then follows the choice. Every animation
  // in app.css hangs off html[data-motion="on"], so "off" stops all of them at once.
  function motionOn() { return document.documentElement.dataset.motion === 'on'; }
  function initMotion() {
    const reduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    let saved = null;
    try { saved = localStorage.getItem('ii-motion'); } catch (e) { /* no storage: follow the system */ }
    const apply = on => {
      document.documentElement.dataset.motion = on ? 'on' : 'off';
      const b = $('#motion');
      if (b) {
        b.setAttribute('aria-pressed', String(on));
        b.setAttribute('aria-label', on ? t('motion.off', 'Turn animations off') : t('motion.on', 'Turn animations on'));
      }
    };
    apply(saved ? saved === 'on' : !(reduce && reduce.matches));
    if (reduce && reduce.addEventListener) reduce.addEventListener('change', () => {
      let stored = null;
      try { stored = localStorage.getItem('ii-motion'); } catch (e) { /* ignore */ }
      if (!stored) apply(!reduce.matches);
    });
    const btn = $('#motion');
    if (btn) btn.addEventListener('click', () => {
      const on = !motionOn();
      try { localStorage.setItem('ii-motion', on ? 'on' : 'off'); } catch (e) { /* this visit only */ }
      apply(on);
    });
  }

  /** Counts a number up from the value last shown in the same place, when the period changes. */
  const lastShown = {};
  function countTo(node, key, value, format) {
    const from = lastShown[key];
    lastShown[key] = value;
    if (!motionOn() || value === null || from === undefined || from === null || from === value || !isFinite(from)) return;
    const started = performance.now();
    const step = now => {
      const k = Math.min(1, (now - started) / 450);
      const eased = 1 - Math.pow(1 - k, 3);
      node.textContent = k < 1 ? format(from + (value - from) * eased) : format(value);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
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
  // Three readings of the same seven word lists: the captions you were shown (exposure), your own comments and
  // written messages (social behaviour), and the written messages you received (inbound). Voice notes carry no
  // text, so the last two are often blank — and say so rather than drawing zeros.
  const TONES = {
    shown: { framework: /^Emotional tone( · shown)?$/, h: ['emo.h', 'Emotional tone of the captions you were shown · items per 100 seen'] },
    yours: { framework: /^Emotional tone · your words$/, h: ['emo.h.yours', 'Tone of your own comments and written messages · per 100'] },
    theirs: { framework: /^Emotional tone · words to you$/, h: ['emo.h.theirs', 'Tone of the written messages you received · per 100'] },
  };
  function drawEmotions() {
    const box = $('#emotions');
    if (!box) return;
    box.innerHTML = '';
    document.querySelectorAll('#emo-mode button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tone === toneMode)));
    const tone = TONES[toneMode] || TONES.shown;
    $('#emo-h').textContent = tr(tone.h);
    const rows = bucketTable('Profile').filter(p => tone.framework.test(p.Framework));
    if (!rows.length) return;
    if (rows.every(r => numOrNull(r.Score) === null)) {
      const n = numOrNull(rows[0].Evidence) || 0;
      box.appendChild(el('p', { class: 'm', text: t('emo.blank', 'Too little written text to read a tone this {p}: {n} messages or comments, and it takes {m}. Voice notes carry no text.',
        { p: isWeek() ? t('word.week', 'week') : t('word.month', 'month'), n: n, m: MIN_EVIDENCE }) }));
      return;
    }
    const valueOf = name => {
      const found = rows.find(r => r.Dimension === name);
      return found ? numOrNull(found.Score) || 0 : 0;
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
      box.appendChild(el('div', { class: 'emo', title: `${e.name}: ${v} per 100` }, [
        iconSlot,
        el('span', { class: 'emo-n', text: e.name }),
        leftBar,
        rightBar,
        el('span', { class: 'emo-v', text: String(v) }),
      ]));
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
      { k: 'Risk index', label: t('tile.risk', 'Risk index'), f: fmt.int, sub: t('tile.risk.sub', 'out of 100'), worse: 'up', monthOnly: true },
      { k: 'Est. minutes per active day', label: t('tile.min', 'Minutes a day'), f: fmt.one, sub: t('tile.min.sub', 'estimated floor'), worse: 'up' },
      { k: 'Seen per day', label: t('tile.items', 'Items a day'), f: fmt.one, sub: t('tile.items.sub', 'posts and videos'), worse: 'up' },
      { k: 'Active ratio', label: t('tile.active', 'Active ratio'), f: fmt.pct, sub: t('tile.active.sub', 'likes, saves, comments, follows, searches per item'), worse: 'down', kind: 'pct' },
      { k: 'Quiet interests', label: t('tile.quiet', 'Quiet interests'), f: fmt.int, sub: t('tile.quiet.sub', 'seen often, never touched'), worse: 'up' },
      { k: 'Sessions per active day', label: t('tile.sessions', 'Sessions a day'), f: fmt.one, sub: t('tile.sessions.sub', 'times you picked it up'), worse: 'up' },
    ];
    const box = $('#tiles');
    box.innerHTML = '';
    // The sparkline is the bucket and the seven before it, so a tile says where this value sits in its own recent
    // run as well as how it compares with the one bucket before.
    const rows = bucketRows();
    const upto = rows.findIndex(r => r[bucketKey()] === current);
    const recent = rows.slice(Math.max(0, upto - 7), upto + 1);
    tiles.filter(tile => !(tile.monthOnly && isWeek())).forEach(tile => {
      const d = before ? delta(row[tile.k], before[tile.k], tile.kind) : null;
      const cls = d && d.dir !== 'flat' ? (d.dir === tile.worse ? 'worse' : 'better') : 'flat';
      const value = numOrNull(row[tile.k]);
      const v = el('div', { class: 'tile-v', text: tile.f(row[tile.k]) });
      const parts = [
        v,
        el('div', { class: 'tile-k', text: tile.label }),
        el('div', { class: 'tile-s', text: tile.sub }),
      ];
      // With nothing before it there is no comparison to draw, so none is drawn — a placeholder like
      // "first week" is just an empty promise taking up the space a real number will occupy later.
      if (d) parts.push(el('div', { class: 'tile-d ' + cls, text: d.text }));
      const series = recent.map(r => numOrNull(r[tile.k]));
      if (series.filter(x => x !== null).length >= 2) parts.push(CH.spark(series, { label: tile.label }));
      box.appendChild(el('div', { class: 'tile' }, parts));
      countTo(v, 'tile|' + tile.k, value, tile.f);
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
        const cell = el('div', { class: 'cell', title: `${day} ${String(h).padStart(2, '0')}:00 · ${count} items`, style: `--d:${h * 16}ms` });
        if (count) {
          cell.style.background = 'var(--l-consumption)';
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
        el('span', { class: 'm', text: [q['You follow'] === 'Yes' ? t('quiet.follow', 'you follow them')
          : q['You follow'] === 'Unfollowed' ? t('quiet.unfollowed', 'you unfollowed them — still shown to you')
            : t('quiet.notfollowed', 'not followed'), q['Vs previous'], q.Themes].filter(Boolean).join(' · ') }),
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

  const LAYER_WORD = {
    Behaviour: ['lw.behaviour', 'from behaviour'], Exposure: ['lw.exposure', 'from what you were shown'],
    Social: ['lw.social', 'from your own words'], Inbound: ['lw.inbound', 'from what people sent you'],
    Influence: ['lw.influence', 'the feed against your choices'],
  };
  function drawProfile() {
    const rows = bucketTable('Profile').filter(p => !/Emotional tone/i.test(p.Framework));
    const box = $('#profile');
    box.innerHTML = '';
    if (!rows.length) return;
    box.appendChild(el('h3', { class: 'sub', text: t('profile.how', 'How each of these is computed') }));
    rows.forEach(p => {
      const change = numOrNull(p.Previous) === null ? '' : ` · ${t('was', 'was')} ${fmt.int(p.Previous)}`;
      const layer = LAYER_WORD[p.Layer] ? tr(LAYER_WORD[p.Layer]) : '';
      const ev = numOrNull(p.Evidence) === null ? '' : ` · n=${fmt.int(p.Evidence)}`;
      box.appendChild(el('div', { class: 'method' }, [
        el('span', { class: 'method-v', text: numOrNull(p.Score) === null ? '—' : fmt.int(p.Score) }),
        el('div', {}, [
          el('b', { text: String(p.Dimension).split('·')[0].trim() }),
          el('span', { class: 'method-h', text: p['How it is computed'] + change + (layer ? ' · ' + layer : '') + ev }),
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

  /** The three most pressing signals, on the Overview; the full list stays on Wellbeing. */
  function drawTopSignals() {
    const box = $('#ov-signals');
    if (!box) return;
    box.innerHTML = '';
    const order = { '🔴 Alert': 0, '⚠️ Watch': 1, 'ℹ️ Info': 2, '✅ OK': 3 };
    const rank = s => (order[s.Level] === undefined ? 4 : order[s.Level]);
    bucketTable('Signals').sort((a, b) => rank(a) - rank(b)).slice(0, 3).forEach(s => box.appendChild(el('div', { class: 'signal' }, [
      el('span', { class: 'signal-l', text: s.Level }),
      el('div', {}, [
        el('div', { class: 'signal-n' }, [el('b', { text: s.Signal }), el('span', { class: 'signal-v', text: String(s.Value) })]),
        el('div', { class: 'signal-m', text: s['What it means'] }),
      ]),
    ])));
    $('#ov-signals-panel').hidden = !box.children.length;
  }

  // ── What stood out ─────────────────────────────────────────────────────────────────────────────────────
  // At most four highlights, each a single fact with a way to its evidence: a measure outside your usual range,
  // the strongest trigger in the range shown, the risk that worsened most, a theme that rose, a change in how often
  // you are answered. Highlight styling (layer border, tint, badge) is reserved for these and for flagged charts,
  // so it keeps meaning "look here".
  function drawStoodOut(row, before) {
    const box = $('#stood');
    if (!box) return;
    box.innerHTML = '';
    const cards = [];
    const period = isWeek() ? t('word.week', 'week') : t('word.month', 'month');

    // Measures outside the usual range of the buckets before this one (the same band the charts over time shade).
    const rows = bucketRows();
    const k = rows.findIndex(r => r[bucketKey()] === current);
    const unusual = [];
    TREND_LAYERS.forEach(layer => layer.metrics.forEach(m => {
      const values = rows.map(r => (m.calc ? m.calc(r) : numOrNull(r[m.key])));
      const hollow = rows.map(r => !!m.view && r.Coverage !== '' && +r.Coverage < MIN_TREND_COVERAGE);
      const band = usualRange(values, hollow, k);
      const v = values[k];
      if (!band || v === null || hollow[k] || (v >= band[0] && v <= band[1])) return;
      const width = Math.max(band[1] - band[0], Math.abs(band[1]) * 0.1, 1e-6);
      unusual.push({ m: m, layer: layer.id, v: v, band: band, up: v > band[1], dist: (v > band[1] ? v - band[1] : band[0] - v) / width });
    }));
    unusual.sort((a, b) => b.dist - a.dist).slice(0, 2).forEach(u => {
      const f = fmtBy(u.m.f);
      cards.push({
        layer: u.layer, badge: t('stood.unusual', 'Unusual'), pulse: true, title: tr(u.m.label),
        stat: `${f(u.v)} · ${t('stood.usual', 'usually')} ${f(u.band[0])}–${f(u.band[1])}`,
        why: u.up ? t('stood.higher', 'Higher than usual: outside what recent {p}s covered.', { p: period })
          : t('stood.lower', 'Lower than usual: outside what recent {p}s covered.', { p: period }),
        goto: 'time',
      });
    });

    const scope = triggerScope();
    const top = scope ? rankTriggers(scope.rows).triggers[0] : null;
    if (top) {
      cards.push({
        layer: TRIG_LAYER[top.outcome], badge: top.tier === 'strong' ? t('stood.trigger', 'Strong trigger') : t('stood.trigger.some', 'Trigger'),
        title: triggerSentence(top), stat: `${liftText(top.lift)} · ${countText(top)}`,
        why: t('stood.trigger.why', 'Over the range shown. An association, not a cause.'), goto: 'triggers',
      });
    }

    const worse = bucketTable('Risks').filter(r => /^▲/.test(String(r.Trend)))
      .map(r => ({ r: r, up: +(String(r.Trend).match(/\d+/) || [0])[0] })).sort((a, b) => b.up - a.up)[0];
    if (worse) {
      cards.push({
        layer: 'risk', badge: t('stood.worse', 'Worse'), title: worse.r.Risk,
        stat: `${worse.r.Score} · ${worse.r.Trend}`, why: worse.r.Evidence, goto: 'wellbeing',
      });
    }
    if (row['Emerging theme']) {
      cards.push({
        layer: 'exposure', badge: t('stood.rising', 'Rising'), title: row['Emerging theme'],
        stat: t('stood.rising.stat', '+{n} pts of your feed vs last {p}', { n: (100 * +row['Emerging change']).toFixed(1), p: period }),
        why: t('stood.rising.why', 'A bigger share of what you were shown than it held before.'), goto: 'feed',
      });
    }
    const now = before ? numOrNull(row['Reply rate to you']) : null;
    const then = before ? numOrNull(before['Reply rate to you']) : null;
    if (now !== null && then !== null && Math.abs(now - then) >= 0.15) {
      cards.push({
        layer: 'inbound', badge: t('stood.changed', 'Changed'), title: t('lc.replyrate', 'Your turns answered'),
        stat: `${fmt.pct(then)} → ${fmt.pct(now)}`,
        why: t('stood.reply.why', 'How often what you write gets an answer within a day.'), goto: 'people', target: '#sec-belonging',
      });
    }

    cards.slice(0, 4).forEach(c => box.appendChild(el('div', { class: `stood-card is-highlight is-${c.layer}` }, [
      el('span', { class: 'badge' + (c.pulse ? ' is-pulse' : ''), text: c.badge }),
      el('b', { class: 'stood-t', text: c.title }),
      el('span', { class: 'stood-s', text: c.stat }),
      el('span', { class: 'stood-w', text: c.why || '' }),
      el('button', Object.assign({ type: 'button', class: 'link-btn', 'data-goto': c.goto, text: t('stood.go.' + c.goto, TAB_NAME[c.goto] + ' →') },
        c.target ? { 'data-target': c.target } : {})),
    ])));
    if (!cards.length) box.appendChild(el('p', { class: 'mono', text: t('stood.none', 'Nothing outside your usual range this {p}, no trigger with enough behind it, and no risk getting worse.', { p: period }) }));
  }
  const TAB_NAME = { overview: 'Overview', time: 'Over time', triggers: 'Triggers', feed: 'Your feed', you: 'You', people: 'People & account', wellbeing: 'Wellbeing' };

  /** "Who you are close to" holds two panels that can each be empty; with both empty the heading goes too. */
  function drawClose() {
    const sec = $('#sec-close');
    if (sec) sec.hidden = $('#pow').hidden && $('#sec-netprev').hidden;
  }
  function drawMethodLink() {
    const a = $('#method-link');
    if (a) a.href = 'https://github.com/RedHouseLux/instagram-insights/blob/main/' + (lang === 'it' ? 'METHODOLOGY.it.md' : 'METHODOLOGY.md');
  }

  function drawLog() {
    const rows = table('Log').filter(l => l.Month);
    $('#log').textContent = rows.length
      ? `${rows.length} export${rows.length > 1 ? 's' : ''} processed: ` + rows.map(l => l.Month).join(', ')
      : '';
  }

  // ── The four layers ────────────────────────────────────────────────────────────────────────────────────
  // Named once here and reused by the layer cards, the trend grid and the profile strips, so a layer means
  // the same thing wherever it appears (METHODOLOGY.md → The four layers).
  const LAYERS = {
    exposure: { name: ['layer.exposure', 'Exposure'], sub: ['layer.exposure.sub', 'What reached you'] },
    consumption: { name: ['layer.consumption', 'Consumption behaviour'], sub: ['layer.consumption.sub', 'How you used it'] },
    social: { name: ['layer.social', 'Social behaviour'], sub: ['layer.social.sub', 'What you did toward people'] },
    inbound: { name: ['layer.inbound', 'Inbound'], sub: ['layer.inbound.sub', 'What people did toward you'] },
  };
  const tr = pair => t(pair[0], pair[1]);
  const numOrNull = v => (v === '' || v === null || v === undefined || isNaN(v) ? null : +v);
  const fmtBy = kind => (kind === 'pct' ? fmt.pct : kind === 'one' ? fmt.one : fmt.int);
  const sumCols = (row, cols) => cols.reduce((n, c) => n + (numOrNull(row[c]) || 0), 0);

  /** The newest reported account window that had ended by `endDay`, and the one before it. */
  function perfAsOf(endDay) {
    const rows = table('Performance').filter(r => r.Kind === 'Reported' && (!endDay || r['Window end'] <= endDay))
      .sort((a, b) => (a['Window end'] < b['Window end'] ? -1 : 1));
    return { now: rows[rows.length - 1] || null, before: rows[rows.length - 2] || null };
  }

  const LAYER_CARDS = [
    { id: 'exposure', items: [
      { k: 'Items seen', f: 'int', label: ['lc.items', 'Posts and videos shown'] },
      { k: 'Stories seen', f: 'int', label: ['lc.stories', 'Stories viewed'] },
      { k: 'Recommended share', f: 'pct', label: ['lc.rec', 'From accounts you don’t follow'] },
      { k: 'Ad load', f: 'pct', label: ['lc.ads', 'Ads, share of all shown'] },
    ] },
    { id: 'consumption', items: [
      { k: 'Est. minutes per active day', f: 'one', label: ['lc.min', 'Minutes a day'] },
      { k: 'Sessions per active day', f: 'one', label: ['lc.sessions', 'Sessions a day'] },
      { k: 'Saved posts', f: 'int', label: ['lc.saved', 'Saved for later'] },
      { k: 'Links opened', f: 'int', label: ['lc.links', 'Links opened'] },
      { k: 'Self-directed share', f: 'pct', label: ['lc.self', 'Self-directed viewing'] },
    ] },
    { id: 'social', items: [
      { k: 'Liked posts', f: 'int', label: ['lc.likes', 'Likes'] },
      { k: 'Comments written', f: 'int', label: ['lc.comments', 'Comments written'] },
      { k: 'DMs sent', f: 'int', label: ['lc.sent', 'Messages sent'] },
      { k: 'Conversations you started', f: 'int', label: ['lc.started', 'Conversations you started'] },
      { k: '__posted', f: 'int', label: ['lc.posted', 'Posts, stories and reels'], calc: r => sumCols(r, ['Own posts', 'Own stories', 'Own reels']) },
    ] },
    { id: 'inbound', items: [
      { k: 'DMs received', f: 'int', label: ['lc.received', 'Messages received'] },
      { k: 'Reply rate to you', f: 'pct', label: ['lc.replyrate', 'Your turns answered'] },
      { k: 'Their median reply (min)', f: 'int', label: ['lc.theirwait', 'Their median reply, minutes'] },
      { k: '__followers', f: 'int', label: ['lc.followers', 'Followers'], perf: 'Followers' },
    ] },
  ];

  function drawLayers(row, before) {
    const box = $('#layers');
    if (!box) return;
    box.innerHTML = '';
    const bucketEnd = isWeek() ? addDays(row['Week start'], 6) : row['Period end'];
    const beforeEnd = before ? (isWeek() ? addDays(before['Week start'], 6) : before['Period end']) : null;
    LAYER_CARDS.forEach(card => {
      const list = el('div', { class: 'lc-list' });
      card.items.forEach(item => {
        let now;
        let then;
        if (item.perf) {
          const p = perfAsOf(bucketEnd).now;
          const q = beforeEnd ? perfAsOf(beforeEnd).now : null;
          now = p ? numOrNull(p[item.perf]) : null;
          then = q && p && q['Window end'] !== p['Window end'] ? numOrNull(q[item.perf]) : null;
        } else {
          now = item.calc ? item.calc(row) : numOrNull(row[item.k]);
          then = before ? (item.calc ? item.calc(before) : numOrNull(before[item.k])) : null;
        }
        const d = now !== null && then !== null ? delta(now, then, item.f === 'pct' ? 'pct' : '') : null;
        list.appendChild(el('div', { class: 'lc-item' }, [
          el('span', { class: 'lc-v', text: now === null ? '—' : fmtBy(item.f)(now) }),
          el('span', { class: 'lc-k', text: tr(item.label) }),
          d ? el('span', { class: 'lc-d', text: d.text }) : el('span', {}),
        ]));
      });
      box.appendChild(el('div', { class: 'lc lc-' + card.id }, [
        el('div', { class: 'lc-h' }, [
          el('b', { text: tr(LAYERS[card.id].name) }),
          el('span', { text: tr(LAYERS[card.id].sub) }),
        ]),
        list,
      ]));
    });
  }

  // ── Over time ─────────────────────────────────────────────────────────────────────────────────────────
  // Each metric belongs to one layer; `view` marks the ones built from viewing history, which are the only
  // ones a partial week makes shaky (a week with two days of view history still has all seven days of messages).
  const TREND_LAYERS = [
    { id: 'exposure', metrics: [
      { key: 'Seen per day', label: ['tr.items', 'Items shown a day'], f: 'one', view: true, day: d => +d['Items seen'] },
      { key: 'Recommended share', label: ['tr.rec', 'Recommended share'], f: 'pct', view: true },
      { key: 'Ad load', label: ['tr.ads', 'Ad load'], f: 'pct', view: true },
    ] },
    { id: 'consumption', metrics: [
      { key: 'Est. minutes per active day', label: ['tr.min', 'Minutes a day'], f: 'one', view: true, day: d => +d['Est. minutes'] },
      { key: 'Late-night share', label: ['tr.late', 'Late-night share'], f: 'pct', view: true,
        day: d => (+d['Items seen'] ? +d['Late-night items'] / +d['Items seen'] : null) },
      { key: 'Self-directed share', label: ['tr.self', 'Self-directed viewing'], f: 'pct', view: true },
    ] },
    { id: 'social', metrics: [
      { key: '__acts', label: ['tr.acts', 'Social acts'], f: 'int',
        calc: r => sumCols(r, ['Liked posts', 'Liked comments', 'Comments written', 'Story likes', 'DMs sent', 'New follows']) },
      { key: 'Comments written', label: ['tr.comments', 'Comments written'], f: 'int' },
      { key: 'DMs sent', label: ['tr.sent', 'Messages sent'], f: 'int' },
    ] },
    { id: 'inbound', metrics: [
      { key: 'DMs received', label: ['tr.received', 'Messages received'], f: 'int' },
      { key: 'Reply rate to you', label: ['tr.replyrate', 'Your turns answered'], f: 'pct' },
      { key: 'Their median reply (min)', label: ['tr.theirwait', 'Their median reply, minutes'], f: 'int' },
    ] },
  ];

  /** The periods the current range covers, oldest first, each with the row that fills it (or null: a gap). */
  function trendPeriods() {
    const byWeek = {};
    table('Weekly').filter(w => w['Week start']).forEach(w => { byWeek[w['Week start']] = w; });
    const byMonth = {};
    table('Monthly').forEach(m => { byMonth[m.Month] = m; });
    const daily = {};
    table('Daily').forEach(d => { if (!daily[d.Date] || d['In view window'] === 'Yes') daily[d.Date] = d; });
    const weekStarts = Object.keys(byWeek).sort();
    const monthKeys = Object.keys(byMonth).sort();
    const lastMonthDay = m => isoDay(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0, 12));
    const firstDay = weekStarts[0] || (monthKeys[0] ? monthKeys[0] + '-01' : null);
    const lastDay = weekStarts.length ? addDays(weekStarts[weekStarts.length - 1], 6)
      : monthKeys.length ? lastMonthDay(monthKeys[monthKeys.length - 1]) : null;
    if (!firstDay) return null;
    let from;
    let to;
    let unit;
    if (range === 'custom' && customFrom && customTo) {
      from = customFrom < customTo ? customFrom : customTo;
      to = customFrom < customTo ? customTo : customFrom;
      const span = (dayMs(to) - dayMs(from)) / DAY_MS + 1;
      unit = span <= 14 ? 'day' : span <= 190 ? 'week' : 'month';
    } else if (range === 'w1') {
      unit = 'day';
      from = mondayOf(lastDay);
      to = addDays(from, 6);
    } else {
      unit = 'week';
      to = lastDay;
      from = range === 'w8' ? addDays(mondayOf(lastDay), -49) : range === 'm6' ? addDays(mondayOf(lastDay), -175) : firstDay;
      // A preset never reaches back past the first export: weeks before any data existed are not gaps in it.
      if (from < firstDay) from = firstDay;
      if ((dayMs(to) - dayMs(from)) / DAY_MS > 7 * 60) unit = 'month';
    }
    if (unit === 'week' && !weekStarts.length) unit = 'month';
    const points = [];
    if (unit === 'day') {
      for (let d = from; d <= to; d = addDays(d, 1)) points.push({ key: d, start: d, row: daily[d] || null });
    } else if (unit === 'week') {
      for (let w = mondayOf(from); w <= to; w = addDays(w, 7)) points.push({ key: w, start: w, row: byWeek[w] || null });
    } else {
      let m = from.slice(0, 7);
      while (m <= to.slice(0, 7)) {
        points.push({ key: m, start: m + '-01', row: byMonth[m] || null });
        const next = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 1));
        m = next.toISOString().slice(0, 7);
      }
    }
    return { unit: unit, from: from, to: to, points: points };
  }

  function periodLabel(p, unit) {
    if (unit === 'month') return fmt.month(p.key);
    const d = new Date(dayMs(p.start));
    const text = d.toLocaleString(locale(), { day: 'numeric', month: 'short', timeZone: 'UTC' });
    return unit === 'week' ? t('tr.weekof', 'week of') + ' ' + text : text;
  }

  function metricValue(m, p, unit) {
    const r = p.row;
    if (!r) return null;
    if (unit === 'day') {
      if (!m.day || r['In view window'] !== 'Yes') return null;
      const v = m.day(r);
      return v === null || isNaN(v) ? null : v;
    }
    return m.calc ? m.calc(r) : numOrNull(r[m.key]);
  }

  /** What the previous (up to) eight usable periods covered, leaving out the single highest and lowest once
   * there are six or more of them. Null until there are four — a "usual range" of two weeks is not one. */
  function usualRange(values, hollow, k) {
    const prior = [];
    for (let j = k - 1; j >= 0 && prior.length < 8; j--) if (values[j] !== null && !hollow[j]) prior.push(values[j]);
    if (prior.length < 4) return null;
    const sorted = prior.slice().sort((a, b) => a - b);
    return sorted.length >= 6 ? [sorted[1], sorted[sorted.length - 2]] : [sorted[0], sorted[sorted.length - 1]];
  }

  function pickPeriod(p, unit) {
    if (!p.row) return;
    if (unit === 'month') { mode = 'month'; current = p.row.Month; }
    else {
      const week = unit === 'week' ? p.row : table('Weekly').find(w => w['Week start'] === mondayOf(p.key));
      if (!week) return;
      mode = 'week';
      current = week.Week;
    }
    try { window.localStorage.setItem('insights-bucket', mode); } catch (e) { /* not worth failing over */ }
    render();
    // A point on a chart over time opens that period's overview: the snapshot it summarises.
    showTab('overview', { scroll: '#hero' });
  }

  function trendCard(m, tp) {
    const unit = tp.unit;
    const values = tp.points.map(p => metricValue(m, p, unit));
    const hollow = tp.points.map(p => unit !== 'day' && m.view && p.row && p.row.Coverage !== ''
      && +p.row.Coverage < MIN_TREND_COVERAGE);
    const points = tp.points.map((p, k) => {
      const band = unit === 'day' ? null : usualRange(values, hollow, k);
      const v = values[k];
      return {
        x: k, v: v, hollow: hollow[k], band: band,
        flag: !!band && v !== null && !hollow[k] && (v < band[0] || v > band[1]),
        selected: !!p.row && ((unit === 'week' && isWeek() && p.row.Week === current)
          || (unit === 'month' && !isWeek() && p.row.Month === current)),
      };
    });
    const markers = [];
    if (unit !== 'day') {
      tp.points.forEach((p, k) => {
        if (!p.row) return;
        if (sumCols(p.row, ['Own posts', 'Own stories', 'Own reels']) > 0) markers.push({ x: k, kind: 'post' });
        else if (sumCols(p.row, ['New follows', 'Unfollows']) >= 3) markers.push({ x: k, kind: 'follow' });
      });
    }
    const f = fmtBy(m.f);
    const labelIdx = tp.points.length > 1 ? [0, tp.points.length - 1] : [0];
    const svg = CH.line(points, {
      xMin: 0, xMax: Math.max(1, tp.points.length - 1), fmt: f, markers: markers,
      xLabels: labelIdx.map(k => ({ x: k, text: periodLabel(tp.points[k], unit === 'week' ? 'day' : unit) })),
      label: tr(m.label),
      onLeave: () => tip.hide(),
      onPick: k => pickPeriod(tp.points[k], unit),
      onHover: (k, evt, anchor) => tip.show(card => {
        const p = points[k];
        card.appendChild(el('div', { class: 'tipcard-h' }, [
          el('b', { text: p.v === null ? t('tr.nodata', 'no data') : f(p.v) }),
          el('span', { class: 'tipcard-v', text: periodLabel(tp.points[k], unit) }),
        ]));
        const notes = [];
        if (!tp.points[k].row) notes.push(t('tr.gap', 'No export covers this period.'));
        else if (p.v === null && unit === 'day') notes.push(t('tr.notviewed', 'Outside the viewing history Instagram kept.'));
        if (p.hollow) notes.push(t('tr.partial', 'Partial: less than half of this period has viewing history.'));
        if (p.band) notes.push(t('tr.usual', 'Your usual range: {lo} – {hi}', { lo: f(p.band[0]), hi: f(p.band[1]) }));
        if (p.flag) notes.push(t('tr.outside', 'Outside your usual range.'));
        notes.push(t('tr.click', 'Click to open this period’s overview.'));
        notes.forEach(text => card.appendChild(el('p', { class: 'tipcard-note', text: text })));
      }, evt, anchor),
    });
    // The bucket on screen sitting outside its usual range is the one case a chart over time is highlighted for.
    const odd = points.some(p => p.selected && p.flag);
    return el('div', { class: 'spark' + (odd ? ' is-highlight' : '') }, [
      el('div', { class: 'spark-top' }, [el('h4', { class: 'spark-h', text: tr(m.label) }),
        odd ? el('span', { class: 'badge is-pulse', text: t('stood.unusual', 'Unusual') }) : el('span', {})]),
      svg,
    ]);
  }

  function drawTrends() {
    const box = $('#trends');
    if (!box) return;
    box.innerHTML = '';
    const tp = trendPeriods();
    const sec = $('#sec-trends');
    if (!tp) { sec.hidden = true; return; }
    sec.hidden = false;
    const unitName = { day: t('tr.byday', 'by day'), week: t('tr.byweek', 'by week'), month: t('tr.bymonth', 'by month') }[tp.unit];
    const keyBits = [
      `${unitName} · ${periodLabel({ key: tp.from, start: tp.from }, 'day')} – ${periodLabel({ key: tp.to, start: tp.to }, 'day')}`,
      t('tr.key.gap', 'gap = no export'),
      tp.unit === 'day' ? t('tr.key.day', 'days outside the viewing history are left blank')
        : t('tr.key.hollow', 'hollow = partial week') + ' · ' + t('tr.key.band', 'shading = your usual range') + ' · '
          + t('tr.key.ring', 'ring = outside it') + ' · ▼ ' + t('tr.key.post', 'you posted') + ' · ◆ '
          + t('tr.key.follow', '3+ follows or unfollows'),
    ];
    $('#trend-key').textContent = keyBits.join(' · ');
    const tableCols = [];
    TREND_LAYERS.forEach(layer => {
      const metrics = layer.metrics.filter(m => tp.unit !== 'day' || m.day);
      const head = el('div', { class: 'tl-h' }, [
        el('b', { text: tr(LAYERS[layer.id].name) }),
        el('span', { text: tr(LAYERS[layer.id].sub) }),
      ]);
      const grid = el('div', { class: 'grid-sm' });
      metrics.forEach(m => { grid.appendChild(trendCard(m, tp)); tableCols.push(m); });
      const children = [head, grid];
      if (!metrics.length) {
        children.push(el('p', { class: 'mono', text: t('tr.weeklyonly', 'Counted per week, not per day — widen the range to see these.') }));
      }
      box.appendChild(el('div', { class: 'tl tl-' + layer.id }, children));
    });
    drawThemeHeat(tp);
    drawTrendTable(tp, tableCols);
  }

  function drawTrendTable(tp, cols) {
    const box = $('#trend-table');
    if (!box) return;
    box.innerHTML = '';
    const head = el('tr', {}, [el('th', { text: t('tr.period', 'Period') })].concat(cols.map(m => el('th', { text: tr(m.label) }))));
    const body = tp.points.map(p => el('tr', {}, [el('td', { text: periodLabel(p, tp.unit) })].concat(cols.map(m => {
      const v = metricValue(m, p, tp.unit);
      return el('td', { text: v === null ? '—' : fmtBy(m.f)(v) });
    }))));
    box.appendChild(el('table', { class: 'tv' }, [el('thead', {}, [head]), el('tbody', {}, body)]));
  }

  function drawThemeHeat(tp) {
    const box = $('#theme-heat');
    const note = $('#theme-heat-note');
    if (!box) return;
    box.innerHTML = '';
    document.querySelectorAll('#heat-mode button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.heat === heatMode)));
    if (tp.unit === 'day') {
      note.textContent = t('heat.day', 'Themes are counted per week — widen the range to see them over time.');
      return;
    }
    const rows = tp.unit === 'week' ? table('Weekly themes') : table('Themes');
    const keyCol = tp.unit === 'week' ? 'Week' : 'Month';
    const col = heatMode === 'seen' ? 'Seen share' : 'Action share';
    const keys = tp.points.map(p => (p.row ? p.row[keyCol] : null));
    const cell = (theme, key) => {
      if (!key) return null;
      const r = rows.find(x => x[keyCol] === key && x.Theme === theme);
      return r ? numOrNull(r[col]) : null;
    };
    const themes = Array.from(new Set(rows.filter(r => keys.indexOf(r[keyCol]) >= 0 && r.Theme !== 'Other').map(r => r.Theme)));
    const total = th => keys.reduce((n, k) => n + (cell(th, k) || 0), 0);
    themes.sort((a, b) => total(b) - total(a));
    const max = Math.max(0.0001, ...themes.flatMap(th => keys.map(k => cell(th, k) || 0)));
    const grid = el('div', { class: 'theat', style: `grid-template-columns: minmax(110px, 170px) repeat(${tp.points.length}, 1fr)` });
    grid.appendChild(el('span', {}));
    tp.points.forEach((p, k) => grid.appendChild(el('span', {
      class: 'h', text: k === 0 || k === tp.points.length - 1 || tp.points.length <= 8 ? periodLabel(p, 'day') : '',
    })));
    themes.forEach(th => {
      grid.appendChild(el('span', { class: 'wd', text: th }));
      keys.forEach((k, j) => {
        const v = cell(th, k);
        const c = el('div', { class: 'cell' + (k ? '' : ' is-gap'), style: `--d:${Math.round(400 * j / Math.max(1, keys.length))}ms` });
        c.title = `${th} · ${periodLabel(tp.points[j], tp.unit)}: ${v === null ? '—' : fmt.pct(v)}`;
        if (v) {
          c.style.background = heatMode === 'seen' ? 'var(--l-exposure)' : 'var(--l-consumption)';
          c.style.opacity = (0.15 + 0.85 * Math.sqrt(v / max)).toFixed(2);
        }
        grid.appendChild(c);
      });
    });
    box.appendChild(grid);
    note.textContent = heatMode === 'seen'
      ? t('heat.note.seen', 'Share of the items you were shown that carry each theme. Darker = more of the feed.')
      : t('heat.note.chosen', 'Share of your weighted actions (searches and comments 3, saves and follows 2, likes 1) that carry each theme. A week with few actions swings hard.');
  }

  // ── Your account ─────────────────────────────────────────────────────────────────────────────────────
  const PERF = [
    { key: 'Followers', zero: false, sub: ['perf.level', 'headcount on the day'] },
    { key: 'Accounts reached', sub: ['perf.unique', 'unique accounts in 90 days'] },
    { key: 'Impressions', sub: ['perf.sum', 'total over 90 days'] },
    { key: 'Profile visits', sub: ['perf.sum', 'total over 90 days'] },
    { key: 'Content interactions', sub: ['perf.sum', 'total over 90 days'] },
    { key: 'Accounts engaged', sub: ['perf.unique', 'unique accounts in 90 days'] },
    { key: 'Engagement rate', f: 'pct', sub: ['perf.eng', 'accounts engaged ÷ reached'] },
    { key: 'Profile visit rate', f: 'pct', sub: ['perf.visit', 'profile visits ÷ reached'] },
    { key: 'Non-follower reach share', f: 'pct', sub: ['perf.nonf', 'of reach, from non-followers'] },
  ];
  const PERF_NAMES = {
    it: {
      Followers: 'Follower', 'Accounts reached': 'Account raggiunti', Impressions: 'Impression',
      'Profile visits': 'Visite al profilo', 'Content interactions': 'Interazioni con i contenuti',
      'Accounts engaged': 'Account che hanno interagito', 'Engagement rate': 'Tasso di interazione',
      'Profile visit rate': 'Tasso di visite al profilo', 'Non-follower reach share': 'Copertura da non follower',
    },
  };
  const perfName = k => ((PERF_NAMES[lang] || {})[k] || k);
  const shortDate = s => new Date(dayMs(s)).toLocaleString(locale(), { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const longDate = s => new Date(dayMs(s)).toLocaleString(locale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  function drawPerformance() {
    const sec = $('#sec-account');
    if (!sec) return;
    const all = table('Performance').filter(r => r['Window end'])
      .sort((a, b) => (a['Window end'] < b['Window end'] ? -1 : 1));
    if (!all.length) { sec.hidden = true; return; }
    sec.hidden = false;
    const tp = trendPeriods();
    let rows = all;
    if (tp && range !== 'all') {
      const from = addDays(tp.from, -7);
      const to = addDays(tp.to, 7);
      rows = all.filter(r => r['Window end'] >= from && r['Window end'] <= to);
      // Fewer than three points is not a line. Better the whole record than a lone dot.
      if (rows.length < 3) rows = all;
    }
    const xs = rows.map(r => dayMs(r['Window end']));
    const xMin = Math.min.apply(null, xs);
    const xMax = Math.max.apply(null, xs);
    const reported = all.filter(r => r.Kind === 'Reported');
    const latest = reported[reported.length - 1] || null;
    const lastStory = latest && latest['Last story'] ? String(latest['Last story']) : '';
    const bucketRow = bucketRows().find(r => r[bucketKey()] === current);
    const bucketEnd = bucketRow ? (isWeek() ? addDays(bucketRow['Week start'], 6) : bucketRow['Period end']) : '';
    const bucketStart = bucketRow ? (isWeek() ? bucketRow['Week start'] : bucketRow['Period start']) : '';

    const notes = $('#perf-notes');
    notes.innerHTML = '';
    notes.appendChild(el('p', { class: 'mono perf-key', text: t('perf.key',
      'Solid: as reported · hollow and dashed: worked out · ▼ your last story · dark dot with a ring: the window ending in the period open in Overview. '
      + '"vs a week earlier" is the week that joined the window minus the week that left it, 13 weeks back — not this week on its own.') }));
    if (lastStory) {
      const rollOff = addDays(lastStory, 90);
      notes.appendChild(el('p', { class: 'perf-note', text: t('perf.story',
        'Your last story in these exports: {d}. Story interactions in these windows come from it and the ones before it; from about {r} the 90 days no longer include it, and without a new one they fall to zero. Read a fall in reach and interactions against that before reading it as your audience drifting away.',
        { d: longDate(lastStory), r: longDate(rollOff) }) }));
    }
    const grid = $('#perf');
    grid.innerHTML = '';
    // Windows more than eight days apart are not neighbours: the line breaks there rather than drawing a trend
    // through months nobody exported (the worked-out windows sit thirteen weeks before the first real one).
    const ptRows = [];
    rows.forEach((r, k) => {
      if (k && dayMs(r['Window end']) - dayMs(rows[k - 1]['Window end']) > 8 * DAY_MS) ptRows.push(null);
      ptRows.push(r);
    });
    PERF.forEach(m => {
      const f = fmtBy(m.f || 'int');
      const pts = ptRows.map((r, k) => (r ? {
        x: dayMs(r['Window end']), v: numOrNull(r[m.key]), hollow: r.Kind !== 'Reported', dashed: r.Kind !== 'Reported',
        selected: r.Kind === 'Reported' && !!bucketEnd && r['Window end'] >= bucketStart && r['Window end'] <= bucketEnd,
      } : { x: (dayMs(ptRows[k - 1]['Window end']) + dayMs(ptRows[k + 1]['Window end'])) / 2, v: null }));
      if (!pts.some(p => p.v !== null)) return;
      const markers = lastStory && dayMs(lastStory) >= xMin && dayMs(lastStory) <= xMax ? [{ x: dayMs(lastStory), kind: 'post' }] : [];
      const svg = CH.line(pts, {
        xMin: xMin, xMax: xMax, zero: m.zero !== false, fmt: f, markers: markers,
        xLabels: [{ x: xMin, text: shortDate(rows[0]['Window end']) }, { x: xMax, text: shortDate(rows[rows.length - 1]['Window end']) }],
        label: perfName(m.key),
        onLeave: () => tip.hide(),
        onHover: (k, evt, anchor) => tip.show(card => {
          const r = ptRows[k];
          if (!r) { card.appendChild(el('p', { class: 'tipcard-note', text: t('perf.nogap', 'No export covers these weeks.') })); return; }
          card.appendChild(el('div', { class: 'tipcard-h' }, [
            el('b', { text: pts[k].v === null ? '—' : f(pts[k].v) }),
            el('span', { class: 'tipcard-v', text: `${shortDate(r['Window start'])} – ${shortDate(r['Window end'])}` }),
          ]));
          card.appendChild(el('p', { class: 'tipcard-note', text: r.Kind === 'Reported'
            ? t('perf.tip.rep', 'As reported in the export of {d}.', { d: shortDate(r['From export']) })
            : t('perf.tip.work', 'Worked out from the export of {d}: its value ÷ (1 + its "% vs previous"), rounded.', { d: shortDate(r['From export']) }) }));
        }, evt, anchor),
      });
      // Week on week: newest window against the reported one ending seven days before it. That difference is
      // the week that joined the window minus the week that left it, and it says so.
      const cur = reported.filter(r => numOrNull(r[m.key]) !== null).pop();
      const prevRow = cur ? reported.find(r => r['Window end'] === addDays(cur['Window end'], -7)) : null;
      let foot = '';
      if (cur && prevRow && numOrNull(prevRow[m.key]) !== null) {
        const diff = +cur[m.key] - +prevRow[m.key];
        const size = m.f === 'pct' ? (100 * Math.abs(diff)).toFixed(1) + ' ' + t('pts', 'pts') : fmt.int(Math.abs(diff));
        foot = diff === 0 ? t('perf.same', 'same as a week earlier')
          : `${diff > 0 ? '▲' : '▼'} ${size} ${t('perf.vs', 'vs a week earlier')}`;
      }
      grid.appendChild(el('div', { class: 'spark' }, [
        el('h4', { class: 'spark-h', text: perfName(m.key) }),
        el('span', { class: 'spark-s', text: tr(m.sub) }),
        svg,
        el('span', { class: 'spark-f', text: foot }),
      ]));
    });

    // Audience: the latest reported composition beside the earliest one on record. It moves slowly enough
    // that a quarter apart is the comparison worth making, not a week.
    const aud = $('#perf-audience');
    aud.innerHTML = '';
    const first = reported[0];
    [latest, first !== latest ? first : null].filter(Boolean).forEach((r, k) => {
      const lines = [
        [t('perf.countries', 'Countries'), r['Top countries']],
        [t('perf.cities', 'Cities'), r['Top cities']],
        [t('perf.ages', 'Ages'), r['Age groups']],
        [t('perf.gender', 'Men · women'), numOrNull(r['Men share']) === null ? '' : `${fmt.pct(r['Men share'])} · ${fmt.pct(r['Women share'])}`],
      ].filter(x => x[1]);
      aud.appendChild(el('div', { class: 'panel' + (k ? ' is-then' : '') }, [
        el('h3', { class: 'sub', text: (k ? t('perf.then', 'Followers then') : t('perf.now', 'Followers now'))
          + ` · ${shortDate(r['Window start'])} – ${shortDate(r['Window end'])}` }),
      ].concat(lines.map(x => el('div', { class: 'aud-row' }, [el('b', { text: x[0] }), el('span', { text: x[1] })])))));
    });

    const tbox = $('#perf-table');
    tbox.innerHTML = '';
    const cols = ['Kind'].concat(PERF.map(m => m.key));
    tbox.appendChild(el('table', { class: 'tv' }, [
      el('thead', {}, [el('tr', {}, [el('th', { text: t('perf.window', '90 days to') })].concat(cols.map(c => el('th', { text: c === 'Kind' ? '' : perfName(c) }))))]),
      el('tbody', {}, all.map(r => el('tr', {}, [el('td', { text: longDate(r['Window end']) })].concat(cols.map(c => {
        if (c === 'Kind') return el('td', { text: r.Kind === 'Reported' ? t('perf.reported', 'reported') : t('perf.worked', 'worked out') });
        const m = PERF.find(x => x.key === c);
        const v = numOrNull(r[c]);
        return el('td', { text: v === null ? '—' : fmtBy(m.f || 'int')(v) });
      }))))),
    ]));
  }

  // ── Profile strips ───────────────────────────────────────────────────────────────────────────────────
  const MIN_EVIDENCE = 3; // mirrors CONFIG.MIN_EVIDENCE: below it a behaviour score is left blank
  function drawStrips() {
    const all = isWeek() ? table('Weekly profile') : table('Profile');
    const key = bucketKey();
    const now = all.filter(p => p[key] === current);
    const groups = [
      ['#strips-do', p => /\(behaviour\)/.test(p.Framework)],
      ['#strips-shown', p => /^Feed diet/.test(p.Framework)],
      ['#strips-influence', p => /^Influence/.test(p.Framework)],
    ];
    groups.forEach(([sel, test]) => {
      const box = $(sel);
      if (!box) return;
      box.innerHTML = '';
      let lastFramework = '';
      now.filter(test).forEach(p => {
        if (sel === '#strips-do' && p.Framework !== lastFramework) {
          lastFramework = p.Framework;
          box.appendChild(el('p', { class: 'strip-g', text: /Needs/.test(p.Framework) ? t('strips.needs', 'Needs · Self-Determination Theory')
            : t('strips.big5', 'Personality · Big Five') }));
        }
        const history = all.filter(h => h.Framework === p.Framework && h.Dimension === p.Dimension && h[key] !== current)
          .map(h => numOrNull(h.Score)).filter(v => v !== null);
        const score = numOrNull(p.Score);
        const track = el('div', { class: 'strip-track' });
        history.forEach(v => track.appendChild(el('i', { class: 'strip-dot', style: `left:${Math.max(0, Math.min(100, v))}%` })));
        if (score !== null) track.appendChild(el('i', { class: 'strip-dot is-now', style: `left:${Math.max(0, Math.min(100, score))}%` }));
        const ev = numOrNull(p.Evidence);
        box.appendChild(el('div', { class: 'strip' + (score === null ? ' is-blank' : ''), title: p['How it is computed'] || '' }, [
          el('span', { class: 'strip-n', text: String(p.Dimension).split('·')[0].trim() }),
          track,
          el('span', { class: 'strip-v', text: score === null ? '—' : String(Math.round(score)) }),
          el('span', { class: 'strip-e', text: score === null && ev !== null && ev < MIN_EVIDENCE
            ? t('strips.thin', 'n={n} · too few', { n: ev }) : ev === null ? '' : 'n=' + fmt.int(ev) }),
        ]));
      });
    });
    const k = $('#strip-key');
    if (k) {
      k.textContent = t('strips.key', 'Each strip runs 0–100. Grey dots: every other {p} on record. Dark dot with a ring: this {p}. n: how many events the score rests on; with fewer than {m} it is left blank rather than guessed. Hover a row for its formula.',
        { p: isWeek() ? t('word.week', 'week') : t('word.month', 'month'), m: MIN_EVIDENCE });
    }
  }

  // ── Influence ────────────────────────────────────────────────────────────────────────────────────────
  function drawInfluence() {
    const box = $('#dumbbell');
    if (!box) return;
    box.innerHTML = '';
    const rows = bucketTable('Themes').filter(r => r.Theme !== 'Other'
      && ((numOrNull(r['Seen share']) || 0) >= 0.02 || (numOrNull(r['Action share']) || 0) > 0));
    rows.sort((a, b) => (numOrNull(b['Action share']) || 0) - (numOrNull(a['Action share']) || 0)
      || (numOrNull(b['Seen share']) || 0) - (numOrNull(a['Seen share']) || 0));
    const max = Math.max(0.1, ...rows.map(r => Math.max(numOrNull(r['Seen share']) || 0, numOrNull(r['Action share']) || 0)));
    const scale = Math.ceil(max * 10) / 10;
    box.appendChild(el('div', { class: 'db-legend' }, [
      el('span', {}, [el('i', { class: 'db-k db-seen' }), document.createTextNode(t('db.seen', 'share of what you were shown'))]),
      el('span', {}, [el('i', { class: 'db-k db-chosen' }), document.createTextNode(t('db.chosen', 'share of what you chose'))]),
    ]));
    rows.forEach(r => {
      const s = numOrNull(r['Seen share']) || 0;
      const a = numOrNull(r['Action share']) || 0;
      const lo = Math.min(s, a) / scale * 100;
      const hi = Math.max(s, a) / scale * 100;
      box.appendChild(el('div', { class: 'db', title: `${r.Theme}: ${fmt.pct(s)} ${t('db.of.seen', 'of what you were shown')}, ${fmt.pct(a)} ${t('db.of.chosen', 'of what you chose')}` }, [
        el('span', { class: 'db-n', text: r.Theme }),
        el('div', { class: 'db-track' }, [
          el('i', { class: 'db-bar' + (a > s ? ' is-up' : ''), style: `left:${lo}%;width:${Math.max(0.5, hi - lo)}%` }),
          el('i', { class: 'db-dot db-seen', style: `left:${s / scale * 100}%` }),
          el('i', { class: 'db-dot db-chosen', style: `left:${a / scale * 100}%` }),
        ]),
        el('span', { class: 'db-v', text: `${fmt.pct(s)} → ${fmt.pct(a)}` }),
      ]));
    });
    const note = $('#influence-note');
    const dir = influenceDirection();
    const weighted = bucketTable('Profile').find(p => /^Feed alignment/.test(p.Dimension));
    const ev = weighted ? numOrNull(weighted.Evidence) : null;
    const bits = [];
    if (ev !== null) bits.push(t('infl.n', 'Chosen side built from {n} themed actions this {p} — searches and comments count 3, saves and follows 2, likes 1.', { n: ev, p: isWeek() ? t('word.week', 'week') : t('word.month', 'month') }));
    bits.push(dir.ready
      ? t('infl.dir', 'Direction, over {w} weeks: when the feed showed more of a theme, your actions on it the next week moved with it at r = {f}; when you acted more on a theme, the feed showed more of it the next week at r = {y}. A correlation, not proof of cause.',
        { w: dir.weeks, f: dir.feed.toFixed(2), y: dir.you.toFixed(2) })
      : t('infl.wait', 'Which way the influence runs — the feed leading you, or you leading the feed — needs {need} consecutive usable weeks; {have} so far.',
        { need: 12, have: dir.weeks }));
    note.textContent = bits.join(' ');
  }

  /** Lagged correlation, pooled over themes: does a change in what you were shown precede a change in what you
   * chose (the feed leading), or the other way round (you leading the feed)? Only consecutive weeks with enough
   * viewing history are paired. See METHODOLOGY.md → Influence. */
  function influenceDirection() {
    const weeks = table('Weekly').filter(w => w['Week start'] && numOrNull(w.Coverage) !== null && +w.Coverage >= MIN_TREND_COVERAGE)
      .sort((a, b) => (a['Week start'] < b['Week start'] ? -1 : 1));
    // Longest run of consecutive weeks.
    let best = [];
    let run = [];
    weeks.forEach(w => {
      if (run.length && addDays(run[run.length - 1]['Week start'], 7) !== w['Week start']) run = [];
      run.push(w);
      if (run.length > best.length) best = run.slice();
    });
    if (best.length < 12) return { ready: false, weeks: best.length };
    const th = table('Weekly themes');
    const val = (w, theme, col) => {
      const r = th.find(x => x.Week === w.Week && x.Theme === theme);
      return r ? numOrNull(r[col]) || 0 : 0;
    };
    const themes = Array.from(new Set(th.filter(r => r.Theme !== 'Other').map(r => r.Theme)));
    const feed = [];
    const you = [];
    themes.forEach(theme => {
      const e = best.map(w => val(w, theme, 'Seen share'));
      const a = best.map(w => val(w, theme, 'Action share'));
      for (let i = 1; i + 1 < best.length; i++) {
        feed.push([e[i] - e[i - 1], a[i + 1] - a[i]]);
        you.push([a[i] - a[i - 1], e[i + 1] - e[i]]);
      }
    });
    const corr = pairs => {
      const n = pairs.length;
      const mx = pairs.reduce((s, p) => s + p[0], 0) / n;
      const my = pairs.reduce((s, p) => s + p[1], 0) / n;
      let sxy = 0; let sxx = 0; let syy = 0;
      pairs.forEach(p => { sxy += (p[0] - mx) * (p[1] - my); sxx += (p[0] - mx) ** 2; syy += (p[1] - my) ** 2; });
      return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
    };
    return { ready: true, weeks: best.length, feed: corr(feed), you: corr(you) };
  }

  // ── Conversations ────────────────────────────────────────────────────────────────────────────────────
  function drawConversations() {
    const panel = $('#conversations-panel');
    const box = $('#conversations');
    if (!panel || !box) return;
    box.innerHTML = '';
    const rows = bucketTable('Conversations');
    panel.hidden = !rows.length;
    if (!rows.length) return;
    const frac = (a, b) => (+b ? `${a}/${b}` : '—');
    const mins = v => (numOrNull(v) === null ? '—' : `${fmt.int(v)} min`);
    box.appendChild(el('table', { class: 'tv conv' }, [
      el('thead', {}, [el('tr', {}, [
        t('conv.person', 'Person'), t('conv.msgs', 'Sent · received'), t('conv.convs', 'Conversations (you started)'),
        t('conv.yours', 'Your turns answered'), t('conv.theirs', 'Their turns you answered'), t('conv.wait', 'Median reply: them · you'),
      ].map(h => el('th', { text: h })))]),
      el('tbody', {}, rows.map(r => el('tr', {}, [
        r.Person,
        `${r.Sent} · ${r.Received}` + (+r['Your voice notes'] + +r['Their voice notes'] ? ` (${t('conv.voice', 'voice')} ${r['Your voice notes']} · ${r['Their voice notes']})` : ''),
        `${r.Conversations} (${r['You started']})`,
        frac(r['Your turns answered'], r['Your turns']),
        frac(r['Their turns you answered'], r['Their turns']),
        `${mins(r['Their median reply (min)'])} · ${mins(r['Your median reply (min)'])}`,
      ].map(v => el('td', { text: String(v) }))))),
    ]));
  }

  // ── Context triggers ─────────────────────────────────────────────────────────────────────────────────
  // The Sheet stores counts (Triggers, Weekly triggers) and the sessions themselves (Sessions); the lift is worked
  // out here, over whatever range the filter row selects, so a range of weeks adds up exactly instead of
  // averaging rates. rankTriggers mirrors rankTriggers_ in Code.gs — keep the two in step.
  const TRIG_MIN = 3; // mirrors TRIGGER_MIN_HITS
  const TRIG_STRONG = 10; // mirrors TRIGGER_STRONG
  const TRIG_UNRANKED = ['Nothing seen', 'Unknown', 'Sponsored', 'Nothing in particular', 'Nothing just before',
    'No story first', 'Not a quick return'];
  const TRIG_OUTCOMES = ['Pull', 'Stay', 'Late', 'Act', 'Seek', 'Reach'];
  // Which layer each outcome belongs to: opening, staying and looking things up are how you used the app; acting on
  // content and writing to people are what you did toward them.
  const TRIG_LAYER = { Pull: 'consumption', Stay: 'consumption', Late: 'consumption', Seek: 'consumption', Act: 'social', Reach: 'social' };
  let dotsBy = 'Opening format';

  function rankTriggers(rows) {
    const groups = {};
    rows.forEach(r => {
      const gk = r.Outcome + '|' + r.Dimension;
      const g = groups[gk] = groups[gk] || { exposure: 0, hits: 0, contexts: {} };
      const x = g.contexts[r.Context] = g.contexts[r.Context]
        || { outcome: r.Outcome, dimension: r.Dimension, context: r.Context, unit: r.Unit, exposure: 0, hits: 0 };
      x.exposure += +r.Exposure || 0;
      x.hits += +r.Hits || 0;
      g.exposure += +r.Exposure || 0;
      g.hits += +r.Hits || 0;
    });
    const all = [];
    Object.keys(groups).forEach(gk => {
      const g = groups[gk];
      if (!g.hits || !g.exposure) return;
      const p0 = g.hits / g.exposure;
      Object.keys(g.contexts).forEach(name => {
        const x = g.contexts[name];
        if (!x.exposure) return;
        const lift = ((x.hits + TRIG_MIN) / (x.exposure + TRIG_MIN / p0)) / p0;
        const evidence = lift >= 1 ? x.hits : x.exposure * p0;
        const tier = evidence < TRIG_MIN ? 'few' : evidence < TRIG_STRONG ? 'some' : 'strong';
        all.push(Object.assign(x, {
          p0: p0, rate: x.hits / x.exposure, lift: lift, tier: tier, ranked: TRIG_UNRANKED.indexOf(name) < 0,
          strength: tier === 'few' || TRIG_UNRANKED.indexOf(name) >= 0 ? 0 : Math.abs(Math.log(lift)) * (tier === 'strong' ? 1 : 0.6),
        }));
      });
    });
    const ranked = all.filter(x => x.strength > 0).sort((a, b) => b.strength - a.strength);
    return { all: all, triggers: ranked.filter(x => x.lift >= 1.25), dampeners: ranked.filter(x => x.lift <= 0.8) };
  }

  /** The trigger counts and sessions inside the range the filter row shows. */
  function triggerScope() {
    const tp = trendPeriods();
    if (!tp) return null;
    const monthly = tp.unit === 'month';
    const rows = monthly
      ? table('Triggers').filter(r => r.Month >= tp.from.slice(0, 7) && r.Month <= tp.to.slice(0, 7))
      : table('Weekly triggers').filter(r => r['Week start'] >= mondayOf(tp.from) && r['Week start'] <= tp.to);
    const sessions = table('Sessions').filter(s => s.Date >= tp.from && s.Date <= tp.to);
    return { tp: tp, rows: rows, sessions: sessions, buckets: unique(rows.map(r => (monthly ? r.Month : r.Week))).length };
  }
  const unique = list => Array.from(new Set(list));

  const TRIG_WORDS = {
    en: {
      outcome: { Pull: 'Opening the app', Stay: 'Long sessions', Late: 'Late-night sessions', Act: 'Acting on content', Seek: 'Looking things up', Reach: 'Reaching out' },
      col: { Pull: 'Open', Stay: 'Stay long', Late: 'Late', Act: 'Act', Seek: 'Look up', Reach: 'Reach out' },
      lead: {
        Pull: ['You open the app more often', 'You open the app less often'],
        Stay: ['Sessions run long more often', 'Sessions run long less often'],
        Late: ['Sessions start late at night more often', 'Sessions start late at night less often'],
        Act: ['You like, save, comment or follow more', 'You like, save, comment or follow less'],
        Seek: ['You look things up more', 'You look things up less'],
        Reach: ['You write to people more', 'You write to people less'],
      },
      dim: {
        'Part of day': 'Part of day', Weekend: 'Day of the week', 'Just before': 'What just happened', 'Pulled by': 'Pulled in by',
        'Opened with': 'Opened into', 'Quick return': 'Coming straight back', 'Their story first': 'Their story first',
        Format: 'Format on screen', Source: 'Whose it was', Tone: 'Tone on screen', Theme: 'Theme on screen',
        'Opening format': 'Opening format', 'Opening source': 'Opening accounts', 'Opening tone': 'Opening tone',
        'Opening theme': 'Opening theme', 'Session phase': 'How far into a session',
      },
      ctx: {},
    },
    it: {
      outcome: { Pull: 'Aprire l’app', Stay: 'Sessioni lunghe', Late: 'Sessioni notturne', Act: 'Agire sui contenuti', Seek: 'Cercare', Reach: 'Scrivere alle persone' },
      col: { Pull: 'Apri', Stay: 'Lunghe', Late: 'Notte', Act: 'Agisci', Seek: 'Cerchi', Reach: 'Scrivi' },
      lead: {
        Pull: ['Apri l’app più spesso', 'Apri l’app meno spesso'],
        Stay: ['Le sessioni durano a lungo più spesso', 'Le sessioni durano a lungo meno spesso'],
        Late: ['Le sessioni iniziano a notte fonda più spesso', 'Le sessioni iniziano a notte fonda meno spesso'],
        Act: ['Metti like, salvi, commenti o segui di più', 'Metti like, salvi, commenti o segui di meno'],
        Seek: ['Cerchi cose di più', 'Cerchi cose di meno'],
        Reach: ['Scrivi alle persone di più', 'Scrivi alle persone di meno'],
      },
      dim: {
        'Part of day': 'Momento del giorno', Weekend: 'Giorno della settimana', 'Just before': 'Cosa è appena successo', 'Pulled by': 'Richiamato da',
        'Opened with': 'Aperto su', 'Quick return': 'Ritorno immediato', 'Their story first': 'Prima la sua storia',
        Format: 'Formato sullo schermo', Source: 'Di chi era', Tone: 'Tono sullo schermo', Theme: 'Tema sullo schermo',
        'Opening format': 'Formato iniziale', 'Opening source': 'Account iniziali', 'Opening tone': 'Tono iniziale',
        'Opening theme': 'Tema iniziale', 'Session phase': 'Quanto dentro la sessione',
      },
      ctx: {
        Morning: 'Mattina', Afternoon: 'Pomeriggio', Evening: 'Sera', Night: 'Notte', Weekend: 'Fine settimana', Weekday: 'Giorno feriale',
        'A message arrived': 'È arrivato un messaggio', 'Your post went up': 'Hai appena pubblicato', 'A message': 'Un messaggio',
        'Your own post': 'Un tuo post', Feed: 'Feed', Stories: 'Storie', Messages: 'Messaggi', Search: 'Ricerca', Other: 'Altro',
        'Quick return': 'Entro mezz’ora', 'After their story': 'Dopo una sua storia', Post: 'Post', Video: 'Video', Story: 'Storia',
        Ad: 'Inserzione', Followed: 'Account che segui', Recommended: 'Account che non segui', Heavy: 'Pesante', Light: 'Leggero',
        Neutral: 'Neutro', Videos: 'Video', Posts: 'Post', 'Mostly recommended': 'Soprattutto non seguiti',
        'Mostly followed': 'Soprattutto seguiti', 'First 5 min': 'Primi 5 min', '5–20 min': '5–20 min', '20+ min': 'Oltre 20 min',
      },
    },
  };
  // English context labels, where the stored value alone reads badly.
  TRIG_WORDS.en.ctx = {
    Weekday: 'Weekday', 'A message arrived': 'A message arrived', 'Your post went up': 'Your post went up', 'Quick return': 'Within 30 min',
    'After their story': 'After their story', Followed: 'Accounts you follow', Recommended: 'Accounts you don’t follow',
    'Mostly recommended': 'Mostly not followed', 'Mostly followed': 'Mostly followed',
  };
  const tw = () => TRIG_WORDS[lang] || TRIG_WORDS.en;
  const ctxLabel = c => tw().ctx[c] || c;

  /** "…on videos", "…when a session opens with stories": the context half of a trigger sentence. */
  function ctxPhrase(x) {
    const c = x.context;
    if (lang === 'it') {
      const prep = x.outcome === 'Act' ? 'su' : 'dopo';
      const tone = { Heavy: 'pesanti', Light: 'leggeri', Neutral: 'neutri' };
      switch (x.dimension) {
        case 'Part of day': return { Morning: 'di mattina', Afternoon: 'di pomeriggio', Evening: 'di sera', Night: 'di notte' }[c];
        case 'Weekend': return c === 'Weekend' ? 'nel fine settimana' : 'nei giorni feriali';
        case 'Just before': return c === 'A message arrived' ? 'subito dopo l’arrivo di un messaggio' : 'subito dopo aver pubblicato qualcosa';
        case 'Pulled by': return c === 'A message' ? 'quando ti ha richiamato un messaggio' : 'quando torni a controllare un tuo post';
        case 'Opened with': return { Feed: 'quando apri direttamente sul feed', Stories: 'quando apri sulle storie', Messages: 'quando apri sui messaggi',
          Search: 'quando apri con una ricerca', Other: 'quando apri con altro' }[c];
        case 'Quick return': return 'quando torni entro mezz’ora';
        case 'Opening format': return 'quando una sessione si apre con ' + ({ Videos: 'video', Posts: 'post', Stories: 'storie' }[c] || c);
        case 'Opening source': return c === 'Mostly recommended' ? 'quando una sessione si apre con account che non segui' : 'quando una sessione si apre con account che segui';
        case 'Opening tone': return 'quando una sessione si apre su contenuti ' + (tone[c] || c);
        case 'Opening theme': return 'quando una sessione si apre con ' + c;
        case 'Format': return prep + ' ' + ({ Post: 'i post', Video: 'i video', Story: 'le storie', Ad: 'le inserzioni' }[c] || c);
        case 'Source': return prep + (c === 'Followed' ? ' account che segui' : ' account che non segui');
        case 'Theme': return prep + ' ' + c;
        case 'Tone': return prep + ' contenuti ' + (tone[c] || c);
        case 'Session phase': return { 'First 5 min': 'nei primi cinque minuti di una sessione', '5–20 min': 'tra 5 e 20 minuti dall’inizio di una sessione',
          '20+ min': 'quando una sessione ha superato i 20 minuti' }[c];
        case 'Their story first': return 'subito dopo aver visto una sua storia';
        default: return x.dimension + ': ' + c;
      }
    }
    const prep = x.outcome === 'Act' ? 'on' : 'after';
    switch (x.dimension) {
      case 'Part of day': return { Morning: 'in the morning', Afternoon: 'in the afternoon', Evening: 'in the evening', Night: 'at night' }[c];
      case 'Weekend': return c === 'Weekend' ? 'at weekends' : 'on weekdays';
      case 'Just before': return c === 'A message arrived' ? 'just after a message arrives' : 'just after your own post goes up';
      case 'Pulled by': return c === 'A message' ? 'when a message pulled you in' : 'when you are checking back on your own post';
      case 'Opened with': return { Feed: 'when you open straight into the feed', Stories: 'when you open into stories', Messages: 'when you open into your messages',
        Search: 'when you open with a search', Other: 'when you open with something else' }[c];
      case 'Quick return': return 'when you come back within half an hour';
      case 'Opening format': return 'when a session opens with ' + String(c).toLowerCase();
      case 'Opening source': return c === 'Mostly recommended' ? 'when a session opens with accounts you don’t follow' : 'when a session opens with accounts you follow';
      case 'Opening tone': return 'when a session opens on ' + String(c).toLowerCase() + ' content';
      case 'Opening theme': return 'when a session opens with ' + c;
      case 'Format': return prep + ' ' + ({ Post: 'posts', Video: 'videos', Story: 'stories', Ad: 'ads' }[c] || c);
      case 'Source': return prep + (c === 'Followed' ? ' accounts you follow' : ' accounts you don’t follow');
      case 'Theme': return prep + ' ' + c;
      case 'Tone': return prep + ' ' + String(c).toLowerCase() + ' content';
      case 'Session phase': return { 'First 5 min': 'in the first five minutes of a session', '5–20 min': '5–20 minutes into a session',
        '20+ min': 'once a session has run past 20 minutes' }[c];
      case 'Their story first': return 'right after watching that account’s story';
      default: return x.dimension + ': ' + c;
    }
  }
  const triggerSentence = x => tw().lead[x.outcome][x.lift >= 1 ? 0 : 1] + ' ' + ctxPhrase(x);
  const liftText = v => (v >= 10 ? Math.round(v) : v.toFixed(1)) + '×';
  const isPull = x => x.unit === 'idle minutes';
  const rateText = (x, v) => (isPull(x) ? `${(60 * v).toFixed(2)} ${t('trig.perhour', 'an hour')}` : fmt.pct(v));
  function countText(x) {
    if (isPull(x)) return t('trig.n.pull', '{h} starts in {e} idle hours', { h: fmt.int(x.hits), e: fmt.int(x.exposure / 60) });
    const unit = x.unit === 'sessions' ? t('trig.u.sessions', 'sessions') : t('trig.u.items', 'items seen');
    return t('trig.n', '{h} of {e} {u}', { h: fmt.int(x.hits), e: fmt.int(x.exposure), u: unit });
  }
  const tierText = tier => ({ strong: t('trig.tier.strong', 'Strong evidence'), some: t('trig.tier.some', 'Some evidence'),
    few: t('trig.tier.few', 'Too few to say') })[tier];

  function drawTriggers() {
    const sec = $('#sec-triggers');
    if (!sec) return;
    const scope = triggerScope();
    const empty = !scope || (!scope.rows.length && !scope.sessions.length);
    $('#trig-body').hidden = empty;
    $('#trig-empty').hidden = !empty;
    if (empty) return;
    const ranked = rankTriggers(scope.rows);
    const items = ranked.all.filter(x => x.outcome === 'Act' && x.dimension === 'Format').reduce((n, x) => n + x.exposure, 0);
    $('#trig-scope').textContent = t('trig.scope', '{range}: {s} sessions and {i} items seen, across {b} {unit}. Associations, not causes.', {
      range: `${periodLabel({ key: scope.tp.from, start: scope.tp.from }, 'day')} – ${periodLabel({ key: scope.tp.to, start: scope.tp.to }, 'day')}`,
      s: fmt.int(scope.sessions.length), i: fmt.int(items), b: scope.buckets,
      unit: scope.tp.unit === 'month' ? t('trig.months', 'months') : t('trig.weeks', 'weeks'),
    });
    drawTopTriggers(ranked);
    drawTriggerMatrix(ranked);
    drawStarts(scope.sessions);
    drawSessionDots(scope.sessions);
  }

  function triggerCard(x) {
    const max = Math.max(x.rate, x.p0) || 1;
    const bar = (label, v, cls) => el('div', { class: 'trig-bar' }, [
      el('span', { class: 'trig-bar-k', text: label }),
      el('div', { class: 'bar' }, [el('i', { class: cls, style: `width:${(100 * v / max).toFixed(1)}%` })]),
      el('span', { class: 'trig-bar-v', text: rateText(x, v) }),
    ]);
    return el('div', { class: `trig is-${TRIG_LAYER[x.outcome]} tier-${x.tier}` }, [
      el('div', { class: 'trig-k' }, [
        el('span', { text: tw().outcome[x.outcome] }),
        el('span', { class: 'trig-tier', text: tierText(x.tier) }),
      ]),
      el('div', { class: 'trig-main' }, [
        el('p', { class: 'trig-s', text: triggerSentence(x) }),
        el('b', { class: 'trig-lift', text: liftText(x.lift) }),
      ]),
      bar(t('trig.when', 'In this context'), x.rate, 'is-now'),
      bar(t('trig.usual', 'Your usual rate'), x.p0, 'is-usual'),
      el('span', { class: 'trig-n', text: countText(x) }),
    ]);
  }

  function drawTopTriggers(ranked) {
    const box = $('#trig-top');
    box.innerHTML = '';
    // At most two per outcome, so six cards show six different kinds of behaviour rather than one dominating.
    const per = {};
    const picks = ranked.triggers.filter(x => (per[x.outcome] = (per[x.outcome] || 0) + 1) <= 2).slice(0, 6);
    if (!picks.length) {
      box.appendChild(el('p', { class: 'mono', text: t('trig.none', 'Nothing stands out yet: no context shifts any of these by a quarter or more with enough events behind it. Widen the range for more evidence.') }));
    }
    picks.forEach(x => box.appendChild(triggerCard(x)));
    const damp = $('#trig-damp');
    damp.innerHTML = '';
    const lows = ranked.dampeners.slice(0, 4);
    if (!lows.length) return;
    damp.appendChild(el('h3', { class: 'sub', text: t('trig.damp', 'Less often than usual') }));
    lows.forEach(x => damp.appendChild(el('div', { class: 'trig-low' }, [
      el('b', { text: liftText(x.lift) }),
      el('span', { text: triggerSentence(x) }),
      el('span', { class: 'trig-n', text: countText(x) + ' · ' + tierText(x.tier) }),
    ])));
  }

  // Families of contexts, in the order the matrix reads: when, what just happened, what was on screen, how the
  // session began, how far into it.
  const TRIG_FAMILIES = [
    { label: ['trig.f.time', 'When'], dims: ['Part of day', 'Weekend'] },
    { label: ['trig.f.before', 'What came just before'], dims: ['Just before', 'Pulled by', 'Opened with', 'Quick return', 'Their story first'] },
    { label: ['trig.f.screen', 'What was on screen'], dims: ['Format', 'Source', 'Tone', 'Theme'] },
    { label: ['trig.f.opening', 'How the session began'], dims: ['Opening format', 'Opening source', 'Opening tone', 'Opening theme'] },
    { label: ['trig.f.phase', 'How far into a session'], dims: ['Session phase'] },
  ];
  const CONTEXT_ORDER = {
    'Part of day': ['Morning', 'Afternoon', 'Evening', 'Night'], Weekend: ['Weekday', 'Weekend'],
    Format: ['Post', 'Video', 'Story', 'Ad'], Source: ['Followed', 'Recommended'], Tone: ['Heavy', 'Light', 'Neutral'],
    'Opening format': ['Posts', 'Videos', 'Stories'], 'Opening source': ['Mostly followed', 'Mostly recommended'],
    'Opening tone': ['Heavy', 'Light', 'Neutral'], 'Session phase': ['First 5 min', '5–20 min', '20+ min'],
    'Opened with': ['Feed', 'Stories', 'Messages', 'Search', 'Other'],
  };

  function drawTriggerMatrix(ranked) {
    const box = $('#trig-matrix');
    box.innerHTML = '';
    const byKey = {};
    ranked.all.forEach(x => { byKey[x.outcome + '|' + x.dimension + '|' + x.context] = x; });
    const grid = el('div', { class: 'tm', role: 'table' });
    grid.appendChild(el('span', { class: 'tm-c tm-corner' }));
    TRIG_OUTCOMES.forEach(o => grid.appendChild(el('span', { class: `tm-c tm-head is-${TRIG_LAYER[o]}`, role: 'columnheader', text: tw().col[o], title: tw().outcome[o] })));
    const tableRows = [];
    TRIG_FAMILIES.forEach(fam => {
      const lines = [];
      fam.dims.forEach(dim => {
        const mine = ranked.all.filter(x => x.dimension === dim && x.ranked);
        let contexts = unique(mine.map(x => x.context));
        const exposureOf = c => Math.max.apply(null, mine.filter(x => x.context === c).map(x => x.exposure));
        if (CONTEXT_ORDER[dim]) contexts.sort((a, b) => CONTEXT_ORDER[dim].indexOf(a) - CONTEXT_ORDER[dim].indexOf(b));
        else contexts.sort((a, b) => exposureOf(b) - exposureOf(a));
        // Themes are the long tail: the six biggest carry the matrix, the table view carries the rest.
        if (/theme/i.test(dim)) contexts = contexts.slice(0, 5);
        contexts.forEach(c => lines.push({ dim: dim, context: c }));
      });
      if (!lines.length) return;
      grid.appendChild(el('span', { class: 'tm-fam', text: tr(fam.label) }));
      lines.forEach((line, k) => {
        const first = k === 0 || lines[k - 1].dim !== line.dim;
        grid.appendChild(el('span', { class: 'tm-c tm-row' + (first ? ' is-first' : ''), role: 'rowheader' }, [
          el('i', { text: first ? tw().dim[line.dim] || line.dim : '' }),
          el('b', { text: /theme/i.test(line.dim) && line.context === 'Other' ? t('trig.notheme', 'No theme matched') : ctxLabel(line.context) }),
        ]));
        TRIG_OUTCOMES.forEach(o => {
          const x = byKey[o + '|' + line.dim + '|' + line.context];
          if (!x) { grid.appendChild(el('span', { class: 'tm-c tm-cell is-na', role: 'cell' })); return; }
          tableRows.push(x);
          const cell = el('span', { class: 'tm-c tm-cell tier-' + x.tier, role: 'cell', tabindex: '0', style: `--d:${TRIG_OUTCOMES.indexOf(o) * 60}ms` });
          if (x.tier !== 'few') {
            const k2 = Math.min(1, Math.abs(Math.log(x.lift)) / Math.log(3));
            const pole = x.lift >= 1 ? 'var(--div-more)' : 'var(--div-less)';
            cell.style.background = `color-mix(in oklab, ${pole} ${Math.round(85 * k2)}%, var(--div-mid))`;
            if (k2 > 0.55) cell.classList.add(x.lift >= 1 ? 'is-more' : 'is-less');
            // Numbers only where they say something: a lift of 1.1 is a colour, not a finding.
            if (x.lift >= 1.25 || x.lift <= 0.8) cell.textContent = liftText(x.lift);
          } else cell.textContent = '·';
          const show = (evt, anchor) => tip.show(card => {
            card.appendChild(el('div', { class: 'tipcard-h' }, [
              el('b', { text: liftText(x.lift) }),
              el('span', { class: 'tipcard-v', text: tierText(x.tier) }),
            ]));
            card.appendChild(el('p', { class: 'tipcard-note', text: triggerSentence(x) }));
            card.appendChild(el('p', { class: 'tipcard-note', text: countText(x) + ' · ' + t('trig.usual', 'Your usual rate') + ' ' + rateText(x, x.p0) }));
          }, evt, anchor);
          cell.addEventListener('mousemove', e => show(e));
          cell.addEventListener('mouseleave', () => tip.hide());
          cell.addEventListener('focus', () => show(null, cell));
          cell.addEventListener('blur', () => tip.hide());
          grid.appendChild(cell);
        });
      });
    });
    box.appendChild(grid);
    $('#trig-matrix-key').textContent = t('trig.key', 'Orange: happens more often in that context than your usual rate · grey-blue: less often · grey: about the same · dotted: too few events to say · dashed outline: some evidence (3–9 events), solid: strong (10+). Shrunk toward "usual" so a handful of events can never look like a pattern.');
    const tbl = $('#trig-table');
    tbl.innerHTML = '';
    const head = el('tr', {}, ['trig.t.outcome|Outcome', 'trig.t.dim|Context', 'trig.t.counts|Counts', 'trig.t.rate|Rate',
      'trig.t.usual|Usual', 'trig.t.lift|Lift', 'trig.t.tier|Evidence'].map(s => el('th', { text: t(s.split('|')[0], s.split('|')[1]) })));
    const body = ranked.all.filter(x => x.ranked).sort((a, b) => TRIG_OUTCOMES.indexOf(a.outcome) - TRIG_OUTCOMES.indexOf(b.outcome) || b.lift - a.lift)
      .map(x => el('tr', {}, [tw().outcome[x.outcome], `${tw().dim[x.dimension] || x.dimension}: ${ctxLabel(x.context)}`, countText(x),
        rateText(x, x.rate), rateText(x, x.p0), liftText(x.lift), tierText(x.tier)].map(v => el('td', { text: v }))));
    tbl.appendChild(el('table', { class: 'tv' }, [el('thead', {}, [head]), el('tbody', {}, body)]));
  }

  /** When sessions begin, by weekday and hour, and what they opened into. */
  function drawStarts(sessions) {
    const box = $('#trig-starts');
    box.innerHTML = '';
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const grid = days.map(() => new Array(24).fill(0));
    sessions.forEach(s => {
      const wd = (new Date(dayMs(s.Date)).getUTCDay() || 7) - 1;
      grid[wd][+String(s.Start).slice(0, 2)]++;
    });
    const max = Math.max(1, ...grid.map(r => Math.max(...r)));
    const heat = el('div', { class: 'heat' });
    heat.appendChild(el('span', {}));
    for (let h = 0; h < 24; h++) heat.appendChild(el('span', { class: 'h', text: h % 3 === 0 ? String(h) : '' }));
    days.forEach((day, i) => {
      heat.appendChild(el('span', { class: 'wd', text: day }));
      for (let h = 0; h < 24; h++) {
        const n = grid[i][h];
        const cell = el('div', { class: 'cell', style: `--d:${h * 16}ms`, title: t('trig.starts.cell', '{d} {h}:00 · {n} sessions began', { d: day, h: String(h).padStart(2, '0'), n: n }) });
        if (n) {
          cell.style.background = 'var(--l-consumption)';
          cell.style.opacity = (0.2 + 0.8 * Math.sqrt(n / max)).toFixed(2);
        }
        heat.appendChild(cell);
      }
    });
    box.appendChild(heat);

    const open = $('#trig-open');
    open.innerHTML = '';
    const total = sessions.length || 1;
    const by = k => sessions.reduce((o, s) => Object.assign(o, { [s[k]]: (o[s[k]] || 0) + 1 }), {});
    const opened = by('Opened with');
    ['Feed', 'Stories', 'Messages', 'Search', 'Other'].filter(k => opened[k]).forEach(k => open.appendChild(el('div', { class: 'theme' }, [
      el('span', { class: 'theme-n', text: ctxLabel(k) }),
      el('div', { class: 'bar' }, [el('i', { class: 'is-consumption', style: `width:${(100 * opened[k] / total).toFixed(1)}%` })]),
      el('span', { class: 'theme-v', text: fmt.pct(opened[k] / total) }),
      el('span', { class: 'theme-l', text: fmt.int(opened[k]) }),
    ])));
    const pulled = by('Pulled by');
    const quick = sessions.filter(s => s['Quick return'] === 'Yes').length;
    $('#trig-open-note').textContent = t('trig.open.note', '{m} of {n} sessions began within 10 minutes of a message arriving, {p} within an hour of your own post going up, and {q} were quick returns — back within 30 minutes of the last one.', {
      m: fmt.int(pulled['A message'] || 0), n: fmt.int(sessions.length), p: fmt.int(pulled['Your own post'] || 0), q: fmt.int(quick),
    });
  }

  const DOT_GROUPINGS = {
    'Opening format': ['Videos', 'Posts', 'Stories', 'Nothing seen'],
    'Opening source': ['Mostly recommended', 'Mostly followed', 'Nothing seen'],
    'Opening tone': ['Heavy', 'Light', 'Neutral', 'Nothing seen'],
    'Part of day': ['Morning', 'Afternoon', 'Evening', 'Night'],
  };

  /** Every session as a dot on a minutes axis, grouped by how it began. */
  function drawSessionDots(sessions) {
    const box = $('#trig-dots');
    box.innerHTML = '';
    document.querySelectorAll('#dots-by [data-by]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.by === dotsBy)));
    if (!sessions.length) return;
    const mins = sessions.map(s => +s.Minutes).sort((a, b) => a - b);
    const p75 = mins[Math.ceil(0.75 * mins.length) - 1];
    // The axis stops at the 98th percentile: one 80-minute session should not squeeze everyone else into a corner.
    const top = mins[Math.min(mins.length - 1, Math.floor(0.98 * mins.length))];
    const groups = DOT_GROUPINGS[dotsBy].map(g => {
      const mine = sessions.filter(s => s[dotsBy] === g);
      const sorted = mine.map(s => +s.Minutes).sort((a, b) => a - b);
      const med = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null;
      const long = mine.filter(s => +s.Minutes >= p75).length;
      return {
        label: g === 'Nothing seen' ? t('trig.dots.nothing', 'Opened into messages or search') : ctxLabel(g),
        sub: mine.length ? t('trig.dots.sub', '{n} sessions · median {m} min · {l} long', { n: mine.length, m: med, l: fmt.pct(long / mine.length) }) : '',
        values: mine.map(s => ({ v: Math.min(+s.Minutes, top), data: s })),
      };
    }).filter(g => g.values.length);
    box.appendChild(CH.dotGroups(groups, {
      max: Math.max(10, top), fmt: v => String(v),
      line: { v: p75, label: t('trig.dots.long', 'long: {m}+ min', { m: p75 }) },
      onLeave: () => tip.hide(),
      onHover: (s, evt) => tip.show(card => {
        card.appendChild(el('div', { class: 'tipcard-h' }, [
          el('b', { text: `${s.Minutes} min` }),
          el('span', { class: 'tipcard-v', text: `${shortDate(s.Date)} ${s.Start}` }),
        ]));
        card.appendChild(el('p', { class: 'tipcard-note', text: t('trig.dots.tip', '{i} posts and videos, {st} stories, {a} ads · opened into {o}{p}', {
          i: s.Items, st: s.Stories, a: s.Ads, o: ctxLabel(s['Opened with']).toLowerCase(),
          p: s['Pulled by'] === 'A message' ? t('trig.dots.msg', ', after a message') : '',
        }) }));
        const acts = [[s.Acts, t('trig.dots.acts', 'acts')], [s.Searches, t('trig.dots.searches', 'searches')],
          [s['Messages sent'], t('trig.dots.sent', 'messages sent')]].filter(a => +a[0]);
        if (acts.length) card.appendChild(el('p', { class: 'tipcard-note', text: acts.map(a => `${a[0]} ${a[1]}`).join(' · ') }));
      }, evt),
    }));
    $('#trig-dots-note').textContent = t('trig.dots.note', 'Each dot is one session; the short tick on each row is its median, the dashed line marks the top quarter of all sessions shown. Opening = the first five minutes. Sessions over {m} min sit at the right edge.', { m: top });
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

  // ── Range and view switches ─────────────────────────────────────────────────
  function syncControls() {
    document.querySelectorAll('#range [data-range]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.range === range)));
    const custom = $('#range-custom');
    if (custom) custom.hidden = range !== 'custom';
    const from = $('#range-from');
    const to = $('#range-to');
    if (from && to) {
      const tp = trendPeriods();
      if (range === 'custom' && (!customFrom || !customTo) && tp) { customFrom = tp.from; customTo = tp.to; }
      from.value = customFrom || '';
      to.value = customTo || '';
    }
  }
  function saveRange() {
    try { localStorage.setItem('ii-range', JSON.stringify({ range: range, from: customFrom, to: customTo })); } catch (e) { /* this visit only */ }
  }
  function wireRange() {
    document.querySelectorAll('#range [data-range]').forEach(b => b.addEventListener('click', () => {
      range = b.dataset.range;
      saveRange();
      if (payload) render();
    }));
    ['#range-from', '#range-to'].forEach(sel => {
      const input = $(sel);
      if (!input) return;
      input.addEventListener('change', () => {
        customFrom = $('#range-from').value;
        customTo = $('#range-to').value;
        saveRange();
        if (payload && customFrom && customTo) render();
      });
    });
    document.querySelectorAll('#heat-mode [data-heat]').forEach(b => b.addEventListener('click', () => {
      heatMode = b.dataset.heat;
      const tp = trendPeriods();
      if (tp) drawThemeHeat(tp);
    }));
    document.querySelectorAll('#emo-mode [data-tone]').forEach(b => b.addEventListener('click', () => {
      toneMode = b.dataset.tone;
      if (payload) drawEmotions();
    }));
    document.querySelectorAll('#dots-by [data-by]').forEach(b => b.addEventListener('click', () => {
      dotsBy = b.dataset.by;
      const scope = payload ? triggerScope() : null;
      if (scope) drawSessionDots(scope.sessions);
    }));
  }

  // ── Wiring ──────────────────────────────────────────────────────────────────
  function wireControls() {
    wireRange();
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
