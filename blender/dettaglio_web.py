# Texture di dettaglio applicate dal vivo nella pagina (nitide anche da vicino).
# Ogni faccia dei materiali elencati riceve un secondo UV "det": coordinate del mondo in metri
# sul piano della faccia, con u spostato di 1000 * categoria. La cottura vede il colore medio piatto
# (così la venatura non si sdoppia), la pagina moltiplica la luce cotta per la texture.
# categorie (la pagina le disegna nitide, sopra la luce cotta):
#   1 parquet (assi lungo x o y)   2 legno   3 intonaco   4 tessuto
#   12 piastrella quadrata 30 cm   13 piastrella 60 cm   14 piastrella 20 cm   15 piastrella 30 cm posata a 45°
#   (5-8: piastrelle con le fughe tarate sui colori della casa d'origine del kit, tenute solo per le case già fatte)
# La tabella di serie usa nomi generici e tiene il colore che il materiale ha nel modello (None). Ogni casa aggiunge i suoi
# materiali nel modello con DETTAGLIO = {"nome_materiale": (categoria, "assi_x" | "assi_y" | None, colore o None)}.
import numpy as _np
DET = {
    "parquet": (1, "assi_x", None), "parquet_x": (1, "assi_x", None), "parquet_y": (1, "assi_y", None),
    "legno": (2, None, None), "intonaco": (3, None, None), "muro": (3, None, None), "tessuto": (4, None, None),
    "piastrella_30": (12, None, None), "piastrella_60": (13, None, None), "piastrella_20": (14, None, None), "piastrella_45": (15, None, None),
}
DET.update(globals().get("DETTAGLIO", {}) or {})
# 9-11 = legni in alta definizione (pavimento.py): pavimenti, pedate delle scale e ogni piano fatto con lo stesso materiale.
# La pagina ci applica l'unica immagine nitida del parquet (anche su iPad), vista dall'alto.
for _i, _n in enumerate(globals().get("PAVIMENTO_HD", [])[:3]): DET.setdefault(_n, (9 + _i, None, None))  # 9, 10, 11 = primo, secondo, terzo legno HD
def _piatto(m, col):
    nt = m.node_tree; b = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not b: return
    if not col and b.inputs["Base Color"].links and all(abs(v - 0.8) < 1e-3 for v in b.inputs["Base Color"].default_value[:3]):
        # colore None ma il materiale ha solo il disegno (es. legno venato di mat_venato) e il colore di base di Blender:
        # tolto il disegno resterebbe grigio chiaro, quindi uso la media dei colori del disegno
        cc = []
        for n in nt.nodes:
            if n.type == "VALTORGB": cc += [tuple(e.color[:3]) for e in n.color_ramp.elements]
            for k in ("Color1", "Color2", "A", "B", "Color"):
                i = n.inputs.get(k) if n.type in ("TEX_BRICK", "TEX_CHECKER", "MIX", "MIX_RGB") else None
                if i is not None and i.type == "RGBA" and not i.links: cc.append(tuple(i.default_value[:3]))
            if n.type == "RGB": cc.append(tuple(n.outputs[0].default_value[:3]))
        if cc: col = tuple(sum(c[j] for c in cc) / len(cc) for j in range(3))
    for nome in ("Base Color", "Normal"):
        for l in list(b.inputs[nome].links): nt.links.remove(l)
    if col: b.inputs["Base Color"].default_value = (*col, 1)
_fatti = set()
for m in bpy.data.materials:
    d = DET.get(m.name.split(".")[0])
    if d and m.node_tree: _piatto(m, d[2]); _fatti.add(m.name)
_nd = 0
for o in [o for o in bpy.data.objects if o.type == "MESH"]:
    me = o.data
    cat = [DET.get(s.material.name.split(".")[0]) if s.material else None for s in o.material_slots]
    l = me.uv_layers.get("det") or me.uv_layers.new(name="det")
    if not any(cat): continue
    mw = o.matrix_world; nm = mw.to_3x3().inverted().transposed()
    co = [mw @ v.co for v in me.vertices]
    uv = _np.zeros((len(me.loops), 2), _np.float32)
    for p in me.polygons:
        c = cat[p.material_index] if p.material_index < len(cat) else None
        if not c: continue
        n = (nm @ p.normal); ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for li in p.loop_indices:
            P = co[me.loops[li].vertex_index]
            if az >= ax and az >= ay: a, b = ((P.y, P.x) if c[1] == "assi_x" else (P.x, P.y))
            elif ax >= ay: a, b = P.y, P.z
            else: a, b = P.x, P.z
            uv[li] = (a + 1000.0 * c[0], b)
        _nd += 1
    l.data.foreach_set("uv", uv.ravel())
print("DETTAGLIO materiali", len(_fatti), "facce", _nd)
