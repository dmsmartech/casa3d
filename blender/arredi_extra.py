# Arredi curati riusabili (si includono nel modello della casa con exec, come base_helpers.py): poltrona moderna, tavolino tondo, abat-jour, iMac, softbox
# fotografico su stativo, fotocamera su treppiede, vestiti appesi e piegati per una cabina armadio.
# Coordinate di disegno (y verso sud) come base_helpers.
import math, bmesh as _bmx, mathutils as _mux

M_BOUCLE = mat("boucle_avorio", (0.86, 0.83, 0.77), 1.0)
M_OTTONE = mat("ottone", (0.80, 0.62, 0.32), 0.25, metal=1.0)
M_ALLUMINIO = mat("alluminio", (0.80, 0.81, 0.83), 0.3, metal=1.0)
M_SCHERMO = mat("schermo_spento", (0.02, 0.02, 0.025), 0.06)
M_TESSUTO_NERO = mat("tessuto_softbox", (0.03, 0.03, 0.035), 0.9)

def _curva(nome, pts, r, m, cap=True):
    """tubo che passa per i punti (coordinate di disegno, z vera)"""
    cu = bpy.data.curves.new(nome, "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = r; cu.bevel_resolution = 3; cu.use_fill_caps = cap
    sp = cu.splines.new("POLY"); sp.points.add(len(pts) - 1)
    for i, (px, py, pz) in enumerate(pts): sp.points[i].co = (px, -py, pz, 1)
    o = bpy.data.objects.new(nome, cu); bpy.context.collection.objects.link(o); cu.materials.append(m)
    return reg(o)

def _punta(o, da, verso):
    """ruota l'oggetto (costruito con l'asse -Z come 'davanti') perché guardi da 'da' verso 'verso' (coordinate di disegno)"""
    d = _mux.Vector((verso[0] - da[0], -(verso[1] - da[1]), verso[2] - da[2]))
    o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

def _stacca(objs, via=()):
    """toglie il 'genitore' tenendo la posizione nel mondo (la cottura vuole oggetti indipendenti); 'via' = vuoti da eliminare"""
    bpy.context.view_layer.update()
    for o in objs:
        w = o.matrix_world.copy(); o.parent = None; o.matrix_world = w
    for v in via: bpy.data.objects.remove(v, do_unlink=True)

def poltrona_moderna(nome, x0, y0, x1, y1, z, dorso, m=None, gambe=None):
    """Poltrona lounge contemporanea: scocca imbottita avvolgente (schienale e braccioli in un unico abbraccio morbido),
    cuscino di seduta gonfio, quattro gambe sottili in rovere leggermente rastremate."""
    m = m or M_BOUCLE; gambe = gambe or M_LEGNO
    L, P, bx = _locale(x0, y0, x1, y1, dorso)
    c = bx(0.02, L - 0.02, 0.03, P - 0.03); imbottito(nome + "_scocca", c[0], c[1], c[2], c[3], z + 0.17, z + 0.36, m, 0.09, 0.012, 0.5, 0.002, 5.0, 12, seme=1)
    c = bx(0.0, L, 0.0, 0.2); a, ax = _incl(dorso, 12.0)
    imbottito(nome + "_schienale", c[0], c[1], c[2], c[3], z + 0.3, z + 0.82, m, 0.09, 0.02, 0.6, 0.003, 5.0, 12, incl=a, asse=ax, seme=2)
    for i, (u0, u1) in enumerate(((0.0, 0.15), (L - 0.15, L))):
        c = bx(u0, u1, 0.06, P - 0.04); imbottito(nome + "_bracciolo", c[0], c[1], c[2], c[3], z + 0.3, z + 0.62, m, 0.07, 0.015, 0.5, 0.002, 5.0, 10, seme=3 + i)
    c = bx(0.14, L - 0.14, 0.17, P - 0.03); imbottito(nome + "_seduta", c[0], c[1], c[2], c[3], z + 0.35, z + 0.47, m, 0.05, 0.03, 0.5, 0.003, 6.0, 12, seme=5)
    for (u, v) in ((0.1, 0.1), (L - 0.1, 0.1), (0.1, P - 0.1), (L - 0.1, P - 0.1)):
        c = bx(u, u, v, v); cx, cy = c[0], c[1]
        _curva(nome + "_gamba", [(cx, cy, z), (cx + (0.02 if u < L / 2 else -0.02) * 0, cy, z + 0.18)], 0.016, gambe)

def tavolino_tondo(nome, x, y, z, r=0.24, alto=0.5, m_top=None):
    """Tavolino tondo con piano in rovere e base a stelo nero"""
    cil(nome + "_piano", x, y, r, z + alto - 0.025, z + alto, m_top or M_LEGNO, 40)
    cil(nome + "_stelo", x, y, 0.025, z + 0.02, z + alto - 0.025, M_NERO, 16)
    cil(nome + "_base", x, y, r * 0.7, z, z + 0.02, M_NERO, 32)

def abat_jour(nome, x, y, z, m_luce=None):
    """Lampada da comodino: base in ceramica, paralume in tessuto che si accende (nome + '_paralume')"""
    cil(nome + "_base", x, y, 0.07, z, z + 0.02, M_CERAMICA, 24)
    sfera(nome + "_corpo", x, y, z + 0.13, 0.075, M_COTTO_VASO, 1, 1, 1.5)
    cil(nome + "_stelo", x, y, 0.006, z + 0.24, z + 0.3, M_OTTONE, 8)
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.13, radius2=0.09, depth=0.18, end_fill_type="NOTHING", location=(x, -y, z + 0.38))
    o = bpy.context.object; o.name = nome + "_paralume"; o.data.materials.append(m_luce or M_LAMPADA); reg(o)
    sol = o.modifiers.new("spessore", "SOLIDIFY"); sol.thickness = 0.004

