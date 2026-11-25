# Casa 3D navigabile: il modello del piano terra con la luce di Cycles "cotta" nelle texture.
# Per ogni stanza: luce di giorno, luce di sera e una mappa per ogni lampada (si sommano nel browser).
# Uscita: casa_terra.glb (geometria con UV della luce) + luce_<gruppo>_<strato>.jpg + casa_terra.json
# Uso: env GRUPPI=soggiorno,cucina RES=2048 RESL=1024 CAMP=256 blender -b -P cuoci.py -- <cartella>
import os, sys, json, math
os.environ.setdefault("REALE", "1")
MODELLO = os.environ.get("MODELLO", "esempio_casa.py"); PIANO_N = os.environ.get("PIANO", "terra")
_src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), MODELLO)).read()
exec(_src[:_src.index("# FINE_MODELLO")] if "# FINE_MODELLO" in _src else _src[:_src.index('punta(float(os.environ.get("CX"')])
import bpy, mathutils, numpy as np
if "controlla_varchi" in globals(): controlla_varchi()  # avvisa se qualcosa sta nel vano di una porta

RES = int(os.environ.get("RES", "2048")); RESL = int(os.environ.get("RESL", "1024"))
CAMP = int(os.environ.get("CAMP", "256")); CAMPL = int(os.environ.get("CAMPL", str(CAMP)))
GRUPPI = [g for g in os.environ.get("GRUPPI", "").split(",") if g]  # vuoto = tutti i gruppi
SOLO_GEOM = bool(os.environ.get("SOLO_GEOM"))
# SOLO_SERA=1: ricuoce solo la luce della sera (giorno e lampade restano quelli della cottura precedente nella stessa cartella)
SOLO_SERA = bool(os.environ.get("SOLO_SERA"))

# 1. modificatori applicati: lo smusso diventa geometria vera
bpy.ops.object.select_all(action="DESELECT")
for o in bpy.data.objects:
    if o.type in ("MESH", "CURVE"):
        o.select_set(True); bpy.context.view_layer.objects.active = o
# anche le curve (tubi della ringhiera, corrimano, arco della piantana) diventano geometria vera
bpy.ops.object.convert(target="MESH")

# 1b. facce appoggiate a un altro oggetto (teste dei muri, lati contro una parete): non si vedono mai,
# ma nella cottura vengono nere e sfarfallano sulla faccia visibile accanto. Le tolgo.
import bmesh as _bm2
_dg = bpy.context.evaluated_depsgraph_get(); _tolte = 0
for o in [o for o in bpy.data.objects if o.type == "MESH"]:
    if any(s.material and s.material.name.split(".")[0] in ("vetro", "rack_vetro") for s in o.material_slots): continue
    mw = o.matrix_world; nm = mw.to_3x3().inverted().transposed()
    bm = _bm2.new(); bm.from_mesh(o.data); via = []
    for f in bm.faces:
        if f.calc_area() < 1e-6: continue
        c = mw @ f.calc_center_median(); n = (nm @ f.normal).normalized()
        ok, loc, nor, idx, ob, _m = scn.ray_cast(_dg, c + n * 0.0005, n, distance=0.006)
        # tolgo solo la faccia più piccola delle due che si toccano (la testa del muro, non la parete grande)
        if ok and ob is not None and ob.name != o.name and nor.dot(n) < -0.9:
            try: a_altra = ob.evaluated_get(_dg).data.polygons[idx].area * (ob.matrix_world.to_3x3().determinant() ** (2 / 3))
            except Exception: a_altra = 0
            if a_altra >= f.calc_area() * 0.98: via.append(f)
    if via:
        _bm2.ops.delete(bm, geom=via, context="FACES"); bm.to_mesh(o.data); _tolte += len(via)
    bm.free()
print("FACCE NASCOSTE TOLTE", _tolte)

