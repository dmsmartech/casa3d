// impostazioni comuni delle prove: WebKit (il motore di Safari e dell'app HA su iPad) con le misure del tablet vero
import { webkit } from "playwright";
export const PAGINA = process.env.PAGINA || "http://127.0.0.1:8767/prova.html";
// user agent VERO dell'app HA su iPad: con quello predefinito HA serve un frontend vecchio e i numeri sono falsi
export const UA_IPAD = "Mozilla/5.0 (iPad; CPU OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Home Assistant/2026.10.3 (io.robbie.HomeAssistant; build:2026.1234; iPadOS 18.7.0)";
// lato lungo x lato corto in punti; aggiungi qui i tuoi tablet
export const TABLET = { "ipad11": [1194, 834], "ipad13": [1366, 1024], "ipad109": [1180, 820], "mini": [1133, 744] };
export async function apri(tablet = "ipad11", extra = {}) {
  const b = await webkit.launch();
  const [w, h] = TABLET[tablet] || TABLET.ipad11;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, screen: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA_IPAD, ...extra });
  const p = await ctx.newPage(); const errori = [];
  p.on("pageerror", (e) => errori.push(String(e.message).slice(0, 160)));
  return { b, ctx, p, errori };
}
