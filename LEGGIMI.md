# Casa 3D per Home Assistant: dettagli tecnici

Questo file spiega come è fatto il kit e come si usa a mano. Chi segue il [prompt](PROMPT.md) non deve leggerlo: lo legge l'AI. I requisiti sono nel [README](README.md).

La parte difficile è già fatta e provata: motore 3D, scheda di Home Assistant, cottura della luce e prove automatiche. Il lavoro per una casa nuova sta tutto in due posti: il **modello Blender** della casa (`blender/casa_<piano>.py`) e **un file di configurazione** (`scheda_ha/casa.config.js`).

## Cosa c'è dentro

| Cartella / file | A cosa serve | Si modifica per una casa? |
|---|---|---|
| `blender/esempio_casa.py` | casa d'esempio (soggiorno e cucina): il modello da copiare | sì, ne fai una copia per piano |
| `blender/base_helpers.py` | mattoni: muri tagliati, porte, finestre, mobili, piante, luci, `lastra_bucata`, `piante_dentro`, `controlla_varchi` | no (solo per aggiungere mattoni per tutti) |
| `blender/dettagli.py`, `sanitari.py`, `arredi_extra.py`, `dispositivi.py`, `realismo.py` | mobili curati, sanitari, arredi, dispositivi (robot, telecamere, sensori…), materiali realistici | no |
| `blender/modello_base.py` | cielo, sole, scheda grafica e accensione delle lampade per la cottura | no |
| `blender/cuoci.py` | cottura in Cycles: giorno, sera e una mappa per ogni lampada | no |
| `blender/dettaglio_web.py` | materiali con disegno fine, applicato nitido dalla pagina | no (i tuoi materiali vanno nel modello, vedi sotto) |
| `blender/pavimento.py`, `ombra.py` | legno nitido del pavimento, ombra morbida a terra (facoltativi) | no |
| `blender/porta.sh`, `impacchetta.py` | dal piano cotto alla cartella `modello_web` (WebP e modello compresso) | no |
| `modello_web/` | la casa pronta per la scheda (all'inizio la casa d'esempio) | la rifà `porta.sh` |
| `scheda_ha/casa.config.js` | **l'unico file della scheda da adattare** | sì |
| `scheda_ha/src/`, `build.sh`, `scripts/` | motore 3D (three.js), scheda e costruzione | no |
| `scheda_ha/prova.html` | pagina di prova senza Home Assistant, con stati finti | no |
| `prove/` | prove automatiche in WebKit (il motore di Safari e dell'app HA su iPad) | no |

## Installazione

Programmi: **Blender 4.2+** (provato con 4.5), **Node.js 20+**, **Python 3**, **libwebp** (`cwebp`, `dwebp`, `webpinfo`), **basisu**. Gli script del kit sono per `bash`: su Mac e su Linux si usano dal terminale normale, su Windows dentro WSL (il Linux integrato in Windows), dove si lavora esattamente come su Linux. I programmi si installano con il gestore di programmi del sistema: per esempio `brew install webp basis_universal` su Mac, `sudo apt install webp` su Linux e su WSL (basisu si scarica dal sito del progetto).

Poi, una volta sola:

```bash
cd strumenti && npm install && cd ..
```

```bash
cd scheda_ha && npm install && cd ..
```

```bash
cd prove && npm install && npx playwright install webkit && cd ..
```

**Dove si trova Blender.** Nei comandi di questa guida `$BLENDER` sta per il programma Blender installato sul computer. Il percorso cambia da sistema a sistema, quindi va impostato una volta per ogni terminale aperto:

| Sistema | Comando |
|---|---|
| Mac | `export BLENDER=/Applications/Blender.app/Contents/MacOS/Blender` |
| Linux | `export BLENDER=blender` (oppure il percorso della cartella in cui è stato scompattato, es. `~/blender-4.5/blender`) |
| Windows (WSL) | `export BLENDER="/mnt/c/Program Files/Blender Foundation/Blender 4.5/blender.exe"` (con la versione installata) |

Va usato il percorso del programma vero: un collegamento simbolico non funziona, perché Blender non trova il suo Python. Lancia **sempre** Blender con `--python-exit-code 1`: senza, un errore a metà script esce con codice 0 e lascia i file vecchi, e sembra che sia andato tutto bene.

## Provalo subito con la casa d'esempio

```bash
cd scheda_ha && bash build.sh
```

```bash
cd scheda_ha/dist && python3 -m http.server 8767
```

Apri http://127.0.0.1:8767/prova.html (con `?el=-10` la vedi di sera). Poi, in un altro terminale:

```bash
cd prove && node prova_kit.mjs ipad11
```

Deve finire con `ESITO: OK`. L'ombra a terra della casa d'esempio non c'è (si crea con `ombra.py`): la richiesta di `ombra_terra.json` che non trova è normale.

## Il flusso per la tua casa

1. **Fonti reali:** planimetria, scansione LiDAR, foto di ogni stanza. Niente si inventa.
2. **Modello:** un file per piano, copiato da `esempio_casa.py`: `casa_terra.py`, `casa_primo.py`, `casa_mansarda.py`… In ognuno `PIANO[0] = "<nome del piano>"` e `ZPAV` = quota del pavimento. Anteprima:

```bash
cd blender && PROVA=1 "$BLENDER" -b --python-exit-code 1 -P casa_terra.py -- ../cotto_terra
```

3. **Cottura**, per ogni piano (prova veloce `RES=1024 RESL=512 CAMP=32`; definitiva `RES=2048 RESL=1024 CAMP=256`, da 20 minuti a qualche ora per piano):

```bash
cd blender && MODELLO=casa_terra.py PIANO=terra "$BLENDER" -b --python-exit-code 1 -P cuoci.py -- ../cotto_terra
```

```bash
cd blender && bash porta.sh ../cotto_terra terra
```

   Ordine completo per piano: `pavimento.py` (se il modello ha `PAVIMENTO_HD`), `cuoci.py`, `ombra.py` (solo il piano base), `porta.sh`. Una cottura in corso non si ferma: per modificare il modello nel frattempo, cuoci su una copia.
4. **Configurazione:** `scheda_ha/casa.config.js` (le chiavi di `entita` sono quelle di `ENT` nel modello).
5. **Prova senza Home Assistant:** `bash build.sh`, la pagina di prova, le prove (sotto), e l'immagine d'attesa con `node prove/poster.mjs ../modello_web` seguita da un nuovo `build.sh`.
6. **Installazione in Home Assistant:**
   - copia il contenuto di `scheda_ha/dist/casa3d` in `/config/www/casa3d`;
   - aggiungi la risorsa `/local/casa3d/casa3d-card.js?v=1` (modulo JavaScript) e alza `v=` a ogni nuova versione;
   - metti la scheda in una vista a pannello:

   ```yaml
   type: custom:casa3d-card
   stanze_da: nome-della-dashboard   # dove stanno le viste delle stanze (percorsi in casa.config.js → viste)
   ```

7. **Prova sulla dashboard vera** (i comandi ad allarmi, serrature e cancelli sono bloccati). Il login lo fa la persona, non uno script:

```bash
cd prove && node login.mjs http://homeassistant.local:8123/la-dashboard/piantina
```

```bash
cd prove && node dashboard_vera.mjs http://homeassistant.local:8123/la-dashboard/piantina ipad11
```

8. Sull'iPad, nell'app di Home Assistant: Impostazioni → App → Debug → **Clear web view cache**, a ogni nuova versione.

## Piani

- `motore.piani` elenca i piani **dal basso verso l'alto**, con nomi liberi: `["terra"]`, `["terra", "primo"]`, `["taverna", "terra", "primo", "mansarda"]`. Il primo è il piano **base**: si carica per primo e porta l'inquadratura della casa e l'ombra a terra.
- Ogni piano ha i suoi file: `casa_<piano>.json`, `casa_<piano>_mod.json` e le mappe `luce_<prefisso><gruppo>_<strato>.webp`. Il prefisso lo decidono `porta.sh` e il motore allo stesso modo (nessuno per "terra", `s_` per "sopra", `<piano>_` per tutti gli altri): non serve scriverlo da nessuna parte.
- `nomi_piani` (fuori da `motore`) dà il nome nella barra e la frase del cambio: `{ mansarda: { nome: "Mansarda", arrivo: "in mansarda", panoramica: "Panoramica mansarda" } }`. Senza, si usa il nome del piano con l'iniziale maiuscola.
- Nella barra c'è "↓ piano sotto" e "↑ piano sopra"; ai piani di mezzo ci sono tutti e due. Il cambio di piano è animato tra qualsiasi coppia di piani, anche non vicini.
- Da un piano si vede quello subito sotto **solo attraverso il foro della scala**: `motore.vuoto_scala` è un rettangolo `[x0, z0, x1, z1]` (metri, coordinate del disegno) uguale per tutti i piani sopra la base, oppure un oggetto piano per piano: `{ primo: [7.3, 1.2, 8.3, 5.5], mansarda: [7.3, 1.2, 8.3, 4.0] }`. Senza foro il piano sotto non si vede.
- `motore.visibili_da_sopra: { chiave: "stanza" }` mette l'icona di un oggetto del piano sotto in una stanza del piano sopra (es. la luce della scala).
- La scheda si riapre all'ultimo piano guardato.

## Giardino, terrazzi e balconi

- Il giardino è la stanza `esterno` del modello. Di serie sta al piano "terra" (o al primo piano dell'elenco); per un altro piano: `motore.piano_giardino`.
- Terrazzi e balconi: stanze del loro piano, elencate in `motore.esterni: ["terrazzo", "balcone_camera"]`. Si comportano come il giardino: entrandoci il resto della casa non si scurisce, il nome sta a terra e si toccano sul pavimento.

## Soppalchi

Un soppalco è una stanza sospesa sopra un'altra stanza dello stesso piano. Nel modello:

```python
SOPPALCHI = {"soppalco": {"quota": 2.3, "sotto": 2.6}}
```

Nel rettangolo della stanza `soppalco` va al soppalco tutto ciò che ha il centro sopra `quota` (metri dal pavimento del piano); le lampade del soppalco non illuminano ciò che sta sotto `sotto`. Il soppalco conserva le facce rivolte in basso, perché si vede anche da sotto. Senza `SOPPALCHI` nessuna stanza è un soppalco, qualunque sia il suo nome. Per vederlo insieme alla stanza sotto: `motore.stanze_unite` e `motore.sfuma`.

## Materiali

- I materiali normali hanno un colore e una finitura e vengono cotti nella luce.
- I materiali con un **disegno fine** (parquet, legno, intonaco, tessuto, piastrelle) ricevono il disegno nitido dalla pagina, sopra la luce cotta. La tabella di serie in `dettaglio_web.py` usa nomi generici: `parquet` (o `parquet_x`, `parquet_y` per il verso delle assi), `legno`, `intonaco`, `muro`, `tessuto`, `piastrella_20`, `piastrella_30`, `piastrella_60`, `piastrella_45` (30 cm posata a 45°).
- **I materiali della tua casa** si aggiungono nel modello, senza toccare il kit:

```python
DETTAGLIO = {
    "rovere_soggiorno": (1, "assi_y", None),     # parquet con le assi lungo y, colore del materiale
    "gres_bagno": (13, None, (0.82, 0.80, 0.76)), # piastrella 60 cm, colore medio indicato
    "divano_lino": (4, None, None),               # tessuto
}
```

  Categorie: 1 parquet, 2 legno, 3 intonaco, 4 tessuto, 12 piastrella 30 cm, 13 piastrella 60 cm, 14 piastrella 20 cm, 15 piastrella 30 cm a 45°.
- `PAVIMENTO_HD = ["legno_pavimento", "top_cucina", "legno_mobili"]` (fino a tre): legni nitidi anche su iPad, con un'immagine unica per tutto il piano (`pavimento.py`), così il disegno continua da una stanza all'altra senza stacchi.
- La luce del giorno e della sera **non si cambia**: è la stessa per ogni casa, perché fa parte dello stile della scheda (vedi sotto, "Luce uguale per tutti").

## Luce uguale per tutti (giorno e sera)

I valori di serie di `modello_base.py` sono quelli della casa di riferimento, e ogni casa si cuoce con questi, senza passarne altri:

- **Giorno:** sole forza 1,33 con ombre morbide (angolo 32°), cielo azzurro `CIELO_COLORE = (0.50, 0.62, 0.85)` con forza 0,75. I muri bianchi restano luminosi e i lati in ombra prendono una tinta grigio-azzurra.
- **Sera:** cielo blu notte con forza 0,45 e luna fredda con forza 0,15. Le stanze **non** hanno una luce calda propria (`NOTTE_W = 0`). Di sera la casa è blu e tenue, e il caldo arriva solo dalle lampade che sono davvero accese in Home Assistant. Per esempio, con solo la piantana accesa si illumina l'angolo della piantana e il resto del soggiorno resta nella luce della notte.
- Con la casa, l'utente sceglie solo la direzione del sole (`SOLE_ROT`), cioè da dove entra il sole dalle finestre.

Nella scheda, il passaggio tra giorno e sera dura 0,6 secondi con la stessa curva per cielo, sfondo della dashboard, schede di Home Assistant (scure di sera) e casa. Il pulsante Auto/Giorno/Sera vale per tutti i dispositivi se in Home Assistant esiste il selettore `input_select.casa_3d_luce` con le opzioni `auto`, `giorno` e `sera`.

## Mattoni strutturali (uguali in ogni casa)

Sono in `base_helpers.py` e `struttura.py` e si caricano da soli. Servono perché ogni casa venga costruita nello stesso modo; il design (infissi, tipo di scala, parapetti, colori, materiali) resta della casa e si decide con l'utente.

| Mattone | Cosa fa |
|---|---|
| `muri_perimetro(casa, sp, aperture)` | muri esterni: nord e sud per tutta la larghezza, est e ovest in mezzo, facciata in un pezzo che gira gli angoli (niente cime sovrapposte che diventano un quadrato nero) |
| `giardino_base(casa, vialetti)` | base chiara che sporge 1,4 m, erba tutto intorno in un pezzo solo, vialetti dalle porte fino al bordo |
| `solaio(casa, z, fori)` | lastra unica sotto un piano alto, con i fori delle scale, del colore della facciata |
| `scala_dritta(...)` | scala tra due piani divisa tra i due modelli (sotto il taglio nel piano sotto, sopra nel piano sopra, nei gruppi ritagliati sul foro). Di serie neutra; opzioni `sospesa`, `led`, `parapetto` secondo la scala vera |
| `lastra_bucata(...)` | pavimento in un pezzo solo con i fori |
| `gruppo_struttura(o)` | gruppi di cottura di facciata, solaio, giardino e scala: nel modello `def gruppo_extra(o): return gruppo_struttura(o)` |

Valori di serie che seguono la regola delle pareti: muri interni e facciata bianchi con intonaco, cielo della cottura azzurro (`CIELO_COLORE`), così le pareti restano luminose e i lati in ombra prendono una tinta grigio-azzurra.

## Regole del modello

- **Muri tagliati a 1,15 m** (`CUT`). Tutto ciò che sta più in alto si vede, ma non è coperto dai muri: TV e sospensioni sì, quadri e mensole alte no. Le icone a parete in `segnali` stanno sotto 1,1 m dal pavimento del loro piano, sulla faccia del muro verso la stanza; i sensori a soffitto (fumo) al centro della stanza.
- **Un pavimento per zona aperta**, non uno per stanza: nell'open space ogni confine diventerebbe una linea.
- **`BOX_STANZE` al centro dei muri:** servono per attenuare le altre stanze esattamente fino al confine.
- **Pavimento con il foro della scala:** `lastra_bucata(nome, x0, y0, x1, y1, z0, z1, [(bx0, by0, bx1, by1)], materiale)`, un pezzo solo, così la luce non mostra giunte.
- **Piante:** dopo averle messe, `piante_dentro([("soggiorno", "cucina")])` stringe le foglie che passerebbero attraverso i muri (gli open space si indicano come gruppi).
- **Porte libere:** la cottura stampa `ATTENZIONE nel vano della porta in (x, y): oggetto` per ogni oggetto dentro il vano di una porta o subito davanti (20 cm). Va spostato sul muro libero accanto. Per controllare senza cuocere: `controlla_varchi()` alla fine del modello.
- **Strisce LED:** circa 1 W per metro di striscia.
- **Scala tra due piani:** stessa entità nei due modelli; i pezzi sotto il pavimento del piano sopra vanno nei gruppi `scala` e `vetro_scala`; una lampada che illumina un gruppo a parte si dichiara in `VICINI`.
- **Gruppi piccoli vicino ai LED** (gradini): `RES_MIN = {gruppo: px}` e `CAMP_X = {gruppo: moltiplicatore}` contro le strisce colorate.
- **Ogni dispositivo ha il suo oggetto** (`dispositivi.py`): campanello, robot con la base, telecamere, sensori.

## Perché al massimo 10 lampade per zona

Ogni lampada che si accende e si spegne ha un'immagine della sua luce, cotta in Blender per ogni stanza o zona che illumina. Quando la pagina disegna una zona, la scheda grafica legge insieme la luce del giorno, quella della sera, il disegno dei materiali, il legno nitido del pavimento, il riflesso degli specchi e **le immagini di tutte le lampade di quella zona**, per sommarle secondo quali sono accese. La scheda grafica dell'iPad può leggere al massimo **16 immagini insieme** in un solo disegno; 5 sono occupate da quelle fisse, quindi ne restano **10 per le lampade**. Il limite vale per ogni zona, non per la casa: una casa può avere 60 lampade, purché nessuna zona ne riceva più di 10.

In un open space ogni lampada illumina tutte le zone aperte, quindi le lampade si sommano: soggiorno, pranzo e cucina con 4 lampade ciascuna fanno 12 per ognuna delle tre zone. Come rientrare:
- unire in una sola entità di Home Assistant le lampade che si accendono sempre insieme (per esempio i faretti dello stesso interruttore, o un gruppo di luci);
- dividere l'open space in zone che non si illuminano a vicenda, se nella realtà è così.

## La configurazione (`casa.config.js`)

Ogni voce è spiegata nei commenti del file. Le principali:
- `entita`: chiave del modello → entità di Home Assistant. Una stessa entità su più chiavi (es. la scala nei modelli di due piani) si accende insieme.
- `segnali`: dispositivi senza luce cotta (sensori, serrature, robot, elettrodomestici…) con stanza, piano e posizione.
- `viste`, `nomi_stanze`, `nomi_brevi`, `nomi_piani`.
- `sorgenti_tv`: solo se la TV si accende tramite un box (es. Apple TV, che la sveglia via HDMI-CEC); senza, il tocco comanda la TV stessa.
- `viste.musica`: se esiste, compare il pulsante ♫ Musica che apre quella vista. È facoltativo.
- `motore.icone`: icona forzata per una chiave. Di serie l'icona si sceglie dal nome della chiave e da quello dato in Home Assistant, con parole italiane e inglesi: piantana, faretto/spot, led/striscia, sospensione/pendente, abat-jour/comodino, applique/parete, plafoniera/soffitto, scrivania/desk, barra/lineare, sottopensile, filamento/edison, candela, globo/sfera, colonna, esagoni/pannelli, anello, armadio. Se nessuna parola corrisponde, l'icona è una lampadina.
- `pannello`: blocchi sotto la piantina e profili per tablet.

Molte impostazioni della vista (rotazione, altezza delle etichette, larghezza delle tende, colore delle selezioni, barra in basso sul telefono) si regolano anche dall'editor della scheda in Home Assistant; un campo vuoto usa il valore del file.

## Comandi

- Tocco su un'icona = accendi/spegni (luci, prese, casse, tende, purificatori, robot), con risposta immediata.
- Tutto ciò che si regola o si legge apre la **finestra nativa di Home Assistant**: clima, sensori, elettrodomestici e telecamere con un tocco; luci e tende con la pressione lunga.
- La scheda non ridisegna nessun comando e non fa automazioni: i comportamenti tra dispositivi si fanno con le automazioni di Home Assistant.

## Prove

Da lanciare **una alla volta** (misurano la fluidità), con la pagina di prova servita:

| Prova | Cosa controlla |
|---|---|
| `node prova_kit.mjs ipad11` (e gli altri tablet) | fluidità su iPad stanza per stanza, programmi grafici che non cambiano, errori |
| `node prova_doppio_tocco.mjs` | doppio tocco fuori dalla casa per tornare a Casa |
| `node prova_stessa_vista.mjs` | nessuna animazione inutile toccando la vista in cui si è già |
| `node prova_trascina.mjs` | la casa non gira senza tasto premuto |
| `node prova_etichette.mjs` | i nomi delle stanze non si sovrappongono e non saltano |
| `node prova_segnali.mjs` | ogni icona fa quello che deve: luci e prese si accendono col tocco, tapparelle si aprono, il robot parte e torna alla base, tutto il resto apre la finestra di Home Assistant (serrature, cancelli e allarmi non si toccano mai) |

Le misure dei tablet stanno in `prove/comune.mjs` (aggiungi lì i tuoi). Per un'altra pagina: `PAGINA=http://127.0.0.1:8768/prova.html node prova_kit.mjs ipad11`. La prova iPad si fa sempre anche dopo la cottura definitiva.

## Regole che hanno reso tutto fluido (non toglierle)

- **Shader:** uno solo per tutte le stanze, preparato all'avvio. Il numero di programmi grafici non deve cambiare girando le stanze (`prova_kit.mjs` lo controlla).
- **Lavori pesanti in coda:** mappe, piani in più e schede di Home Assistant passano uno alla volta e solo a mappa ferma.
- **Su iPad** mappe di giorno e sera al massimo 1024 px, delle lampade al massimo 256 px, in KTX2; niente riflessi e niente sfocature sopra la mappa.
- **Caricamento:** il velo resta finché sono pronte le mappe dell'ora attuale di tutti i piani (massimo 15 s, di solito meno di 4 s).
- **Tocchi:** un tocco comanda solo con un dito, a mappa ferma e fuori dai voli.
- **Registro:** ogni rallentamento finisce nel log di Home Assistant (logger `casa3d_card`) con la traccia dei lavori. Si legge quello, non si indovina.

## Licenze

- Il kit è distribuito con licenza **MIT** (vedi [`LICENSE`](LICENSE)): puoi usarlo, modificarlo e ridistribuirlo, anche per lavoro, purché resti la nota di copyright.
- three.js è distribuito con licenza MIT.
- Le texture di dettaglio in `scheda_ha/assets/det_pack.webp` vengono da Poly Haven (CC0).