# soppalchi: stanze sospese sopra un'altra stanza dello stesso piano (es. un soppalco sopra il soggiorno). Le decide il modello:
# SOPPALCHI = {"nome_stanza": {"quota": 2.3, "sotto": 2.6}} → nel rettangolo della stanza va al soppalco ciò che ha il centro
# più in alto di "quota" (metri dal pavimento del piano); ciò che sta più in basso di "sotto" resta alla stanza di sotto.
# Il soppalco non perde le facce rivolte in basso (si vede anche da sotto). Senza SOPPALCHI nessuna stanza è un soppalco.
SOPP = globals().get("SOPPALCHI", {}) or {}
_ZP = globals().get("ZPAV", 0.0)
# 1c. un muro tra due stanze è un pezzo unico: finiva tutto nel gruppo di UNA stanza e la faccia che guarda l'altra
# non riceveva mai la luce delle sue lampade (di sera restava scura). Divido ogni muro per faccia: ciascuna va alla stanza
# verso cui guarda (punto 15 cm davanti alla faccia); il bordo in alto e quello in basso restano alla stanza del centro.
def _stanza_punto(x, y):
    for k, (x0, y0, x1, y1) in BOX_STANZE.items():
        if k not in SOPP and x0 <= x <= x1 and y0 <= y <= y1: return k
    return None
_divisi = 0
for o in [o for o in bpy.data.objects if o.type == "MESH" and o.name.split(".")[0] == "muro"]:
    mw = o.matrix_world; nm = mw.to_3x3().inverted().transposed(); assegna = []
    for f in o.data.polygons:
        c = mw @ f.center; n = (nm @ f.normal).normalized()
        assegna.append(_stanza_punto(c.x + n.x * 0.15, -(c.y + n.y * 0.15)) if abs(n.z) < 0.5 else None)
    stanze = set(a for a in assegna if a)
    if len(stanze) < 2: continue
    _cc = sum((mw @ mathutils.Vector(b) for b in o.bound_box), mathutils.Vector()) / 8
    _sc = _stanza_punto(_cc.x, -_cc.y) or sorted(stanze)[0]
    assegna = [a or _sc for a in assegna]
    for r in sorted(set(assegna)):
        no = o.copy(); no.data = o.data.copy()
        for col in o.users_collection: col.objects.link(no)
        bm = _bm2.new(); bm.from_mesh(no.data); bm.faces.ensure_lookup_table()
        _bm2.ops.delete(bm, geom=[bm.faces[i] for i, a in enumerate(assegna) if a != r], context="FACES")
        bm.to_mesh(no.data); bm.free(); no["stanza_forzata"] = r
    bpy.data.objects.remove(o, do_unlink=True); _divisi += 1
print("MURI DIVISI PER FACCIA", _divisi)

# 2. ogni oggetto nel suo gruppo (stanza)
def centro(o):
    c = sum((o.matrix_world @ mathutils.Vector(b) for b in o.bound_box), mathutils.Vector()) / 8
    return c
def gruppo(o):
    n = o.name.split(".")[0]
    # tende interne (tenda_1, tenda_2...) e teli del proiettore: gruppi a parte, animati nella pagina
    if n.startswith("tenda_") or n.startswith("telo_"): return n
    # porte mobili (PORTE_MOBILI nel modello): anta e maniglia a parte, così la pagina la apre/chiude col sensore
    for _pm, _gr in (PORTE_MOBILI if "PORTE_MOBILI" in globals() else []):
        if n.startswith(_pm + "_anta") or n.startswith(_pm + "_maniglia"): return _gr
    # gruppi speciali decisi dal modello (es. un soppalco che sfuma): gruppo_extra(o) -> nome o None
    if "gruppo_extra" in globals():
        _g = gruppo_extra(o)
        if _g: return _g
    if any(s.material and s.material.name.split(".")[0] in ("vetro", "rack_vetro") for s in o.material_slots): return "vetro"
    if "stanza_forzata" in o: return o["stanza_forzata"]
    # tutto ciò che sta su un soppalco (SOPPALCHI nel modello)
    for _sk, _sv in SOPP.items():
        if _sk not in BOX_STANZE: continue
        c = centro(o); x0, y0, x1, y1 = BOX_STANZE[_sk]
        if c.z - _ZP > _sv.get("quota", 2.3) and x0 <= c.x <= x1 and y0 <= -c.y <= y1: return _sk
    k = stanza_di(o)
    if k: return k
    c = centro(o); x, y = c.x, -c.y; best = (9e9, "esterno")
    for k, (x0, y0, x1, y1) in BOX_STANZE.items():
        if k in SOPP and c.z - _ZP < SOPP[k].get("sotto", 2.6): continue
        d = math.hypot(max(x0 - x, 0, x - x1), max(y0 - y, 0, y - y1))
        best = min(best, (d, k))
    return best[1] if best[0] < 0.6 else "esterno"
