// Prova: se sono già in una vista (Casa o una stanza) e la richiedo di nuovo, l'animazione NON deve ripartire.
// Se invece mi sono spostato (ho girato la casa), deve ripartire e riportarmi nella vista.
// Uso: (in scheda_ha/dist) python3 -m http.server 8767 ; poi qui: node prova_stessa_vista.mjs
import { webkit } from "playwright";
import { PAGINA } from "./comune.mjs";
const b = await webkit.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 1024 } });
await p.goto(PAGINA); await p.waitForTimeout(12000);
const r = await p.evaluate(async () => {
  const z = (ms) => new Promise((o) => setTimeout(o, ms));
  const i = window.prova.card._in, m = i._m, cv = m._r.domElement, rc = cv.getBoundingClientRect();
  const cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2;
  const ev = (t, x, buttons) => cv.dispatchEvent(new PointerEvent(t, { pointerId: 1, pointerType: "mouse", isPrimary: true, clientX: x, clientY: cy, button: 0, buttons, bubbles: true, cancelable: true, composed: true }));
  const out = {};
  // una stanza qualsiasi della casa (la prima dell'elenco, giardino escluso)
  const st = Object.values(i._meta).flatMap((x) => Object.keys((x && x.stanze) || {})).filter((k) => k !== "esterno")[0];
  i._vai(null); await z(4000);
  i._vai(null); await z(50); out.casa_di_nuovo_anima = !!m._volo();             // deve essere false
  i._vai(st); await z(5000);
  i._vai(st); await z(50); out.stanza_di_nuovo_anima = !!m._volo();             // deve essere false
  i._vai(null); await z(200); i._vai(null); await z(50); out.casa_durante_volo_ok = !!m._volo(); // il volo in corso continua
  await z(4000);
  ev("pointerdown", cx, 1); for (let k = 1; k <= 10; k++) { ev("pointermove", cx + k * 20, 1); await z(16); } ev("pointerup", cx + 200, 0);
  await z(3000);
  i._vai(null); await z(50); out.casa_dopo_giro_anima = !!m._volo();             // deve essere true
  return out;
});
console.log(JSON.stringify(r));
const ok = !r.casa_di_nuovo_anima && !r.cucina_di_nuovo_anima && r.casa_durante_volo_ok && r.casa_dopo_giro_anima;
console.log(ok ? "ESITO: OK" : "ESITO: DA SISTEMARE");
await b.close();
