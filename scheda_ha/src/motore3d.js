// Casa 3D in tempo reale: modello Blender con luce di Cycles cotta nelle texture.
// Giorno, sera e ogni lampada sono mappe di luce separate che si sommano nello shader:
// accendi una lampada e la sua luce vera (rimbalzi e ombre comprese) appare sulla stanza.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
// correzione colore dopo AgX (che da solo è spento): un po' più di saturazione e ombre più profonde, come il look "Punchy" di Blender.
// ?grado=0 la toglie (per confrontare)
const GRADO = (typeof location !== "undefined" && /[?&]grado=([\d.]+)/.exec(location.search)) ? parseFloat(/[?&]grado=([\d.]+)/.exec(location.search)[1]) : 1;
if (GRADO > 0) THREE.ShaderChunk.tonemapping_fragment = THREE.ShaderChunk.tonemapping_fragment.replace(/#endif\s*$/,
  `  { vec3 gc = max(gl_FragColor.rgb, 0.0); float gl = dot(gc, vec3(0.2126, 0.7152, 0.0722));
    float fr = clamp((gc.b - max(gc.r, gc.g)) / max(gc.b, 0.001) * 4.0, 0.0, 1.0);   // toni azzurri (luce del cielo nelle ombre): non li ravvivo, li smorzo
    gc = mix(vec3(gl), gc, mix(1.0 + mix(0.36, 0.6, clamp((gc.r - gc.b) / max(gc.r, 0.001) * 2.5, 0.0, 1.0)) * ${GRADO.toFixed(3)}, 0.75, fr)); gc = pow(max(gc, 0.0), vec3(1.0 + 0.15 * ${GRADO.toFixed(3)})) * (1.0 + 0.04 * ${GRADO.toFixed(3)});
    gc = clamp(gc, 0.0, 1.0); gc = mix(gc, gc * gc * (3.0 - 2.0 * gc), 0.3 * ${GRADO.toFixed(3)});   // curva a S: ombre più scure, luci più chiare (contrasto, come la prova Blender)
    gl_FragColor.rgb = gc; }
#endif
`);

const DUR = 0.95;
// da dove si guarda ogni stanza: di fronte a letto e scrivania, non da dietro la testiera
// tutto ciò che riguarda la casa (stanze, angoli, tende, TV...) arriva da casa.config.js tramite opts.casa
let ICONE_CASA = {};
const ease = (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));


// i modelli sono glTF in JSON con la geometria in base64: la decodifico qui e ricostruisco un GLB in memoria,
// così il caricatore non deve aprire indirizzi data: (bloccati dalla pagina pubblicata)
// prima il modello compresso (meshopt, 5 volte più leggero); se il browser non lo apre, quello normale
async function caricaModello(url, cartella) {
  // prima il binario .glb (un quarto più leggero e niente base64 da decodificare), poi il JSON come riserva
  try {
    const r = await fetch(url.replace("_mod.json", "_pk.glb"));
    if (r.ok) { const buf = await r.arrayBuffer(); return await new Promise((ok, ko) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(buf, cartella, ok, ko)); }
  } catch (e) { console.warn("glb non caricato, provo il JSON", e); }
  try { return await caricaJson(url.replace("_mod.json", "_pk.json"), cartella); }
  catch (e) { console.warn("modello compresso non caricato, uso quello normale", e); return caricaJson(url, cartella); }
}
async function caricaJson(url, cartella) {
  const j = await (await fetch(url)).json();
  const uri = j.buffers[0].uri, b64 = uri.slice(uri.indexOf(",") + 1);
  let bin;
  if (Uint8Array.fromBase64) bin = Uint8Array.fromBase64(b64);
  else { const s = atob(b64), n = s.length; bin = new Uint8Array(n); for (let i = 0; i < n; i++) bin[i] = s.charCodeAt(i); }
  delete j.buffers[0].uri;
  const enc = new TextEncoder(); let js = enc.encode(JSON.stringify(j));
  const pj = (4 - (js.length % 4)) % 4, pb = (4 - (bin.length % 4)) % 4;
  const tot = 12 + 8 + js.length + pj + 8 + bin.length + pb, out = new Uint8Array(tot), dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, tot, true);
  dv.setUint32(12, js.length + pj, true); dv.setUint32(16, 0x4E4F534A, true); out.set(js, 20); out.fill(0x20, 20 + js.length, 20 + js.length + pj);
  let o = 20 + js.length + pj; dv.setUint32(o, bin.length + pb, true); dv.setUint32(o + 4, 0x004E4942, true); out.set(bin, o + 8);
 
  return new Promise((ok, ko) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(out.buffer, cartella, ok, ko));
}


