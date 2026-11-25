// ============================================================================================
//  casa.config.js — L'UNICO FILE DELLA SCHEDA DA ADATTARE ALLA TUA CASA
//  Qui ci sono solo dati: stanze, entità di Home Assistant, cosa mostrare sotto la piantina.
//  Il motore 3D e la scheda non vanno toccati. Dopo ogni modifica: bash build.sh
//  Questo esempio corrisponde alla casa di prova di blender/esempio_casa.py (un piano: soggiorno e cucina).
//  Le entità sono di esempio: per la tua casa si usano SOLO entità che esistono davvero nel tuo Home Assistant.
// ============================================================================================
export default {
  // oggetto del modello 3D (chiave di ENT/EXTRA3D nel modello Blender) -> entità di Home Assistant.
  // Una stessa entità può comparire su più chiavi (es. la luce della scala nei modelli di due piani): si accendono insieme.
  entita: {
    piantana: "light.piantana_soggiorno",
    sospensione: "light.sospensione_cucina",
    striscia_cucina: "light.striscia_led_cucina",
    tv: "media_player.tv_soggiorno",
    "tenda:tenda_1": "cover.tenda_soggiorno",
  },

  // TV: chiave dell'oggetto -> media player che decide cosa mostra lo schermo (film / Home). Facoltativo:
  // serve solo a chi ha un box (es. Apple TV) che accende la TV via HDMI-CEC; senza, il tocco comanda la TV stessa.
  sorgenti_tv: {},

  // dispositivi senza luce cotta: un'icona sopra l'oggetto vero del modello (ogni dispositivo ha il suo oggetto 3D).
  // [tipo, entità, nome sull'etichetta, stanza, piano, [x, altezza, z] in metri]
  //  - piano: false = primo piano dell'elenco motore.piani, oppure il nome del piano (es. "mansarda")
  //  - coordinate three.js: x = x del disegno, altezza = z di Blender misurata da terra, z = y del disegno.
  //    Le icone a parete stanno sotto 1,1 m dal pavimento del loro piano (i muri sono tagliati a 1,15 m).
  // tipi: "serratura", "apertura" (porte e finestre), "pianta" (umidità del terreno), "elettrodomestico", "presa",
  //       "purificatore", "media" (cassa), "robot", "clima", "temperatura", "umidita", "fumo", "perdita", "movimento", "camera"
  segnali: [
    ["apertura", "binary_sensor.portafinestra_soggiorno", "Portafinestra", "soggiorno", false, [4.3, 0.95, 6.05]],
    ["pianta", "sensor.pianta_soggiorno_umidita", "Pianta: ha sete", "soggiorno", false, [5.0, 1.3, 0.6]],
  ],
  // umidità del terreno (%) sotto la quale la pianta "ha sete" (20 se non indicata)
  soglia_sete: { "sensor.pianta_soggiorno_umidita": 20 },

  // porte che si aprono e chiudono nel 3D col loro sensore: gruppo (PORTE_MOBILI nel modello) -> binary_sensor
  porte: {},

  // stanza della piantina -> percorso della vista della dashboard da cui prendere i comandi (opzione "stanze_da")
  // "musica" (facoltativa): se esiste, sulla piantina compare il pulsante ♫ Musica che apre quella vista
  viste: { soggiorno: "soggiorno", cucina: "cucina" },
  nomi_stanze: { soggiorno: "Soggiorno", cucina: "Cucina" },
  // nomi corti sulle etichette (se manca, si usa il nome di HA accorciato)
  nomi_brevi: { tv: "TV" },

  // oggetti toccabili senza luce cotta (prese, pulsanti...): chiave -> { stanza, sopra, box: [x0, y0, z0, x1, y1, z1] }
  oggetti_extra: {},

  // pannello sotto la piantina (schede vere di HA prese dalle viste della dashboard)
  pannello: {
    // blocchi fissati sotto un altro, nella stessa colonna: [titolo, [titoli che vanno sotto, in ordine]]
    sotto_a: [],
    // parole che, se compaiono in una scheda, la escludono sempre dalla piantina (es. dati sanitari)
    mai: [],
    // contenuti diversi per dispositivo, riconosciuti dal lato lungo dello schermo in punti:
    // iPad Air/Pro 13" = 1366, iPad Pro 11" = 1194, iPad 10,9" = 1180, iPad mini = 1133
    // togli: titoli dei blocchi da non mostrare; musica_in_cima: il lettore della vista Musica in cima
    profili: [
      // { nome: "tablet di famiglia", lato_min: 1300, togli: ["SISTEMA"], musica_in_cima: true },
    ],
  },

  // motore 3D
  motore: {
    // piani dal basso verso l'alto, con nomi liberi: ["terra"], ["terra", "primo"], ["taverna", "terra", "primo", "mansarda"]...
    // Ogni piano ha il suo modello Blender e i suoi file (casa_<piano>.json). Il primo è il piano "base".
    piani: ["terra"],
    // nomi dei piani nella barra e frase durante il cambio ("Salgo al primo piano"); panoramica è facoltativa
    // nomi_piani si scrive fuori da motore, vedi in fondo al file
    // foro della scala nel solaio, per vedere il piano di sotto: [x0, z0, x1, z1] in metri (coordinate del disegno)
    // uguale per tutti i piani sopra la base, oppure piano per piano: { primo: [7.3, 1.2, 8.3, 5.5], mansarda: [...] }
    vuoto_scala: null,
    // terrazzi e balconi (stanze di qualsiasi piano che si comportano come il giardino "esterno")
    esterni: [],
    // piano su cui sta il giardino "esterno" (di serie "terra" se c'è, altrimenti il primo piano)
    piano_giardino: null,
    // terreno di giardino_base: la base chiara come una fioriera bianca, i vialetti un po' meno (valori di serie del kit)
    base_chiaro: 1.45, vialetto_chiaro: 0.88,
    angolo_casa: 0.54,                // da dove si guarda la casa all'apertura (radianti attorno alla verticale)
    limite_rotazione: null,           // null = si gira tutto intorno; un numero (radianti per lato) la tiene da un lato solo
    angoli: {},                       // { stanza: angolo } per guardare una stanza dal lato giusto
    stanze_unite: [],                 // open space, es. [["soggiorno", "cucina"]]: entrando in una si vedono le icone delle altre
    visibili_da_sopra: {},            // oggetti del piano sotto comandabili dal piano sopra: { chiave: "stanza del piano sopra" }
    sfuma: null,                      // es. { gruppo: "soppalco", in: "soggiorno", opacita: 0.2 }
    da_unita: {},                     // es. { soppalco: ["faretti_soppalco"] }: dalla stanza unita solo queste icone
    nascondi_in: {},                  // es. { soggiorno: ["lampada_soppalco"] }: icone nascoste in quella stanza
    viste_stanze: {},                 // ritocchi dell'inquadratura: { soggiorno: { phi: 0.62, gira: 0.35, zoom: 0.8 } }
    etichette_stanze: {},             // posizione del nome della stanza: { stanza: [x, altezza, z] }
    tende_perno: {},                  // { tenda_2: "destra" }: lato da cui si allarga la tenda (predefinito "sinistra")
    tende_chiuse: {},                 // { tenda_1: 2.4 }: larghezza in metri della tenda chiusa
    tende_sole: [],                   // tende da sole esterne animate: [[chiave, x0, x1, z_fronte, altezza]]
    tv: { tv: "z+" },                 // schermi animati: chiave -> lato verso cui guarda lo schermo ("x-", "x+", "z-", "z+")
    stanze_aperte: [],                // stanze di passaggio (corridoi) in cui tutta la casa resta illuminata
    // icona forzata per una chiave, se quella scelta dal nome non va bene. Tipi: lampadina, plafoniera, pendente, faretto,
    // striscia, barra, applique, arco, abatjour, scrivania, sfera, candela, edison, colonna, esagoni, ciambella, armadio,
    // sottopensile, portatile, sale, tv, clima, fuoco, presa, tenda...
    icone: { tv: "tv" },
  },
  nomi_piani: { terra: { nome: "Piano terra", arrivo: "al piano terra" } },
};
