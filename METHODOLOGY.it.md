# Metodologia

*[English](METHODOLOGY.md) · **Italiano***

Come Instagram Insights trasforma un export in numeri su di te e — lo scopo di questo documento — come tiene
separato **ciò che Instagram ti ha mostrato** da **ciò che hai fatto**. Ogni formula qui sotto è quella di
`Code.gs`; in ogni sezione è indicata la funzione o la costante da cercare.

## Il problema che risolve

Gran parte di un export Instagram è un registro di ciò che è arrivato sul tuo schermo: post, video, storie e
inserzioni. Ciò che arriva sul tuo schermo lo sceglie soprattutto l'algoritmo di raccomandazione, in base a ciò
con cui tu e persone simili avete interagito prima. Un punteggio costruito su questo descrive il feed almeno
quanto descrive te.

Le versioni precedenti facevano esattamente così. Nove degli undici punteggi di personalità e di "desiderio"
erano la quota di un tema in ciò che ti veniva mostrato — la *Gradevolezza* era la quota di post su Comunità
locale e Ambiente nel tuo feed, l'*Autonomia* la quota di AI & Tech. Solo due (l'uso notturno e il tasso di like
e ricerche) venivano da qualcosa che avevi fatto tu.

Per questo l'analisi ora è divisa in **quattro livelli**, più l'**influenza** tra di essi, e personalità e
bisogni si leggono solo dal comportamento.

## I quattro livelli

| Livello | La domanda | Letto da |
|---|---|---|
| **Esposizione** | Che cosa ti ha raggiunto? | post visti, video guardati, inserzioni viste, storie viste — divisi tra account che segui, account consigliati, inserzioni e storie |
| **Comportamento di consumo** | Come l'hai usato? | sessioni, minuti, ora del giorno, regolarità, visioni ripetute, ricerche, salvataggi, link aperti, unfollow, "non mi interessa" |
| **Comportamento sociale** | Che cosa hai fatto verso le persone? | like, like ai commenti, like alle storie, commenti scritti, messaggi diretti inviati, conversazioni avviate, follow, i tuoi post, storie e reel |
| **In entrata** | Che cosa hanno fatto le persone verso di te? | messaggi diretti ricevuti, se e quanto in fretta ti hanno risposto, copertura, visite al profilo, interazioni, follower |
| **Influenza** | Come si rapportano il primo livello e gli altri due? | l'esposizione contro le azioni che hai scelto, per tema e nel tempo |

I livelli non vengono mai mediati in un unico punteggio. Ogni sezione del cruscotto e ogni riga della scheda
Profile dice quale livello legge (colonna `Layer`).

### Dove va ogni file dell'export

| File | Livello | Note |
|---|---|---|
| `posts_viewed.html`, `videos_watched.html` | Esposizione | ~7 giorni di cronologia per export — la *finestra di visualizzazione* |
| `ads_viewed.html` | Esposizione | |
| `stories_viewed.html` | Esposizione | le storie arrivano da account che segui: l'unico registro di visione della tua cerchia |
| `liked_posts.html`, `liked_comments.html`, `story_likes.html` | Sociale | approvazione data, visibile all'autore |
| `saved_posts.html` | Consumo | tenuti separati dai like: un salvataggio è un appunto per te stesso, un like un segnale all'autore |
| `post_comments_N.html` | Sociale | solo i tuoi commenti; le risposte non vengono esportate |
| `messages/inbox/*/message_N.html` | Sociale + In entrata | messaggi diretti, in entrambe le direzioni (vedi *Conversazioni*) |
| `profile_searches.html`, `word_or_phrase_searches.html` | Consumo | il segno più forte di un interesse partito da te |
| `following.html`, `recently_unfollowed_profiles.html` | Consumo / Sociale | follow, unfollow, e chi seguivi *in quel momento* |
| `link_history.html` | Consumo | link aperti nel browser interno; la gestione dell'account (accesso Google, Centro gestione account di Meta) è esclusa |
| `posts_N.html`, `stories.html`, `reels.html`, `instagram_profile_information.html` | Sociale | ciò che hai pubblicato; la pagina del profilo dà la data della tua ultima storia |
| `profiles_reached.html`, `content_interactions.html`, `audience_insights.html` | In entrata | i numeri di Instagram sul tuo account a 90 giorni (vedi *Andamento del profilo*) |
| `note_and_repost_interactions.html` | In entrata | senza date, quindi alimenta Appartenenza → Connesso e nessun punteggio settimanale |