G = {}
for o in [o for o in bpy.data.objects if o.type == "MESH"]:
    G.setdefault(gruppo(o), []).append(o)
print("GRUPPI", {k: len(v) for k, v in G.items()})

# oggetti cliccabili: riquadro di ciascuno (coordinate three.js: x, z, -y)
def bbox3(objs):
    pts = [o.matrix_world @ mathutils.Vector(b) for o in objs for b in o.bound_box]
    lo = [min(p[i] for p in pts) for i in range(3)]; hi = [max(p[i] for p in pts) for i in range(3)]
    return [round(lo[0], 3), round(lo[2], 3), round(-hi[1], 3), round(hi[0], 3), round(hi[2], 3), round(-lo[1], 3)]
meta = {"ent": {}, "stanze": {}, "gruppi": {}}
# porte mobili. Cardine e angolo per chiuderle (coordinate three.js: x, z, -y; rotazione attorno all'asse verticale).
# Il cardine è l'estremo dell'anta più vicino al centro del vano; chiusa, l'anta va dal cardine verso il centro del vano.
meta["porte"] = {}
for _nome, _gr in (PORTE_MOBILI if "PORTE_MOBILI" in globals() else []):
    _anta = bpy.data.objects.get(_nome + "_anta"); _st = [o for o in bpy.data.objects if o.name.startswith(_nome + "_stipite")]
    if not _anta or len(_st) < 2: continue
    _cs = [sum((o.matrix_world @ mathutils.Vector(b) for b in o.bound_box), mathutils.Vector()) / 8 for o in _st[:2]]
    _c = (_cs[0] + _cs[1]) / 2
    _pts = [_anta.matrix_world @ mathutils.Vector(b) for b in _anta.bound_box]
    _x0, _x1 = min(p.x for p in _pts), max(p.x for p in _pts); _y0, _y1 = min(p.y for p in _pts), max(p.y for p in _pts)
    if _x1 - _x0 >= _y1 - _y0: _e = [mathutils.Vector((_x0, (_y0 + _y1) / 2)), mathutils.Vector((_x1, (_y0 + _y1) / 2))]
    else: _e = [mathutils.Vector(((_x0 + _x1) / 2, _y0)), mathutils.Vector(((_x0 + _x1) / 2, _y1))]
    _c2 = mathutils.Vector((_c.x, _c.y)); _e.sort(key=lambda v: (v - _c2).length)
    _h, _f = _e[0], _e[1]; _a = _f - _h; _b = _c2 - _h
    _ang = math.atan2(_a.x * _b.y - _a.y * _b.x, _a.x * _b.x + _a.y * _b.y)
    meta["porte"][_gr] = {"cardine": [round(_h.x, 4), 0.0, round(-_h.y, 4)], "angolo": round(_ang, 4)}
    print("PORTA", _gr, meta["porte"][_gr], flush=True)
for k, (luci, emit, stanza) in ENT.items():
    ob = [o for o in bpy.data.objects if o.type == "MESH" and any(o.name.split(".")[0] == e or o.name.startswith(e) for e in emit)]
    lp = [bpy.data.objects[n].location for n in luci]
    meta["ent"][k] = {"stanza": stanza, "box": bbox3(ob) if ob else None,
                      "luci": [[round(p.x, 3), round(p.z, 3), round(-p.y, 3)] for p in lp],
                      "col": [round(c, 3) for c in bpy.data.objects[luci[0]].data.color]}
