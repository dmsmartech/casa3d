// Prova: nomi delle stanze nella vista casa mentre la casa gira, trascinando col mouse come farebbe una persona
// (un giro completo a piccoli passi, lettura a casa ferma). Controlla:
// (1) i nomi visibili non si sovrappongono; (2) nessun nome salta lontano tra un passo e l'altro;
// (3) quanti nomi spariscono per mancanza di posto (le stanze piccole possono, le grandi no).
// Uso: (in scheda_ha/dist) python3 -m http.server 8767 ; poi qui: node prova_etichette.mjs
import { webkit } from "playwright";
import { PAGINA } from "./comune.mjs";
const b = await webkit.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 1024 } });
const errori = []; p.on("pageerror", (e) => errori.push(String(e.message).slice(0, 160)));
await p.goto(PAGINA); await p.waitForTimeout(14000);
const r = await p.evaluate(async () => {
  const z = (ms) => new Promise((o) => setTimeout(o, ms));
  const i = window.prova.card._in, m = i._m, cv = m._r.domElement, cam = m._cam, root = i.shadowRoot;
  const rc = cv.getBoundingClientRect(), cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2;
  const ev = (t, x, buttons) => cv.dispatchEvent(new PointerEvent(t, { pointerId: 1, pointerType: "mouse", isPrimary: true, clientX: x, clientY: cy, button: 0, buttons, bubbles: true, cancelable: true, composed: true }));
  const angolo = () => Math.atan2(cam.position.x, cam.position.z);
  const fermo = async () => { let a = angolo(); for (let n = 0; n < 40; n++) { await z(100); const b = angolo(); if (Math.abs(b - a) < 0.0005) return; a = b; } };
  const leggi = () => [...root.querySelectorAll(".tre-stanza")].map((d) => { const q = d.getBoundingClientRect();
    return { nome: d.textContent.replace(/\d+$/, "").trim(), x: q.left + q.width / 2, y: q.top + q.height / 2, w: q.width, h: q.height, vis: getComputedStyle(d).visibility !== "hidden" && d.style.opacity !== "0" }; });
  const out = { passi: 0, giro_gradi: 0, sovrapposte: 0, salto_max_px: 0, salto_peggiore: "", nascoste: {} };
  const a0 = angolo(); let prima = null, tot = 0, prec = a0;
  while (Math.abs(tot) < 2 * Math.PI && out.passi < 120) {
    ev("pointerdown", cx, 1); for (let k = 1; k <= 4; k++) { ev("pointermove", cx + k * 5, 1); await z(16); } ev("pointerup", cx + 20, 0);
    await fermo(); out.passi++;
    const a = angolo(); let d = a - prec; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; tot += d; prec = a;
    const et = leggi(), vis = et.filter((e) => e.vis);
    for (let x = 0; x < vis.length; x++) for (let y = x + 1; y < vis.length; y++) { const A = vis[x], B = vis[y];
      // un contatto fino a 6 px è tollerato apposta (a occhio non si vede)
      if (Math.abs(A.x - B.x) < (A.w + B.w) / 2 - 7 && Math.abs(A.y - B.y) < (A.h + B.h) / 2 - 7) out.sovrapposte++; }
    for (const e of et) if (!e.vis) out.nascoste[e.nome] = (out.nascoste[e.nome] || 0) + 1;
    if (prima) for (const e of vis) { const q = prima.find((x) => x.nome === e.nome && x.vis); if (!q) continue;
      const s = Math.hypot(e.x - q.x, e.y - q.y); if (s > out.salto_max_px) { out.salto_max_px = Math.round(s); out.salto_peggiore = e.nome + " al passo " + out.passi; } }
    prima = et;
  }
  out.giro_gradi = Math.round(Math.abs(tot) * 180 / Math.PI);
  return out;
});
console.log(JSON.stringify(r, null, 1));
console.log("errori:", errori.length ? errori : "nessuno");
const grandi = ["Soggiorno", "Pranzo", "Cucina"].filter((n) => (r.nascoste[n] || 0) > 0);
console.log(!errori.length && r.sovrapposte === 0 && r.salto_max_px < 90 && !grandi.length ? "ESITO: OK" : "ESITO: DA SISTEMARE" + (grandi.length ? " (nascoste stanze grandi: " + grandi + ")" : ""));
await b.close();
