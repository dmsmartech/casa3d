# Sanitari realistici (comuni ai due piani): WC e bidet sospesi su controparete, lavabi da appoggio con la vasca vera,
# rubinetti a muro, docce con canalina, miscelatore e doccetta. Coordinate di disegno (y verso sud) come base_helpers.
# Ogni pezzo in ceramica è una "rotazione" di anelli (sezioni orizzontali) uniti tra loro: forma piena, bordi arrotondati,
# vasca incavata dove serve. Si include nel modello della casa con exec(open(...sanitari.py).read()).
import math, bmesh as _bms

M_CERAMICA_V = mat("ceramica_sanitari", (0.95, 0.95, 0.94), 0.12)
M_CROMO = mat("cromo", (0.86, 0.86, 0.88), 0.08, metal=1.0)
M_PLACCA = mat("placca_wc", (0.93, 0.93, 0.92), 0.3)
M_SCARICO = mat("scarico_scuro", (0.10, 0.10, 0.11), 0.4)

def _sp(x, p): return math.copysign(abs(x) ** p, x)

def _contorno(u0, u1, w, n=56, dietro=7.0, davanti=3.2, stringe=0.07):
    """Contorno in pianta in coordinate locali (u = distanza dal muro, v = di lato). Dietro (verso il muro) quasi
    squadrato, davanti arrotondato a uovo e un po' più stretto, come un vaso sospeso vero."""
    uc, a, b = (u0 + u1) / 2, (u1 - u0) / 2, w / 2; pts = []
    for k in range(n):
        t = 2 * math.pi * k / n; c, s = math.cos(t), math.sin(t)
        u = uc + a * _sp(c, 2.0 / (dietro if c < 0 else davanti))
        v = b * _sp(s, 2.0 / (dietro if c < 0 else davanti)) * (1 - stringe * max(0.0, (u - uc) / a))
        pts.append((u, v))
    return pts

def _mondo(x, y, dorso):
    """trasforma (u, v) locali in coordinate di disegno: u si allontana dal muro che sta sul lato 'dorso'"""
    d = {"n": (0, -1), "s": (0, 1), "o": (-1, 0), "e": (1, 0)}[dorso]
    return lambda u, v: (x - d[0] * u + (-d[1]) * v, y - d[1] * u + d[0] * v)

def _solido(nome, anelli, m, liscio=40):
    """anelli = [(z, [(x, y), ...])] dal basso in alto, tutti con lo stesso numero di punti: li unisce e chiude sotto e sopra"""
    bm = _bms.new(); R = []
    for z, pts in anelli: R.append([bm.verts.new((px, -py, z)) for (px, py) in pts])
    n = len(R[0])
    bm.faces.new(R[0][::-1])
    for a, b in zip(R, R[1:]):
        for i in range(n): bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    bm.faces.new(R[-1])
    _bms.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(nome); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(nome, me); bpy.context.collection.objects.link(o); me.materials.append(m)
    for p in me.polygons: p.use_smooth = True
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    try: bpy.ops.object.shade_smooth_by_angle(angle=math.radians(liscio))
    except Exception: pass
    return reg(o)

def _anelli(f, sezioni, u0, u1, w, **kw):
    """sezioni = [(z, scala_lunghezza, scala_larghezza, rientro_dal_muro)]: ogni anello è il contorno scalato"""
    out = []
    for z, sl, sw, du in sezioni:
        out.append((z, [f(u, v) for (u, v) in _contorno(u0 + du, u0 + du + (u1 - u0) * sl, w * sw, **kw)]))
    return out

