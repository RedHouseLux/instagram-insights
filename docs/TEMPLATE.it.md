# Creare il foglio modello da copiare

*[English](TEMPLATE.md) · **Italiano***

Il passo 2 della pagina di presentazione offre una copia in un clic. Quel link ha bisogno di un **foglio modello**: una copia del tuo foglio funzionante, con lo script allegato e ogni traccia dei tuoi dati rimossa. Finché non lo crei, il pulsante rimanda alle istruzioni manuali del README, quindi nel frattempo non c'è nulla di rotto.

È l'unica parte dell'installazione che non può essere automatizzata da qui: condividere un file nel tuo Drive è un'azione tua, non dello script.

## Perché non condividere semplicemente il tuo foglio

Uno script Apps Script legato a un foglio viaggia insieme a lui. È questo che rende possibile la copia in un clic — ed è anche la trappola: **"Crea una copia" copia anche i dati.** Condividere il tuo foglio di lavoro consegnerebbe a ogni visitatore i tuoi temi, i tuoi account, i tuoi interessi silenziosi e la tua rete. Il modello dev'essere un foglio separato e vuoto.

## Passaggi

1. **Duplica il tuo foglio.** Nel foglio "Instagram Insights": `File → Crea una copia`. Chiamala `Instagram Insights — Modello`. Lo script viene con lei.

2. **Svuotala.** Apri la copia e cancella il contenuto di ogni scheda di dati — `Monthly`, `Weekly`, `Daily`, `Themes`, `Top`, `Network`, `Accounts`, `Actions`, `Belonging`, `Log`, tutte le schede `Weekly *` e le altre. Lascia la riga di intestazione su ciascuna, e non toccare `Settings`: sono le regole predefinite e a un nuovo utente servono.

   **Controlla soprattutto la scheda `Log`**: contiene i nomi dei tuoi file di export.

3. **Cancella la memoria dello script.** Nella copia: `Estensioni → Apps Script → Impostazioni progetto → Proprietà script`. Elimina ogni proprietà. Contengono l'ID della tua cartella degli export e la data dell'istantanea dei follower.

4. **Controlla `Code.gs`.** In cima, `EXPORTS_FOLDER_ID` dev'essere vuoto (`''`), così il `setup()` di ogni nuovo utente crea la propria cartella invece di puntare alla tua. `LANGUAGE` puoi lasciarlo su `'it'` se il modello è pensato per utenti italiani. `LOCAL_TIMEZONE` è un valore predefinito ragionevole da lasciare com'è.

5. **Elimina i deployment della copia.** `Deploy → Gestisci deployment` — rimuovi quelli arrivati con la copia, così nessuno eredita un deployment che punta dalle parti del tuo account.

6. **Condividila.** `Condividi → Accesso generale → Chiunque abbia il link → Visualizzatore`. Visualizzatore è corretto e sufficiente: per copiare serve solo l'accesso in lettura, e Editor permetterebbe a degli sconosciuti di modificare il modello che copiano tutti gli altri.

7. **Prendi l'ID** dall'URL — la stringa lunga fra `/d/` e `/edit`:

   ```
   https://docs.google.com/spreadsheets/d/QUESTA_PARTE_QUI/edit
   ```

8. **Incollalo nella pagina.** In `docs/index.html` e `docs/it/index.html`, trova:

   ```js
   var TEMPLATE_SHEET_ID = '';
   ```

   Metti l'ID fra gli apici in **entrambi i file** e fai commit. Il pulsante diventa una vera copia in un clic; la pagina costruisce da sé l'URL `/copy`.

## Verificalo prima di annunciarlo

Apri il link `/copy` **in una finestra di navigazione in incognito, con un altro account Google** (oppure chiedi a qualcuno). Stai controllando tre cose:

- La copia arriva con lo script allegato e il menu presente.
- Non contiene **nessuno dei tuoi dati** — scorri le schede.
- `setup()` viene eseguito e crea una cartella `Instagram Exports` nuova nel Drive di *quell'* account.

Se la copia contiene le tue righe, fermati e sistema il modello prima di condividere il link da qualsiasi parte. Quell'errore non è recuperabile una volta che le copie sono in giro.

## Quando il codice cambia

Le copie sono istantanee: chi ha copiato ieri non riceve le correzioni di oggi. Dopo una modifica significativa, ripeti i passaggi 1–7 per rigenerare il modello, oppure incolla il `Code.gs` aggiornato nel modello esistente e ricontrolla che sia ancora vuoto. L'ID nella pagina resta lo stesso se aggiorni il modello sul posto.
