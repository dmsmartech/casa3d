# Funzioni di base per costruire la casa in Blender: materiali, scatole, cilindri, muri tagliati, luci.
# Coordinate del disegno: x da ovest a est, y da nord a sud (metri). Blender: y invertita.
# Uso: blender -b -P casa2.py -- <cartella_output>
import bpy, math, sys, os, json
from bpy_extras.object_utils import world_to_camera_view

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "/tmp"
GAP = 3.4
CUT = float(os.environ.get("CUT", "1.15"))

bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene

def mat(nome, col, rough=0.6, metal=0.0, emit=None, forza=0.0, trasm=0.0):
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if trasm:
        b.inputs["Transmission Weight"].default_value = trasm
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = forza
    return m

def mat_venato(nome, c1, c2, scala=18.0, rough=0.45, assi=False):
    """Legno o cotto con variazione procedurale."""
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = rough
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapn = nt.nodes.new("ShaderNodeMapping")
    mapn.inputs["Scale"].default_value = (1.0, scala if not assi else 1.0, 1.0)
    tex = nt.nodes.new("ShaderNodeTexWave" if not assi else "ShaderNodeTexBrick")
    if assi:
        tex.inputs["Scale"].default_value = 3.0
        tex.inputs["Mortar Size"].default_value = 0.004
        tex.inputs["Color1"].default_value = (*c1, 1)
        tex.inputs["Color2"].default_value = (*c2, 1)
        tex.inputs["Mortar"].default_value = tuple(v * 0.8 for v in c2) + (1,)
        nt.links.new(coord.outputs["Object"], mapn.inputs["Vector"])
        nt.links.new(mapn.outputs["Vector"], tex.inputs["Vector"])
        nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
        return m
    tex.inputs["Distortion"].default_value = 6.0
    tex.inputs["Detail"].default_value = 4.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*c1, 1)
    ramp.color_ramp.elements[1].color = (*c2, 1)
    nt.links.new(coord.outputs["Object"], mapn.inputs["Vector"])
    nt.links.new(mapn.outputs["Vector"], tex.inputs["Vector"])
    nt.links.new(tex.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    return m

M_MURO = mat("muro", (0.90, 0.86, 0.79), 0.85)
M_TAGLIO = mat("taglio", (0.95, 0.95, 0.95), 0.9)  # cima dei muri bianca
M_AZZURRO = mat("facciata_grigia", (0.55, 0.58, 0.62), 0.85)
M_ROSSO = mat("facciata_arancione", (0.85, 0.28, 0.08), 0.85)
M_CORNICE = mat("cornice", (0.95, 0.94, 0.92), 0.6)
M_PARQUET = mat_venato("parquet", (0.36, 0.14, 0.06), (0.52, 0.24, 0.11), 22.0, 0.35)
M_PIASTRELLA = mat_venato("piastrelle", (0.80, 0.70, 0.55), (0.72, 0.60, 0.45), 1.0, 0.4, assi=True)
M_COTTO = mat_venato("cotto", (0.62, 0.36, 0.24), (0.55, 0.30, 0.20), 1.0, 0.6, assi=True)
M_BAGNO = mat_venato("bagno", (0.88, 0.88, 0.86), (0.80, 0.80, 0.79), 1.0, 0.2, assi=True)
M_ERBA = mat("erba", (0.13, 0.20, 0.08), 0.95)
M_GHIAIA = mat("ghiaia", (0.45, 0.43, 0.40), 0.95)
M_TERRAZZA = mat("terrazza", (0.62, 0.58, 0.53), 0.8)
M_PELLE = mat("pelle_bianca", (0.93, 0.92, 0.90), 0.35)
M_TESSUTO = mat("tessuto", (0.45, 0.45, 0.47), 0.95)
M_SALVIA = mat("verde_salvia", (0.50, 0.58, 0.48), 0.9)
M_TORTORA = mat("tortora", (0.55, 0.52, 0.48), 0.95)
M_SPECCHIO = mat("specchio", (0.85, 0.87, 0.9), 0.02, metal=1.0)
M_CUSCINO = mat("cuscino", (0.20, 0.22, 0.20), 0.95)
M_LENZUOLO = mat("lenzuolo", (0.95, 0.94, 0.91), 0.95)
M_COPERTA = mat("coperta", (0.58, 0.52, 0.45), 0.95)
M_LEGNO = mat_venato("legno_mobili", (0.48, 0.30, 0.16), (0.60, 0.40, 0.22), 30.0, 0.4)
M_BIANCO = mat("laccato", (0.93, 0.93, 0.92), 0.25)
M_NERO = mat("nero", (0.05, 0.05, 0.06), 0.3)
M_ACCIAIO = mat("acciaio", (0.75, 0.75, 0.77), 0.25, metal=1.0)
M_VETRO = mat("vetro", (0.80, 0.92, 0.95), 0.02, trasm=0.9)
M_TENDA = mat("tenda", (0.88, 0.80, 0.66), 0.95)
M_TAPPETO = mat("tappeto", (0.35, 0.36, 0.36), 1.0)
M_FOGLIA = mat("foglie", (0.14, 0.32, 0.12), 0.8)
M_VASO = mat("vaso", (0.85, 0.83, 0.80), 0.5)
M_LAMPADA = mat("paralume", (1.0, 0.95, 0.85), 0.5, emit=(1.0, 0.78, 0.50), forza=6.0)
M_LED = mat("led", (1.0, 1.0, 1.0), 0.5, emit=(1.0, 0.92, 0.80), forza=8.0)
M_FUOCO = mat("fuoco", (1.0, 0.4, 0.1), 0.5, emit=(1.0, 0.45, 0.12), forza=12.0)

OGGETTI = {"terra": [], "sopra": []}
PIANO = ["terra"]

def reg(o):
    OGGETTI.setdefault(PIANO[0], []).append(o)  # piano con nome libero (terra, primo, mansarda...)
    return o

def box(nome, x0, y0, x1, y1, z0, z1, m, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.object
    o.name = nome
    o.scale = (max(abs(x1 - x0), 0.001), max(abs(y1 - y0), 0.001), max(abs(z1 - z0), 0.001))
    o.location = ((x0 + x1) / 2, -(y0 + y1) / 2, (z0 + z1) / 2)
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = o.modifiers.new("bev", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    o.data.materials.append(m)
    return reg(o)

def cil(nome, x, y, r, z0, z1, m, seg=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=z1 - z0, location=(x, -y, (z0 + z1) / 2))
    o = bpy.context.object
    o.name = nome
    o.data.materials.append(m)
    return reg(o)

def sfera(nome, x, y, z, r, m, sx=1.0, sy=1.0, sz=1.0):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=(x, -y, z), segments=24, ring_count=12)
    o = bpy.context.object
    o.name = nome
    o.scale = (sx, sy, sz)
    bpy.ops.object.shade_smooth()
    o.data.materials.append(m)
    return reg(o)

# ---------- HomePod veri (misure Apple) ----------
M_HP_TOP = mat("homepod_vetro", (0.015, 0.015, 0.02), 0.12)
M_HP_LUCE = mat("homepod_luce", (0.9, 0.9, 1.0), 0.3, emit=(0.85, 0.88, 1.0), forza=0.6)

def homepod(nome, x, y, z, m):
    """HomePod grande: 14,2 cm di diametro, 16,8 cm di altezza, bordi molto arrotondati, pannello touch scuro e concavo sopra"""
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.071, depth=0.168, location=(x, -y, z + 0.084))
    o = bpy.context.object; o.name = nome
    mod = o.modifiers.new("bev", "BEVEL"); mod.width = 0.03; mod.segments = 8; mod.limit_method = "ANGLE"
    bpy.ops.object.shade_smooth()
    o.data.materials.append(m); reg(o)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.047, depth=0.004, location=(x, -y, z + 0.1665))
    t = bpy.context.object; t.name = nome + "_touch"; t.data.materials.append(M_HP_TOP); reg(t)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.036, minor_radius=0.0025, location=(x, -y, z + 0.169))
    l = bpy.context.object; l.name = nome + "_luce"; l.data.materials.append(M_HP_LUCE); reg(l)
    return o

