#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-2.0-or-later
# Packs build/<uuid> into build/<uuid>.shell-extension.zip for a GitHub
# release or extensions.gnome.org. The compiled schema is left out: GNOME
# 45+ compiles it on install (gnome-extensions install and the website).
set -euo pipefail
cd "$(dirname "$0")/.."

UUID=scratchpad@exclude-barrier.github.io
SRC=build/$UUID
ZIP=$PWD/build/$UUID.shell-extension.zip
[ -f "$SRC/extension.js" ] || { echo "Missing $SRC: run 'npm run build' first." >&2; exit 1; }

rm -f "$ZIP"
cp LICENSE "$SRC/"
(cd "$SRC" && zip -qr "$ZIP" . -x 'schemas/gschemas.compiled')
rm "$SRC/LICENSE"
echo "Packed $ZIP"