def controparete(nome, x, y, dorso, z, da, a, prof=0.15, alto=1.10, m=None):
    """Controparete in muratura che nasconde la cassetta: da..a lungo il muro, profonda 'prof', alta 'alto'."""
    if dorso in ("n", "s"):
        y0, y1 = (y, y + prof) if dorso == "n" else (y - prof, y)
        box(nome, da, y0, a, y1, z, z + alto, m or M_MURO)
        box(nome + "_mensola", da - 0.01, y0 - (0.01 if dorso == "s" else 0), a + 0.01, y1 + (0.01 if dorso == "n" else 0), z + alto, z + alto + 0.02, M_TOP_LEGNO)
    else:
        x0, x1 = (x, x + prof) if dorso == "o" else (x - prof, x)
        box(nome, x0, da, x1, a, z, z + alto, m or M_MURO)
        box(nome + "_mensola", x0 - (0.01 if dorso == "e" else 0), da - 0.01, x1 + (0.01 if dorso == "o" else 0), a + 0.01, z + alto, z + alto + 0.02, M_TOP_LEGNO)

def wc_sospeso(nome, x, y, z, dorso, contro=True, L=0.53, W=0.36, h=0.40):
    """WC sospeso (53 x 36 cm, bordo a 40 cm): vaso in ceramica, sedile e coperchio chiusi, cerniere cromate,
    placca di scarico sulla controparete. (x, y) = punto sul muro finito, al centro del vaso."""
    # contro: True = controparete di 66 cm centrata, (da, a) = tratto lungo il muro, "esistente" = già fatta da un altro sanitario
    P = 0.15 if contro else 0.0
    if contro and contro != "esistente":
        da, a = contro if isinstance(contro, tuple) else (None, None)
        c = x if dorso in ("n", "s") else y
        controparete(nome + "_controparete", x, y, dorso, z, da if da is not None else c - 0.33, a if a is not None else c + 0.33)
    f = _mondo(x, y, dorso); u0 = P
    # vaso: sotto rientra verso il muro (la ceramica sale in diagonale), sopra il bordo è arrotondato
    vaso = _anelli(f, [(z + h - 0.30, 0.42, 0.62, 0.0), (z + h - 0.27, 0.62, 0.80, 0.0), (z + h - 0.20, 0.84, 0.93, 0.0),
                       (z + h - 0.11, 0.96, 0.99, 0.0), (z + h - 0.035, 1.0, 1.0, 0.0), (z + h - 0.012, 0.995, 0.985, 0.0),
                       (z + h - 0.004, 0.975, 0.955, 0.004)], u0, u0 + L, W)
    _solido(nome + "_vaso", vaso, M_CERAMICA_V)
    # sedile (anello sottile) e coperchio leggermente bombato, un filo più corti del vaso verso il muro (spazio delle cerniere)
    sed = _anelli(f, [(z + h - 0.003, 0.88, 0.97, 0.06), (z + h + 0.012, 0.88, 0.97, 0.06), (z + h + 0.016, 0.86, 0.95, 0.065)], u0, u0 + L, W)
    _solido(nome + "_sedile", sed, M_CERAMICA_V)
    cop = _anelli(f, [(z + h + 0.017, 0.875, 0.965, 0.062), (z + h + 0.034, 0.87, 0.955, 0.064), (z + h + 0.044, 0.82, 0.90, 0.08)], u0, u0 + L, W)
    _solido(nome + "_coperchio", cop, M_CERAMICA_V)
    for s in (-1, 1):
        cx, cy = f(u0 + 0.035, s * 0.11); cil(nome + "_cerniera", cx, cy, 0.012, z + h - 0.002, z + h + 0.03, M_CROMO, 16)
    # placca di scarico (doppio tasto) sulla controparete, vicino al bordo alto
    if contro:
        _placca(nome, f, P, z + 0.86)

def _placca(nome, f, P, zb):
    (ax, ay), (bx, by) = f(P - 0.004, -0.12), f(P + 0.004, 0.12)
    box(nome + "_placca", min(ax, bx), min(ay, by), max(ax, bx), max(ay, by), zb, zb + 0.16, M_PLACCA, 0.004)
    for v0, v1 in ((-0.105, -0.005), (0.005, 0.105)):
        (ax, ay), (bx, by) = f(P + 0.004, v0), f(P + 0.008, v1)
        box(nome + "_tasto", min(ax, bx), min(ay, by), max(ax, bx), max(ay, by), zb + 0.02, zb + 0.14, M_BIANCO, 0.003)