## Regole sulle prove

- **Ogni indicatore porta il numero di prove** (colonna `Evidence`, `n=` sul cruscotto): gli eventi su cui poggia.
- **I punteggi di comportamento con meno di `CONFIG.MIN_EVIDENCE` (3) eventi restano vuoti**, non a zero. Una
  quota calcolata su due azioni non è una misura. I punteggi a tasso (al giorno attivo) richiedono invece 3 giorni attivi.
- **Vuoto non è zero.** Una settimana senza messaggi non ha un "tasso di risposta", e il cruscotto lo dice invece
  di disegnare 0%.
- **Le regole per parole chiave sono approssimazioni.** Temi e toni emotivi vengono dagli elenchi nella scheda
  Settings. Gli elementi senza didascalia ereditano i temi abituali di un account solo quando quell'account ha
  3+ elementi con tema e il tema ne copre più della metà.
- **I vocali non contengono testo.** Il tono delle tue parole o di quelle degli altri si legge solo dal testo scritto.

## Personalità e bisogni — dal comportamento

Framework `Personality · Big Five (behaviour)` e `Needs · Self-Determination Theory (behaviour)`. Tutti i
punteggi vanno da 0 a 100 e ogni riga stampa la propria formula. Sono indicatori di come ti *comporti su
Instagram* in una settimana o in un mese, non un test di personalità.

| Indicatore | Formula | Prove |
|---|---|---|
| **Apertura** · ampiezza di ciò che cerchi | Entropia normalizzata delle azioni che hai scelto tra i temi, pesate per sforzo (`CONFIG.ACTION_WEIGHTS`: ricerca 3, commento 3, salvataggio 2, follow 2, like 1, like a storia 1, like a commento 1), divisa per log(min(temi, azioni)) così che poche azioni non vengano penalizzate per essere poche | azioni con un tema |
| **Coscienziosità** · uso regolare e contenuto | Media di: 1 − min(1, 4 × quota notturna), e regolarità d'uso = 1 − min(1, coefficiente di variazione dei minuti giornalieri nella finestra di visualizzazione, giorni tranquilli inclusi) | giorni nella finestra |
| **Estroversione** · atti sociali verso l'esterno | (like + like ai commenti + like alle storie + commenti + messaggi inviati + follow) per giorno attivo; 20 al giorno = 100 | giorni attivi |
| **Gradevolezza** · disponibilità verso gli altri | Quota dei turni dell'altra persona a cui hai risposto entro `CONFIG.REPLY_WINDOW_HOURS` (24h) | i loro turni |
| **Sensibilità emotiva** · tensione nel comportamento | Media delle parti con prove sufficienti: min(1, 4 × quota notturna); quota degli elementi che hai scelto (like, salvataggi, commenti, ricerche) con tono pesante (ansia, tristezza, rabbia, paura); quota delle tue parole scritte con tono pesante. *Non è una diagnosi.* | elementi scelti + tuoi testi |
| **Autonomia** · consumo scelto da te | (elementi del feed da account che seguivi in quel momento + storie) ÷ (elementi del feed + storie) | elementi |
| **Competenza** · atti di apprendimento | (salvataggi + link aperti + domande fatte in commenti o messaggi + ricerche di parole) per giorno attivo; 3 al giorno = 100 | giorni attivi |
| **Relazione** · contatto a due vie | Persone con cui hai scambiato messaggi diretti in entrambe le direzioni; 5 = 100. Note e repost restano ad Appartenenza → Connesso: non hanno date, quindi ogni settimana di una consegna riceverebbe la stessa lista | giorni attivi |

"Che seguivi in quel momento": la lista dei seguiti viene dall'export più recente, quindi un account a cui hai
smesso di seguire *dopo* una certa settimana viene rimesso tra i seguiti di quella settimana usando la data
dell'unfollow (`unfollowedAll` in `mergeForMonth_`).

## Dieta del feed — dall'esposizione

Framework `Feed diet · what you were shown`, livello `Exposure`. Sono i vecchi indicatori a quota di tema,
rinominati per ciò che misurano:

| Indicatore | Formula |
|---|---|
| Ampiezza del feed | 60% dispersione tra temi + 40% varietà di account in ciò che ti è stato mostrato |
| Quota consigliata | elementi da account che non seguivi ÷ elementi con un account noto |
| Carico di inserzioni | inserzioni ÷ (elementi + inserzioni) |
| Contenuti prosociali / vita interiore / tecnologia / denaro e lavoro / comunità e musica / società e pianeta / corpo e salute / arte e creatività | la quota dei temi corrispondenti sugli elementi, scalata così che 30–60% = 100 (ogni riga indica il suo riferimento) |

I rischi di esposizione del registro (carico emotivo, dieta di notizie, pressione commerciale) leggono lo stesso livello.

## Tono emotivo — tre letture

Gli stessi sette elenchi di parole (Settings → Emotion), letti in tre modi:

- **Mostrato** (`Emotional tone · shown`, Esposizione): elementi ogni 100 visti le cui didascalie usano quelle parole.
- **Le tue parole** (`Emotional tone · your words`, Sociale): ogni 100 tra i tuoi commenti e messaggi scritti.
- **Parole per te** (`Emotional tone · words to you`, In entrata): ogni 100 messaggi scritti ricevuti.

## Influenza — il feed contro le tue scelte

**Quota di azioni e lift, per tema** (scheda Themes). La *quota di azioni* è la quota di un tema sulle tue
azioni scelte e pesate; *Lift* = quota di azioni ÷ quota vista. Sopra 1 cerchi quel tema più di quanto il feed
te lo mostri; sotto 1 il feed te lo mostra più di quanto tu ci agisca. Il lift resta vuoto dove il feed non ha
mostrato nulla di un tema: "cercato, mai mostrato" è un fatto diverso, non un numero grande. Il cruscotto
disegna entrambe le quote per tema come un manubrio.

**Allineamento al feed** (Profile, `Influence`). 100 × (1 − distanza di variazione totale) tra due distribuzioni
sui temi con nome: le tue azioni pesate e gli elementi mostrati. 100 significa che hai scelto esattamente in
proporzione a ciò che ti è stato mostrato; più basso significa che sei andato a cercare cose che il feed non ti
dava. Un allineamento alto da solo è ambiguo — può voler dire che il feed ti ha capito bene o che ti sta
guidando — ed è per questo che esistono i due indicatori seguenti.

**Scoperta partita da te** (Profile, `Influence`). Per ogni account su cui hai agito nel periodo (like,
salvataggio, commento, like alla storia, follow) senza seguirlo già: **partita da te** se l'avevi cercato prima
del primo atto, **partita dal feed** se il feed te l'ha mostrato prima e non l'avevi cercato. Tutto il resto
(conosciuto in una storia, in un messaggio, fuori da Instagram) non è né l'uno né l'altro e non viene contato.
Punteggio = partite da te ÷ (partite da te + partite dal feed); i conteggi sono nelle schede Monthly/Weekly.

**Direzione dell'influenza** (solo sul cruscotto, servono 12 settimane consecutive con almeno il 50% di
copertura). Per tema, le variazioni da una settimana all'altra della quota vista (Δe) e della quota di azioni
(Δa), raccolte su tutti i temi:
- *il feed guida te*: correlazione tra Δe nella settimana *t* e Δa nella settimana *t+1*;
- *tu guidi il feed*: correlazione tra Δa nella settimana *t* e Δe nella settimana *t+1*.

È una correlazione, non una prova di causa; finché non ci sono 12 settimane il cruscotto mostra quante ne ha.

## Conversazioni

Dai messaggi diretti (`conversationStats_`). Il **testo dei messaggi viene letto solo per valutarne il tono e per
contare le domande, e non viene mai scritto** in alcuna scheda, nel Prompt o nel cruscotto. Ciò che viene salvato
per persona e per periodo (scheda Conversations): messaggi inviati e ricevuti, vocali in ciascuna direzione,
conversazioni, chi le ha avviate, turni con risposta in ciascuna direzione, tempi mediani di risposta, e quanti
messaggi avevano un tono pesante.

