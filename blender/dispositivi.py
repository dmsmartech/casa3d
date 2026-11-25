# Dispositivi della casa intelligente come oggetti veri del modello (robot, purificatori, sensori, telecamere...).
# Ogni dispositivo collegato a Home Assistant deve avere il suo oggetto nella piantina, non solo l'icona: l'icona sta
# sopra l'oggetto (segnali in casa.config.js). Misure prese dai prodotti comuni (robot Ø 35 cm, sensori 4-6 cm...).
# Uso nel modello (dopo base_helpers.py):  exec(open(".../dispositivi.py").read())
# Coordinate di disegno come base_helpers (x verso est, y verso sud, z altezza vera).
# verso = dove guarda il davanti del dispositivo: "n" (nord, y che cala), "s", "e" (x che cresce), "o".
# Per un oggetto a muro (x, y) è il punto sulla superficie del muro, al centro del retro del dispositivo.
# stanza = gruppo di cottura forzato (utile per i dispositivi sui muri tra due stanze o fuori dalla casa).
import math

M_DISP = mat("dispositivo_bianco", (0.90, 0.90, 0.89), 0.35)        # plastica bianca opaca dei sensori
M_DISP_SCURO = mat("dispositivo_scuro", (0.07, 0.07, 0.08), 0.25)    # plastica nera lucida (robot, campanello)
M_GRIGLIA = mat("griglia_scura", (0.16, 0.16, 0.17), 0.6)            # griglie d'aria
M_LENTE = mat("lente", (0.01, 0.01, 0.015), 0.04)                    # obiettivi e schermi spenti
M_LATTE = mat("lente_lattea", (0.97, 0.97, 0.96), 0.15)             # lente del sensore di movimento
M_EINK = mat("display_eink", (0.78, 0.78, 0.75), 0.5)                # schermo dei termometri
M_CROMO_D = mat("cromo_dispositivi", (0.86, 0.86, 0.88), 0.08, metal=1.0)
_V = {"n": (0, -1), "s": (0, 1), "e": (1, 0), "o": (-1, 0)}

def _forza(o, stanza):
    if stanza: o["stanza_forzata"] = stanza
    return o

def _smussa(o, w, seg=4):
    mod = o.modifiers.new("bev", "BEVEL"); mod.width = w; mod.segments = seg; mod.limit_method = "ANGLE"
    return o

def _parete(nome, x, y, larg, prof, z0, z1, verso, m, bevel=0.0, scost=0.0, lungo=0.0, stanza=None):
    """scatola appoggiata a un muro: larg lungo il muro, prof verso 'verso', da 'scost' metri dal muro;
    lungo = spostamento lungo il muro (positivo verso est o verso sud)"""
    dx, dy = _V[verso]; a, b = scost, scost + prof
    if dx == 0:
        cx = x + lungo; ya, yb = y + dy * a, y + dy * b
        o = box(nome, cx - larg / 2, min(ya, yb), cx + larg / 2, max(ya, yb), z0, z1, m, bevel)
    else:
        cy = y + lungo; xa, xb = x + dx * a, x + dx * b
        o = box(nome, min(xa, xb), cy - larg / 2, max(xa, xb), cy + larg / 2, z0, z1, m, bevel)
    return _forza(o, stanza)

def _cil_oriz(nome, x, y, z, r, lung, verso, m, seg=24, stanza=None):
    """cilindro sdraiato che parte da (x, y, z) e va verso 'verso' (obiettivi)"""
    dx, dy = _V[verso]
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=lung, location=(x + dx * lung / 2, -(y + dy * lung / 2), z))
    o = bpy.context.object; o.name = nome
    o.rotation_euler = (math.radians(90), 0, 0) if dx == 0 else (0, math.radians(90), 0)
    o.data.materials.append(m); reg(o)
    return _forza(o, stanza)