def bidet_sospeso(nome, x, y, z, dorso, contro=True, L=0.53, W=0.36, h=0.40):
    """Bidet sospeso gemello del WC: vaso con la vasca incavata, piletta, miscelatore monoforo sul retro."""
    P = 0.15 if contro else 0.0
    if contro and contro != "esistente":
        c = x if dorso in ("n", "s") else y
        da, a = contro if isinstance(contro, tuple) else (c - 0.33, c + 0.33)
        controparete(nome + "_controparete", x, y, dorso, z, da, a)
    f = _mondo(x, y, dorso); u0 = P
    est = [(z + h - 0.30, 0.42, 0.62, 0.0), (z + h - 0.27, 0.62, 0.80, 0.0), (z + h - 0.20, 0.84, 0.93, 0.0),
           (z + h - 0.11, 0.96, 0.99, 0.0), (z + h - 0.035, 1.0, 1.0, 0.0), (z + h - 0.008, 0.99, 0.98, 0.002), (z + h, 0.975, 0.955, 0.006)]
    # dentro: dal bordo (spesso 3 cm) la vasca scende fino a 13 cm sotto; il retro resta piano per il rubinetto
    dentro = [(z + h, 0.70, 0.78, 0.13), (z + h - 0.02, 0.67, 0.74, 0.14), (z + h - 0.08, 0.58, 0.62, 0.16), (z + h - 0.12, 0.40, 0.42, 0.21), (z + h - 0.13, 0.22, 0.24, 0.27)]
    anelli = _anelli(f, est, u0, u0 + L, W) + _anelli(f, dentro, u0, u0 + L, W)
    _solido(nome + "_vaso", anelli, M_CERAMICA_V)
    cx, cy = f(u0 + 0.13 + 0.27 * L / 1.0 * 0.5 + 0.06, 0.0); cil(nome + "_piletta", cx, cy, 0.022, z + h - 0.132, z + h - 0.128, M_CROMO, 20)
    # miscelatore: corpo cilindrico, bocca corta verso la vasca, leva sopra
    mx, my = f(u0 + 0.07, 0.0)
    cil(nome + "_miscelatore", mx, my, 0.02, z + h - 0.006, z + h + 0.075, M_CROMO, 20)
    bx, by = f(u0 + 0.13, 0.0)
    box(nome + "_bocca", min(mx, bx) - 0.008, min(my, by) - 0.008, max(mx, bx) + 0.008, max(my, by) + 0.008, z + h + 0.045, z + h + 0.06, M_CROMO, 0.004)
    lx, ly = f(u0 + 0.03, 0.0)
    box(nome + "_leva", min(mx, lx) - 0.005, min(my, ly) - 0.005, max(mx, lx) + 0.005, max(my, ly) + 0.005, z + h + 0.075, z + h + 0.085, M_CROMO, 0.003)

