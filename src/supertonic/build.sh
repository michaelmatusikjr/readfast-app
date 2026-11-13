#!/bin/sh
# Builds ../../supertonic-worker.js. Needs: npm i onnxruntime-web@1.31.1 esbuild@0.24.0
# (run from a folder that has those in node_modules; pass that folder as $1)
set -e
NM=${1:-.}
D=$(cd "$(dirname "$0")" && pwd)
NODE_PATH="$NM/node_modules" "$NM/node_modules/.bin/esbuild" "$D/worker-entry.js" --bundle --format=esm --minify --target=safari15 --external:fs --external:path --external:crypto --external:worker_threads \
  --outfile="$D/../../supertonic-worker.js" --log-level=warning
