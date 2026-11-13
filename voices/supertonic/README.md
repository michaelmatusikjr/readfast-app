# Supertonic 3 voice model (modified copy)

This folder holds a **modified** copy of the Supertonic 3 text-to-speech model by Supertone Inc.
Original: https://huggingface.co/supertone-oss-archive/supertonic-3 (revision aafc6e32416a594460b32413efc49d7fe4ce6d46).

**Modification (Nov 2026, for Tooz eReader):** the four ONNX files in `onnx/` were reduced from about 397 MB to about 101 MB
by storing each large weight tensor as 8-bit integers with a per-channel scale and a `DequantizeLinear` node in front of it
(weight-only quantization; all arithmetic still runs in 32-bit floats). `tts.json`, `unicode_indexer.json` and the
`voice_styles/*.json` files are unmodified copies. The script that made the change is `src/supertonic/quantize_weights.py`.

The model is licensed under the BigScience Open RAIL-M License (see `LICENSE` in this folder), including its
use-based restrictions (Attachment A), which apply to anyone who uses this copy.
