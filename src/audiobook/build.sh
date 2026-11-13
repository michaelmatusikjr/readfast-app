#!/bin/sh
# Builds ../../mp3-worker.js. Needs: npm i @breezystack/lamejs@1.2.7 esbuild@0.24.0 (pass the folder holding node_modules as $1)
set -e
NM=${1:-.}
D=$(cd "$(dirname "$0")" && pwd)
NODE_PATH="$NM/node_modules" "$NM/node_modules/.bin/esbuild" "$D/mp3-worker-entry.js" --bundle --format=esm --minify --target=safari15 \
  --outfile="$D/../../mp3-worker.js" --log-level=warning
