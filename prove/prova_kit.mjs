// Prova completa sulla pagina di prova (senza Home Assistant): caricamento, gesti in ogni stanza, tocchi sicuri,
// grafica persa. Uso: (in scheda_ha/dist) python3 -m http.server 8767 ; poi qui: node prova_kit.mjs [ipad11|ipad13]
// Numeri da rispettare: nessun errore, fotogramma massimo < 50 ms, programmi grafici sempre uguali, tocchi 2-5 = 0 comandi.
import { apri, PAGINA } from "./comune.mjs";
const { b, p, errori } = await apri(process.argv[2]);
await p.goto(PAGINA); await p.waitForTimeout(15000);
const r = await p.evaluate(async () => {
  const z = (ms) => new Promise((o) => setTimeout(o, ms)), raf = () => new Promise((o) => requestAnimationFrame(o));
  const i = window.prova.card._in, m = i._m, cv = m._r.domElement;
  cv.setPointerCapture = () => {}; cv.releasePointerCapture = () => {}; cv.hasPointerCapture = () => true;
  const ev = (t, id, x, y, el = cv) => el.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: "touch", clientX: x, clientY: y, bubbles: true, cancelable: true, composed: true, isPrimary: id === 11, button: 0, buttons: t === "pointerup" ? 0 : 1 }));
  const out = { stanze: {} };
  // stanze di tutti i piani, dal basso verso l'alto (i piani hanno nomi liberi: terra, sopra, taverna, primo...)
  const stanze = Object.values(i._meta).flatMap((m) => Object.keys((m && m.stanze) || {})).filter((k) => k !== "esterno");
  const prog0 = m._r.info.programs.length;
  for (const k of stanze) {
    i._vai(k); await z(1500);
    const rc = cv.getBoundingClientRect(), cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2;
    const fr = []; let last = performance.now(); const tk = async () => { await raf(); const n = performance.now(); fr.push(n - last); last = n; };
    ev("pointerdown", 11, cx - 40, cy); ev("pointerdown", 12, cx + 40, cy);
    for (let n = 0; n < 40; n++) { const d = 40 + n * 4; ev("pointermove", 11, cx - d, cy); ev("pointermove", 12, cx + d, cy); await tk(); }
    ev("pointerup", 11, cx, cy); ev("pointerup", 12, cx, cy); for (let n = 0; n < 10; n++) await tk();
    ev("pointerdown", 11, cx, cy); for (let n = 0; n < 40; n++) { ev("pointermove", 11, cx + n * 5, cy + n); await tk(); }
    ev("pointerup", 11, cx + 200, cy); for (let n = 0; n < 10; n++) await tk();
    out.stanze[k] = { max_ms: Math.round(Math.max(...fr)), sopra33: fr.filter((x) => x > 33).length, programmi: m._r.info.programs.length };
  }
  out.programmi_fissi = Object.values(out.stanze).every((s) => s.programmi === out.stanze[stanze[stanze.length - 1]].programmi);
  // tocchi: un tocco normale su un'icona deve comandare; un pizzico o un tocco durante il volo no
  // la vista deve essere ferma: dopo i gesti di prova il volo verso la stanza dura 3-5 s, e la protezione dai tocchi
  // accidentali scarta (giustamente) un tocco fatto prima. Con 2,5 s il test falliva anche sulla casa d'esempio.
  i._vai(stanze[0]); await z(6000);
  const log = () => document.getElementById("log").textContent.split("\n").filter((x) => x.startsWith("callService")).length;
  const icona = i.shadowRoot.querySelector(".tre-luce:not(.avviso)");
  if (icona) {
    const r = icona.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    let n0 = log(); const t0 = performance.now(); ev("pointerdown", 21, x, y, icona); ev("pointerup", 21, x, y, icona); icona.click(); out.primo_tocco_ms = Math.round(performance.now() - t0); await z(400); out.tocco_normale = log() - n0;
    n0 = log(); ev("pointerdown", 31, x, y, icona); ev("pointerdown", 32, x + 120, y); ev("pointerup", 32, x + 120, y); icona.click(); await z(400); out.tocco_durante_pizzico = log() - n0; ev("pointerup", 31, x, y, icona);
    await z(800); n0 = log(); i._vai(stanze[1] || null); await z(80); icona.click(); await z(400); out.tocco_durante_volo = log() - n0;
  }
  // grafica tolta e restituita: deve restare la stessa mappa, un solo canvas
  const m0 = i._m, ext = m0._r.getContext().getExtension("WEBGL_lose_context");
  ext.loseContext(); await z(1500); ext.restoreContext(); await z(4000);
  out.grafica_tornata = { stessa_mappa: i._m === m0, canvas: i.shadowRoot.querySelectorAll("canvas").length };
  return out;
});
console.log(JSON.stringify(r, null, 1));
console.log("errori:", errori.length ? errori : "nessuno");
const ok = !errori.length && r.programmi_fissi && Object.values(r.stanze).every((s) => s.max_ms < 50) && (r.tocco_normale ?? 1) === 1 && !r.tocco_durante_pizzico && !r.tocco_durante_volo && r.grafica_tornata.stessa_mappa && r.grafica_tornata.canvas === 1;
console.log(ok ? "ESITO: OK" : "ESITO: DA SISTEMARE");
await b.close();
