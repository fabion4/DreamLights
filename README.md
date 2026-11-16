# Stanza Infinita II

Una stanza di specchi infiniti navigabile in 3D, fatta di sfere e segmenti configurabili,
con galleria, voti, classifica, traguardi e ingresso con visore. Omaggio alle Infinity
Mirror Rooms di Yayoi Kusama.

## Cosa c'è nella cartella

| File | A cosa serve |
|---|---|
| `index.html` | Tutta l'applicazione (versione 2). |
| `vendor/three.min.js` | three.js r128, incluso: non serve internet per il 3D. |
| `server.js` | Server opzionale senza dipendenze: classifica condivisa fra tutti i visitatori. |
| `versione-1/index.html` | La prima versione, tenuta per confronto. |

## Provarlo subito

- **Senza installare niente:** doppio clic su `index.html`. La classifica resta in quel browser.
- **Con classifica condivisa:** serve Node 16 o successivo.

  ```
  node server.js
  ```

  Poi apri `http://localhost:8080`. La prima versione è su `http://localhost:8080/versione-1/`.
  Stanze e voti finiscono in `data/db.json`.

## Metterlo online

- **Hosting statico** (Netlify, GitHub Pages, Cloudflare Pages, un qualsiasi spazio web):
  carica la cartella così com'è. Funziona tutto; la classifica è personale per ogni visitatore.
- **Hosting con Node** (Render, Railway, Fly.io, un VPS): comando di avvio `npm start`.
  Variabili: `PORT` per la porta, `DATA_DIR` per una cartella che sopravvive ai riavvii.
  La classifica è condivisa fra tutti quelli che aprono il sito.

## Pubblicarlo su GitHub

1. Crea un repository vuoto su GitHub e carica il contenuto di questa cartella
   (`index.html` deve stare nella radice del repository).
2. Nel repository apri Settings > Pages, scegli «Deploy from a branch», ramo `main`,
   cartella `/ (root)` e salva.
3. Dopo un paio di minuti il sito è su `https://<utente>.github.io/<repository>/`.

GitHub Pages serve solo file statici: `server.js` lì non gira e la classifica è personale
per ogni visitatore. Il sito è in HTTPS, quindi il pulsante VR compare sui browser compatibili.
La cartella `data/` è esclusa dal repository tramite `.gitignore`.

## Visore

Il pulsante **VR** compare da solo quando il browser supporta WebXR (Meta Quest Browser,
Pico, Chrome su Android con Cardboard, Chrome su PC con visore collegato).

- WebXR richiede **HTTPS** oppure `localhost`. Un sito pubblicato in HTTPS va bene così.
- Per provare dal PC su un Quest collegato via USB: `adb reverse tcp:8080 tcp:8080`,
  poi apri `http://localhost:8080` nel browser del visore.
- Comandi: levetta sinistra cammina, levetta destra gira a scatti, grilletto o pizzico
  passa alla stanza successiva, grip vota la stanza. La modifica si fa fuori dal visore.

## Come funziona il gioco

- Ogni persona pubblica una stanza, ha 5 voti e non può votare la propria.
- Sei stanze «Omaggio» sono già in classifica: composizioni originali di sfere e segmenti
  ispirate a opere di Kusama, non riproduzioni. Si votano come le altre.
- Ogni visita dura 1 minuto e 30, come alle OGR di Torino. Il tempo è solo indicativo.
- In ogni stanza altrui è nascosto un pois d'oro: trovarlo vale 25 punti.
- Punti, livelli e traguardi restano nel browser di chi gioca.
- Ogni settimana c'è una sfida; le stanze che la rispettano ricevono il bollino.

## Da sapere

- Il server identifica i visitatori con un codice casuale salvato nel browser: niente
  account. Chi cancella i dati del browser diventa un visitatore nuovo.
- Non c'è moderazione: per togliere una stanza si ferma il server e si modifica `data/db.json`.
- I caratteri arrivano da Google Fonts; senza rete la pagina usa quelli di sistema.
- L'ingresso con visore non è stato provato su un visore fisico.

## Licenze

Il codice di Stanza Infinita è distribuito con licenza MIT (`LICENSE`): cambia il nome
nella riga del copyright con il tuo. three.js è distribuito con licenza MIT
(`vendor/LICENSE-three.txt`).