def _cil(nome, x, y, r, z0, z1, m, seg=32, bevel=0.0, stanza=None):
    o = cil(nome, x, y, r, z0, z1, m, seg)
    if bevel: _smussa(o, bevel); bpy.context.view_layer.objects.active = o; bpy.ops.object.shade_smooth()
    return _forza(o, stanza)

# ---------- robot aspirapolvere con la base di ricarica ----------
def robot_aspirapolvere(nome, bx, by, z, verso, stanza=None):
    """base di ricarica appoggiata al muro in (bx, by) col davanti verso 'verso'; il robot è agganciato davanti alla base.
    Robot Ø 35 cm, alto 9,5 cm con la torretta del laser; base 18 x 14 cm, alta 11 cm."""
    _parete(nome + "_base", bx, by, 0.18, 0.12, z, z + 0.11, verso, M_DISP, 0.012, stanza=stanza)
    _parete(nome + "_base_contatti", bx, by, 0.12, 0.004, z + 0.01, z + 0.03, verso, M_CROMO_D, scost=0.12, stanza=stanza)
    dx, dy = _V[verso]; rx, ry = bx + dx * (0.125 + 0.175), by + dy * (0.125 + 0.175)
    _cil(nome, rx, ry, 0.175, z + 0.008, z + 0.08, M_DISP, 48, 0.012, stanza)
    _cil(nome + "_coperchio", rx, ry, 0.168, z + 0.08, z + 0.083, M_DISP_SCURO, 48, stanza=stanza)
    # torretta del laser spostata verso il retro (verso la base), come nei robot veri
    tx, ty = rx - dx * 0.07, ry - dy * 0.07
    _cil(nome + "_laser", tx, ty, 0.042, z + 0.083, z + 0.103, M_DISP, 32, 0.006, stanza)
    _cil(nome + "_laser_top", tx, ty, 0.036, z + 0.103, z + 0.105, M_DISP_SCURO, 32, stanza=stanza)
    return (rx, ry)

# ---------- purificatore d'aria a colonna ----------
def purificatore(nome, x, y, z, alto=0.55, r=0.13, stanza=None):
    """colonna bianca con la griglia d'uscita scura sopra e lo zoccolo scuro (tipo Xiaomi, Dyson, IKEA)"""
    _cil(nome + "_zoccolo", x, y, r - 0.006, z, z + 0.02, M_GRIGLIA, 48, stanza=stanza)
    _cil(nome, x, y, r, z + 0.02, z + alto, M_DISP, 48, 0.01, stanza)
    _cil(nome + "_griglia", x, y, r - 0.018, z + alto, z + alto + 0.004, M_GRIGLIA, 48, stanza=stanza)
    _cil(nome + "_display", x, y, 0.028, z + alto + 0.004, z + alto + 0.006, M_LENTE, 24, stanza=stanza)

# ---------- campanello con telecamera (fuori) e monitor del videocitofono (dentro) ----------
def campanello_video(nome, x, y, z, verso, stanza=None):
    """campanello smart a muro, 4,5 x 15 cm: nero lucido, obiettivo in alto, pulsante tondo in basso"""
    _parete(nome, x, y, 0.045, 0.025, z, z + 0.15, verso, M_DISP_SCURO, 0.006, stanza=stanza)
    _parete(nome + "_obiettivo", x, y, 0.018, 0.003, z + 0.112, z + 0.13, verso, M_LENTE, scost=0.025, stanza=stanza)
    _parete(nome + "_pulsante", x, y, 0.024, 0.003, z + 0.02, z + 0.044, verso, M_CROMO_D, scost=0.025, stanza=stanza)

def monitor_citofono(nome, x, y, z, verso, stanza=None):
    """monitor del videocitofono in casa: 18 x 12 cm, cornice bianca e schermo scuro"""
    _parete(nome, x, y, 0.18, 0.02, z, z + 0.12, verso, M_DISP, 0.006, stanza=stanza)
    _parete(nome + "_schermo", x, y, 0.15, 0.002, z + 0.017, z + 0.103, verso, M_LENTE, scost=0.02, stanza=stanza)