for k, (x0, y0, x1, y1) in BOX_STANZE.items():
    z = (ZPAV_STANZE.get(k, ZPAV) if "ZPAV_STANZE" in globals() else ZPAV) if "ZPAV" in globals() else 0.0
    meta["stanze"][k] = {"box": [x0, z, y0, x1, z + 2.4, y1]}
for k, b in (STANZE_META.items() if "STANZE_META" in globals() else []):
    meta["stanze"][k] = {"box": [round(v, 3) for v in b]}
for e, (nomi_o, stanza) in (MEDIA3D.items() if "MEDIA3D" in globals() else []):
    ob = [o for o in bpy.data.objects if o.type == "MESH" and o.name.split(".")[0] in nomi_o]
    if ob: meta["ent"]["media:" + e] = {"stanza": stanza, "box": bbox3(ob)}
for e, (nomi_o, stanza) in (EXTRA3D.items() if "EXTRA3D" in globals() else []):
    ob = [o for o in bpy.data.objects if o.type == "MESH" and o.name.split(".")[0] in nomi_o]
    if ob: meta["ent"][e] = {"stanza": stanza, "box": bbox3(ob)}
for t in [t for t in G if t.startswith("telo_")]:
    meta["ent"]["telo:" + t] = {"stanza": stanza_di(G[t][0]), "box": bbox3(G[t])}
for t in [t for t in G if t.startswith("tenda_")]:
    meta["ent"]["tenda:" + t] = {"stanza": stanza_di(G[t][0]), "box": bbox3(G.get(t, []))}

# 2b. UV di dettaglio (texture nitide applicate nella pagina)
if os.environ.get("DETTAGLIO", "1") != "0":
    exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "dettaglio_web.py")).read())