def imac(nome, x, y, z, verso="e", colore=None):
    """iMac 24": schermo 54,7 x 46,1 cm spesso 1,15 cm su piede ad L in alluminio, retro colorato, bordo bianco attorno al vetro.
    (x, y) = centro del piede, z = piano del tavolo, verso = dove guarda lo schermo."""
    colore = colore or mat("imac_blu", (0.36, 0.52, 0.68), 0.35, metal=0.4)
    d = {"n": (0, -1), "s": (0, 1), "o": (-1, 0), "e": (1, 0)}[verso]; px_, py_ = -d[1], d[0]
    def rett(nm, du0, du1, w, z0, z1, m, bev=0.0):
        # du = distanza in avanti dal centro del piede, w = metà larghezza
        ax, ay = x + d[0] * du0 + px_ * -w, y + d[1] * du0 + py_ * -w; bx_, by_ = x + d[0] * du1 + px_ * w, y + d[1] * du1 + py_ * w
        return box(nm, min(ax, bx_), min(ay, by_), max(ax, bx_), max(ay, by_), z0, z1, m, bev)
    rett(nome + "_piede", -0.07, 0.08, 0.075, z, z + 0.006, M_ALLUMINIO, 0.003)
    rett(nome + "_collo", -0.07, -0.058, 0.075, z, z + 0.2, M_ALLUMINIO, 0.002)
    zb = z + 0.12
    rett(nome + "_retro", -0.058, -0.046, 0.2735, zb, zb + 0.461, colore, 0.004)
    rett(nome + "_mento", -0.046, -0.045, 0.2735, zb, zb + 0.07, colore)
    rett(nome + "_cornice", -0.046, -0.0445, 0.2735, zb + 0.07, zb + 0.461, M_BIANCO)
    rett(nome + "_schermo", -0.0445, -0.0440, 0.255, zb + 0.08, zb + 0.445, M_SCHERMO)

def tastiera_mouse(nome, x, y, z, verso="e"):
    if verso in ("e", "o"):
        box(nome + "_tastiera", x - 0.06, y - 0.14, x + 0.06, y + 0.14, z, z + 0.008, M_BIANCO, 0.003)
        sfera(nome + "_mouse", x, y + 0.25, z + 0.01, 0.03, M_BIANCO, 0.9, 1.9, 0.35)
    else:
        box(nome + "_tastiera", x - 0.14, y - 0.06, x + 0.14, y + 0.06, z, z + 0.008, M_BIANCO, 0.003)
        sfera(nome + "_mouse", x + 0.25, y, z + 0.01, 0.03, M_BIANCO, 1.9, 0.9, 0.35)

