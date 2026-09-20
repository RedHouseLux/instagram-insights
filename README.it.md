# Instagram Insights

*[English](README.md) · **Italiano** · [Sito del progetto](https://redhouselux.github.io/instagram-insights/it/)*

Un Foglio Google che legge il tuo export mensile di dati Instagram da una cartella di Drive e costruisce una dashboard con temi, ritmo di attività, indicatori comportamentali e segnali di rischio, confrontati mese su mese. Gira interamente dentro il tuo account Google; niente viene mandato a un'AI o a qualsiasi altro servizio.

## Installazione una tantum (circa 5 minuti)

1. **Crea il foglio.** Vai su [sheets.new](https://sheets.new) e chiamalo `Instagram Insights`.
2. **Aggiungi lo script.** Nel foglio, apri **Estensioni → Apps Script**. Cancella il codice di esempio, incolla tutto [Code.gs](Code.gs) e salva (⌘S).
   - Per il grafo della rete, clicca **+ → HTML**, chiama il file `NetworkView` (Apps Script aggiunge `.html`), incolla tutto [NetworkView.html](NetworkView.html) e salva.
3. **Esegui setup.** Nella barra degli strumenti di Apps Script, scegli `setup` dall'elenco delle funzioni e clicca **Esegui**.
   - Google chiede il permesso di usare Drive, Fogli e i trigger. Scegli il tuo account.
   - Alla schermata "Google non ha verificato questa app", clicca **Avanzate → Apri (nome del progetto)**. È il tuo script.
4. Tornato nel foglio, il setup mostra il link alla tua cartella **`Instagram Exports`** su Drive. La crea, a meno che tu non ne abbia già una con lo stesso nome. Per usare una cartella diversa, incolla il suo ID in `EXPORTS_FOLDER_ID` in cima a `Code.gs` ed esegui di nuovo `setup`.
5. **Carica i mesi passati.** Metti in quella cartella gli export che hai già, sia i file `.zip` sia le cartelle scompattate. Poi ricarica il foglio e scegli **Instagram Insights → Processa i nuovi export ora**.

## Ogni mese

1. Su Instagram vai su **Centro gestione account → Le tue informazioni e autorizzazioni → Esporta le tue informazioni**, poi **Crea esportazione**. Richiedi le tue informazioni di Instagram con:
   - **Formato: HTML.** Gli export in JSON vengono ignorati.
   - **Intervallo di date:** l'ultimo mese.
   - **Qualità dei contenuti: bassa.** I media non servono.
   - L'export funziona sia in italiano sia in inglese: le date e le etichette dei campi sono riconosciute in entrambe le lingue.
2. Quando arriva l'email di Meta, scarica lo `.zip` e mettilo nella cartella `Instagram Exports`. Va bene anche l'app Drive del telefono.
3. Tutto qui. Lo script controlla la cartella ogni giorno verso le 08:00 e aggiorna tutto. Per farlo subito, usa **Instagram Insights → Processa i nuovi export ora**.

**Meglio ancora: programmalo.** Instagram può esportare direttamente su Google Drive con una pianificazione
ricorrente, ed è questo che costruisce davvero un archivio nel tempo: ogni export contiene solo circa una
settimana di cronologia di visualizzazione. Nel flusso di esportazione scegli **Esporta su un servizio
esterno → Google Drive → Weekly**, per almeno un anno. Il
[sito del progetto](https://redhouselux.github.io/instagram-insights/it/) ha i passaggi con gli screenshot.

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

- **Come installarla da zero:** nel progetto Apps Script del foglio (**Estensioni → Apps Script**), aggiungi [Dashboard.gs](Dashboard.gs), sostituisci `WebApp.gs` con [webapp/WebApp.gs](webapp/WebApp.gs), aggiungi un file HTML chiamato esattamente `Index` con dentro [webapp/Index.html](webapp/Index.html), poi **Deploy → Nuovo deployment → App web**, **Esegui come: Me**, **Chi ha accesso: Solo me stesso**. Gira con i permessi Fogli/Drive che hai già concesso — gli stessi usati da `setup()` — quindi nessun altro vede mai una schermata di autorizzazione, e le regole di verifica delle app di Google (che riguardano solo uno script che agisce sugli account *di altre persone*) non si applicano.
- **Dopo aver modificato `Code.gs`, `Dashboard.gs` o i file in `webapp/`,** esegui `node build/build-webapp.js` per ricostruire `webapp/Index.html`, poi pubblica l'aggiornamento.
- **Trovare gli export automaticamente:** siccome l'opzione "invia a Google Drive" di Instagram non può essere puntata su una cartella specifica, ogni controllo cerca anche in tutto "Il mio Drive" qualsiasi elemento che contenga "meta" nel nome, verifica che sia davvero un export Instagram prima di toccarlo, e sposta quelli veri nella cartella `Instagram Exports`. Tutto il resto resta esattamente dov'è.

**Lingua:** la dashboard ha un selettore EN/IT in alto a destra e ricorda la tua scelta. Al primo accesso segue la lingua del browser.

Cosa mostra: i riquadri del mese con le variazioni rispetto al mese precedente, gli 11 rischi con evidenze e una freccia di tendenza per rischio, i minuti al giorno, i temi, la mappa di calore ora × giorno, gli account più visti, gli interessi silenziosi, gli indicatori, i segnali e un link alla vista di rete.

## Condividerlo con altri

Ogni persona fa girare la propria copia, quindi nessuno vede i dati di nessun altro. Il percorso più semplice è il [sito del progetto](https://redhouselux.github.io/instagram-insights/it/), che spiega tutto passo passo; per preparare il foglio modello da far copiare, vedi [docs/TEMPLATE.it.md](docs/TEMPLATE.it.md).

## Limiti da conoscere

- **Ogni export contiene solo gli ultimi 7 giorni circa di cronologia di visualizzazione** (post, video, annunci), mentre like, follow e ricerche coprono tutto il mese. Lo script rileva questa *finestra di visualizzazione*; tassi, ritmo e stime di tempo usano solo quei giorni. Temi e interessi silenziosi descrivono quella settimana.
- I minuti stimati derivano dai timestamp registrati, con una sessione che si chiude dopo 15 minuti di silenzio. Consideralo un valore minimo, non una misurazione.
- Temi, emozioni e indicatori nascono da **regole di parole chiave**. Sono approssimazioni di schemi, non una valutazione psicologica.
- Se Meta cambia la struttura dell'export, l'elaborazione può rompersi. La scheda Log mostra un errore invece di scrivere silenziosamente numeri sbagliati.
- Se aggiungi un mese più vecchio dopo altri più recenti, esegui **Rielabora tutto** così i confronti mese su mese vengono ricalcolati.
- Dopo aver incollato una nuova versione di `Code.gs`, esegui **Rielabora tutto** una volta, così i mesi passati ricevono le nuove colonne e schede.

## Test in locale

`node test/run-local.js <cartella con gli export>` fa girare tutta la pipeline su export locali, usando sostituti in memoria per Drive e Fogli. Confronta i conteggi elaborati con l'HTML grezzo e verifica che rieseguirlo non duplichi righe.
