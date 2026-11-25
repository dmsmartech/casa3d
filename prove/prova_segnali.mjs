// Prova delle icone sulla piantina (pagina finta), valida per ogni casa: stanza per stanza tocca ogni icona visibile e
// controlla che faccia quello che fa nella casa di riferimento:
//  - luci, prese, ventole, interruttori: il tocco accende o spegne subito, senza aprire finestre;
//  - tapparelle e tende: il tocco apre o chiude;
//  - robot aspirapolvere: il tocco lo fa partire, il secondo tocco lo rimanda alla base;
//  - cassa (media:): il tocco mette in pausa o riprende;
//  - pianta: il tocco mostra nome e umidità della terra;
//  - tutto il resto (clima, sensori, porte e finestre, TV, telecamere): il tocco apre la finestra nativa di Home Assistant.
// Una pressione lunga su una luce apre la finestra di HA per regolarla. Serrature, cancelli, garage e allarmi non si toccano mai.
// Uso: (in scheda_ha/dist) python3 -m http.server 8767 ; poi qui: node prova_segnali.mjs [cartella_foto]
import { webkit } from "playwright";
import { PAGINA } from "./comune.mjs";
const FOTO = process.argv[2] || null;
const b = await webkit.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 1024 } });
const errori = []; p.on("pageerror", (e) => errori.push(String(e.message).slice(0, 160)));
const log = []; p.on("console", (m) => { const t = m.text(); if (t.startsWith("[prova]")) log.push(t.slice(8)); });
await p.goto(PAGINA + "?el=20&accese=0"); await p.waitForTimeout(12000);
const esiti = [];
const ok = (nome, cond, extra = "") => { esiti.push(!!cond); console.log((cond ? "OK   " : "NO   ") + nome + (extra ? "  (" + extra + ")" : "")); };
const vai = async (k) => { await p.evaluate((k) => window.prova.card._in._vai(k), k); await p.waitForTimeout(2600); };
const ultimo = () => log.length;
const dopo = (n, re) => log.slice(n).some((l) => re.test(l));
const chiudiInfo = () => p.evaluate(() => document.getElementById("info").classList.remove("vis"));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const VIETATI = /^(lock|alarm_control_panel)$|cancell|garage|gate|portone/;

// icone visibili nella vista attuale, con l'entità e cosa ci si aspetta dal tocco
const icone = () => p.evaluate(() => {
  const i = window.prova.card._in, root = i.shadowRoot, box = root.querySelector(".tre-luce")?.closest("ha-card, .m3d, div")?.getBoundingClientRect();
  const mappa = root.querySelector("canvas")?.getBoundingClientRect() || box;
  return [...root.querySelectorAll(".tre-luce[data-ent]")].map((d) => {
    const r = d.getBoundingClientRect(), cs = getComputedStyle(d), k = d.dataset.ent;
    const vis = r.width > 0 && cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0.5 &&
      r.left > mappa.left + 4 && r.right < mappa.right - 4 && r.top > mappa.top + 60 && r.bottom < mappa.bottom - 4;
    const e = i._entDi(k), s = e && i._hass.states[e];
    return { k, e, dom: e ? e.split(".")[0] : null, stato: s ? s.state : null, tv: !!(i._tv && i._tv[k]) || k.startsWith("atv:"),
      x: r.left + r.width / 2, y: r.top + r.height / 2, vis, testo: (d.querySelector("i") || {}).textContent || "" };
  });
});
const stanze = await p.evaluate(() => Object.values(window.prova.card._in._meta).flatMap((x) => Object.keys((x && x.stanze) || {})).filter((k) => k !== "esterno"));
const fatte = new Set(); let lungo = false, temperatura = false;
for (const st of stanze) {
  await vai(st); if (FOTO) await p.screenshot({ path: `${FOTO}/${st}.png` });
  for (const ic of await icone()) {
    if (!ic.vis || fatte.has(ic.k) || ic.tv) continue;
    if (VIETATI.test(ic.dom || "") || VIETATI.test(ic.k) || VIETATI.test(ic.e || "")) { fatte.add(ic.k); console.log("--   " + ic.k + " non toccato (sicurezza)"); continue; }
    fatte.add(ic.k);
    const E = esc(ic.e || ""), n = ultimo();
    await p.mouse.click(ic.x, ic.y); await p.waitForTimeout(600);
    if (ic.k.startsWith("temperatura:")) { temperatura = true; ok(`${ic.k}: numero nell'icona`, /\d/.test(ic.testo), ic.testo); }
    if (ic.k.startsWith("pianta:")) {
      ok(`${ic.k}: il tocco mostra nome e terra, nessuna finestra`, !dopo(n, /more-info/) && await p.evaluate((k) => !!window.prova.card._in.shadowRoot.querySelector(`.tre-luce[data-ent="${k}"].mostra`), ic.k));
    } else if (ic.stato === "unavailable") {
      ok(`${ic.k}: non disponibile = finestra di HA`, dopo(n, new RegExp("more-info " + E)));
    } else if (/^(light|switch|fan|input_boolean)$/.test(ic.dom)) {
      ok(`${ic.k}: tocco = acceso/spento subito, nessuna finestra`, dopo(n, new RegExp(`${ic.dom}\\.toggle ${E}`)) && !dopo(n, /more-info/));
      if (!lungo && ic.dom === "light") { lungo = true; const m = ultimo();
        await p.mouse.move(ic.x, ic.y); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up(); await p.waitForTimeout(500);
        ok(`${ic.k}: pressione lunga = finestra di HA per regolare`, dopo(m, new RegExp("more-info " + E)) && !dopo(m, /toggle/)); }
    } else if (ic.dom === "cover") {
      ok(`${ic.k}: tocco = apre o chiude`, dopo(n, new RegExp(`cover\\.(open|close)_cover ${E}`)));
    } else if (ic.dom === "vacuum") {
      ok(`${ic.k}: tocco = il robot parte`, dopo(n, new RegExp(`vacuum\\.start ${E}`)));
      const m = ultimo(); await p.mouse.click(ic.x, ic.y); await p.waitForTimeout(600);
      ok(`${ic.k}: secondo tocco = torna alla base`, dopo(m, new RegExp(`vacuum\\.return_to_base ${E}`)));
    } else if (ic.dom === "button") {
      ok(`${ic.k}: tocco = premuto`, dopo(n, new RegExp(`button\\.press ${E}`)));
    } else if (ic.dom === "media_player" && ic.k.startsWith("media:")) {
      ok(`${ic.k}: tocco = pausa o riprende`, dopo(n, new RegExp(`media_player\\.media_play_pause ${E}`)));
    } else if (ic.e) {
      ok(`${ic.k}: tocco = finestra di HA`, dopo(n, new RegExp("more-info " + E)));
    }
    await chiudiInfo();
  }
}
ok("almeno un'icona provata", fatte.size > 0, fatte.size + " icone");
if (!lungo) console.log("--   nessuna luce visibile: pressione lunga non provata");
if (!temperatura) console.log("--   nessun sensore di temperatura in questa casa");
console.log("errori:", errori.length ? errori : "nessuno");
const tutto = esiti.every(Boolean) && !errori.length;
console.log("ESITO:", tutto ? "OK" : "DA SISTEMARE");
await b.close(); process.exit(tutto ? 0 : 1);
