// Casa 3D Casappletech: scheda per le dashboard di Home Assistant.
// Mostra solo la piantina 3D interattiva; tutti gli altri comandi restano quelli nativi di HA.
// Tocco su un oggetto = accendi/spegni (luci, prese, casse, tende, robot); pressione lunga = finestra nativa di HA, che ha già
// i suoi comandi per regolare (luminosità, temperatura, posizione, volume): la scheda non ne ridisegna nessuno.
// TV spente: un tocco le accende dall'Apple TV; accese, il tocco apre la finestra dell'Apple TV. Clima e sensori aprono la finestra nativa.
import { crea } from "./motore3d.js";
import CASA from "../casa.config.js";
import CSS_MOTORE from "./motore.css";

const VERSIONE = "2.1.9";
const BASE = new URL("./", import.meta.url).href;
const ASSET = typeof __CASA3D_ASSET__ !== "undefined" ? __CASA3D_ASSET__ : VERSIONE; // versione dei file della casa (vedi build.sh)

// Tutti i dati della casa stanno in casa.config.js (vedi lì la spiegazione di ogni voce)
const ENTITA = CASA.entita || {};
// sorgenti che decidono cosa mostra lo schermo delle TV (film / schermata Home / quadro)
const SORGENTI_TV = CASA.sorgenti_tv || {};
// serrature, sensori di porte e finestre, piante: [tipo, entità, nome, stanza, piano_sopra, [x, altezza, z]]
const SEGNALI = CASA.segnali || [];
// "HomePod Studio (AirPlay)" -> "HomePod Studio"; nomi lunghi tagliati a 24 caratteri
const nomeBreve = (n) => { n = String(n).replace(/\s*\([^)]*\)\s*$/, "").replace(/\s+Smart AC Control.*$/i, "").trim(); return n.length > 24 ? n.slice(0, 23).trim() + "…" : n; };
// umidità del terreno (%) sotto la quale la pianta "ha sete" (20 se non indicata)
const SOGLIA_SETE = CASA.soglia_sete || {};
// porte che si aprono e chiudono nel 3D col loro sensore: gruppo del modello -> binary_sensor
const PORTE = CASA.porte || {};
// stanza della piantina -> vista della dashboard da cui prendere i comandi (opzione "stanze_da")
const VISTE_STANZE = CASA.viste || {};
const PANNELLO = CASA.pannello || {};
// profilo del dispositivo (es. tablet grande di famiglia): il primo che corrisponde a schermo e tocco
const PROFILO = (() => {
  const tocco = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 1, lato = Math.max(screen.width, screen.height);
  return (PANNELLO.profili || []).find((p) => (p.solo_touch === false || tocco) && lato >= (p.lato_min || 0) && lato <= (p.lato_max || 1e9)) || null;
})();
// nel pannello sotto la mappa: questi blocchi stanno sempre subito sotto il primo, nella stessa colonna
const SOTTO_A = PANNELLO.sotto_a || [];
// schede che non vanno mai mostrate sotto la piantina (parole cercate nella configurazione della scheda)
const MAI = new RegExp((PANNELLO.mai || []).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") || "$^", "i");
function visibile(conds, h) {
  if (!Array.isArray(conds) || !conds.length || !h) return true;
  const una = (c) => {
    if (!c) return true;
    const tipo = c.condition || (c.entity || c.entity_id ? "state" : "");
    if (tipo === "and") return (c.conditions || []).every(una);
    if (tipo === "or") return (c.conditions || []).some(una);
    if (tipo === "not") return !(c.conditions || []).some(una);
    if (tipo === "screen") return !c.media_query || matchMedia(c.media_query).matches;
    if (tipo === "user") return !c.users || (h.user && c.users.includes(h.user.id));
    const e = c.entity || c.entity_id, st = e && h.states[Array.isArray(e) ? e[0] : e];
    if (tipo === "state") {
      const v = st ? st.state : "unavailable", lista = (x) => (Array.isArray(x) ? x : [x]);
      if (c.state !== undefined && !lista(c.state).includes(v)) return false;
      if (c.state_not !== undefined && lista(c.state_not).includes(v)) return false;
      return true;
    }
    if (tipo === "numeric_state") {
      const n = Number(st && st.state); if (isNaN(n)) return false;
      const num = (x) => (typeof x === "string" && h.states[x] ? Number(h.states[x].state) : Number(x));
      if (c.above !== undefined && !(n > num(c.above))) return false;
      if (c.below !== undefined && !(n < num(c.below))) return false;
      return true;
    }
    return true; // condizioni che non conosco: la scheda resta visibile
  };
  return conds.every(una);
}
const applicaVisibilita = (el, h) => { if (el && el._vis) { const ok = visibile(el._vis, h); if (el._visOk !== ok) { el._visOk = ok; el.style.display = ok ? "" : "none"; } } };
// altezze vere dei blocchi del pannello, ricordate su questo dispositivo
let ALTEZZE = {}; try { ALTEZZE = JSON.parse(localStorage.getItem("casa3d_altezze") || "{}") || {}; } catch (e) {}
let tAltezze = null; const salvaAltezze = () => { clearTimeout(tAltezze); tAltezze = setTimeout(() => { try { localStorage.setItem("casa3d_altezze", JSON.stringify(ALTEZZE)); } catch (e) {} }, 2000); };
const NOMI_STANZE = CASA.nomi_stanze || {};
// nomi brevi sulle etichette (in HA molti nomi sono lunghi)
const NOMI_BREVI = CASA.nomi_brevi || {};
const PIANI = (CASA.motore && CASA.motore.piani && CASA.motore.piani.length && CASA.motore.piani) || ["terra"];
// piano del giardino (la vista "esterno" di HA si aggiunge alla sua barra): di serie il piano terra, se c'è
const PIANO_GIARDINO = (CASA.motore && CASA.motore.piano_giardino) || (PIANI.includes("terra") ? "terra" : PIANI[0]);
// nomi dei piani nella barra e frase durante il cambio: nomi_piani in casa.config.js, es.
// { taverna: { nome: "Taverna", arrivo: "in taverna" }, primo: { nome: "Primo piano", arrivo: "al primo piano" } }
// "panoramica" (facoltativo) è il testo del pulsante che, dentro una stanza, torna alla vista di tutto il piano
const NOMI_PIANI = { terra: { nome: "Piano terra", arrivo: "al piano terra" }, sopra: { nome: "Piano superiore", arrivo: "al piano superiore", panoramica: "Panoramica Primo piano" }, ...(CASA.nomi_piani || {}) };
const nomePiano = (n) => { const x = NOMI_PIANI[n]; return (x && (typeof x === "string" ? x : x.nome)) || n.charAt(0).toUpperCase() + n.slice(1); };
const arrivoPiano = (n) => { const x = NOMI_PIANI[n]; return (x && typeof x === "object" && x.arrivo) || "→ " + nomePiano(n); };
const panoramicaPiano = (n) => { const x = NOMI_PIANI[n]; return (x && typeof x === "object" && x.panoramica) || "Panoramica " + nomePiano(n); };
const idxP = (n) => Math.max(0, PIANI.indexOf(n));
const VUOTO = { ent: {}, stanze: {}, gruppi: {} };
const SPENTO = new Set(["off", "unavailable", "unknown", "standby", "closed"]);
const acceso = (s) => !!s && !SPENTO.has(s.state);
// stati di un elettrodomestico fermo (inglese delle integrazioni e italiano degli aiutanti input_select)
const FERMO = /^(off|idle|standby|ready|finished|end|stop|stopped|paused|unavailable|unknown|ferm[oa]|spent[oa]|pront[oa]|finito|in pausa)$/i;

// impostazioni del motore: quelle di casa.config.js, ritoccabili dall'editor della scheda in HA (senza aprire file).
// Lo stesso oggetto viene passato al motore: le voci lette al momento (rotazione, etichette) cambiano subito,
// le altre (angolo della casa, tende) al prossimo caricamento della pagina.
const MOTORE_FILE = { piani: PIANI, ...(CASA.motore || {}) };
const IMPOSTAZIONI = { ...MOTORE_FILE };
const GRADI = Math.PI / 180;
function impostaDaScheda(c) {
  for (const k of Object.keys(IMPOSTAZIONI)) delete IMPOSTAZIONI[k];
  Object.assign(IMPOSTAZIONI, MOTORE_FILE);
  // nell'editor si usano unità semplici: gradi e metri
  if (c.rotazione_libera === true) IMPOSTAZIONI.limite_rotazione = null;
  else if (typeof c.gradi_per_lato === "number" && c.gradi_per_lato > 0) IMPOSTAZIONI.limite_rotazione = c.gradi_per_lato * GRADI;
  if (typeof c.angolo_casa === "number") IMPOSTAZIONI.angolo_casa = c.angolo_casa * GRADI;
  if (typeof c.inclinazione_casa === "number") IMPOSTAZIONI.inclinazione_casa = c.inclinazione_casa * GRADI;
  if (typeof c.zoom_casa === "number" && c.zoom_casa > 0) IMPOSTAZIONI.zoom_casa = c.zoom_casa;
  if (typeof c.altezza_etichette === "number") IMPOSTAZIONI.quota_etichette = c.altezza_etichette;
  if (typeof c.attenua_stanze === "number") IMPOSTAZIONI.attenua_stanze = c.attenua_stanze;
  if (typeof c.tende_chiuse === "number") IMPOSTAZIONI.tende_chiuse_m = c.tende_chiuse;
  // per chi preferisce il testo: qualsiasi voce di "motore" (come in casa.config.js) scritta nel YAML della scheda
  if (c.motore && typeof c.motore === "object") Object.assign(IMPOSTAZIONI, c.motore);
}

// un solo motore 3D per pagina: se HA ricrea la scheda (cambio vista, modifica) riuso lo stesso, senza aprire un altro contesto WebGL
let MOTORE = null, META = null;
const SU_TOUCH_C = matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 1 && !matchMedia("(hover: hover)").matches);
function motore(opts) {
  if (!MOTORE) {
    META = Promise.all(PIANI.map((p) => fetch(BASE + "casa_" + p + ".json?v=" + ASSET).then((r) => r.json()).catch(() => VUOTO)))
      .then((v) => Object.fromEntries(PIANI.map((p, i) => [p, v[i]])));
    // i file della casa (modelli e mappe) hanno una versione loro, calcolata dal contenuto in build.sh:
    // aggiornare la scheda non li fa riscaricare all'iPad
    MOTORE = crea({ base: BASE, ver: ASSET, casa: IMPOSTAZIONI, ...opts });
  }
  return MOTORE;
}

