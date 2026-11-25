# CASA DI ESEMPIO (piano terra): soggiorno + cucina, per provare tutta la catena del kit.
# Per la tua casa: copia questo file (es. casa_terra.py) e rifai muri, mobili e luci dalle TUE fonti reali
# (planimetria, scansione LiDAR, foto). Mai inventare: se una cosa non si vede da nessuna parte, chiedi.
#
# Coordinate di disegno: x da ovest a est, y da nord a sud, in metri; z = altezza. Blender ha la y invertita
# (le funzioni di base_helpers ci pensano da sole).
# Anteprima veloce:  PROVA=1 blender -b -P esempio_casa.py -- <cartella>
# Cottura:           MODELLO=esempio_casa.py blender -b -P cuoci.py -- <cartella>
import os, sys, math
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "base_helpers.py")).read())
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "dettagli.py")).read())
PIANO[0] = "terra"
ZPAV = 0.0

# --- materiali in più (colori presi dalle foto della casa) ---
M_DIVANO = mat("tessuto", (0.45, 0.45, 0.47), 0.95)
M_CUCINA = mat("laccato_cucina", (0.92, 0.91, 0.88), 0.3)

# --- pavimenti e giardino ---
# terreno come in ogni casa del kit: base chiara che sporge 1,4 m, erba tutto intorno, vialetto dalla portafinestra.
# casa = ingombro esterno dei muri; ogni vialetto parte da una porta e arriva da solo al bordo della base
giardino_base((-0.15, -0.15, 9.15, 6.15), vialetti=[(3.6, 6.15, 5.0, 6.15)])
box("pavimento_soggiorno", 0, 0, 5.5, 6, -0.06, 0, M_PARQUET)
box("pavimento_cucina", 5.5, 0, 9, 6, -0.06, 0, M_PIASTRELLA)

# --- muri (tagliati a CUT = 1,15 m, come una casa delle bambole) ---
# aperture: (da, a, tipo) lungo il muro; tipo "f" finestra, "p" porta, "pf" portafinestra
# muri esterni: muri_perimetro fa i quattro lati e la facciata bianca che gira gli angoli (regola delle pareti del kit)
muri_perimetro((-0.15, -0.15, 9.15, 6.15), sp=0.15, aperture={
    "n": [(1.4, 3.0, "f"), (6.4, 7.6, "f")], "s": [(3.6, 5.0, "pf"), (6.6, 7.8, "f")], "o": [(2.2, 3.4, "f")]})
muro(5.45, 0, 5.55, 6, 0, [(2.0, 2.9, "p")])
porta("porta_cucina", 5.45, 2.0, 5.55, 2.9, 0, verso=1)

# --- soggiorno ---
box("tappeto", 1.0, 1.5, 3.6, 3.7, 0, 0.012, M_TAPPETO)
divano("divano", 1.0, 3.9, 3.6, 4.85, 0, "s", M_DIVANO)
mobile("mobile_tv", 1.2, 0.05, 3.4, 0.5, 0, 0.5, "s", M_BIANCO, ante=3)
box("tv_schermo", 1.55, 0.18, 3.05, 0.24, 0.62, 1.48, M_NERO, 0.01)
box("tavolino", 1.8, 2.3, 2.8, 2.9, 0.3, 0.36, M_LEGNO, 0.01)
cil("piantana_stelo", 4.4, 4.7, 0.015, 0, 1.45, M_ACCIAIO, 12)
cil("piantana_base", 4.4, 4.7, 0.16, 0, 0.03, M_NERO)
cil("piantana_paralume", 4.4, 4.7, 0.2, 1.4, 1.7, M_LAMPADA)
luce("L_piantana", 4.4, 4.7, 1.5, 45, 0.2)
pianta("pianta_soggiorno", 5.0, 0.6, 0, 1.1)
# tenda (gruppo a parte "tenda_1": nella pagina si allarga quando la tenda si chiude)
box("tenda_1", 3.3, 5.82, 3.6, 5.95, 0.02, 1.12, M_TENDA)

# --- cucina ---
mobile("cucina_basi", 8.35, 0.4, 8.95, 4.6, 0, 0.88, "o", M_CUCINA, ante=4, m_top=M_LEGNO)
box("led_cucina", 8.9, 0.5, 8.95, 4.5, 1.05, 1.07, M_LED)
luce("L_striscia", 8.75, 2.5, 1.0, 18, 0.4, (1.0, 0.8, 0.6))
tavolo("tavolo", 6.2, 2.2, 7.6, 3.2, 0.76, M_LEGNO, M_NERO)
for i, (x, y, v) in enumerate(((6.55, 1.85, "n"), (7.25, 1.85, "n"), (6.55, 3.55, "s"), (7.25, 3.55, "s"))):
    sedia(f"sedia_{i}", x, y, 0, v, M_NERO, M_LEGNO)
cil("sospensione_cavo", 6.9, 2.7, 0.006, 1.7, 2.4, M_NERO, 8)
sfera("sospensione_paralume", 6.9, 2.7, 1.62, 0.17, M_LAMPADA, 1, 1, 0.7)
luce("L_sospensione", 6.9, 2.7, 1.5, 35, 0.15)

# --- dati per la cottura e per la pagina ---
BOX_STANZE = {"soggiorno": (0, 0, 5.5, 6), "cucina": (5.5, 0, 9, 6)}
# chiave -> (luci Blender, oggetti che si illuminano, stanza). La chiave è quella di casa.config.js (entita)
ENT = {
    "piantana": (["L_piantana"], ["piantana_paralume"], "soggiorno"),
    "sospensione": (["L_sospensione"], ["sospensione_paralume"], "cucina"),
    "striscia_cucina": (["L_striscia"], ["led_cucina"], "cucina"),
}
# oggetti toccabili senza luce cotta (es. la TV): chiave -> ([oggetti], stanza)
EXTRA3D = {"tv": (["tv_schermo"], "soggiorno")}
SOLE_ROT = 150
# il giardino non è una stanza: gruppo a parte "esterno" (si attenua quando entri in una stanza); la facciata è un gruppo unico
def gruppo_extra(o):
    return gruppo_struttura(o)

def materiali_reali():
    parquet(M_PARQUET, (0.42, 0.25, 0.12), (0.55, 0.34, 0.17))
    piastrelle(M_PIASTRELLA, (0.86, 0.84, 0.80), (0.82, 0.80, 0.76), (0.6, 0.58, 0.55), 0.6, 0.3)
    # pareti bianche e luminose (regola del kit): stessi intonaci della casa di riferimento
    intonaco(M_MURO, (0.94, 0.93, 0.90), 0.03)
    intonaco(M_FACCIATA_KIT, (0.92, 0.91, 0.88), 0.04)
    tessuto(M_DIVANO, (0.45, 0.45, 0.47))
    legno(M_LEGNO, (0.46, 0.28, 0.15), (0.62, 0.41, 0.23), 0.4, 30.0)
    tappeto(M_TAPPETO, (0.35, 0.36, 0.36))
    laccato(M_BIANCO, (0.93, 0.93, 0.92))

exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "modello_base.py")).read())
# FINE_MODELLO (cuoci.py legge fino a qui)
if os.environ.get("PROVA"):
    anteprima("esempio_anteprima.png", centro=(4.5, 3.0), scala=13.0)
