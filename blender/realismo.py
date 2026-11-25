# Materiali realistici e bordi smussati, applicati al modello già costruito (lo esegue modello_base.py prima della luce).
# Tutto procedurale: niente texture da scaricare.

def _nodi(m):
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    for n in list(nt.nodes):
        if n not in (b, nt.nodes.get("Material Output")):
            nt.nodes.remove(n)
    return nt, b

def _pos(nt, scala=1.0, rot=0.0):
    # coordinate del mondo, così le piastrelle continuano da una stanza all'altra
    g = nt.nodes.new("ShaderNodeNewGeometry")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Rotation"].default_value = (0, 0, math.radians(rot))
    mp.inputs["Scale"].default_value = (scala, scala, scala)
    nt.links.new(g.outputs["Position"], mp.inputs["Vector"])
    return mp.outputs["Vector"]

def _rumore(nt, vec, scala, dett=4.0):
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = scala; n.inputs["Detail"].default_value = dett
    nt.links.new(vec, n.inputs["Vector"])
    return n

def _bump(nt, b, alt, forza, dist=0.002):
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = forza; bp.inputs["Distance"].default_value = dist
    nt.links.new(alt, bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])

def piastrelle_rombi(m, c1, c2, fuga, lato=0.33, rough=0.32):
    """Gres in diagonale come nelle foto: piastrelle 33 cm a 45°, fuga sottile più scura, leggera variazione di tono."""
    nt, b = _nodi(m)
    v = _pos(nt, 1.0 / lato, 45)
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.offset = 0.0; br.squash = 1.0
    br.inputs["Scale"].default_value = 1.0; br.inputs["Mortar Size"].default_value = 0.025
    br.inputs["Mortar Smooth"].default_value = 0.2; br.inputs["Bias"].default_value = 0.0
    br.inputs["Brick Width"].default_value = 1.0; br.inputs["Row Height"].default_value = 1.0
    br.inputs["Color1"].default_value = (*c1, 1); br.inputs["Color2"].default_value = (*c2, 1)
    br.inputs["Mortar"].default_value = (*fuga, 1)
    nt.links.new(v, br.inputs["Vector"])
    # macchie leggere dentro la piastrella (cotto/gres smaltato)
    nz = _rumore(nt, v, 3.0, 6.0)
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 0.18
    nt.links.new(br.outputs["Color"], mix.inputs["A"]); nt.links.new(nz.outputs["Color"], mix.inputs["B"])
    nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
    # fuga opaca, piastrella satinata
    rr = nt.nodes.new("ShaderNodeMapRange")
    rr.inputs["To Min"].default_value = rough; rr.inputs["To Max"].default_value = 0.85
    nt.links.new(br.outputs["Fac"], rr.inputs["Value"]); nt.links.new(rr.outputs["Result"], b.inputs["Roughness"])
    inv = nt.nodes.new("ShaderNodeMath"); inv.operation = "SUBTRACT"; inv.inputs[0].default_value = 1.0
    nt.links.new(br.outputs["Fac"], inv.inputs[1])
    _bump(nt, b, inv.outputs["Value"], 0.6, 0.003)

def intonaco(m, col, var=0.07, rough=0.8):
    """Intonaco spatolato: tono che varia a nuvole e grana fine."""
    nt, b = _nodi(m)
    v = _pos(nt, 1.0)
    nz = _rumore(nt, v, 1.6, 5.0)
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*(c * (1 - var) for c in col), 1)
    ramp.color_ramp.elements[1].color = (*(min(1, c * (1 + var)) for c in col), 1)
    nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"]); nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough
    fine = _rumore(nt, v, 90.0, 2.0)
    _bump(nt, b, fine.outputs["Fac"], 0.15, 0.001)

