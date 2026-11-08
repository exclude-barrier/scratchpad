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
trap 'rm -f "$SRC/LICENSE"' EXIT
# Explicit allowlist: stale output, source maps and local files must never
# enter an upload. -X omits platform-specific extra file attributes.
(cd "$SRC" && zip -Xq "$ZIP" \
    extension.js prefs.js compat.js geometry.js metadata.json LICENSE \
    schemas/org.gnome.shell.extensions.scratchpad.gschema.xml)
echo "Packed $ZIP"
