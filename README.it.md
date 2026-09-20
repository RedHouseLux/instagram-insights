# Instagram Insights

*[English](README.md) · **Italiano** · [Sito del progetto](https://redhouselux.github.io/instagram-insights/it/)*

Un Foglio Google che legge il tuo export mensile di dati Instagram da una cartella di Drive e costruisce una dashboard con temi, ritmo di attività, indicatori comportamentali e segnali di rischio, confrontati mese su mese. Gira interamente dentro il tuo account Google; niente viene mandato a un'AI o a qualsiasi altro servizio.

## Come si installa

Lo fai una volta sola. Dopo va avanti da solo e non ci metti più mano.

Ci sono due parti: **chiedere i tuoi dati a Instagram** e **preparare il foglio che li legge**. Falle in
quest'ordine, perché Instagram ci mette qualche ora a mandarti il primo export e tanto vale aspettarlo con
tutto il resto già pronto.

Il [sito del progetto](https://redhouselux.github.io/instagram-insights/it/) ha le stesse istruzioni con uno
screenshot per ogni tocco. Se lo stai facendo dal telefono, usa quello.

### Parte 1 — chiedi i tuoi dati a Instagram

Apri Instagram sul telefono.

1. Tocca il pulsante **☰** in alto a destra. Poi tocca **Impostazioni e attività**.
2. Tocca **Centro gestione account**. (È la prima voce dell'elenco, con il logo Meta accanto.)
3. Tocca **Le tue informazioni e autorizzazioni**.
4. Tocca **Esporta le tue informazioni**.
5. Tocca **Crea esportazione**. Instagram ti chiede quale account: scegli quello che vuoi analizzare.
6. Ti chiede *dove* mandare l'export. Tocca **Esporta su un servizio esterno**.
7. Scegli **Google Drive** dall'elenco.
8. Ti chiede ogni quanto. Tocca **Weekly**. Poi ti chiede per quanto tempo: scegli **1 year** o più.
   Tocca **Collega**, poi accedi con Google e dai il permesso quando te lo chiede.
9. Un'ultima schermata, con quattro impostazioni. Mettile tutte e quattro:

   | Impostazione | Mettila su |
   |---|---|
   | Personalizza informazioni | tutto selezionato |
   | Intervallo di date | **Ultima settimana** |
   | Formato | **HTML** |
   | Qualità dei contenuti multimediali | **Qualità inferiore** |

   Poi tocca **Avvia esportazione**.

Instagram è a posto. Da adesso manda i tuoi dati sul tuo Google Drive ogni settimana, da solo.

**Due cose che quasi tutti sbagliano qui**, e che rompono tutto in silenzio:

- **Il formato dev'essere HTML**, non JSON. Un export in JSON viene ignorato e non succede niente.
- **Settimanale, non mensile.** Instagram si ricorda solo circa *sette giorni* di quello che hai guardato.
  Un export mensile non contiene un mese di visualizzazioni: contiene l'ultima settimana, e le altre tre le
  perdi. È il settimanale che costruisce davvero un archivio.

La qualità dei contenuti non rompe niente, rende solo i file enormi per nulla. Lasciala bassa.

Il tuo Instagram può essere in **italiano o in inglese**: vengono letti correttamente entrambi. Altre lingue
funzionano in parte: i numeri saranno giusti, ma alcune date ed etichette potrebbero non essere capite.

### Parte 2 — prepara il foglio

**La via facile** è un clic, se qualcuno ti ha condiviso una copia già pronta: apri il link, clicca
**Crea una copia** e salta a *"Adesso accendilo"* qui sotto.

**La via manuale**, se preferisci incollare il codice da solo (o se non esiste ancora un link di copia):

1. Vai su **[sheets.new](https://sheets.new)**. Si apre un foglio vuoto. Chiamalo `Instagram Insights` in
   alto a sinistra.
2. Nella barra dei menu clicca **Estensioni → Apps Script**. Si apre una nuova scheda con dentro un editor
   di codice.
3. Dentro c'è già un piccolo codice di esempio (`function myFunction() { }`). Selezionalo tutto e cancellalo.
4. Apri [Code.gs](Code.gs), copia **tutto** quello che c'è dentro e incollalo in quell'editor vuoto. Premi
   **⌘S** (o **Ctrl+S**) per salvare.
5. Ora aggiungi un secondo file. A sinistra, accanto a "File", c'è un **+**: cliccalo e scegli **HTML**.
   Chiamalo esattamente `NetworkView` (l'estensione `.html` la mette Apps Script). Cancella quello che c'è
   dentro, incolla tutto [NetworkView.html](NetworkView.html) e salva.
6. Aggiungi un terzo file allo stesso modo, ma stavolta scegli **Script**. Chiamalo `Dashboard`. Incolla
   tutto [Dashboard.gs](Dashboard.gs) e salva.
7. Aggiungi un quarto file, **HTML**, chiamato esattamente `Index`. Incolla tutto
   [webapp/Index.html](webapp/Index.html) e salva.

Adesso chiudi la scheda del codice e torna al foglio di calcolo.

### Adesso accendilo

1. **Ricarica la scheda del foglio.** È importante: il menu compare solo quando il foglio si apre.
2. Guarda la barra dei menu. C'è un menu nuovo che si chiama **Instagram Insights**, dopo "Guida". Cliccalo.
3. Clicca **Setup (run once)**.
4. Google ti chiederà il permesso. Vai avanti e scegli il tuo account Google.
5. Poi vedrai una schermata dall'aria minacciosa che dice **"Google non ha verificato questa app"**. È
   normale e non è un problema: è la *tua* copia dello script, che gira come te, sui tuoi dati. Google non
   l'ha controllata perché nessuno l'ha mai sottoposta a controllo. Clicca **Avanzate**, poi
   **Apri (nome del progetto)**, poi **Consenti**.

Fatto. Il setup crea nel tuo Drive una cartella chiamata **Instagram Exports** e la collega al foglio.

> Se dopo aver dato il permesso sembra che **Setup** non faccia niente, cliccalo ancora una volta. Il primo
> clic a volte se lo mangia la schermata dei permessi.

### Cosa succede adesso

Da parte tua, niente. È tutto qui il punto.

Instagram manda un export sul tuo Drive ogni settimana. Lo script guarda nel tuo Drive una volta al giorno,
lo trova, lo sposta nella cartella **Instagram Exports** e lo legge. Non sposti file e non premi niente.

Per guardare i tuoi dati: **Instagram Insights → Open dashboard**.

Per farglielo controllare subito invece di aspettare domani: **Instagram Insights → Process new exports now**.

**Se hai già dei vecchi export** sul computer, trascinali nella cartella **Instagram Exports** su Drive —
vanno bene sia i file `.zip` sia le cartelle scompattate — poi esegui **Process new exports now**. Verranno
letti e aggiunti allo storico.

**Se hai saltato la pianificazione settimanale** e hai chiesto un export una tantum, questa è l'unica parte
che resta manuale: quando Meta ti scrive, metti tu lo `.zip` nella cartella **Instagram Exports**, poi
esegui **Process new exports now**. Per questo va benissimo l'app Drive del telefono.

## Cosa c'è nel foglio

I nomi delle schede e delle colonne restano in inglese: sono identificatori usati dal codice, e tradurli spezzerebbe sia l'elaborazione sia i fogli già esistenti. Le etichette che leggi nella dashboard sono invece tradotte.

| Scheda | Cosa contiene |
|---|---|
| **Dashboard** | Riquadri KPI con sparkline, matrice e registro dei rischi, segnali, interessi silenziosi, 16 grafici e mappe di calore per temi per mese e ora × giorno. Ricostruita a ogni esecuzione. |
| **Monthly** | Una riga per mese con tutte le metriche. Usala come fonte dati per Looker Studio. |
| **Risks** | Il registro dei rischi: 11 rischi valutati probabilità × impatto, con evidenze, tendenza e mitigazione (vedi sotto). |
| **Signals** | Segnalazioni di rischio basate su regole (✅ OK / ℹ️ Info / ⚠️ Attenzione / 🔴 Allarme), cosa significano e qualcosa da provare. |
| **Profile** | Indicatori 0–100 mappati sui Big Five e sulla Teoria dell'Autodeterminazione, più il tono emotivo delle didascalie. Ogni riga spiega la propria formula. |
| **Themes** | Quota di elementi visti e piaciuti per tema. Un post può contare per più temi. |
| **Rhythm** | Attività per ora e giorno della settimana, nel tuo fuso orario. |
| **Daily** | Per giorno: elementi visti, azioni, sessioni e minuti stimati, con la finestra di visualizzazione segnalata. |
| **Hourly** | Attività per ogni ora × giorno, usata dalla mappa di calore. |
| **Top** | Account più visti, account a cui hai messo like, hashtag, inserzionisti negli annunci che hai visto, e gli account con cui hai scambiato note o repost. |
| **Quiet interests** | Account che hai continuato a vedere senza alcuna azione visibile da parte tua (vedi sotto). |
| **Belonging** | Quattro dimensioni dell'appartenenza — Visto, Ascoltato, Investito, Connesso — misurate dove l'export lo consente e segnalate come non misurabili dove non lo consente (vedi sotto). |
| **Network** | Una riga per ogni account che segui, che ti segue o che continui a incrociare, con relazione, stato, cluster tematico e attenzione. Region e Note sono tue da compilare e vengono mantenute a ogni ricostruzione. Vedi sotto. |
| **Actions** | Quello che hai scelto di fare: like, follow, ricerche, blocchi, segnalazioni. |
| **Accounts** | Ogni account che hai visto, a cui hai messo like o che hai cercato, mese per mese. La scheda Network li somma. |
| **Meta** | Etichette pubblicitarie, inserzionisti che detengono i tuoi dati e luoghi che Meta ti associa, ciascuno marcato Nuovo / Invariato / Rimosso. |
| **Prompt** | Un riassunto testuale del mese, già pronto. Incollalo in Claude per un profilo scritto di personalità / emozioni / desideri / rischi. |
| **Settings** | Le liste di parole chiave dietro temi, emozioni e segnali. Modificale liberamente. |
| **Log** | Ogni export elaborato, con il relativo esito. |

## Interessi silenziosi, spiegati

Un **interesse silenzioso** è un account di cui hai visto post o video almeno 5 volte nella finestra di visualizzazione (`QUIET_MIN_VIEWS`, più o meno l'ultima settimana dell'export) senza fare nulla di visibile per tutto il mese: nessun like, nessuna ricerca, nessun nuovo follow.

- **Perché conta.** I like sono ciò che sei disposto a mostrare. Le visualizzazioni ripetute sono ciò che davvero trattiene la tua attenzione. Instagram non esporta il tempo di visione, quindi le visualizzazioni ripetute sono il miglior segnale disponibile per l'attenzione che dai ma non esprimi. Questi account indicano spesso preoccupazioni, curiosità o piaceri inconfessabili più vicini al presente di quanto facciano i tuoi like.
- **Colonne.**
  - **Times seen**, diviso fra post e video.
  - **You follow**: *Yes* significa fedeltà passiva verso un account che avevi scelto. *No* significa che è il feed a continuare a spingertelo.
  - **Vs previous**: *Continuing* significa che era silenzioso anche il mese scorso, il che è un segnale più forte. *New* significa che è appena comparso.
  - **Latest caption**, per rinfrescarti la memoria.
- **Avvertenza.** "Visto" significa che Instagram l'ha registrato sul tuo schermo. Non significa che l'hai guardato fino in fondo, quindi un account su cui l'algoritmo insiste può comparire anche se lo scorri via.

## Appartenenza, spiegata

Quattro elementi di cui è fatta l'appartenenza, una riga ciascuno per mese e per settimana. L'export può dire qualcosa su due di essi ed è muto sugli altri due — e le righe mute restano nella scheda invece di sparire, perché una riga assente si legge come "niente da segnalare" mentre la verità è "non è mai stato misurato niente".

| Dimensione | Stato | Costruita da |
|---|---|---|
| **Connesso** | Misurato | `note_and_repost_interactions.html` — note e repost in cui vi siete presentati entrambi. Valutato come ampiezza dei contatti reciproci distinti rispetto a `BELONGING_TIES_FULL` (valore predefinito 15), con tetto a 100. Gli account coinvolti compaiono anche nella scheda **Top** come elenco *Notes & reposts*. |
| **Visto** | Solo indiretto | `profiles_reached.html` e `content_interactions.html`. Il punteggio è account che hanno interagito ÷ account raggiunti — un tasso di risposta. Misura l'essere *guardato*, non l'essere *riconosciuto*, che è un'altra cosa, ed è etichettato come tale. |
| **Ascoltato** | Non ancora misurabile | Nient'altro che un conteggio di risposte alle storie. `your_instagram_activity/comments/` arriva vuota e la cartella dei messaggi non contiene né contenuti né metadati dei DM: nell'export non c'è nessuna conversazione da leggere. |
| **Investito** | Non ancora misurabile | Assolutamente nulla. Nessun file di un export Instagram descrive qualcuno che agisce a tuo beneficio. |

Note e repost **non hanno alcun timestamp**, e le tre schede dei "past Instagram insights" sono aggregati mobili di circa 90 giorni calcolati da Instagram su una finestra che non coincide con il tuo mese. Tutti e quattro vengono quindi trattati come istantanee — vince la consegna più recente — e mai suddivisi per giorno. È per questo che i numeri della scheda Belonging non si muovono con la finestra di visualizzazione giornaliera come fa il resto della dashboard.

## Rete, spiegata

**Instagram Insights → Apri la vista di rete** disegna la scheda Network come un grafo, dentro la finestra di dialogo, senza caricare nulla da altri siti.
- **Anelli**, dal centro: più vicini · che segui, visti di recente · follow dormienti e fan · non seguiti · non più seguiti (nascosti finché non li attivi).
- **Settori:** il tema principale di ciascun account.
- **Colore:** blu = hai messo like o li hai cercati · arancione = visti, nessuna reazione · grigio = non visti in nessun export.
- **Dimensione del punto:** attenzione, cioè volte viste + 5× like + 3× ricerche.
- **Comandi:** passa il mouse su un punto per i dettagli, clicca per aprire il profilo, usa i chip per filtrare per stato e scorri per ingrandire.

| Stato | Significato ("di recente" = gli ultimi 3 mesi di export, `NETWORK_RECENT_MONTHS`) |
|---|---|
| Close friend | È nella tua lista di amici più stretti |
| Inner circle | Vi seguite a vicenda e di recente gli hai messo like o li hai cercati |
| Engaged follow | Li segui e di recente gli hai messo like o li hai cercati |
| Quiet follow | Li segui e li hai visti 5+ volte di recente, senza reagire |
| Active follow | Li segui e sono comparsi di recente |
| Dormant follow | Li segui, ma non sono comparsi di recente |
| Fan | Ti seguono; tu non ricambi |
| Chosen, not followed | Gli hai messo like o li hai cercati senza seguirli |
| Pushed by feed | Visti 3+ volte di recente, e non li segui |
| Unfollowed · Blocked | Non più nella tua lista di following · nella tua lista dei bloccati |

**Scarica una volta la lista completa dei follower.** Gli export mensili includono tutti quelli che segui, ma solo i follower *nuovi* di quel mese, quindi follow reciproci e fan risultano inizialmente sottostimati.
1. Su Instagram vai su **Centro gestione account → Le tue informazioni e autorizzazioni → Esporta le tue informazioni** e scegli **Alcune delle tue informazioni**.
2. Spunta solo **Follower e profili seguiti**.
3. Scegli **Intervallo di date: Tutto** e **Formato: HTML**, poi metti lo `.zip` nella cartella.

La scheda Log mostrerà allora *connections only*, e non viene aggiunto nessun mese. Ripetilo una volta l'anno per intercettare chi ha smesso di seguirti.

L'export non contiene alcuna informazione su chi seguono i *tuoi* contatti. Per questo i cluster raggruppano gli account per tema e stato condivisi, non per collegamenti fra loro.

## Personalizzazione

- **Temi e liste di parole:** modifica la scheda `Settings`. Nella sintassi delle parole chiave, `parola` corrisponde alle parole che iniziano così, `"parola"` solo alla parola intera, `@account` ai post di quell'account e `#tag` a quell'hashtag. Poi esegui **Rielabora tutto** perché i mesi passati usino le nuove regole.
- **Soglie e formule** stanno in `analyzeExport_` dentro `Code.gs`. Cerca `signal(` e `profileDefs`.
- **Il fuso orario** è `LOCAL_TIMEZONE` in cima a `Code.gs`. Meta stampa gli orari degli export nell'ora del Pacifico etichettandoli come "UTC"; lo script legge lo scostamento reale dall'intestazione di ogni export.
- **La lingua** è `LANGUAGE` in cima a `Code.gs`: `'en'` o `'it'`. Cambia il testo che lo script scrive nel foglio (nomi dei rischi, segnali, appartenenza, indicatori). Dopo averla cambiata esegui **Rielabora tutto**. La dashboard ha un suo selettore di lingua, indipendente da questo.

## Analisi dei rischi, spiegata

Ogni mese vengono valutati 11 rischi con **probabilità × impatto**:
- **Probabilità (1–5)** deriva dai tuoi dati: un punto di base, più uno per ogni soglia superata dalla metrica.
- **Impatto (1–5)** è fisso per ciascun rischio.
- **Punteggio (max 25):** 1–4 🟢 Basso · 5–9 🟡 Medio · 10–15 🟠 Alto · 16–25 🔴 Critico.
- **Indice di rischio (0–100):** il punteggio totale del mese come quota del massimo possibile.

| Codice | Rischio | Determinato da |
|---|---|---|
| R1 | Uso eccessivo | minuti stimati per giorno attivo; +1 se gli elementi visti al giorno sono cresciuti del 40% |
| R2 | Disturbo del sonno | quota di attività fra le 00:00 e le 05:59 |
| R3 | Frammentazione dell'attenzione | dispersione del focus fra i temi |
| R4 | Consumo passivo | rapporto di attività (più basso è, peggio è); +1 se gli interessi silenziosi sono il 40%+ degli elementi |
| R5 | Carico emotivo | linguaggio di ansia e paura ogni 100 elementi |
| R6 | Dieta di notizie negative | quota di notizie |
| R7 | Sforzo fisico | contenuti su dolore, postura e sonno ogni 100 elementi |
| R8 | Manipolazione commerciale | contenuti da funnel di vendita ogni 100 elementi |
| R9 | Esposizione dei dati | inserzionisti che detengono i tuoi dati; +1 con 3+ nuove etichette Meta |
| R10 | Concentrazione del feed | quota di elementi dai tuoi 5 account principali |
| R11 | Contatti indesiderati | blocchi e segnalazioni |

Soglie, impatti e mitigazioni stanno in `RISKS` in cima a `Code.gs`. Sono indicatori comportamentali di rischio ricavati da dati Instagram, non una valutazione clinica o di sicurezza.

## Infografiche più belle (facoltativo, gratuito)

[LOOKER_STUDIO.md](LOOKER_STUDIO.md) contiene una guida passo passo a un report Looker Studio di cinque pagine (panoramica, tempo, contenuti, rischi, profilo) costruito su questo foglio.

## La dashboard (gratuita, collegata al tuo Drive e al tuo foglio)

Una pagina che legge in tempo reale dalle schede che `processNewExports()` tiene già aggiornate — niente da caricare, niente da trascinare. La apri e ti mostra già l'ultimo mese; un pulsante **Controlla Drive ora** ricontrolla Drive su richiesta, oltre al controllo automatico quotidiano.

- **Non serve nessun deployment.** `Instagram Insights → Open dashboard` mostra la stessa pagina in una finestra di dialogo dentro il foglio, eseguita come te e collegata alle stesse schede tramite `google.script.run`. Pubblicarla come app web è facoltativo e serve solo ad avere un indirizzo proprio (comodo sul telefono, o per aprirla senza passare dal foglio).
- **Come installarla da zero:** nel progetto Apps Script del foglio (**Estensioni → Apps Script**), aggiungi [Dashboard.gs](Dashboard.gs), sostituisci `WebApp.gs` con [webapp/WebApp.gs](webapp/WebApp.gs), aggiungi un file HTML chiamato esattamente `Index` con dentro [webapp/Index.html](webapp/Index.html). Per l'indirizzo facoltativo: **Deploy → Nuovo deployment → App web**, **Esegui come: Me**, **Chi ha accesso: Solo me stesso**. Gira con i permessi Fogli/Drive che hai già concesso — gli stessi usati da `setup()` — quindi nessun altro vede mai una schermata di autorizzazione, e le regole di verifica delle app di Google (che riguardano solo uno script che agisce sugli account *di altre persone*) non si applicano.
- **Dopo aver modificato `Code.gs`, `Dashboard.gs` o i file in `webapp/`,** esegui `node build/build-webapp.js` per ricostruire `webapp/Index.html`, poi pubblica l'aggiornamento.
- **Trovare gli export automaticamente:** siccome l'opzione "invia a Google Drive" di Instagram non può essere puntata su una cartella specifica, ogni controllo cerca anche in tutto "Il mio Drive" qualsiasi elemento che contenga "meta" nel nome, verifica che sia davvero un export Instagram prima di toccarlo, e sposta quelli veri nella cartella `Instagram Exports`. Tutto il resto resta esattamente dov'è.

**Lingua:** la dashboard ha un selettore EN/IT in alto a destra e ricorda la tua scelta. Al primo accesso segue la lingua del browser.

Cosa mostra: i riquadri del mese con le variazioni rispetto al mese precedente, gli 11 rischi con evidenze e una freccia di tendenza per rischio, i minuti al giorno, i temi, la mappa di calore ora × giorno, gli account più visti, gli interessi silenziosi, gli indicatori, i segnali e un link alla vista di rete.

## Condividerlo con altri

Ognuno fa girare la propria copia. Nessuno può vedere i dati di nessun altro: non c'è un server condiviso né
un foglio condiviso, quindi non c'è nulla che possa uscire.

Manda le persone sul **[sito del progetto](https://redhouselux.github.io/instagram-insights/it/)**. Spiega
tutto con uno screenshot per ogni tocco, in italiano e in inglese.

Per dare loro la copia in un clic invece di chiedergli di incollare del codice, devi preparare una volta un
**foglio modello**: una copia del tuo foglio con lo script dentro e tutti i tuoi dati tolti. I passaggi, e
gli errori da evitare, sono in [docs/TEMPLATE.it.md](docs/TEMPLATE.it.md).

> **Non condividere mai il tuo foglio di lavoro.** Uno script Apps Script legato a un foglio viaggia insieme
> a lui quando qualcuno lo copia — e con lui viaggia tutto quello che c'è nelle schede. Il modello dev'essere
> una copia separata e svuotata.

## Limiti da conoscere

- **Ogni export contiene solo gli ultimi 7 giorni circa di cronologia di visualizzazione** (post, video, annunci), mentre like, follow e ricerche coprono tutto il mese. Lo script rileva questa *finestra di visualizzazione*; tassi, ritmo e stime di tempo usano solo quei giorni. Temi e interessi silenziosi descrivono quella settimana.
- I minuti stimati derivano dai timestamp registrati, con una sessione che si chiude dopo 15 minuti di silenzio. Consideralo un valore minimo, non una misurazione.
- Temi, emozioni e indicatori nascono da **regole di parole chiave**. Sono approssimazioni di schemi, non una valutazione psicologica.
- Se Meta cambia la struttura dell'export, l'elaborazione può rompersi. La scheda Log mostra un errore invece di scrivere silenziosamente numeri sbagliati.
- Se aggiungi un mese più vecchio dopo altri più recenti, esegui **Rielabora tutto** così i confronti mese su mese vengono ricalcolati.
- Dopo aver incollato una nuova versione di `Code.gs`, esegui **Rielabora tutto** una volta, così i mesi passati ricevono le nuove colonne e schede.

## Test in locale

`node test/run-local.js <cartella con gli export>` fa girare tutta la pipeline su export locali, usando sostituti in memoria per Drive e Fogli. Confronta i conteggi elaborati con l'HTML grezzo e verifica che rieseguirlo non duplichi righe.
