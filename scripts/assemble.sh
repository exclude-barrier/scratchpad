#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-2.0-or-later
# Puts compiled JS, metadata and schemas together into build/<uuid>, the
# directory that gets installed. Run via `npm run build`.
set -euo pipefail
cd "$(dirname "$0")/.."

UUID=scratchpad@exclude-barrier.github.io
OUT=build/$UUID

rm -rf "$OUT"
mkdir -p "$OUT/schemas"
cp build/js/*.js "$OUT/"
cp extension/$UUID/metadata.json "$OUT/"
cp extension/$UUID/schemas/*.gschema.xml "$OUT/schemas/"
glib-compile-schemas --strict "$OUT/schemas"
echo "Built $OUT"