def homepod_mini(nome, x, y, z, m):
    """HomePod mini: sfera di 9,8 cm schiacciata a 8,4 cm, base piatta, disco touch scuro con la luce sopra"""
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.049, location=(0, 0, 0), segments=40, ring_count=20)
    o = bpy.context.object; o.name = nome
    for v in o.data.vertices:
        v.co.z = max(v.co.z * 0.86, -0.040)   # schiacciata, con la base piatta appoggiata
    o.data.update()
    o.location = (x, -y, z + 0.040)
    bpy.ops.object.shade_smooth()
    o.data.materials.append(m); reg(o)
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=0.026, depth=0.003, location=(x, -y, z + 0.0815))
    t = bpy.context.object; t.name = nome + "_touch"; t.data.materials.append(M_HP_TOP); reg(t)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.015, depth=0.002, location=(x, -y, z + 0.0835))
    l = bpy.context.object; l.name = nome + "_luce"; l.data.materials.append(M_HP_LUCE); reg(l)
    return o

def lastra(nome, orizz, c0, c1, pezzi, z, m):
    """Un solo pezzo per tutta la facciata di un muro, con le aperture già ritagliate (niente lastre accostate:
    ogni giunta tra due lastre diventava una riga nella luce cotta). pezzi = [(da, a, h0, h1)] lungo il muro;
    c0..c1 = spessore (y per un muro orizzontale, x per uno verticale). La griglia ha i vertici in comune,
    così cuoci.py può fondere le facce sullo stesso piano in una superficie sola."""
    import bmesh
    us = sorted({v for p in pezzi for v in p[:2]}); hs = sorted({v for p in pezzi for v in p[2:]})
    def pieno(i, j):
        if i < 0 or j < 0 or i >= len(us) - 1 or j >= len(hs) - 1: return False
        um, hm = (us[i] + us[i + 1]) / 2, (hs[j] + hs[j + 1]) / 2
        return any(a <= um <= b and h0 <= hm <= h1 for a, b, h0, h1 in pezzi)
    bm = bmesh.new(); V = {}
    def v(i, j, k):
        if (i, j, k) not in V:
            u, h, c = us[i], hs[j], (c0, c1)[k]
            V[i, j, k] = bm.verts.new((u, -c, z + h) if orizz else (c, -u, z + h))
        return V[i, j, k]
    for i in range(len(us) - 1):
        for j in range(len(hs) - 1):
            if not pieno(i, j): continue
            for k in (0, 1): bm.faces.new([v(i, j, k), v(i + 1, j, k), v(i + 1, j + 1, k), v(i, j + 1, k)])
            for di, dj, a, b in ((-1, 0, (i, j), (i, j + 1)), (1, 0, (i + 1, j), (i + 1, j + 1)), (0, -1, (i, j), (i + 1, j)), (0, 1, (i, j + 1), (i + 1, j + 1))):
                if not pieno(i + di, j + dj): bm.faces.new([v(*a, 0), v(*b, 0), v(*b, 1), v(*a, 1)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(nome); bm.to_mesh(me); bm.free(); me.uv_layers.new(name="UVMap")
    o = bpy.data.objects.new(nome, me); bpy.context.collection.objects.link(o); o.data.materials.append(m)
    return reg(o)

# vani delle porte (riempito da muro): controlla_varchi() avvisa se un oggetto ci sta dentro o davanti
VARCHI = []
def muro(x0, y0, x1, y1, z, aperture=(), fuori=None, colore=None, alto=CUT):
    """Muro tagliato ad 'alto'. aperture: [(da, a, tipo)] tipo 'f' finestra, 'p' porta, 'pf' portafinestra.
    fuori: lato esterno ('n','s','e','o') per la facciata colorata."""
    orizz = abs(x1 - x0) >= abs(y1 - y0)
    for (da, aa, tipo) in aperture:
        if tipo in ("p", "pf"):  # zona di passaggio: la luce del vano (5 cm in meno per lato) più 20 cm davanti e dietro il muro
            VARCHI.append((da + 0.05, y0 - 0.2, aa - 0.05, y1 + 0.2, z) if orizz else (x0 - 0.2, da + 0.05, x1 + 0.2, aa - 0.05, z))
    a0, a1 = (x0, x1) if orizz else (y0, y1)
    pezzi, cur = [], a0
    for (da, aa, tipo) in sorted(aperture):
        if da > cur:
            pezzi.append((cur, da, 0, alto))
        if tipo == "f":
            pezzi.append((da, aa, 0, 0.9))
        cur = aa
    if cur < a1:
        pezzi.append((cur, a1, 0, alto))
    sp = 0.03
    if fuori:   # facciata: un pezzo unico per tutto il muro
        if orizz: lastra("facciata", True, *((y0 - sp, y0) if fuori == "n" else (y1, y1 + sp)), pezzi, z, colore)
        else: lastra("facciata", False, *((x0 - sp, x0) if fuori == "o" else (x1, x1 + sp)), pezzi, z, colore)
    for (p0, p1, h0, h1) in pezzi:
        if orizz:
            box("muro", p0, y0, p1, y1, z + h0, z + h1, M_MURO)
            if h1 == alto:
                box("taglio", p0, y0, p1, y1, z + h1, z + h1 + 0.01, M_TAGLIO)
        else:
            box("muro", x0, p0, x1, p1, z + h0, z + h1, M_MURO)
            if h1 == alto:
                box("taglio", x0, p0, x1, p1, z + h1, z + h1 + 0.01, M_TAGLIO)
    for (da, aa, tipo) in aperture:
        if tipo == "pf":  # portafinestra (balcone): vetro fino a terra con soglia
            if orizz:
                box("soglia", da - 0.03, y0 - 0.04, aa + 0.03, y1 + 0.04, z, z + 0.02, M_CORNICE)
                box("vetro", da, (y0 + y1) / 2 - 0.01, aa, (y0 + y1) / 2 + 0.01, z + 0.02, z + alto, M_VETRO)
            else:
                box("soglia", x0 - 0.04, da - 0.03, x1 + 0.04, aa + 0.03, z, z + 0.02, M_CORNICE)
                box("vetro", (x0 + x1) / 2 - 0.01, da, (x0 + x1) / 2 + 0.01, aa, z + 0.02, z + alto, M_VETRO)
        if tipo == "f":
            if orizz:
                box("davanzale", da - 0.05, y0 - 0.04, aa + 0.05, y1 + 0.04, z + 0.86, z + 0.92, M_CORNICE)
                box("vetro", da, (y0 + y1) / 2 - 0.01, aa, (y0 + y1) / 2 + 0.01, z + 0.92, z + alto, M_VETRO)
            else:
                box("davanzale", x0 - 0.04, da - 0.05, x1 + 0.04, aa + 0.05, z + 0.86, z + 0.92, M_CORNICE)
                box("vetro", (x0 + x1) / 2 - 0.01, da, (x0 + x1) / 2 + 0.01, aa, z + 0.92, z + alto, M_VETRO)

def pianta(nome, x, y, z, h=1.0, r=0.28):
    cil(nome + "_vaso", x, y, r * 0.7, z, z + 0.35, M_VASO)
    sfera(nome + "_foglie", x, y, z + 0.35 + h * 0.45, r * 1.4, M_FOGLIA, 1, 1, h * 1.2)

def luce(nome, x, y, z, energia=60, r=0.25, col=(1.0, 0.72, 0.42)):
    bpy.ops.object.light_add(type="POINT", location=(x, -y, z))
    l = bpy.context.object
    l.name = nome
    l.data.energy = energia
    l.data.shadow_soft_size = r
    l.data.color = col
    return reg(l)

def letto(nome, x0, y0, x1, y1, z, testata="n"):
    box(nome + "_base", x0, y0, x1, y1, z, z + 0.32, M_LEGNO, 0.02)
    box(nome + "_materasso", x0 + 0.04, y0 + 0.04, x1 - 0.04, y1 - 0.04, z + 0.32, z + 0.5, M_LENZUOLO, 0.05)
    if testata == "n":
        box(nome + "_coperta", x0 + 0.02, y0 + (y1 - y0) * 0.38, x1 - 0.02, y1 - 0.02, z + 0.5, z + 0.56, M_COPERTA, 0.03)
        box(nome + "_testata", x0, y0 - 0.08, x1, y0, z, z + 1.05, M_LEGNO, 0.02)
        n = 2 if (x1 - x0) > 1.2 else 1
        for i in range(n):
            cx = x0 + (x1 - x0) * (i + 0.5) / n
            box(nome + "_cuscino", cx - 0.3, y0 + 0.1, cx + 0.3, y0 + 0.45, z + 0.5, z + 0.64, M_LENZUOLO, 0.06)
    else:
        box(nome + "_coperta", x0 + 0.02, y0 + 0.02, x1 - 0.02, y1 - (y1 - y0) * 0.38, z + 0.5, z + 0.56, M_COPERTA, 0.03)
        box(nome + "_testata", x0, y1, x1, y1 + 0.08, z, z + 1.05, M_LEGNO, 0.02)
        n = 2 if (x1 - x0) > 1.2 else 1
        for i in range(n):
            cx = x0 + (x1 - x0) * (i + 0.5) / n
            box(nome + "_cuscino", cx - 0.3, y1 - 0.45, cx + 0.3, y1 - 0.1, z + 0.5, z + 0.64, M_LENZUOLO, 0.06)

# parti della porta e della casa che possono stare nel vano: tutto il resto (mobili, accessori, piante) no
_NEL_VANO_OK = ("muro", "taglio", "facciata", "soglia", "vetro", "davanzale", "cornice", "pavimento", "solaio", "lastra",
                "porta", "anta", "maniglia", "stipite", "telaio", "cardine", "battiscopa", "tappeto", "tenda", "telo", "scala", "gradino", "contatto")
def controlla_varchi():
    """Nessun oggetto può stare dentro il vano di una porta o subito davanti/dietro (es. un portasalviette davanti
    all'apertura): stampa un avviso per ciascuno, così si sposta sul muro libero accanto. Non modifica nulla."""
    import mathutils
    trovati = {}
    for o in [o for o in bpy.data.objects if o.type == "MESH"]:
        nome = o.name.split(".")[0].lower()
        if any(nome.startswith(p) or ("_" + p) in nome for p in _NEL_VANO_OK): continue
        P = [o.matrix_world @ mathutils.Vector(b) for b in o.bound_box]
        x0, x1 = min(p.x for p in P), max(p.x for p in P); y0, y1 = min(-p.y for p in P), max(-p.y for p in P)
        z0, z1 = min(p.z for p in P), max(p.z for p in P)
        for (a0, b0, a1, b1, z) in VARCHI:
            if z1 < z + 0.03 or z0 > z + 2.1: continue  # a terra (tappeti, pavimento) o sopra la porta
            if x0 < a1 - 0.02 and x1 > a0 + 0.02 and y0 < b1 - 0.02 and y1 > b0 + 0.02:
                trovati.setdefault(nome.split(".")[0], (round((a0 + a1) / 2, 2), round((b0 + b1) / 2, 2))); break
    for k, (x, y) in trovati.items(): print(f"ATTENZIONE nel vano della porta in ({x}, {y}): {k} → spostalo sul muro libero accanto", flush=True)
    print("CONTROLLO PORTE:", "nessun oggetto nei vani" if not trovati else f"{len(trovati)} oggetti da spostare", flush=True)

def lastra_bucata(nome, x0, y0, x1, y1, z0, z1, buchi, m):
    """Lastra orizzontale in UN SOLO pezzo con dei vuoti rettangolari (es. pavimento attorno al vuoto della scala):
    vertici in comune su tutta la griglia, quindi nessuna giunta né separazione nella luce cotta."""
    import bmesh
    xs = sorted({x0, x1, *[b[0] for b in buchi], *[b[2] for b in buchi]}); ys = sorted({y0, y1, *[b[1] for b in buchi], *[b[3] for b in buchi]})
    def pieno(i, j):
        if i < 0 or j < 0 or i >= len(xs) - 1 or j >= len(ys) - 1: return False
        cx, cy = (xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2
        return not any(b[0] <= cx <= b[2] and b[1] <= cy <= b[3] for b in buchi)
    bm = bmesh.new(); V = {}
    def v(i, j, k):
        if (i, j, k) not in V: V[i, j, k] = bm.verts.new((xs[i], -ys[j], (z0, z1)[k]))
        return V[i, j, k]
    for i in range(len(xs) - 1):
        for j in range(len(ys) - 1):
            if not pieno(i, j): continue
            for k in (0, 1): bm.faces.new([v(i, j, k), v(i + 1, j, k), v(i + 1, j + 1, k), v(i, j + 1, k)])
            for di, dj, a, b in ((-1, 0, (i, j), (i, j + 1)), (1, 0, (i + 1, j), (i + 1, j + 1)), (0, -1, (i, j), (i + 1, j)), (0, 1, (i, j + 1), (i + 1, j + 1))):
                if not pieno(i + di, j + dj): bm.faces.new([v(*a, 0), v(*b, 0), v(*b, 1), v(*a, 1)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(nome); bm.to_mesh(me); bm.free(); me.uv_layers.new(name="UVMap")
    o = bpy.data.objects.new(nome, me); bpy.context.collection.objects.link(o); me.materials.append(m)
    return reg(o)

def piante_dentro(stanze_unite=(), margine=0.07):
    """Le foglie di una pianta vicino a un muro non devono passarci attraverso: per ogni pianta (vaso + foglie con lo stesso
    nome) stringe le foglie in orizzontale attorno al vaso quanto basta per restare nella stanza, a 'margine' dal muro.
    stanze_unite = gruppi di stanze aperte tra loro (open space): lì conta il contorno di tutto il gruppo."""
    import mathutils
    def rett(k):
        for g in stanze_unite:
            if k in g:
                bx = [BOX_STANZE[s] for s in g]; return (min(b[0] for b in bx), min(b[1] for b in bx), max(b[2] for b in bx), max(b[3] for b in bx))
        return BOX_STANZE[k]
    vasi = [o for o in bpy.data.objects if o.name.endswith("_vaso") and o.name.startswith("pianta")]
    for v in vasi:
        base = v.name[:-5]; c = sum((v.matrix_world @ mathutils.Vector(b) for b in v.bound_box), mathutils.Vector()) / 8
        cx, cy = c.x, -c.y
        k = next((s for s, (a0, b0, a1, b1) in BOX_STANZE.items() if a0 <= cx <= a1 and b0 <= cy <= b1), None)
        if k is None: continue
        a0, b0, a1, b1 = rett(k); a0 += margine; b0 += margine; a1 -= margine; b1 -= margine
        foglie = [o for o in bpy.data.objects if o.name.startswith(base + "_") and o is not v and o.type == "MESH" and not o.name.startswith(base + "_terra")]
        if not foglie: continue
        P = [o.matrix_world @ vv.co for o in foglie for vv in o.data.vertices]
        s = 1.0
        for p in P:
            dx, dy = p.x - cx, -p.y - cy
            if dx < 0 and cx + dx < a0: s = min(s, (cx - a0) / -dx)
            if dx > 0 and cx + dx > a1: s = min(s, (a1 - cx) / dx)
            if dy < 0 and cy + dy < b0: s = min(s, (cy - b0) / -dy)
            if dy > 0 and cy + dy > b1: s = min(s, (b1 - cy) / dy)
        if s >= 0.999: continue
        s = max(0.3, s)
        for o in foglie:
            mw = o.matrix_world.copy()
            for vv in o.data.vertices:
                w = mw @ vv.co; w.x = c.x + (w.x - c.x) * s; w.y = c.y + (w.y - c.y) * s; vv.co = mw.inverted() @ w
            o.data.update()
        print("PIANTA DENTRO", base, k, "stretta al", round(s * 100), "%")

def giardino_base(casa, vialetti=(), bordo=1.4, erba=0.35, gruppo_nomi=("marciapiede", "prato", "vialetto")):
    """Terreno uguale per ogni casa del kit: una base chiara spessa 35 cm che sporge 'bordo' metri tutto intorno alla casa,
    sopra una sola superficie d'erba (vertici in comune, nessuna giunta) che lascia scoperto 'erba' metri di base sul bordo,
    con il buco della casa e dei vialetti. casa = (x0, y0, x1, y1): ingombro esterno dei muri (coordinate del disegno).
    vialetti = [(x0, y0, x1, y1)]: rettangoli in cemento dalle porte verso il bordo (si allungano da soli fino al bordo della
    base). Tutto a filo del pavimento di casa (quota ZPAV). La pagina schiarisce da sola base e vialetti (non sono verdi).
    Nel modello: gruppo_extra(o) deve mettere questi pezzi nel gruppo del giardino (vedi gruppo_giardino)."""
    import bmesh
    z = globals().get("ZPAV", 0.0)
    m_base = mat("marciapiede", (0.86, 0.87, 0.88), 0.85); m_prato = mat("prato", (0.16, 0.34, 0.07), 0.95)
    m_via = mat("vialetto", (0.74, 0.74, 0.72), 0.85)
    X0, Y0, X1, Y1 = casa[0] - bordo, casa[1] - bordo, casa[2] + bordo, casa[3] + bordo
    box("marciapiede", X0, Y0, X1, Y1, z - 0.35, z - 0.005, m_base)
    P0, Q0, P1, Q1 = X0 + erba, Y0 + erba, X1 - erba, Y1 - erba
    vv = []
    for (a0, b0, a1, b1) in vialetti:
        # il vialetto arriva fino al bordo della base dal lato verso cui esce dalla casa
        if b1 <= casa[1] + 0.01: b0 = Y0
        elif b0 >= casa[3] - 0.01: b1 = Y1
        elif a1 <= casa[0] + 0.01: a0 = X0
        elif a0 >= casa[2] - 0.01: a1 = X1
        vv.append((a0, b0, a1, b1)); box("vialetto", a0, b0, a1, b1, z - 0.06, z, m_via)
    buchi = [tuple(casa)] + [(max(a0, P0), max(b0, Q0), min(a1, P1), min(b1, Q1)) for (a0, b0, a1, b1) in vv]
    xs = sorted({P0, P1, *[min(max(b[0], P0), P1) for b in buchi], *[min(max(b[2], P0), P1) for b in buchi]})
    ys = sorted({Q0, Q1, *[min(max(b[1], Q0), Q1) for b in buchi], *[min(max(b[3], Q0), Q1) for b in buchi]})
    bm = bmesh.new(); V = {}
    def v(i, j):
        if (i, j) not in V: V[i, j] = bm.verts.new((xs[i], -ys[j], z))
        return V[i, j]
    for i in range(len(xs) - 1):
        for j in range(len(ys) - 1):
            cx, cy = (xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2
            if any(a <= cx <= c and b <= cy <= d for a, b, c, d in buchi): continue
            bm.faces.new([v(i, j), v(i, j + 1), v(i + 1, j + 1), v(i + 1, j)])
    me = bpy.data.meshes.new("prato"); bm.normal_update(); bm.to_mesh(me); bm.free()
    for f in me.polygons: f.use_smooth = False
    o = bpy.data.objects.new("prato", me); bpy.context.collection.objects.link(o); o.data.materials.append(m_prato)
    me.uv_layers.new(name="UVMap"); me.update(); return reg(o)

def gruppo_giardino(o, nome="esterno"):
    """Per gruppo_extra del modello: base, prato e vialetti di giardino_base vanno tutti nel gruppo del giardino."""
    return nome if o.name.split(".")[0] in ("marciapiede", "prato", "vialetto") else None

# facciata di serie del kit: bianca come le pareti (regola delle pareti: bianche e luminose, di sera la luce del cielo le fa blu)
M_FACCIATA_KIT = mat("facciata", (0.92, 0.91, 0.88), 0.85)
def muri_perimetro(casa, sp=0.2, aperture=None, colore=None, z=None):
    """Muri esterni come in ogni casa del kit: nord e sud lunghi quanto tutta la casa, est e ovest in mezzo (niente cime
    sovrapposte negli angoli, che nella luce diventano un quadrato nero) e la facciata che gira gli angoli in un pezzo
    continuo. casa = (x0, y0, x1, y1) ingombro esterno dei muri; sp = spessore; aperture = {"n": [(da, a, tipo)], "s": [...],
    "o": [...], "e": [...]} con le coordinate lungo il muro, come in muro(). Nel modello: gruppo_extra mette "facciata"
    in un gruppo unico (vedi gruppo_esterni)."""
    x0, y0, x1, y1 = casa; ap = aperture or {}; col = colore or M_FACCIATA_KIT
    z = globals().get("ZPAV", 0.0) if z is None else z
    muro(x0, y0, x1, y0 + sp, z, ap.get("n", []), fuori="n", colore=col)
    muro(x0, y1 - sp, x1, y1, z, ap.get("s", []), fuori="s", colore=col)
    muro(x0, y0 + sp, x0 + sp, y1 - sp, z, ap.get("o", []), fuori="o", colore=col)
    muro(x1 - sp, y0 + sp, x1, y1 - sp, z, ap.get("e", []), fuori="e", colore=col)
    for (ax0, ax1) in ((x0 - 0.03, x0), (x1, x1 + 0.03)):
        for (ay0, ay1) in ((y0 - 0.03, y0 + sp), (y1 - sp, y1 + 0.03)):
            box("facciata", ax0, ay0, ax1, ay1, z, z + CUT, col)
            box("taglio", ax0, ay0, ax1, ay1, z + CUT, z + CUT + 0.01, M_TAGLIO)

def gruppo_esterni(o, giardino="esterno"):
    """Per gruppo_extra del modello: facciata in un gruppo unico (senza righe tra un pezzo e l'altro) e terreno
    di giardino_base nel gruppo del giardino."""
    n = o.name.split(".")[0]
    if n == "facciata": return "facciata"
    return gruppo_giardino(o, giardino)

# mattoni strutturali comuni a ogni casa (solaio, scala tra due piani, gruppi di cottura): blender/struttura.py
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "struttura.py")).read())
