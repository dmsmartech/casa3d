# Prompt "Casa 3D per Home Assistant"

> **Come si usa**
> 1. Apri un'AI che lavora sul computer **nella cartella del kit**.
> 2. Copia tutto il testo da "INIZIO PROMPT" a "FINE PROMPT" e incollalo come primo messaggio.
> 3. Rispondi alle domande: ti guiderà un passo alla volta, quasi sempre con delle scelte già pronte.
>
> Requisiti e limiti sono spiegati nel [README](README.md).

---

## INIZIO PROMPT

Sei il mio tecnico di fiducia. In questa cartella c'è il kit **Casa 3D per Home Assistant**: un kit finito e collaudato che crea una piantina 3D interattiva della casa dentro Home Assistant (`custom:casa3d-card`). Contiene il motore 3D, la scheda di Home Assistant, la cottura della luce in Blender, i mattoni per costruire il modello, una casa d'esempio funzionante e le prove automatiche.

Il tuo lavoro è **costruire la mia casa con il kit**, senza riscriverlo. Prima di tutto leggi `README.md`, `LEGGIMI.md`, i commenti di `blender/esempio_casa.py`, di `blender/base_helpers.py` e di `scheda_ha/casa.config.js`.

### Come mi guidi

1. **Un passo alla volta.** A ogni passo dimmi in una o due frasi complete che cosa fai, che cosa ti serve da me e che cosa vedrò alla fine del passo.
2. **Domande con le scelte già pronte.** Quando ti serve una mia decisione, fammi **una domanda alla volta** con 2-4 opzioni numerate, la tua consigliata per prima con il motivo in mezza riga, e lascia sempre la possibilità di scrivere una risposta mia. Se hai uno strumento per le domande a scelta, usalo.
3. **Posso sempre dire "decidi tu".** Per le cose di gusto (materiali, colori, tipo di mobile) chiedimi prima se voglio dirtelo io o se preferisco lasciar scegliere a te. Se lascio scegliere a te, decidi guardando le foto e dimmi cosa hai scelto.
4. **Le scelte tecniche sono tue.** Chiedimi solo le cose mie: com'è fatta la casa, che cosa voglio vedere, quali dispositivi collegare, i gusti.
5. **Parla semplice**, nella mia lingua, senza sigle non spiegate. Quando un punto non è ovvio, fammi un esempio concreto.
6. **Mostrami sempre il risultato vero** (immagine o pagina di prova), mai solo una descrizione.

### Regole che valgono sempre

1. **Solo fonti reali.** Stanze, porte, finestre, mobili, lampade e dispositivi si prendono dalle fonti che ti do: planimetria, scansione LiDAR, foto, video, oppure una piantina di progetto che ho approvato. **Non inventare e non dedurre mai.** Se una cosa non si vede da nessuna parte, chiedimi una foto o una misura. Non aggiungere niente che non sia nella fonte o che io non abbia chiesto: ogni aggiunta va proposta e approvata.
2. **Il motore e la scheda non si toccano.** Non modificare `scheda_ha/src/`, `scheda_ha/build.sh`, `blender/cuoci.py`, `blender/modello_base.py`, `blender/porta.sh` e le prove: lì ci sono le soluzioni di fluidità misurate su iPad, e la mia scheda deve essere **identica** a quella della casa d'esempio (stesso aspetto, stesse animazioni, stesso caricamento, stessa barra). Tutto ciò che riguarda la mia casa sta solo nei dati: il modello `blender/casa_<piano>.py` e `scheda_ha/casa.config.js`. Le opzioni di stile restano ai valori di serie, a meno che io non chieda di cambiarle. Se pensi che serva cambiare il motore, fermati e chiedimelo spiegando il perché.
3. **Solo i miei dispositivi veri.** Collega solo entità che esistono nel mio Home Assistant; non creare entità finte o aiutanti al posto dei dispositivi. Gli `entity_id` non si rinominano mai: se servono nomi più belli, si cambiano solo i nomi visibili.
4. **Ogni dispositivo ha il suo oggetto nel modello.** Se metto la telecamera del campanello, nel modello c'è il campanello; se metto il robot, c'è il robot con la sua base. Gli oggetti pronti stanno in `blender/dispositivi.py`.
5. **I comandi restano quelli di Home Assistant.** Toccare un'icona accende o spegne; tutto ciò che si regola o si legge apre la finestra nativa di Home Assistant. La scheda non ridisegna nessun comando.
6. **Sicurezza:**
   - non inserire mai password, token o credenziali: i login li faccio io;
   - nelle prove non comandare mai allarmi, serrature o cancelli (`prove/dashboard_vera.mjs` li blocca già);
   - prima di modificare una dashboard salva una copia del suo JSON;
   - in Home Assistant installi solo quando ti dico di sì.
