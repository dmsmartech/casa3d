# Oggetti più realistici condivisi dai due piani: porte con telaio e anta aperta, sedie vere, vetri inclinati della scala.
# Coordinate di disegno (y = -Y di Blender) come base_helpers.
import bmesh as _bm
M_MANIGLIA = mat("maniglia", (0.75, 0.75, 0.77), 0.3, metal=1.0)
M_TELAIO = mat("telaio_porta", (0.95, 0.95, 0.94), 0.35)
M_ANTA = mat("anta_porta", (0.96, 0.96, 0.95), 0.3)

def porta(nome, x0, y0, x1, y1, z, verso=1, cerniera=0, alto=None, m_anta=None, vetro=False):
    """Porta nel vano (x0,y0)-(x1,y1): due stipiti bianchi e l'anta aperta a 90°.
    verso: +1/-1 lato verso cui si apre (y se il vano è orizzontale, x se verticale); cerniera: 0 = estremo basso, 1 = alto."""
    alto = alto or CUT
    orizz = (x1 - x0) >= (y1 - y0); s = 0.06
    if orizz:
        box(nome + "_stipite", x0, y0 - 0.02, x0 + s, y1 + 0.02, z, z + alto, M_TELAIO)
        box(nome + "_stipite", x1 - s, y0 - 0.02, x1, y1 + 0.02, z, z + alto, M_TELAIO)
        w = (x1 - x0) - 2 * s; hx = x0 + s if cerniera == 0 else x1 - s - 0.04; ym = (y0 + y1) / 2
        ya, yb = (ym, ym + verso * w) if verso > 0 else (ym + verso * w, ym)
        box(nome + "_anta", hx, ya, hx + 0.04, yb, z + 0.01, z + alto, m_anta or (M_VETRO if vetro else M_ANTA), 0.005)
        ymn = yb - 0.08 if verso > 0 else ya + 0.04
        box(nome + "_maniglia", hx - 0.05, ymn, hx + 0.09, ymn + 0.03, z + 0.95, z + 0.98, M_MANIGLIA)
    else:
        box(nome + "_stipite", x0 - 0.02, y0, x1 + 0.02, y0 + s, z, z + alto, M_TELAIO)
        box(nome + "_stipite", x0 - 0.02, y1 - s, x1 + 0.02, y1, z, z + alto, M_TELAIO)
        w = (y1 - y0) - 2 * s; hy = y0 + s if cerniera == 0 else y1 - s - 0.04; xm = (x0 + x1) / 2
        xa, xb = (xm, xm + verso * w) if verso > 0 else (xm + verso * w, xm)
        box(nome + "_anta", xa, hy, xb, hy + 0.04, z + 0.01, z + alto, m_anta or (M_VETRO if vetro else M_ANTA), 0.005)
        xmn = xb - 0.08 if verso > 0 else xa + 0.04
        box(nome + "_maniglia", xmn, hy - 0.05, xmn + 0.03, hy + 0.09, z + 0.95, z + 0.98, M_MANIGLIA)

def sedia(nome, x, y, z, verso, m_telaio, m_seduta=None, larga=0.42, alta=0.46, schienale=0.86):
    """Sedia con quattro gambe, seduta e schienale; verso = lato dello schienale ('n','s','e','o')."""
    m_seduta = m_seduta or m_telaio; h = larga / 2; g = 0.02
    for (gx, gy) in ((-h + g, -h + g), (h - g, -h + g), (-h + g, h - g), (h - g, h - g)):
        box(nome + "_gamba", x + gx - g, y + gy - g, x + gx + g, y + gy + g, z, z + alta - 0.04, m_telaio)
    box(nome + "_seduta", x - h, y - h, x + h, y + h, z + alta - 0.04, z + alta, m_seduta, 0.015)
    d = {"n": (0, -h), "s": (0, h), "o": (-h, 0), "e": (h, 0)}[verso]
    if d[0] == 0: box(nome + "_schienale", x - h, y + d[1] - 0.02, x + h, y + d[1] + 0.02, z + alta, z + schienale, m_seduta, 0.015)
    else: box(nome + "_schienale", x + d[0] - 0.02, y - h, x + d[0] + 0.02, y + h, z + alta, z + schienale, m_seduta, 0.015)

