# Ombra naturale sotto la casa: Blender calcola quanta luce del cielo arriva al terreno attorno alla casa
# (occlusione ambientale). Più scura dove i muri toccano terra e negli angoli rientranti, sfuma allontanandosi,
# segue la forma vera della casa (anche a L o a U). Nella pagina è un'immagine piatta: costo quasi nullo su iPad.
# Uscita: ombra_<piano>.png (nero con trasparenza) + ombra_<piano>.json (dove appoggiarla, in metri della pagina)
# Uso: MODELLO=casa_terra.py PIANO=terra blender -b --python-exit-code 1 -P ombra.py -- <cartella_cottura>
#      opzioni: OMBRA_RES (1024), OMBRA_CAMP (256), OMBRA_DIST (distanza dell'ombra in metri, 1.6), OMBRA_MARG (2.5)
import os, sys, json
os.environ.setdefault("REALE", "1")
MODELLO = os.environ.get("MODELLO", "esempio_casa.py"); PIANO_N = os.environ.get("PIANO", "terra")
_src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), MODELLO)).read()
exec(_src[:_src.index("# FINE_MODELLO")] if "# FINE_MODELLO" in _src else _src[:_src.index('punta(float(os.environ.get("CX"')])
import bpy, numpy as np

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "."
os.makedirs(OUT, exist_ok=True)
RES = int(os.environ.get("OMBRA_RES", "1024")); CAMP = int(os.environ.get("OMBRA_CAMP", "256"))
DIST = float(os.environ.get("OMBRA_DIST", "1.6")); MARG = float(os.environ.get("OMBRA_MARG", "2.5"))

# curve -> geometria vera (arco della piantana, corrimano...) e modificatori applicati
bpy.ops.object.select_all(action="DESELECT")
for o in bpy.data.objects:
    if o.type in ("MESH", "CURVE"): o.select_set(True); bpy.context.view_layer.objects.active = o
bpy.ops.object.convert(target="MESH")
# i vetri non fanno un'ombra scura vera: li tolgo; tolgo anche luci e oggetti non solidi
for o in list(bpy.data.objects):
    if o.type != "MESH" or any(s.material and s.material.name.split(".")[0] in ("vetro", "rack_vetro") for s in o.material_slots):
        bpy.data.objects.remove(o, do_unlink=True)

# ingombro della casa (solo quello che sta a terra o poco sopra) e quota del pavimento del piano
import mathutils
mn = mathutils.Vector((1e9, 1e9, 1e9)); mx = -mn
for o in bpy.data.objects:
    for c in o.bound_box:
        w = o.matrix_world @ mathutils.Vector(c)
        mn = mathutils.Vector(map(min, mn, w)); mx = mathutils.Vector(map(max, mx, w))
z0 = float(mn.z)
x0, x1, y0, y1 = mn.x - MARG, mx.x + MARG, mn.y - MARG, mx.y + MARG

# terreno: un piano appena sotto la casa, con una texture su cui cuocere l'ombra
bpy.ops.mesh.primitive_plane_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, z0 - 0.002))
terra = bpy.context.object; terra.name = "terreno_ombra"; terra.scale = (x1 - x0, y1 - y0, 1)
bpy.ops.object.transform_apply(scale=True)
m = bpy.data.materials.new("terreno_ombra"); m.use_nodes = True
img = bpy.data.images.new("ombra", RES, int(RES * (y1 - y0) / (x1 - x0)), float_buffer=True)
tn = m.node_tree.nodes.new("ShaderNodeTexImage"); tn.image = img; m.node_tree.nodes.active = tn
terra.data.materials.append(m)

scn = bpy.context.scene
scn.render.engine = "CYCLES"; scn.cycles.samples = CAMP
if scn.world is None: scn.world = bpy.data.worlds.new("mondo")
scn.world.light_settings.distance = DIST
bpy.ops.object.select_all(action="DESELECT"); terra.select_set(True); bpy.context.view_layer.objects.active = terra
scn.render.bake.margin = 0
bpy.ops.object.bake(type="AO", margin=0, use_clear=True)

# AO (1 = cielo libero, 0 = coperto) -> trasparenza dell'ombra; leggero ammorbidimento contro il rumore
w, h = img.size
ao = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[:, :, 0]
k = np.array([1, 4, 6, 4, 1], np.float32); k /= k.sum()
for ax in (0, 1):
    ao = sum(np.roll(ao, s - 2, axis=ax) * k[s] for s in range(5))
a = np.clip((1.0 - ao) * 1.15, 0, 1) ** 1.1
# bordo dell'immagine sempre trasparente (niente righe se l'ombra arriva al margine)
fade = np.ones_like(a); n = max(4, RES // 64)
r = np.minimum(np.arange(w)[None, :], np.arange(w)[::-1][None, :]); c = np.minimum(np.arange(h)[:, None], np.arange(h)[::-1][:, None])
a *= np.clip(np.minimum(r, c) / n, 0, 1)
px = np.zeros((h, w, 4), np.float32); px[:, :, 3] = a
out = bpy.data.images.new("ombra_png", w, h, alpha=True)
out.pixels = px.ravel(); out.filepath_raw = os.path.join(OUT, f"ombra_{PIANO_N}.png"); out.file_format = "PNG"; out.save()
# posizione nella pagina (three.js: x = x, altezza = z di Blender, z = -y di Blender)
json.dump({"x": (x0 + x1) / 2, "z": -(y0 + y1) / 2, "y": z0 - 0.002, "larga": x1 - x0, "profonda": y1 - y0},
          open(os.path.join(OUT, f"ombra_{PIANO_N}.json"), "w"))
print("OMBRA", os.path.join(OUT, f"ombra_{PIANO_N}.png"), w, h, flush=True)