def lavabo_appoggio(nome, x, y, z, lungo=0.50, largo=0.38, alto=0.13, asse="x", lato_parete="n", parete=None, forma=3.0):
    """Lavabo da appoggio in ceramica con la vasca vera: parete sottile (1 cm), bordo arrotondato, fondo che scende verso
    la piletta. forma = 2 tondo/ovale, 3 rettangolo morbido. Rubinetto a muro sul lato_parete; 'parete' = coordinata del muro
    (x per o/e, y per n/s); se manca il rubinetto si appoggia sul bordo dietro."""
    sx, sy = (lungo, largo) if asse == "x" else (largo, lungo)
    def anello(z_, s, n=56):
        return (z_, [(x + sx / 2 * s * _sp(math.cos(2 * math.pi * k / n), 2 / forma), y + sy / 2 * s * _sp(math.sin(2 * math.pi * k / n), 2 / forma)) for k in range(n)])
    d = 0.012 / (min(sx, sy) / 2)   # spessore della parete in proporzione
    anelli = [anello(z, 0.90), anello(z + 0.012, 0.96), anello(z + 0.04, 0.99), anello(z + alto - 0.012, 1.0), anello(z + alto - 0.002, 0.995),
              anello(z + alto, 0.985 - d * 0.5), anello(z + alto - 0.004, 1.0 - d * 1.2), anello(z + alto - 0.03, 0.985 - d * 1.3),
              anello(z + 0.06, 0.86 - d), anello(z + 0.03, 0.55), anello(z + 0.022, 0.12)]
    _solido(nome + "_vasca", anelli, M_CERAMICA_V, liscio=50)
    cil(nome + "_piletta", x, y, 0.02, z + 0.022, z + 0.026, M_CROMO, 20)
    rubinetto_muro(nome, x, y, z + alto + 0.10, lato_parete, parete if parete is not None else ((y - sy / 2 - 0.05) if lato_parete == "n" else (y + sy / 2 + 0.05) if lato_parete == "s" else (x - sx / 2 - 0.05) if lato_parete == "o" else (x + sx / 2 + 0.05)), min(sx, sy) * 0.3)

