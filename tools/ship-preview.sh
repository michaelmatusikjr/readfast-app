#!/bin/sh
# Publish the current build to the preview app (michaelmatusikjr/ToozeReader-preview, served by GitHub Pages at
# https://michaelmatusikjr.github.io/ToozeReader-preview/). The preview repo is a deploy target only; source lives here.
# Usage: sh tools/ship-preview.sh     (PREVIEW_DIR defaults to /home/user/ToozeReader-preview)
set -e
SRC=$(cd "$(dirname "$0")/.." && pwd)
DEST=${PREVIEW_DIR:-/home/user/ToozeReader-preview}
[ -d "$DEST/.git" ] || { echo "No preview clone at $DEST (add_repo michaelmatusikjr/ToozeReader-preview, clone it there)"; exit 1; }

(cd "$SRC/src" && python3 assemble.py)
VER=$(grep -o "APP_VERSION='[^']*'" "$SRC/src/g_extra.js" | cut -d"'" -f2)

# Replace the preview's files with the site files from this repo (tracked files only, no source/tests/docs).
find "$DEST" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
(cd "$SRC" && git ls-files | grep -vE '^(src|tests|docs|tools)/|^(CLAUDE|README)\.md$|^package(-lock)?\.json$|^b11_' \
  | while read -r f; do mkdir -p "$DEST/$(dirname "$f")"; cp "$f" "$DEST/$f"; done)

# Make it a separate app on the home screen: own name, own cache, orange-tinted icon, version marked "preview".
python3 - "$DEST" "$VER" <<'EOF'
import sys, json, re
from PIL import Image, ImageOps
d, ver = sys.argv[1], sys.argv[2]
m = json.load(open(f'{d}/manifest.json'))
m.update(name='Tooz Preview', short_name='Tooz Preview', theme_color='#D9661F')
json.dump(m, open(f'{d}/manifest.json', 'w'), indent=2)
h = open(f'{d}/index.html').read()
h = h.replace('<meta name="apple-mobile-web-app-title" content="Tooz">', '<meta name="apple-mobile-web-app-title" content="Tooz Preview">')
h = h.replace('<title>Tooz eReader</title>', '<title>Tooz Preview</title>')
h = h.replace(f"APP_VERSION='{ver}'", f"APP_VERSION='{ver} preview'")
open(f'{d}/index.html', 'w').write(h)
s = open(f'{d}/sw.js').read()
s = re.sub(r"const CACHE = '[^']*'", f"const CACHE = 'tooz-preview-{ver}'", s)
open(f'{d}/sw.js', 'w').write(s)
for n in ('icon-180.png', 'icon-512.png'):
    im = Image.open(f'{d}/{n}').convert('RGB')
    ImageOps.colorize(ImageOps.grayscale(im), black='#3A1500', white='#FFE2C8', mid='#D9661F').save(f'{d}/{n}')
EOF

cat > "$DEST/README.md" <<EOF
# Tooz Preview

Test copy of the Tooz eReader, published from \`michaelmatusikjr/readfast-app\` by \`tools/ship-preview.sh\`.
Don't edit this repo; changes here are overwritten. Open https://michaelmatusikjr.github.io/ToozeReader-preview/ on the
iPhone and add it to the home screen.
EOF

cd "$DEST"
git add -A
if git diff --cached --quiet; then echo "Preview already up to date ($VER)"; exit 0; fi
git commit -q -m "Preview $VER" -m "From readfast-app $(cd "$SRC" && git rev-parse --short HEAD)"
for k in 1 2 3 4; do git -c push.negotiate=true push -q origin HEAD:main && break; sleep $((k*2)); done
echo "Preview $VER pushed"