const CASETTA = `<svg class="m3d-freccia" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11 12 4.5l8 6.5"/><path d="M6 9.5V19h12V9.5"/><path d="M10 19v-5h4v5"/></svg>`;
const FRECCIA = (su) => `<svg class="m3d-freccia" viewBox="0 0 24 24" aria-hidden="true"><path d="${su ? "M12 19V5M6 11l6-6 6 6" : "M12 5v14M6 13l6 6 6-6"}"/></svg>`;
// miscela fra due colori CSS qualsiasi (nome, #esadecimale, rgb/rgba o terna "r, g, b"): null se non sono colori
const _cvC = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
function _rgba(c) {
  if (!c) return null; const t = /^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*$/.exec(c); if (t) return { v: [+t[1], +t[2], +t[3], 1], terna: true };
  if (!_cvC) return null; _cvC.fillStyle = "#010203"; _cvC.fillStyle = c; const f = _cvC.fillStyle;
  if (f === "#010203" && !/^#010203$/i.test(c.trim())) return null;
  let m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(f); if (m) return { v: [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16), 1] };
  m = /rgba?\(([^)]+)\)/.exec(f); if (m) { const p = m[1].split(",").map(Number); return { v: [p[0], p[1], p[2], p[3] ?? 1] }; } return null;
}
function mixColore(a, b, s) {
  const A = _rgba(a), B = _rgba(b); if (!A || !B) return null;
  const v = A.v.map((x, i) => x + (B.v[i] - x) * s);
  return B.terna ? v.slice(0, 3).map(Math.round).join(", ") : "rgba(" + v.slice(0, 3).map(Math.round).join(", ") + ", " + v[3].toFixed(3) + ")";
}
// colori delle schede di HA di sera (stessi nomi del tema di HA; fondo e schede nella tinta blu notte della piantina)
const TEMA_SERA = [
  ["--primary-background-color", "rgb(8, 11, 18)"], ["--secondary-background-color", "rgb(24, 30, 42)"],
  ["--card-background-color", "rgb(20, 25, 36)"], ["--ha-card-background", "rgb(20, 25, 36)"], ["--mdc-theme-surface", "rgb(20, 25, 36)"],
  ["--primary-text-color", "#e6e8ec"], ["--secondary-text-color", "#9aa3b2"], ["--disabled-text-color", "#6b7280"], ["--text-primary-color", "#ffffff"],
  ["--divider-color", "rgba(230, 232, 236, 0.12)"], ["--ha-card-border-color", "rgba(230, 232, 236, 0.08)"], ["--outline-color", "rgba(230, 232, 236, 0.16)"],
  ["--input-fill-color", "rgba(255, 255, 255, 0.05)"], ["--mdc-text-field-fill-color", "rgba(255, 255, 255, 0.05)"], ["--mdc-theme-on-surface", "#e6e8ec"],
  ["--state-icon-color", "#b8c2d4"], ["--paper-item-icon-color", "#b8c2d4"], ["--secondary-background-color-rgb", "24, 30, 42"],
  ["--ha-card-box-shadow", "none"], ["--clear-background-color", "rgb(20, 25, 36)"], ["--card-background-color-rgb", "20, 25, 36"],
];
const CSS_SCHEDA = `
/* mappa "presa" sul telefono: niente bordo giallo intorno, resta solo il pulsante Fine colorato */
.tre.attivo::after { display: none !important; }
/* toccando la piantina su iPad/iPhone il browser disegnava il riquadro di "selezionato" (focus) intorno alla scheda: niente riquadro */
:host, ha-card, .mapbox, .mapbox canvas { outline: none !important; -webkit-tap-highlight-color: transparent; }
:host(:focus), :host(:focus-visible), ha-card:focus, ha-card:focus-visible, .mapbox:focus, .mapbox canvas:focus { outline: none !important; box-shadow: none; }

:host { display: block; --sun: #ffc83d; --sel: #ffc83d; --sel-testo: #241703; }
/* iPad: il pulsante per muovere la mappa sta sempre in basso a destra, non sopra la barra delle stanze */
.tre-luce, .tre-stanza, .m3d-st { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.tre-attiva { top: auto !important; bottom: 14px !important; left: 14px !important; right: auto !important; height: auto !important; max-height: 48px; transform: none !important; opacity: 1 !important; pointer-events: auto !important; min-height: 44px; font-size: 13px !important; box-shadow: 0 6px 18px rgba(0,0,0,.25); }
ha-card { display: block; overflow: hidden; height: 100%; container-type: inline-size; }
:host([fondi]) ha-card { background: transparent; box-shadow: none; border: 0; }
.mapbox { position: relative; height: var(--casa3d-altezza, clamp(380px, 68vh, 760px)); background: radial-gradient(90% 70% at 50% 42%, var(--cielo-alone, #22304e) 0%, transparent 70%), linear-gradient(180deg, var(--cielo-alto, #10182c) 0%, var(--cielo-basso, #080b12) 100%); transition: background .8s; touch-action: pan-y; border-radius: inherit; overflow: hidden; color: #fff; }
:host([riempi]) .mapbox { height: calc(100dvh - var(--header-height, 56px) - env(safe-area-inset-top, 0px)); min-height: 320px; }
.m3d-velo { position: absolute; inset: 0; z-index: 30; background: inherit; transition: opacity .7s ease; --l1: rgba(255, 255, 255, .85); --l2: rgba(255, 255, 255, .5); --l3: rgba(255, 255, 255, .28); --muro: rgba(255, 255, 255, .07); --pav: rgba(255, 255, 255, .04); --tx: rgba(255, 255, 255, .92); --tx2: rgba(255, 255, 255, .5); --bar: rgba(255, 255, 255, .14); }
.di-giorno .m3d-velo { --l1: rgba(38, 50, 72, .78); --l2: rgba(38, 50, 72, .45); --l3: rgba(38, 50, 72, .25); --muro: rgba(255, 255, 255, .55); --pav: rgba(255, 255, 255, .4); --tx: #26324a; --tx2: rgba(38, 50, 72, .55); --bar: rgba(38, 50, 72, .12); --anello: rgba(38, 50, 72, .07); }
.m3d-velo.via { opacity: 0; pointer-events: none; }
.m3d-velo::before { content: ""; position: absolute; left: 50%; top: 44%; width: 420px; height: 300px; transform: translate(-50%, -50%); border-radius: 50%; background: radial-gradient(closest-side, rgba(255, 190, 80, .13), rgba(255, 190, 80, 0)); animation: m3d-respira 4.8s ease-in-out infinite; pointer-events: none; }
.m3d-carica { position: absolute; left: 50%; top: 50%; bottom: auto; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; text-align: center; color: #fff; padding: 0; background: none; border: 0; box-shadow: none; animation: m3d-entra .8s cubic-bezier(.2, .8, .2, 1) both; }
.m3d-giro { position: relative; display: grid; place-items: center; width: 80px; height: 80px; }
.m3d-giro::before { content: ""; position: absolute; inset: 0; border-radius: 50%; border: 5px solid var(--anello, rgba(255, 255, 255, .12)); }
.m3d-giro::after { content: ""; position: absolute; inset: 0; border-radius: 50%; background: conic-gradient(from 0deg, transparent 0deg, color-mix(in srgb, var(--sel) 55%, transparent) 90deg, var(--sel) 200deg, var(--sel) 360deg); -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 5px)); mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 5px)); filter: drop-shadow(0 0 6px color-mix(in srgb, var(--sel) 50%, transparent)); animation: m3d-gira 1.1s linear infinite; }
.m3d-casetta { width: 32px; height: 32px; fill: none; stroke: var(--l1); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.m3d-porta { stroke: var(--sel); }
@keyframes m3d-gira { to { transform: rotate(360deg); } }
.m3d-testo { margin-top: 20px; font-size: 15px; font-weight: 600; letter-spacing: .04em; color: var(--tx); }
.m3d-sotto { margin-top: 6px; font-size: 12px; font-weight: 500; letter-spacing: .06em; color: var(--tx2); }
.m3d-barra { position: relative; margin-top: 18px; width: 120px; height: 2px; border-radius: 2px; background: var(--bar); overflow: hidden; }
.m3d-barra i { position: absolute; inset: 0 auto 0 0; width: 45%; border-radius: 2px; background: linear-gradient(90deg, rgba(255, 200, 61, 0), #ffc83d, rgba(255, 200, 61, 0)); animation: m3d-scorri 1.8s cubic-bezier(.45, 0, .55, 1) infinite; }
@keyframes m3d-traccia { to { stroke-dashoffset: 0; } }
@keyframes m3d-luce { 0%, 8% { opacity: 0; } 22%, 62% { opacity: 1; } 80%, 100% { opacity: 0; } }
@keyframes m3d-scorri { from { transform: translateX(-110%); } to { transform: translateX(240%); } }
@keyframes m3d-respira { 0%, 100% { opacity: .6; } 50% { opacity: 1; } }
@keyframes m3d-entra { from { opacity: 0; transform: translate(-50%, calc(-50% + 10px)); } }
@media (prefers-reduced-motion: reduce) { .m3d-giro::after { animation-duration: 2.6s; } .m3d-velo::before, .m3d-carica { animation: none; } .m3d-barra i { animation-duration: 3.6s; } }
.mapbox { isolation: isolate; }
.m3d-stanze { position: absolute; left: 8px; right: 8px; top: 8px; max-width: max-content; margin: 0 auto; z-index: 4; display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding: 6px; border-radius: 16px; background: rgba(11, 14, 19, .72); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
.m3d-stanze::-webkit-scrollbar { display: none; }
.m3d-luce { position: absolute; right: 12px; bottom: 12px; z-index: 4; min-height: 36px; padding: 0 14px; border: 0; border-radius: 12px; background: rgba(11, 14, 19, .72); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); color: rgba(255, 255, 255, .85); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
.m3d-luce.on { background: var(--sel); color: var(--sel-testo); }
.m3d-st { flex: none; min-height: 40px; padding: 0 14px; border-radius: 12px; border: 0; background: transparent; color: rgba(255, 255, 255, .78); font: inherit; font-size: 13.5px; font-weight: 700; cursor: pointer; white-space: nowrap; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
.m3d-st.on { background: var(--sel); color: var(--sel-testo); }
.m3d-st.musica { color: #FF914D; border-left: 1px solid rgba(255,255,255,.15); }
.m3d-st.musica.on { background: #FF914D; color: #241703; }
.m3d-st.piano { color: var(--sel); border-left: 1px solid rgba(255,255,255,.15); border-radius: 0 12px 12px 0; overflow: hidden; text-overflow: clip; }
.m3d-st.on.piano { color: var(--sel-testo); }
.m3d-freccia { width: 16px; height: 16px; margin-right: 6px; vertical-align: -3px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.m3d-st.piano .freccia { margin-right: 0; }
.m3d-st.piano:has(+ .m3d-st.piano) { border-radius: 0; }
/* cambio di piano: le stanze del piano lasciato scivolano via (in alto salendo, in basso scendendo), il pulsante del piano
   diventa "Salgo…/Scendo…" e si riempie mentre la camera vola; all'arrivo entrano una dopo l'altra le stanze del nuovo piano */
.m3d-stanze { transition: gap .45s cubic-bezier(.4,0,.2,1) .15s; }
.m3d-stanze .m3d-st:not(.piano) { max-width: 260px; overflow: hidden; }
.m3d-stanze.cambia { pointer-events: none; gap: 0; }
.m3d-stanze.cambia .m3d-st:not(.piano) { transition: opacity .25s ease, transform .3s cubic-bezier(.4,0,.2,1), max-width .45s cubic-bezier(.4,0,.2,1) .15s, padding .45s cubic-bezier(.4,0,.2,1) .15s; transition-delay: calc(var(--i) * 18ms), calc(var(--i) * 18ms), .15s, .15s; opacity: 0; transform: translateY(var(--via, -10px)) scale(.96); max-width: 0; padding-left: 0; padding-right: 0; }
.m3d-stanze.cambia .m3d-st.piano { border-left-color: transparent; border-radius: 12px; transition: border-radius .3s, border-color .3s; }
.m3d-stanze.giu { --via: 10px; --entra: -10px; }
.m3d-stanze.su { --via: -10px; --entra: 10px; }
.m3d-st.piano.va { position: relative; overflow: hidden; color: var(--sel-testo); background: rgba(255,255,255,.08); }
.m3d-st.piano.va::before { content: ""; position: absolute; inset: 0; background: var(--sel); transform-origin: left; transform: scaleX(0); animation: m3d-riempi var(--dur, 1.4s) cubic-bezier(.45,0,.55,1) forwards; z-index: -1; }
.m3d-st.piano.va .freccia { display: inline-block; animation: m3d-sali .5s ease-in-out infinite alternate; }
.m3d-stanze.giu .m3d-st.piano.va .freccia { animation-name: m3d-scendi; }
.m3d-st.piano.va, .m3d-st.piano.va * { isolation: isolate; }
@keyframes m3d-riempi { to { transform: scaleX(1); } }
@keyframes m3d-sali { from { transform: translateY(2px); } to { transform: translateY(-3px); } }
@keyframes m3d-scendi { from { transform: translateY(-2px); } to { transform: translateY(3px); } }
@media (prefers-reduced-motion: reduce) { .m3d-st.piano.va .freccia { animation: none; } .m3d-stanze.cambia .m3d-st:not(.piano) { transform: none; } }
/* barra delle stanze sempre in alto; con barra_in_basso: in basso sugli schermi stretti (telefono), a portata di pollice */
@container (max-width: 600px) { :host([barra-basso]) .m3d-stanze { top: auto; bottom: 8px; } }
/* pianta con sete: la goccia pulsa piano, come un respiro */
@keyframes sete { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 4px rgba(255,145,77,.25), 0 0 14px rgba(255,145,77,.6); } 50% { transform: scale(1.18); box-shadow: 0 0 0 10px rgba(255,145,77,.12), 0 0 26px rgba(255,145,77,.85); } }
.tre-luce.t-goccia.avviso.on i { animation: sete 1.8s ease-in-out infinite; }
.tre-luce.avviso.on i { background-color: #FF914D; color: #fff; border-color: #fff; box-shadow: 0 0 0 6px rgba(255, 145, 77, .28), 0 0 22px rgba(255, 145, 77, .75); }
.tre-luce.avviso i svg .aperto { display: none; }
/* robot aspirapolvere: verde mentre pulisce, con un giro lento attorno */
.tre-luce.robot.on i { background-color: #35c27a; color: #fff; box-shadow: 0 0 0 6px rgba(53, 194, 122, .25), 0 0 22px rgba(53, 194, 122, .7); }
.tre-luce.robot.on i svg { animation: m3d-gira 6s linear infinite; }
/* elettrodomestico in funzione: azzurro acqua, con un respiro lento */
.tre-luce.elettro.on i { background-color: #2fb7c9; color: #fff; box-shadow: 0 0 0 6px rgba(47, 183, 201, .25), 0 0 22px rgba(47, 183, 201, .7); animation: lavora 2.4s ease-in-out infinite; }
@keyframes lavora { 0%, 100% { box-shadow: 0 0 0 4px rgba(47, 183, 201, .22), 0 0 14px rgba(47, 183, 201, .55); } 50% { box-shadow: 0 0 0 9px rgba(47, 183, 201, .1), 0 0 26px rgba(47, 183, 201, .8); } }
/* purificatore acceso: verde acqua; telecamera sempre visibile, neutra */
.tre-luce.aria.on i { background-color: #5ad1c4; color: #10302c; box-shadow: 0 0 0 6px rgba(90, 209, 196, .25), 0 0 22px rgba(90, 209, 196, .7); }
/* allarmi (fumo, perdita d'acqua): rossi e pulsanti quando scattano */
.tre-luce.allarme.on i { background-color: #ff3b30; color: #fff; box-shadow: 0 0 0 6px rgba(255, 59, 48, .3), 0 0 26px rgba(255, 59, 48, .85); animation: allarme 1s ease-in-out infinite; }
@keyframes allarme { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.14); } }
/* movimento: icona sempre presente, sobria quando la stanza è vuota; azzurra quando c'è qualcuno */
.tre-luce.presenza.on i { background-color: #3a8dff; color: #fff; box-shadow: 0 0 0 6px rgba(58, 141, 255, .25), 0 0 20px rgba(58, 141, 255, .65); }
@media (prefers-reduced-motion: reduce) { .tre-luce.elettro.on i, .tre-luce.allarme.on i { animation: none; } }
/* sensore di temperatura: il numero al posto dell'icona, in un cerchio appena più largo */
.tre-luce.temp i.val { font-style: normal; width: auto; min-width: 36px; padding: 0 7px; box-sizing: border-box; border-radius: 18px; font-size: 12.5px; font-weight: 700; letter-spacing: -.01em; font-variant-numeric: tabular-nums; }
.tre-luce.temp { width: auto; min-width: 44px; }
.tre-luce.temp.piccola i.val { min-width: 28px; height: 28px; font-size: 11px; padding: 0 5px; }
@media (prefers-reduced-motion: reduce) { .tre-luce.robot.on i svg { animation: none; } }
/* serrature, porte, finestre, fumo, perdite, piante: ogni sensore ha sempre la sua icona sulla mappa,
   sobria quando è tutto a posto, colorata quando c'è da guardare (porta aperta, allarme, pianta con sete) */
.tre-luce.avviso.on i svg .aperto { display: inline; }
.tre-luce.t-lucchetto.on i svg .chiuso { display: none; }
.stanza-pannello { padding: 12px 12px 24px; --ha-card-border-radius: var(--restore-card-border-radius, 12px); --ha-card-border-width: var(--restore-card-border-width, 1px); --ha-card-box-shadow: var(--restore-card-box-shadow, none); }
.stanza-prepara { position: absolute; left: -30000px; top: 0; pointer-events: none; padding: 0 12px; box-sizing: border-box; }
.stanza-titolo { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; margin: 2px auto 16px; padding: 0 6px; box-sizing: border-box; }
.stanza-titolo b { order: 2; padding: 24px 0 10px; font-size: 30px; font-weight: 700; letter-spacing: -.025em; line-height: 1.1; color: var(--primary-text-color); }
.stanza-titolo button { order: 1; display: inline-flex; align-items: center; gap: 2px; margin-left: -6px; min-height: 32px; padding: 0 8px 0 2px; border: 0; border-radius: 10px; background: transparent; color: var(--primary-color); font: inherit; font-size: 16px; font-weight: 500; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: opacity .15s; }
.stanza-titolo button:active { opacity: .45; }
/* a muratura: i blocchi riempiono le colonne dall'alto, senza buchi sotto i blocchi corti */
.stanza-griglia { column-width: 320px; column-gap: 16px; column-fill: balance; }
.stanza-colonne { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; justify-content: center; }
.stanza-colonne > .stanza-cella.largo { flex: 1 1 100%; }
.stanza-colonne > .stanza-cella.musica-air { max-height: 830px; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
/* blocco non ancora creato: segnaposto fermo (niente animazioni, costano all'iPad) */
.stanza-colonne .stanza-cella:empty { background: rgba(127, 127, 127, .09); border-radius: 12px; }
.stanza-col { flex: 0 1 400px; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
.stanza-colonne .stanza-cella { margin: 0; width: 100%; }
.pila-posto { display: contents; }
.stanza-cella.pila { display: inline-flex; flex-direction: column; gap: 8px; }
.stanza-cella.pila .titolo-sez:not(:first-child) { margin-top: 18px; }
.pila-griglia { display: grid; gap: 8px; }
.pila-griglia > * { min-width: 0; }
.pila-titolo { font-weight: 500; padding: 4px 4px 0; }
.stanza-cella { min-width: 0; display: inline-block; width: 100%; break-inside: avoid; -webkit-column-break-inside: avoid; margin: 0 0 12px; vertical-align: top; }
.stanza-vuota { margin: 4px; color: var(--secondary-text-color); }
.m3d-riprova { margin-top: 14px; min-height: 40px; padding: 0 18px; border-radius: 12px; border: 0; background: #FF914D; color: #241703; font: inherit; font-weight: 700; cursor: pointer; }
.m3d-errore { position: absolute; inset: 0; display: grid; place-items: center; padding: 24px; text-align: center; color: rgba(255,255,255,.8); font-size: 14px; }
`;

