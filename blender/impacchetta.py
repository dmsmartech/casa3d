# GLB -> glTF JSON con buffer base64 (normale e compresso meshopt), per la pagina pubblicata
# uso: python3 impacchetta.py <in.glb> <cartella_pagina> <nome>   (es. casa_terra)
import json, struct, base64, subprocess, sys, os
src, A, nome = sys.argv[1:4]
# gltfpack: quello indicato in GLTFPACK, altrimenti quello installato in strumenti/ (npm install), altrimenti quello nel PATH
import shutil
_loc = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "strumenti", "node_modules", ".bin", "gltfpack")
GP = os.environ.get("GLTFPACK") or next((g for g in (_loc, _loc + ".cmd") if os.path.exists(g)), None) or shutil.which("gltfpack") or _loc
def scrivi(glb, out):
    b = open(glb, "rb").read(); l = struct.unpack("<I", b[12:16])[0]; j = json.loads(b[20:20 + l]); off = 20 + l
    bl = struct.unpack("<I", b[off:off + 4])[0]; bin_ = b[off + 8:off + 8 + bl]
    j["buffers"][0] = {"byteLength": len(bin_), "uri": "data:application/octet-stream;base64," + base64.b64encode(bin_).decode()}
    open(out, "w").write(json.dumps(j, separators=(",", ":")))
    print(out, os.path.getsize(out))
# riserva senza meshopt: geometria quantizzata (KHR_mesh_quantization, letta da three senza decoder) per stare sotto i 16 MB
ql = src.replace(".glb", "_q.glb")
subprocess.run([GP, "-i", src, "-o", ql, "-kn", "-km", "-ke", "-kv", "-vtf", "-vpf"], check=True)
scrivi(ql, os.path.join(A, nome + "_mod.json"))
pk = src.replace(".glb", "_pk.glb")
subprocess.run([GP, "-i", src, "-o", pk, "-cc", "-kn", "-km", "-ke", "-kv", "-vtf", "-vpf"], check=True)
scrivi(pk, os.path.join(A, nome + "_pk.json"))
