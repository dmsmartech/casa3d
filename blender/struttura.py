# Mattoni STRUTTURALI del kit: solo ciò che serve a ogni casa per funzionare nella piantina (solaio dei piani alti,
# scala tra due piani divisa tra i due modelli, gruppi di cottura). Il DESIGN (tipo di scala, LED, parapetti, infissi,
# colori) non è qui: lo decide l'utente o lo prende l'AI dalle sue foto, e si costruisce nel modello della casa.
# Lo carica base_helpers.py da solo. Coordinate di disegno: x da ovest a est, y da nord a sud, z altezza (metri).

def scala_dritta(x0, x1, y_inizio, z_sotto, z_sopra, parte, verso="s", alzate=17, pedata=0.27, lato_libero="o",
                 materiale=None, setto=None, sospesa=False, led=False, parapetto=None):
    """Scala dritta tra due piani, divisa tra i due modelli come serve alla piantina. Di serie è neutra: gradini pieni
    fino a terra, niente LED, niente parapetto. Com'è fatta davvero la scala lo dice l'utente (o le sue foto):
      sospesa=True  gradini a sbalzo dal setto invece che pieni;
      led=True      una striscia LED sotto ogni gradino (le luci da mettere in ENT);
      parapetto     None, oppure il materiale della lastra sul lato libero (es. M_VETRO), alta 0,9 m sopra i gradini.
    x0, x1 = larghezza della scala; y_inizio = filo del primo gradino; sale verso sud (verso="s") o verso nord ("n").
    z_sotto, z_sopra = pavimenti dei due piani; alzata = (z_sopra - z_sotto) / alzate.
    parte = "sotto": nel modello del piano sotto, i gradini fino al taglio dei muri (+ la luce del primo gradino tagliato);
    parte = "sopra": nel modello del piano sopra, i gradini sopra il taglio fino al pavimento, il setto e il parapetto,
    tutti nei gruppi "scala" e "vetro_scala" che la pagina ritaglia sul foro.
    Con led=True restituisce i nomi delle luci: in ENT vanno con la STESSA entità nei due modelli.
    setto = (y0, y1) del muro che regge i gradini (di serie lungo tutta la scala)."""
    ALZ, PED = (z_sopra - z_sotto) / alzate, pedata
    T = z_sotto + CUT; s = 1 if verso == "s" else -1; m = materiale or globals().get("M_PARQUET")
    pre = "scala_" if parte == "sopra" else ""
    def fila(i):  # y del filo (naso) del gradino i e sua estensione
        a = y_inizio + s * PED * i; return (a, a + PED) if s > 0 else (a - PED, a)
    def yz(z): return y_inizio + s * (z - z_sotto) / ALZ * PED  # filo dei gradini alla quota z
    luci = []
    def luce(i, zt):
        b0, b1 = fila(i); yl = b0 + 0.0425 if s > 0 else b1 - 0.0425
        bpy.ops.object.light_add(type="AREA", location=((x0 + x1) / 2, -yl, zt - 0.076))
        l = bpy.context.object; l.name = f"L_{pre}scala_{i}"; l.data.shape = "RECTANGLE"; l.data.size = (x1 - x0) - 0.06
        l.data.size_y = 0.02; l.data.energy = 4.0; l.data.color = (1.0, 0.85, 0.65); reg(l); luci.append(l.name)
    primo_tagliato = True
    for i in range(alzate - 1):
        zt = z_sotto + ALZ * (i + 1); b0, b1 = fila(i); sopra_taglio = zt > T + 0.05
        if (parte == "sotto") == sopra_taglio:
            # al piano sotto: la luce del primo gradino tagliato (sta sotto il gradino che è nel modello di sopra)
            if parte == "sotto" and primo_tagliato and led: luce(i, zt); primo_tagliato = False
            continue
        box(f"{pre}gradino_{i}", x0, b0, x1, b1, (zt - 0.07) if sospesa else (T if parte == "sopra" else z_sotto), zt, m)
        if led:
            l0, l1 = (b0 + 0.035, b0 + 0.05) if s > 0 else (b1 - 0.05, b1 - 0.035)
            box(f"{pre}led_scala_{i}", x0 + 0.03, l0, x1 - 0.03, l1, zt - 0.074, zt - 0.07, M_LED)
            luce(i, zt)
    xv = (x0 - 0.02, x0) if lato_libero == "o" else (x1, x1 + 0.02)
    ys = setto or (min(yz(z_sotto), yz(z_sopra)), max(yz(z_sotto), yz(z_sopra)))
    if parte == "sotto":
        if parapetto: lastra_yz("parapetto_scala", *xv, [(yz(z_sotto), z_sotto), (yz(T), T), (yz(T - 0.9), T), (yz(z_sotto), z_sotto + 0.9)], parapetto)
    else:
        ZS = z_sopra - 0.3
        if sospesa:  # il muro che regge i gradini a sbalzo, fino al solaio
            xs = (x1, x1 + 0.2) if lato_libero == "o" else (x0 - 0.2, x0)
            box("scala_setto", xs[0], ys[0], xs[1], ys[1], T, ZS, M_MURO)
        if parapetto: lastra_yz("scala_parapetto", *xv, [(yz(T - 0.9), T), (yz(T), T), (yz(ZS), ZS), (yz(ZS - 0.9), ZS)], parapetto)
        # pezzo piccolo visto da vicino: mappa di luce minima e più campioni (contro le strisce colorate)
        g = globals(); g.setdefault("RES_MIN", {}).setdefault("scala", 1024); g.setdefault("CAMP_X", {}).setdefault("scala", 6)
    return luci

def solaio(casa, z, fori=()):
    """Solaio su cui poggia un piano alto: una lastra sola (niente giunte) dal bordo esterno dei muri, spessa 24 cm sotto
    il pavimento, con i fori delle scale, del colore della facciata. Va nel gruppo della facciata (gruppo_struttura)."""
    return lastra_bucata("solaio", casa[0], casa[1], casa[2], casa[3], z - 0.3, z - 0.06, list(fori), M_FACCIATA_KIT)

def gruppo_struttura(o, giardino="esterno"):
    """Gruppi di cottura dei pezzi strutturali, uguali in ogni casa. Nel modello: def gruppo_extra(o): return gruppo_struttura(o)
    - facciata e solaio: un gruppo unico, senza righe tra un pezzo e l'altro;
    - base, prato e vialetti (giardino_base): il gruppo del giardino;
    - parte alta della scala al piano sopra: "scala" (opaca) e "vetro_scala", ritagliati dalla pagina sul foro."""
    n = o.name.split(".")[0]
    if n in ("facciata", "solaio"): return "facciata"
    if n == "scala_parapetto": return "vetro_scala"
    if n.startswith("scala_"): return "scala"
    return gruppo_giardino(o, giardino)