def rubinetto_muro(nome, x, y, z, lato, parete, sporge_oltre=0.12):
    """Rubinetto a muro: rosetta tonda, bocca cilindrica che arriva sopra la vasca con la punta piegata in giù,
    e una seconda rosetta con la leva del miscelatore sopra."""
    d = {"n": (0, -1), "s": (0, 1), "o": (-1, 0), "e": (1, 0)}[lato]
    # punto del muro davanti al lavabo
    wx, wy = (x, parete) if d[1] else (parete, y)
    lun = abs((y - wy) if d[1] else (x - wx)) - sporge_oltre * 0.3
    pts = [(wx, wy, z), (wx - d[0] * lun, wy - d[1] * lun, z), (wx - d[0] * (lun + 0.012), wy - d[1] * (lun + 0.012), z - 0.012), (wx - d[0] * (lun + 0.016), wy - d[1] * (lun + 0.016), z - 0.03)]
    cu = bpy.data.curves.new(nome + "_bocca", "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 0.011; cu.bevel_resolution = 4; cu.use_fill_caps = True
    sp = cu.splines.new("POLY"); sp.points.add(len(pts) - 1)
    for i, (px, py, pz) in enumerate(pts): sp.points[i].co = (px, -py, pz, 1)
    o = bpy.data.objects.new(nome + "_bocca", cu); bpy.context.collection.objects.link(o); cu.materials.append(M_CROMO); reg(o)
    for zz, r in ((z, 0.032), (z + 0.13, 0.03)):
        if d[1]: box(nome + "_rosetta", wx - r, min(wy, wy - d[1] * 0.012), wx + r, max(wy, wy - d[1] * 0.012), zz - r, zz + r, M_CROMO, 0.01)
        else: box(nome + "_rosetta", min(wx, wx - d[0] * 0.012), wy - r, max(wx, wx - d[0] * 0.012), wy + r, zz - r, zz + r, M_CROMO, 0.01)
    zl = z + 0.13
    if d[1]: box(nome + "_leva", wx - 0.006, min(wy, wy - d[1] * 0.09), wx + 0.006, max(wy, wy - d[1] * 0.09), zl - 0.006, zl + 0.006, M_CROMO, 0.004)
    else: box(nome + "_leva", min(wx, wx - d[0] * 0.09), wy - 0.006, max(wx, wx - d[0] * 0.09), wy + 0.006, zl - 0.006, zl + 0.006, M_CROMO, 0.004)

def doccia(nome, x0, y0, x1, y1, z, lato_muro, vetri=(), canalina="muro", alto_vetro=None):
    """Piatto doccia in resina a filo pavimento con canalina di scarico lungo il muro, miscelatore e doccetta su asta
    sul muro, vetri fissi con profilo nero. vetri = [(xa, ya, xb, yb)] linee dei vetri."""
    box(nome + "_piatto", x0, y0, x1, y1, z, z + 0.02, M_RESINA, 0.004)
    d = {"n": (0, -1), "s": (0, 1), "o": (-1, 0), "e": (1, 0)}[lato_muro]
    if d[1]:
        yw = y0 if d[1] < 0 else y1; yc = yw - d[1] * 0.1
        box(nome + "_canalina", x0 + 0.1, min(yc, yc - d[1] * 0.04), x1 - 0.1, max(yc, yc - d[1] * 0.04), z + 0.02, z + 0.022, M_SCARICO)
        mx, my = (x0 + x1) / 2, yw
    else:
        xw = x0 if d[0] < 0 else x1; xc = xw - d[0] * 0.1
        box(nome + "_canalina", min(xc, xc - d[0] * 0.04), y0 + 0.1, max(xc, xc - d[0] * 0.04), y1 - 0.1, z + 0.02, z + 0.022, M_SCARICO)
        mx, my = xw, (y0 + y1) / 2
    # miscelatore termostatico (piastra con due manopole) e asta con doccetta, sul muro
    if d[1]:
        box(nome + "_miscelatore", mx - 0.12, min(my, my - d[1] * 0.012), mx + 0.12, max(my, my - d[1] * 0.012), z + 0.95, z + 1.03, M_CROMO, 0.006)
        for s in (-1, 1): cil(nome + "_manopola", mx + s * 0.08, my - d[1] * 0.03, 0.025, z + 0.965, z + 1.015, M_CROMO, 20)
        box(nome + "_asta", mx + 0.25, min(my, my - d[1] * 0.03), mx + 0.265, max(my, my - d[1] * 0.03), z + 0.6, z + 1.15, M_CROMO)
        box(nome + "_doccetta", mx + 0.235, min(my - d[1] * 0.03, my - d[1] * 0.06), mx + 0.28, max(my - d[1] * 0.03, my - d[1] * 0.06), z + 1.0, z + 1.12, M_CROMO, 0.01)
    else:
        box(nome + "_miscelatore", min(mx, mx - d[0] * 0.012), my - 0.12, max(mx, mx - d[0] * 0.012), my + 0.12, z + 0.95, z + 1.03, M_CROMO, 0.006)
        for s in (-1, 1):
            o = cil(nome + "_manopola", mx - d[0] * 0.03, my + s * 0.08, 0.025, z + 0.965, z + 1.015, M_CROMO, 20)
        box(nome + "_asta", min(mx, mx - d[0] * 0.03), my + 0.25, max(mx, mx - d[0] * 0.03), my + 0.265, z + 0.6, z + 1.15, M_CROMO)
        box(nome + "_doccetta", min(mx - d[0] * 0.03, mx - d[0] * 0.06), my + 0.235, max(mx - d[0] * 0.03, mx - d[0] * 0.06), my + 0.28, z + 1.0, z + 1.12, M_CROMO, 0.01)
    alto = alto_vetro or CUT
    for (xa, ya, xb, yb) in vetri:
        if abs(xb - xa) >= abs(yb - ya):
            box(nome + "_vetro", xa, ya - 0.004, xb, ya + 0.004, z + 0.02, z + alto, M_VETRO)
            box(nome + "_profilo", xa, ya - 0.012, xb, ya + 0.012, z + 0.02, z + 0.045, M_PROFILO)
            box(nome + "_profilo", xb - 0.02, ya - 0.012, xb, ya + 0.012, z + 0.02, z + alto, M_PROFILO)
        else:
            box(nome + "_vetro", xa - 0.004, ya, xa + 0.004, yb, z + 0.02, z + alto, M_VETRO)
            box(nome + "_profilo", xa - 0.012, ya, xa + 0.012, yb, z + 0.02, z + 0.045, M_PROFILO)
            box(nome + "_profilo", xa - 0.012, yb - 0.02, xa + 0.012, yb, z + 0.02, z + alto, M_PROFILO)