def _treppiede(nome, x, y, z, alto, apertura, r_gamba=0.011, m=None):
    """tre gambe da (x, y, alto) a terra su un cerchio di raggio 'apertura', con crociera a metà"""
    m = m or M_NERO; piedi = []
    for k in range(3):
        a = math.radians(90 + 120 * k); fx, fy = x + apertura * math.cos(a), y + apertura * math.sin(a); piedi.append((fx, fy))
        _curva(f"{nome}_gamba_{k}", [(x + 0.03 * math.cos(a), y + 0.03 * math.sin(a), z + alto), (fx, fy, z + 0.01)], r_gamba, m)
        _curva(f"{nome}_crociera_{k}", [(x, y, z + alto * 0.45), (x + apertura * 0.55 * math.cos(a), y + apertura * 0.55 * math.sin(a), z + alto * 0.45)], r_gamba * 0.5, m)
        cil(f"{nome}_piedino_{k}", fx, fy, r_gamba * 1.6, z, z + 0.015, M_ZOCCOLO, 10)
    cil(nome + "_snodo", x, y, 0.03, z + alto - 0.03, z + alto + 0.01, m, 16)
    return piedi

def softbox_fotografico(nome, x, y, z, bersaglio, alto=1.6, lato=0.6, prof=0.38):
    """Softbox fotografico vero: stativo a tre gambe, asta, snodo e box a piramide in tessuto nero con il diffusore bianco
    davanti (nome + '_diffusore', si accende), girato e inclinato verso il 'bersaglio' (x, y, z)."""
    _treppiede(nome + "_stativo", x, y, z, 0.7, 0.42)
    cil(nome + "_asta", x, y, 0.014, z + 0.7, z + alto, M_NERO, 12)
    cil(nome + "_snodo_box", x, y, 0.035, z + alto - 0.03, z + alto + 0.03, M_NERO, 16)
    # piramide tronca: dietro piccolo (attacco della luce), davanti grande; costruita con il davanti verso -Z locale
    bm = _bmx.new(); h1, h0 = lato / 2, 0.09
    dietro = [bm.verts.new((sx * h0, sy * h0, prof * 0.3)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    davanti = [bm.verts.new((sx * h1, sy * h1, -prof * 0.7)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    bm.faces.new(dietro[::-1])
    for i in range(4): bm.faces.new((dietro[i], dietro[(i + 1) % 4], davanti[(i + 1) % 4], davanti[i]))
    _bmx.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(nome + "_box"); bm.to_mesh(me); bm.free()
    cx, cy, cz = x, y, z + alto + 0.04
    o = bpy.data.objects.new(nome + "_box", me); bpy.context.collection.objects.link(o); me.materials.append(M_TESSUTO_NERO)
    o.location = (cx, -cy, cz); _punta(o, (cx, cy, cz), bersaglio); reg(o)
    sol = o.modifiers.new("spessore", "SOLIDIFY"); sol.thickness = 0.006
    # diffusore bianco sul davanti, un filo più dentro del bordo
    bpy.ops.mesh.primitive_plane_add(size=lato * 0.97, location=(0, 0, 0))
    df = bpy.context.object; df.name = nome + "_diffusore"; df.data.materials.append(M_SOFTBOX if "M_SOFTBOX" in globals() else M_LAMPADA)
    df.parent = o; df.location = (0, 0, -prof * 0.7 + 0.004); reg(df)
    # luce: rettangolo che illumina verso il bersaglio
    bpy.ops.object.light_add(type="AREA"); l = bpy.context.object; l.name = "L_" + nome; l.data.shape = "SQUARE"; l.data.size = lato * 0.9
    l.data.energy = 70.0; l.data.color = (1.0, 0.97, 0.93); l.parent = o; l.location = (0, 0, -prof * 0.7 - 0.01); reg(l)
    _stacca([df, l])
    return l.name

def fotocamera_treppiede(nome, x, y, z, bersaglio, alto=1.35):
    """Treppiede fotografico (tre gambe in alluminio scuro con crociera, colonna centrale, testa) e una mirrorless con
    obiettivo, girata verso il 'bersaglio'."""
    _treppiede(nome + "_treppiede", x, y, z, alto - 0.12, 0.42, 0.012, M_ZOCCOLO)
    cil(nome + "_colonna", x, y, 0.016, z + alto - 0.4, z + alto - 0.06, M_ZOCCOLO, 12)
    cil(nome + "_testa", x, y, 0.028, z + alto - 0.07, z + alto - 0.04, M_NERO, 16)
    # corpo macchina costruito attorno all'origine, davanti verso -Z locale, poi girato verso il bersaglio
    parti = []
    def pezzo(nm, sx, sy, sz, cx_, cy_, cz_, m, bev=0.006):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(cx_, cy_, cz_)); p = bpy.context.object; p.name = nm; p.scale = (sx, sy, sz)
        bpy.ops.object.transform_apply(scale=True); p.data.materials.append(m)
        if bev: b = p.modifiers.new("b", "BEVEL"); b.width = bev; b.segments = 3
        parti.append(p); return p
    pezzo(nome + "_corpo", 0.13, 0.085, 0.045, 0, 0, 0, M_NERO)              # x largo, y alto, z profondo
    pezzo(nome + "_impugnatura", 0.035, 0.08, 0.06, 0.05, -0.002, -0.012, M_ZOCCOLO)
    pezzo(nome + "_mirino", 0.05, 0.03, 0.045, 0, 0.055, 0.002, M_NERO, 0.008)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.036, depth=0.11, location=(-0.008, 0, -0.075)); ob = bpy.context.object
    ob.name = nome + "_obiettivo"; ob.data.materials.append(M_NERO); parti.append(ob)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.03, depth=0.004, location=(-0.008, 0, -0.131)); vv = bpy.context.object
    vv.name = nome + "_lente"; vv.data.materials.append(M_SCHERMO); parti.append(vv)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.055, 0)); vuoto = bpy.context.object; vuoto.name = nome + "_perno"; vuoto.scale = (0.03, 0.025, 0.03)
    bpy.ops.object.transform_apply(scale=True); vuoto.data.materials.append(M_NERO); parti.append(vuoto)
    piv = bpy.data.objects.new(nome + "_pivot", None); bpy.context.collection.objects.link(piv)
    cz = z + alto + 0.02; piv.location = (x, -y, cz); _punta(piv, (x, y, cz), bersaglio)
    for p in parti:
        p.parent = piv; reg(p)
    _stacca(parti, [piv])
    return parti

