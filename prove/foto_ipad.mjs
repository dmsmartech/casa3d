// foto della pagina di prova come la vede l'iPad (WebKit + user agent dell'app HA)
import { apri, PAGINA } from "./comune.mjs";
const [tablet = "ipad13", out = "foto.png", query = ""] = process.argv.slice(2);
const { b, p, errori } = await apri(tablet);
await p.goto(PAGINA + query); await p.waitForTimeout(14000);
await p.screenshot({ path: out }); console.log("errori:", errori.length ? errori : "nessuno"); await b.close();