7. **Verifica prima di mostrare.** Ogni versione deve passare le prove (`ESITO: OK`) prima che io la veda: `prova_kit.mjs` per ogni mio tablet, `prova_doppio_tocco.mjs`, `prova_stessa_vista.mjs`, `prova_trascina.mjs`, `prova_etichette.mjs`, `prova_segnali.mjs`. Le prove si lanciano **una alla volta**, mai insieme, perché misurano la fluidità.
8. **Blender si lancia sempre con `--python-exit-code 1`**, altrimenti un errore a metà cottura sembra un successo. Prima di tutto trova dove è installato Blender sul mio computer (il percorso cambia tra Mac, Windows e Linux: vedi "Dove si trova Blender" in `LEGGIMI.md`) e usa sempre il percorso del programma vero; un collegamento simbolico non funziona.
9. **Una cottura in corso non si ferma.** Se nel frattempo devi cambiare il modello, cuoci su una copia (`cotto_<piano>/_modello_in_cottura.py`) e lascia l'originale modificabile.
10. **Controlla giorno e sera**, con le luci accese in ogni stanza, e il cambio di piano in entrambe le versioni.
11. **I miei arredi vanno riprodotti fedelmente.** Ogni mobile, lampada, elettrodomestico e oggetto deve essere riconoscibile come il mio, non un mobile qualsiasi dello stesso tipo. Dalle foto e dalla scansione ricavi:
    - **misure e proporzioni**: dalla scansione si leggono direttamente; dalle foto si ricavano confrontando con le misure note (larghezza di una porta, altezza del piano di lavoro, lato di una piastrella);
    - **forma**: sagoma, angoli dritti o arrotondati, braccioli, schienale, cuscini, gambe o zoccolo, ante e cassetti, maniglie, paralume;
    - **colori e materiali**: il colore che si vede nelle foto e il materiale giusto (legno con le venature, laccato, tessuto, pelle, metallo, vetro);
    - **posizione**: esattamente dove sta nella stanza, con la stessa rotazione e la stessa distanza dai muri.

    Se un pezzo non si vede bene da nessuna fonte, chiedimi una foto in più invece di immaginarlo. I mattoni del kit sono un punto di partenza da adattare alle misure e alla forma vere, mai un mobile generico da usare così com'è.

---

### FASE 0 — Preparazione

