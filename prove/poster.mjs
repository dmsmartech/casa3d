// Immagine d'attesa (poster_terra.webp): la casa senza etichette, mostrata mentre il 3D si carica.
// Uso: server sulla dist come per prova_kit.mjs, poi: node poster.mjs ../modello_web   (poi di nuovo build.sh)
import fs from "fs";
import { execFileSync } from "child_process";
import { apri, PAGINA } from "./comune.mjs";
const dove = process.argv[2] || "../modello_web";
const { b, p } = await apri("ipad11", { deviceScaleFactor: 1 });
await p.goto(PAGINA + (PAGINA.includes("?") ? "&" : "?") + "cattura=1&accese=0&el=25"); await p.waitForTimeout(12000);
const dati = await p.evaluate(async () => {
  const i = window.prova.card._in, m = i._m; i.shadowRoot.querySelectorAll(".tre-et, .m3d-stanze").forEach((x) => (x.style.visibility = "hidden"));
  await new Promise((o) => setTimeout(o, 1500)); return m._r.domElement.toDataURL("image/png");
});
// Safari esporta solo PNG: lo converto in WebP con cwebp
fs.writeFileSync(dove + "/poster_terra.png", Buffer.from(dati.split(",")[1], "base64"));
execFileSync("cwebp", ["-quiet", "-q", "80", dove + "/poster_terra.png", "-o", dove + "/poster_terra.webp"]); fs.unlinkSync(dove + "/poster_terra.png");
console.log("salvato", dove + "/poster_terra.webp");
await b.close();
