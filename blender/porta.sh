#!/usr/bin/env bash
# Porta un piano cotto nella cartella della pagina: mappe di luce in WebP + modello compresso (gltfpack).
# Uso: bash porta.sh <cartella_cottura> <piano> [cartella_web, predefinita ../modello_web]
# Il piano ha un nome libero (terra, sopra, taverna, primo, mansarda...): lo stesso scritto in casa.config.js → motore.piani
set -e
C=$1; P=${2:-terra}; A=${3:-$(dirname "$0")/../modello_web}
[ -f "$C/casa_$P.json" ] || { echo "manca $C/casa_$P.json: prima la cottura (cuoci.py)"; exit 1; }
mkdir -p "$A"
# prefisso delle mappe di un piano (lo stesso del motore, prefissoPiano): "terra" nessuno, "sopra" s_, gli altri <piano>_
pref() { case "$1" in terra) echo "";; sopra) echo "s_";; *) echo "${1}_";; esac; }
PRE=$(pref "$P")
# via le mappe vecchie di QUESTO piano (mai quelle degli altri piani): l'elenco scritto dall'ultima volta che è stato portato
EL="$A/.mappe_$P.elenco"
if [ -f "$EL" ]; then while IFS= read -r n; do [ -n "$n" ] && rm -f "$A/$n"; done < "$EL"
elif [ -n "$PRE" ]; then rm -f "$A"/luce_"$PRE"*.webp
else
  # piano terra portato per la prima volta con questo script: tolgo le mappe che non hanno il prefisso di un altro piano
  altri=(); for j in "$A"/casa_*.json; do [ -e "$j" ] || continue; q=$(basename "$j" .json); case "$q" in *_pk|*_mod) continue;; esac
    q=${q#casa_}; [ "$q" = terra ] || altri+=("$(pref "$q")"); done
  for f in "$A"/luce_*.webp; do [ -e "$f" ] || continue; n=$(basename "$f"); n=${n#luce_}; tieni=0
    for a in "${altri[@]}"; do [[ $n == "$a"* ]] && tieni=1; done; [ $tieni = 1 ] || rm -f "$f"; done
fi
: > "$EL"
for f in "$C"/luce_*.jpg; do n=$(basename "$f" .jpg); n=${n#luce_}; n=${n//|/__}; n=${n// /_}
  cwebp -quiet -q 95 -sharp_yuv -sns 0 -f 0 "$f" -o "$A/luce_${PRE}${n}.webp"; echo "luce_${PRE}${n}.webp" >> "$EL"; done
cp "$C/casa_$P.json" "$A/casa_$P.json"
# parquet in alta definizione (pavimento.py, facoltativo)
if [ -f "$C/pavimento_$P.png" ]; then cwebp -quiet -q 88 "$C/pavimento_$P.png" -o "$A/pavimento_$P.webp"; fi
# ombra a terra calcolata da ombra.py (facoltativa): immagine con trasparenza + posizione
if [ -f "$C/ombra_$P.png" ]; then cwebp -quiet -q 90 -alpha_q 100 "$C/ombra_$P.png" -o "$A/ombra_$P.webp"; cp "$C/ombra_$P.json" "$A/ombra_$P.json"; fi
python3 "$(dirname "$0")/impacchetta.py" "$C/casa_$P.glb" "$A" "casa_$P"
echo "piano $P pronto in $A"