class Casa3dCard extends HTMLElement {
  static getStubConfig() { return {}; }
  setConfig(config) {
    this._config = { ...config };
    this._ent = { ...ENTITA, ...(config.entita || {}) };
    this._tv = { ...SORGENTI_TV, ...(config.sorgenti_tv || {}) };
    this._viste = { ...VISTE_STANZE, ...(config.viste || {}) };
    impostaDaScheda(this._config);
    if (config.altezza) this.style.setProperty("--casa3d-altezza", typeof config.altezza === "number" ? config.altezza + "px" : config.altezza);
    this.toggleAttribute("riempi", !!config.riempi);
    this.toggleAttribute("barra-basso", !!config.barra_in_basso);
    // la piantina si fonde con la dashboard: sfondo della dashboard = colore del cielo in basso (chiaro di giorno, blu notte di sera),
    // scheda senza bordo né ombra. Di serie acceso; sfondo_dashboard: false per lasciare la dashboard com'è
    this._fondi = config.sfondo_dashboard !== false; this.toggleAttribute("fondi", this._fondi);
    // colore delle selezioni (stanza scelta, numero di luci accese, anello del caricamento): di serie giallo
    const cs = config.colore_selezioni, rgb = Array.isArray(cs) ? cs : typeof cs === "string" && /^#?[0-9a-f]{6}$/i.test(cs.trim()) ? cs.trim().replace("#", "").match(/../g).map((x) => parseInt(x, 16)) : null;
    if (rgb) { this.style.setProperty("--sel", `rgb(${rgb.join(",")})`);
      // testo scuro sui colori chiari (giallo, verde chiaro), bianco su quelli scuri
      this.style.setProperty("--sel-testo", 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] > 160 ? "#1b1f27" : "#fff"); }
    else { this.style.removeProperty("--sel"); this.style.removeProperty("--sel-testo"); }
    if (this._box) this._firma = "";
  }
  getCardSize() { return 8; }
  getGridOptions() { return { columns: 12, rows: 8, min_columns: 6, min_rows: 5 }; }

  set hass(h) {
    this._hass = h;
    this._passaFigli();
    if (!this._avviato) this._avvia();
    this._aggiorna();
  }

  // le schede di HA sotto la mappa: su iPad si aggiornano al massimo ogni 1,5 s e mai mentre la mappa si muove
  // (prima ricevevano ogni cambio di stato della casa, più volte al secondo, e il 3D si piantava)
  _passaFigli() {
    if (!this._figli || !this._figli.length) return;
    if (!SU_TOUCH_C) { for (const c of this._figli) { c.hass = this._hass; applicaVisibilita(c, this._hass); } return; }
    // fuori schermo non serve aggiornarle: ci penso al prossimo giro, quando sono visibili
    const r = this._pannello && this._pannello.getBoundingClientRect();
    if (r && (r.top > innerHeight || r.bottom < 0)) { if (!this._tFigli) this._tFigli = setTimeout(() => { this._tFigli = null; this._passaFigli(); }, 2000); return; }
    if (this._tFigli) return;
    const vai = () => {
      if (this._m && this._m.occupato && this._m.occupato()) { this._tFigli = setTimeout(vai, 400); return; }
      // solo le schede che si vedono, 3 alla volta dalla coda dei lavori pesanti: nessun aggiornamento lungo blocca la mappa
      const st = this._statoTouch;
      const vis = st ? st.celle.filter((c) => c.vis && c.cella.isConnected).flatMap((c) => c.figli)
        : this._figli.filter((c) => { const b = c.getBoundingClientRect(); return b.bottom > -100 && b.top < innerHeight + 100 && b.height > 0; });
      if (!this._m || !this._m.quandoLibero) { this._tFigli = null; for (const c of vis) c.hass = this._hass; return; }
      // solo le schede in cui è cambiato uno dei dispositivi che mostrano (i pulsanti personalizzati costano centinaia di ms
      // ciascuno su iPad: aggiornarli tutti a ogni giro faceva scattare la mappa); quelle senza dispositivi ogni 30 s
      const h = this._hass, ora = Date.now();
      const da = vis.filter((c) => !c._h || (c._ents && c._ents.length ? c._ents.some((e) => h.states[e] !== c._h.states[e]) : ora - (c._t || 0) > 30000));
      const giri = []; for (let i = 0; i < da.length; i += 3) { const pezzo = da.slice(i, i + 3); giri.push(this._m.quandoLibero("schede aggiornate", () => { for (const c of pezzo) if (c.isConnected) { c.hass = h; c._h = h; c._t = Date.now(); applicaVisibilita(c, h); } })); }
      if (vis.length) this._figliSubito = false;
      Promise.all(giri).then(() => { this._tFigli = null; });
    };
    this._tFigli = setTimeout(vai, this._figliSubito ? 30 : 1500);
  }

  disconnectedCallback() {
    // la scheda esce dalla dashboard: lo sfondo torna quello del tema (se rientra lo rimette _cielo)
    if (this._sfondoSu) { cancelAnimationFrame(this._gAnim); this._temaSera(0); this._temaGiorno = null; this._gv = undefined; this._sfondoSu.style.removeProperty("--lovelace-background"); this._sfondoSu.style.removeProperty("--casa3d-sfondo"); this._sfondoSu = null; this._g = null; }
  }
  connectedCallback() {
    if (this._g === null && this._hass) this._cielo(this._giorno(this._hass));
    if (this._m && this._m.el && this._box && !this._box.contains(this._m.el)) this._box.prepend(this._m.el);
  }

  _avvia() {
    this._avviato = true;
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${CSS_MOTORE}${CSS_SCHEDA}</style><ha-card><div class="mapbox m3d"><div class="m3d-velo"><div class="m3d-carica"><span class="m3d-giro"><svg class="m3d-casetta" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.2 12 4.5l8 6.7"/><path d="M6.2 9.6V19h11.6V9.6"/><path class="m3d-porta" d="M10.4 19v-4.6h3.2V19"/></svg></span><span class="m3d-testo">Preparo la tua casa</span><span class="m3d-sotto">accendo le stanze</span></div></div></div><div class="stanza-pannello" hidden></div></ha-card>`;
    this._box = root.querySelector(".mapbox");
    // il cielo giusto (giorno o sera) da subito: il caricamento non deve passare dallo scuro al chiaro
    this._cielo(this._giorno(this._hass));
    this._pannello = root.querySelector(".stanza-pannello");
    // piano di partenza: quello lasciato l'ultima volta in questo browser (dopo un refresh si riparte da lì), altrimenti
    // quello della configurazione (piano: sopra), altrimenti il piano terra
    let _salvato = null; try { _salvato = localStorage.getItem("casa3d_piano"); } catch (e) {}
    const _iniz = [_salvato, this._config.piano].find((p) => p && PIANI.includes(p));
    this._piano = _iniz || (PIANI.includes("terra") ? "terra" : PIANI[0]);
    this._focus = null;
    const nomi = {};
    for (const [k, e] of Object.entries(this._ent)) {
      const s = this._hass && this._hass.states[e];
      nomi[k] = NOMI_BREVI[k] || (s && s.attributes.friendly_name) || k.split("|").pop();
    }
    for (const e of Object.keys(NOMI_BREVI)) nomi[e] = nomi[e] || NOMI_BREVI[e];
    for (const [t, e, nome] of SEGNALI) nomi[t + ":" + e] = nome;
    // Safari a volte rifiuta la grafica 3D (troppi contesti WebGL aperti, scheda grafica occupata):
    // la scheda riprova da sola tre volte, poi mostra un pulsante "Riprova"
    const avvia = (tent) => motore({
      nomi, nomiStanze: NOMI_STANZE, giorno: this._giorno(this._hass), // il sole di adesso: il motore carica per prime le mappe giuste
      // dal secondo tentativo: scheda grafica normale invece di quella potente, poi anche senza antialiasing
      gl: tent >= 2 ? { powerPreference: "default", antialias: false } : tent >= 1 ? { powerPreference: "default" } : undefined,
      // i callback passano sempre dalla scheda visibile in quel momento
      stanza: (k) => Casa3dCard._attiva && Casa3dCard._attiva._vai(k),
      tocca: (k, ev) => Casa3dCard._attiva && Casa3dCard._attiva._tocca(k, ev),
      lungo: (k) => Casa3dCard._attiva && Casa3dCard._attiva._lungo(k),
    }).then(async (m) => {
      this._m = m; this._meta = await META;
      // casse, prese e altri oggetti del modello senza nome in ENTITA: nome vero di HA, accorciato (mai la chiave tecnica)
      for (const k of PIANI.flatMap((p) => Object.keys((this._meta[p] || VUOTO).ent))) {
        if (nomi[k]) continue;
        const e = this._entDi(k), st = e && this._hass && this._hass.states[e];
        if (st && st.attributes.friendly_name) nomi[k] = nomeBreve(st.attributes.friendly_name);
      }
      Casa3dCard._attiva = this;
      // il velo di caricamento resta sopra la mappa finché la casa non è disegnata al suo posto, con nomi e icone già
      // sistemati (nei primi fotogrammi la mappa non ha ancora le sue misure e i nomi finirebbero tutti in alto)
      const velo = this._box.querySelector(".m3d-velo");
      this._box.prepend(m.el);
      // (il velo resta dov'è, già sopra la mappa: spostarlo farebbe ripartire le sue animazioni, un "doppio salto")
      // tutti i piani si caricano qui, sotto il velo: il primo cambio di piano è subito un volo, senza fermarsi a caricare
      // il velo va via solo quando ci sono tutte le mappe di luce (giorno e sera) di entrambi i piani: niente zone nere
      const tuttiPiani = (m.preparaSopra ? m.preparaSopra() : Promise.resolve()).then(() => { try { m.scalda && m.scalda(); } catch (e) {} })
        .then(() => m.pronta ? Promise.race([m.pronta(), new Promise((ok) => setTimeout(ok, 15000))]) : null).then(() => { try { m.scalda && m.scalda(); } catch (e) {} }).catch(() => {});
      if (velo) { let fatto = false, n = 0;
        const via = () => { if (fatto) return; fatto = true; velo.classList.add("via"); setTimeout(() => velo.remove(), 600); };
        const aspetta = () => { if (fatto) return; if (m.el.clientWidth > 0 && ++n >= 8) via(); else requestAnimationFrame(aspetta); };
        tuttiPiani.then(() => requestAnimationFrame(aspetta)); setTimeout(via, 20000); }
      // grafica persa (iPad con poca memoria): ricreo la mappa da capo
      if (!m.el._log) { m.el._log = true; const scrivi = (det) => { try { this._hass && this._hass.callService("system_log", "write", { logger: "casa3d_card", level: "warning", message: "casa3d " + VERSIONE + " " + JSON.stringify(det) + " ua=" + navigator.userAgent.slice(0, 120) }); } catch (e) {} };
        m.el.addEventListener("m3d-log", (ev) => scrivi(ev.detail));
        m.el.addEventListener("m3d-perso", () => scrivi({ tipo: "grafica persa" }));
        window.addEventListener("error", (ev) => !/ResizeObserver loop/.test(String(ev.message)) && scrivi({ tipo: "errore", msg: String(ev.message).slice(0, 200), dove: (ev.filename || "").split("/").pop() + ":" + ev.lineno })); }
      if (!m.el._perso) { m.el._perso = true; m.el.addEventListener("m3d-perso", () => {
        try { m.distruggi && m.distruggi(); } catch (e) {} // la vecchia mappa si chiude davvero prima di crearne un'altra
        this._m = null; MOTORE = null; META = null; Casa3dCard._attiva = null;
        this._box.innerHTML = '<div class="m3d-velo"><div class="m3d-carica"><span class="m3d-giro"><svg class="m3d-casetta" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.2 12 4.5l8 6.7"/><path d="M6.2 9.6V19h11.6V9.6"/><path class="m3d-porta" d="M10.4 19v-4.6h3.2V19"/></svg></span><span class="m3d-testo">Ricarico la casa 3D</span></div></div>';
        setTimeout(() => avvia(2), 1200);
      }); }
      if (m.aggiungi) {
        const ent = {};
        for (const [t, e, , stanza, sopra, [x, y, z]] of SEGNALI) ent[t + ":" + e] = { stanza, sopra, box: [x - 0.04, y - 0.3, z - 0.04, x + 0.04, y - 0.22, z + 0.04] };
        // oggetti senza luce cotta (prese, pulsanti...): { chiave: { stanza, sopra, box: [x0, y0, z0, x1, y1, z1] } }
        Object.assign(ent, CASA.oggetti_extra || {});
        m.aggiungi(ent);
      }
      this._barra();
      this._mostraStanza(this._focus);
      // il piano superiore si prepara in anticipo, a casa ferma: così anche il primo cambio di piano è un volo e non uno scatto
      const suTouch = matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 1 && !matchMedia("(hover: hover)").matches);
      // su iPad il piano di sopra si carica solo quando lo si apre: prepararlo in anticipo riempie la memoria e blocca le animazioni
      // (il piano di sopra ora si carica sotto il velo, insieme al piano terra: vedi tuttiPiani)
      void suTouch;
      this._firma = ""; this._aggiorna();
      if (this._piano !== PIANI[0]) m.vai(null, true, this._piano);
      if (SU_TOUCH_C) setTimeout(() => this._preparaStanze(), 9000);
    }).catch((err) => {
      console.error("casa3d-card", err);
      MOTORE = null; META = null;
      const det = String((err && (err.message || err)) || "").replace(/[<>&]/g, "").slice(0, 200);
      const grafica = /getShaderPrecisionFormat|WebGL|context/i.test(det);
      if (grafica && tent < 3) {
        const c = this._box.querySelector(".m3d-testo"); if (c) c.textContent = "La scheda grafica è occupata, riprovo…";
        setTimeout(() => avvia(tent + 1), 1500 * (tent + 1)); return;
      }
      this._box.innerHTML = `<div class="m3d-errore">${grafica ? "Il browser non ha dato la grafica 3D alla piantina (troppe pagine 3D aperte?)." : "La casa 3D non si è caricata."}<br><small style="opacity:.7">${det}</small><br><button type="button" class="m3d-riprova">Riprova</button></div>`;
      const b = this._box.querySelector(".m3d-riprova");
      if (b) b.addEventListener("click", (ev) => { ev.stopPropagation(); location.reload(); });
    });
    avvia(0);
    this._box.addEventListener("pointerdown", () => { Casa3dCard._attiva = this; }, true);
  }

  // barra delle stanze del piano visibile, con il pulsante per cambiare piano
  // pulsante della luce (Auto → Giorno → Sera): la scelta vale per tutti i dispositivi (selettore in HA)
  // modalità della luce condivisa: se in HA esiste il selettore (input_select con opzioni auto/giorno/sera) la scelta
  // vale per tutti i dispositivi; senza selettore resta solo su questo dispositivo, come prima
  _entLuce() { const e = (this._config && this._config.luce_condivisa) || "input_select.casa_3d_luce"; return this._hass && this._hass.states[e] ? e : null; }
  _leggiLuce() {
    const e = this._entLuce(), v = e && this._hass.states[e].state;
    if (v === "auto" || v === "giorno" || v === "sera") { if (!this._luceInviata || this._luceInviata === v) { this._luceInviata = null; this._modoLuce = v; } }
    else if (this._modoLuce === undefined) { try { this._modoLuce = localStorage.getItem("casa3d-luce") || "auto"; } catch (e) { this._modoLuce = "auto"; } }
    if (this._mostraLuce) this._mostraLuce();
  }
  _pulsanteLuce() {
    if (this._box.querySelector(".m3d-luce")) return;
    const x = document.createElement("button"); x.type = "button"; x.className = "m3d-luce";
    const testo = { auto: "◐ Auto", giorno: "☀ Giorno", sera: "☾ Sera" };
    this._mostraLuce = () => { const t = testo[this._modoLuce] || testo.auto; if (x.textContent !== t) x.textContent = t; x.classList.toggle("on", this._modoLuce !== "auto"); };
    this._leggiLuce();
    x.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._modoLuce = { auto: "giorno", giorno: "sera", sera: "auto" }[this._modoLuce] || "auto";
      try { localStorage.setItem("casa3d-luce", this._modoLuce); } catch (e) {}
      const e = this._entLuce();
      // la scelta va subito sullo schermo; HA la manda poi a tutti gli altri dispositivi aperti
      if (e) { this._luceInviata = this._modoLuce; clearTimeout(this._tLuce); this._tLuce = setTimeout(() => { this._luceInviata = null; }, 5000);
        try { this._hass.callService("input_select", "select_option", { entity_id: e, option: this._modoLuce }); } catch (er) {} }
      this._mostraLuce(); this._aggiorna();
    });
    this._mostraLuce(); this._box.append(x);
  }
  _barra() {
    this._pulsanteLuce();
    let b = this._box.querySelector(".m3d-stanze");
    if (!b) { b = document.createElement("div"); b.className = "m3d-stanze"; this._box.append(b); }
    b.innerHTML = ""; b.classList.remove("cambia", "su", "giu", "va");
    let ix = 0; const bott = (testo, cls, fn) => { const x = document.createElement("button"); x.type = "button"; x.className = "m3d-st " + cls; const fr = /^[↑↓] /.test(testo); if (fr) x.innerHTML = `${FRECCIA(testo[0] === "↑")}${testo.slice(2)}`; else if (testo.startsWith("⌂ ")) x.innerHTML = `${CASETTA}${testo.slice(2)}`; else x.textContent = testo; x.style.setProperty("--i", ix++); x.addEventListener("click", (ev) => { ev.stopPropagation(); fn(); }); b.append(x); return x; };
    bott("⌂ Casa", this._focus ? "" : "on", () => this._vai(null));
    const ordine = Object.keys(NOMI_STANZE), stanze = Object.keys(this._meta[this._piano].stanze).sort((a, b) => ordine.indexOf(a) - ordine.indexOf(b));
    // l'esterno (giardino) non è una stanza del modello ma ha la sua vista in HA: lo aggiungo al piano del giardino
    if (this._piano === PIANO_GIARDINO && !stanze.includes("esterno") && this._viste.esterno) stanze.push("esterno");
    for (const k of stanze) bott(NOMI_STANZE[k] || k, k === this._focus ? "on" : "", () => this._vai(k));
    // musica: le schede della vista Musica della dashboard, nello stesso pannello sotto la mappa
    if (this._viste.musica) bott("♫ Musica", "musica" + (this._extra === "musica" ? " on" : ""), () => {
      this._extra = this._extra === "musica" ? null : "musica"; this._barra(); this._mostraStanza(this._extra || this._focus);
      if (this._extra) setTimeout(() => this._pannello && this._pannello.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
    });
    // pulsanti del piano: quello sotto (↓) e quello sopra (↑); ai piani di mezzo ci sono tutti e due, attaccati
    const ip = idxP(this._piano), giu = PIANI[ip - 1], su = PIANI[ip + 1];
    for (const [dove, freccia] of [[giu, "↓"], [su, "↑"]]) if (dove) { const x = bott(freccia + " " + nomePiano(dove), "piano", () => this._vai(null, dove)); if (x) x.dataset.piano = dove; }
  }
  // cambio di piano: le stanze vecchie escono, il pulsante del piano si riempie durante il volo ("Salgo…"); la barra del
  // piano nuovo entra solo quando la mappa avvisa che il piano è arrivato (m3d-arrivato), con un ripiego a 3 s
  // il pulsante del piano cambia testo (e larghezza): invece di saltare, la larghezza scorre dalla vecchia alla nuova
  // arrivo sul piano nuovo: la barra è già completa, con ogni voce al suo posto. Una maschera la scopre dal centro
  // (dalla larghezza della barra chiusa a quella piena) e ogni voce compare quando la maschera la raggiunge.
  // Nessuna voce cambia posto o larghezza: prima si allargavano voci e spazi, e le voci si vedevano distanziarsi.
  // Ritardi calcolati qui (Web Animations), non con variabili CSS: Safari si comporta come gli altri browser.
  _apriBarra(b, w0, sale) {
    const it = [...b.querySelectorAll(".m3d-st")]; if (!b.animate) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 }); return; }
    const r = b.getBoundingClientRect(), W = r.width, cx = r.left + W / 2, lato = Math.max(0, (W - (w0 || W)) / 2), DUR = 460;
    const ease = "cubic-bezier(.2,.8,.2,1)", raggio = getComputedStyle(b).borderTopLeftRadius || "16px";
    b.animate([{ clipPath: `inset(0px ${lato}px 0px ${lato}px round ${raggio})` }, { clipPath: `inset(0px 0px 0px 0px round ${raggio})` }], { duration: DUR, easing: ease });
    // la maschera con questa curva arriva a metà strada in circa 1/4 del tempo: il ritardo segue la stessa forma
    const quando = (d) => { if (d <= 0) return 0; let lo = 0, hi = 1; for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; ((1 - Math.pow(1 - m, 3)) < d ? (lo = m) : (hi = m)); } return lo * DUR; };
    for (const x of it) {
      const q = x.getBoundingClientRect(), d = W - 2 * lato > 0 ? (Math.abs(q.left + q.width / 2 - cx) - (W / 2 - lato)) / Math.max(1, lato) : 1;
      x.animate([{ opacity: 0, transform: `translateY(${sale ? 8 : -8}px)` }, { opacity: 1, transform: "none" }],
        { duration: 280, delay: 40 + quando(Math.min(1, Math.max(0, d))), easing: ease, fill: "backwards" });
    }
  }
  _scorriLargo(el, w0) {
    el.style.transition = "none"; el.style.width = "auto"; const w1 = el.offsetWidth; if (Math.abs(w1 - w0) < 1) { el.style.width = ""; return; }
    el.style.width = w0 + "px"; void el.offsetWidth;
    el.style.transition = "width .38s cubic-bezier(.2,.8,.2,1)"; el.style.width = w1 + "px";
    clearTimeout(el._tl); el._tl = setTimeout(() => { el.style.width = ""; el.style.transition = ""; }, 420);
  }
  _barraInVolo(sale, dove) {
    const b = this._box.querySelector(".m3d-stanze"); if (!b) return this._barra();
    this._cambiaPiano = true;
    // l'entrata delle stanze si chiude prima (e il browser lo registra), poi parte l'uscita: altrimenti la barra si chiuderebbe di scatto
    clearTimeout(this._tEntra); b.classList.remove("entra", "su", "giu"); void b.offsetWidth; b.classList.add("cambia", sale ? "su" : "giu");
    // il pulsante premuto (o quello nella direzione giusta) diventa "Salgo…/Scendo…"; l'altro pulsante del piano esce come le stanze
    const tutti = [...b.querySelectorAll(".m3d-st.piano")], p = tutti.find((x) => x.dataset.piano === dove) || tutti.find((x) => (idxP(x.dataset.piano) > idxP(this._piano)) === sale) || tutti[0];
    for (const x of tutti) if (x !== p) x.classList.remove("piano");
    if (p) { const w0 = p.offsetWidth; p.classList.add("va"); p.style.setProperty("--dur", "1.2s"); p.innerHTML = `<span class="freccia">${FRECCIA(sale)}</span>${sale ? "Salgo " : "Scendo "}${dove ? arrivoPiano(dove) : ""}`; this._scorriLargo(p, w0); }
    const fine = () => {
      if (!this._cambiaPiano) return; this._cambiaPiano = false; clearTimeout(this._tPiano);
      this._m && this._m.el.removeEventListener("m3d-arrivato", fine);
      // larghezza della barra chiusa (solo il pulsante "Salgo…"): da lì la barra nuova si apre
      const vb = this._box.querySelector(".m3d-stanze"), w0 = vb ? vb.getBoundingClientRect().width : 0;
      // la barra nuova nasce già con le voci al loro posto: tolgo la transizione dello spazio tra le voci, che
      // altrimenti passerebbe da 0 a 6 px allargando le voci sotto gli occhi
      if (vb) vb.style.transition = "none";
      this._barra(); const nb = this._box.querySelector(".m3d-stanze");
      if (nb) { void nb.offsetWidth; nb.style.transition = ""; this._apriBarra(nb, w0, sale); }
      this._entraFino = performance.now() + 620; // finché le stanze nuove entrano, un altro cambio di piano aspetta
    };
    this._m.el.addEventListener("m3d-arrivato", fine);
    this._tPiano = setTimeout(fine, 3000);
  }
  _vai(k, piano) {
    if (!this._m) return;
    if (this._cambiaPiano) return; // durante la salita/discesa la barra non si tocca: il piano nuovo non è ancora arrivato
    // tocco sul piano appena arrivati: si aspetta che le stanze nuove siano entrate, poi parte il cambio con la sua animazione
    const resta = (this._entraFino || 0) - performance.now();
    if (piano && piano !== this._piano && resta > 0) { if (!this._inAttesa) { this._inAttesa = true; setTimeout(() => { this._inAttesa = false; this._vai(k, piano); }, resta); } return; }
    const nuovoPiano = piano || (k ? PIANI.find((p) => ((this._meta[p] || VUOTO).stanze || {})[k]) || (k === "esterno" ? PIANO_GIARDINO : PIANI[0]) : this._piano);
    const prima = this._piano;
    const cambia = nuovoPiano !== this._piano;
    this._focus = k || null; this._piano = nuovoPiano; this._extra = null;
    try { localStorage.setItem("casa3d_piano", nuovoPiano); } catch (e) {}
    this._m.vai(this._focus, false, nuovoPiano);
    if (cambia) this._barraInVolo(idxP(nuovoPiano) > idxP(prima), nuovoPiano); else this._barra();
    // le schede della stanza si creano dopo il volo della telecamera: crearle durante il volo blocca il browser
    // per un attimo (Cucina, Soggiorno...) e il volo sembra uno scatto
    clearTimeout(this._tStanza); const k2 = this._focus;
    this._tStanza = setTimeout(() => { if (this._focus === k2) this._mostraStanza(k2); }, 1000);
  }

  // comandi della stanza: le schede vere della vista di HA corrispondente, mostrate sotto la piantina
  async _mostraStanza(k) {
    const P = this._pannello, url = this._config.stanze_da; if (!P || !url) return;
    const mio = (this._richiestaStanza = (this._richiestaStanza || 0) + 1);
    // nessuna stanza scelta: sotto la piantina i dati generali della vista Casa (opzione casa_da, di base "home")
    const generale = !k;
    const cd = this._config.casa_da, percorso = generale ? (cd === false ? null : (cd && typeof cd === "object" ? cd[this._piano] || cd[PIANI[0]] : cd || "home")) : this._viste[k];
    if (!percorso) { P.hidden = true; P.innerHTML = ""; this._figli = []; return; }
    try {
      if (!this._lovelace) this._lovelace = this._hass.callWS({ type: "lovelace/config", url_path: url });
      const cfg = await this._lovelace, vista = (cfg.views || []).find((v) => v.path === percorso);
      const helpers = await window.loadCardHelpers();
      if (mio !== this._richiestaStanza) return;
      // stanza già vista: i comandi sono tenuti pronti e ricompaiono subito, senza ricrearli
      const cache = (this._cacheStanze = this._cacheStanze || new Map());
      if (cache.has(percorso)) {
        const c = cache.get(percorso); P.innerHTML = ""; P.append(c.t, c.griglia); this._figli = c.figli; P.hidden = false;
        this._statoTouch = c.touch || null;
        if (c.touch) { c.touch.disponi(); this._figliSubito = true; }
        if (SU_TOUCH_C) this._passaFigli(); else for (const el of c.figli) { el.hass = this._hass; applicaVisibilita(el, this._hass); }
        return;
      }
      P.innerHTML = ""; this._figli = [];
      const { t, blocchi, vuota } = this._blocchi(k, vista, percorso, url, cfg);
      P.append(t);
      if (vuota) { if (generale) { P.hidden = true; return; } P.append(vuota); P.hidden = false; return; }
      const griglia = document.createElement("div"); griglia.className = "stanza-griglia"; P.append(griglia);
      P.hidden = false;
      // pannello a colonne fisse (iPad e computer), schede create quando entrano nello schermo, stanza tenuta pronta per sempre.
      // Anche sul Mac: Safari con le colonne CSS non disegnava parti delle schede (titoli, icone, flusso del fotovoltaico)
      if (this._m && this._m.quandoLibero) {
        griglia.remove();
        const st = this._pannelloTouch(k, blocchi.filter((b) => !(b.type === "vertical-stack" && !b.cards.length)), helpers);
        P.append(st.box); this._figli = st.figli; this._statoTouch = st;
        cache.set(percorso, { t, griglia: st.box, figli: st.figli, touch: st });
        return;
      }
      this._statoTouch = null;
      // una scheda alla volta, lasciando respirare la mappa tra l'una e l'altra (su iPad aspetto che sia ferma)
      const figli = this._figli; let n = 0;
      for (const conf of blocchi) {
        if (conf.type === "vertical-stack" && !conf.cards.length) continue;
        const crea = () => {
          if (mio !== this._richiestaStanza) return;
          const el = helpers.createCardElement(conf); el.hass = this._hass;
          const cella = document.createElement("div"); cella.className = "stanza-cella"; cella.append(el); griglia.append(cella);
          figli.push(el);
        };
        // su iPad: ogni singola scheda è un lavoro a sé nella coda (solo a mappa ferma). Il blocco (titolo + griglia di pulsanti)
        // lo ricompongo io con lo stesso aspetto di vertical-stack e grid: così nessun passo dura più di qualche decina di ms
        if (SU_TOUCH_C && this._m && this._m.quandoLibero) {
          const cella = document.createElement("div"); cella.className = "stanza-cella pila"; griglia.append(cella);
          const una = (c, dove) => this._m.quandoLibero("scheda " + (k || "casa") + " " + (c.type || "").replace("custom:", ""), () => {
            if (mio !== this._richiestaStanza) return;
            const el = helpers.createCardElement(c); el.hass = this._hass; dove.append(el); figli.push(el);
          });
          for (const c of conf.type === "vertical-stack" ? conf.cards : [conf]) {
            if (c.type === "grid" && Array.isArray(c.cards) && !c.card_mod) {
              const g = document.createElement("div"); g.className = "pila-griglia";
              g.style.gridTemplateColumns = `repeat(${c.columns || Math.min(3, c.cards.length) || 1}, minmax(0, 1fr))`;
              if (c.title) { const h = document.createElement("div"); h.className = "pila-titolo"; h.textContent = c.title; cella.append(h); }
              cella.append(g);
              for (const f of c.cards) { await una(f, g); if (mio !== this._richiestaStanza) break; }
            } else await una(c, cella);
            if (mio !== this._richiestaStanza) break;
          }
        } else crea();
        if (mio !== this._richiestaStanza) { cache.delete(percorso); return; }
      }
      if (mio === this._richiestaStanza) cache.set(percorso, { t, griglia, figli });
    } catch (err) {
      console.error("casa3d-card stanza", err);
      P.innerHTML = '<p class="stanza-vuota">Non riesco a leggere i comandi della stanza dalla dashboard ' + url + ".</p>"; P.hidden = false;
    }
  }

  // titolo e blocchi di schede di una stanza (servono sia per mostrarla sia per prepararla in anticipo)
  _blocchi(k, vista, percorso, url, cfg) {
    const generale = !k;
    const t = document.createElement("div"); t.className = "stanza-titolo";
    if (generale) t.style.display = "none"; // vista generale: niente titolo né "Chiudi"
    t.innerHTML = `<b>${NOMI_STANZE[k] || (k === "musica" ? "Musica" : k)}</b><button type="button"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" style="fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round"><path d="M15 5l-7 7 7 7"/></svg>${k === "musica" ? "Indietro" : panoramicaPiano(this._piano)}</button>`;
    t.querySelector("button").addEventListener("click", () => (k === "musica" ? (this._extra = null, this._barra(), this._mostraStanza(this._focus)) : this._vai(null)));
    if (!vista) { const n = document.createElement("p"); n.className = "stanza-vuota"; n.textContent = "Nessuna vista \"" + percorso + "\" nella dashboard " + url + "."; return { t, vuota: n }; }
    // dentro la piantina alcune schede delle viste stanza non servono: "Torna a Casa" (c'è "Chiudi")
    // e i segnaposto tipo "Nessuno speaker dedicato". Una sezione rimasta col solo titolo sparisce.
    const casa = "/" + url;
    const inutile = (c) => {
      const n = c && c.tap_action && c.tap_action.navigation_path;
      // schede pesanti che sotto la piantina rallentano l'iPad (telecamere); radar meteo animati). Restano nelle viste dedicate
      if (c && /weather-radar|picture-glance|picture-entity|iframe|webrtc|frigate|advanced-camera/i.test(c.type || "")) return true;
      // schede con parole vietate (casa.config.js, pannello.mai): mai nella piantina
      if (c && !c.cards && MAI.test(JSON.stringify(c))) return true;
      if (n && (n === casa || n === casa + "/" || n === casa + "/home" || n === "/" || n === "/lovelace/0")) return true;
      const testo = [c && c.primary, c && c.secondary, c && c.name].filter((x) => typeof x === "string").join(" ");
      return /nessun[oa]?\s+(speaker|cassa|dispositivo)/i.test(testo);
    };
    const titolo = (c) => c.type === "heading" || (c.type === "custom:bubble-card" && c.card_type === "separator");
    // radar meteo sotto la piantina: solo l'ultima immagine della pioggia, senza animazione né trascinamento
    // (l'animazione ridisegna di continuo e toglieva fluidità alla mappa 3D)
    const fermo = (c) => (/weather-radar-card/.test(c.type || "") ? { ...c, past_minutes: 0, forecast_minutes: 0, show_playback: false, animated_transitions: false, static_map: true, show_zoom: false, show_recenter: false } : c);
    const pulisci = (cards) => (cards || []).filter((c) => !inutile(c)).map((c) => (c.cards ? { ...c, cards: pulisci(c.cards) } : fermo(c)))
      .filter((c) => !(c.cards && !c.cards.length));
    // dopo la pulizia tolgo i titoli rimasti senza niente sotto
    const senzaNav = (cards) => { let via = false; return (cards || []).filter((c) => { if (titolo(c)) via = /DOVE VUOI ANDARE/i.test(c.name || c.heading || ""); return !via; }); };
    const senzaTitoliVuoti = (cards) => cards.filter((c, i) => !titolo(c) || c.largo === true || (cards[i + 1] && !titolo(cards[i + 1])));
    // ogni titolo apre un blocco suo: così una sezione lunga (Meteo, Campanello, Fotovoltaico...) si dispone
    // in orizzontale sulle colonne libere invece di diventare una colonna sola
    // una cassaforte (love-lock, es. "Allarmi") con il suo titolo dentro apre un blocco suo, come un titolo
    const apre = (c) => titolo(c) || (/love-lock-card/.test(c.type || "") && Array.isArray(c.cards) && c.cards[0] && titolo(c.cards[0]));
    const aBlocchi = (cards) => { const out = []; for (const c of cards) { if (apre(c) || !out.length) out.push([]); out[out.length - 1].push(c); } return out; };
    const blocchi = vista.sections ? vista.sections.flatMap((sz) => aBlocchi(senzaTitoliVuoti(pulisci(generale ? senzaNav(sz.cards) : sz.cards))).map((cards) => ({ type: "vertical-stack", cards })))
      : pulisci(vista.cards);
    if (generale && PROFILO) return { t, blocchi: this._famiglia(blocchi, cfg) };
    return { t, blocchi };
  }

  // Air 13": tolgo i blocchi tecnici e metto in cima il lettore Musica (la scheda della vista Musica)
  _famiglia(blocchi, cfg) {
    const nome = (b) => { const p0 = (b.cards || [b])[0] || {}, t0 = /love-lock-card/.test(p0.type || "") && p0.cards && p0.cards[0] ? p0.cards[0] : p0; return String(t0.heading || (t0.card_type === "separator" ? t0.name : "") || "").trim().toUpperCase(); };
    const via = (PROFILO.togli || []).map((x) => x.toUpperCase()), out = blocchi.filter((b) => !via.includes(nome(b)));
    const mv = PROFILO.musica_in_cima && cfg && this._viste.musica && (cfg.views || []).find((v) => v.path === this._viste.musica);
    const cerca = (cards) => { for (const c of cards || []) { if (/musica-casa-card/.test(c.type || "")) return c; const x = cerca(c.cards); if (x) return x; } return null; };
    const mc = mv && cerca([...(mv.cards || []), ...(mv.sections || []).flatMap((sz) => sz.cards || [])]);
    if (mc) out.unshift({ type: "vertical-stack", cards: [mc] });
    return out;
  }

  // iPad: ogni scheda di HA costa 100-300 ms al chip dell'iPad e la stanza si riempiva solo a mappa ferma, dopo l'ingresso
  // (decine di secondi nel Soggiorno). Qui, a casa ferma e con nessuno che tocca, preparo in anticipo la prima schermata
  // di ogni stanza, in un contenitore fuori dallo schermo: entrando, i comandi ci sono già.
  async _preparaStanze() {
    if (this._preparando || !this._m || !this._m.quandoLibero || !this._config.stanze_da) return;
    this._preparando = true;
    try {
      const url = this._config.stanze_da;
      if (!this._lovelace) this._lovelace = this._hass.callWS({ type: "lovelace/config", url_path: url });
      const cfg = await this._lovelace, helpers = await window.loadCardHelpers();
      const cache = (this._cacheStanze = this._cacheStanze || new Map());
      const ordine = Object.keys(NOMI_STANZE);
      // stanze del piano che si sta guardando per prime (ricalcolato a ogni stanza: se cambi piano, cambia anche l'ordine)
      const prossime = () => {
        const out = [];
        for (const pn of PIANI.slice().sort((a, b) => Math.abs(idxP(a) - idxP(this._piano)) - Math.abs(idxP(b) - idxP(this._piano)))) {
          const ks = Object.keys((this._meta[pn] || {}).stanze || {}).sort((a, b) => ordine.indexOf(a) - ordine.indexOf(b));
          if (pn === PIANO_GIARDINO && !ks.includes("esterno")) ks.push("esterno");
          out.push(...ks);
        }
        out.push("musica"); return out;
      };
      let fuori = this.shadowRoot.querySelector(".stanza-prepara");
      if (!fuori) { fuori = document.createElement("div"); fuori.className = "stanza-prepara"; fuori.setAttribute("aria-hidden", "true"); this.shadowRoot.querySelector("ha-card").append(fuori); }
      // due giri: prima solo quello che si vede appena sotto la mappa in ogni stanza (pochi comandi, finisce presto),
      // poi il resto della prima schermata e mezza
      const fatte = [new Set(), new Set()];
      for (let giro = 0; giro < 2; giro++) {
        const limite = giro === 0 ? Math.max(260, innerHeight * 0.35) : Math.max(700, innerHeight * 1.4);
        for (let n = 0; n < 40; n++) {
          if (!this.isConnected) break;
          const k = prossime().find((x) => this._viste[x] && !fatte[giro].has(x)); if (!k) break;
          fatte[giro].add(k);
          const percorso = this._viste[k];
          const vista = (cfg.views || []).find((v) => v.path === percorso); if (!vista) continue;
          let voce = cache.get(percorso);
          if (!voce) {
            const { t, blocchi } = this._blocchi(k, vista, percorso, url, cfg); if (!blocchi) continue;
            const st = this._pannelloTouch(k, blocchi.filter((b) => !(b.type === "vertical-stack" && !b.cards.length)), helpers);
            voce = { t, griglia: st.box, figli: st.figli, touch: st }; cache.set(percorso, voce);
          }
          const st = voce.touch; if (!st) continue;
          if (st.box.isConnected && st.box.parentNode !== fuori) continue; // stanza aperta adesso: ci pensa lei
          fuori.style.width = ((this._pannello && this._pannello.clientWidth) || this._box.clientWidth || 1000) + "px";
          fuori.append(st.box); st.firma = ""; st.disponi();
          for (const c of st.celle.filter((x) => x.top < limite && !x.fatto).sort((a, b) => a.top - b.top)) {
            if (st.box.parentNode !== fuori) break;
            await this._riempi(c, k, helpers, st, true, giro === 0 ? 4 : 0);
          }
          if (st.box.parentNode === fuori) st.box.remove();
        }
      }
    } catch (e) { console.error("casa3d-card prepara", e); }
    this._preparando = false;
  }

  // --- pannello sotto la mappa su iPad ---
  // Safari ribilanciava tutte le colonne CSS a ogni scheda aggiunta (fino a 8 s di blocco in Soggiorno):
  // qui le colonne sono fisse e ogni blocco va nella più corta, con un'altezza stimata in anticipo
  _pannelloTouch(k, blocchi, helpers) {
    const box = document.createElement("div"); box.className = "stanza-colonne";
    const st = { box, celle: [], figli: [], ncol: 0 };
    const stima = (c) => {
      const t = c.type || "";
      if (t === "heading" || (t === "custom:bubble-card" && c.card_type === "separator")) return 40;
      if (t === "grid" && Array.isArray(c.cards)) { const cols = c.columns || Math.min(3, c.cards.length) || 1; return Math.ceil(c.cards.length / cols) * (Math.max(40, ...c.cards.map(stima)) + 8); }
      if (t === "conditional") return 0;
      if (/media|player/.test(t)) return 190;
      if (/weather-radar/.test(t)) return 420;
      if (/love-lock/.test(t)) return (c.cards || []).reduce((a, x) => a + stima(x) + 8, 0);
      if (t === "tile") return c.features && c.features.length ? 112 : 64;
      if (/button-card/.test(t)) return 76;
      if (/mushroom|template/.test(t)) return 64;
      return 110;
    };
    for (const conf of blocchi) {
      const parti = conf.type === "vertical-stack" ? conf.cards : [conf];
      const cella = document.createElement("div"); cella.className = "stanza-cella pila";
      const h = parti.reduce((a, c) => a + stima(c) + 8, 0); cella.style.minHeight = h + "px";
      const largo = parti.some((p) => /musica-casa-card/.test(p.type || "")) || (parti.length === 1 && parti[0].type === "heading" && parti[0].largo === true);
      if (largo) cella.classList.add("largo");
      // Air 13": il lettore Musica in cima resta alto quanto Stanze e Preferiti, il resto (ascoltati di recente) scorre dentro
      const musicaAir = largo && !!PROFILO && !!PROFILO.musica_in_cima && !k; if (musicaAir) cella.classList.add("musica-air");
      const p0 = parti[0] || {}, t0 = /love-lock-card/.test(p0.type || "") && Array.isArray(p0.cards) && p0.cards[0] ? p0.cards[0] : p0, titolo = String(t0.heading || (t0.card_type === "separator" ? t0.name : "") || "").trim().toUpperCase();
      // altezza: quella vera misurata l'ultima volta su questo dispositivo, altrimenti la stima
      const chiave = "r3|" + (k || "casa") + "|" + (titolo || st.celle.length), hv = ALTEZZE[chiave];
      if (hv && !musicaAir) cella.style.minHeight = hv + "px"; if (musicaAir) cella.style.minHeight = "";
      const c = { cella, parti, h: musicaAir ? 830 : hv || (largo ? 600 : h), largo, titolo, chiave, fatto: false, vis: false, figli: [] }; cella._c = c; st.celle.push(c);
    }
    st.io = new IntersectionObserver((voci) => {
      for (const v of voci) { const c = v.target._c; c.vis = v.isIntersecting; if (c.vis && !c.fatto && !c.inCatena) { c.inCatena = true; st.catena = (st.catena || Promise.resolve()).then(() => (c.vis ? this._riempi(c, k, helpers, st) : null)).then(() => { c.inCatena = false; }); } }
      // un gruppo alla volta, completo, nell'ordine in cui entrano nello schermo: niente gruppi a metà con buchi
      if (voci.some((v) => v.isIntersecting)) this._passaFigli();
    }, { rootMargin: "250px 0px" });
    for (const c of st.celle) st.io.observe(c.cella);
    // disposizione: blocchi larghi in cima, poi ogni gruppo (un blocco + quelli fissati sotto di lui) nella colonna più corta.
    // Con le altezze vere, se una colonna in meno lascia molto meno vuoto (iPad 13": 4 colonne strette e una quasi vuota) uso quella.
    st.disponi = (ribilancia) => {
      const w = box.clientWidth || (this._pannello && this._pannello.clientWidth) || 1000;
      const nMax = Math.max(1, Math.min(3, Math.floor((w + 16) / (340 + 16))));
      const sotto = new Map(); for (const [capo, figli] of SOTTO_A) { const a = st.celle.find((x) => x.titolo === capo); if (!a) continue; const f = figli.map((t) => st.celle.find((x) => x.titolo === t)).filter(Boolean); if (f.length) sotto.set(a, f); }
      const fissi = new Set([...sotto.values()].flat());
      const larghi = st.celle.filter((c) => c.largo), su = larghi.reduce((a, c) => a + c.h + 12, 0);
      const gruppi = st.celle.filter((c) => !c.largo && !fissi.has(c)).map((c) => { const cc = [c, ...(sotto.get(c) || [])]; return { cc, h: cc.reduce((a, x) => a + x.h + 12, 0) }; });
      const prova = (n) => { const alt = new Array(n).fill(0), dove = []; for (const g of gruppi) { const j = alt.indexOf(Math.min(...alt)); dove.push(j); alt[j] += g.h; } const max = Math.max(...alt); return { n, dove, max, vuoto: n * max - alt.reduce((a, b) => a + b, 0) }; };
      let scelta = prova(nMax);
      // il numero di colonne si decide al massimo una volta con le altezze vere, per questa larghezza: niente salti avanti e indietro
      if (st.nPer && st.nPer.w === w) scelta = prova(st.nPer.n);
      else if (nMax >= 3) { const meno = prova(nMax - 1); if (meno.vuoto < scelta.vuoto * 0.6 && meno.max <= scelta.max * 1.15) scelta = meno; if (ribilancia && st.celle.every((c) => c.fatto)) st.nPer = { w, n: scelta.n }; }
      scelta = { ...scelta, n: nMax };
      const firma = w + ":" + scelta.n;
      if (firma === st.firma) return; st.firma = firma; st.ncol = scelta.n;
      box.innerHTML = ""; const cols = [], alt = [];
      const tt = box.previousElementSibling; if (tt && tt.classList.contains("stanza-titolo")) tt.style.maxWidth = Math.min(w, scelta.n * 400 + (scelta.n - 1) * 16) + "px";
      // a righe, nell'ordine delle stanze: le sezioni di una riga partono alla stessa altezza, così una stanza si trova a colpo d'occhio
      box.style.cssText = `display: grid; grid-template-columns: repeat(${scelta.n}, minmax(0, 400px)); justify-content: center; align-items: start; gap: 32px 16px;`;
      // nell'ordine della vista: un blocco largo (titolo del piano, musica) occupa una riga intera
      let riga = 0, hRiga = 0, col = 0;
      for (const c0 of st.celle) {
        if (fissi.has(c0)) continue;
        if (c0.largo) { if (col) { riga += hRiga + 16; hRiga = 0; col = 0; } c0.cella.style.gridColumn = "1 / -1"; box.append(c0.cella); c0.top = riga; riga += c0.h + 16; continue; }
        if (col === scelta.n) { riga += hRiga + 16; hRiga = 0; col = 0; }
        const d = document.createElement("div"); d.className = "stanza-col"; box.append(d); let y = riga;
        for (const c of [c0, ...(sotto.get(c0) || [])]) { d.append(c.cella); c.top = y; y += c.h + 12; }
        hRiga = Math.max(hRiga, y - riga); col++;
      }
    };
    // dopo che un blocco è completo ne misuro l'altezza vera: la ricordo (la prossima volta la disposizione è giusta subito)
    // e, se cambia molto, ridispongo a mappa ferma
    st.misura = (c) => requestAnimationFrame(() => {
      if (!c.cella.isConnected || !c.cella.offsetWidth) return;
      const hv = c.cella.offsetHeight; if (hv < 20) return;
      if (ALTEZZE[c.chiave] !== hv) { ALTEZZE[c.chiave] = hv; salvaAltezze(); }
      if (Math.abs(hv - c.h) > 24) { c.h = hv; clearTimeout(st.tRib); st.tRib = setTimeout(() => { const f = () => st.disponi(true); if (this._m && this._m.quandoLibero) this._m.quandoLibero("riordino pannello", f, 1000); else f(); }, 1200); }
    });
    new ResizeObserver(() => requestAnimationFrame(() => st.disponi())).observe(box); // al fotogramma dopo: niente "ResizeObserver loop"
    st.disponi();
    return st;
  }
  // crea le schede di un blocco, una per lavoro della coda; se la stanza cambia a metà, riprende da lì la prossima volta
  async _riempi(c, k, helpers, st, fondo, quanti) {
    if (c.inCorso || c.fatto) return; c.inCorso = true;
    if (!c.passi) {
      c.passi = []; c.i = 0;
      for (const p of c.parti) {
        if (p.type === "grid" && Array.isArray(p.cards) && !p.card_mod) {
          if (p.title) { const h = document.createElement("div"); h.className = "pila-titolo"; h.textContent = p.title; c.cella.append(h); }
          const g = document.createElement("div"); g.className = "pila-griglia";
          g.style.gridTemplateColumns = `repeat(${p.columns || Math.min(3, p.cards.length) || 1}, minmax(0, 1fr))`;
          c.cella.append(g); for (const f of p.cards) c.passi.push({ conf: f, dove: g });
        } else { const s = document.createElement("div"); s.className = "pila-posto"; c.cella.append(s); c.passi.push({ conf: p, dove: s }); }
      }
    }
    let fatti = 0;
    for (; c.i < c.passi.length; c.i++) {
      if (!this._m || !this._m.quandoLibero) { c.inCorso = false; return; } // mappa in ricreazione: riprende dopo
      if (quanti && fatti >= quanti) { c.inCorso = false; return; } // primo giro di preparazione: solo le prime schede del blocco
      fatti++;
      const { conf, dove } = c.passi[c.i];
      const ok = await this._m.quandoLibero("scheda " + (k || "casa") + " " + (conf.type || "").replace("custom:", ""), () => {
        if (!c.cella.isConnected) return false;
        const el = helpers.createCardElement(conf); el.hass = this._hass; el._h = this._hass; el._t = Date.now();
        el._ents = [...new Set(JSON.stringify(conf).match(/\b(?:light|switch|sensor|binary_sensor|climate|cover|media_player|lock|fan|input_boolean|input_select|input_number|input_text|input_datetime|script|scene|automation|button|input_button|select|number|person|weather|vacuum|alarm_control_panel|remote|camera|update|device_tracker|sun|timer|counter|humidifier|water_heater|valve|event|todo|calendar|image|text|siren|lawn_mower|group|zone)\.[a-z0-9_]+/g) || [])];
        if (conf.visibility) { el._vis = conf.visibility; applicaVisibilita(el, this._hass); }
        if (conf.type === "heading") el.classList.add("titolo-sez");
        dove.append(el); c.figli.push(el); st.figli.push(el); return true;
      }, fondo ? 2000 : 600, fondo ? () => !(this._pannello && this._pannello.contains(c.cella)) : false);
      if (!ok) { c.inCorso = false; return; }
    }
    c.fatto = true; c.inCorso = false; c.cella.style.minHeight = ""; if (st.misura) st.misura(c);
  }

  _entDi(k) {
    if (this._ent[k]) return this._ent[k];
    const i = k.indexOf(":");
    if (i > 0 && /^(media|atv|presa|serratura|apertura|proiettore|caffe|pianta|pulsante|luce|robot|temperatura|umidita|elettrodomestico|fumo|perdita|movimento|purificatore|camera|clima)$/.test(k.slice(0, i))) return k.slice(i + 1);
    return null;
  }
  _info(e) {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: e }, bubbles: true, composed: true }));
  }
  _vibra() { this.dispatchEvent(new CustomEvent("haptic", { detail: "light", bubbles: true, composed: true })); }

  // tocco: interruttori diretti; TV, clima e stufa aprono la finestra nativa
  _tocca(k, ev) {
    const h = this._hass; if (!h) return;
    // pianta con sete: il tocco mostra solo il nome e l'umidità della terra (la finestra di HA con la pressione lunga)
    if (k.startsWith("pianta:")) {
      const d = (ev && ev.target && ev.target.closest && ev.target.closest(".tre-luce")) || (this._box && this._box.querySelector(`.tre-luce[data-ent="${k}"]`)), s = h.states[k.slice(7)], n = d && d.querySelector(".nome");
      if (d && !d.classList.contains("mostra")) { d.classList.add("mostra"); clearTimeout(d._t); d._t = setTimeout(() => d.classList.remove("mostra"), 4000); }
      if (n) { const base = d.getAttribute("aria-label") || n.textContent; n.textContent = base + (s && !isNaN(Number(s.state)) ? " · terra " + Math.round(Number(s.state)) + "%" : ""); }
      return;
    }
    // TV: si accendono dall'Apple TV (HDMI-CEC sveglia la TV); accese, il tocco apre la finestra dell'Apple TV
    const atv = this._tv[k] || (k.startsWith("atv:") ? k.slice(4) : null);
    if (atv && h.states[atv]) {
      this._vibra();
      if (h.states[atv].state === "off") return h.callService("media_player", "turn_on", { entity_id: atv });
      return this._info(atv);
    }
    const e = this._entDi(k); if (!e) return;
    const s = h.states[e], d = e.split(".")[0];
    if (!s || s.state === "unavailable") return this._info(e);
    this._vibra();
    if (d === "button") return h.callService("button", "press", { entity_id: e }); // es. macchina del caffè (SwitchBot)
    if (d === "light" || d === "switch" || d === "fan" || d === "input_boolean") {
      // risposta immediata su tutte le parti comandate dalla stessa entità (es. la scala: metà nel modello del piano terra,
      // metà in quello del primo piano), non solo su quella toccata
      if (this._m && this._m.ottimista) { const acc = s.state !== "on"; this._m.ottimista(k, acc); for (const [k2, e2] of Object.entries(this._ent || {})) if (k2 !== k && e2 === e) this._m.ottimista(k2, acc); }
      return h.callService(d, "toggle", { entity_id: e }); }
    if (d === "cover") {
      const p = s.attributes.current_position, aperta = p != null ? p > 0 : s.state !== "closed";
      return h.callService("cover", aperta ? "close_cover" : "open_cover", { entity_id: e });
    }
    // serratura: un tocco blocca la porta se è sbloccata; per sbloccare si passa dalla finestra di HA
    if (d === "lock") return s.state === "unlocked" ? h.callService("lock", "lock", { entity_id: e }) : this._info(e);
    if (d === "binary_sensor") return this._info(e);
    // robot aspirapolvere: un tocco lo fa partire; se sta pulendo, lo rimanda alla base
    if (d === "vacuum") return h.callService("vacuum", /^(cleaning|returning)$/.test(s.state) ? "return_to_base" : "start", { entity_id: e });
    if (d === "media_player" && k.startsWith("media:")) return h.callService("media_player", "media_play_pause", { entity_id: e });
    this._info(e);
  }
  _lungo(k) { const e = this._entDi(k); if (e) { this._vibra(); this._info(e); } }

  // sfondo della mappa come il cielo: chiaro e arioso di giorno, blu profondo di notte, sfumato all'alba e al tramonto
  _giorno(h) {
    this._leggiLuce();
    // pulsante Auto / Giorno / Sera nell'angolo della mappa: Giorno e Sera fissano la luce, Auto segue il sole di HA
    if (this._modoLuce === "giorno") return 1;
    if (this._modoLuce === "sera") return 0;
    const sole = h && h.states["sun.sun"], el = sole ? Number(sole.attributes.elevation) : NaN;
    return !sole ? 1 : Number.isFinite(el) ? Math.round(Math.min(1, Math.max(0, (el + 6) / 12)) * 20) / 20 : (sole.state === "above_horizon" ? 1 : 0);
  }
  // giorno/sera: cielo della mappa, sfondo della dashboard e schede di HA passano insieme, con una sfumatura di 0,6 secondi
  _cielo(g) {
    if (this._g === g || !this._box) return;
    const da = this._gv ?? g; this._g = g; cancelAnimationFrame(this._gAnim);
    if (da === g) { this._gv = g; this._applicaLuce(g); return; }
    const t0 = performance.now(), DUR = 600, ease = (t) => t * t * (3 - 2 * t);
    const passo = (now) => { const t = Math.min(1, (now - t0) / DUR); this._gv = da + (g - da) * ease(t); this._applicaLuce(this._gv);
      if (t < 1) this._gAnim = requestAnimationFrame(passo); };
    this._gAnim = requestAnimationFrame(passo);
  }
  _applicaLuce(g) {
    const mix = (a, b) => "rgb(" + a.map((x, i) => Math.round(b[i] + (x - b[i]) * g)).join(",") + ")";
    const st = this._box.style;
    st.setProperty("--cielo-alto", mix([214, 230, 244], [16, 24, 44]));
    st.setProperty("--cielo-basso", mix([240, 236, 228], [8, 11, 18]));
    st.setProperty("--cielo-alone", mix([255, 248, 232], [34, 46, 78]));
    this._box.classList.toggle("di-giorno", g >= 0.5);
    this._sfondo(mix([240, 236, 228], [8, 11, 18]));
    this._temaSera(1 - g);
  }
  // di sera anche le schede native di HA della dashboard diventano scure (colori del tema scuro, nella tinta della notte della
  // piantina). s = quanto è sera (0..1): i colori del tema dell'utente sfumano verso quelli scuri; a giorno pieno, o quando la
  // scheda esce dalla dashboard, i colori tornano quelli del tema
  _temaSera(s) {
    const dove = this._sfondoSu; if (!dove) return;
    if (!(s > 0.001)) { for (const [k] of TEMA_SERA) dove.style.removeProperty(k); dove.style.removeProperty("color-scheme"); return; }
    if (!this._temaGiorno || this._temaGiornoSu !== dove) { // colori del tema di giorno, letti senza i nostri
      for (const [k] of TEMA_SERA) dove.style.removeProperty(k);
      const cs = getComputedStyle(dove); this._temaGiorno = {}; this._temaGiornoSu = dove;
      for (const [k] of TEMA_SERA) this._temaGiorno[k] = cs.getPropertyValue(k).trim(); }
    for (const [k, v] of TEMA_SERA) { const d = this._temaGiorno[k]; const m = mixColore(d, v, s); if (m) dove.style.setProperty(k, m); else if (d && s >= 0.5) dove.style.setProperty(k, v); else dove.style.removeProperty(k); }   // variabile non usata dal tema: la lascio stare (vale quella da cui dipende)
    if (s >= 0.5) dove.style.setProperty("color-scheme", "dark"); else dove.style.removeProperty("color-scheme");
  }
  // colora lo sfondo della vista di Home Assistant (variabile del tema lovelace-background sul contenitore della dashboard;
  // nella pagina di prova il body). Solo per la dashboard che contiene la scheda; tolto quando la scheda esce.
  _sfondo(col) {
    if (!this._fondi) return;
    let n = this, dove = null;
    while (n) { if (n.tagName && /^(HUI-ROOT|HA-PANEL-LOVELACE)$/.test(n.tagName)) dove = n; n = n.parentNode || n.host; }
    dove = dove || document.body;
    // all'avvio la scheda può non essere ancora dentro la dashboard (allora finiva sul body): quando cambia posto,
    // tolgo dal posto vecchio sfondo e colori della sera, altrimenti restavano lì e sembravano il tema di giorno
    if (this._sfondoSu && this._sfondoSu !== dove) { const v = this._sfondoSu.style;
      for (const k of ["--lovelace-background", "--casa3d-sfondo", "color-scheme", ...TEMA_SERA.map((x) => x[0])]) v.removeProperty(k);
      this._temaGiorno = null; }
    this._sfondoSu = dove;
    dove.style.setProperty("--lovelace-background", col); dove.style.setProperty("--casa3d-sfondo", col);
  }

  // dagli stati di HA allo stato del modello 3D (solo quando cambia qualcosa che si vede)
  _aggiorna() {
    const h = this._hass; if (!h || !this._m) return;
    const S = h.states, luci = {}, colori = {}, tende = {}, teli = {}, tv = {};
    const chiavi = new Set([...Object.keys(this._ent), ...PIANI.flatMap((p) => Object.keys((this._meta[p] || VUOTO).ent))]);
    // giorno/notte segue l'altezza del sole: alba e tramonto sfumano (da -6° a +6°) invece di scattare
    const giorno = this._giorno(h);
    this._cielo(giorno);
    let firma = "g" + giorno;
    for (const k of chiavi) {
      const e = this._entDi(k); if (!e) continue;
      const s = S[e]; firma += "|" + (s ? s.state + (s.attributes.brightness ?? "") + (s.attributes.rgb_color || "") + (s.attributes.current_position ?? "") : "-");
      const d = e.split(".")[0];
      if (k.startsWith("tenda:")) { tende[k.slice(6)] = s && s.attributes.current_position != null ? s.attributes.current_position / 100 : s && s.state === "closed" ? 0 : 1; continue; }
      if (k.startsWith("telo:")) { const p = s && s.attributes.current_position != null ? s.attributes.current_position / 100 : s && s.state === "closed" ? 0 : 1; teli[k.slice(5)] = 1 - p; continue; }
      if (k.startsWith("media:")) { luci[k] = s && s.state === "playing" ? 1 : 0; continue; }
      if (d === "light") {
        const on = s && s.state === "on", b = s && s.attributes.brightness;
        luci[k] = on ? 0.25 + 0.75 * (b != null ? b / 255 : 1) : 0;
        colori[k] = on && s.attributes.rgb_color ? s.attributes.rgb_color : null;
        continue;
      }
      luci[k] = acceso(s) ? 1 : 0;
    }
    // TV: acceso se lo è la TV o la sua Apple TV; lo schermo mostra film, Home o (Frame) il quadro
    for (const [k, src] of Object.entries(this._tv)) {
      const t = S[this._ent[k]], a = S[src];
      const arte = !!t && t.attributes.art_mode_status === "on";
      firma += "|" + (a ? a.state : "-") + (arte ? "A" : "");
      const aOn = acceso(a);
      if (aOn || arte) luci[k] = 1;
      // la Frame in modalità Arte per HA è "spenta", ma sullo schermo c'è il quadro
      tv[k] = a && a.state === "playing" ? "film" : aOn ? "menu" : arte ? "arte" : "menu";
    }
    // porte che si muovono col loro sensore (aperta = 1); senza sensore restano aperte come nel modello
    const porte = {};
    for (const [k, e] of Object.entries(PORTE)) { const s = S[e]; firma += "|p" + (s ? s.state : "-"); porte[k] = s && s.state === "off" ? 0 : 1; }
    const valori = {};
    for (const [t, e] of SEGNALI) {
      const s = S[e]; firma += "|" + (s ? s.state : "-");
      // robot: icona accesa mentre pulisce o torna alla base. Temperatura: il numero dentro l'icona, mai "accesa"
      if (t === "robot") { luci[t + ":" + e] = s && /^(cleaning|returning)$/.test(s.state) ? 1 : 0; continue; }
      if (t === "temperatura" || t === "umidita") { const n = s ? Number(s.state) : NaN; valori[t + ":" + e] = isNaN(n) ? "–" : n.toLocaleString((this._hass.locale && this._hass.locale.language) || "it", { maximumFractionDigits: t === "umidita" ? 0 : 1 }) + (t === "umidita" ? "%" : "°"); luci[t + ":" + e] = 0; continue; }
      // elettrodomestici: "in funzione" qualunque stato che non sia fermo (lavaggio, centrifuga, cottura, running...)
      if (t === "elettrodomestico") { luci[t + ":" + e] = s && !FERMO.test(s.state) ? 1 : 0; continue; }
      if (t === "media") { luci[t + ":" + e] = s && s.state === "playing" ? 1 : 0; continue; }
      if (t === "clima") { luci[t + ":" + e] = s && !SPENTO.has(s.state) ? 1 : 0; continue; }
      if (t === "camera") { luci[t + ":" + e] = 0; continue; }
      luci[t + ":" + e] = s && (t === "pianta" ? Number(s.state) < (SOGLIA_SETE[e] ?? 20) : t === "serratura" ? s.state === "unlocked" || s.state === "open" : s.state === "on") ? 1 : 0;
    }
    if (firma === this._firma) return;
    this._firma = firma;
    this._m.stato({ luci, colori, tende, teli, tv, giorno, porte, valori });
  }
}

// la scheda vera si chiama casa3d-card-full: la carica casa3d-card.js (leggero) solo quando serve
if (!customElements.get("casa3d-card-full")) customElements.define("casa3d-card-full", Casa3dCard);
console.info("%c CASA3D-CARD %c " + VERSIONE + " ", "background:#FFDE59;color:#111;font-weight:700", "background:#FF914D;color:#111");
