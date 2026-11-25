# Legni in alta definizione: un'immagine nitida per ogni legno "importante" (parquet, piani della cucina e del bagno,
# legno dei mobili), valida per tutta la casa. Le immagini stanno una sotto l'altra nello stesso file (un pannello per legno).
# Perché: se il disegno del legno sta dentro le mappe di luce, ogni stanza lo mostra diverso (mappe di misure diverse,
# compresse in modo diverso): stacchi sul confine tra due stanze, piani sfocati. Così il legno è lo stesso ovunque
# e le mappe di luce portano solo luce e ombre (cuoci.py, se trova pavimento_<piano>.json, cuoce quei legni a tinta unita).
# La pagina applica il pannello giusto sulle facce rivolte verso l'alto (pavimenti, pedate, piani, sedute), vista dall'alto.
# Nel modello: PAVIMENTO_HD = ["materiale_pavimento", "materiale_piani", ...]  (al massimo 3; materiali in coordinate del mondo)
# Uscita: pavimento_<piano>.png + pavimento_<piano>.json (posizione, numero di pannelli, colore medio di ciascuno)
# Uso: MODELLO=casa_terra.py PIANO=terra blender -b --python-exit-code 1 -P pavimento.py -- <cartella_cottura>
#      PAV_PXM = pixel per metro (200 di serie: 5 mm per pixel)
# Va lanciato PRIMA di cuoci.py, nella stessa cartella.
import os, sys, json
os.environ.setdefault("REALE", "1")
MODELLO = os.environ.get("MODELLO", "esempio_casa.py"); PIANO_N = os.environ.get("PIANO", "terra")
_src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), MODELLO)).read()
exec(_src[:_src.index("# FINE_MODELLO")])
import bpy, mathutils, numpy as np
OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "."
os.makedirs(OUT, exist_ok=True)
MATS = (globals().get("PAVIMENTO_HD") or [])[:3]
if not MATS: print("PAVIMENTO: il modello non dichiara PAVIMENTO_HD, niente da fare"); sys.exit(0)
PXM = float(os.environ.get("PAV_PXM", "200"))

# oggetti fatti con quei legni: l'immagine copre l'ingombro di tutti, vista dall'alto
usa = [o for o in bpy.data.objects if o.type == "MESH" and any(s.material and s.material.name.split(".")[0] in MATS for s in o.material_slots)]
pts = [o.matrix_world @ mathutils.Vector(c) for o in usa for c in o.bound_box]
x0, x1 = min(p.x for p in pts), max(p.x for p in pts); y0, y1 = min(p.y for p in pts), max(p.y for p in pts)
quota = min(max((o.matrix_world @ mathutils.Vector(c)).z for c in o.bound_box) for o in usa)
mats = {}
for o in usa:
    for s in o.material_slots:
        if s.material and s.material.name.split(".")[0] in MATS: mats.setdefault(s.material.name.split(".")[0], s.material)
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

W, H = int(round((x1 - x0) * PXM)), int(round((y1 - y0) * PXM))
bpy.ops.mesh.primitive_plane_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, 0.0))
pl = bpy.context.object; pl.scale = (x1 - x0, y1 - y0, 1); bpy.ops.object.transform_apply(scale=True)
scn = bpy.context.scene; scn.render.engine = "CYCLES"; scn.cycles.samples = int(os.environ.get("PAV_CAMP", "16"))
def srgb(x): return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(np.clip(x, 0.0031308, None), 1 / 2.4) - 0.055)
pannelli, medie, nomi = [], [], []
for nome in MATS:
    mat = mats.get(nome)
    if mat is None: print("PAVIMENTO: materiale non usato", nome); continue
    pl.data.materials.clear(); pl.data.materials.append(mat)
    img = bpy.data.images.new("pav_" + nome, W, H, float_buffer=True)
    n = mat.node_tree.nodes.new("ShaderNodeTexImage"); n.image = img; mat.node_tree.nodes.active = n
    bpy.ops.object.select_all(action="DESELECT"); pl.select_set(True); bpy.context.view_layer.objects.active = pl
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, margin=0, use_clear=True)
    px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)[..., :3]
    mat.node_tree.nodes.remove(n)
    pannelli.append(px); medie.append([round(float(v), 5) for v in px.reshape(-1, 3).mean(axis=0)]); nomi.append(nome)
    print("PANNELLO", nome, "media", medie[-1], flush=True)
# LEGNI_STESSO_TONO (nel modello): tutti i legni con lo stesso tono medio del primo (es. piani dello stesso colore del parquet)
if globals().get("LEGNI_STESSO_TONO") and len(pannelli) > 1:
    rif = np.array(medie[0], np.float32)
    for i in range(1, len(pannelli)):
        pannelli[i] = pannelli[i] * (rif / np.maximum(np.array(medie[i], np.float32), 1e-4)); medie[i] = list(medie[0])
# nell'immagine di Blender la riga 0 è in basso: il primo pannello va in cima, quindi impilo al contrario
tutto = np.concatenate(pannelli[::-1], axis=0)
out = bpy.data.images.new("pav_png", W, H * len(pannelli))
out.pixels[:] = np.concatenate([srgb(np.clip(tutto, 0, 1)), np.ones((tutto.shape[0], W, 1), np.float32)], axis=2).ravel()
out.filepath_raw = os.path.join(OUT, f"pavimento_{PIANO_N}.png"); out.file_format = "PNG"; out.save()
# posizione nella pagina (three.js: x = x, altezza = z di Blender, z = -y di Blender); medie = colori lineari
json.dump({"x0": x0, "x1": x1, "z0": -y1, "z1": -y0, "y": quota, "pannelli": len(nomi), "medie": medie, "media": medie[0], "materiali": nomi},
          open(os.path.join(OUT, f"pavimento_{PIANO_N}.json"), "w"))
print("PAVIMENTO", W, H * len(nomi), nomi, flush=True)