- Un **turno** è una sequenza di messaggi consecutivi dalla stessa parte: dodici vocali di fila sono un turno.
- Una **conversazione** è una sequenza di turni senza silenzi più lunghi di `CONFIG.CONVERSATION_GAP_HOURS` (8h).
- Un turno **ha risposta** quando il turno successivo dell'altra parte inizia entro `CONFIG.REPLY_WINDOW_HOURS` (24h).
- Un turno che finisce meno di 24h prima della fine dell'export non ha ancora avuto la sua occasione e **non
  conta né in un senso né nell'altro**.
- "Tu" vieni riconosciuto dal nome visualizzato in `personal_information.html`; senza quella pagina, come l'unico
  mittente presente in ogni conversazione.

**Appartenenza → Ascoltato** ora è misurata: la quota dei tuoi turni che hanno ricevuto risposta entro 24h, con
il dettaglio per persona. Misura il ricevere *risposta*, non l'essere ripresi o riconosciuti, e le risposte ai
tuoi commenti pubblici non sono ancora nell'export.

## Fattori di contesto

Cosa è venuto subito prima di ciò che hai fatto (`contextTriggers_`). Sei comportamenti, ciascuno contato rispetto
ai contesti che avrebbe potuto seguire. **Sono associazioni, non cause**: dicono cosa va insieme nei tuoi dati, non
cosa provoca cosa — il feed che ti ha richiamato potrebbe essere anche quello che avresti aperto comunque.

| Comportamento | Contato per | Un caso è |
|---|---|---|
| **Pull** — aprire l'app | minuto libero (un minuto in cui non eri già in una sessione) | una sessione che inizia in quel minuto |
| **Stay** — sessioni lunghe | sessione | minuti nel quarto più lungo delle sessioni del periodo (≥ il suo 75° percentile) |
| **Late** | sessione | inizio tra le 00:00 e le 05:59 |
| **Act** — like, salvataggio, commento, follow, like a una storia | elemento visto in una sessione | hai agito su quell'elemento (stesso URL) o sul suo account entro 30 minuti |
| **Seek** — ricerca, link | elemento visto · sessione | una ricerca o un link nei 10 minuti dopo l'elemento · in qualsiasi punto della sessione |
| **Reach** — messaggio, commento | elemento visto · sessione | un messaggio inviato o un commento scritto nei 10 minuti dopo · in qualsiasi punto della sessione |

**Contesti**, in cinque famiglie:

- *Quando*: momento del giorno (notte 00–06, mattina, pomeriggio, sera 18–24), giorno feriale o fine settimana.
- *Cosa è venuto subito prima*: un messaggio arrivato nei 10 minuti precedenti (Pull) o prima dell'inizio di una
  sessione (Richiamato da); un tuo post, storia o reel nell'ora precedente; su cosa si è aperta la sessione (feed,
  storie, messaggi, ricerca); il ritorno entro 30 minuti dalla sessione precedente; un'altra storia dello stesso
  account nell'ora precedente.
- *Cosa c'era sullo schermo*: formato (post, video, storia, inserzione), di chi era (un account che segui o no),
  tono (pesante = le liste di ansia, tristezza, rabbia e paura; leggero = speranza, gioia, amore), tema.
- *Come è iniziata la sessione*: le stesse quattro cose, lette sui suoi **primi cinque minuti** — la durata di una
  sessione si legge rispetto a come è iniziata, non rispetto a tutto ciò che ha poi mostrato (una sessione lunga
  mostra più di tutto). Un quarto o più di elementi pesanti fa un inizio pesante.
- *Quanto dentro la sessione*: primi 5 minuti, 5–20, oltre 20.

Ogni dimensione divide l'intera esposizione del suo comportamento, quindi le sue righe sommano allo stesso totale.
"Aperto su" è escluso da Seek e Reach, perché una sessione aperta da una ricerca o da un messaggio ne contiene una
per definizione.

**Metodo.** Il foglio salva conteggi — *Exposure* e *Hits* per contesto (Triggers, Weekly triggers) — mai tassi,
così qualsiasi intervallo di periodi si somma esattamente: Σ casi ÷ Σ esposizione sulle sue settimane o mesi. Il
**rapporto** (lift) di un contesto è il suo tasso rispetto al tasso complessivo del comportamento sulla stessa
dimensione, dopo averlo avvicinato a quel tasso con tre casi di prior: con `p₀` il tasso complessivo e `m = 3 / p₀`,
`lift = ((casi + m·p₀) / (esposizione + m)) / p₀`. Due su tre non possono superare trenta su trecento.