// icone disegnate per ogni tipo di oggetto: si riconosce subito cosa si sta toccando
const ICONE = {
  appletv: '<rect x="3.5" y="7" width="17" height="10" rx="3"/><path d="M10.5 10v4l3.5-2z"/>',
  ventola: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1.6"/><path d="M12 10.4c-.4-2.6.6-4.6 3-5.2.9 2.2-.4 4.3-3 5.2zM13.4 12.8c2.4 1 3.5 3 2.6 5.3-2.3-.3-3.4-2.5-2.6-5.3zM10.6 12.8c-2 1.6-4.3 1.6-5.7-.4 1.6-1.7 4-1.4 5.7.4z"/>',
  presa: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9.5 9v2.5M14.5 9v2.5"/><path d="M9 14.5a3 3 0 0 0 6 0"/>',
  arco: '<path d="M6 21h6M9 21V10a7 7 0 0 1 11.5-5.4"/><path d="M15.6 6.2l5.6 1.4-1.3 3.4a3 3 0 0 1-5.1-.9z"/>',
  sfera: '<circle cx="12" cy="10.5" r="6.2"/><path d="M8.5 20.5h7M12 16.7v3.8"/>',
  sale: '<path d="M8.2 4.2 13 3l4.2 5-.9 9.5H8.1L6.3 9.4z"/><path d="M10 7.5l2 3 2.5-2"/><path d="M6.5 20.5h11"/>',
  candela: '<rect x="9" y="10" width="6" height="11" rx="1"/><path d="M12 7.6c-1.4-1.2-1.3-3 0-4.6 1.3 1.6 1.4 3.4 0 4.6z"/>',
  applique: '<path d="M4.5 4v16"/><path d="M4.5 12H9"/><path d="M9 6.5h8.5L15.5 17H11z"/><path d="M13 19.5v1.5" opacity=".6"/>',
  faretto: '<rect x="9.5" y="2.5" width="5" height="4" rx="1"/><path d="M10 6.5 6.5 14h11L14 6.5"/><path d="M8 17.5l-1 3M12 17v3.5M16 17.5l1 3" opacity=".7"/>',
  striscia: '<rect x="2.5" y="9.5" width="19" height="5" rx="2.5"/><circle cx="7" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="17" cy="12" r="1"/>',
  barra: '<path d="M8 3v4M16 3v4"/><rect x="3" y="7" width="18" height="4" rx="1.2"/><path d="M6.5 14.5 5.5 18M12 14.5v4M17.5 14.5l1 3.5" opacity=".7"/>',
  pendente: '<path d="M12 2.5V8"/><path d="M5.5 15a6.5 6.5 0 0 1 13 0z"/><path d="M10 18.5h4"/>',
  sottopensile: '<rect x="3" y="4.5" width="18" height="4.5" rx="1"/><path d="M7 12l-1.5 6M12 12v7M17 12l1.5 6" opacity=".7"/>',
  edison: '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-4 10.4c.8.8 1.2 1.6 1.2 2.6h5.6c0-1 .4-1.8 1.2-2.6A6 6 0 0 0 12 3z"/><path d="M10 11.5l1 2 1-3 1 3 1-2"/>',
  portatile: '<rect x="7" y="8" width="10" height="12" rx="3.5"/><path d="M9.2 8V6.2a2.8 2.8 0 0 1 5.6 0V8"/><path d="M10 13.5h4"/>',
  esagoni: '<path d="M8 2.8l4 2.3v4.6l-4 2.3-4-2.3V5.1z"/><path d="M16 9.2l4 2.3v4.6l-4 2.3-4-2.3v-4.6z"/><path d="M8 14.4l4 2.3v4.6" opacity=".6"/>',
  abatjour: '<path d="M8 3.5h8l3.2 8H4.8z"/><path d="M12 11.5v6.5M8 20.5h8"/>',
  plafoniera: '<path d="M3.5 6.5h17"/><path d="M5 6.5a7 4.2 0 0 0 14 0"/><path d="M8 15l-1 3M12 15v4M16 15l1 3" opacity=".7"/>',
  colonna: '<rect x="9.8" y="2.5" width="4.4" height="15" rx="2.2"/><path d="M8 21h8M12 17.5V21"/>',
  lampadina: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2V16h5v-.1c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  scrivania: '<path d="M5 21h8"/><path d="M8.5 21l2.6-8.2 4.4-3.3"/><path d="M14.2 5.6l5.6 2.1-1.9 4.3-4.6-2z"/>',
  armadio: '<rect x="5" y="2.5" width="14" height="19" rx="1.2"/><path d="M12 2.5v19M10 11v2.5M14 11v2.5"/>',
  tv: '<rect x="2.5" y="4.5" width="19" height="12.5" rx="1.6"/><path d="M8 21h8M12 17v4"/>',
  goccia: '<path d="M12 3.5c-3.2 4.2-5.5 7.3-5.5 10.2a5.5 5.5 0 0 0 11 0c0-2.9-2.3-6-5.5-10.2z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" opacity=".7"/>',
  caffe: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8.5 3.5c-.6 1 .6 1.8 0 3M12 3.5c-.6 1 .6 1.8 0 3" opacity=".7"/>',
  tenda: '<path d="M3.5 3.5h17"/><path d="M6 3.5c0 6 1.2 11 3.5 17M18 3.5c0 6-1.2 11-3.5 17"/><path d="M9.5 20.5H6M14.5 20.5H18" opacity=".6"/>',
  homepod: '<path d="M6 8.5a6 3.6 0 0 1 12 0v7a6 3.6 0 0 1-12 0z"/><ellipse cx="12" cy="8.5" rx="3.2" ry="1.4"/>',
  fuoco: '<path d="M12 21.5c-3.6 0-6.2-2.5-6.2-5.8 0-3.5 3.1-5.4 3.7-9.2 2.1 1.2 3.3 3.3 3.5 5.4.8-.7 1.3-1.9 1.4-3.1 2 1.6 3.8 4.1 3.8 6.9 0 3.3-2.6 5.8-6.2 5.8z"/>',
  clima: '<rect x="2.5" y="4.5" width="19" height="7.5" rx="2"/><path d="M6 9h12"/><path d="M8 15.5v3M12 15.5v4.5M16 15.5v3" opacity=".7"/>',
  ciambella: '<circle cx="12" cy="12" r="7.6"/><circle cx="12" cy="12" r="3.2"/><path d="M12 2v1.5M12 20.5V22" opacity=".5"/>',
  proiettore: '<rect x="3" y="3.5" width="18" height="3" rx="1"/><path d="M5 6.5v11h14v-11"/><path d="M9 20.5h6" opacity=".6"/>',
  lucchetto: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path class="chiuso" d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><path class="aperto" d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7"/><path d="M12 14.5v2.5"/>',
  lavatrice: '<rect x="4.5" y="2.5" width="15" height="19" rx="2.2"/><path d="M4.5 6.5h15"/><circle cx="12" cy="13.8" r="4.4"/><path d="M9.8 14.6c1.4-1 2.9.8 4.4-.2" opacity=".7"/><path d="M7 4.5h1.5"/>',
  asciugatrice: '<rect x="4.5" y="2.5" width="15" height="19" rx="2.2"/><path d="M4.5 6.5h15"/><circle cx="12" cy="13.8" r="4.4"/><path d="M10.6 12.4v2.8M13.4 12.4v2.8" opacity=".7"/><circle cx="16.5" cy="4.5" r=".6"/>',
  lavastoviglie: '<rect x="4" y="2.5" width="16" height="19" rx="2"/><path d="M4 7h16M8 4.8h3"/><path d="M7.5 11.5l1.5 1.5 1.5-1.5M13.5 11.5l1.5 1.5 1.5-1.5M7.5 16l1.5 1.5 1.5-1.5M13.5 16l1.5 1.5 1.5-1.5" opacity=".7"/>',
  forno: '<rect x="3" y="3.5" width="18" height="17" rx="2"/><path d="M3 8h18"/><rect x="6.5" y="11" width="11" height="6.5" rx="1"/><path d="M6.5 5.8h1M10 5.8h1M16 5.8h1.5"/>',
  stampante3d: '<path d="M4 3.5h16v17H4z"/><path d="M4 7.5h16"/><path d="M10 7.5v4h4v-4"/><path d="M11 11.5l1 1.5 1-1.5"/><path d="M8 18.5h8M9.5 16.5h5" opacity=".7"/>',
  purificatore: '<rect x="6.5" y="2.5" width="11" height="19" rx="3.5"/><path d="M9.5 6.5h5M9.5 9h5M9.5 11.5h5" opacity=".7"/><circle cx="12" cy="16.5" r="2"/>',
  fumo: '<path d="M4 7.5a8 2.6 0 0 0 16 0"/><path d="M4 7.5h16"/><circle cx="12" cy="9" r=".8"/><path d="M8.5 14.5c.9 1-.9 2 0 3M12 14c.9 1.1-.9 2.2 0 3.4M15.5 14.5c.9 1-.9 2 0 3" opacity=".8"/>',
  perdita: '<path d="M12 3c-2.7 3.5-4.6 6-4.6 8.4a4.6 4.6 0 0 0 9.2 0C16.6 9 14.7 6.5 12 3z"/><path d="M3.5 19.5c1.4-1 2.8 1 4.2 0s2.8 1 4.2 0 2.8 1 4.2 0 2.8 1 4.2 0" opacity=".8"/>',
  movimento: '<circle cx="12.5" cy="4.5" r="1.8"/><path d="M9 21l2.6-6.2 2.4 2.2v4"/><path d="M7 11.5l3.2-3 3.3.6 2 3.4 2.5.6"/><path d="M11.6 14.8l1.6-5.2"/>',
  telecamera: '<rect x="3" y="6.5" width="13" height="10" rx="2"/><path d="M16 10.2l5-2.7v8l-5-2.7"/><circle cx="8" cy="11.5" r="1.4" opacity=".7"/>',
  umidita: '<path d="M12 3c-3.2 4.2-5.5 7.3-5.5 10.2a5.5 5.5 0 0 0 11 0C17.5 10.3 15.2 7.2 12 3z"/><path d="M10 15.5l4-4M10.3 11.8h.1M13.7 15.2h.1"/>',
  robot: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="5.2" opacity=".55"/><path d="M9.6 7.2h4.8"/><circle cx="12" cy="12" r="1.2"/>',
  termometro: '<path d="M10 14.2V5a2 2 0 0 1 4 0v9.2a4 4 0 1 1-4 0z"/><path d="M12 9.5v6.3"/>',
  finestra: '<rect x="4.5" y="3.5" width="15" height="17" rx="1.2"/><path d="M12 3.5v17M4.5 12h7.5"/><path class="aperto" d="M12 3.5l6 2.5v15l-6-.5" opacity=".9"/>'
};
function tipoIcona(e, nome) {
  if (ICONE_CASA[e]) return ICONE_CASA[e];
  const t = (e + " " + (nome || "")).toLowerCase();
  if (e.startsWith("robot:")) return "robot"; if (e.startsWith("temperatura:")) return "termometro"; if (e.startsWith("umidita:")) return "umidita";
  if (e.startsWith("fumo:")) return "fumo"; if (e.startsWith("perdita:")) return "perdita"; if (e.startsWith("movimento:")) return "movimento";
  if (e.startsWith("camera:")) return "telecamera"; if (e.startsWith("purificatore:")) return "purificatore";
  // elettrodomestici e prese: l'icona dal nome (lavatrice, forno, stampante 3D...)
  if (e.startsWith("elettrodomestico:") || e.startsWith("presa:")) for (const [k, v] of [["lavastoviglie", "lavastoviglie"], ["asciuga", "asciugatrice"], ["lavatrice", "lavatrice"], ["forno", "forno"], ["stampante", "stampante3d"], ["caff", "caffe"]]) if (t.includes(k)) return v;
  if (e.startsWith("elettrodomestico:")) return "lavatrice";
  if (e.startsWith("serratura:")) return "lucchetto"; if (e.startsWith("apertura:")) return "finestra"; if (e.startsWith("pianta:")) return "goccia";
  if (e.startsWith("tenda:")) return "tenda"; if (e.startsWith("telo:")) return "tenda"; if (e.startsWith("proiettore:")) return "proiettore"; if (e.startsWith("caffe:")) return "caffe"; if (e.startsWith("media:")) return "homepod"; if (e.startsWith("atv:")) return "appletv"; if (e.startsWith("presa:")) return e.includes("aspiratore") ? "ventola" : "presa";
  if (e.startsWith("stufa")) return "fuoco"; if (e.startsWith("clima:")) return "clima"; if (e.startsWith("tv")) return "tv";
  // tipo di lampada dal nome dell'entità o da quello dato in HA (parole italiane e inglesi). Per un'icona diversa
  // da quella che esce da qui: icone: { "<chiave>": "<tipo>" } in casa.config.js (vince sempre)
  const regole = [["piantana", "arco"], ["floor lamp", "arco"], ["sfera", "sfera"], ["globo", "sfera"], ["lampada di sale", "sale"], ["sale", "sale"],
    ["candela", "candela"], ["candle", "candela"], ["applique", "applique"], ["parete", "applique"], ["wall", "applique"],
    ["faretti", "faretto"], ["faretto", "faretto"], ["spot", "faretto"], ["led", "striscia"], ["striscia", "striscia"], ["strip", "striscia"],
    ["barra", "barra"], ["lineare", "barra"], ["sospensione", "pendente"], ["pendente", "pendente"], ["pendant", "pendente"],
    ["sottopensile", "sottopensile"], ["filamento", "edison"], ["edison", "edison"], ["portatile", "portatile"], ["esagon", "esagoni"], ["pannelli", "esagoni"],
    ["abat", "abatjour"], ["comodino", "abatjour"], ["bedside", "abatjour"], ["plafoniera", "plafoniera"], ["soffitto", "plafoniera"], ["ceiling", "plafoniera"],
    ["colonna", "colonna"], ["anello", "ciambella"], ["ciambella", "ciambella"], ["ring", "ciambella"], ["scrivania", "scrivania"], ["desk", "scrivania"],
    ["armadio", "armadio"], ["lampadina", "lampadina"], ["bulb", "lampadina"]];
  for (const [k, v] of regole) if (t.includes(k)) return v;
  return "lampadina";
}
const svgIcona = (tipo) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONE[tipo] || ICONE.lampadina}</svg>`;

export async function crea(opts) {
  const base = opts.base || "", V = opts.ver ? "?v=" + opts.ver : "";
  const C = opts.casa || {}; ICONE_CASA = C.icone || {};
  // piani della casa dal basso verso l'alto, con nomi liberi (es. ["taverna", "terra", "primo", "mansarda"]).
  // Il primo è il piano "base": si carica per primo e porta l'inquadratura della casa. Ogni piano ha i suoi file
  // casa_<piano>.json / casa_<piano>_mod.json e le mappe luce_<prefisso><gruppo>_... (prefisso: vedi prefissoPiano)
  const PIANI = Array.isArray(C.piani) && C.piani.length ? C.piani.slice() : ["terra"], BASE = PIANI[0];
  const idxPiano = (n) => Math.max(0, PIANI.indexOf(n));
  // piano di una stanza o di un oggetto: m.piano (nome), oppure il vecchio m.sopra (true = il piano subito sopra la base)
  const pianoDi = (m) => (m && typeof m.piano === "string" && PIANI.includes(m.piano) ? m.piano : m && typeof m.sopra === "string" && PIANI.includes(m.sopra) ? m.sopra : m && m.sopra === true && PIANI.length > 1 ? PIANI[1] : BASE);
  // stanze esterne oltre al giardino ("esterno"): terrazzi e balconi di qualsiasi piano. Si comportano come il giardino:
  // non scuriscono il resto, il nome sta a terra, si toccano sul pavimento
  const ESTERNI = new Set(["esterno", ...(C.esterni || [])]), eEsterno = (k) => ESTERNI.has(k);
  // prefisso dei file di un piano (lo stesso di blender/porta.sh): "terra" nessuno, "sopra" s_ (case già fatte), gli altri <nome>_
  const prefissoPiano = (n) => (n === "terra" ? "" : n === "sopra" ? "s_" : n + "_");
  // chiave dei gruppi di un piano nella mappa gruppi: "terra" nessuna, "sopra" s:, gli altri <nome>:
  const chiavePiano = (n) => (n === "terra" ? "" : n === "sopra" ? "s:" : n + ":");
  const THETA = C.angoli || {}, PIANO_STANZA = {}, CON_SOPRA = PIANI.length > 1;
  for (const k of C.stanze_sopra || []) if (PIANI.length > 1) PIANO_STANZA[k] = PIANI[1];
  // stanze unite (es. soggiorno e soppalco): entrando in una si vedono anche le icone dell'altra
  const UNITE = C.stanze_unite || [];
  const unite = (a, b) => a === b || UNITE.some((g) => g.includes(a) && g.includes(b));
  const STANZA_TENDE = C.stanza_tende || null, APERTE = new Set(C.stanze_aperte || []);
  // modello, dati e mappe di luce partono insieme: nessuno aspetta l'altro
  const meta = await (await fetch(base + "casa_" + BASE + ".json" + V)).json();
  for (const k of Object.keys(meta.stanze || {})) PIANO_STANZA[k] = BASE;
  for (const m of Object.values(meta.ent || {})) m.piano = BASE;
  let pModello = null;
  const el = document.createElement("div"); el.className = "tre";
  // opts.gl permette alla scheda di riprovare con impostazioni più semplici (Safari a volte rifiuta "high-performance")
  // iPad/iPhone: meno pixel e niente antialiasing, altrimenti la scheda grafica si riempie e la mappa si pianta
  const SU_TOUCH = matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 1 && !matchMedia("(hover: hover)").matches);
  const renderer = new THREE.WebGLRenderer({ antialias: true, /* anche su iPad/iPhone: senza, muri e mobili avevano i bordi a scalini; sui chip Apple costa quasi nulla */ alpha: true, stencil: true, /* serve alla maschera del foro della scala */ powerPreference: SU_TOUCH ? "default" : "high-performance", preserveDrawingBuffer: location.search.includes("cattura"), ...(opts.gl || {}) });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, SU_TOUCH ? 1.25 : 2));
  // se il browser toglie la grafica alla pagina (memoria piena, iPad): prima aspetto che la ridia (three.js ricarica da solo
  // modelli e mappe sulla stessa mappa); solo se non torna entro 4 s la scheda chiude questa mappa e ne crea una nuova.
  // Prima ne creava subito un'altra lasciando viva la vecchia: memoria doppia e iPadOS chiudeva l'app.
  let finito = false, perso = false, tPerso = null, fuoriTocco = null;
  renderer.domElement.addEventListener("webglcontextlost", (ev) => { ev.preventDefault(); perso = true; clearTimeout(tPerso);
    tPerso = setTimeout(() => { if (perso && !finito) el.dispatchEvent(new CustomEvent("m3d-perso", { bubbles: true, composed: true })); }, 4000); });
  renderer.domElement.addEventListener("webglcontextrestored", () => { perso = false; clearTimeout(tPerso); try { sporco = true; } catch (e) {} el.dispatchEvent(new CustomEvent("m3d-log", { bubbles: true, composed: true, detail: { tipo: "grafica tornata" } })); });
  renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = Math.pow(2, 0.55);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.append(renderer.domElement);
  const etichette = document.createElement("div"); etichette.className = "tre-et"; el.append(etichette);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1.6, 0.1, 200); camera.layers.enable(1); // strato 1: piano terra visto dal foro della scala
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.09; controls.rotateSpeed = 0.7;
  controls.minPolarAngle = 0.12; controls.maxPolarAngle = 1.2; controls.minDistance = 3; controls.maxDistance = 45;
  controls.screenSpacePanning = true;
  // trascinamento "rimasto appeso": se il mouse viene rilasciato fuori dalla mappa (o fuori dalla finestra) a volte il
  // browser non manda il "rilascio" e la casa continuerebbe a girare seguendo il cursore senza tasto premuto.
  // Lo chiudo io: mouse che si muove senza tasti, cattura del puntatore persa, pagina che perde il fuoco.
  const TATTILE_0 = matchMedia("(pointer: coarse)").matches;
  const chiudiTrascina = (ev) => {
    const cv = renderer.domElement, ps = controls._pointers || [];
    const ids = ev && ev.pointerId != null ? [ev.pointerId].filter((i) => ps.includes(i)) : [...ps];
    for (const id of ids) {
      let finto = false; try { finto = !cv.hasPointerCapture(id); } catch (e) { finto = true; }
      if (finto) cv.releasePointerCapture = () => {};
      try { controls._onPointerUp({ pointerId: id, pointerType: (ev && ev.pointerType) || "mouse" }); } catch (e) {} finally { if (finto) delete cv.releasePointerCapture; }
    }
  };
  renderer.domElement.addEventListener("pointermove", (ev) => { if (ev.pointerType === "mouse" && ev.buttons === 0 && (controls._pointers || []).length) chiudiTrascina(ev); }, true);
  renderer.domElement.addEventListener("lostpointercapture", (ev) => { if (ev.pointerType === "mouse") chiudiTrascina(ev); });
  window.addEventListener("blur", () => { if (!TATTILE_0 && (controls._pointers || []).length) chiudiTrascina(null); });
  // con il mouse la rotella fa scorrere la pagina; lo zoom resta al pizzico (trackpad, iPad) o a ⌘/ctrl + rotella
  el.addEventListener("wheel", (e) => {
    if (e.ctrlKey || e.metaKey) return;
    e.stopPropagation();
    const h = el.querySelector(".tre-zoom") || Object.assign(document.createElement("div"), { className: "tre-zoom", textContent: "Pizzica o usa ⌘ + rotella per avvicinarti" });
    if (!h.isConnected) el.append(h);
    h.classList.add("vis"); clearTimeout(h._t); h._t = setTimeout(() => h.classList.remove("vis"), 1400);
  }, { capture: true, passive: true });
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  // touch (iPad/iPhone): la mappa è attiva da subito (un dito la ruota, due dita zoom e spostamento)
  const TATTILE = matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 1 && !matchMedia("(hover: hover)").matches);
  let mappaViva = !TATTILE;
  const bAttiva = document.createElement("button"); bAttiva.type = "button"; bAttiva.className = "tre-attiva";
  function attiva(v) {
    mappaViva = v; el.classList.toggle("attivo", v);
    controls.enabled = v;
    renderer.domElement.style.touchAction = v ? "none" : "pan-y";
    bAttiva.innerHTML = v ? "<b>✓</b> Fine" : "☝︎ Tocca per muovere";
    bAttiva.classList.add("vis"); clearTimeout(bAttiva._t);
    // il pulsante resta sempre visibile: è l'unico modo per capire che la mappa va "presa" prima di muoverla
  }
  const dita = new Set();
  // --- protezione dai tocchi accidentali ---
  // un tocco su un oggetto o su un'icona accende/spegne solo se: c'era un dito solo, la mappa era ferma quando il dito
  // si è appoggiato, e non è in corso un volo. Prima un pizzico con un dito quasi fermo o il dito che ferma la mappa
  // che scivola potevano accendere la lampada sotto il dito.
  const tocchi = new Set(); let ultimoMulti = -1e9, ultimoGiu = { t: 0, moto: false };
  el.addEventListener("pointerdown", (ev) => {
    if (ev.pointerType === "mouse") return;
    tocchi.add(ev.pointerId); if (tocchi.size > 1) ultimoMulti = performance.now();
    let moto = false; try { moto = (mappaViva && performance.now() - ultimoMoto < 250) || !!volo; } catch (e) {}
    // a mappa non ancora presa il dito non può averla fatta scivolare: i movimenti della camera dopo il caricamento
    // (riadattamenti allo schermo, barra del browser che si nasconde) non devono far ignorare il primo tocco // durante il caricamento volo non esiste ancora
    ultimoGiu = { t: performance.now(), moto, id: ev.pointerId };
  }, true);
  const tocchiVia = (ev) => { if (tocchi.size > 1) ultimoMulti = performance.now(); tocchi.delete(ev.pointerId); };
  el.addEventListener("pointerup", tocchiVia, true); el.addEventListener("pointercancel", tocchiVia, true);
  const toccoValido = () => { try { return !volo && performance.now() - ultimoMulti > 500 && !ultimoGiu.moto && tocchi.size <= 1; } catch (e) { return false; } };
  // mappa attiva subito anche su iPad/iPhone: niente pulsante "Tocca per muovere / Fine" e niente riquadro intorno
  if (TATTILE) attiva(true);
  // su iPad il riflesso del pavimento (che ridisegna la casa una seconda volta) si calcola solo a camera ferma
  let sporco = true, ultimoMoto = 0, tRifl = null;
  // traccia degli ultimi lavori (nome, durata): quando un fotogramma si blocca finisce nel registro di HA con il blocco
  const traccia = [];
  const segna = (cosa, ms) => { traccia.push([performance.now(), cosa, ms == null ? null : Math.round(ms)]); if (traccia.length > 40) traccia.shift(); };
  // lavori pesanti (immagini sulla GPU, piano di sopra, schede di HA): su iPad uno alla volta e solo a mappa ferma
  const coda = []; let inCoda = false;
  const fermo = () => { try { return !occupato(); } catch (e) { return true; } };
  // calma: per i lavori meno urgenti (schede sotto la mappa) la mappa deve essere ferma da più tempo, così chi entra
  // in una stanza e pizzica subito trova la mappa libera
  // basso: lavoro di fondo (stanze preparate in anticipo), passa dopo quelli che servono adesso; può essere una funzione
  function quandoLibero(nome, fn, calma, basso) {
    return new Promise((ok) => { coda.push({ nome, fn, ok, calma, basso }); if (!inCoda) { inCoda = true; setTimeout(passoCoda, 0); } });
  }
  const eBasso = (j) => { try { return typeof j.basso === "function" ? !!j.basso() : !!j.basso; } catch (e) { return false; } };
  function passoCoda() {
    if (!coda.length) { inCoda = false; return; }
    let ix = coda.findIndex((j) => !eBasso(j)); if (ix < 0) ix = 0;
    const c0 = coda[ix].calma || 0;
    if (finito) { coda.length = 0; inCoda = false; return; }
    if (perso || (SU_TOUCH && (!fermo() || document.visibilityState !== "visible" || (c0 && performance.now() - ultimoMoto < c0)))) { setTimeout(passoCoda, 250); return; }
    const j = coda.splice(ix, 1)[0], t0 = performance.now(); let r;
    try { r = j.fn(); } catch (e) { segna("errore " + j.nome); }
    // la durata comprende anche il lavoro che il browser fa subito dopo (disegno delle schede, caricamento sulla GPU)
    setTimeout(() => { const ms = performance.now() - t0; if (ms > 40) segna(j.nome, ms); j.ok(r); setTimeout(passoCoda, SU_TOUCH ? (eBasso(j) ? 200 : 50) : 0); }, 0);
  }
  controls.addEventListener("change", () => { sporco = true; ultimoMoto = performance.now(); if (SU_TOUCH) { clearTimeout(tRifl); tRifl = setTimeout(() => { sporco = true; }, 300); } });

  // --- materiali: mappe di luce per gruppo ---
  const tl = new THREE.TextureLoader();
  const aniso = renderer.capabilities.getMaxAnisotropy();
  // se un file non arriva (rete debole o server occupato) riprovo fino a 4 volte
  // su iPad/iPhone le mappe di luce arrivano a metà risoluzione (file _m): molta meno memoria, la mappa non si pianta
  const bl = typeof createImageBitmap !== "undefined" ? new THREE.ImageBitmapLoader().setOptions({ imageOrientation: "none", premultiplyAlpha: "none", colorSpaceConversion: "none" }) : null;
  const tlx = bl ? { load: (u, ok, p, err) => bl.load(u, (b) => { const t = new THREE.Texture(b); t.needsUpdate = true; ok(t); }, p, err) } : tl;
  // iPad/iPhone: mappe compresse per la GPU (.ktx2), decodificate in un worker e caricate senza conversioni; se mancano, la webp
  const kx = SU_TOUCH && opts.leggere !== false && opts.ktx !== false ? new KTX2Loader().setTranscoderPath(base + "basis/").setWorkerLimit(2).detectSupport(renderer) : null;
  let kxOk = !!kx;
  const caricaK = (nome) => new Promise((ok) => kx.load(base + nome.replace(/\.webp$/, "_m.ktx2") + V, (t) => { t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 1;
    quandoLibero("gpu " + nome.slice(5, -5), () => { try { renderer.initTexture(t); } catch (e) {} }).then(() => { sporco = true; ok(t); }); }, undefined, () => ok(null)));
  const carica = (nome, prova = 0) => kxOk && nome.startsWith("luce_") && prova === 0 ? caricaK(nome).then((t) => { if (t) return t; kxOk = false; return carica(nome, 1); }) : new Promise((ok) => tlx.load(base + (SU_TOUCH && opts.leggere !== false && nome.startsWith("luce_") ? nome.replace(/\.webp$/, "_m.webp") : nome) + V, (t) => { t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(SU_TOUCH ? 2 : 8, aniso);
      // la mappa va subito nella scheda grafica (a casa ferma): se ci andasse al primo disegno, il primo cambio di piano si bloccherebbe
      quandoLibero("gpu " + nome.slice(5, -5), () => { try { renderer.initTexture(t); } catch (e) {} }).then(() => { sporco = true; ok(t); }); }, undefined,
    () => prova < 4 ? setTimeout(() => carica(nome, prova + 1).then(ok), 400 * (prova + 1)) : ok(null)));
  // mappe di giorno e sera del piano base: le chiedo subito, mentre il modello è ancora in viaggio
  const PRE = {};
  const _h = new Date().getHours() + new Date().getMinutes() / 60, PRIMO = opts.giorno != null ? (opts.giorno >= 0.5 ? "giorno" : "sera") : _h > 7.2 && _h < 16.8 ? "giorno" : "sera"; // dal sole se la scheda lo sa, se no dall'orologio
  for (const k of Object.keys(meta.gruppi)) for (const f of [PRIMO]) if (meta.gruppi[k].strati && meta.gruppi[k].strati[f]) PRE[`luce_${prefissoPiano(BASE)}${k}_${f}.webp`] = carica(`luce_${prefissoPiano(BASE)}${k}_${f}.webp`);
  // il modello dopo le mappe: la sua decodifica occupa il browser e non deve ritardare le richieste delle immagini
  pModello = new Promise((ok) => setTimeout(ok, 0)).then(() => caricaModello(base + "casa_" + BASE + "_mod.json" + V, base));
  const nero = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); nero.needsUpdate = true;
  const gruppi = {}; // k -> { mat, lamp: [ent], mesh }
  // il vetro scrive il colore già "da schermo". Nel cambio di piano ogni piano passa da un'immagine intermedia che poi viene
  // tonemappata e convertita: lì il vetro diventava bianco. Con VETRO_RT = 1 scrivo il colore lineare (circa l'inverso)
  const VETRO_RT = { value: 0 }, VETRO_K = { value: 0.2 } /* tarato a occhio confrontando i fotogrammi prima e durante il cambio */;
  const vetro = () => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { rt: VETRO_RT, rk: VETRO_K },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV; uniform float rt, rk; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
      vec3 c = mix(vec3(0.62, 0.74, 0.78), vec3(0.85, 0.92, 0.95), f); if (rt > 0.5) c = pow(c, vec3(2.2)) * rk;
      gl_FragColor = vec4(c, 0.04 + 0.22 * f); }` });
  // texture di dettaglio (Poly Haven, CC0) in scala di grigi: si moltiplicano sulla luce cotta e restano nitide da vicino.
  // La categoria arriva nel secondo UV (u = metri + 1000 * categoria), vedi casa3d/dettaglio_web.py
  // le 4 texture stanno in una sola (parquet, legno, intonaco, tessuto nei canali R, G, B, A): libera 3 posti per le lampade
  const DET_UNI = { dOn: { value: 0 }, dP: { value: nero } };
  // su touch le venature sono spente nello shader: non scarico né carico in GPU la loro texture
  if (!SU_TOUCH) tl.load(base + "det_pack.webp" + V, (t) => {
    t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.premultiplyAlpha = false; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(8, aniso);
    DET_UNI.dP.value = t; DET_UNI.dOn.value = 1; sporco = true;
  });
  const DET_GLSL = `
    uniform sampler2D dP; uniform float dOn;
    float dHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    vec3 dGriglia(vec2 p, float lato, vec3 fuga, float w){
      vec2 q = p / lato; vec2 f = fract(q); vec2 e = min(f, 1.0 - f) * lato; float d = min(e.x, e.y);
      float aa = fwidth(d) + 1e-5; float g = 1.0 - smoothstep(w * 0.5, w * 0.5 + aa, d);
      g *= 1.0 - smoothstep(0.004, 0.02, aa);
      float t = 1.0 + (dHash(floor(q)) - 0.5) * 0.05;
      return mix(vec3(t), fuga, g);
    }
    vec3 dettaglio(){
      int K = int(floor(vK + 0.5)); vec2 p = vD; vec3 r = vec3(1.0);
      if (K == 1) r = vec3(mix(1.0, texture2D(dP, p / 1.3).r / 0.400, 0.9));
      else if (K == 2) r = vec3(mix(1.0, texture2D(dP, p.yx).g / 0.726, 0.85));
      else if (K == 3) r = vec3(mix(1.0, texture2D(dP, p / 2.0).b / 0.646, 0.35));
      else if (K == 4) r = vec3(mix(1.0, texture2D(dP, p / 0.27).a / 0.656, 0.6));
      else if (K == 5) return dGriglia(p, 0.33, vec3(0.85, 0.86, 0.84) / vec3(0.685, 0.725, 0.715), 0.004);
      else if (K == 6) return dGriglia(p, 0.20, vec3(0.82, 0.84, 0.80) / vec3(0.44, 0.53, 0.51), 0.003);
      else if (K == 7) return dGriglia(vec2(p.x + p.y, p.y - p.x) * 0.70710678, 0.30, vec3(0.78, 0.78, 0.76) / vec3(0.905, 0.905, 0.885), 0.003);
      else if (K == 8) return dGriglia(vec2(p.x + p.y, p.y - p.x) * 0.70710678, 0.33, vec3(0.55, 0.42, 0.33) / vec3(0.84, 0.635, 0.48), 0.004);
      // piastrelle generiche (kit): fuga un po' più chiara della piastrella, qualunque sia il suo colore
      else if (K == 12) return dGriglia(p, 0.30, vec3(1.16), 0.003);
      else if (K == 13) return dGriglia(p, 0.60, vec3(1.16), 0.003);
      else if (K == 14) return dGriglia(p, 0.20, vec3(1.16), 0.003);
      else if (K == 15) return dGriglia(vec2(p.x + p.y, p.y - p.x) * 0.70710678, 0.30, vec3(1.16), 0.003);
      return mix(vec3(1.0), r, dOn);
    }`;
  // riflessi veri sui pavimenti: la casa vista da sotto il pavimento (specchio) in una texture a metà risoluzione,
  // poi parquet e piastrelle la mescolano con il fresnel e una leggera sfocatura (lucidi ma non specchi)
  // parquet in alta definizione (blender/pavimento.py): un'unica immagine del pavimento per tutto il piano, moltiplicata
  // sulla luce cotta solo sui pixel del pavimento. Le mappe di luce del pavimento sono cotte a tinta unita (colore medio pM):
  // così il legno è identico in ogni stanza e non ci sono stacchi sul confine tra due stanze.
  // scurimento per POSIZIONE: entrando in una stanza si scurisce tutto ciò che sta fuori dal suo rettangolo (fB: x0, z0, x1, z1),
  // non "per pezzo". Così funziona anche con un pavimento unico per l'open space o una facciata unica.
  const FOC = { fB: { value: new THREE.Vector4(-1e9, -1e9, 1e9, 1e9) }, fL: { value: 1 } };
  const PAV = { pT: { value: nero }, pOn: { value: 0 }, p0: { value: new THREE.Vector2() }, pS: { value: new THREE.Vector2(1, 1) }, pM0: { value: new THREE.Vector3(1, 1, 1) }, pM1: { value: new THREE.Vector3(1, 1, 1) }, pM2: { value: new THREE.Vector3(1, 1, 1) }, pN: { value: 1 } };
  // ogni piano ha: la sua immagine dei legni (pavimento_<piano>), il suo spostamento durante il cambio di piano (SP: le
  // correzioni legate all'altezza dei muri non devono scorrere), il suo modello e i suoi dati
  const nuovoPAV = () => Object.fromEntries(Object.entries(PAV).map(([k, u]) => [k, { value: u.value && u.value.clone && !u.value.isTexture ? u.value.clone() : u.value }]));
  const PIANO = {};
  for (const n of PIANI) PIANO[n] = { nome: n, i: idxPiano(n), meta: n === BASE ? meta : null, scena: null, U: n === BASE ? PAV : nuovoPAV(), SP: { value: 0 },
    chiave: chiavePiano(n), pref: prefissoPiano(n), foro: null, vetroScala: null, carica: null };
  const PB = PIANO[BASE];
  function caricaPavimento(P, piano, U) {
    tl.load(base + "pavimento_" + piano + (SU_TOUCH ? "_m" : "") + ".webp" + V, (t) => {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(SU_TOUCH ? 4 : 8, aniso);
      U.pT.value = t; U.p0.value.set(P.x0, P.z0); U.pS.value.set(P.x1 - P.x0, P.z1 - P.z0); (P.medie || [P.media]).forEach((c, i) => U["pM" + i].value.set(...c)); U.pN.value = P.pannelli || 1; U.pOn.value = 1; sporco = true;
    });
  }
  if (meta.pavimento) caricaPavimento(meta.pavimento, BASE, PAV);
  const RIF = { tR: { value: nero }, rOn: { value: 0 }, rY: { value: 0 }, rM: { value: new THREE.Matrix4() }, rPx: { value: new THREE.Vector2(1 / 512, 1 / 512) } };
  const PRONTE = [], TUTTE = [], PG = [], PS = [], ALTRA = []; // ALTRA: avvia subito l'altra serie // PG/PS: mappe di giorno e di sera di tutti i gruppi // mappe del momento (la casa compare) / anche quelle dell'altra ora del giorno (il velo va via)
  const slug = (e) => e.replace(/\|/g, "__").replace(/ /g, "_");
  // muri più vivi: tinta della facciata, cima dei muri (giorno / sera). Colori in casa.config.js, se servono diversi
  const _v3 = (a, d) => { const x = a || d; return `vec3(${x.map((n) => (+n).toFixed(3)).join(", ")})`; };
  const _fc = C.colore_facciata || [0.42, 0.52, 0.70], _fl = _fc[0] * 0.2126 + _fc[1] * 0.7152 + _fc[2] * 0.0722;
  const FACCIATA = _v3(_fc.map((x) => (x / _fl) * 0.55)), FACCIATA_SERA = _v3(C.colore_facciata_sera, [0.10, 0.17, 0.40]), NOTTE_AMB = _v3(C.notte_ambiente, [0, 0, 0]), NOTTE_FREDDA = (+(C.notte_fredda ?? 1)).toFixed(3), LATI = (+(C.luce_lati ?? 0.45)).toFixed(3), LATI_DIR = `normalize(vec2(${(C.luce_lati_dir || [-0.8, 0.6]).join(", ")}))`, CIMA_GIORNO = _v3(C.cima_muri_giorno, [1.25, 1.25, 1.25]), CIMA_SERA = _v3(C.cima_muri_sera, [0.42, 0.47, 0.58]);
  // quota della cima dei muri e ingombro del piano (per sapere da che lato del muro esterno si guarda)
  function BORDI(k, F) {
    const m = F.meta, B = Object.values(m.stanze).map((s) => s.box);
    const x0 = Math.min(...B.map((b) => b[0])), z0 = Math.min(...B.map((b) => b[2])), x1 = Math.max(...B.map((b) => b[3])), z1 = Math.max(...B.map((b) => b[5]));
    return { tY: { value: B[0][1] + (C.quota_taglio ?? 1.15) }, fac: { value: k === "facciata" ? 1 : 0 }, bC: { value: new THREE.Vector4(x0, z0, x1, z1) } };
  }
  // impronta della casa vista dall'alto (per lo zoccolo esterno): di serie il rettangolo delle stanze del piano terra
  // (giardino escluso) allargato dello spessore dei muri esterni; impronta_casa in casa.config.js la fissa a mano
  const IMPRONTA = C.impronta_casa || (() => { const B = Object.entries(meta.stanze).filter(([k]) => !eEsterno(k)).map(([, s]) => s.box), m = +(C.muri_esterni ?? 0.25);
    return [Math.min(...B.map((b) => b[0])) - m, Math.min(...B.map((b) => b[2])) - m, Math.max(...B.map((b) => b[3])) + m, Math.max(...B.map((b) => b[5])) + m]; })();
  function materiale(k, g, F = PB) {
    const pref = F.pref;
    // il browser ha al massimo N texture per materiale: giorno, sera, dettaglio e riflesso sono fisse, le lampade riempiono il resto
    const lamp = Object.keys(g.strati).filter((s) => s !== "giorno" && s !== "sera").slice(0, Math.min(10, Math.max(0, renderer.capabilities.maxTextures - 5)));
    const uni = { ...DET_UNI, ...RIF, ...F.U, ...FOC, tG: { value: nero }, tS: { value: nero }, ...BORDI(k, F), sG: { value: g.strati.giorno || 1 }, sS: { value: g.strati.sera || 1 }, giorno: { value: 1 }, opac: { value: 1 }, dit: { value: 0 }, luce: { value: 1 }, spY: F.SP };
    let dich = "", somma = "";
    // tutte le stanze usano lo STESSO programma grafico (stesso numero di lampade, quelle in più restano spente):
    // il browser lo compila una volta sola invece che una per stanza (su iPad erano 7 secondi di blocco)
    const NL = Math.min(10, Math.max(0, renderer.capabilities.maxTextures - 5));
    for (let i = 0; i < NL; i++) { uni["t" + i] = { value: nero }; uni["k" + i] = { value: new THREE.Vector3() }; dich += `uniform sampler2D t${i}; uniform vec3 k${i};\n`; somma += `if (k${i}.x + k${i}.y + k${i}.z > 0.0) c += texture2D(t${i}, vUv).rgb * k${i};\n`; } // lampada spenta: niente lettura dell'immagine
    const mat = new THREE.ShaderMaterial({
      uniforms: uni, transparent: true,
      vertexShader: `attribute vec2 uv1; varying vec2 vUv; varying vec2 vD; varying float vK; varying vec3 vW; varying vec3 vNw; varying vec4 vRp; uniform mat4 rM; varying vec3 vQ; uniform float spY;
        void main(){ vUv = uv; float k = floor(uv1.x / 1000.0 + 0.5); vK = k; vD = vec2(uv1.x - 1000.0 * k, uv1.y);
        vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vQ = w.xyz - vec3(0.0, spY, 0.0); vNw = normalize(mat3(modelMatrix) * normal); vRp = rM * w;
        gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `varying vec2 vUv; varying vec2 vD; varying float vK; uniform sampler2D tG, tS; uniform float sG, sS, giorno, opac, dit, luce; uniform float tY, fac; uniform vec4 bC;
        varying vec3 vW; varying vec3 vQ; varying vec3 vNw; varying vec4 vRp; uniform sampler2D tR; uniform float rOn, rY; uniform vec2 rPx; uniform vec4 fB; uniform float fL; uniform sampler2D pT; uniform float pOn, pN; uniform vec2 p0, pS; uniform vec3 pM0, pM1, pM2;\n${dich}${SU_TOUCH ? "vec3 dettaglio(){ return vec3(1.0); }" : DET_GLSL}
        // distanza dal bordo esterno della casa (positiva dentro, negativa fuori): impronta da casa.config.js (impronta_casa)
        float dentroCasa(vec2 p){ vec4 r = vec4(${IMPRONTA.map((x) => (+x).toFixed(3)).join(", ")}); return min(min(p.x - r.x, r.z - p.x), min(p.y - r.y, r.w - p.y)); }
        float eH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float eN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(eH(i), eH(i + vec2(1.0, 0.0)), f.x), mix(eH(i + vec2(0.0, 1.0)), eH(i + 1.0), f.x), f.y); }
        void main(){ vec3 cs = texture2D(tS, vUv).rgb * sS;
        // sera: la luce cotta della notte viene da un cielo blu. Da sola va bene, ma con le lampade accese le pareti in ombra restavano
        // blu acceso accanto ai pavimenti caldi. La tengo quasi grigia e un po' più scura (C.notte_saturazione, C.notte_luce)
        cs = mix(vec3(dot(cs, vec3(0.2126, 0.7152, 0.0722))), cs, ${(+(C.notte_saturazione ?? 1.4)).toFixed(3)}) * ${(+(C.notte_luce ?? 1.0)).toFixed(3)};
        vec3 cd = texture2D(tG, vUv).rgb * sG;
        // piede dei muri: la cottura lascia macchie scure dove il muro tocca il prato. Prendo la luce più pulita dei punti vicini
        // giorno: la luce del cielo lascia un velo azzurro nelle ombre dei muri bianchi. Lo tolgo (resta grigio neutro) e schiarisco
        // le superfici verticali chiare e neutre (pareti), così l'intonaco resta bianco anche in ombra
        // piede delle pareti (sotto 30 cm): la cottura ha lasciato rumore e macchie (riflesso del prato). Ogni punto prende la luce
        // dello stesso punto della parete 32 cm più in alto, dove la mappa è pulita (calcolo esatto sul piano della parete, non cambia
        // con zoom, movimento o cambio di piano), poi una lieve ombra verso terra
        float hQ = vQ.y - (tY - ${(+(C.quota_taglio ?? 1.15)).toFixed(3)});
        if (vNw.y < 0.5 && hQ < 0.32 && hQ > -0.005) {   // solo pareti, da terra in su (non il fianco della base sotto il prato)
          vec2 tg = normalize(vec2(-vNw.z, vNw.x)); float sw = dot(vQ.xz, tg);
          float dsx = dFdx(sw), dsy = dFdy(sw), dyx = dFdx(vQ.y), dyy = dFdy(vQ.y), det = dsx * dyy - dsy * dyx;
          if (abs(det) > 1e-10) { vec2 g = (-dsy * dFdx(vUv) + dsx * dFdy(vUv)) / det; vec2 su = vUv + g * (0.32 - hQ);
            float kq = 1.0 - smoothstep(0.24, 0.32, hQ);
            if (giorno > 0.001) { vec3 u = texture2D(tG, su).rgb * sG; float lu = dot(u, vec3(0.2126, 0.7152, 0.0722));
              if (lu > 0.06 && (max(u.r, max(u.g, u.b)) - min(u.r, min(u.g, u.b))) < 0.45 * max(u.r, max(u.g, u.b))) cd = mix(cd, u, kq); }
            if (giorno < 0.999) { vec3 u = texture2D(tS, su).rgb * sS; cs = mix(cs, u, kq * step(0.02, dot(texture2D(tG, su).rgb, vec3(0.33)))); } }
          float om = mix(0.86, 1.0, smoothstep(0.0, 0.3, hQ)); cd *= om; cs *= om; }
        // piede dei muri: la luce del prato lascia puntini azzurri nella cottura. Lì tolgo la tinta (sfumando, senza bordo)
        if (vNw.y < 0.5) { float k = 1.0 - smoothstep(0.0, 0.18, vQ.y - (tY - ${(+(C.quota_taglio ?? 1.15)).toFixed(3)}));
          cd = mix(cd, vec3(max(cd.r, max(cd.g, cd.b))) * 0.97, k); }
        { float lg = dot(cd, vec3(0.2126, 0.7152, 0.0722)); float fz = clamp((cd.b - max(cd.r, cd.g)) / max(cd.b, 0.001) * 8.0, 0.0, 1.0);
          cd = mix(cd, vec3(lg), fz * 0.85);
          float sat = (max(cd.r, max(cd.g, cd.b)) - min(cd.r, min(cd.g, cd.b))) / max(max(cd.r, max(cd.g, cd.b)), 0.001);
          float fuori = 1.0 - smoothstep(0.0, 0.02, dentroCasa(vW.xz));   // base esterna intorno al prato
          cd *= 1.0 + (0.32 + 0.14 * fuori) * smoothstep(0.12, 0.3, lg) * (1.0 - smoothstep(0.08, 0.2, sat)); }
        // base esterna e vialetti (piani orizzontali fuori dalla casa, non verdi): la cottura li lascia grigi, più scuri sul davanti.
        // Il piano della base (5 mm sotto il prato) diventa chiaro come la fioriera bianca; il vialetto (a filo del prato) un po' meno
        if (vNw.y > 0.9 && dentroCasa(vW.xz) < -0.01 && !(cd.g > cd.r * 1.25 && cd.g > cd.b * 1.25)) {
          float hB = vQ.y - (tY - ${(+(C.quota_taglio ?? 1.15)).toFixed(3)});
          if (hB < -0.002 && hB > -0.03) cd = max(cd * ${(+(C.base_luce ?? 1.0)).toFixed(3)}, vec3(${(+(C.base_chiaro ?? 0)).toFixed(3)}));
          else if (abs(hB) <= 0.002) cd = max(cd * ${(+(C.vialetto_luce ?? 1.0)).toFixed(3)}, vec3(${(+(C.vialetto_chiaro ?? 0)).toFixed(3)})); }
        // bordo frontale dei vialetti (6 cm sotto il prato): combacia col fianco della base e la cottura l'ha lasciato nero
        if (vNw.y < 0.5 && vQ.y - (tY - ${(+(C.quota_taglio ?? 1.15)).toFixed(3)}) < 0.002 && vQ.y - (tY - ${(+(C.quota_taglio ?? 1.15)).toFixed(3)}) > -0.075
            && dentroCasa(vW.xz) < 0.0) { cd = max(cd, vec3(0.42)); cs = max(cs, vec3(0.02, 0.025, 0.035)); }
        vec3 c = mix(cs, cd, giorno);
        // luci delle lampade accese (una mappa per lampada), sommate sopra la luce del giorno o della sera
        ${somma}
        // prato: non un tappeto uniforme ma zone più chiare e più scure, un filo di giallo qua e là e la grana fine dei fili d'erba
        if (vNw.y > 0.9 && cd.g > cd.r * 1.25 && cd.g > cd.b * 1.25) {
          // prato all'inglese: fitto e pari, strisce del tosaerba larghe 80 cm, grana fine dei fili, appena un respiro di colore
          float st = smoothstep(-0.25, 0.25, sin(vW.x * 3.927));
          float n = eN(vW.xz * 1.2) * 0.35 + eN(vW.xz * 60.0) * 0.4 + eN(vW.xz * 140.0) * 0.25;
          c *= 0.88 + 0.24 * n; }
        c *= dettaglio();
        // legni HD (categorie 9, 10, 11 = pannelli 0, 1, 2 della stessa immagine, uno sotto l'altro): solo facce verso l'alto
        float pI = floor(vK + 0.5) - 9.0;
        if (pOn > 0.5 && vNw.y > 0.9 && pI >= 0.0 && pI < pN) { vec2 q = (vW.xz - p0) / pS;
          if (q.x >= 0.0 && q.x <= 1.0 && q.y >= 0.0 && q.y <= 1.0) {
            q.y = clamp(q.y, 0.5 / 1024.0, 1.0 - 0.5 / 1024.0);  // niente sbavature dal pannello vicino
            vec3 pm = pI < 0.5 ? pM0 : (pI < 1.5 ? pM1 : pM2);
            c *= texture2D(pT, vec2(q.x, 1.0 - (pI + q.y) / pN)).rgb / pm * vec3(${(C.legno_tinta || [1, 1, 1]).map((x) => (+x).toFixed(3)).join(", ")}); } }   // legno come nell'anteprima approvata: rovere chiaro, un filo rosato
        if (${SU_TOUCH ? "false" : "rOn > 0.5"} && vNw.y > 0.9 && abs(vW.y - rY) < 0.006) {
          int K = int(floor(vK + 0.5));
          float forza = K == 1 ? 0.17 : (K >= 5 && K < 9 ? 0.3 : 0.0);  // 9-11 = legni HD (opachi): niente riflessi
          if (forza > 0.0) {
            vec2 q = vRp.xy / vRp.w; float b = K == 1 ? 3.0 : 1.4;
            vec4 r = texture2D(tR, q) * 0.36;
            r += (texture2D(tR, q + vec2(b, 0.0) * rPx) + texture2D(tR, q - vec2(b, 0.0) * rPx) + texture2D(tR, q + vec2(0.0, b) * rPx) + texture2D(tR, q - vec2(0.0, b) * rPx)) * 0.16;
            float fr = 0.45 + 0.55 * pow(1.0 - clamp(dot(normalize(vNw), normalize(cameraPosition - vW)), 0.0, 1.0), 2.0);
            // solo dove lo specchio vede qualcosa (alfa): sopra la casa senza soffitto non c'è niente da riflettere
            c = mix(c, r.a > 0.001 ? r.rgb / r.a : c, forza * fr * r.a);
          }
        }
        // cima dei muri tagliati: un po' più chiara del muro, così il bordo si vede (tiene la sua luce, non è bianco pieno)
        if (vNw.y > 0.9 && abs(vQ.y - tY) < 0.012) c = mix(c * 1.3, c * 1.3 + 0.06, giorno);
        vec2 fp = vW.xz + vNw.xz * 0.12; vec2 fd = max(fB.xy - fp, fp - fB.zw); float lu = mix(luce, min(luce, fL), smoothstep(0.0, 0.03, max(fd.x, fd.y)));  // esattamente la stanza: il lato del muro che guarda dentro sì, quello che guarda fuori no
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, 0.3 + 0.7 * lu) * (0.22 + 0.78 * lu);
        // dissolvenza "a puntini" (dit = 1): il pezzo resta pieno ma sparisce un puntino alla volta, senza mostrare le facce
        // nascoste dietro (con la trasparenza vera il sotto del solaio e l'interno dei mobili rendevano tutto grigio-scuro)
        if (dit > 0.5) { if (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) >= opac) discard; gl_FragColor = vec4(c, 1.0); }
        else gl_FragColor = vec4(c, opac);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`
    });
    // prima la mappa del momento (giorno o sera), l'altra subito dopo senza far aspettare la casa
    const prendi = (f) => (PRE[`luce_${pref}${k}_${f}.webp`] || carica(`luce_${pref}${k}_${f}.webp`)).then((t) => { if (t) uni[f === "giorno" ? "tG" : "tS"].value = t; });
    const p1 = prendi(PRIMO), p2 = new Promise((ok) => { ALTRA.push(ok); setTimeout(ok, 1200); }).then(() => prendi(PRIMO === "giorno" ? "sera" : "giorno"));
    PRONTE.push(p1); TUTTE.push(p1, p2); (PRIMO === "giorno" ? PG : PS).push(p1); (PRIMO === "giorno" ? PS : PG).push(p2);
    // le mappe delle singole lampade arrivano dopo, così la casa compare subito; una lampada accesa passa avanti
    const chiesta = {};
    const chiedi = (i) => { if (chiesta[i]) return; chiesta[i] = 1; carica(`luce_${pref}${k}_${slug(lamp[i])}.webp`).then((t) => { if (t) uni["t" + i].value = t; }); };
    // anche su iPad e iPhone tutte, in sottofondo dopo la comparsa della casa: oggi sono piccole (256 px compresse, meno di 1 MB
    // in tutto). Prima lì arrivavano solo all'accensione, e la prima accensione di ogni lampada aveva un ritardo visibile
    lamp.forEach((e, i) => setTimeout(() => chiedi(i), (SU_TOUCH ? 4000 : 2500) + i * 150));
    return { mat, lamp, uni, strati: g.strati, chiedi };
  }

  const gltf = await pModello;
  const casa = gltf.scene; scene.add(casa);
  const tende = {}, teli = {};
  // --- tende interne (tenda_*), su qualsiasi piano e in qualsiasi stanza ---
  // ogni tenda appartiene alla stanza calcolata dalla cottura (meta.ent["tenda:..."].stanza); stanza_tende resta solo come riserva.
  // Si allarga lungo il suo lato lungo (x o z) fino a C.tende_chiuse[k] metri (o C.tende_chiuse_m, 1,7 m di serie).
  const stanzaTenda = (k) => ((meta.ent["tenda:" + k] || {}).stanza) || STANZA_TENDE;
  function faiTenda(o, k, chiave) {
    o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox;
    const asse = bb.max.z - bb.min.z > bb.max.x - bb.min.x ? "z" : "x";
    const uni = { giorno: { value: 1 }, opac: { value: 1 }, lamp: { value: 0 }, luce: { value: 1 }, y0: { value: bb.min.y + o.position.y } };
    o.material = new THREE.ShaderMaterial({ uniforms: uni, transparent: true, side: THREE.DoubleSide,
      vertexShader: `varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `varying vec3 vW; varying vec3 vN; uniform float giorno, opac, lamp, luce, y0;
        void main(){ vec3 tess = vec3(0.86, 0.66, 0.56);
          float p = sin(vW.${asse} * 38.0) * 0.5 + 0.5; float pieghe = 0.72 + 0.28 * pow(p, 0.7);
          float alto = 0.85 + 0.15 * clamp((vW.y - y0) / 1.15, 0.0, 1.0);
          float luce0 = mix(0.035, 0.85, giorno) + lamp * 0.55;
          vec3 c = tess * luce0 * pieghe * alto * (0.22 + 0.78 * luce);
          gl_FragColor = vec4(c, opac);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }` });
    // la tenda si allarga dal suo bordo esterno ("sinistra" = lato con x o z minore) verso il centro della vetrata
    const lo = asse === "x" ? bb.min.x : bb.min.z, hi = asse === "x" ? bb.max.x : bb.max.z;
    const perno = ((C.tende_perno || {})[k] || "sinistra") === "sinistra" ? lo : hi;
    if (asse === "x") { o.geometry.translate(-perno, 0, 0); o.position.x += perno; } else { o.geometry.translate(0, 0, -perno); o.position.z += perno; }
    const chiusa = (C.tende_chiuse || {})[k] ?? C.tende_chiuse_m ?? 1.7;
    tende[k] = { mesh: o, larga: hi - lo, chiusa, asse, pos: 1, vis: 1 };
    gruppi[chiave] = { mat: o.material, lamp: [], uni, mesh: o, tenda: k };
  }
  // materiali di un piano: vetri, teli del proiettore, tende e superfici cotte. Uguale per ogni piano; i gruppi di un piano
  // stanno in "gruppi" con la chiave del piano davanti (vedi chiavePiano) e sanno a che piano appartengono (g.piano)
  function vestiPiano(F, radice) {
    radice.traverse((o) => {
      if (!o.isMesh) return;
      const k = o.name.replace(/^G_/, "").replace(/\.\d+$/, "");
      if (k === "vetro" || k.startsWith("vetro_")) { o.material = vetro(); o.renderOrder = 2; if (k === "vetro_scala") F.vetroScala = o; return; }
      const g = F.meta.gruppi[k]; if (!g) return;
      if (k.startsWith("telo_")) {
        // telo del proiettore su qualsiasi piano: scende dal suo bordo alto
        const uni = { giorno: { value: 1 }, opac: { value: 1 }, luce: { value: 1 } };
        o.material = new THREE.ShaderMaterial({ uniforms: uni, side: THREE.DoubleSide,
          vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
          fragmentShader: `varying vec3 vW; uniform float giorno, luce; void main(){ vec3 c = vec3(0.93) * mix(0.05, 0.9, giorno) * (0.22 + 0.78 * luce);
            gl_FragColor = vec4(c, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }` });
        o.geometry.computeBoundingBox(); const top = o.geometry.boundingBox.max.y;
        o.geometry.translate(0, -top, 0); o.position.y += top;
        teli[k] = { mesh: o, pos: 0 }; gruppi[F.chiave + k] = { mat: o.material, lamp: [], uni, mesh: o, piano: F.nome }; return;
      }
      if (k.startsWith("tenda_")) { faiTenda(o, k, F.chiave + k); gruppi[F.chiave + k].piano = F.nome; return; }
      const m = materiale(k, g, F); o.material = m.mat; gruppi[F.chiave + k] = { ...m, mesh: o, piano: F.nome };
    });
  }
  PB.scena = casa; vestiPiano(PB, casa);
  // gruppo che sfuma entrando in una stanza (es. il soppalco sopra il soggiorno): { gruppo, in, opacita }
  const SFUMA = C.sfuma || null, sopp = SFUMA ? gruppi[SFUMA.gruppo] : null;

  // --- ombra sotto la casa: la casa sembra posata a terra invece di fluttuare ---
  // Di serie è l'ombra calcolata una volta per tutte in Blender (blender/ombra.py, "occlusione ambientale"):
  // segue la pianta vera, più scura alla base dei muri e negli angoli, sfuma allontanandosi; davanti alle vetrate è più leggera.
  // Nella pagina è solo un'immagine appoggiata a terra: nessun calcolo in tempo reale, costo quasi nullo su iPad.
  // Se manca il file ombra_terra.webp si usa un'ombra semplice disegnata qui (rettangolo sfumato).
  // C.ombra_casa: false = niente ombra; numero = intensità (0.5 di serie).
  let ombraCasa = null;
  if (C.ombra_casa !== false) {
    const forza = typeof C.ombra_casa === "number" ? C.ombra_casa : 0.5;
    const appoggia = (tex, W, D, x, y, z, f) => {
      ombraCasa = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: null, map: tex, transparent: true, depthWrite: false, opacity: f, toneMapped: false }));
      ombraCasa.rotation.x = -Math.PI / 2; ombraCasa.position.set(x, y, z);
      ombraCasa.renderOrder = -1; ombraCasa.userData.forza = f; ombraCasa.raycast = () => {}; casa.add(ombraCasa); sporco = true;
    };
    const ombraTela = () => {
      const bbC = new THREE.Box3().setFromObject(casa), MARG = 1.6;
      const W = bbC.max.x - bbC.min.x + 2 * MARG, D = bbC.max.z - bbC.min.z + 2 * MARG, PX = 512 / Math.max(W, D);
      const cvO = document.createElement("canvas"); cvO.width = Math.ceil(W * PX); cvO.height = Math.ceil(D * PX);
      const g2 = cvO.getContext("2d"), fuori = cvO.width + 50;
      // il rettangolo vero sta fuori dalla tela: si vede solo la sua ombra sfocata (shadowBlur funziona anche in Safari)
      const strato = (allarga, sfoca, a) => { g2.shadowColor = `rgba(0,0,0,${a})`; g2.shadowBlur = sfoca * PX; g2.shadowOffsetX = fuori;
        g2.fillRect((MARG - allarga) * PX - fuori, (MARG - allarga) * PX, (W - 2 * MARG + 2 * allarga) * PX, (D - 2 * MARG + 2 * allarga) * PX); };
      strato(0.35, 1.1, 0.45); strato(0.05, 0.3, 0.55);
      appoggia(new THREE.CanvasTexture(cvO), W, D, (bbC.min.x + bbC.max.x) / 2, bbC.min.y - 0.01, (bbC.min.z + bbC.max.z) / 2, forza * 0.65);
    };
    fetch(base + "ombra_" + BASE + ".json" + V).then((r) => r.ok ? r.json() : null).then((o) => {
      if (!o) return ombraTela();
      tl.load(base + "ombra_" + BASE + ".webp" + V, (tex) => { tex.anisotropy = 4; appoggia(tex, o.larga, o.profonda, o.x, o.y, o.z, forza); }, undefined, ombraTela);
    }).catch(ombraTela);
  }

  // --- tende da sole a caduta (oggetti animati, non cotti): C.tende_sole = [[chiave, x0, x1, fronte_z, alto]] ---
  // cassonetto in cima; la tela scende davanti all'apertura. Aperta = arrotolata nel cassonetto, chiusa = giù fino a terra
  const tendeSole = {};
  if ((C.tende_sole || []).length) {
    const trama = document.createElement("canvas"); trama.width = 4; trama.height = 64;
    const cx = trama.getContext("2d"); for (let i = 0; i < 16; i++) { cx.fillStyle = i % 2 ? "#6f6a63" : "#7b766e"; cx.fillRect(0, i * 4, 4, 4); }
    const tex = new THREE.CanvasTexture(trama); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapT = THREE.RepeatWrapping;
    for (const [k, x0, x1, FRONTE, ALTO] of C.tende_sole) {
      const largo = x1 - x0, mat = new THREE.MeshBasicMaterial({ map: tex.clone(), side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
      mat.map.repeat.set(1, ALTO / 0.25); mat.map.needsUpdate = true;
      const g = new THREE.PlaneGeometry(largo, 1); g.translate(0, -0.5, 0); // origine in alto: la tela scende verso il basso
      const telo = new THREE.Mesh(g, mat); telo.position.set((x0 + x1) / 2, ALTO, FRONTE + 0.02);
      const cass = new THREE.Mesh(new THREE.BoxGeometry(largo + 0.08, 0.1, 0.12), new THREE.MeshBasicMaterial({ color: 0x8a8f96 }));
      cass.position.set((x0 + x1) / 2, ALTO + 0.04, FRONTE + 0.05);
      casa.add(telo); casa.add(cass);
      tendeSole[k] = { telo, mat, cmat: cass.material, alto: ALTO, pos: 1, vis: 1 };
    }
  }
  const caffe = [];

  // --- schermi TV animati: quando la TV è accesa lo schermo mostra un "film" (inquadrature che cambiano) e la luce nella stanza lo segue ---
  const TV_GLSL = `varying vec2 vUv; uniform float tempo, acceso, luce, menu, giorno; uniform vec3 cA, cB, cC; uniform float taglio;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float nz(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
    void main(){
      vec2 uv = vUv; vec3 c;
      if (menu > 1.5) {
        // modalità Arte (Frame): un dipinto fermo, pennellate calde e cornice passe-partout
        vec2 q = uv * vec2(4.0, 2.4);
        float a = nz(q) * 0.55 + nz(q * 3.1) * 0.3 + nz(q * 9.0) * 0.15;
        c = mix(vec3(0.62, 0.48, 0.30), vec3(0.20, 0.32, 0.30), smoothstep(0.35, 0.7, a + uv.y * 0.3));
        c = mix(c, vec3(0.85, 0.62, 0.35), smoothstep(0.72, 0.8, nz(q * 1.7 + 3.0)) * 0.7);
        float bordo = step(0.06, uv.x) * step(uv.x, 0.94) * step(0.09, uv.y) * step(uv.y, 0.91);
        c = mix(vec3(0.92, 0.90, 0.86), c, bordo) * 0.75;
      } else if (menu > 0.5) {
        // schermata Home: sfondo scuro sfumato e fila di riquadri colorati, quello selezionato più grande
        c = mix(vec3(0.05,0.06,0.10), vec3(0.16,0.10,0.24), uv.y);
        float fila = step(0.16, uv.y) * step(uv.y, 0.40);
        float col = floor((uv.x - 0.04) / 0.155), lx = fract((uv.x - 0.04) / 0.155);
        float sel = mod(floor(tempo / 1.6), 6.0);
        float dentro = fila * step(0.0, col) * step(col, 5.0) * step(0.06, lx) * step(lx, 0.94);
        vec3 tc = 0.55 + 0.45 * cos(6.2831 * (col * 0.17 + vec3(0.0, 0.33, 0.67)));
        c = mix(c, tc * (col == sel ? 1.15 : 0.7), dentro);
        c += step(abs(uv.y - 0.82), 0.035) * step(abs(uv.x - 0.5), 0.18) * 0.25;
      } else {
        // "film": cielo/terra con forme morbide che scorrono, colori dell'inquadratura corrente
        vec2 q = uv * vec2(3.0, 1.7) + vec2(tempo * 0.05 + taglio * 7.3, taglio * 3.1);
        float n = nz(q) * 0.6 + nz(q * 2.3 + tempo * 0.08) * 0.4;
        float orizz = smoothstep(0.30, 0.62, uv.y + (n - 0.5) * 0.35);
        c = mix(cA, cB, orizz);
        float blob = smoothstep(0.62, 0.9, nz(uv * vec2(2.2, 1.4) + vec2(-tempo * 0.12, taglio)));
        c = mix(c, cC, blob * 0.75);
        c *= 0.82 + 0.18 * sin(uv.y * 900.0) * 0.1 + 0.18;
        c *= 1.0 - 0.45 * pow(length(uv - 0.5) * 1.25, 2.2);
      }
      c *= acceso * (0.35 + 0.65 * luce) * mix(0.9, 0.65, giorno);
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  const schermi = {};
  // C.tv = { chiave_oggetto: "x-" | "x+" | "z-" | "z+" } (da che lato guarda lo schermo)
  // TV su qualsiasi piano: lo schermo si crea quando il suo piano è pronto e sta nel modello di quel piano
  function faiSchermi(F) { for (const [e, verso] of Object.entries(C.tv || {})) {
    const m = F.meta.ent[e]; if (!m || !m.box || schermi[e]) continue; const b = m.box;
    const uni = { tempo: { value: 0 }, acceso: { value: 0 }, luce: { value: 1 }, menu: { value: 0 }, giorno: { value: 1 }, taglio: { value: 0 },
      cA: { value: new THREE.Color() }, cB: { value: new THREE.Color() }, cC: { value: new THREE.Color() } };
    const mat = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`, fragmentShader: TV_GLSL });
    const lungoX = verso[0] === "z", geo = new THREE.PlaneGeometry(lungoX ? Math.abs(b[3] - b[0]) : Math.abs(b[5] - b[2]), Math.abs(b[4] - b[1]));
    geo.rotateY({ "x-": -Math.PI / 2, "x+": Math.PI / 2, "z-": Math.PI, "z+": 0 }[verso] ?? -Math.PI / 2);
    const ms = new THREE.Mesh(geo, mat), cy = (b[1] + b[4]) / 2;
    if (verso === "x+") ms.position.set(Math.max(b[0], b[3]) + 0.004, cy, (b[2] + b[5]) / 2);
    else if (verso === "z+") ms.position.set((b[0] + b[3]) / 2, cy, Math.max(b[2], b[5]) + 0.004);
    else if (verso === "z-") ms.position.set((b[0] + b[3]) / 2, cy, Math.min(b[2], b[5]) - 0.004);
    else ms.position.set(Math.min(b[0], b[3]) - 0.004, cy, (b[2] + b[5]) / 2);
    ms.visible = false; ms.renderOrder = 1;
    F.scena.add(ms);
    schermi[e] = { ms, uni, stanza: m.stanza, on: 0, prossimo: 0, da: [new THREE.Color(), new THREE.Color(), new THREE.Color()], a: null, t0: 0, lum: 1, tint: new THREE.Color(1, 1, 1) };
  } }
  faiSchermi(PB);
  // palette delle inquadrature: tramonto, mare, bosco, città di notte, deserto, neve, interno caldo
  const PAL = [["#1d2b64", "#f8a65d", "#ff6f61"], ["#0b3d62", "#3fa7c9", "#e8f4f8"], ["#12301a", "#4f7d3a", "#c5d86d"], ["#0a0b1e", "#24305e", "#f7c548"],
    ["#5b3a1a", "#e2a65b", "#f4dfb6"], ["#5d7a99", "#dfe8f0", "#ffffff"], ["#2a1410", "#a2522e", "#ffc27a"], ["#20103a", "#7b3fa0", "#ff8bd0"]];
  function nuovaInquadratura(sc, now) {
    const p = PAL[Math.floor(Math.random() * PAL.length)].map((x) => new THREE.Color(x).convertSRGBToLinear());
    sc.a = p; sc.t0 = now; sc.prossimo = now + 3200 + Math.random() * 4200; sc.uni.taglio.value = Math.random() * 10;
    sc.uni.cA.value.copy(p[0]); sc.uni.cB.value.copy(p[1]); sc.uni.cC.value.copy(p[2]);
    const avg = p[0].clone().add(p[1]).add(p[2]).multiplyScalar(1 / 3);
    sc.lum = 0.55 + 0.9 * Math.min(1, avg.r * 0.3 + avg.g * 0.59 + avg.b * 0.11) ; const mx = Math.max(avg.r, avg.g, avg.b, 0.01);
    sc.tint.setRGB(0.55 + 0.45 * avg.r / mx, 0.55 + 0.45 * avg.g / mx, 0.55 + 0.45 * avg.b / mx);
  }
  let ultimoTv = 0;
  function animaTv(now, dt) {
    let serve = false;
    for (const [e, sc] of Object.entries(schermi)) {
      const v = (livelli[e] || 0) > 0 ? 1 : 0;
      if (Math.abs(sc.on - v) > 0.001) { sc.on += Math.sign(v - sc.on) * Math.min(Math.abs(v - sc.on), dt * 2.5); sporco = true; }
      sc.ms.visible = sc.on > 0.01; if (!sc.ms.visible) continue;
      const vista = !focus || unite(focus, sc.stanza);
      sc.uni.menu.value = tvModo[e] === "arte" ? 2 : tvModo[e] === "menu" ? 1 : 0;
      if (!sc.a || now > sc.prossimo) nuovaInquadratura(sc, now);
      // tremolio leggero come una TV vera, più forte al cambio d'inquadratura
      const dopoTaglio = Math.max(0, 1 - (now - sc.t0) / 350);
      const fl = sc.uni.menu.value > 1.5 ? 0.6 : sc.uni.menu.value ? 0.85 : sc.lum * (0.92 + 0.08 * Math.sin(now * 0.011) * Math.sin(now * 0.0037)) * (1 + 0.25 * dopoTaglio);
      sc.uni.tempo.value = now / 1000; sc.uni.acceso.value = sc.on; sc.uni.giorno.value = giornoV;
      sc.uni.luce.value = vista ? 1 : 0.3;
      for (const g of Object.values(gruppi)) { const i = g.lamp.indexOf(e); if (i < 0 || !g.kBase) continue; const kb = g.kBase[i]; if (!kb) continue;
        const t = sc.uni.menu.value > 1.5 ? new THREE.Color(1, 0.85, 0.65) : sc.uni.menu.value ? new THREE.Color(0.7, 0.6, 1) : sc.tint;
        g.uni["k" + i].value.set(kb.x * t.r, kb.y * t.g, kb.z * t.b).multiplyScalar(fl * sc.on); }
      if (vista) serve = true;
    }
    // le TV accese tengono il disegno a ~24 fotogrammi al secondo, il resto della casa resta fermo come prima
    if (serve && now - ultimoTv > 41) { ultimoTv = now; sporco = true; }
  }

  // --- altri piani: stesso modello Blender cotto, con la stessa luce per lampada. Si caricano sotto il velo, uno alla volta ---
  function preparaPiano(n) {
    const F = PIANO[n]; if (!F) return Promise.resolve();
    if (F.carica) return F.carica;
    if (n === BASE) return (F.carica = Promise.resolve());
    F.carica = (async () => {
      const t0 = performance.now();
      const mF = await (await fetch(base + "casa_" + n + ".json" + V)).json(); F.meta = mF;
      if (mF.pavimento) caricaPavimento(mF.pavimento, n, F.U);
      // la decodifica del modello occupa il browser: su iPad parte solo a mappa ferma
      const g = await quandoLibero(n + " modello", () => caricaModello(base + "casa_" + n + "_mod.json" + V, base));
      segna(n + " modello pronto", performance.now() - t0);
      F.scena = g.scene; F.scena.visible = false; scene.add(F.scena);
      vestiPiano(F, F.scena);
      registraPorte(F.scena, mF);
      const pav = Object.values(mF.stanze)[0].box[1];
      // vista "Casa" di questo piano: la STESSA del piano base (lato, inclinazione, zoom), solo all'altezza del suo pavimento
      viste[vistaCasa(n)] = { ...viste.casa, t: viste.casa.t.clone().add(new THREE.Vector3(0, pav - Object.values(meta.stanze)[0].box[1], 0)) };
      for (const [k, st] of Object.entries(mF.stanze)) { PIANO_STANZA[k] = n; const [x0, y0, z0, x1, y1, z1] = st.box;
        viste[k] = { t: new THREE.Vector3((x0 + x1) / 2, y0 + 0.6, (z0 + z1) / 2), phi: 0.9, theta: THETA[k] ?? TH_TERRA, raggio: 0.5 * Math.hypot(x1 - x0, z1 - z0) + 0.3, sopra: true, piano: n };
        const vs = (C.viste_stanze || {})[k]; if (vs) Object.assign(viste[k], { phi: vs.phi ?? viste[k].phi, theta: TH_TERRA + (vs.gira || 0), raggio: viste[k].raggio * (vs.zoom || 1) }); }
      for (const [e, m] of Object.entries(mF.ent)) meta.ent[e] = { ...m, sopra: true, piano: n, nome: e.split("|")[1] || e };
      faiSchermi(F);
      visibilitaPiani(); stato({}); sporco = true;
    })();
    F.carica.then(() => quandoLibero(n + " programmi", () => { if (F.scena) { const v = F.scena.visible; F.scena.visible = true; const p = precompila(F.scena); F.scena.visible = v; return p; } }));
    return F.carica;
  }
  // tutti i piani, dal più vicino a quello che si guarda: il primo cambio di piano è subito un volo
  function preparaSopra() {
    const ordine = PIANI.slice().sort((a, b) => Math.abs(idxPiano(a) - idxPiano(pianoOra)) - Math.abs(idxPiano(b) - idxPiano(pianoOra)));
    return ordine.reduce((p, n) => p.then(() => preparaPiano(n)), Promise.resolve());
  }
  const vistaCasa = (n) => (n === BASE ? "casa" : "casa_" + n);
  let pianoOra = BASE;
  // il piano subito sotto quello che si guarda (null al piano base): si vede attraverso il vuoto della scala
  const pianoSotto = (n) => { const i = idxPiano(n); return i > 0 ? PIANI[i - 1] : null; };
  const scenaPiano = (n) => (PIANO[n] && PIANO[n].scena) || null;

  // --- inquadrature ---
  // centro della casa dalle stanze (il giardino intorno non deve spostare l'inquadratura)
  const centroCasa = new THREE.Box3(); for (const [k, s] of Object.entries(meta.stanze)) if (!eEsterno(k)) { const b = s.box; centroCasa.expandByPoint(new THREE.Vector3(b[0], b[1], b[2])).expandByPoint(new THREE.Vector3(b[3], b[1], b[5])); }
  const cCasa = centroCasa.getCenter(new THREE.Vector3());
  // la casa si guarda dal lato del giardino (angolo_casa in casa.config.js)
  // vista "Casa": angolo_casa = da che lato (0 = di fronte, da sud), inclinazione_casa = quanto dall'alto
  // (0 = dritto dall'alto, 1.2 = quasi di lato), zoom_casa = più vicina (>1) o più lontana (<1)
  const TH_TERRA = C.angolo_casa ?? 0.54;
  // vista iniziale un po' bassa e vicina: la casa riempie anche la parte alta dello schermo
  const _qv = (n, d) => { const m = new RegExp("[?&]" + n + "=([-\\d.]+)").exec(location.search); return m ? parseFloat(m[1]) : d; };
  const viste = { casa: { t: new THREE.Vector3(cCasa.x, _qv("vy", -0.2), cCasa.z + _qv("vz", 0.75)), r: 0, phi: _qv("vphi", C.inclinazione_casa ?? 0.98), theta: TH_TERRA, raggio: (meta.stanze.esterno ? 8.0 : 6.6) * _qv("vr", 0.9) / (C.zoom_casa || 1) } };
  for (const [k, s] of Object.entries(meta.stanze)) {
    const [x0, y0, z0, x1, y1, z1] = s.box;
    viste[k] = { t: new THREE.Vector3((x0 + x1) / 2, y0 + 0.6, (z0 + z1) / 2), phi: 0.9, theta: TH_TERRA, raggio: 0.5 * Math.hypot(x1 - x0, z1 - z0) + 0.3 };
    // ritocchi per stanza da casa.config.js: { phi, gira (radianti in più), zoom (1 = automatico) }
    const vs = (C.viste_stanze || {})[k]; if (vs) Object.assign(viste[k], { phi: vs.phi ?? viste[k].phi, theta: TH_TERRA + (vs.gira || 0), raggio: viste[k].raggio * (vs.zoom || 1) });
  }
  // l'esterno, se non è una stanza del modello: vista sul giardino davanti alla casa
  if (!viste.esterno) viste.esterno = { t: new THREE.Vector3(cCasa.x + 0.8, 0, cCasa.z + 4.2), phi: 0.86, theta: TH_TERRA, raggio: 5.6 };
  // giardino: tutta la proprietà vista dall'alto, con la casa al centro della scena
  if (viste.esterno) { viste.esterno.phi = 0.72; viste.esterno.raggio *= 0.78; viste.esterno.t.y = 0.2; }
  function distanza(v) {
    const a = camera.aspect, vf = THREE.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * a);
    return v.raggio / Math.sin(Math.min(vf, hf) / 2) * 0.86 * (1 + Math.min(0.3, Math.max(0, copre) / Math.max(1, el.clientHeight)) * 0.8);
  }
  const sph = new THREE.Spherical();
  function posa() { sph.setFromVector3(camera.position.clone().sub(controls.target)); return { t: controls.target.clone(), r: sph.radius, phi: sph.phi, theta: sph.theta }; }
  function metti(p) { controls.target.copy(p.t); sph.set(p.r, p.phi, p.theta); camera.position.copy(p.t).add(new THREE.Vector3().setFromSpherical(sph)); camera.lookAt(p.t); sporco = true; }
  let volo = null, focus = null, opSopp = 1; let copre = 0;

  // inquadra di nuovo la vista attuale (cambio di dimensioni o primo fotogramma), senza cambiare piano
  function rimetti() {
    const v = viste[focus || vistaCasa(pianoOra)]; if (!v) return;
    if (volo) { volo.a.r = distanza(v); return; }
    metti({ t: v.t.clone(), r: distanza(v), phi: v.phi, theta: v.theta });
  }
  let richiesta = 0;
  async function vai(k, subito, piano) {
    const mia = ++richiesta;
    // una salita o discesa interrotta da un nuovo comando: i due piani tornano subito interi e al loro posto
    if (volo && volo.cambio) pianiInVolo(1, volo.sale, true);
    const vuole = piano || (k && PIANO_STANZA[k]) || (k ? BASE : pianoOra);
    if (!PIANI.includes(vuole)) return;
    if (!scenaPiano(vuole)) { await preparaPiano(vuole); subito = true; if (mia !== richiesta) return; }
    const prima = pianoOra;
    // cambio di piano: anche qui un volo (la camera sale, a metà volo il piano cambia, poi scende), non più uno scatto
    const cambio = vuole !== pianoOra && inizializzato && !subito;
    if (vuole !== pianoOra) { pianoOra = vuole; if (!cambio) subito = true; }
    // il piano terra resta sempre disegnato: dal piano di sopra si vede attraverso il vuoto della scala (il resto lo coprono
    // il solaio e la facciata del piano di sopra)
    if (!cambio) { visibilitaPiani(); for (const n of PIANI) sfumaPiano(n, 1); }
    focus = k && viste[k] ? k : null;
    const v = viste[focus || vistaCasa(pianoOra)];
    const fine = { t: v.t.clone(), r: distanza(v), phi: v.phi, theta: v.theta };
    if (subito || !volo && !inizializzato) { metti(fine); volo = null; }
    else {
      const da = posa(); let dt = fine.theta - da.theta; while (dt > Math.PI) dt -= 2 * Math.PI; while (dt < -Math.PI) dt += 2 * Math.PI;
      fine.theta = da.theta + dt;
      // già in quella vista (o già in volo verso di lei): nessuna animazione da capo. Riparte solo se ci si è spostati.
      const uguale = (p) => p.t.distanceTo(fine.t) < 0.05 && Math.abs(p.r - fine.r) < 0.03 * fine.r && Math.abs(p.phi - fine.phi) < 0.02 && Math.abs(Math.atan2(Math.sin(p.theta - fine.theta), Math.cos(p.theta - fine.theta))) < 0.02;
      // cambio di piano: salita o discesa "in ascensore" (niente giro né arco): la camera sale o scende di un piano
      // la camera parte da dov'è (anche ruotata o dentro una stanza) e intanto gira e si centra sulla vista del piano nuovo;
      // il suo punto di mira è già all'altezza del piano nuovo: il piano che si lascia parte spostato di un piano (vedi
      // disegnaStrati), così al primo fotogramma l'immagine è identica a prima, senza scatti
      if (cambio) { const sale = idxPiano(pianoOra) > idxPiano(prima), L = sale ? prima : pianoOra, U = sale ? pianoOra : prima;
        // i due piani del cambio (quello che si lascia e quello che arriva): interi e visibili; gli altri nascosti
        for (const n of PIANI) { const sc = scenaPiano(n); if (sc) sc.visible = n === L || n === U; }
        nascondiPiano(L, false); nascondiPiano(U, false); const P = altezzaTra(L, U);
        const da2 = { ...da, t: da.t.clone().add(new THREE.Vector3(0, sale ? P : -P, 0)) }; metti(da2); volo = { da: da2, a: fine, t0: performance.now(), giro: 0, dur: DUR_PIANO, cambio, sale, alza: 0 }; strati = { sale, t: 0, L, U }; etichette.style.opacity = "0"; etichette.style.pointerEvents = "none"; }
      else if (!(volo ? uguale(volo.a) : uguale(da))) volo = { da, a: fine, t0: performance.now(), giro: focus ? 0.55 : -0.4, dur: focus ? DUR : DUR * 0.85, alza: 0.22 };
    }
    // dentro una stanza il pizzico si ferma prima di finire a pochi centimetri da un mobile (schermo pieno di una superficie sfocata)
    controls.minDistance = focus ? Math.max(3.2, distanza(v) * 0.5) : 6; controls.maxDistance = distanza(v) * (focus ? 1.8 : 1.4);
    // vista casa: di serie si gira tutto intorno. Chi vuole mostrarla solo da un lato (es. dal giardino) imposta
    // limite_rotazione in radianti attorno ad angolo_casa (0.95 = circa 54 gradi per parte), valido su ogni piano.
    const LIM = C.limite_rotazione ?? null;
    if (!focus && LIM != null) { controls.minAzimuthAngle = TH_TERRA - LIM; controls.maxAzimuthAngle = TH_TERRA + LIM; }
    else { controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity; }
    rifaiEtichette(); sporco = true;
  }
  let inizializzato = false;
  // Al piano di sopra il piano terra si vede solo attraverso il foro della scala (maschera, vedi faiForo).
  // Durante il cambio di piano i nomi delle stanze sono nascosti (tornano a cambio finito, sul piano giusto).
  const sst = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  function sfumaPiano(n, v, tieni) {
    for (const [k, g] of Object.entries(gruppi)) {
      if ((g.piano || BASE) !== n || !g.uni || !g.uni.dit || (tieni && tieni.has(k))) continue;
      g.uni.opac.value = v; g.uni.dit.value = v < 0.999 ? 1 : 0; if (g.mesh) g.mesh.visible = v > 0.001;
    }
    sporco = true;
  }
  // Cambio di piano: due piani veri che si staccano l'uno dall'altro, in 3D. La camera va subito alla vista del piano
  // nuovo; il piano che si lascia parte da dov'era sullo schermo e CADE via (ease-in: lento, poi sempre più veloce),
  // svanendo; poco dopo il piano nuovo SCENDE dall'alto veloce e si posa piano (ease-out). Scendendo è il contrario:
  // il primo piano vola via verso l'alto e il piano terra sale da sotto. Ogni piano si disegna da solo e poi si
  // sovrappongono con trasparenza vera (il piano di sopra sempre davanti), così non si mescolano.
  const eOut = (x) => 1 - (1 - x) ** 3;
  const DUR_PIANO = 1.2, VIA = 6.5, ARRIVO = 5.0; // secondi; metri di caduta del piano che esce / di discesa di quello che entra
  let rientra = null; // { t0 }: dopo la salita le stanze sotto il vuoto della scala ricompaiono in dissolvenza
  function sfumaGruppi(nomi, v) {
    for (const k of nomi) { const g = gruppi[k]; if (!g || !g.uni || !g.uni.dit) continue; g.uni.opac.value = v; g.uni.dit.value = v < 0.999 ? 1 : 0; if (g.mesh) g.mesh.visible = v > 0.001; }
    sporco = true;
  }
  // al piano di sopra: del piano terra restano solo i gruppi sotto il vuoto (ritagliati sul foro); tutto il resto (tende,
  // porte, ombra, TV...) passa su un altro strato della camera e non si disegna né si tocca
  // Il foro della scala (C.vuoto_scala) è una "maschera": un rettangolo invisibile all'altezza del pavimento di sopra che
  // segna i pixel in cui si guarda attraverso il vuoto. I pezzi mascherati (l'ingresso del piano terra e la parte alta
  // della scala) si disegnano solo lì: si vede tutto quello che sta sotto il foro, anche in obliquo, e niente spunta
  // da sotto i bordi del primo piano.
  function maschera(mesh, on) {
    const mm = mesh && mesh.material; if (!mm) return;
    for (const m of Array.isArray(mm) ? mm : [mm]) { m.stencilWrite = on; m.stencilRef = 1; m.stencilFunc = THREE.EqualStencilFunc; m.stencilFuncMask = 0xff; m.stencilWriteMask = 0;
    m.stencilFail = m.stencilZFail = m.stencilZPass = THREE.KeepStencilOp; }
  }
  // vuoto della scala nel solaio di un piano: C.vuoto_scala = [x0, z0, x1, z1] vale per tutti i piani sopra la base
  // (scale una sopra l'altra); { piano: [x0, z0, x1, z1] } per piani con il vuoto in punti diversi
  const vuotoDi = (n) => (n === BASE ? null : Array.isArray(C.vuoto_scala) ? C.vuoto_scala : (C.vuoto_scala || {})[n] || null);
  function faiForo(F) {
    if (!F || F.foro || !F.scena || !F.meta) return; const vu = vuotoDi(F.nome); if (!vu) return;
    const [x0, z0, x1, z1] = vu, y = Object.values(F.meta.stanze)[0].box[1] + 0.005;
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    F.foro = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
      stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilFail: THREE.ReplaceStencilOp }));
    F.foro.renderOrder = -100; F.foro.raycast = () => {}; F.foro.frustumCulled = false; F.scena.add(F.foro);
    mascheraScala(F);
  }
  // la parte alta della scala (nel modello del piano di sopra) e il vetro lungo la scala: sempre e solo nel foro
  function mascheraScala(F) { if (!F.foro) return; const g = gruppi[F.chiave + "scala"]; if (g) maschera(g.mesh, true); if (F.vetroScala) maschera(F.vetroScala, true); }
  // un piano visto da quello di sopra: restano solo i gruppi sotto il vuoto, ritagliati sul foro del piano di sopra (strato 1:
  // la camera lo disegna, i tocchi no); senza foro sparisce del tutto (strato 2). on = false: il piano torna normale.
  function nascondiPiano(n, on) {
    const F = PIANO[n]; if (!F || !F.scena) return;
    const su = PIANI[idxPiano(n) + 1], Fs = su && PIANO[su]; faiForo(Fs);
    const foroSu = on && Fs && Fs.foro;
    F.scena.traverse((o) => { if (!o.isMesh) return; o.layers.set(!on ? 0 : foroSu ? 1 : 2); maschera(o, !!foroSu); });
    if (F.foro) F.foro.visible = !on; // il foro di questo piano non deve aprire buchi mentre lui stesso è ritagliato
    if (!on) { faiForo(F); mascheraScala(F); }
    sporco = true;
  }
  // a riposo: si vede il piano che si guarda e, attraverso il suo vuoto della scala, quello subito sotto; gli altri sono nascosti
  function visibilitaPiani() {
    if (strati) return;
    const sotto = pianoSotto(pianoOra);
    for (const n of PIANI) { const sc = scenaPiano(n); if (!sc) continue; sc.visible = n === pianoOra || n === sotto; sc.position.y = 0; PIANO[n].SP.value = 0; }
    if (sotto) nascondiPiano(sotto, true);
    nascondiPiano(pianoOra, false);
  }
  // distanza in altezza fra due piani (dalle loro viste "Casa"); 3 m se non si sa ancora
  const altezzaTra = (L, U) => { const a = viste[vistaCasa(L)], b = viste[vistaCasa(U)]; return a && b ? b.t.y - a.t.y : 3 * (idxPiano(U) - idxPiano(L)); };
  let strati = null; // { sale, t, L, U } solo durante il cambio di piano (L = piano più basso, U = più alto)
  const nuovoRT = () => new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 4, stencilBuffer: true });
  const rtT = nuovoRT(), rtS = nuovoRT(), scenaStrati = new THREE.Scene(), camStrati = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadro = (r, o) => { const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: r.texture, transparent: true, depthTest: false, depthWrite: false })); q.renderOrder = o; q.frustumCulled = false; scenaStrati.add(q); return q; };
  const qT = quadro(rtT, 0), qS = quadro(rtS, 1), _dim = new THREE.Vector2(), _cc = new THREE.Color();
  const rtArriva = rtS; // (per scalda: prepara i programmi per il disegno in immagine)
  function soloPiano(rt, suo) {
    renderer.getDrawingBufferSize(_dim); if (rt.width !== _dim.x || rt.height !== _dim.y) rt.setSize(_dim.x, _dim.y);
    const sL = scenaPiano(strati.L), sU = scenaPiano(strati.U);
    const ca = renderer.getClearAlpha(); renderer.getClearColor(_cc); const vc = sL.visible, vs = sU.visible;
    renderer.setClearColor(0x000000, 0); sL.visible = !suo; sU.visible = suo;
    renderer.setRenderTarget(rt); renderer.clear(); VETRO_RT.value = 1; renderer.render(scene, camera); VETRO_RT.value = 0;
    renderer.setRenderTarget(null); sL.visible = vc; sU.visible = vs; renderer.setClearColor(_cc, ca);
  }
  function disegnaStrati() {
    const T = strati.t * DUR_PIANO, sale = strati.sale, sL = scenaPiano(strati.L), sU = scenaPiano(strati.U);
    const P = altezzaTra(strati.L, strati.U); // altezza fra i due piani
    // esce in 0,5 s (ease-in, lento poi veloce) e svanisce; l'altro parte solo a 0,38 s, quando il primo è già lontano
    // e quasi trasparente: i due piani non si toccano mai
    const a = Math.min(1, T / 0.5), ea = a * a * a;
    // entra: ease-out cubico che finisce esattamente a DUR_PIANO, con la stessa frenata della camera: si fermano insieme
    const b = Math.min(1, Math.max(0, (T - 0.38) / (DUR_PIANO - 0.38))), eb = 1 - (1 - b) ** 3;
    const opVia = 1 - sst(0.15, 0.78, a), opArr = sst(0, 0.4, b);
    let oT, oS;
    if (sale) { sL.position.y = P - VIA * ea; sU.position.y = ARRIVO * (1 - eb); oT = opVia; oS = opArr; }
    else { sU.position.y = -P + VIA * ea; sL.position.y = -ARRIVO * (1 - eb); oS = opVia; oT = opArr; }
    PIANO[strati.L].SP.value = sL.position.y; PIANO[strati.U].SP.value = sU.position.y;
    sfumaPiano(strati.L, 1); sfumaPiano(strati.U, 1);
    if (oT > 0.002) soloPiano(rtT, false); if (oS > 0.002) soloPiano(rtS, true);
    qT.visible = oT > 0.002; qS.visible = oS > 0.002; qT.material.opacity = oT; qS.material.opacity = oS;
    renderer.clear(); renderer.render(scenaStrati, camStrati);
  }
  function pianiInVolo(t, sale, fine) {
    if (!CON_SOPRA) return;
    if (fine) {
      strati = null; for (const n of PIANI) { const sc = scenaPiano(n); if (sc) sc.position.y = 0; PIANO[n].SP.value = 0; }
      etichette.style.opacity = ""; etichette.style.transition = "opacity .35s"; etichette.style.pointerEvents = "";
      visibilitaPiani();
      for (const n of PIANI) sfumaPiano(n, 1);
      const sotto = pianoSotto(pianoOra);
      if (sotto) { sfumaPiano(sotto, 0); rientra = PIANO[pianoOra].foro ? { t0: performance.now() + 60, piano: sotto } : null; }
      else rientra = null;
      rifaiEtichette();
      el.dispatchEvent(new CustomEvent("m3d-arrivato", { detail: { piano: pianoOra } })); // la scheda cambia la barra solo ora
      return;
    }
    rientra = null;
    etichette.style.transition = "none"; etichette.style.opacity = "0"; etichette.style.pointerEvents = "none"; // icone del nuovo piano non toccabili finché non è arrivato
    if (strati) { strati.t = t; strati.sale = sale; } sporco = true;
  }
  function rientraVuoto(now) {
    if (!rientra) return; const k = Math.min(1, Math.max(0, (now - rientra.t0) / 550));
    sfumaGruppi(Object.keys(gruppi).filter((g) => (gruppi[g].piano || BASE) === rientra.piano), eOut(k)); if (k >= 1) rientra = null;
  }




  // --- stato luci ---
  const livelli = {}, colori = {}, teliStato = {}, tvModo = {}; let giornoT = 1, giornoV = 1, giornoDa = 1, giornoT0 = 0;
  // porte mobili (meta.porte dal bake): l'anta ruota attorno al cardine; 1 = aperta come nel modello, 0 = chiusa
  const porte = {};
  function registraPorte(radice, m) {
    for (const [k, p] of Object.entries((m && m.porte) || {})) {
      const o = radice.getObjectByName("G_" + k); if (!o) continue;
      o.updateMatrix(); o.matrixAutoUpdate = false;
      porte[k] = { mesh: o, base: o.matrix.clone(), p: new THREE.Vector3(...p.cardine), ang: p.angolo, a: 1, t: porte[k] ? porte[k].t : 1 };
    }
  }
  const _mP = new THREE.Matrix4(), _mR = new THREE.Matrix4(), _mN = new THREE.Matrix4();
  function muoviPorte(dt) {
    for (const d of Object.values(porte)) {
      if (!d.mesh || (Math.abs(d.a - d.t) < 0.002 && d.fatto)) continue;
      d.a += (d.t - d.a) * Math.min(1, dt * 4); if (Math.abs(d.a - d.t) < 0.002) d.a = d.t; d.fatto = true;
      const f = d.ang * (1 - d.a);
      _mN.makeTranslation(-d.p.x, 0, -d.p.z); _mR.makeRotationY(f); _mP.makeTranslation(d.p.x, 0, d.p.z);
      d.mesh.matrix.copy(_mP).multiply(_mR).multiply(_mN).multiply(d.base); d.mesh.matrixWorldNeedsUpdate = true; sporco = true;
    }
  }
  // risposta immediata al tocco: la luce/presa cambia subito sulla mappa, senza aspettare che il dispositivo risponda a HA
  const ott = {};
  // valori da scrivere dentro le icone dei sensori (es. "21,4°"), dati dalla scheda con stato({ valori })
  const valori = {};
  // risposta immediata al tocco: la luce si riaccende alla sua ultima luminosità conosciuta (non al 100%, altrimenti
  // quando arriva lo stato vero di HA la luce cala di colpo: lo "scatto" dopo l'accensione)
  const ultimoLivello = {};
  function ottimista(e, acceso) { ott[e] = { v: acceso, t: performance.now() }; stato({}); }
  function stato(s) {
    if (s.porte) for (const [k, v] of Object.entries(s.porte)) { if (porte[k]) { porte[k].t = v; porte[k].fatto = false; } else porte[k] = { t: v }; }
    if (s.luci) { Object.assign(livelli, s.luci); for (const [e, v] of Object.entries(s.luci)) if (v > 0) ultimoLivello[e] = v; }
    for (const [e, o] of Object.entries(ott)) {
      const vero = s.luci && e in s.luci ? s.luci[e] > 0 : null;
      if (performance.now() - o.t > 6000 || vero === o.v) { delete ott[e]; continue; }
      livelli[e] = o.v ? (livelli[e] > 0 ? livelli[e] : ultimoLivello[e] || 1) : 0;
    }
    if (s.colori) Object.assign(colori, s.colori);
    if (s.valori) { Object.assign(valori, s.valori); for (const d of etichette.children) { const v = d.dataset.ent && s.valori[d.dataset.ent]; if (v == null) continue;
      const b = d.querySelector("i.val b"); if (b) { if (b.textContent !== v) b.textContent = v; } else { const i = d.querySelector("i"); if (i) { i.className = "val"; i.innerHTML = `<b>${v}</b>`; } } } }
    if (s.tv) Object.assign(tvModo, s.tv);
    if (s.giorno != null && s.giorno !== giornoT) { giornoDa = giornoV; giornoT0 = performance.now(); giornoT = s.giorno; }
    if (s.tende) for (const [k, p] of Object.entries(s.tende)) { if (tende[k]) tende[k].pos = p; if (tendeSole[k]) tendeSole[k].pos = p; }
    if (s.teli) for (const [k, p] of Object.entries(s.teli)) { teliStato[k] = p; if (teli[k]) teli[k].pos = p; }
    for (const g of Object.values(gruppi)) g.lamp.forEach((e, i) => {
      const v = livelli[e] || 0, sc = g.strati[e];
      let tint = [1, 1, 1];
      const c = colori[e], bc = (meta.ent[e] || {}).col;
      if (c && bc) { const t = c.map((x, j) => lin(x / 255) / Math.max(0.05, bc[j])); const mx = Math.max(...t); tint = t.map((x) => x / mx); }
      g.uni["k" + i].value.set(tint[0], tint[1], tint[2]).multiplyScalar(v * sc);
      (g.kBase || (g.kBase = []))[i] = g.uni["k" + i].value.clone();
      if (v > 0 && g.chiedi) g.chiedi(i);
    });
    // ogni tenda prende la luce delle lampade accese nella sua stanza (e nelle stanze unite)
    for (const g of Object.values(gruppi)) if (g.tenda) { const st = stanzaTenda(g.tenda); let l = 0;
      if (st) for (const [e, m] of Object.entries(meta.ent)) if (!e.startsWith("tenda:") && unite(m.stanza, st)) l += livelli[e] || 0;
      g.uni.lamp.value = Math.min(1.2, l * 0.35); }
    for (const d of etichette.children) if (d.dataset.ent) d.classList.toggle("on", (livelli[d.dataset.ent] || 0) > 0 || (d.dataset.ent.startsWith("tenda:") && ((tende[d.dataset.ent.slice(6)] || {}).pos < 1 || (tendeSole[d.dataset.ent.slice(6)] || {}).pos < 1)) || (d.dataset.ent.startsWith("telo:") && (teliStato[d.dataset.ent.slice(5)] || 0) > 0.5));
    if (!focus && meta) { const f = Object.keys(meta.ent).filter(attivo).join(","); if (f !== firmaAttivi) { firmaAttivi = f; rifaiEtichette(); } }
    sporco = true;
  }

  // --- etichette toccabili sopra gli oggetti ---
  const NOMI = opts.nomi || {};
  function punto(e) {
    const m = meta.ent[e]; if (!m) return null;
    if (m.box) { const b = m.box; return new THREE.Vector3((b[0] + b[3]) / 2, Math.max(b[4], b[1] + 0.3), (b[2] + b[5]) / 2); }
    if (m.luci && m.luci.length) { const p = m.luci[0]; return new THREE.Vector3(p[0], p[1], p[2]); }
    return null;
  }
  let punti = [];
  function chip(e, m, piccola) {
    const nome = NOMI[e] || m.nome || e, tipo = tipoIcona(e, nome);
    const d = document.createElement("button");
    d.className = "tre-luce t-" + tipo + (piccola ? " piccola" : "") + (e.startsWith("serratura:") || e.startsWith("apertura:") || e.startsWith("pianta:") ? " avviso" : e.startsWith("tenda:") ? " tenda" : e.startsWith("media:") ? " cassa" : tipo === "fuoco" ? " fuoco" : e.startsWith("clima:") ? " clima" : tipo === "tv" || tipo === "appletv" ? " tv" : "");
    // classi per tipo di segnale (colori in casa3d-full.js): allarmi rossi, presenza azzurra, elettrodomestici in funzione, aria pulita
    const pre = e.slice(0, e.indexOf(":") + 1);
    const CL = { "robot:": "robot", "temperatura:": "temp", "umidita:": "temp", "fumo:": "avviso allarme", "perdita:": "avviso allarme", "movimento:": "presenza", "elettrodomestico:": "elettro", "purificatore:": "aria", "camera:": "telecamera" };
    if (CL[pre]) d.classList.add(...CL[pre].split(" "));
    // sensori con un numero (temperatura): il valore sta dentro il cerchio al posto dell'icona
    const v = valori[e];
    d.dataset.ent = e; d.innerHTML = (v != null ? `<i class="val"><b>${v}</b></i>` : `<i>${svgIcona(tipo)}</i>`) + `<span class="nome">${nome}</span>`; d.setAttribute("aria-label", nome + (v != null ? " " + v : ""));
    premibile(d, e); return d;
  }
  const attivo = (e) => (livelli[e] || 0) > 0 || (e.startsWith("tenda:") && ((tende[e.slice(6)] || {}).pos < 1 || (tendeSole[e.slice(6)] || {}).pos < 1)) || (e.startsWith("telo:") && (teliStato[e.slice(5)] || 0) > 0.5);
  let firmaAttivi = "";
  // dove sta l'etichetta col nome della stanza (C.etichette_stanze = { stanza: [x, y, z] } per spostarla)
  // di serie l'etichetta galleggia sopra la stanza, appena più in alto dei muri tagliati (1,15 m): vista di lato resta
  // sopra la sua stanza invece di finire davanti al muro. C.quota_etichette = metri sopra il pavimento (1.35 di serie)
  const puntoStanza = (k) => { const f = (C.etichette_stanze || {})[k]; if (f) return new THREE.Vector3(...f); const v = viste[k].t.clone();
    if (!eEsterno(k)) v.y += (C.quota_etichette ?? 1.35) - (viste[k].sopra ? 0.7 : 0.6); return v; };
  // stanze del piano che si guarda (dal modello di quel piano)
  const stanzeDi = (n) => ((PIANO[n] && PIANO[n].meta) || {}).stanze || {};
  const areaStanza = (k) => { const st = stanzeDi(PIANO_STANZA[k] || BASE)[k]; if (!st || !st.box) return 0; const b = st.box; return Math.abs((b[3] - b[0]) * (b[5] - b[2])); };
  function rifaiEtichette() {
    etichette.innerHTML = ""; punti = [];
    // C.visibili_da_sopra = { chiave: stanza_di_sopra }: oggetti del piano terra che si vedono e si comandano anche dal piano
    // di sopra (es. i LED della scala visti attraverso il vuoto), con l'icona nella stanza indicata
    const DS = C.visibili_da_sopra || {};
    // oggetti del piano che si guarda, più quelli del piano subito sotto elencati in visibili_da_sopra
    const daSotto = (m, e) => e in DS && pianoDi(m) === pianoSotto(pianoOra);
    const pianoEnt = (m, e) => pianoDi(m) === pianoOra || daSotto(m, e);
    const stanzaEnt = (e, m) => (daSotto(m, e) ? DS[e] : m.stanza || STANZA_TENDE);
    if (!focus) {
      const elenco = Object.keys(stanzeDi(pianoOra));
      const attivi = {};
      // il telo del proiettore si muove da solo col proiettore: niente icona né conteggio
      for (const [e, m] of Object.entries(meta.ent)) if (pianoEnt(m, e) && attivo(e) && !e.startsWith("telo:")) { const st = stanzaEnt(e, m); attivi[st] = (attivi[st] || 0) + 1; }
      for (const k of elenco) {
        const d = document.createElement("button"); d.className = "tre-stanza";
        d.innerHTML = `<span>${(opts.nomiStanze || {})[k] || k}</span>` + (attivi[k] ? `<b>${attivi[k]}</b>` : "");
        d.addEventListener("click", (ev) => { ev.stopPropagation(); opts.stanza && opts.stanza(k); });
        const v = puntoStanza(k); etichette.append(d); punti.push({ d, p: v, area: areaStanza(k) });
      }
      // vista casa pulita: icone solo per ciò che è acceso; il resto si tocca direttamente sull'oggetto 3D
      for (const [e, m] of Object.entries(meta.ent)) {
        if (!pianoEnt(m, e) || !attivo(e) || e.startsWith("telo:")) continue;
        const p = punto(e); if (!p) continue;
        const d = chip(e, m, true); etichette.append(d); punti.push({ d, p, e });
      }
      stato({}); return;
    }
    const vicine = [focus, ...UNITE.filter((g) => g.includes(focus)).flat().filter((x) => x !== focus)];
    const stanzePiano = Object.keys(stanzeDi(pianoOra));
    for (const k of stanzePiano) {
      if (k === focus || !viste[k]) continue;
      const d = document.createElement("button"); d.className = "tre-stanza altra";
      d.innerHTML = `<span>${(opts.nomiStanze || {})[k] || k}</span><i>›</i>`; d.setAttribute("aria-label", "Vai in " + ((opts.nomiStanze || {})[k] || k));
      d.addEventListener("click", (ev) => { ev.stopPropagation(); opts.stanza && opts.stanza(k); });
      const v = puntoStanza(k); etichette.append(d); punti.push({ d, p: v, area: areaStanza(k) });
    }
    for (const [e, m] of Object.entries(meta.ent)) {
      if (!pianoEnt(m, e) || e.startsWith("telo:")) continue;
      const st = stanzaEnt(e, m);
      if (!vicine.includes(st)) continue;
      // da una stanza unita si vedono solo alcune icone dell'altra (C.da_unita = { stanza: [chiavi] })
      const du = (C.da_unita || {})[focus]; if (du && st !== focus && !du.includes(e)) continue;
      const p = punto(e); if (!p) continue;
      const d = chip(e, m, false); etichette.append(d); punti.push({ d, p, e });
    }
    stato({});
  }
  function premibile(d, e) {
    let tm = null, lungo = false;
    d.addEventListener("pointerdown", (ev) => { ev.stopPropagation(); lungo = false; tm = setTimeout(() => { if (!toccoValido()) return; lungo = true; opts.lungo && opts.lungo(e, ev, d); }, 480); });
    const stop = () => clearTimeout(tm);
    d.addEventListener("pointerup", stop); d.addEventListener("pointerleave", stop); d.addEventListener("pointercancel", stop);
    d.addEventListener("click", (ev) => { ev.stopPropagation(); if (!toccoValido()) return; d.classList.add("mostra"); clearTimeout(d._t); d._t = setTimeout(() => d.classList.remove("mostra"), e.startsWith("pianta:") ? 4000 : 1800); if (!lungo) opts.tocca && opts.tocca(e, ev); });
  }
  const v3 = new THREE.Vector3();
  // spostamenti possibili per un nome di stanza che ne urta un altro, dal più piccolo al più grande
  const SPOSTA_NOMI = []; for (const dx of [0, -12, 12, -24, 24, -36, 36]) for (const dy of [0, -11, 11, -22, 22]) SPOSTA_NOMI.push([dx, dy]);
  SPOSTA_NOMI.sort((a, b) => Math.hypot(a[0], a[1] * 1.6) - Math.hypot(b[0], b[1] * 1.6));
  function posizionaEtichette(w, h) {
    const occ = [];
    // larghezze lette una volta sola e tutte insieme, prima di spostare qualcosa: leggere dopo aver scritto
    // obbligava il browser a reimpaginare tutta la pagina di HA per ogni etichetta, a ogni fotogramma (iPad bloccato)
    for (const q of punti) if (q.lw == null) q.lw = q.e ? (q.d.classList.contains("piccola") ? 30 : 40) : (q.d.offsetWidth || 120);
    // ordine di precedenza: prima le stanze grandi (tengono sempre il nome), poi le piccole, poi le icone
    if (!punti._ord) punti._ord = [...punti].sort((a, b) => (a.e ? 1 : 0) - (b.e ? 1 : 0) || (b.area || 0) - (a.area || 0));
    for (const q of punti._ord) {
      v3.copy(q.p).project(camera);
      const vis = v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05;
      let x = (v3.x + 1) / 2 * w, y = (1 - v3.y) / 2 * h;
      // non si sovrappongono: spingo in basso quelle troppo vicine (comandi distanziati per il dito)
      // riquadro occupato dall'etichetta (cerchio + nome): se tocca un'altra la sposto sotto, poi a lato
      const lw = q.lw, sx = lw / 2;
      const urta = (xx, yy) => occ.find((o) => xx - sx < o[0] + o[2] && xx - sx + lw > o[0] && Math.abs(o[1] - yy) < (q.e && q.d.classList.contains("piccola") ? 32 : 44));
      let nascondi = false;
      if (!q.e) {
        // nome di stanza: piccolo spostamento in su o in giù (resta sopra la sua stanza); se non basta, sparisce
        // dolcemente e ricompare quando c'è posto. Per ricomparire serve un margine in più (niente lampeggi al limite).
        // un contatto di pochi pixel non si nota: lo tollero. Provo spostamenti fino a ~40 px in ogni direzione e scelgo il più piccolo.
        const m = q.via ? 3 : 0, TOL = 6, H = 38;
        const libero = (xx, yy) => !occ.some((o) => xx - sx - m < o[0] + o[2] - TOL && xx + sx + m > o[0] + TOL && Math.abs(o[1] - yy) < H + m - TOL);
        const sp = SPOSTA_NOMI.find(([dx, dy]) => libero(x + dx, y + dy));
        if (!sp) nascondi = true; else { x += sp[0]; y += sp[1]; }
        q.via = nascondi;
      } else if (q.e && q.d.classList.contains("piccola") && !q.d.classList.contains("avviso")) nascondi = !!urta(x, y); // serrature e finestre aperte non spariscono mai: si spostano
      else for (let n = 0; n < 8 && urta(x, y); n++) { const c = urta(x, y); if (n % 2) x = c[0] + c[2] + sx + 4; else y = c[1] + 46; }
      if (!nascondi) occ.push([x - sx, y, lw]);
      // scrivo solo se cambia qualcosa: ogni scrittura fa ricalcolare gli stili
      // i nomi delle stanze sono centrati sul loro punto, qualunque sia la lunghezza del nome
      const tf = `translate(${Math.round(x)}px, ${Math.round(y)}px)` + (q.e ? "" : " translate(-50%, -50%)");
      if (!q.e) { const op = nascondi ? "0" : ""; if (q.op !== op) { q.op = op; q.d.style.opacity = op; q.d.style.pointerEvents = nascondi ? "none" : ""; } }
      const vv = vis && (!nascondi || !q.e) && !(q.e && ((C.nascondi_in || {})[focus] || []).includes(q.e)) ? "" : "hidden";
      if (q.tf !== tf) { q.tf = tf; q.d.style.transform = tf; }
      if (q.vv !== vv) { q.vv = vv; q.d.style.visibility = vv; }
    }
  }

  // --- tocco diretto sugli oggetti della scena ---
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let giu = null; let tapVuoto = null;
  renderer.domElement.addEventListener("pointerdown", (ev) => { giu = { x: ev.clientX, y: ev.clientY, t: performance.now(), id: ev.pointerId }; });
  renderer.domElement.addEventListener("pointerup", (ev) => {
    if (!giu || ev.pointerId !== giu.id || Math.hypot(ev.clientX - giu.x, ev.clientY - giu.y) > 8 || performance.now() - giu.t > 400) return;
    if (!toccoValido()) { giu = null; return; }
    if (!mappaViva) attiva(true);
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set((ev.clientX - r.left) / r.width * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    let best = null;
    const prova = (box, chi) => { const h = ray.ray.intersectBox(box, v3); if (h) { const d = h.distanceTo(ray.ray.origin); if (!best || d < best.d) best = { d, chi }; } };
    if (!focus) {
      for (const q of punti) {
        if (!q.e) continue; const m = meta.ent[q.e];
        if (m.box) { const b = m.box; prova(new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5])).expandByScalar(0.05), "ent:" + q.e); }
      }
      if (best) { opts.tocca && opts.tocca(best.chi.slice(4), ev); return; }
      for (const [k, s] of Object.entries(stanzeDi(pianoOra))) { if (eEsterno(k)) continue; const b = s.box; prova(new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[1] + 0.4, b[5])), k); }
      // giardino, terrazzi e balconi: si toccano sul pavimento, e solo se il tocco non cade già su una stanza
      if (!best) for (const [k, s] of Object.entries(stanzeDi(pianoOra))) { if (!eEsterno(k)) continue; const b = s.box; prova(new THREE.Box3(new THREE.Vector3(b[0], b[1] - 0.2, b[2]), new THREE.Vector3(b[3], b[1] + 0.1, b[5])), k); }
      if (best) opts.stanza && opts.stanza(best.chi);
      return;
    }
    for (const q of punti) {
      if (!q.e) continue; const m = meta.ent[q.e];
      if (m.box) { const b = m.box; prova(new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5])).expandByScalar(0.08), q.e); }
      // zona di tocco della lampada: sotto il punto luce, ma non più in alto dei muri tagliati (C.quota_taglio, 1.15 m di serie).
      // A soffitto sarebbe invisibile e "ruberebbe" i tocchi sul cielo (es. il doppio tocco per tornare a Casa).
      for (const p of m.luci || []) prova(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(p[0], Math.min(p[1], (C.quota_taglio ?? 1.15) - 0.25), p[2]), new THREE.Vector3(0.5, 0.5, 0.5)), q.e);
    }
    if (best) { opts.tocca && opts.tocca(best.chi, ev); return; }
    for (const [k, st] of Object.entries(stanzeDi(pianoOra))) { if (k === focus || eEsterno(k)) continue; const b = st.box; prova(new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[1] + 0.3, b[5])), k); }
    if (best) { opts.stanza && opts.stanza(best.chi); return; }
    // doppio tocco sul vuoto fuori dalla casa (dentro una stanza): si torna alla vista "Casa".
    // "Vuoto" = il raggio non tocca nessun pezzo visibile della casa (cielo, terreno attorno, ombra a terra).
    // Prima usavo la scatola della casa: con la telecamera vicina (dentro la scatola) ogni tocco sembrava "sulla casa".
    const visibile = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
    const colpi = ray.intersectObjects(PIANI.map(scenaPiano).filter(Boolean), true);
    if (colpi.some((c) => c.object !== ombraCasa && visibile(c.object))) { tapVuoto = null; return; }
    const ora = performance.now();
    if (tapVuoto && ora - tapVuoto.t < 380 && Math.hypot(ev.clientX - tapVuoto.x, ev.clientY - tapVuoto.y) < 40) { tapVuoto = null; opts.stanza && opts.stanza(null); return; }
    tapVuoto = { t: ora, x: ev.clientX, y: ev.clientY };
  });

  // --- ciclo ---
  let w = 0, h = 0, spinta = 0, ultimoCopre = 0;
  // la barra delle stanze sta sopra la mappa (in alto su iPad, in basso su iPhone): centro la casa nello spazio che resta libero
  function misuraBarra(now) {
    if (now - ultimoCopre < 400) return; ultimoCopre = now;
    const box = el.parentElement, bar = box && box.querySelector(".m3d-stanze"); let c = 0, sp = 0;
    if (bar && h) { const r = el.getBoundingClientRect(), b = bar.getBoundingClientRect();
      if (b.height && b.top - r.top < h / 2) { c = Math.max(0, b.bottom - r.top); sp = c / 2; } else if (b.height) { c = Math.max(0, r.bottom - b.top); sp = -c / 2; } }
    if (Math.abs(c - copre) > 2 || Math.abs(sp - spinta) > 2) {
      copre = c; spinta = sp;
      if (spinta) camera.setViewOffset(w, h, 0, -spinta, w, h); else camera.clearViewOffset();
      camera.updateProjectionMatrix(); rimetti(); sporco = true;
    }
  }
  // dimensioni dal ResizeObserver: chiedere getBoundingClientRect a ogni fotogramma obbligava a reimpaginare la pagina di HA
  let dimR = null;
  new ResizeObserver((v) => { const c = v[v.length - 1].contentRect; dimR = { width: c.width, height: c.height }; }).observe(el);
  function dimensioni() {
    const r = dimR || (dimR = el.getBoundingClientRect()); if (!r.width || !r.height) return false;
    if (r.width !== w || r.height !== h) { w = r.width; h = r.height; renderer.setSize(w, h, false); camera.aspect = w / h; ultimoCopre = 0; copre = -99; camera.updateProjectionMatrix(); rimetti(); sporco = true; }
    return true;
  }
  let ultimo = performance.now();
  let ultimoRaf = 0;
  // diagnosi: fotogrammi bloccati (> 400 ms con la pagina visibile) mandati alla scheda, che li scrive nel log di HA
  let ultimoLog = 0;
  const diagnosi = (tipo, extra) => { const t = performance.now(); if (t - ultimoLog < 8000) return; ultimoLog = t;
    const mi = renderer.info; el.dispatchEvent(new CustomEvent("m3d-log", { bubbles: true, composed: true, detail: { tipo, focus, piano: pianoOra, viva: typeof mappaViva !== "undefined" ? mappaViva : null, volo: !!volo, tex: mi.memory.textures, geo: mi.memory.geometries, prog: mi.programs ? mi.programs.length : 0, chiamate: mi.render.calls, tri: mi.render.triangles, px: renderer.getPixelRatio(), w: renderer.domElement.width, h: renderer.domElement.height, touch: SU_TOUCH, coda: coda.length, traccia: traccia.filter((x) => t - x[0] < 15000).map((x) => [Math.round(x[0] - t), x[1], x[2]]), ...extra } })); };
  function ciclo(now, daTimer) {
    if (finito) return;
    if (!daTimer) { ultimoRaf = performance.now(); requestAnimationFrame(ciclo); }
    if (perso) { ultimo = now; return; } // grafica tolta: niente disegno finché non torna
    if (!daTimer && ultimo && now - ultimo > 400 && document.visibilityState === "visible" && el.isConnected) diagnosi("fotogramma lento", { ms: Math.round(now - ultimo) });
    const dt = Math.min(0.05, (now - ultimo) / 1000); ultimo = now;
    if (!el.isConnected || !dimensioni()) return;
    if (!inizializzato) { inizializzato = true; rimetti(); }
    rientraVuoto(now);
    misuraBarra(now);
    if (volo) {
      const t = Math.min(1, (now - volo.t0) / ((volo.dur || DUR) * 1000)), e = volo.cambio ? (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2) : ease(t), a = volo.da, b = volo.a;
      // volo da drone: il bersaglio scivola verso la stanza, la camera si alza a metà, gira attorno (orbita) e scende inclinandosi
      const arco = Math.sin(Math.PI * e), giro = (volo.giro || 0) * arco * (1 - e * 0.35);
      const r = THREE.MathUtils.lerp(a.r, b.r, e) * (1 + (volo.alza || 0.22) * arco);
      if (volo.cambio) pianiInVolo(t, volo.sale, t >= 1);
      const pe = e * e * (3 - 2 * e);
      // cambio di piano: la camera sale o scende dritta, sempre alla stessa distanza e con la stessa inclinazione (niente arco)
      if (volo.cambio) metti({ t: a.t.clone().lerp(b.t, e), r: THREE.MathUtils.lerp(a.r, b.r, e), phi: THREE.MathUtils.lerp(a.phi, b.phi, e), theta: THREE.MathUtils.lerp(a.theta, b.theta, e) });
      else metti({ t: a.t.clone().lerp(b.t, Math.min(1, e * 1.15)), r, phi: THREE.MathUtils.lerp(a.phi, b.phi, pe) - 0.12 * arco, theta: THREE.MathUtils.lerp(a.theta, b.theta, e) + giro });
      controls.enabled = false; if (t >= 1) { volo = null; controls.enabled = mappaViva; }
    } else {
      // spostando con due dita il centro resta dentro la stanza (al massimo 1 m oltre i suoi bordi): non si finisce nel vuoto
      const vf = focus && viste[focus];
      if (vf) { const tg = controls.target, lim = vf.raggio + 1, dx = tg.x - vf.t.x, dz = tg.z - vf.t.z, dd = Math.hypot(dx, dz);
        if (dd > lim) { const k = lim / dd; const nx = vf.t.x + dx * k, nz = vf.t.z + dz * k; camera.position.x += nx - tg.x; camera.position.z += nz - tg.z; tg.x = nx; tg.z = nz; }
        const ny = Math.min(vf.t.y + 1.2, Math.max(vf.t.y - 0.6, tg.y)); if (ny !== tg.y) { camera.position.y += ny - tg.y; tg.y = ny; } }
      if (controls.update()) sporco = true;
    }
    // sera/giorno, soppalco che svanisce nel soggiorno, tende
    // stessa sfumatura (0,6 s, morbida all'inizio e alla fine) dello sfondo e delle schede di HA: cambiano insieme
    if (giornoV !== giornoT) { const t = Math.min(1, (performance.now() - giornoT0) / 600); giornoV = t >= 1 ? giornoT : giornoDa + (giornoT - giornoDa) * t * t * (3 - 2 * t); sporco = true; }
    // di sera l'ombra si attenua (lo sfondo è già scuro)
    if (ombraCasa) ombraCasa.material.opacity = ombraCasa.userData.forza * (0.45 + 0.55 * giornoV);
    // il gruppo da sfumare (es. soppalco) non sparisce del tutto: resta come un vetro leggero
    const opT = SFUMA && focus === SFUMA.in ? (SFUMA.opacita ?? 0.2) : 1;
    if (Math.abs(opSopp - opT) > 0.001) { opSopp += Math.sign(opT - opSopp) * Math.min(Math.abs(opT - opSopp), dt * 2.5); sporco = true; }
    // entrando in una stanza si scurisce tutto il resto, anche le altre zone dello stesso open space.
    // C.attenua_stanze: 0 = per niente, 1 = scure e quasi grigie (di serie)
    const SCURO = 1 - 0.55 * (C.attenua_stanze ?? 1);
    const fLt = focus && !eEsterno(focus) && !APERTE.has(focus) ? SCURO : 1;
    if (focus) { const st = stanzeDi(pianoOra)[focus]; const M = 0.0;
      if (st) FOC.fB.value.set(st.box[0] - M, st.box[2] - M, st.box[3] + M, st.box[5] + M); }
    if (Math.abs(FOC.fL.value - fLt) > 0.002) { FOC.fL.value += (fLt - FOC.fL.value) * Math.min(1, dt * 4); sporco = true; }
    for (const [k, g] of Object.entries(gruppi)) {
      g.uni.giorno.value = giornoV;
      const st = g.tenda ? stanzaTenda(g.tenda) || k : k.slice((PIANO[g.piano || BASE] || PB).chiave.length);
      // entrando in una stanza le altre si attenuano: C.attenua_stanze 0 = per niente, 1 = molto (scure e quasi grigie, il vecchio
      // comportamento). Di serie 1: la stanza scelta risalta, le altre restano in secondo piano.
      // i materiali cotti si scuriscono per posizione (FOC); gli altri (tende, schermi...) seguono la loro stanza
      const lt = g.uni.fB || !focus || eEsterno(focus) || APERTE.has(focus) || focus === st ? 1 : SCURO;
      if (g.uni.luce && Math.abs(g.uni.luce.value - lt) > 0.002) { g.uni.luce.value += (lt - g.uni.luce.value) * Math.min(1, dt * 4); sporco = true; }
    }
    if (sopp) { sopp.uni.opac.value = opSopp; sopp.mesh.visible = opSopp > 0.01; sopp.mat.depthWrite = opSopp > 0.99; }
    for (const [k, t] of Object.entries(teli)) {
      if (teliStato[k] != null) t.pos = teliStato[k];
      const sy = Math.max(0.02, t.pos);
      if (Math.abs(t.mesh.scale.y - sy) > 0.002) { t.mesh.scale.y += (sy - t.mesh.scale.y) * Math.min(1, dt * 3); sporco = true; }
      t.mesh.visible = t.mesh.scale.y > 0.03;
    }
    if (caffe.length && caffe._g !== giornoV) { caffe._g = giornoV; const l = 0.45 + 0.55 * giornoV; for (const c of caffe) c.m.material.color.copy(c.col).multiplyScalar(l); sporco = true; }
    // tende a caduta del portico: la tela scende quando la tenda si chiude (pos 1 = aperta, arrotolata)
    for (const t of Object.values(tendeSole)) {
      const giu = 1 - Math.max(0, Math.min(1, t.pos));
      if (Math.abs(t.vis - giu) > 0.002) { t.vis += (giu - t.vis) * Math.min(1, dt * 2.5); sporco = true; }
      t.telo.scale.y = Math.max(0.001, t.vis * t.alto); t.telo.visible = t.vis > 0.02;
      const l = (0.35 + 0.65 * giornoV) * (casa.visible ? 1 : 0); t.mat.color.setScalar(l); t.cmat.color.setScalar(0.55 * l);
    }
    for (const [k, t] of Object.entries(tende)) {
      const chiusa = 1 - Math.max(0, Math.min(1, t.pos)), sx = 1 + chiusa * (t.chiusa / t.larga - 1);
      if (Math.abs(t.mesh.scale[t.asse] - sx) > 0.002) { t.mesh.scale[t.asse] += (sx - t.mesh.scale[t.asse]) * Math.min(1, dt * 5); sporco = true; }
    }
    muoviPorte(dt);
    animaTv(now, dt);
    if (sporco) { posizionaEtichette(w, h); // su iPad niente riflesso: disegnarlo obbliga la scheda grafica a preparare una seconda copia di tutti i programmi (12 s di blocco)
      if (!SU_TOUCH) specchio(w, h); else RIF.rOn.value = 0; const tr = performance.now(); if (strati) disegnaStrati(); else renderer.render(scene, camera); const dr = performance.now() - tr; if (dr > 120) segna("disegno", dr); sporco = false; }
  }
  // --- specchio del pavimento (come THREE.Reflector, con il piano di taglio obliquo) ---
  const rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 0 });
  const vc = new THREE.PerspectiveCamera(); const _n = new THREE.Vector3(0, 1, 0), _p = new THREE.Vector3(), _cw = new THREE.Vector3(), _v = new THREE.Vector3(),
    _rot = new THREE.Matrix4(), _la = new THREE.Vector3(), _t = new THREE.Vector3(), _pl = new THREE.Plane(), _cp = new THREE.Vector4(), _q = new THREE.Vector4();
  function specchio(w, h) {
    const lo = SU_TOUCH ? 0.35 : window.devicePixelRatio > 1.5 ? 0.5 : 0.6, rw = Math.max(16, Math.round(w * lo * renderer.getPixelRatio())), rh = Math.max(16, Math.round(h * lo * renderer.getPixelRatio()));
    if (rt.width !== rw || rt.height !== rh) rt.setSize(rw, rh);
    const y = pianoOra !== BASE && PIANO[pianoOra].meta ? Object.values(PIANO[pianoOra].meta.stanze)[0].box[1] : 0;
    _p.set(0, y, 0); _cw.setFromMatrixPosition(camera.matrixWorld);
    _v.subVectors(_p, _cw); if (_v.dot(_n) > 0) { RIF.rOn.value = 0; return; }
    _v.reflect(_n).negate().add(_p);
    _rot.extractRotation(camera.matrixWorld); _la.set(0, 0, -1).applyMatrix4(_rot).add(_cw);
    _t.subVectors(_p, _la).reflect(_n).negate().add(_p);
    vc.position.copy(_v); vc.up.set(0, 1, 0).applyMatrix4(_rot).reflect(_n); vc.lookAt(_t);
    vc.far = camera.far; vc.updateMatrixWorld(); vc.projectionMatrix.copy(camera.projectionMatrix);
    RIF.rM.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse);
    _pl.setFromNormalAndCoplanarPoint(_n, _p).applyMatrix4(vc.matrixWorldInverse);
    _cp.set(_pl.normal.x, _pl.normal.y, _pl.normal.z, _pl.constant);
    const e = vc.projectionMatrix.elements;
    _q.set((Math.sign(_cp.x) + e[8]) / e[0], (Math.sign(_cp.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
    _cp.multiplyScalar(2 / _cp.dot(_q)); e[2] = _cp.x; e[6] = _cp.y; e[10] = _cp.z + 1 - 0.003; e[14] = _cp.w;
    // mentre si disegna nello specchio la sua texture non deve essere letta (Safari blocca il 'feedback loop')
    RIF.rOn.value = 0; RIF.tR.value = nero; RIF.rY.value = y; RIF.rPx.value.set(1 / rw, 1 / rh);
    const et = etichette.style.display; renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, vc); renderer.setRenderTarget(null);
    RIF.tR.value = rt.texture; RIF.rOn.value = 1;
  }
  requestAnimationFrame(ciclo);
  // riserva: se il browser sospende i fotogrammi (scheda in secondo piano) lo stato resta comunque aggiornato
  const tRiserva = setInterval(() => { if (performance.now() - ultimoRaf > 250) ciclo(performance.now(), true); }, 120);
  // la casa compare solo con la sua luce già pronta (al massimo 6 s), poi il piano superiore si prepara da solo
  await Promise.race([Promise.all(PRONTE), new Promise((ok) => setTimeout(ok, 6000))]);
  // tutti i programmi grafici preparati adesso, mentre c'è ancora la schermata di caricamento,
  // anche quelli degli oggetti nascosti (tende, porte, macchina del caffè...): così entrando in una stanza non si blocca
  await precompila(scene);
  if (CON_SOPRA) setTimeout(() => preparaSopra(), SU_TOUCH ? 8000 : 800);
  // segnali in più (serrature, porte e finestre con sensore): punti 3D che si comportano come gli altri oggetti
  function precompila(radice) {
    // copie visibili di tutti gli oggetti (anche quelli nascosti) in una scena a parte: niente da mostrare o nascondere
    const tmp = new THREE.Scene(); const visti = new Set();
    radice.traverse((o) => { if (o.isMesh && o.material && !visti.has(o.material)) { visti.add(o.material); tmp.add(new THREE.Mesh(o.geometry, o.material)); } });
    try { if (renderer.compileAsync) return renderer.compileAsync(tmp, camera).catch(() => {}); renderer.compile(tmp, camera); } catch (e) { console.warn("casa3d compile", e); }
    return Promise.resolve();
  }
  function aggiungi(ent) { for (const [k, m] of Object.entries(ent)) meta.ent[k] = m; firmaAttivi = "-"; rifaiEtichette(); }
  // prepara sulla scheda grafica (shader e texture) il piano che non si vede, così il primo cambio di piano non si blocca
  function scalda() {
    const altri = PIANI.filter((n) => n !== pianoOra).map(scenaPiano).filter(Boolean); if (!altri.length) return;
    const era = altri.map((a) => a.visible); altri.forEach((a) => { a.visible = true; });
    try {
      renderer.compile(scene, camera);
      // i piani durante il cambio si disegnano in immagini a parte: anche quei programmi si preparano ora, sotto il velo
      { const vc = casa.visible; casa.visible = true; renderer.setRenderTarget(rtArriva); renderer.compile(scene, camera); renderer.render(scene, camera); renderer.setRenderTarget(null); casa.visible = vc; renderer.compile(scenaStrati, camStrati); }
      for (const altro of altri) altro.traverse((o) => { const u = o.material && o.material.uniforms; if (u) for (const k in u) { const t = u[k] && u[k].value; if (t && t.isTexture && t.image) renderer.initTexture(t); } });
    } catch (e) { console.warn("casa3d scalda", e); }
    altri.forEach((a, i) => { a.visible = era[i]; });
  }
  // la mappa si sta muovendo (volo o dita sullo schermo da meno di 0,7 s): la scheda rimanda il lavoro pesante
  const occupato = () => !!volo || performance.now() - ultimoMoto < 700 || dita.size > 0;
  // chiude questa mappa del tutto (ciclo, timer, memoria grafica, worker delle mappe): usata prima di crearne una nuova
  function distruggi() {
    if (finito) return; finito = true; clearInterval(tRiserva); clearTimeout(tPerso);
    for (const j of coda.splice(0)) { try { j.ok(false); } catch (e) {} } // chi aspettava un lavoro non resta appeso
    try { if (fuoriTocco) document.removeEventListener("pointerdown", fuoriTocco, true); } catch (e) {}
    try {
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        for (const m of [].concat(o.material || [])) { for (const v of Object.values(m)) if (v && v.isTexture) v.dispose(); if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u && u.value && u.value.isTexture) u.value.dispose(); m.dispose(); }
      });
    } catch (e) {}
    try { rt.dispose(); } catch (e) {}
    try { if (kx) kx.dispose(); } catch (e) {}
    try { renderer.dispose(); } catch (e) {}
    try { el.remove(); } catch (e) {}
  }
  // tutte le mappe di giorno e di sera di tutti i piani già caricati sono nella scheda grafica: la casa è completa
  // il velo aspetta solo le mappe che servono adesso: di pieno giorno quelle del giorno, di notte quelle della sera, al tramonto
  // entrambe (l'altra serie arriva comunque subito dopo, prima che l'ora cambi). Aspettarle tutte raddoppiava l'attesa.
  // (l'ora con cui scelgo la prima serie è quella dell'orologio; se il sole dice altro, l'altra serie parte subito)
  const pronta = () => { const g = giornoT >= 0.999, n = giornoT <= 0.001;
    if (!(g && PRIMO === "giorno") && !(n && PRIMO === "sera")) ALTRA.splice(0).forEach((f) => f());
    return Promise.all(g ? PG.slice() : n ? PS.slice() : TUTTE.slice()); };
  return { el, vai, pronta, stato, ottimista, occupato, quandoLibero, segna, distruggi, _traccia: () => traccia.map((x) => [Math.round(x[0]), x[1], x[2]]), preparaSopra, scalda, aggiungi, _scene: scene, _r: renderer, _cam: camera, _volo: () => volo, _dbg: () => ({ giornoT, giornoV, pianoOra, sopraVis: PIANI.length > 1 && !!scenaPiano(PIANI[1]) && scenaPiano(PIANI[1]).visible, casaVis: casa.visible, sporco, piani: PIANI.map((n) => [n, !!scenaPiano(n), scenaPiano(n) ? scenaPiano(n).visible : null]) }), gira: (d) => { const p = posa(); volo = { da: p, a: { ...p, t: p.t.clone(), theta: p.theta + d }, t0: performance.now() }; } };
}
