// Casa 3D Casappletech: scheda per le dashboard di Home Assistant (caricatore leggero).
// HA carica le risorse su OGNI dashboard, anche sui pannelli a muro: questo file pesa pochi KB
// e scarica la piantina vera (Three.js, ~650 KB) solo dove la scheda è davvero presente.
const BASE = new URL("./", import.meta.url).href;
const FULL = typeof __CASA3D_FULL__ !== "undefined" ? __CASA3D_FULL__ : String(Date.now());
let carica = null;

class Casa3dCard extends HTMLElement {
  setConfig(c) { this._c = c; if (this._in) this._in.setConfig(c); }
  set hass(h) { this._h = h; if (this._in) this._in.hass = h; else this._avvia(); }
  get hass() { return this._h; }
  connectedCallback() { this.style.display = "block"; this._avvia(); }
  _avvia() {
    if (this._in || this._parte || !this.isConnected || !this._c) return;
    this._parte = true;
    carica = carica || import(BASE + "casa3d-full.js?v=" + FULL);
    carica.then(() => {
      const e = document.createElement("casa3d-card-full");
      e.setConfig(this._c); if (this._h) e.hass = this._h;
      this._in = e; this.append(e);
    }).catch((err) => { this._parte = false; carica = null; console.error("casa3d-card: piantina non caricata", err); });
  }
  getCardSize() { return 8; }
  getGridOptions() { return { columns: 12, rows: 8, min_columns: 6, min_rows: 5 }; }
  static getStubConfig() { return {}; }
  // modulo nell'editor della scheda di HA: si regola la vista senza aprire casa.config.js.
  // Un campo vuoto = vale quello scritto in casa.config.js.
  static getConfigForm() {
    const num = (min, max, step, unit) => ({ number: { min, max, step, mode: "box", unit_of_measurement: unit } });
    return {
      schema: [
        { name: "altezza", selector: { text: {} } },
        { name: "riempi", selector: { boolean: {} } },
        { name: "barra_in_basso", selector: { boolean: {} } },
        { name: "sfondo_dashboard", selector: { boolean: {} } },
        { name: "rotazione_libera", selector: { boolean: {} } },
        { name: "gradi_per_lato", selector: num(10, 180, 5, "°") },
        { name: "angolo_casa", selector: num(-180, 180, 1, "°") },
        { name: "inclinazione_casa", selector: num(0, 70, 1, "°") },
        { name: "zoom_casa", selector: num(0.5, 2, 0.05, "×") },
        { name: "altezza_etichette", selector: num(0.2, 3, 0.05, "m") },
        { name: "attenua_stanze", selector: num(0, 1, 0.05) },
        { name: "colore_selezioni", selector: { color_rgb: {} } },
        { name: "tende_chiuse", selector: num(0.5, 6, 0.1, "m") },
      ],
      computeLabel: (s) => ({
        altezza: "Altezza della piantina (es. 600px o 70vh)",
        riempi: "Riempi tutto lo schermo",
        barra_in_basso: "Sul telefono: barra delle stanze in basso",
        sfondo_dashboard: "Sfondo della dashboard come il cielo della piantina",
        rotazione_libera: "Vista casa: gira tutto intorno",
        gradi_per_lato: "Vista casa: quanto può girare per lato",
        angolo_casa: "Vista casa: da che lato si guarda",
        inclinazione_casa: "Vista casa: quanto dall'alto",
        zoom_casa: "Vista casa: vicinanza",
        altezza_etichette: "Altezza dei nomi delle stanze sopra il pavimento",
        attenua_stanze: "Quanto si attenuano le altre stanze quando ne apri una",
        colore_selezioni: "Colore delle selezioni",
        tende_chiuse: "Larghezza delle tende da chiuse",
      })[s.name],
      computeHelper: (s) => ({
        barra_in_basso: "Spento (di serie) = sempre in alto. Acceso = in basso sugli schermi stretti, a portata di pollice.",
        sfondo_dashboard: "Acceso (di serie) = la dashboard prende il colore del cielo (chiaro di giorno, blu notte di sera) e la piantina ci si fonde, senza bordo. Spento = sfondo del tema.",
        gradi_per_lato: "Vale solo se 'gira tutto intorno' è spento. Vuoto = come in casa.config.js.",
        angolo_casa: "0° = di fronte. Si applica ricaricando la pagina.",
        inclinazione_casa: "0° = dritto dall'alto, 60° = quasi di lato. Si applica ricaricando la pagina.",
        zoom_casa: "1 = automatico; 1,2 = più vicina. Si applica ricaricando la pagina.",
        altezza_etichette: "I muri sono tagliati a 1,15 m: sopra questo valore il nome sta sopra la stanza.",
        attenua_stanze: "0 = restano come sono, 1 = più scure e quasi grigie (di serie).",
        colore_selezioni: "Stanza scelta nella barra, bordo e numero di luci accese sui nomi delle stanze. Vale anche per l'anello del caricamento. Vuoto = giallo (di serie). Il giallo delle luci accese non cambia.",
        tende_chiuse: "Si applica ricaricando la pagina. Per una tenda sola usa motore.tende_chiuse nel YAML.",
      })[s.name],
    };
  }
}
if (!customElements.get("casa3d-card")) customElements.define("casa3d-card", Casa3dCard);
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "casa3d-card"))
  window.customCards.push({ type: "casa3d-card", name: "Casa 3D Casappletech", description: "Piantina 3D interattiva della casa: tocca per accendere, tieni premuto per i comandi di HA.", preview: false });

