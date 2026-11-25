// Prova: dentro una stanza, un doppio tocco sul vuoto fuori dalla casa riporta alla vista "Casa".
// Un tocco singolo sul vuoto, o un doppio tocco sulla casa, non devono uscire dalla stanza.
// Uso: (in scheda_ha/dist) python3 -m http.server 8767 ; poi qui: node prova_doppio_tocco.mjs
import { webkit } from "playwright";
import { PAGINA } from "./comune.mjs";
const b = await webkit.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 1024 } });
await p.goto(PAGINA); await p.waitForTimeout(12000);
const r = await p.evaluate(async () => {
  const z = (ms) => new Promise((o) => setTimeout(o, ms));
  const i = window.prova.card._in, cv = i._m._r.domElement, rc = cv.getBoundingClientRect();
  const tocco = (x, y) => { for (const t of ["pointerdown", "pointerup"]) cv.dispatchEvent(new PointerEvent(t, { pointerId: 1, pointerType: "mouse", isPrimary: true, clientX: x, clientY: y, button: 0, buttons: t === "pointerdown" ? 1 : 0, bubbles: true, cancelable: true, composed: true })); };
  // "vuoto" = il cielo in alto al centro (l'angolo in basso può cadere sul giardino, che fa parte della casa)
  const vuoto = [rc.left + rc.width / 2, rc.top + 30], centro = [rc.left + rc.width / 2, rc.top + rc.height / 2];
  const out = {};
  // stanze della casa dalla più grande alla più piccola (giardino escluso)
  const ST = Object.values(i._meta).flatMap((x) => Object.entries((x && x.stanze) || {})).filter(([k]) => k !== "esterno")
    .map(([k, v]) => [k, (v.box[3] - v.box[0]) * (v.box[5] - v.box[2])]).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const S1 = ST[0];
  i._vai(S1); await z(5000);
  tocco(...vuoto); await z(900); out.tocco_singolo_vuoto = i._focus;             // deve restare S1
  tocco(...centro); await z(120); tocco(...centro); await z(1500); out.doppio_sulla_casa = i._focus; // non deve uscire
  i._vai(S1); await z(5000);
  tocco(...vuoto); await z(150); tocco(...vuoto); await z(1500); out.doppio_vuoto = i._focus;    // deve tornare a null (Casa)
  // stanze piccole viste da vicino (le tre più piccole), doppio clic sul cielo in alto
  for (const st of ST.slice(-3)) { i._vai(st); await z(5000);
    const cielo = [rc.left + rc.width / 2, rc.top + 30]; tocco(...cielo); await z(150); tocco(...cielo); await z(1500); out["cielo_" + st] = i._focus; }
  out.S1 = S1; return out;
});
console.log(JSON.stringify(r));
const ok = r.tocco_singolo_vuoto === r.S1 && r.doppio_sulla_casa !== null && r.doppio_vuoto === null && Object.keys(r).filter((k) => k.startsWith("cielo_")).every((k) => r[k] !== k.slice(6)); // errore solo se si resta nella stessa stanza
// (se in cima allo schermo non c'è cielo ma il pavimento di un'altra stanza, il tocco apre quella stanza: è giusto)
console.log(ok ? "ESITO: OK" : "ESITO: DA SISTEMARE");
await b.close();