- **Prove**: meno di 3 casi è *troppo poco* — mostrato a puntini, mai in classifica; 3–9 è *qualche prova*; 10 o
  più è *prove solide*. Un contesto che rende qualcosa più raro si vede dall'assenza di casi, quindi le prove di un
  freno sono i casi che avrebbe avuto al ritmo abituale.
- **Classifica**: solo rapporti ≥ 1,25 (più spesso) o ≤ 0,8 (meno spesso); forza = |ln rapporto|, × 0,6 per
  *qualche prova*. I contesti che sono l'assenza di uno ("nulla visto", "nessuna storia prima") si contano ma non
  entrano mai in classifica.
- **Collegamenti sociali**, riportati come quote con i loro conteggi: conversazioni avviate da te entro un giorno
  da una storia di quella persona (la conversazione si abbina alla storia tramite il nome visualizzato), like entro
  un'ora da una storia di quell'account, sessioni iniziate entro 10 minuti dall'arrivo di un messaggio, ritorni
  rapidi.
- **Azioni su elementi visti / altrove**: un like o un salvataggio cade su qualcosa che il registro delle
  visualizzazioni contiene (lo stesso post, o il suo account nella mezz'ora precedente) oppure arriva da un posto che
  non ha registrato — un profilo, una condivisione, il web.

Comportamenti così rari si accumulano lentamente: una settimana contiene 40–55 sessioni, abbastanza per gli schemi
delle sessioni in poche settimane, ma solo una manciata di azioni deliberate, quindi gli schemi di act, seek e reach
si costruiscono in mesi. Il cruscotto dice *troppo pochi* invece di indovinare, e il filtro dell'intervallo è il modo
in cui le prove si sommano.

## Andamento del profilo

Scheda Performance, una riga per ogni finestra di 90 giorni (`performanceRows_`, `upsertPerformance_`).

- **Finestre mobili, non settimane.** Ogni export contiene le schede di Instagram per i 90 giorni che terminano
  il giorno prima. Gli export settimanali danno quindi finestre a 7 giorni l'una dall'altra che **condividono 83 giorni**.
- **Somme, conteggi unici e livelli.**
  - Impression, visite al profilo, interazioni con i contenuti, tocchi sul link: somme sulla finestra. Due
    finestre non vanno mai sommate. La loro differenza è *la settimana entrata meno quella uscita* (13 settimane
    prima), non l'ultima settimana — il cruscotto la etichetta così.
  - Account raggiunti, account che hanno interagito: account unici; non si sommano affatto.
  - Follower: un numero nel giorno — l'unica normale serie temporale.
- **Finestra precedente ricavata.** Ogni scheda indica la propria variazione rispetto ai 90 giorni precedenti.
  precedente = valore ÷ (1 + variazione), arrotondato, salvato come riga `Worked out` per la finestra indicata
  nella riga "rispetto a" della scheda. A −100% non si ricava nulla: il valore è sceso a zero, il che non dice da
  quanto. Il primo export disegna quindi una linea, non un punto. Una finestra riportata sostituisce sempre una
  ricavata per le stesse date.
- **I tassi** sono più stabili dei conteggi: tasso di interazione = account che hanno interagito ÷ raggiunti;
  tasso di visite = visite ÷ raggiunti; quota della copertura da non follower, come riportata.
- **Contesto di pubblicazione.** La data della tua ultima storia (informazioni del profilo) è segnata sui grafici,
  e il cruscotto dice quando la finestra mobile smette di includerla (ultima storia + 90 giorni). Un calo delle
  interazioni dopo quella data è la finestra che perde la tua ultima pubblicazione, non il pubblico che se ne va.
- **Entrambe le lingue.** Le etichette si confrontano ignorando le maiuscole (le schede inglesi scrivono
  "Accounts Reached", quelle italiane "Account raggiunti") e i numeri si leggono con entrambe le convenzioni:
  "1,014" (inglese) e "1.130" (italiano) sono migliaia; "85.5%" e "85,8%" sono decimali.

## Tempo

- **Periodi.** Ogni export viene diviso per data reale in settimane ISO e mesi di calendario (`mergeForMonth_`).
  Dove due consegne coprono lo stesso tratto di tempo, si tengono solo gli elementi della più recente. L'attribuzione
  è per *tempo*: ogni consegna possiede l'intervallo dal suo primo al suo ultimo elemento di ciascun tipo.
  (L'attribuzione per giorno di calendario perdeva la metà di giornata della consegna più vecchia nel giorno in
  cui due export settimanali si incontrano — ogni settimana.)
- **Copertura** = giorni di cronologia di visualizzazione ÷ giorni del periodo. Sotto `CONFIG.MIN_TREND_COVERAGE`
  (50%) un periodo viene scritto e mostrato, ma disegnato vuoto e mai usato come riferimento.
- **Filtro dell'intervallo.** *Ultima settimana* disegna giorni; *8 settimane* e *6 mesi* disegnano settimane;
  *Tutto* disegna settimane fino a circa quattordici mesi, poi mesi; *Personalizzato* sceglie in base alla lunghezza
  (≤ 14 giorni per giorno, ≤ ~6 mesi per settimana, altrimenti per mese). Gli intervalli predefiniti non risalgono
  mai prima del primo export.
- **Il tuo intervallo abituale** (la fascia ombreggiata) è ciò che hanno coperto gli 8 periodi utilizzabili
  precedenti, escludendo il valore più alto e il più basso quando ce ne sono almeno sei; ne servono almeno quattro.
  Un anello segna un punto che ne esce.
- **I vuoti restano vuoti**: una settimana mancante non è uno zero.
- **Sessioni** (`sessionsOf_`): tratti di attività senza silenzi più lunghi di 15 minuti, letti da ogni timestamp
  che ti mostra sull'app: elementi visti e su cui hai agito, storie, inserzioni e i messaggi che hai inviato. Minuti
  al giorno, sessioni al giorno e la scheda Sessions vengono tutti dallo stesso calcolo, quindi coincidono sempre.
  Contare storie, inserzioni e messaggi ha alzato minuti e sessioni al giorno rispetto alle versioni precedenti,
  che contavano solo elementi del feed e azioni; il ritmo per ora del giorno conta ancora elementi e azioni.

## Privacy

Tutto gira nel tuo account Google. Il testo dei messaggi diretti viene letto in memoria per il tono e mai salvato.
La scheda Prompt — l'unico testo pensato per essere incollato altrove — contiene conteggi e tempi dei messaggi,
mai il contenuto. `node test/run-local.js` verifica che nessun testo di messaggio compaia in alcuna cella.

## Limiti

- Instagram conserva circa 7 giorni di cronologia di visualizzazione per export; sono gli export settimanali a
  costruire uno storico.
- I minuti sono una stima minima costruita dai timestamp registrati (una sessione finisce dopo 15 minuti di silenzio).
  Il tempo passato a leggere una conversazione o un link nell'app non lascia timestamp finché non fai qualcosa.
- I fattori di contesto sono associazioni dentro i tuoi dati, non cause.
- I tuoi commenti vengono esportati; le discussioni in cui si trovavano e le risposte no.
- Post, storie e reel tuoi vengono letti da pagine che gli export settimanali su cui è stato costruito questo non
  contenevano; si contano per timestamp distinti e vanno controllati la prima volta che compaiono.
- Niente di tutto questo è una valutazione psicologica. Gli indicatori descrivono il comportamento su un'app, in
  un periodo, attraverso regole per parole chiave.

## Modificarlo

| Cosa | Dove |
|---|---|
| Soglia delle prove, finestra di risposta, pausa tra conversazioni, pesi delle azioni | `CONFIG` in cima a `Code.gs` |
| Formule degli indicatori | `profileDefs` in `analyzeExport_` |
| Comportamenti, contesti e soglie dei fattori di contesto | `contextTriggers_`, `TRIGGER_MIN_HITS`, `TRIGGER_STRONG` (e `rankTriggers` in `webapp/app.js`) |
| Metriche dei livelli (colonne Monthly/Weekly) | `layerColumns` in `analyzeExport_` |
| Elenchi di parole per temi, emozioni, segnali | la scheda Settings (poi *Rielabora tutto*) |
| Campi ed etichette dell'andamento del profilo | `PERF_FIELDS` |
| Grafici e intervalli del cruscotto | `webapp/app.js` (`TREND_LAYERS`, `PERF`, `trendPeriods`), poi `node build/build-webapp.js` |