// --- Telecamera Casappletech: foto subito, diretta che appare sopra appena il video scorre ---
// Le schede picture-entity "live" restavano nere finché il flusso non partiva (fino a 5 s) e aprivano 13 dirette insieme:
// qui la foto compare all'istante, le dirette partono poche alla volta (prima quelle visibili) e si fermano fuori schermo.
const TOUCH_T = matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 1 && !matchMedia("(hover: hover)").matches);
const MAX_AVVII = TOUCH_T ? 4 : 6; let avviiInCorso = 0; const attesa = [];
const prossimo = () => { while (avviiInCorso < MAX_AVVII && attesa.length) { const f = attesa.shift(); avviiInCorso++; f(() => { avviiInCorso--; prossimo(); }); } };
class Casa3dTelecamera extends HTMLElement {
  setConfig(c) { if (!c || !c.entity) throw new Error("Serve entity"); this._c = c; if (this._r) this._nome(); }
  set hass(h) { this._h = h; if (!this._r) this._crea(); this._foto(false); if (this._live) this._live.hass = h; }
  get hass() { return this._h; }
  getCardSize() { return 4; }
  getGridOptions() { return { columns: 12, min_columns: 4 }; }
  _crea() {
    const r = (this._r = this.attachShadow({ mode: "open" }));
    r.innerHTML = `<style>
      :host { display: block; }
      ha-card { position: relative; overflow: hidden; aspect-ratio: 16 / 9; background: #15171b; cursor: pointer; -webkit-tap-highlight-color: transparent; }
      img.foto { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity .25s; }
      img.foto.ok { opacity: 1; }
      .live { position: absolute; inset: 0; opacity: 0; transition: opacity .4s; pointer-events: none; }
      .live.on { opacity: 1; }
      .nome { position: absolute; left: 0; right: 0; bottom: 0; padding: 18px 12px 9px; color: #fff; font-weight: 600; font-size: 14px; text-align: center; background: linear-gradient(transparent, rgba(0,0,0,.6)); pointer-events: none; }
      .dot { position: absolute; top: 10px; left: 10px; display: none; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 999px; background: rgba(0,0,0,.55); color: #fff; font-size: 11px; font-weight: 700; pointer-events: none; }
      .dot i { width: 7px; height: 7px; border-radius: 50%; background: #ff4d4d; }
      .live.on ~ .dot { display: flex; }
    </style><ha-card><img class="foto" alt=""><div class="live"></div><span class="dot"><i></i>LIVE</span><div class="nome"></div></ha-card>`;
    this._img = r.querySelector("img.foto"); this._box = r.querySelector(".live");
    this._img.addEventListener("load", () => this._img.classList.add("ok"));
    this._nome();
    r.querySelector("ha-card").addEventListener("click", () => this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: (this._c.tap_action && this._c.tap_action.entity) || this._c.entity } }))); // in alta qualità se indicata
    this._io = new IntersectionObserver((v) => { this._vis = v[v.length - 1].isIntersecting; if (this._vis) { clearTimeout(this._tStop); this._chiedi(); } else { clearTimeout(this._tStop); this._tStop = setTimeout(() => this._ferma(), 5000); } }, { rootMargin: "100px 0px" });
    this._io.observe(this);
  }
  _nome() { const s = this._h && this._h.states[this._c.entity]; const n = this._r && this._r.querySelector(".nome"); if (n) n.textContent = this._c.name || (s && s.attributes.friendly_name) || this._c.entity; }
  // foto: subito al primo giro, poi ogni 10 s finché la diretta non c'è
  _foto(forza) {
    const s = this._h && this._h.states[this._c.entity]; if (!s || !s.attributes.entity_picture) return;
    const ora = Date.now(); if (!forza && this._tFoto && (this._liveOn || ora - this._tFoto < 10000)) return;
    this._tFoto = ora; const u = s.attributes.entity_picture; this._img.src = u + (u.includes("?") ? "&" : "?") + "t=" + ora;
    this._nome();
  }
  _chiedi() {
    if (this._live || this._inCoda || !this._h) return; this._inCoda = true;
    attesa.push((libera) => {
      this._inCoda = false;
      if (!this._vis || !this.isConnected) { libera(); return; }
      this._avvia(libera);
    });
    prossimo();
  }
  async _avvia(libera) {
    let liberato = false; const lib = () => { if (!liberato) { liberato = true; libera(); } };
    try {
      const helpers = await window.loadCardHelpers();
      const el = helpers.createCardElement({ type: "picture-entity", entity: this._c.entity, camera_view: "live", aspect_ratio: "16:9", fit_mode: "cover", show_name: false, show_state: false, tap_action: { action: "none" }, hold_action: { action: "none" } });
      el.hass = this._h; this._live = el; this._box.append(el);
      // la diretta appare quando il video scorre davvero (o quando arriva un'immagine MJPEG)
      const t0 = Date.now();
      const guarda = () => {
        if (this._live !== el) { lib(); return; }
        let v = null; const giu = (n) => { for (const e of n.querySelectorAll("*")) { if (e.tagName === "VIDEO") v = e; if (e.shadowRoot) giu(e.shadowRoot); } }; giu(el.shadowRoot || el);
        if (v && !v.paused && v.currentTime > 0.1) { this._liveOn = true; this._box.classList.add("on"); lib(); return; }
        if (Date.now() - t0 > 1200) lib(); // dopo 1,2 s parte la prossima: la diretta, quando arriva, appare lo stesso
        setTimeout(guarda, 200);
      };
      guarda();
    } catch (e) { lib(); }
  }
  _ferma() { if (this._vis) return; if (this._live) { this._live.remove(); this._live = null; } this._liveOn = false; this._box.classList.remove("on"); this._foto(true); }
  disconnectedCallback() { clearTimeout(this._tStop); this._tStop = setTimeout(() => { if (!this.isConnected) { this._vis = false; this._ferma(); } }, 1000); }
  connectedCallback() { if (this._io) { this._io.unobserve(this); this._io.observe(this); } }
}
if (!customElements.get("casa3d-telecamera")) customElements.define("casa3d-telecamera", Casa3dTelecamera);
if (!window.customCards.some((c) => c.type === "casa3d-telecamera"))
  window.customCards.push({ type: "casa3d-telecamera", name: "Telecamera Casappletech", description: "Foto subito, diretta che appare sopra appena parte; dirette fuori schermo fermate.", preview: false });