def lastra_yz(nome, x0, x1, punti, m):
    """Lastra verticale nel piano y-z (punti = [(y, z)] del contorno), spessa da x0 a x1: vetri e cosciali inclinati."""
    me = bpy.data.meshes.new(nome); bm = _bm.new()
    a = [bm.verts.new((x0, -y, zz)) for (y, zz) in punti]; b = [bm.verts.new((x1, -y, zz)) for (y, zz) in punti]
    bm.faces.new(a); bm.faces.new(b[::-1]); n = len(punti)
    for i in range(n): bm.faces.new((a[i], b[i], b[(i + 1) % n], a[(i + 1) % n]))
    _bm.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(nome, me); bpy.context.collection.objects.link(o); me.materials.append(m)
    return reg(o)

# ---------- mobili veri: divani con cuscini, letti con coperta e guanciali, mobili con ante e maniglie, sanitari ----------
M_FUGA = mat("fuga_ante", (0.12, 0.12, 0.12), 0.8)
M_ZOCCOLO = mat("zoccolo", (0.18, 0.17, 0.16), 0.7)

def _locale(x0, y0, x1, y1, lato):
    """Riferimento locale: u lungo il lato, v in profondità a partire dal lato indicato."""
    if lato in ("n", "s"):
        L, P = x1 - x0, y1 - y0
        def bx(u0, u1, v0, v1): return (x0 + u0, (y0 + v0) if lato == "n" else (y1 - v1), x0 + u1, (y0 + v1) if lato == "n" else (y1 - v0))
    else:
        L, P = y1 - y0, x1 - x0
        def bx(u0, u1, v0, v1): return ((x0 + v0) if lato == "o" else (x1 - v1), y0 + u0, (x0 + v1) if lato == "o" else (x1 - v0), y0 + u1)
    return L, P, bx

# ---------- imbottiti morbidi: bordi tondi, cuscini gonfi, pieghe leggere ----------
import mathutils as _mu
from mathutils import noise as _nz
def imbottito(nome, x0, y0, x1, y1, z0, z1, m, r=None, gonfio=0.02, fianchi=0.4, pieghe=0.0, scala_p=7.0, cuts=14, incl=0.0, asse="x", seme=0, fondo=False):
    """Cuscino/imbottitura: scatola con spigoli arrotondati, sopra gonfia (gonfio, m), fianchi un po' tondi, pieghe di rumore (m).
    incl: inclinazione in gradi attorno all'asse locale (per gli schienali)."""
    sx, sy, sz = abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)
    r = min(r if r is not None else min(sx, sy, sz) * 0.4, min(sx, sy, sz) * 0.49)
    bm = _bm.new(); _bm.ops.create_cube(bm, size=1.0)
    _bm.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    h = (sx / 2 - r, sy / 2 - r, sz / 2 - r); off = _mu.Vector((seme * 3.1, seme * 1.7, seme * 2.3))
    for v in bm.verts:
        u = v.co * 2.0
        def _g(t, S):   # metà dei punti sulla parte piatta, metà sullo spigolo tondo: niente ombre a scalini nella cottura
            a = abs(t); hh = S / 2 - r
            q = a / 0.5 * hh if a <= 0.5 else hh + (a - 0.5) / 0.5 * r
            return q if t >= 0 else -q
        p = _mu.Vector((_g(u.x, sx), _g(u.y, sy), _g(u.z, sz)))
        c = _mu.Vector((max(-h[0], min(h[0], p.x)), max(-h[1], min(h[1], p.y)), max(-h[2], min(h[2], p.z))))
        d = p - c
        if d.length > 1e-9: p = c + d.normalized() * r
        f = max(0.0, 1 - u.x * u.x) * max(0.0, 1 - u.y * u.y)
        if u.z > 0: p.z += gonfio * f * u.z
        p.x += (1 if u.x > 0 else -1) * gonfio * fianchi * max(0.0, 1 - u.y * u.y) * max(0.0, 1 - u.z * u.z) * abs(u.x)
        p.y += (1 if u.y > 0 else -1) * gonfio * fianchi * max(0.0, 1 - u.x * u.x) * max(0.0, 1 - u.z * u.z) * abs(u.y)
        if pieghe:
            q = (p + off) * scala_p
            w = _nz.noise_vector(q) * 0.6 + _nz.noise_vector(q * 2.3) * 0.4
            p += _mu.Vector((w.x * 0.5, w.y * 0.5, w.z)) * pieghe * (0.4 + 0.6 * max(0.0, u.z))
        v.co = p
    if not fondo:
        via = [f for f in bm.faces if all(v.co.z < -sz / 2 + 0.002 for v in f.verts)]
        _bm.ops.delete(bm, geom=via, context="FACES")
    me = bpy.data.meshes.new(nome); bm.to_mesh(me); bm.free()
    for pl in me.polygons: pl.use_smooth = True
    o = bpy.data.objects.new(nome, me); bpy.context.collection.objects.link(o); me.materials.append(m)
    o.location = ((x0 + x1) / 2, -(y0 + y1) / 2, (z0 + z1) / 2); o["morbido"] = 1
    if incl:
        a = math.radians(incl)
        o.rotation_euler = (a, 0, 0) if asse == "x" else (0, a, 0)
    return reg(o)