# 3. un oggetto per gruppo con UV dedicate alla luce
UNITI = {}; AREA = {}
for k, objs in G.items():
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
        if o.type == "MESH" and "morb" not in o.data.attributes:
            at = o.data.attributes.new("morb", "INT", "FACE"); at.data.foreach_set("value", [1 if o.get("morbido") else 0] * len(o.data.polygons))
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1: bpy.ops.object.join()
    u = bpy.context.view_layer.objects.active; u.name = "G_" + k; UNITI[k] = u
    if k.startswith("vetro"): continue  # vetro e vetri a parte (es. vetro_scala): niente mappa di luce
    me = u.data
    if k not in SOPP:
        # facce rivolte verso il basso: dall'alto non si vedono mai, liberano spazio nella texture
        import bmesh as _bm
        bm = _bm.new(); bm.from_mesh(me)
        giu = [f for f in bm.faces if (u.matrix_world.to_3x3() @ f.normal).z < -0.9]
        _bm.ops.delete(bm, geom=giu, context="FACES"); bm.to_mesh(me); bm.free()
    # pezzi accostati sullo stesso piano (muro a sinistra, sotto e a destra di una finestra; ante e fianchi dei mobili):
    # li fondo in un'unica faccia, così la luce si cuoce come una superficie sola, senza giunte che diventano righe.
    # Solo le facce "dure" (non gli imbottiti) e solo con lo stesso materiale. FONDI_PIANI=0 per non farlo.
    if os.environ.get("FONDI_PIANI", "1") != "0":
        import bmesh as _bmf
        bm = _bmf.new(); bm.from_mesh(me)
        _mo = bm.faces.layers.int.get("morb")
        dure = [f for f in bm.faces if not (_mo and f[_mo])]
        vv = list({v for f in dure for v in f.verts})
        _n0 = len(bm.faces)
        _bmf.ops.remove_doubles(bm, verts=vv, dist=0.0005)
        # giunte a "T": sotto una finestra il pezzo basso (fino al davanzale) tocca i pezzi alti ai lati solo per un tratto
        # di spigolo, quindi le facce non si possono fondere. Spezzo gli spigoli dritti (lungo x, y o z) dove un vertice
        # di un altro pezzo cade sopra di essi: dopo combaciano e la parete diventa una sola.
        _R = lambda a: round(a / 0.0005)
        _tag = 0
        for _giro in range(8):
            dure_v = {v for f in bm.faces if not (_mo and f[_mo]) for v in f.verts}
            idx = {}
            for e in {e for v in dure_v for e in v.link_edges}:
                a, b = e.verts[0].co, e.verts[1].co; d = b - a
                for ax in range(3):
                    o1, o2 = [i for i in range(3) if i != ax]
                    if abs(d[o1]) < 1e-5 and abs(d[o2]) < 1e-5 and abs(d[ax]) > 0.002:
                        idx.setdefault((ax, _R(a[o1]), _R(a[o2])), []).append(e); break
            da_tagliare = []
            for v in dure_v:
                for ax in range(3):
                    o1, o2 = [i for i in range(3) if i != ax]
                    for e in idx.get((ax, _R(v.co[o1]), _R(v.co[o2])), ()):
                        if v in e.verts: continue
                        a, b = e.verts[0].co[ax], e.verts[1].co[ax]
                        if min(a, b) + 0.001 < v.co[ax] < max(a, b) - 0.001: da_tagliare.append((e, v))
            if not da_tagliare: break
            fatti = set()
            for e, v in da_tagliare:
                if e in fatti or not e.is_valid: continue
                a = e.verts[0].co; L = (e.verts[1].co - a).length
                fac = (v.co - a).length / L if L > 0 else 0.5
                ne, nv = _bmf.utils.edge_split(e, e.verts[0], fac); nv.co = v.co.copy(); fatti.add(e); _tag += 1
            _bmf.ops.remove_doubles(bm, verts=list({v for f in bm.faces if not (_mo and f[_mo]) for v in f.verts}), dist=0.0005)
        if _tag: print("GIUNTE A T SPEZZATE", k, _tag, flush=True)
        dure = [f for f in bm.faces if not (_mo and f[_mo])]
        _bmf.ops.dissolve_limit(bm, angle_limit=math.radians(0.5), use_dissolve_boundaries=False,
                                  verts=list({v for f in dure for v in f.verts}), edges=list({e for f in dure for e in f.edges}), delimit={"MATERIAL"})
        bm.to_mesh(me); print("FACCE FUSE", k, _n0, "->", len(bm.faces), flush=True); bm.free()
    if not me.uv_layers: me.uv_layers.new(name="UVMap")
    l = me.uv_layers.new(name="luce"); me.uv_layers.active = l
    for ul in me.uv_layers: ul.active_render = ul.name != "luce"
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.002, scale_to_bounds=False)
    # imbottiti (cuscini, letto, plaid): isole più grandi nella mappa, se no ogni triangolo ha 2 pixel e la luce viene a macchie
    bpy.ops.object.mode_set(mode="OBJECT")
    # foglie e piccoli oggetti decorativi (UV_POCO: nomi di materiale): centinaia di pezzetti che si prendevano
    # quasi tutta la mappa, lasciando al pavimento un angolino (pavimento sfocato, bordi scuri). La loro luce non ha
    # bisogno di dettaglio: nella mappa li rimpicciolisco, così lo spazio va alle superfici grandi.
    _poco = set(globals().get("UV_POCO", ["foglie", "foglie_scure"])); _fp = float(os.environ.get("UV_POCO_SCALA", "0.2"))
    _ip = [i for i, sl in enumerate(u.material_slots) if sl.material and sl.material.name.split(".")[0] in _poco]
    if _ip:
        _luv = me.uv_layers["luce"].data; _np_ = 0
        for pl in me.polygons:
            if pl.material_index in _ip:
                _np_ += 1
                for li in pl.loop_indices: _luv[li].uv = _luv[li].uv * _fp
        print("UV piccoli", k, _np_, "facce x", _fp, flush=True)
    at = me.attributes.get("morb")
    if at is not None:
        fv = [0] * len(me.polygons); at.data.foreach_get("value", fv); fs = float(os.environ.get("UV_MORBIDI", "2.4")); n = 0
        luv = me.uv_layers["luce"].data
        for pl in me.polygons:
            if fv[pl.index]:
                n += 1
                for li in pl.loop_indices: luv[li].uv = luv[li].uv * fs
        print("UV morbidi", k, n, "facce x", fs, flush=True)
    # selezione della mappa = selezione del modello: con Blender 4.5 le facce ingrandite qui sopra restavano
    # non selezionate nella mappa, pack_islands le ignorava e finivano fuori dalla texture (divano con luce sbagliata)
    bpy.context.scene.tool_settings.use_uv_select_sync = True
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
    # spazio tra i pezzi della mappa: abbastanza perché anche le versioni rimpicciolite (iPad, vista da lontano)
    # non mescolino la luce di due pezzi vicini (righe scure sottili su muri e ante)
    bpy.ops.uv.pack_islands(margin=float(os.environ.get("UV_MARGINE", "0.012")), rotate=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    # superficie vera del gruppo (m², gli imbottiti contano di più perché nella mappa sono ingranditi)
    _fs2 = float(os.environ.get("UV_MORBIDI", "2.4")) ** 2; _mo = me.attributes.get("morb"); _fv = [0] * len(me.polygons)
    if _mo is not None: _mo.data.foreach_get("value", _fv)
    _sc = u.matrix_world.to_3x3().determinant() ** (2 / 3)
    AREA[k] = sum(pl.area * _sc * (_fs2 if _fv[pl.index] else 1.0) * (_fp * _fp if pl.material_index in _ip else 1.0) for pl in me.polygons)
    meta["gruppi"][k] = {"strati": {}, "tris": sum(len(p.vertices) - 2 for p in me.polygons)}

# 4. cottura
# il metallo ha colore solo nei riflessi (esclusi dalla cottura): lo rendo opaco col suo colore, se no esce nero.
# Il bordo dei muri tagliati diventa chiaro come nelle case "dollhouse".
for m in bpy.data.materials:
    if not m.node_tree: continue
    for b in [n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"]:
        if b.inputs["Metallic"].default_value > 0.2 and not b.inputs["Metallic"].is_linked:
            b.inputs["Metallic"].default_value = 0.0
            c = b.inputs["Base Color"].default_value
            if not b.inputs["Base Color"].is_linked: b.inputs["Base Color"].default_value = (c[0] * 0.8, c[1] * 0.8, c[2] * 0.8, 1)
        if m.name.split(".")[0] == "taglio" and not b.inputs["Base Color"].is_linked:
            b.inputs["Base Color"].default_value = (0.95, 0.95, 0.95, 1)
# pavimento in alta definizione (pavimento.py lanciato prima): il pavimento si cuoce a tinta unita col suo colore medio,
# così le mappe portano solo luce e ombre; il disegno del legno lo aggiunge la pagina, identico in ogni stanza
_pj = os.path.join(OUT, f"pavimento_{PIANO_N}.json")
if os.path.exists(_pj) and os.environ.get("PAVIMENTO_HD", "1") != "0":
    _pav = json.load(open(_pj)); meta["pavimento"] = _pav
    for m in bpy.data.materials:
        if m.name.split(".")[0] not in _pav["materiali"] or not m.node_tree: continue
        b = m.node_tree.nodes.get("Principled BSDF")
        if not b: continue
        for _in in ("Base Color", "Normal"):
            for l in list(b.inputs[_in].links): m.node_tree.links.remove(l)
        _med = _pav.get("medie", [_pav["media"]])[_pav["materiali"].index(m.name.split(".")[0])]
        b.inputs["Base Color"].default_value = (*_med, 1)
        print("LEGNO HD A TINTA UNITA", m.name, _med, flush=True)
scn.cycles.samples = CAMP
scn.render.bake.margin = 16
# bordo riempito allungando il pezzo stesso, non con le facce vicine: con "facce adiacenti" (scelta di Blender 4.x)
# il bordo di un pavimento o di un muro prendeva la luce del fianco accanto (scuro) e nella pagina compariva una riga scura
scn.render.bake.margin_type = "EXTEND"
scn.render.bake.use_clear = True
def lamp_gruppi(stanza):
    if "VICINI" in globals(): return VICINI.get(stanza, [stanza])
    # senza VICINI: la lampada illumina la sua stanza e le tende che ci stanno dentro
    return [stanza] + [t for t in G if t.startswith("tenda_") and meta["ent"].get("tenda:" + t, {}).get("stanza") == stanza]
def srgb(x):
    return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(np.clip(x, 0.0031308, None), 1 / 2.4) - 0.055)
# imbottiti tondi: sposta l'origine delle ombre per evitare il "terminatore" a scalini sulle superfici lisce
for _u in UNITI.values():
    for _a, _v in (("shadow_terminator_geometry_offset", float(os.environ.get("TERM_G", "0.1"))), ("shadow_terminator_normal_offset", float(os.environ.get("TERM_N", "0.0")))):
        if hasattr(_u, _a): setattr(_u, _a, _v)
def cuoci(k, nome, res, samp):
    u = UNITI[k]
    img = bpy.data.images.new(f"{k}_{nome}", res, res, float_buffer=True)
    for s in u.material_slots:
        m = s.material
        if not m or not m.node_tree: continue
        nt = m.node_tree; n = nt.nodes.get("_cotta") or nt.nodes.new("ShaderNodeTexImage"); n.name = "_cotta"
        n.image = img; nt.nodes.active = n
    bpy.ops.object.select_all(action="DESELECT"); u.select_set(True); bpy.context.view_layer.objects.active = u
    scn.cycles.samples = samp
    bpy.ops.object.bake(type="COMBINED", pass_filter={"EMIT", "DIRECT", "INDIRECT", "DIFFUSE", "TRANSMISSION"}, margin=16, margin_type="EXTEND", use_clear=True)
    px = np.array(img.pixels[:], dtype=np.float32).reshape(res, res, 4)[..., :3]
    mx_ = px.max(axis=2); pk = float(np.percentile(mx_, 99.7))
    # le strisce LED e i paralumi accesi sono pochi pixel molto più luminosi di tutto il resto: se la taratura segue loro,
    # la luce che arriva su pavimenti e muri finisce in pochi livelli di grigio e nella pagina diventa a blocchi colorati.
    # Tetto: al massimo 6 volte il livello del 95% dei pixel illuminati (le sorgenti stesse restano bianche piene).
    _acc = mx_[mx_ > 1e-4]
    if _acc.size: pk = min(pk, 6.0 * float(np.percentile(_acc, 95)))
    if pk < 1e-4:
        return None
    sc = min(16.0, 0.95 / pk)
    out = srgb(np.clip(px * sc, 0, 1))
    b = bpy.data.images.new(f"o_{k}_{nome}", res, res)
    b.pixels[:] = np.concatenate([out, np.ones((res, res, 1), np.float32)], axis=2).ravel()
    p = os.path.join(OUT, f"luce_{k}_{nome}.jpg")
    b.filepath_raw = p; b.file_format = "JPEG"; scn.render.image_settings.quality = 90; b.save()
    bpy.data.images.remove(img); bpy.data.images.remove(b)
    meta["gruppi"][k]["strati"][nome] = round(1 / sc, 5)
    print("COTTO", k, nome, "scala", round(1 / sc, 4), flush=True)
    return sc

# stessa nitidezza in tutte le stanze: la mappa di ogni gruppo è grande in proporzione alla sua superficie.
# Prima tutte le mappe avevano la stessa misura: una stanza grande (soggiorno) aveva meno pixel per metro di una piccola
# (pranzo) e sul confine tra i due pavimenti si vedeva uno stacco (parquet più sfocato e più chiaro da un lato).
# RES resta la misura di riferimento (gruppo di superficie "media"); DENSITA_UNIFORME=0 torna al comportamento vecchio.
RES_G = {}
_norm = sorted(a for k, a in AREA.items() if k in UNITI and not k.startswith("vetro") and not k.startswith(("tenda_", "telo_")))
_rif = float(os.environ.get("AREA_RIF", "0")) or (_norm[len(_norm) // 2] if _norm else 1.0)
for k, a in AREA.items():
    f = math.sqrt(a / _rif) if os.environ.get("DENSITA_UNIFORME", "1") != "0" else 1.0
    if k.startswith(("tenda_", "telo_")): f = min(f, 1.0)
    RES_G[k] = max(0.125, min(float(os.environ.get("RES_MAX", "2.5")), f))
print("MISURE MAPPE", {k: int(RES * f) // 64 * 64 for k, f in RES_G.items()}, flush=True)
_px = lambda k, r: max(256, int(r * RES_G.get(k, 1.0)) // 64 * 64, (globals().get("RES_MIN") or {}).get(k, 0))
# gruppi piccoli ma vicini a luci forti (es. i gradini con i LED): il modello può chiedere una mappa minima (RES_MIN) e più
# campioni (CAMP_X, moltiplicatore): con la mappa proporzionale alla superficie venivano 256 px rumorosi, a strisce colorate
_cx = lambda k, c: int(c * (globals().get("CAMP_X") or {}).get(k, 1))
if not SOLO_GEOM:
    for k in (GRUPPI or list(G.keys())):
        if k not in UNITI or k.startswith("vetro"): continue
        for fase in (("sera",) if SOLO_SERA else ("giorno", "sera")):
            NOTTE = fase == "sera"
            accendi(None); cuoci(k, fase, _px(k, RES), _cx(k, CAMP))
        for e, (luci, emit, stanza) in (() if SOLO_SERA else ENT.items()):
            if k in lamp_gruppi(stanza):
                accendi(e); cuoci(k, e, _px(k, RESL), _cx(k, CAMPL))

# 5. esportazione: solo UV della luce, nessun materiale
for k, u in UNITI.items():
    me = u.data
    # det va dopo luce (TEXCOORD_1 = uv1 nella pagina): la ricopio in coda
    dl = me.uv_layers.get("det")
    if dl is not None:
        buf = np.zeros(len(me.loops) * 2, np.float32); dl.data.foreach_get("uv", buf)
        if np.abs(buf).max() > 0:
            nl = me.uv_layers.new(name="dett"); nl.data.foreach_set("uv", buf)
    # rimuovo per NOME, ricercando lo strato ogni volta: con Blender 4.5 i riferimenti presi prima diventano
    # sbagliati dopo la prima rimozione e veniva cancellata la UV della luce (mappe "a strisce" nella pagina)
    for nome in [ul.name for ul in me.uv_layers if ul.name not in ("luce", "dett")]: me.uv_layers.remove(me.uv_layers[nome])
    if "luce" in me.uv_layers: me.uv_layers["luce"].active = True; me.uv_layers["luce"].active_render = True  # luce = TEXCOORD_0, dett = TEXCOORD_1 (il vetro non ha luce)
    me.materials.clear()
for o in list(bpy.data.objects):
    if o.type != "MESH": bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, f"casa_{PIANO_N}.glb"), export_format="GLB", export_materials="NONE",
                          export_normals=True, export_texcoords=True, export_apply=True, export_yup=True)
vecchio = {}
pm = os.path.join(OUT, f"casa_{PIANO_N}.json")
if os.path.exists(pm):
    try: vecchio = json.load(open(pm))
    except Exception: pass
# solo cuocendo alcuni gruppi (GRUPPI) gli altri tengono i livelli della cottura precedente; cuocendo tutto valgono quelli
# nuovi (prima venivano sovrascritti dai vecchi: le lampade aggiunte dopo la prima cottura sparivano dall'elenco)
for k, g in (vecchio.get("gruppi", {}).items() if GRUPPI else ()):
    if k in meta["gruppi"] and k not in GRUPPI:
        meta["gruppi"][k]["strati"] = g.get("strati", {})
if SOLO_SERA:
    for k, g in vecchio.get("gruppi", {}).items():
        if k in meta["gruppi"]:
            meta["gruppi"][k]["strati"] = {**g.get("strati", {}), **{s: v for s, v in meta["gruppi"][k]["strati"].items() if s == "sera"}}
json.dump(meta, open(pm, "w"), indent=1)
print("FATTO")