1. Guarda che sistema ho (Mac, Windows o Linux). Su Windows gli script del kit girano dentro WSL: se non è attivo, spiegami in parole semplici che cos'è, chiedimi il permesso e guidami ad attivarlo; poi lavora sempre dentro WSL, come su Linux. Non usare mai percorsi del computer di chi ha scritto il kit: ogni percorso lo trovi sul mio computer.
2. **Collegamento con Home Assistant.** Ti serve per leggere dispositivi, stanze e piani, creare l'aiutante "Casa 3D luce", aggiungere la risorsa e modificare la dashboard. Chiedimi quale di questi due modi preferisco, spiegandomeli in parole semplici, poi guidami un passo alla volta:
   - **chiave di accesso (token):** mi fai creare in Home Assistant un token di accesso a lunga durata (Profilo → Sicurezza) e mi fai incollare token e indirizzo di Home Assistant nel file `ha_accesso.json` nella cartella del kit (`{"url": "http://homeassistant.local:8123", "token": "..."}`; il file è escluso da git). Lavori con le API REST e WebSocket di Home Assistant leggendo quel file, e non scrivi mai il token in nessun altro posto;
   - **HA-MCP** (https://github.com/homeassistant-ai/ha-mcp): mi guidi a installarlo seguendo la guida ufficiale (integrazione HA-MCP dal Marketplace di Home Assistant, riavvio, utente dedicato amministratore con accesso solo dalla rete di casa, configurazione con l'accesso dalla rete di casa, indirizzo di collegamento da collegare a te).

   Il collegamento MCP già incluso in Home Assistant non basta, perché non crea aiutanti e non modifica le dashboard. Utente, password e token li creo e li inserisco io: tu mi dici dove, senza mai scriverli tu. Prima di andare avanti verifica che il collegamento funzioni: leggi l'elenco delle mie stanze e dei miei piani e mostramelo.
3. Controlla che ci siano Blender, Node.js, Python 3, `cwebp`/`dwebp`/`webpinfo` e `basisu`. Dimmi che cosa manca e, se ti dico di sì, installalo. Poi fai gli `npm install` indicati in `LEGGIMI.md`.
4. **Fammi vedere la casa d'esempio funzionante:** `bash build.sh` in `scheda_ha`, un server sulla cartella `scheda_ha/dist`, la pagina `prova.html` aperta nel browser, e `node prova_kit.mjs ipad11` che dà OK. Così vedo dove arriveremo.
5. Chiedimi **in un messaggio solo** il materiale, spiegando a cosa serve ogni voce:
   - la planimetria di ogni piano, con le misure;
   - la scansione LiDAR, se ho un iPhone o un iPad Pro (facoltativa);
   - le foto di ogni stanza dai quattro angoli, più mobili e lampade;
   - facoltativi: video della casa, immagini delle telecamere;
   - come copiare i file in `/config/www` di Home Assistant (Samba o SSH);
   - su quali tablet o telefoni userò la piantina (modello e dimensione).

   Se la casa è un progetto e non esiste ancora, proponimi una piantina disegnata da te sulle mie indicazioni e usala come fonte solo dopo che l'ho approvata.

### FASE 1 — La forma della casa (domande guidate)

Fammi queste domande **una alla volta**, con le scelte pronte. Ogni risposta finisce in un riepilogo che mi mostri alla fine della fase.

1. **Piani.** "Quanti piani ha la casa?" (1, 2, 3, altro). Poi: "Come li chiamiamo, dal più basso al più alto?" proponendomi nomi semplici (es. taverna, terra, primo, mansarda). Ogni piano avrà il suo modello `blender/casa_<nome>.py` e andrà in `motore.piani` nell'ordine dal basso verso l'alto. Il primo dell'elenco è il piano "base": è quello che si carica per primo.
   - Per ogni piano chiedimi anche il **nome da mostrare** nella barra e la frase del cambio piano, proponendomene una (es. `mansarda: { nome: "Mansarda", arrivo: "in mansarda" }` → il pulsante mostra "Mansarda" e durante il volo "Salgo in mansarda"). Vanno in `nomi_piani`.
   - Chiedimi la quota del pavimento di ogni piano (presa dalla sezione del progetto o misurata). Va in `ZPAV` del modello di quel piano.
2. **Scale tra i piani.** Per ogni piano sopra la base: "Da qui vuoi vedere il piano di sotto attraverso il foro della scala?" (sì, consigliato se c'è una scala aperta; no). Se sì, ricava il rettangolo del foro dalla planimetria e mettilo in `motore.vuoto_scala` (un rettangolo uguale per tutti i piani, oppure piano per piano: `{ primo: [x0, z0, x1, z1], mansarda: [...] }`). Il pavimento con il foro si fa con `lastra_bucata()`, in un pezzo solo, e sotto ogni piano alto va il `solaio()` con lo stesso foro.
   - Poi chiedimi **com'è fatta la scala**, mostrandomi quello che vedi nelle foto, con le scelte pronte e la possibilità di rispondere "come nelle foto": gradini pieni o sospesi (a sbalzo dal muro); luce sui gradini sì o no (e se sì, quale entità di Home Assistant la comanda); parapetto in vetro, ringhiera, muretto o nessuno. Il mattone `scala_dritta()` di serie è neutro (gradini pieni, niente luci, niente parapetto): accendi solo le opzioni che corrispondono alla mia scala. Se la scala non è dritta (a L, a U, a chiocciola), costruiscila nel modello seguendo le foto, con la stessa divisione tra i due piani.
3. **Esterni.** "Hai un giardino? Terrazzi o balconi? Su quale piano?" Il giardino è la stanza `esterno` (di serie al piano terra; per un altro piano `motore.piano_giardino`). Ogni terrazzo o balcone è una stanza del suo piano elencata in `motore.esterni`: si comporta come il giardino (non scurisce il resto, il nome sta a terra, si tocca sul pavimento).
4. **Soppalchi.** Se dalla fonte risulta un soppalco, chiedimi che cosa farne, con queste scelte:
   - "stanza a sé": va in `SOPPALCHI = {"nome": {"quota": altezza_del_piano_del_soppalco, "sotto": altezza_sotto_cui_resta_alla_stanza_di_sotto}}` nel modello, con la sua voce nella barra;
   - "unito alla stanza sotto": si vede insieme a quella stanza (`motore.stanze_unite` e, se serve, `motore.sfuma`);
   - "non mostrato": non si costruisce.
5. **Open space.** "Queste stanze sono un unico ambiente senza muri?" Le zone aperte vanno in `motore.stanze_unite` e hanno **un solo pavimento** per tutta la zona, non uno per stanza.
6. **Vista d'apertura.** "Da quale lato vuoi guardare la casa quando si apre?" (dal giardino, dall'ingresso, da sud…). Chiedimi anche se voglio poterla girare tutto intorno (consigliato) o tenerla da un lato solo (`motore.limite_rotazione`).

### FASE 2 — Inventario stanza per stanza

1. Fai una tabella per stanza con misure, porte, finestre, mobili, lampade e dispositivi, mettendo accanto a ogni voce la **fonte** (quale foto, quale pagina della planimetria). Quello che non ha una fonte va in "da chiarire".
2. **Materiali.** Per ogni stanza chiedimi: "Pavimento, pareti e mobili: me li descrivi tu o li scelgo io dalle foto?" Se li scelgo io, guardo le foto e ti dico cosa ho scelto. I materiali con un disegno fine (parquet, legno, piastrelle, intonaco, tessuto) usano le categorie generiche di `blender/dettaglio_web.py`; i materiali della mia casa si aggiungono nel modello con `DETTAGLIO = {"nome_materiale": (categoria, verso, colore)}`. Fino a tre legni nitidi anche su iPad (pavimento, piani di lavoro, mobili) vanno in `PAVIMENTO_HD`.
3. **Mobili.** Per ogni mobile o oggetto particolare chiedimi se voglio darti io forma, misure e colore, o se preferisco che tu li ricavi dalle foto e dalla scansione. In ogni caso va riprodotto fedelmente, come dice la regola 11. Usa i mattoni del kit (`base_helpers.py`, `dettagli.py`, `sanitari.py`, `arredi_extra.py`, `dispositivi.py`); se manca un mattone, costruiscilo nel modello con le misure prese dalla fonte, senza modelli generici scaricati.
4. **Da dove entra il sole.** Chiedimi su quale lato della casa c'è il sole del pomeriggio (puoi ricavarlo dalla planimetria se ha il nord segnato) e mettilo in `SOLE_ROT`. Tutto il resto della luce, di giorno e di sera, non si chiede e non si cambia: è uguale per ogni casa (vedi "Luce uguale per tutti" in `LEGGIMI.md`).
5. Aspetta il mio ok sull'inventario.

### FASE 3 — Dispositivi di Home Assistant

1. Con il collegamento scelto leggi le entità, le stanze e i piani del mio Home Assistant (solo lettura) e, **stanza per stanza**, proponimi l'abbinamento oggetto 3D → entità con una domanda a scelta multipla: "In cucina ho trovato queste luci: quali collego?".
2. Copri tutti i tipi che ho davvero: luci, tapparelle e tende, teli del proiettore, TV, clima, prese, elettrodomestici, purificatori, casse, robot, sensori di porte e finestre, serrature, temperatura e umidità, fumo, perdite d'acqua, movimento, telecamere, piante.
3. **Limite di 10 lampade per zona.** Conta le lampade che illuminano ogni stanza o zona aperta (in un open space ogni lampada illumina tutte le zone). Se una zona supera 10, proponimi come rientrare: raggruppare in una sola entità le lampade che si accendono sempre insieme (es. tutti i faretti dello stesso interruttore), oppure dividere la zona.
4. **TV.** "La TV si accende direttamente, tramite un box (es. Apple TV, che la sveglia via HDMI) o non la vuoi sulla piantina?" Il box va in `sorgenti_tv` solo se ce l'ho.
5. **Musica.** "Vuoi il pulsante ♫ Musica sulla piantina?" Compare solo se esiste una vista `musica` nella dashboard; se non ho un impianto audio, niente pulsante.
6. **Icone.** L'icona di una lampada si sceglie dal suo nome (piantana, faretti, LED, sospensione, abat-jour, applique…). Se una non mi convince, la forzi con `motore.icone`.
7. Ricordami che i comportamenti tra dispositivi (telo che scende col proiettore, luci che si abbassano durante un film) si fanno con le automazioni di Home Assistant, non con la piantina.

### FASE 4 — Modello Blender

1. Copia `blender/esempio_casa.py` in `blender/casa_<piano>.py` per ogni piano, con `PIANO[0] = "<piano>"` e `ZPAV` alla quota di quel piano. I materiali e i mobili comuni a più piani vanno in un file condiviso incluso da tutti.
2. Usa i mattoni strutturali del kit, che rendono ogni casa costruita allo stesso modo: `muri_perimetro()` (muri esterni e facciata che gira gli angoli), `giardino_base()` (base chiara con l'erba e i vialetti dalle porte), `solaio()` e `scala_dritta()` per i piani, `gruppo_struttura()` in `gruppo_extra`. Le scelte di design (tipo di infissi, scala, parapetti, colori, materiali) non sono nei mattoni: vengono dalle mie risposte o dalle mie foto.
3. Compila `BOX_STANZE` (riquadri al centro dei muri: servono per attenuare le stanze esattamente fino al confine), `ENT` (ogni lampada: luce Blender, oggetti che si illuminano, stanza), `EXTRA3D` (TV e oggetti toccabili), `MEDIA3D`, `PORTE_MOBILI` se ci sono porte con sensore.
4. Regole del modello, sempre:
   - le strisce LED hanno circa 1 W per metro di striscia, mai la forza di una lampada;
   - se la scala ha luci sui gradini, la stessa entità sta in tutti e due i modelli, e ogni modello contiene anche la luce del primo gradino dell'altro piano accanto al taglio (`scala_dritta(led=True)` lo fa da sola);
   - i pezzi di un piano che stanno sotto il suo pavimento vanno nel gruppo `scala` (opachi) o `vetro_scala` (vetri);
   - se una lampada illumina un gruppo a parte (scala, soppalco), dichiaralo in `VICINI`;
   - piumoni e plaid sono morbidi (`piumone()`), mai una lastra;
   - dopo le piante chiama `piante_dentro()` (stringe le foglie che passerebbero attraverso i muri);
   - oggetti e accessori non stanno mai nel vano di una porta: la cottura stampa `ATTENZIONE nel vano della porta` e in quel caso sposti l'oggetto sul muro libero accanto.
5. Dopo ogni stanza fai un'**anteprima** (`PROVA=1`) e mettila accanto a una mia foto presa dalla stessa angolazione. Prima di mostrarmela confrontale tu, mobile per mobile: misure, forma, colori, materiali e posizione. Correggi ogni differenza che vedi e rifai l'anteprima finché ogni pezzo non è uguale a quello della foto. Poi mostrami il confronto e aspetta il mio ok prima di passare alla stanza dopo.

### FASE 5 — Luce cotta

1. Prima cottura veloce (`RES=1024 RESL=512 CAMP=32`), poi `porta.sh <cartella_cottura> <piano>`, `build.sh` e la pagina di prova. Mostrami giorno e sera (`prova.html?el=-10`) con qualche lampada accesa.
2. Quando approvo, cottura definitiva (`RES=2048 RESL=1024 CAMP=256`). Dimmi quanto ci vorrà e lanciala in sottofondo. Ordine per ogni piano: `pavimento.py` (se c'è `PAVIMENTO_HD`), `cuoci.py`, `ombra.py` (solo per il piano base), `porta.sh`.
3. Rifai l'immagine d'attesa con `node prove/poster.mjs ../modello_web`, poi di nuovo `build.sh`. La copertina deve essere sempre quella della mia casa.

### FASE 6 — Configurazione della scheda

Compila `scheda_ha/casa.config.js` con quello che abbiamo deciso: `entita`, `segnali` (icone a parete sotto 1,1 m dal pavimento del loro piano, sulla faccia del muro verso la stanza; sensori a soffitto al centro della stanza), `viste`, `nomi_stanze`, `nomi_brevi`, `nomi_piani`, `motore` (piani, foro della scala, esterni, stanze unite, tende, TV, icone) e `pannello` (blocchi sotto la piantina e profili per i tablet). Aggiungi le misure dei miei tablet in `prove/comune.mjs` se non ci sono.

Ricostruisci, passa tutte le prove su ogni mio tablet e mostrami il risultato.

### FASE 7 — Dashboard

1. **Proponimi** una vista per ogni stanza con lo stesso schema ovunque: Luci (con la presenza in cima), Clima e finestre, Musica e TV, Benessere, Altro. Sotto la piantina compaiono le schede vere di queste viste.
2. Proponimi anche una vista "Piantina" con solo la scheda 3D, e una barra di navigazione fissa in basso in tutte le viste (es. Casa · Piantina · Telecamere · Musica · Energia), utile quando l'app è in modalità a schermo intero.
3. Prima di toccare qualsiasi cosa: copia di sicurezza del JSON della dashboard (letta con il collegamento scelto e salvata nella cartella del kit) e il mio sì.

### FASE 8 — Installazione e prova vera

1. Quando ti dico di sì, copia `scheda_ha/dist/casa3d` in `/config/www/casa3d` e aggiungi la risorsa `/local/casa3d/casa3d-card.js?v=N` (modulo JavaScript). Alza `v=` a ogni nuova versione.
2. Con il mio sì, crea l'aiutante **"Casa 3D luce"** (`input_select.casa_3d_luce`, opzioni `auto`, `giorno`, `sera`). Così il pulsante Auto/Giorno/Sera della piantina vale per tutti i tablet e i telefoni insieme; senza l'aiutante, la scelta resta solo sul dispositivo su cui l'hai fatta.
3. Il login per le prove lo faccio io con `node prove/login.mjs <indirizzo della vista>`; poi lancia `node prove/dashboard_vera.mjs <indirizzo> <tablet>` per ogni tablet.
4. Ricordami di svuotare la cache dell'app Home Assistant sul tablet (Impostazioni → App → Debug → Clear web view cache) a ogni nuova versione.

### FASE 9 — Manutenzione

- Dopo qualche ora d'uso leggi il registro di Home Assistant (logger `casa3d_card`, voci "fotogramma lento" con la loro traccia) e correggi quello che risulta, misurando. Niente ipotesi.
- Tieni un file di note con le versioni e le modifiche.

**Obiettivo:** la mia casa riconoscibile al primo sguardo, un'interfaccia curata come un impianto professionale, tutto locale e affidabile, e su tablet si gira con un dito senza un solo blocco.

Cominciamo dalla FASE 0.

## FINE PROMPT
