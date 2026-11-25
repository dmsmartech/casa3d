# Parte comune a ogni modello di piano: materiali realistici, cielo, sole, scheda grafica e la funzione accendi()
# che la cottura (cuoci.py) usa per accendere una lampada alla volta.
# Il modello del piano la esegue in fondo, DOPO aver creato muri, mobili e luci e definito:
#   BOX_STANZE = { "stanza": (x0, y0, x1, y1) }       riquadri delle stanze in coordinate di disegno (metri, y verso sud)
#   ENT = { "chiave": (["luce_blender", ...], ["oggetto_che_si_illumina", ...], "stanza") }
#   ZPAV = quota del pavimento del piano (0 al piano terra)
#   facoltativi: VICINI, PORTE_MOBILI, ZPAV_STANZE, gruppo_extra(o), materiali_reali(), SOLE_ROT (gradi)
import math, os, mathutils

if "stanza_di" not in globals():
    def stanza_di(o):
        """stanza che contiene il centro dell'oggetto (None se è fuori da tutte)"""
        c = sum((o.matrix_world @ mathutils.Vector(b) for b in o.bound_box), mathutils.Vector()) / 8
        x, y = c.x, -c.y
        for k, (x0, y0, x1, y1) in BOX_STANZE.items():
            if x0 <= x <= x1 and y0 <= y <= y1: return k
        return None

NOTTE = bool(os.environ.get("NOTTE"))
# materiali che emettono luce (paralumi, LED): una copia per oggetto, così si accendono uno alla volta
EMIT = []
for o in bpy.data.objects:
    if o.type != "MESH": continue
    for slot in o.material_slots:
        m = slot.material
        if m and m.node_tree and "Principled BSDF" in m.node_tree.nodes and m.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value > 0:
            mc = m.copy(); slot.material = mc
            EMIT.append((mc, mc.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value, o.name.split(".")[0]))
if os.environ.get("REALE", "1") != "0":
    exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "realismo.py")).read())
    if "materiali_reali" in globals(): materiali_reali()
w = bpy.data.worlds.new("cielo"); scn.world = w; w.use_nodes = True
bg = w.node_tree.nodes["Background"]
bpy.ops.object.light_add(type="SUN", location=(0, 0, 30))
luna = bpy.context.object
luna.data.color = (0.62, 0.72, 1.0); luna.data.angle = math.radians(6)
# direzione del sole: SOLE_ROT (gradi attorno alla verticale) per farlo entrare dalle finestre giuste
luna.rotation_euler = (math.radians(58), 0, math.radians(globals().get("SOLE_ROT", 150)))
# sera: in ogni stanza un pannello di luce calda grande e morbido sotto il soffitto (pozza di luce che sfuma verso i bordi,
# ombre morbide); il resto resta nel blu scuro del cielo. Solo per la mappa "sera". NOTTE_W = watt per m² (ambiente o modello)
LUCI_SERA = []
for _k, (_x0, _y0, _x1, _y1) in globals().get("BOX_STANZE", {}).items():
    if _k in (globals().get("SOPPALCHI", {}) or {}): continue  # il soppalco prende la luce della stanza sotto
    _w, _h = _x1 - _x0, _y1 - _y0
    bpy.ops.object.light_add(type="AREA", location=((_x0 + _x1) / 2, -(_y0 + _y1) / 2, globals().get("ZPAV", 0.0) + 2.0))
    _l = bpy.context.object; _l.name = "sera_" + _k
    _l.data.shape = "RECTANGLE"; _l.data.size = _w * 0.3; _l.data.size_y = _h * 0.3
    _l.data.color = tuple(globals().get("SERA_COLORE", (1.0, 0.66, 0.38)))
    _l.data.energy = _w * _h * float(os.environ.get("NOTTE_W", str(globals().get("NOTTE_W", 0))))
    _l.hide_render = True; LUCI_SERA.append(_l)