def _incl(dorso, gradi):
    """Inclinazione all'indietro dello schienale: la cima va verso il lato del dorso."""
    return {"n": (-gradi, "x"), "s": (gradi, "x"), "o": (-gradi, "y"), "e": (gradi, "y")}[dorso]

def divano(nome, x0, y0, x1, y1, z, dorso, m, bracci=(True, True), seduta=0.42, schienale=0.82, piedi=None, chaise=False, seme=0):
    """Divano: telaio, braccioli imbottiti, cuscini di seduta gonfi e cuscini di schienale separati e inclinati."""
    L, P, bx = _locale(x0, y0, x1, y1, dorso)
    br = 0.17; a = br if bracci[0] else 0.0; b = L - (br if bracci[1] else 0.0)
    c = bx(0.02, L - 0.02, 0.02, P - 0.02); box(nome + "_base", c[0], c[1], c[2], c[3], z + 0.05, z + 0.22, m, 0.03)
    for i, (u0, u1, ok) in enumerate(((0, br, bracci[0]), (L - br, L, bracci[1]))):
        if ok: c = bx(u0, u1, 0, P); imbottito(nome + "_bracciolo", c[0], c[1], c[2], c[3], z + 0.05, z + 0.62, m, 0.06, 0.012, 0.6, 0.002, 5.0, 10, seme=seme + i)
    if not chaise:
        c = bx(0, L, 0, 0.18); imbottito(nome + "_dorso", c[0], c[1], c[2], c[3], z + 0.05, z + schienale - 0.14, m, 0.05, 0.008, 0.3, 0.0, cuts=10)
    n = max(1, round((b - a) / 0.8)); w = (b - a) / n; ang, ax = _incl(dorso, 9.0)
    for i in range(n):
        u0, u1 = a + i * w + 0.006, a + (i + 1) * w - 0.006
        c = bx(u0, u1, (0.04 if chaise else 0.17), P - 0.01)
        imbottito(nome + "_cuscino", c[0], c[1], c[2], c[3], z + 0.2, z + seduta, m, 0.07, 0.03, 0.5, 0.003, 6.0, seme=seme + 10 + i)
        if not chaise:
            c = bx(u0 + 0.01, u1 - 0.01, 0.03, 0.25)
            imbottito(nome + "_schienale", c[0], c[1], c[2], c[3], z + seduta - 0.03, z + schienale + 0.02, m, 0.08, 0.035, 0.7, 0.004, 5.0, incl=ang, asse=ax, seme=seme + 20 + i)
    for (u, v) in ((0.06, 0.06), (L - 0.06, 0.06), (0.06, P - 0.06), (L - 0.06, P - 0.06)):
        c = bx(u - 0.025, u + 0.025, v - 0.025, v + 0.025); box(nome + "_piede", c[0], c[1], c[2], c[3], z, z + 0.05, piedi or M_ACCIAIO)

def poltrona(nome, x0, y0, x1, y1, z, dorso, m):
    divano(nome, x0, y0, x1, y1, z, dorso, m, (True, True), 0.42, 0.78, seme=hash(nome) % 50)