def vestiti_appesi(nome, x0, x1, y0, y1, z_asta, colori, seme=0, lunghi=(0.55, 0.85)):
    """Asta appendiabiti cromata lungo y (da y0 a y1) a profondità x0..x1 (asta al centro), con grucce in legno e capi
    appesi (giacche, camicie, abiti) di colori e lunghezze diverse."""
    import random as _r_
    rnd = _r_.Random(seme); xc = (x0 + x1) / 2
    box(nome + "_asta", xc - 0.008, y0, xc + 0.008, y1, z_asta - 0.008, z_asta + 0.008, M_CROMO if "M_CROMO" in globals() else M_ACCIAIO)
    yy = y0 + 0.06
    while yy < y1 - 0.06:
        sp = rnd.uniform(0.025, 0.05); lun = rnd.uniform(*lunghi); col = rnd.choice(colori)
        box(nome + "_gruccia", x0 + 0.03, yy, x1 - 0.03, yy + 0.012, z_asta - 0.05, z_asta - 0.035, M_LEGNO, 0.003)
        imbottito(nome + "_capo", x0 + 0.02, yy - sp / 2 + 0.006, x1 - 0.02, yy + sp / 2 + 0.006, z_asta - 0.05 - lun, z_asta - 0.045, col, min(sp, 0.08) * 0.45, 0.004, 0.3, 0.004, 8.0, 8, seme=seme + int(yy * 100))
        yy += sp + rnd.uniform(0.012, 0.03)

def maglioni_piegati(nome, x0, x1, y0, y1, z, colori, seme=0, pile=3):
    """Pile di capi piegati su un ripiano (da y0 a y1), x0..x1 = profondità del ripiano"""
    import random as _r_
    rnd = _r_.Random(seme); w = (y1 - y0) / pile
    for p in range(pile):
        zz = z
        for k in range(rnd.randint(2, 4)):
            h = rnd.uniform(0.035, 0.05)
            imbottito(f"{nome}_{p}_{k}", x0 + 0.03, y0 + p * w + 0.03, x1 - 0.04, y0 + (p + 1) * w - 0.03, zz, zz + h, rnd.choice(colori), 0.015, 0.006, 0.4, 0.002, 9.0, 6, seme=seme + p * 7 + k, fondo=True)
            zz += h

def scarpe(nome, x0, x1, y0, y1, z, colori, seme=0):
    """Paia di scarpe allineate su un ripiano (punta verso l'esterno, lungo x)"""
    import random as _r_
    rnd = _r_.Random(seme); yy = y0 + 0.04
    while yy < y1 - 0.2:
        col = rnd.choice(colori); h = rnd.choice((0.07, 0.08, 0.1))
        for dy in (0.0, 0.095):
            sfera(nome + "_scarpa", (x0 + x1) / 2, yy + dy + 0.04, z + h * 0.45, 0.13, col, (x1 - x0 - 0.06) / 0.26, 0.6, h / 0.13 * 0.55)
        yy += 0.24