def pelle(m, col, rough=0.38):
    nt, b = _nodi(m)
    b.inputs["Base Color"].default_value = (*col, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Coat Weight"].default_value = 0.15
    v = _pos(nt, 1.0)
    g = _rumore(nt, v, 260.0, 3.0)
    _bump(nt, b, g.outputs["Fac"], 0.25, 0.0008)

def tessuto(m, col, rough=0.95):
    nt, b = _nodi(m)
    b.inputs["Base Color"].default_value = (*col, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Sheen Weight"].default_value = 0.6
    v = _pos(nt, 1.0)
    g = _rumore(nt, v, 400.0, 2.0)
    _bump(nt, b, g.outputs["Fac"], 0.3, 0.0008)

def metallo_spazzolato(m, col, rough=0.3):
    nt, b = _nodi(m)
    b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Metallic"].default_value = 1.0
    v = _pos(nt, 1.0)
    st = nt.nodes.new("ShaderNodeMapping"); st.inputs["Scale"].default_value = (1, 1, 400)
    nt.links.new(v, st.inputs["Vector"])
    nz = _rumore(nt, st.outputs["Vector"], 2.0, 2.0)
    rr = nt.nodes.new("ShaderNodeMapRange"); rr.inputs["To Min"].default_value = rough - 0.08; rr.inputs["To Max"].default_value = rough + 0.08
    nt.links.new(nz.outputs["Fac"], rr.inputs["Value"]); nt.links.new(rr.outputs["Result"], b.inputs["Roughness"])

def laccato(m, col, rough=0.22):
    nt, b = _nodi(m)
    b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough
    b.inputs["Coat Weight"].default_value = 0.3; b.inputs["Coat Roughness"].default_value = 0.08

def legno(m, c1, c2, rough=0.35, scala=26.0):
    """Venatura più ricca: onde distorte + fibre fini, con vernice leggera."""
    nt, b = _nodi(m)
    v = _pos(nt, 1.0)
    mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1.0, scala, 1.0)
    nt.links.new(v, mp.inputs["Vector"])
    w = nt.nodes.new("ShaderNodeTexWave"); w.inputs["Scale"].default_value = 1.2
    w.inputs["Distortion"].default_value = 7.0; w.inputs["Detail"].default_value = 6.0; w.inputs["Detail Scale"].default_value = 1.5
    nt.links.new(mp.outputs["Vector"], w.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*c1, 1); ramp.color_ramp.elements[1].color = (*c2, 1)
    nt.links.new(w.outputs["Fac"], ramp.inputs["Fac"]); nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough; b.inputs["Coat Weight"].default_value = 0.25
    _bump(nt, b, w.outputs["Fac"], 0.08, 0.001)

def parquet(m, c1, c2, fuga=(0.12, 0.05, 0.03), rot=0.0, lungo=0.9, largo=0.12):
    """Listoni di parquet in ciliegio: tavole sfalsate, tono diverso per tavola, fibra fine e vernice lucida."""
    nt, b = _nodi(m)
    v = _pos(nt, 1.0, rot)
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.inputs["Scale"].default_value = 1.0; br.inputs["Brick Width"].default_value = lungo; br.inputs["Row Height"].default_value = largo
    br.inputs["Mortar Size"].default_value = 0.0015; br.inputs["Bias"].default_value = 0.0
    br.offset = 0.37; br.offset_frequency = 1; br.squash = 1.0
    br.inputs["Color1"].default_value = (*c1, 1); br.inputs["Color2"].default_value = (*c2, 1); br.inputs["Mortar"].default_value = (*fuga, 1)
    nt.links.new(v, br.inputs["Vector"])
    mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (4.0, 90.0, 4.0)
    nt.links.new(v, mp.inputs["Vector"])
    fib = nt.nodes.new("ShaderNodeTexNoise"); fib.inputs["Scale"].default_value = 3.0; fib.inputs["Detail"].default_value = 8.0
    nt.links.new(mp.outputs["Vector"], fib.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"; mix.inputs["Factor"].default_value = 0.35
    nt.links.new(br.outputs["Color"], mix.inputs["A"]); nt.links.new(fib.outputs["Color"], mix.inputs["B"])
    nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.22; b.inputs["Coat Weight"].default_value = 0.45; b.inputs["Coat Roughness"].default_value = 0.08
    _bump(nt, b, br.outputs["Fac"], 0.25, 0.0015)

def piastrelle(m, c1, c2, fuga, lato=0.3, rough=0.25, vert=None, diag=False):
    """Piastrelle quadrate: a pavimento (vert=None) o a parete lungo x / lungo y, dritte o a 45°."""
    nt, b = _nodi(m)
    g = nt.nodes.new("ShaderNodeNewGeometry"); v = g.outputs["Position"]
    def mapn(vec, rot):
        mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Rotation"].default_value = rot
        nt.links.new(vec, mp.inputs["Vector"]); return mp.outputs["Vector"]
    if vert == "y": v = mapn(v, (0, 0, math.radians(90)))
    if vert: v = mapn(v, (math.radians(-90), 0, 0))
    if diag: v = mapn(v, (0, 0, math.radians(45)))
    br = nt.nodes.new("ShaderNodeTexBrick"); br.offset = 0.0; br.offset_frequency = 1; br.squash = 1.0
    br.inputs["Scale"].default_value = 1.0; br.inputs["Brick Width"].default_value = lato; br.inputs["Row Height"].default_value = lato
    br.inputs["Mortar Size"].default_value = 0.003; br.inputs["Bias"].default_value = 0.0
    br.inputs["Color1"].default_value = (*c1, 1); br.inputs["Color2"].default_value = (*c2, 1); br.inputs["Mortar"].default_value = (*fuga, 1)
    nt.links.new(v, br.inputs["Vector"]); nt.links.new(br.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough; b.inputs["Coat Weight"].default_value = 0.2
    _bump(nt, b, br.outputs["Fac"], 0.3, 0.001)

def tappeto(m, col):
    nt, b = _nodi(m)
    v = _pos(nt, 1.0)
    nz = _rumore(nt, v, 600.0, 2.0)
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*(c * 0.85 for c in col), 1); ramp.color_ramp.elements[1].color = (*col, 1)
    nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"]); nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 1.0; b.inputs["Sheen Weight"].default_value = 0.8
    _bump(nt, b, nz.outputs["Fac"], 0.5, 0.002)

def per_nome(nome):
    return bpy.data.materials.get(nome)

# (i materiali della casa li applica il modello, nella sua funzione materiali_reali())

# bordi smussati: gli spigoli prendono la luce come quelli veri
for o in bpy.data.objects:
    if o.type != "MESH" or not o.data.polygons or o.get("morbido"): continue
    # muri e facciata no: sono fatti di pezzi accostati (tra porte e finestre) e lo smusso farebbe una scanalatura
    # a ogni giunta, che nella luce diventa un taglio. NO_SMUSSO nel modello per cambiare l'elenco.
    if o.name.split(".")[0] in globals().get("NO_SMUSSO", ("muro", "facciata", "taglio")): continue
    dims = sorted(o.dimensions)
    if dims[0] < 0.015: continue
    bv = o.modifiers.new("smusso", "BEVEL")
    bv.width = min(0.012, dims[0] * 0.25); bv.segments = 2; bv.limit_method = "ANGLE"
    bv.harden_normals = False