def cuscinetto(nome, x, y, z, larg, spess, alt, verso, m, seme=0, incl=14.0):
    """Cuscino decorativo appoggiato allo schienale: quadrato gonfio con angoli a punta morbida, inclinato all'indietro."""
    ang, ax = _incl(verso, incl)
    if verso in ("n", "s"): x0, y0, x1, y1 = x - larg / 2, y - spess / 2, x + larg / 2, y + spess / 2
    else: x0, y0, x1, y1 = x - spess / 2, y - larg / 2, x + spess / 2, y + larg / 2
    return imbottito(nome, x0, y0, x1, y1, z, z + alt, m, min(spess, alt) * 0.45, spess * 0.25, 1.2, 0.004, 9.0, 10, incl=ang, asse=ax, seme=seme)

def drappo(nome, punti, larg, z_fn, m, spess=0.012, pieghe=0.012, scala_p=9.0, seme=0, nu=40, nv=14):
    """Coperta/plaid: striscia di tessuto che segue una polilinea (x,y) con altezza z_fn(t, s) (t lungo, s across in [-1,1]),
    con pieghe morbide; spessore costante."""
    pts = [_mu.Vector((q[0], -q[1], q[2] if len(q) > 2 else 0.0)) for q in punti]
    lun = [0.0]
    for i in range(1, len(pts)): lun.append(lun[-1] + (pts[i] - pts[i - 1]).length)
    tot = lun[-1]; bm = _bm.new(); grid = []
    off = _mu.Vector((seme * 2.7, seme * 1.3, 0))
    for i in range(nu + 1):
        t = i / nu; dist = t * tot; k = 1
        while k < len(pts) - 1 and lun[k] < dist: k += 1
        seg = pts[k] - pts[k - 1]; f = (dist - lun[k - 1]) / max(seg.length, 1e-6)
        c = pts[k - 1] + seg * f; dirz = seg.normalized(); perp = _mu.Vector((-dirz.y, dirz.x, 0))
        if perp.length < 1e-6: perp = _mu.Vector((1, 0, 0))
        perp.normalize(); zc = c.z
        riga = []
        for j in range(nv + 1):
            s = j / nv * 2 - 1
            p = c + perp * (s * larg / 2); p.z = z_fn(t, s) if z_fn else zc
            q = (p + off) * scala_p; w = _nz.noise(q) + 0.5 * _nz.noise(q * 2.1)
            p.z += w * pieghe; p.x += 0.3 * pieghe * _nz.noise(q + _mu.Vector((5, 0, 0))); p.y += 0.3 * pieghe * _nz.noise(q + _mu.Vector((0, 5, 0)))
            riga.append(bm.verts.new(p))
        grid.append(riga)
    for i in range(nu):
        for j in range(nv): bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    _bm.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(nome); bm.to_mesh(me); bm.free()
    for pl in me.polygons: pl.use_smooth = True
    o = bpy.data.objects.new(nome, me); bpy.context.collection.objects.link(o); me.materials.append(m)
    sol = o.modifiers.new("spessore", "SOLIDIFY"); sol.thickness = spess; sol.offset = 0.0
    o["morbido"] = 1
    return reg(o)

