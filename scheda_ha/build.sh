#!/usr/bin/env bash
# Crea dist/casa3d: scheda + modello + mappe di luce, pronti da copiare in /config/www/casa3d di Home Assistant.
# Uso: bash build.sh            (prende la casa da ../modello_web, vedi blender/porta.sh)
#      CASA_DIR=/altra/cartella bash build.sh
# Serve: node (npm install fatto qui), cwebp/dwebp/webpinfo (libwebp), basisu (KTX2).
set -e
cd "$(dirname "$0")"
CASA_DIR=${CASA_DIR:-../modello_web}
impronta() { if command -v md5 >/dev/null; then md5 -q "$@"; else md5sum "$@" | cut -c1-32; fi; }
impronta_stdin() { if command -v md5 >/dev/null; then md5; else md5sum | cut -c1-32; fi; }
[ -d node_modules/three ] || npm install --silent
rm -rf dist/casa3d && mkdir -p dist/casa3d
# tutti i piani presenti (casa_<piano>.json), con qualsiasi nome: terra, sopra, taverna, primo, mansarda...
for j in "$CASA_DIR"/casa_*.json; do
  p=$(basename "$j" .json); case "$p" in *_pk|*_mod) continue;; esac; p=${p#casa_}
  cp "$CASA_DIR/casa_$p.json" "$CASA_DIR/casa_${p}_pk.json" "$CASA_DIR/casa_${p}_mod.json" dist/casa3d/ 2>/dev/null || true
done
cp "$CASA_DIR"/luce_*.webp dist/casa3d/
# computer: mappe al massimo MAX_D px per lato (2048) per giorno e sera, MAX_DL (1024) per le singole lampade.
# Con la cottura definitiva il soggiorno arrivava a 4224 px: la casa compariva dopo 8-11 s, quasi tutti spesi a decodificare
# e caricare nella scheda grafica. La luce cotta è morbida; il dettaglio del legno arriva dall'immagine del pavimento.
mkdir -p ktx_cache
for f in dist/casa3d/luce_*.webp; do
  case "$f" in *_m.webp) continue;; esac
  MX=${MAX_D:-2048}; case "$f" in *_giorno.webp|*_sera.webp) ;; *) MX=${MAX_DL:-1024};; esac
  w=$(webpinfo "$f" | awk '/Width:/{print $2; exit}'); [ "$w" -le "$MX" ] && continue
  c=ktx_cache/d_$(impronta "$f")_$MX.webp
  if [ ! -s $c ]; then hh=$(webpinfo "$f" | awk '/Height:/{print $2; exit}')
    dwebp -quiet "$f" -scale $MX $((hh * MX / w)) -o ktx_cache/tmpd.png && cwebp -quiet -q 90 ktx_cache/tmpd.png -o $c; fi
  cp $c "$f"
done
cp "$CASA_DIR"/poster_*.webp dist/casa3d/ 2>/dev/null || true
mkdir -p ktx_cache
for f in "$CASA_DIR"/pavimento_*.webp; do [ -e "$f" ] || continue; cp "$f" dist/casa3d/
  n=$(basename "$f" .webp); w=$(webpinfo "$f" | awk '/Width:/{print $2; exit}'); hh=$(webpinfo "$f" | awk '/Height:/{print $2; exit}')
  dwebp -quiet "$f" -scale $((w / 2)) $((hh / 2)) -o ktx_cache/pav.png && cwebp -quiet -q 85 ktx_cache/pav.png -o dist/casa3d/${n}_m.webp; done