scn.render.engine = "CYCLES"
scn.cycles.samples = int(os.environ.get("CAMPIONI", "48")); scn.cycles.use_denoising = True
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for tipo in ("METAL", "OPTIX", "CUDA", "HIP", "ONEAPI"):
        try:
            prefs.compute_device_type = tipo; prefs.get_devices()
            if any(d.type == tipo for d in prefs.devices): break
        except Exception: pass
    for d in prefs.devices: d.use = True
    scn.cycles.device = "GPU"
except Exception as e:
    print("GPU non disponibile:", e)
scn.view_settings.view_transform = "AgX"; scn.view_settings.exposure = 0.4
TUTTE = [n for v in ENT.values() for n in v[0]]
def accendi(ent):
    """ent = chiave di ENT: solo quella lampada accesa, cielo nero. None = luce del giorno (o della sera con NOTTE)."""
    luci, emit = (ENT[ent][0], ENT[ent][1]) if ent else ([], [])
    for n in TUTTE:
        bpy.data.objects[n].hide_render = n not in luci
    for _l in LUCI_SERA: _l.hide_render = not (ent is None and NOTTE)
    for (mc, forza, nome) in EMIT:
        acceso = any(nome == e or nome.startswith(e) for e in emit)
        mc.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = forza if acceso else 0.0
    if ent is None:
        # luce del cielo (di giorno): colore e forza scelti dal modello (CIELO_COLORE, CIELO_FORZA). Di serie azzurro, come
        # concordato per le pareti: muri bianchi e luminosi, con i lati in ombra grigio-azzurri come nelle immagini demo.
        bg.inputs[0].default_value = (*globals().get("CIELO_COLORE", (0.50, 0.62, 0.85)), 1)
        bg.inputs[1].default_value = float(os.environ.get("CIELO", str(globals().get("CIELO_FORZA", 0.75))))
        luna.hide_render = False; luna.data.energy = float(os.environ.get("SOLE", "1.33")); luna.data.color = (1.0, 0.86, 0.72); luna.data.angle = math.radians(float(os.environ.get("SOLE_ANG", "32"))); scn.render.film_transparent = False
        if NOTTE:
            # sera: luce calda e morbida dall'alto su tutta la casa, come interni accesi visti dall'alto (non più cielo blu e buio).
            # NOTTE_COLORE / NOTTE_FORZA / NOTTE_LUNA nel modello o nell'ambiente per cambiarla
            bg.inputs[0].default_value = (*globals().get("NOTTE_COLORE", (0.12, 0.18, 0.40)), 1)
            bg.inputs[1].default_value = float(os.environ.get("NOTTE_FORZA", str(globals().get("NOTTE_FORZA", 0.45))))
            luna.data.energy = float(os.environ.get("NOTTE_LUNA", "0.15")); luna.data.color = (0.62, 0.74, 1.0); luna.data.angle = math.radians(10)
    else:
        bg.inputs[1].default_value = 0.0; luna.hide_render = True; scn.render.film_transparent = False

def anteprima(nome_file="anteprima.png", centro=(0.0, 0.0), scala=12.0, az=-32, el=56):
    """immagine di controllo dall'alto in isometria (env PROVA=1): da confrontare con le foto prima di cuocere"""
    accendi(None)
    try: scn.view_settings.look = "AgX - Punchy"
    except Exception: pass
    bpy.ops.object.camera_add(); cam = bpy.context.object; cam.data.type = "ORTHO"; scn.camera = cam
    AZ = math.radians(az); cx, cy = centro; cz = globals().get("ZPAV", 0.0)
    dist, e = 45, math.radians(el); cam.data.ortho_scale = scala
    cam.location = (cx + dist * math.cos(e) * math.sin(AZ), -cy - dist * math.cos(e) * math.cos(AZ), cz + dist * math.sin(e))
    d = (cx - cam.location[0], -cy - cam.location[1], cz - cam.location[2])
    cam.rotation_euler = (math.atan2(math.hypot(d[0], d[1]), -d[2]), 0, math.atan2(d[1], d[0]) - math.pi / 2)
    scn.render.resolution_x = 1600; scn.render.resolution_y = 1250
    scn.render.filepath = os.path.join(OUT, nome_file); bpy.ops.render.render(write_still=True)
    print("ANTEPRIMA", scn.render.filepath)