def piumone(nome, x0, y0, x1, y1, z_top, m, cadute, r=0.06, gonfio=0.04, spess=0.02, pieghe=0.006, seme=0, passo=0.03):
    """Piumone o plaid morbido: il rettangolo (x0..x1, y0..y1) è la parte che sta sopra il materasso, gonfia al centro;
    sui lati scende piegandosi con un bordo tondo (raggio r) e poi cade dritto per cadute[lato] metri
    (lati "n", "s", "e", "o"; 0 = solo il bordo tondo, es. verso la testata). Le pieghe crescono verso il basso.
    Sostituisce il vecchio parallelepipedo, che da vicino sembrava una lastra piatta."""
    q2 = math.pi * r / 2
    est = {k: (q2 + max(0.0, cadute.get(k, 0.0) - r)) if cadute.get(k, 0.0) > 0 else q2 for k in ("n", "s", "e", "o")}
    X0, X1, Y0, Y1 = x0 - est["o"], x1 + est["e"], y0 - est["n"], y1 + est["s"]
    nu = max(8, int((X1 - X0) / passo)); nv = max(8, int((Y1 - Y0) / passo))
    off = _mu.Vector((seme * 3.1, seme * 1.7, 0.0)); bm = _bm.new(); grid = []
    for i in range(nu + 1):
        riga = []
        for j in range(nv + 1):
            x = X0 + (X1 - X0) * i / nu; y = Y0 + (Y1 - Y0) * j / nv
            cx, cy = min(max(x, x0), x1), min(max(y, y0), y1); ox, oy = x - cx, y - cy; sd = math.hypot(ox, oy)
            uu, vv = (cx - x0) / max(x1 - x0, 1e-6), (cy - y0) / max(y1 - y0, 1e-6)
            bombe = (math.sin(math.pi * uu) * math.sin(math.pi * vv)) ** 0.5   # gonfio: massimo al centro, zero sul bordo
            if sd < 1e-9:
                px, py, z, giu = x, y, z_top + gonfio * bombe, 0.0
            else:
                dx, dy = ox / sd, oy / sd
                if sd < q2: h, d = r * math.sin(sd / r), r * (1 - math.cos(sd / r))
                else: h, d = r, r + (sd - q2)
                px, py, z, giu = cx + dx * h, cy + dy * h, z_top - d, d
            qn = _mu.Vector((px, py, 0.0)) * 7.0 + off
            w = _nz.noise(qn) + 0.5 * _nz.noise(qn * 2.3)
            z += w * pieghe
            # pieghe verticali sulla parte che cade: spostano il tessuto in fuori, di più in basso
            if giu > r:
                lungo = (px if abs(oy) > abs(ox) else py) * 9.0 + seme
                f = (0.5 + 0.5 * math.sin(lungo + 0.8 * _nz.noise(qn))) * min(1.0, (giu - r) / 0.12) * 0.014
                px += (ox / sd) * f; py += (oy / sd) * f
            riga.append(bm.verts.new((px, -py, z)))
        grid.append(riga)
    for i in range(nu):
        for j in range(nv): bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
    for f in bm.faces: f.smooth = True
    me = bpy.data.meshes.new(nome); bm.to_mesh(me); bm.free()
    if me.polygons and me.polygons[len(me.polygons) // 2].normal.z < 0: me.flip_normals()
    o = bpy.data.objects.new(nome, me); bpy.context.collection.objects.link(o); me.materials.append(m)
    sol = o.modifiers.new("spessore", "SOLIDIFY"); sol.thickness = spess; sol.offset = -1.0
    o["morbido"] = 1
    return reg(o)

def letto_vero(nome, x0, y0, x1, y1, z, testata, m_telaio, m_lenz, m_coperta, m_cuscino=None):
    """Letto imbottito: giroletto, testiera, materasso, piumone che scende sui lati, risvolto e due guanciali."""
    # testata su qualsiasi lato: "n", "s", "e", "o" (il kit originale accettava solo nord e sud)
    if testata not in ("n", "s", "e", "o"): raise ValueError(f"letto {nome}: testata deve essere n, s, e oppure o")
    lato = testata
    L, P, bx = _locale(x0, y0, x1, y1, lato)
    c = bx(0, L, 0.08, P); box(nome + "_giroletto", c[0], c[1], c[2], c[3], z + 0.06, z + 0.32, m_telaio, 0.03)
    c = bx(-0.03, L + 0.03, 0, 0.09); box(nome + "_testiera", c[0], c[1], c[2], c[3], z + 0.06, z + 1.05, m_telaio, 0.04)
    for (u, v) in ((0.08, 0.15), (L - 0.08, 0.15), (0.08, P - 0.08), (L - 0.08, P - 0.08)):
        c = bx(u - 0.03, u + 0.03, v - 0.03, v + 0.03); box(nome + "_piede", c[0], c[1], c[2], c[3], z, z + 0.06, M_ZOCCOLO)
    c = bx(0.03, L - 0.03, 0.11, P - 0.03); box(nome + "_materasso", c[0], c[1], c[2], c[3], z + 0.32, z + 0.53, m_lenz, 0.06)
    # piumone morbido: sopra il materasso, scende sui due fianchi e ai piedi; verso la testata solo il bordo tondo
    c = bx(0.03, L - 0.03, 0.62, P - 0.03); _lati = {"n": "s", "s": "n", "e": "o", "o": "e"}
    piumone(nome + "_piumone", c[0], c[1], c[2], c[3], z + 0.55, m_coperta,
            {k: (0.0 if k == lato else 0.21) for k in ("n", "s", "e", "o")}, seme=len(nome))
    c = bx(0.0, L, 0.55, 0.7); box(nome + "_risvolto", c[0], c[1], c[2], c[3], z + 0.4, z + 0.63, m_lenz, 0.06)
    n = 2 if L > 1.2 else 1
    for i in range(n):
        uc = L * (i + 0.5) / n
        c = bx(uc - 0.3, uc + 0.3, 0.14, 0.48); cx, cy = (c[0] + c[2]) / 2, (c[1] + c[3]) / 2
        sfera(nome + "_guanciale", cx, cy, z + 0.62, 0.3, m_cuscino or m_lenz, (c[2] - c[0]) / 0.6, (c[3] - c[1]) / 0.6, 0.32)

def mobile(nome, x0, y0, x1, y1, z0, z1, fronte, m, ante=2, cassetti=0, m_top=None, maniglia=True, zoccolo=0.08):
    """Mobile con zoccolo rientrato, ante e cassetti separati da fughe sottili, maniglie in acciaio."""
    L, P, bx = _locale(x0, y0, x1, y1, {"n": "n", "s": "s", "o": "o", "e": "e"}[fronte])
    c = bx(0, L, 0.05, P); box(nome + "_zoccolo", c[0], c[1], c[2], c[3], z0, z0 + zoccolo, M_ZOCCOLO)
    c = bx(0, L, 0.02, P); box(nome + "_corpo", c[0], c[1], c[2], c[3], z0 + zoccolo, z1, m, 0.004)
    if m_top: c = bx(-0.01, L + 0.01, -0.01, P); box(nome + "_top", c[0], c[1], c[2], c[3], z1, z1 + 0.03, m_top, 0.004)
    h = z1 - z0 - zoccolo; f = 0.004
    righe = [(z0 + zoccolo + h * i / max(1, cassetti + (1 if ante else 0)), z0 + zoccolo + h * (i + 1) / max(1, cassetti + (1 if ante else 0))) for i in range(cassetti + (1 if ante else 0))]
    for r, (za, zb) in enumerate(righe):
        k = ante if (ante and r == 0) else 1
        for i in range(k):
            u0, u1 = L * i / k + f, L * (i + 1) / k - f
            c = bx(u0, u1, 0.0, 0.02); box(nome + "_anta", c[0], c[1], c[2], c[3], za + f, zb - f, m, 0.003)
            if maniglia:
                if k > 1 and r == 0:
                    uu = u1 - 0.05 if i % 2 == 0 else u0 + 0.05
                    c = bx(uu - 0.008, uu + 0.008, -0.03, 0.0); box(nome + "_maniglia", c[0], c[1], c[2], c[3], (za + zb) / 2 - 0.08, (za + zb) / 2 + 0.08, M_MANIGLIA)
                else:
                    um = (u0 + u1) / 2
                    c = bx(um - 0.08, um + 0.08, -0.03, 0.0); box(nome + "_maniglia", c[0], c[1], c[2], c[3], zb - 0.06, zb - 0.045, M_MANIGLIA)

def tavolo(nome, x0, y0, x1, y1, z_top, m_top, m_gambe, spessore=0.04, rientro=0.06, g=0.05):
    box(nome + "_piano", x0, y0, x1, y1, z_top - spessore, z_top, m_top, 0.006)
    zb = z_top - spessore - (z_top - spessore - (z_top - 0.77)) if False else None
    for (gx, gy) in ((x0 + rientro, y0 + rientro), (x1 - rientro - g, y0 + rientro), (x0 + rientro, y1 - rientro - g), (x1 - rientro - g, y1 - rientro - g)):
        box(nome + "_gamba", gx, gy, gx + g, gy + g, z_top - 0.75, z_top - spessore, m_gambe)

def wc(nome, x, y, z, dorso, m):
    """Vaso sospeso: tazza ovale, sedile, cassetta a muro."""
    d = {"n": (0, -1), "s": (0, 1), "o": (-1, 0), "e": (1, 0)}[dorso]
    cx, cy = x - d[0] * 0.08, y - d[1] * 0.08
    sx, sy = (0.36, 0.5) if d[0] == 0 else (0.5, 0.36)
    sfera(nome + "_tazza", cx, cy, z + 0.3, 0.5, m, sx, sy, 0.22)
    box(nome + "_sedile", cx - sx / 2, cy - sy / 2, cx + sx / 2, cy + sy / 2, z + 0.4, z + 0.43, m, 0.12)
    tx, ty = x + d[0] * 0.2, y + d[1] * 0.2
    box(nome + "_cassetta", tx - (0.09 if d[0] else 0.25), ty - (0.25 if d[0] else 0.09), tx + (0.09 if d[0] else 0.25), ty + (0.25 if d[0] else 0.09), z, z + 0.85, m, 0.02)
    box(nome + "_placca", tx - d[0] * 0.095 - (0.005 if d[0] else 0.08), ty - d[1] * 0.095 - (0.08 if d[0] else 0.005), tx - d[0] * 0.095 + (0.005 if d[0] else 0.08), ty - d[1] * 0.095 + (0.08 if d[0] else 0.005), z + 0.65, z + 0.8, M_MANIGLIA)

def bidet(nome, x, y, z, dorso, m):
    d = {"n": (0, -1), "s": (0, 1), "o": (-1, 0), "e": (1, 0)}[dorso]
    sx, sy = (0.36, 0.5) if d[0] == 0 else (0.5, 0.36)
    sfera(nome + "_vaso", x, y, z + 0.28, 0.5, m, sx, sy, 0.24)
    cil(nome + "_rubinetto", x + d[0] * 0.17, y + d[1] * 0.17, 0.015, z + 0.38, z + 0.48, M_MANIGLIA, 12)

def lavabo_su(nome, x, y, z, m):
    """Lavabo ad appoggio con rubinetto."""
    cil(nome + "_vasca", x, y, 0.21, z, z + 0.13, m, 40)
    cil(nome + "_fondo", x, y, 0.17, z + 0.03, z + 0.131, M_GRIGIO if "M_GRIGIO" in globals() else m, 40)
    cil(nome + "_rubinetto", x, y - 0.25, 0.015, z, z + 0.25, M_MANIGLIA, 12)

def lavabo_ovale(nome, x, y, z, m, lungo=0.60, largo=0.43, alto=0.145, asse="x", rubinetto="parete", lato_parete="n"):
    """Lavabo da appoggio ovale (es. 60 x 43 x 14,5 cm) o tondo (lungo = largo, es. 42 x 42) con bordi arrotondati.
    asse = lato lungo lungo x o y; rubinetto "parete" (a muro, sul lato_parete n/s/e/o) oppure "piano" (sul top)."""
    sx, sy = (lungo, largo) if asse == "x" else (largo, lungo)
    o = cil(nome + "_vasca", x, y, 0.5, z, z + alto, m, 48)
    o.scale = (sx, sy, 1); bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.transform_apply(scale=True)
    b = o.modifiers.new("bordo", "BEVEL"); b.width = min(0.03, alto * 0.3); b.segments = 4; b.limit_method = "ANGLE"
    # interno della vasca: un ovale appena più piccolo e leggermente più scuro, a filo del bordo
    bordo = 0.035
    i = cil(nome + "_interno", x, y, 0.5, z + 0.03, z + alto + 0.0015, M_GRIGIO if "M_GRIGIO" in globals() else m, 48)
    i.scale = (sx - 2 * bordo, sy - 2 * bordo, 1); bpy.context.view_layer.objects.active = i; i.select_set(True)
    bpy.ops.object.transform_apply(scale=True)
    if rubinetto == "parete":
        # bocca che esce dal muro sopra la vasca
        d = {"n": (0, -1), "s": (0, 1), "o": (-1, 0), "e": (1, 0)}[lato_parete]
        prof = (sy if d[1] else sx) / 2 + 0.03
        cx, cy = x + d[0] * prof, y + d[1] * prof
        if d[1]: box(nome + "_rubinetto", cx - 0.015, min(cy, cy - d[1] * 0.18), cx + 0.015, max(cy, cy - d[1] * 0.18), z + alto + 0.12, z + alto + 0.145, M_MANIGLIA)
        else: box(nome + "_rubinetto", min(cx, cx - d[0] * 0.18), cy - 0.015, max(cx, cx - d[0] * 0.18), cy + 0.015, z + alto + 0.12, z + alto + 0.145, M_MANIGLIA)
    else:
        cil(nome + "_rubinetto", x, y - sy / 2 - 0.05, 0.015, z, z + alto + 0.15, M_MANIGLIA, 12)
    return o

import random as _rnd
M_FOGLIA2 = mat("foglie_scure", (0.07, 0.22, 0.08), 0.7)
M_VASO_P = mat("vaso_grigio", (0.62, 0.62, 0.6), 0.6)
def foglia(nome, x, y, z, a, lun, larg, alza, cade, m, seg=8):
    """Lamina di foglia: parte da (x, y, z) verso l'angolo a, sale di 'alza' (radianti) e la punta ricade di 'cade'."""
    ca, sa = math.cos(a), math.sin(a); px, py = -sa, ca
    V, F = [], []
    for k in range(seg + 1):
        t = k / seg
        d = lun * t * math.cos(alza); h = lun * t * math.sin(alza) - cade * lun * t * t
        w = larg * (math.sin(math.pi * min(1.0, t * 1.08)) ** 0.75) * (1 - 0.15 * t)
        cx, cy = x + ca * d, y + sa * d
        piega = w * 0.28
        V += [(cx - px * w, -(cy - py * w), z + h), (cx, -cy, z + h + piega), (cx + px * w, -(cy + py * w), z + h)]
        if k:
            b0, b1 = 3 * (k - 1), 3 * k
            F += [(b0, b0 + 1, b1 + 1, b1), (b0 + 1, b0 + 2, b1 + 2, b1 + 1)]
    me = bpy.data.meshes.new(nome); me.from_pydata(V, [], F); me.update()
    # normali verso l'alto: la cottura scarta le facce rivolte in giù
    if sum(p.normal.z for p in me.polygons) < 0: [p.flip() for p in me.polygons]
    o = bpy.data.objects.new(nome, me); bpy.context.collection.objects.link(o)
    me.materials.append(m)
    for p in me.polygons: p.use_smooth = True
    return reg(o)
def pianta(nome, x, y, z, h=1.0, r=0.28):
    """Pianta in vaso: steli che partono dal vaso e si aprono, foglie allungate inclinate verso il basso."""
    import mathutils as _mu
    rnd = _rnd.Random(nome)
    hv = max(0.12, min(0.36, 0.3 * h + 0.06))
    cil(nome + "_vaso", x, y, r * 0.7, z, z + hv, M_VASO_P)
    cil(nome + "_terra", x, y, r * 0.66, z + hv - 0.03, z + hv - 0.02, M_FOGLIA2)
    zt = z + hv - 0.02
    n = 20
    for i in range(n):
        a = i * 2.39996 + rnd.uniform(-0.25, 0.25); f = (i + 1) / n
        hh = zt + h * (0.3 + 0.7 * f * rnd.uniform(0.75, 1.0))
        d = r * (1.25 - 0.85 * f) * rnd.uniform(0.8, 1.1)
        bx, by = x + d * math.cos(a), y + d * math.sin(a)
        p0 = _mu.Vector((x + 0.02 * math.cos(a), -(y + 0.02 * math.sin(a)), zt)); p1 = _mu.Vector((bx, -by, hh))
        v = p1 - p0
        bpy.ops.mesh.primitive_cylinder_add(radius=0.004 + 0.003 * h, depth=v.length, vertices=6, location=(p0 + p1) / 2)
        st = bpy.context.object; st.name = nome + "_stelo"; st.rotation_euler = v.to_track_quat("Z", "Y").to_euler()
        st.data.materials.append(M_FOGLIA2); reg(st)
        lun = r * rnd.uniform(0.38, 0.5) * (1.1 - 0.3 * f)
        cx, cy = bx + lun * 0.9 * math.cos(a), by + lun * 0.9 * math.sin(a)
        # foglia vera (lamina a punta con nervatura centrale piegata a V e punta che ricade), non più un'ellisse
        foglia(nome + "_foglie", bx, by, hh, a + rnd.uniform(-0.2, 0.2), lun * 2.1, lun * 0.62,
               0.35 + 0.55 * (1 - f) * rnd.uniform(0.7, 1.1), 0.55 + 0.4 * rnd.random(), M_FOGLIA if i % 3 else M_FOGLIA2)
