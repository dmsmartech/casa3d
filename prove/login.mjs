// Salva la sessione di Home Assistant per le prove sulla dashboard vera. Si apre una finestra: fai TU il login
// (spunta "Resta collegato"). Nessuna password passa da qui. Uso: node login.mjs http://homeassistant.local:8123/dashboard-casa/piantina
import fs from "fs";
import { webkit } from "playwright";
const url = process.argv[2]; if (!url) { console.log("serve l'indirizzo della vista con la piantina"); process.exit(1); }
const b = await webkit.launch({ headless: false });
const ctx = await b.newContext({ viewport: { width: 1194, height: 834 } });
const p = await ctx.newPage(); await p.goto(url);
const percorso = new URL(url).pathname.split("/")[1];
for (let i = 0; i < 900; i++) {
  await p.waitForTimeout(1000);
  const ok = await p.evaluate((x) => !!localStorage.getItem("hassTokens") && location.pathname.startsWith("/" + x), percorso).catch(() => false);
  if (ok) { await p.waitForTimeout(2000); await ctx.storageState({ path: "sessione-ha.json" }); fs_perm(); console.log("LOGIN OK: sessione-ha.json (tienila privata)"); break; }
}
function fs_perm() { try { fs.chmodSync("sessione-ha.json", 0o600); } catch (e) {} }
await b.close();
