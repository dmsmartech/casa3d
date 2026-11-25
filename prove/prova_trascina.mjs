// Prova: trascinamento "rimasto appeso" col mouse (rilascio perso fuori dalla mappa o fuori dalla finestra).
// Dopo un "tasto giù" senza "tasto su", un movimento del mouse SENZA tasti non deve far girare la casa.
// Controprova: un trascinamento vero (tasto premuto) deve ancora girarla.
// Uso: (in scheda_ha/dist) python3 -m http.server 8767 ; poi qui: node prova_trascina.mjs
import { webkit } from "playwright";
import { PAGINA } from "./comune.mjs";
const b = await webkit.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 1024 } });
await p.goto(PAGINA); await p.waitForTimeout(12000);
const r = await p.evaluate(async () => {
  const z = (ms) => new Promise((o) => setTimeout(o, ms));
  const m = window.prova.card._in._m, cv = m._r.domElement, cam = m._cam;
  const angolo = () => Math.atan2(cam.position.x, cam.position.z);
  const rc = cv.getBoundingClientRect(), cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2;
  const ev = (t, x, y, buttons) => cv.dispatchEvent(new PointerEvent(t, { pointerId: 1, pointerType: "mouse", isPrimary: true, clientX: x, clientY: y, button: 0, buttons, bubbles: true, cancelable: true, composed: true }));
  const out = {};
  await z(3000); const a0 = angolo();
  ev("pointerdown", cx, cy, 1);                                   // tasto premuto sulla mappa
  for (let i = 1; i <= 3; i++) { ev("pointermove", cx + i * 20, cy, 1); await z(30); } // si trascina un poco
  await z(2500); const a1 = angolo();                              // ...poi il tasto viene rilasciato fuori: nessun "tasto su"
  for (let i = 1; i <= 15; i++) { ev("pointermove", cx + 60 + i * 25, cy, 0); await z(30); } // il cursore torna e si muove senza tasti
  await z(2500); const a2 = angolo();
  out.giro_col_tasto = +(a1 - a0).toFixed(3);
  out.giro_senza_tasto = +(a2 - a1).toFixed(3);
  ev("pointerdown", cx, cy, 1); for (let i = 1; i <= 15; i++) { ev("pointermove", cx + i * 25, cy, 1); await z(30); } ev("pointerup", cx + 375, cy, 0);
  await z(2500); out.controprova = +(angolo() - a2).toFixed(3);
  return out;
});
console.log(JSON.stringify(r));
const ok = Math.abs(r.giro_senza_tasto) < 0.005 && Math.abs(r.controprova) > 0.05;
console.log(ok ? "ESITO: OK (senza tasto la casa resta ferma, col tasto gira)" : "ESITO: DA SISTEMARE");
await b.close();
