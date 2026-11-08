// SPDX-License-Identifier: GPL-2.0-or-later
// API differences between the supported GNOME Shell versions (46-51).
//
// The project is type-checked against the newest GNOME version. Every call
// whose API differs in an older version goes through a helper here, so a new
// GNOME release only needs: bump @girs/gnome-shell, run `npm run check`, fix
// what breaks, add a helper here if older versions still need the old way.
//
// Checked against @girs/meta-14..18, meta-51, shell-14..18, shell-51 and the
// gnome-shell 46.0/47.0 sources. Only maximize state differs.

import Meta from 'gi://Meta';

// mutter 49 (GNOME 49) replaced maximize(flags)/unmaximize(flags) with
// maximize()/unmaximize() and dropped MaximizeFlags.BOTH.
interface LegacyMaximizeWindow {
    unmaximize(directions: number): void;
    maximize(directions: number): void;
}

const LEGACY_MAXIMIZE_BOTH = Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL;

function hasModernMaximize(win: Meta.Window): boolean {
    return typeof (win as Partial<Meta.Window>).is_maximized === 'function';
}

// The maximized-horizontally/-vertically properties exist in every
// supported version, unlike get_maximized() (removed in 49).
export function isMaximized(win: Meta.Window): boolean {
    return win.maximized_horizontally || win.maximized_vertically;
}

export function unmaximize(win: Meta.Window): void {
    if (!isMaximized(win))
        return;
    if (hasModernMaximize(win))
        win.unmaximize();
    else
        (win as unknown as LegacyMaximizeWindow).unmaximize(LEGACY_MAXIMIZE_BOTH);
}

export function maximize(win: Meta.Window): void {
    if (hasModernMaximize(win))
        win.maximize();
    else
        (win as unknown as LegacyMaximizeWindow).maximize(LEGACY_MAXIMIZE_BOTH);
}