# ---------- sensori ----------
def rilevatore_fumo(nome, x, y, z_soffitto, stanza=None):
    """disco bianco Ø 12 cm sotto il soffitto, con la fascia di aperture scura e il led al centro"""
    _cil(nome, x, y, 0.06, z_soffitto - 0.036, z_soffitto, M_DISP, 40, 0.01, stanza)
    _cil(nome + "_fessure", x, y, 0.0605, z_soffitto - 0.026, z_soffitto - 0.016, M_GRIGLIA, 40, stanza=stanza)
    _cil(nome + "_led", x, y, 0.008, z_soffitto - 0.038, z_soffitto - 0.036, M_LENTE, 16, stanza=stanza)

def sensore_perdita(nome, x, y, z, stanza=None):
    """dischetto bianco Ø 6 cm appoggiato a terra, con i contatti sotto e il pulsante sopra"""
    _cil(nome, x, y, 0.03, z, z + 0.018, M_DISP, 32, 0.005, stanza)
    _cil(nome + "_pulsante", x, y, 0.009, z + 0.018, z + 0.02, M_GRIGLIA, 16, stanza=stanza)

def sensore_movimento(nome, x, y, z, verso, stanza=None):
    """sensore a muro 5 x 6 cm, profondo 4, con la lente lattea a cupola sul davanti"""
    _parete(nome, x, y, 0.05, 0.035, z, z + 0.06, verso, M_DISP, 0.012, stanza=stanza)
    dx, dy = _V[verso]
    o = sfera(nome + "_lente", x + dx * 0.035, y + dy * 0.035, z + 0.032, 0.017, M_LATTE)
    _forza(o, stanza)

def termometro(nome, x, y, z, verso, stanza=None):
    """termometro-igrometro a muro 6,5 x 6,5 cm con lo schermo e-ink e le cifre scure"""
    _parete(nome, x, y, 0.065, 0.014, z, z + 0.065, verso, M_DISP, 0.006, stanza=stanza)
    _parete(nome + "_schermo", x, y, 0.052, 0.002, z + 0.008, z + 0.057, verso, M_EINK, scost=0.014, stanza=stanza)
    _parete(nome + "_cifre", x, y, 0.03, 0.001, z + 0.026, z + 0.044, verso, M_LENTE, scost=0.016, stanza=stanza)

def sensore_apertura(nome, x, y, z, verso, stanza=None):
    """contatto di porta o finestra: corpo bianco 2,2 x 7 cm sul telaio"""
    _parete(nome, x, y, 0.022, 0.012, z, z + 0.07, verso, M_DISP, 0.003, stanza=stanza)

def serratura_smart(nome, x, y, z, verso, stanza=None):
    """serratura motorizzata sul lato interno della porta (tipo Nuki): 6 x 11 cm, con la manopola tonda"""
    _parete(nome, x, y, 0.06, 0.05, z, z + 0.11, verso, M_DISP_SCURO, 0.01, stanza=stanza)
    dx, dy = _V[verso]
    _cil_oriz(nome + "_manopola", x + dx * 0.05, y + dy * 0.05, z + 0.065, 0.022, 0.006, verso, M_DISP, 32, stanza)