cp "$CASA_DIR"/ombra_*.webp "$CASA_DIR"/ombra_*.json dist/casa3d/ 2>/dev/null || true
cp assets/det_pack.webp dist/casa3d/
# iPad/tablet: mappe di luce a metà risoluzione (_m) in WebP e in KTX2 ETC1S (compresse per la GPU, un quarto della memoria).
# Cache per impronta in ktx_cache/: le mappe già convertite non si rifanno.
mkdir -p ktx_cache
for f in dist/casa3d/luce_*.webp; do
  case "$f" in *_m.webp) continue;; esac
  # metà risoluzione, ma mai oltre MAX_M px per lato (1024): con la cottura definitiva le stanze grandi arrivavano a 2112 px
  # e l'iPad perdeva fotogrammi (60-110 ms) mentre le caricava; il dettaglio del legno arriva comunque dall'immagine del pavimento
  # le mappe delle singole lampade (non _giorno/_sera) si caricano su iPad mentre si usa la casa: più piccole (MAX_ML, 256 px)
  # (MM: variabile del singolo file. Prima si riusava MAX_M, così dopo la prima lampada anche giorno e sera restavano a 256 px)
  MM=${MAX_M:-1024}; case "$f" in *_giorno.webp|*_sera.webp) ;; *) MM=${MAX_ML:-256};; esac
  h=$(impronta "$f")_${MM}u; c=ktx_cache/$h
  if [ ! -s $c.ktx2 ] || [ ! -s $c.webp ]; then
    w=$(webpinfo "$f" | awk '/Width:/{print $2; exit}'); hh=$(webpinfo "$f" | awk '/Height:/{print $2; exit}')
    mw=$((w / 2)); mh=$((hh / 2)); [ $mw -gt $MM ] && mh=$((mh * MM / mw)) && mw=$MM
    dwebp -quiet "$f" -scale $mw $mh -o ktx_cache/tmp.png
    cwebp -quiet -q 82 ktx_cache/tmp.png -o $c.webp
    # giorno e sera: UASTC (qualità alta). La compressione leggera ETC1S lavora a blocchi con pochi colori e sulle pareti
    # bianche e lisce lasciava chiazze, che la correzione dei colori del motore rende ancora più visibili. Le mappe delle
    # singole lampade (piccole, caricate mentre si usa la casa) restano ETC1S
    case "$f" in *_giorno.webp|*_sera.webp) basisu -uastc -uastc_level 2 -uastc_rdo_l 1 -ktx2 -ktx2_zstandard_level 18 -mipmap -srgb -file ktx_cache/tmp.png -output_file $c.ktx2 >/dev/null 2>&1;;
      *) basisu -etc1s -q 255 -ktx2 -mipmap -srgb -file ktx_cache/tmp.png -output_file $c.ktx2 >/dev/null 2>&1;; esac
  fi
  cp $c.webp "${f%.webp}_m.webp"; cp $c.ktx2 "${f%.webp}_m.ktx2"
done
mkdir -p dist/casa3d/basis && cp node_modules/three/examples/jsm/libs/basis/basis_transcoder.{js,wasm} dist/casa3d/basis/
# modelli anche in .glb binario (la scheda prova prima questi)
node scripts/glb.mjs dist/casa3d
# versione dei file della casa = impronta del loro contenuto: aggiornare solo la scheda non fa riscaricare la casa
ASSET=$(cat dist/casa3d/casa_*.json $(ls dist/casa3d/ombra_*.json 2>/dev/null) dist/casa3d/*.glb dist/casa3d/*.webp dist/casa3d/*.ktx2 | impronta_stdin | cut -c1-10)
./node_modules/.bin/esbuild src/casa3d-full.js --bundle --format=esm --minify --target=es2020 \
  --loader:.css=text --define:__CASA3D_ASSET__=\"$ASSET\" --outfile=dist/casa3d/casa3d-full.js --log-level=warning
FULL=$(impronta dist/casa3d/casa3d-full.js | cut -c1-10)
# caricatore leggero registrato come risorsa in HA
./node_modules/.bin/esbuild src/casa3d-card.js --format=esm --minify --target=es2020 \
  --define:__CASA3D_FULL__=\"$FULL\" --outfile=dist/casa3d/casa3d-card.js --log-level=warning
cp prova.html piantina_giorno.html piantina_notte.html dist/
./node_modules/.bin/esbuild scripts/prova-config.mjs --bundle --format=esm --outfile=dist/prova-config.js --log-level=warning
echo "scheda: $FULL"
echo "versione file casa: $ASSET"
du -sh dist/casa3d; ls dist/casa3d | wc -l
