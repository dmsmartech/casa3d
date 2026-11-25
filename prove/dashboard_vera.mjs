// Prova sulla dashboard VERA di Home Assistant, con la sessione salvata da login.mjs.
// I comandi ai dispositivi sono BLOCCATI (passano solo il registro e le letture): non si accende niente in casa.
// Uso: node dashboard_vera.mjs http://homeassistant.local:8123/dashboard-casa/piantina [ipad11|ipad13]
// Mostra le colonne del pannello sotto la piantina per quel tablet e gli errori.
import fs from "fs";
import { webkit } from "playwright";
import { UA_IPAD, TABLET } from "./comune.mjs";
const url = process.argv[2], tablet = process.argv[3] || "ipad11";
if (!url || !fs.existsSync("sessione-ha.json")) { console.log("servono l'indirizzo e sessione-ha.json (node login.mjs ...)"); process.exit(1); }
const [w, h] = TABLET[tablet];
const b = await webkit.launch();
const ctx = await b.newContext({ viewport: { width: w, height: h }, screen: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState: "sessione-ha.json", userAgent: UA_IPAD });
// blocco dei comandi PRIMA che la pagina parta
await ctx.addInitScript(() => {
  const vero = WebSocket.prototype.send;
  WebSocket.prototype.send = function (d) { try { const m = JSON.parse(d); if (m.type === "call_service" && !["system_log"].includes(m.domain)) { console.log("BLOCCATO", m.domain, m.service); return; } } catch (e) {} return vero.call(this, d); };
});
const p = await ctx.newPage(); const errori = []; p.on("pageerror", (e) => errori.push(String(e.message).slice(0, 120)));
await p.goto(url); await p.waitForTimeout(12000);
const info = await p.evaluate(async () => {
  const trova = (tag) => { let x = null; const g = (r) => { for (const e of r.querySelectorAll("*")) { if (x) return; if (e.tagName === tag) { x = e; return; } if (e.shadowRoot) g(e.shadowRoot); } }; g(document); return x; };
  const i = trova("CASA3D-CARD")._in, z = (ms) => new Promise((o) => setTimeout(o, ms));
  i._pannello.scrollIntoView({ block: "start" }); await z(4000);
  for (let k = 0; k < 6; k++) { window.scrollBy(0, 500); await z(2500); }
  window.scrollTo(0, 0); i._pannello.scrollIntoView({ block: "start" }); await z(2500);
  return [...i._pannello.querySelectorAll(".stanza-col")].map((col) => [...col.children].map((c) => (c._c.titolo || "?").slice(0, 14) + ":" + Math.round(c.getBoundingClientRect().height)));
});
console.log(tablet, JSON.stringify(info)); console.log("errori:", errori.length ? errori : "nessuno");
await p.screenshot({ path: `dashboard_${tablet}.png` });
await b.close();
