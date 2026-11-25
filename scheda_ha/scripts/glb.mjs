// casa_<piano>_pk.json (glTF con geometria in base64) -> casa_<piano>_pk.glb binario, più leggero e senza decodifica
import fs from "fs";
import path from "path";
const d = process.argv[2];
// tutti i piani presenti, con qualsiasi nome (terra, sopra, taverna, mansarda...)
for (const p of fs.readdirSync(d).filter((n) => /^casa_.+_pk\.json$/.test(n)).map((n) => n.slice(5, -8))) {
  const f = path.join(d, `casa_${p}_pk.json`);
  if (!fs.existsSync(f)) continue;
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  const uri = j.buffers[0].uri; delete j.buffers[0].uri;
  let b = Buffer.from(uri.slice(uri.indexOf(",") + 1), "base64");
  let js = Buffer.from(JSON.stringify(j));
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  b = Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4, 0)]);
  const h = Buffer.alloc(12); h.writeUInt32LE(0x46546c67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + js.length + 8 + b.length, 8);
  const cj = Buffer.alloc(8); cj.writeUInt32LE(js.length, 0); cj.writeUInt32LE(0x4e4f534a, 4);
  const cb = Buffer.alloc(8); cb.writeUInt32LE(b.length, 0); cb.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(path.join(d, `casa_${p}_pk.glb`), Buffer.concat([h, cj, js, cb, b]));
}
