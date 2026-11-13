#!/bin/sh
# Builds ../../piper-worker.js. Needs: npm i @mintplex-labs/piper-tts-web@1.0.5 onnxruntime-web@1.18.0 esbuild@0.24.0
# (run from a folder that has those in node_modules; pass that folder as $1). build.mjs patches the library for speed control.
set -e
D=$(cd "$(dirname "$0")" && pwd)
node "$D/build.mjs" "${1:-.}"