# ---------- climatizzatore a pavimento (console) ----------
def clima_console(nome, x, y, z, verso, larg=0.7, alto=0.6, prof=0.2, stanza=None):
    """split a pavimento contro il muro (resta sotto i muri tagliati della piantina): mandata in alto, ripresa in basso"""
    _parete(nome, x, y, larg, prof, z + 0.02, z + alto, verso, M_DISP, 0.015, stanza=stanza)
    _parete(nome + "_piedini", x, y, larg - 0.06, prof - 0.04, z, z + 0.02, verso, M_GRIGLIA, scost=0.02, stanza=stanza)
    _parete(nome + "_mandata", x, y, larg - 0.1, 0.003, z + alto - 0.11, z + alto - 0.04, verso, M_GRIGLIA, scost=prof, stanza=stanza)
    _parete(nome + "_ripresa", x, y, larg - 0.1, 0.003, z + 0.06, z + 0.14, verso, M_GRIGLIA, scost=prof, stanza=stanza)
    _parete(nome + "_display", x, y, 0.05, 0.002, z + alto - 0.17, z + alto - 0.15, verso, M_LENTE, scost=prof, lungo=larg / 2 - 0.1, stanza=stanza)

# ---------- videoproiettore su colonnina ----------
def proiettore(nome, x, y, z, verso, alto=1.35, stanza=None):
    """colonnina nera con base tonda e videoproiettore bianco sopra, obiettivo verso 'verso' (lo schermo)"""
    _cil(nome + "_base", x, y, 0.13, z, z + 0.015, M_DISP_SCURO, 40, stanza=stanza)
    _cil(nome + "_colonna", x, y, 0.016, z + 0.015, z + alto, M_DISP_SCURO, 16, stanza=stanza)
    dx, dy = _V[verso]; L, P = 0.3, 0.24   # L lungo l'asse dell'obiettivo
    if dx == 0: o = box(nome, x - P / 2, y - L / 2, x + P / 2, y + L / 2, z + alto, z + alto + 0.11, M_DISP, 0.014)
    else: o = box(nome, x - L / 2, y - P / 2, x + L / 2, y + P / 2, z + alto, z + alto + 0.11, M_DISP, 0.014)
    _forza(o, stanza)
    _cil_oriz(nome + "_obiettivo", x + dx * L / 2, y + dy * L / 2, z + alto + 0.055, 0.035, 0.025, verso, M_LENTE, 32, stanza)

# ---------- elettrodomestici e bagno ----------
def lavastoviglie_frontale(nome, x, y, larg, z0, z1, verso, m_anta, stanza=None):
    """anta della lavastoviglie integrata sul fronte di un mobile: pannello come i mobili, striscia comandi scura in alto
    e maniglia in acciaio (si riconosce dagli altri sportelli)"""
    _parete(nome, x, y, larg, 0.008, z0, z1, verso, m_anta, 0.003, stanza=stanza)
    _parete(nome + "_comandi", x, y, larg, 0.003, z1 - 0.05, z1 - 0.01, verso, M_LENTE, scost=0.008, stanza=stanza)
    _parete(nome + "_maniglia", x, y, larg - 0.16, 0.02, z1 - 0.1, z1 - 0.08, verso, M_CROMO_D, 0.004, scost=0.008, stanza=stanza)

def scaldasalviette(nome, x, y, z0, z1, larg, verso, m_telo=None, stanza=None):
    """radiatore a scaletta cromato a muro: due montanti e i tubi orizzontali ogni 9 cm, con un telo piegato sopra"""
    dx, dy = _V[verso]; d = 0.05   # distanza dei tubi dal muro
    for s in (-1, 1):
        if dx == 0: _cil(nome + "_montante", x + s * larg / 2, y + dy * d, 0.013, z0, z1, M_CROMO_D, 16, stanza=stanza)
        else: _cil(nome + "_montante", x + dx * d, y + s * larg / 2, 0.013, z0, z1, M_CROMO_D, 16, stanza=stanza)
    zz = z0 + 0.06
    while zz < z1 - 0.03:
        _parete(nome + "_tubo", x, y, larg, 0.016, zz, zz + 0.016, verso, M_CROMO_D, 0.006, scost=d - 0.008, stanza=stanza)
        zz += 0.09
    if m_telo:
        _parete(nome + "_telo", x, y, larg * 0.75, 0.03, z0 + 0.45, z1 - 0.05, verso, m_telo, 0.01, scost=d + 0.01, stanza=stanza)
