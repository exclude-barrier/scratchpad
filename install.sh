#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-2.0-or-later
# Installs the extension for the current user. Run on the target machine.
# GNOME Shell only scans extensions at session start: log out and in once
# after an install or rollback.
#
# Usage: ./install.sh                  install build/<uuid>
#        ./install.sh --workspace-keys install, and also bind Super+Shift+1..4
#                                      to "move window to workspace 1..4"
#        ./install.sh --rollback       put the previously installed version back
#
# The new version is prepared and checked next to the old one, then swapped
# in with mv. The replaced version is kept in $STATE/previous.
set -euo pipefail
cd "$(dirname "$0")"

UUID=scratchpad@exclude-barrier.github.io
DATA=${XDG_DATA_HOME:-$HOME/.local/share}
DEST="$DATA/gnome-shell/extensions/$UUID"
# Outside the extensions directory: GNOME would try to load anything there.
STATE="$DATA/scratchpad"
STAGE="$STATE/staging"
PREV="$STATE/previous"
mkdir -p "$STATE" "$(dirname "$DEST")"

mode=install
workspace_keys=false
for arg in "$@"; do
    case "$arg" in
        --rollback) mode=rollback ;;
        --workspace-keys) workspace_keys=true ;;
        *) echo "Unknown option: $arg" >&2; exit 2 ;;
    esac
done

check_tree() {
    [ -f "$1/extension.js" ] && [ -f "$1/metadata.json" ] &&
        [ -f "$1/schemas/gschemas.compiled" ]
}

if [ $mode = rollback ]; then
    check_tree "$PREV" || { echo "No previous version in $PREV" >&2; exit 1; }
    rm -rf "$STAGE"
    [ -d "$DEST" ] && mv "$DEST" "$STAGE"
    mv "$PREV" "$DEST"
    [ -d "$STAGE" ] && mv "$STAGE" "$PREV"
    echo "Rolled back $DEST. Log out and in to load it."
    exit 0
fi

SRC=build/$UUID
if [ ! -f "$SRC/extension.js" ]; then
    echo "Missing $SRC: run 'npm ci && npm run build' first (deploy.sh does this)." >&2
    exit 1
fi

rm -rf "$STAGE"
cp -r "$SRC" "$STAGE"
glib-compile-schemas --strict "$STAGE/schemas"
check_tree "$STAGE" || { echo "Staged build in $STAGE is incomplete" >&2; exit 1; }

if [ -d "$DEST" ]; then
    rm -rf "$PREV"
    mv "$DEST" "$PREV"
fi
if ! mv "$STAGE" "$DEST"; then
    [ -d "$PREV" ] && mv "$PREV" "$DEST"
    echo "Install failed, previous version restored" >&2
    exit 1
fi

install -Dm644 data/io.github.exclude_barrier.Scratchpad.desktop \
    "$HOME/.local/share/applications/io.github.exclude_barrier.Scratchpad.desktop"

enabled=$(gsettings get org.gnome.shell enabled-extensions)
case "$enabled" in
    *"'$UUID'"*) ;;
    "@as []") gsettings set org.gnome.shell enabled-extensions "['$UUID']" ;;
    *) gsettings set org.gnome.shell enabled-extensions "${enabled%]}, '$UUID']" ;;
esac

# Optional: Super+Shift+1..4 moves a window to workspace N. On an overlay
# window mutter unsticks it first (meta_window_change_workspace_without_transients),
# and the extension releases it. Existing bindings for these actions are kept.
WM=org.gnome.desktop.wm.keybindings
$workspace_keys && for i in 1 2 3 4; do
    cur=$(gsettings get $WM move-to-workspace-$i)
    case "$cur" in
        *"'<Super><Shift>$i'"* | *"'<Shift><Super>$i'"*) ;;
        "@as []") gsettings set $WM move-to-workspace-$i "['<Super><Shift>$i']" ;;
        *) gsettings set $WM move-to-workspace-$i "${cur%]}, '<Super><Shift>$i']" ;;
    esac
    other=$(gsettings list-recursively |
        grep -E "'(<Super><Shift>|<Shift><Super>)$i'" |
        grep -v "^$WM move-to-workspace-$i " || true)
    if [ -n "$other" ]; then
        echo "Note: <Super><Shift>$i is also used by: $other"
    fi
done
if $workspace_keys &&
   [ "$(gsettings get org.gnome.desktop.wm.preferences num-workspaces)" -lt 4 ] &&
   [ "$(gsettings get org.gnome.mutter dynamic-workspaces)" = false ]; then
    echo "Note: fewer than 4 workspaces; Super+Shift+N only works up to num-workspaces."
fi

# GNOME binds Super+S to the quick settings menu by default; that binding
# takes the key from the scratchpad. Only report it, never change it.
if gsettings get org.gnome.shell.keybindings toggle-quick-settings |
   grep -qiE "'<super>s'"; then
    echo "Note: Super+S also opens quick settings. To free it for the scratchpad:"
    echo "  gsettings set org.gnome.shell.keybindings toggle-quick-settings \"[]\""
fi

echo "Installed to $DEST"
LANG=C gnome-extensions info "$UUID" 2>/dev/null | grep -E 'State' ||
    echo "Not loaded yet: log out and in once."
