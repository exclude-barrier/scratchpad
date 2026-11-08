# Scratchpad

A drop-down scratchpad overlay for GNOME Shell 46–51.

Press `Super+Q` and an overlay slides up from the bottom over the current
workspace, with everything underneath dimmed and blurred. If the scratchpad is
empty, it starts a terminal. Add any window to it, and the window stays there,
at the position and size you give it, until you release it.

## Keys

| Key | Action |
|---|---|
| `Super+Q` | Show or hide the overlay. Empty scratchpad: start the terminal |
| `Super+Shift+Q` | Add the focused window to the scratchpad, or release it |
| Click on the dimmed area | Hide the overlay |
| `Super+Shift+1..4` (optional, see [Installation](#installation)) | Move the window to workspace 1..4; this also releases it |

Both main keys can be changed in the [preferences window](#settings).

`Super+Q` is also the Ubuntu Dock shortcut, but only if the dock's `hot-keys`
option is on. The same goes for the dock's `Super+Shift+1..4` app keys.

## Behaviour

- Overlay windows are on all workspaces and always on top. When hidden, they
  are minimized, so they still show up in Alt+Tab and in the dock.
- Adding a window while the overlay is hidden parks it: it slides down and
  out of sight, and you stay where you are.
- By default windows are never moved or resized. With `tile-windows` on, the
  visible windows are laid out side by side in columns inside the overlay
  area (`height-percent`, `width-percent`, `gap-outer`, `gap-inner`).
- Multiple monitors: every monitor with an overlay window is dimmed. Drag a
  window to another monitor and it stays in the scratchpad; the dimming
  follows it.
- The overlay hides when you switch workspace (`hide-on-workspace-switch`)
  and when a window outside the scratchpad gets focus, for example by a click
  or Alt+Tab (`hide-on-focus-loss`). Dialogs of overlay windows do not count.
- Windows that open behind the open overlay appear dimmed right away.
- Releasing a window gives it back the state it had before: always on top,
  on all workspaces, and maximized or fullscreen if tiling removed that.
- The extension stays enabled on the lock screen. Otherwise GNOME would turn
  it off on every lock and all parked windows would drop out of the
  scratchpad. The keys do nothing on the lock screen.
- When the extension is turned off, all hidden windows come back.

## Requirements

- GNOME Shell 46–51. Only 51 is tested on a real session; 46–50 are checked
  against their type definitions and source code.
- A terminal that can set its own WM class. The default is
  [Ghostty](https://ghostty.org). Without one, `Super+Q` on an empty
  scratchpad shows the empty overlay.
- To build from source: Node.js 24, `glib-compile-schemas` and `zip`.

## Installation

From a release: download `scratchpad@exclude-barrier.github.io.shell-extension.zip`
from the [latest release](https://github.com/exclude-barrier/scratchpad/releases/latest), then

```
gnome-extensions install --force scratchpad@exclude-barrier.github.io.shell-extension.zip
```

log out and back in, and run
`gnome-extensions enable scratchpad@exclude-barrier.github.io`.

From source:

```
git clone https://github.com/exclude-barrier/scratchpad.git
cd scratchpad
npm ci
npm run build
./install.sh
```

Then log out and back in: GNOME Shell loads new extensions only at login.
Updates also need a new login.

`./install.sh --workspace-keys` also binds `Super+Shift+1..4` to "move window
to workspace 1..4". It only adds these keys and keeps existing bindings, and
it reports other actions that use the same keys.

`./install.sh --rollback` puts the previously installed version back. It is
kept in `~/.local/share/scratchpad/previous`.

To uninstall:

```
gnome-extensions disable scratchpad@exclude-barrier.github.io
rm -rf ~/.local/share/gnome-shell/extensions/scratchpad@exclude-barrier.github.io \
       ~/.local/share/scratchpad \
       ~/.local/share/applications/io.github.exclude_barrier.Scratchpad.desktop
```

## Settings

Open the preferences window from the Extensions app (Scratchpad → Settings),
or run `gnome-extensions prefs scratchpad@exclude-barrier.github.io`. It covers
every setting below: shortcuts (with a recorder), behaviour, terminal,
dimming, blur and tiling.

Everything can also be set with `gsettings`:

```
S=~/.local/share/gnome-shell/extensions/scratchpad@exclude-barrier.github.io/schemas
gsettings --schemadir $S list-recursively org.gnome.shell.extensions.scratchpad
gsettings --schemadir $S set org.gnome.shell.extensions.scratchpad tile-windows true
```

| Key | Default | Meaning |
|---|---|---|
| `toggle-scratchpad` | `['<Super>q']` | Show or hide the overlay |
| `move-to-scratchpad` | `['<Shift><Super>q']` | Add or release the focused window |
| `tile-windows` | `false` | Lay out windows in columns instead of leaving them where they are |
| `height-percent` | `100` | Overlay height in tiling mode, % of the work area |
| `width-percent` | `100` | Overlay width in tiling mode, % of the work area |
| `gap-outer` | `10` | Gap between overlay and screen edge, px |
| `gap-inner` | `5` | Half the gap between tiled windows, px |
| `dim` | `0.6` | How dark the background gets, 0–1 |
| `blur` | `true` | Blur the background. It is redrawn whenever something under the overlay changes; turn it off on slow GPUs |
| `hide-on-workspace-switch` | `true` | Hide the overlay on workspace switch |
| `hide-on-focus-loss` | `true` | Hide the overlay when another window gets focus |
| `launch-terminal` | `true` | Start a terminal when the scratchpad is empty |
| `terminal-command` | Ghostty, see below | Command that starts the terminal |
| `terminal-class` | `'io.github.exclude_barrier.Scratchpad'` | WM class of the terminal window |

The terminal window must get the WM class from `terminal-class`; that is how
the extension recognises it. In the preferences window the command is one
line, for example `alacritty --class io.github.exclude_barrier.Scratchpad`.
With `gsettings`:

```
# Ghostty (default)
gsettings --schemadir $S set org.gnome.shell.extensions.scratchpad terminal-command \
  "['ghostty', '--class=io.github.exclude_barrier.Scratchpad', '--gtk-single-instance=false']"
# Alacritty
gsettings --schemadir $S set org.gnome.shell.extensions.scratchpad terminal-command \
  "['alacritty', '--class', 'io.github.exclude_barrier.Scratchpad']"
# kitty
gsettings --schemadir $S set org.gnome.shell.extensions.scratchpad terminal-command \
  "['kitty', '--class', 'io.github.exclude_barrier.Scratchpad']"
```

## Development

```
src/extension.ts      the extension
src/prefs.ts          preferences window (GTK 4, libadwaita)
src/compat.ts         differences between GNOME versions
src/geometry.ts       pure geometry (overlay, tiles, monitor index), testable without GNOME
test/                 unit tests for geometry.ts (node:test)
src/ambient.d.ts      types for GJS and GNOME Shell (@girs)
extension/<uuid>/     metadata.json and GSettings schema
scripts/assemble.sh   builds build/<uuid> from compiled JS, metadata and schema
scripts/pack.sh       packs build/<uuid> into the release zip
data/                 desktop entry for the scratchpad terminal
deploy.sh             optional helper: build and install on a remote machine via an SSH jump host
```

`npm run check` type-checks, `npm test` runs the unit tests, `npm run build`
writes the extension to `build/scratchpad@exclude-barrier.github.io`, and
`npm run pack` also packs `build/scratchpad@exclude-barrier.github.io.shell-extension.zip`
for a release or extensions.gnome.org (without the compiled schema; GNOME
compiles it on install). CI runs `npm audit`, the type check, the tests and
the build on every push and pull request; CodeQL scans the code.

Before an upload to extensions.gnome.org, check the zip with
[shexli](https://pypi.org/project/shexli/). shexli 0.2.1 crashes with
tree-sitter 0.26 and flags GNOME 51 as a future release (it only knows up to
50); the second finding can be ignored:

```
uvx --python 3.12 --with 'tree-sitter<0.26' shexli \
  "$PWD/build/scratchpad@exclude-barrier.github.io.shell-extension.zip"
```

Window behaviour (adding, releasing, animations) needs a running GNOME Shell
and is not tested automatically.

### GNOME versions

The code is type-checked against the newest GNOME (`@girs/gnome-shell`).
Every call whose API differs in an older version goes through
`src/compat.ts`. Today that is only maximizing: mutter 49 replaced
`maximize(flags)` and `unmaximize(flags)` with `maximize()` and
`unmaximize()`, dropped `MaximizeFlags.BOTH` and removed `get_maximized()`.
The maximized state is read from the `maximized-horizontally` and
`maximized-vertically` properties, which exist in every supported version.

gnome-shell's `ease()` needs `translation_y` in snake_case: it finds the
running transition by that key. The types only allow `translationY`, with
which `ease()` finds no transition and `onComplete` runs at once. Hence
`easeTranslation()` with a cast in `src/extension.ts`.

Adding a new GNOME version:

1. `npm install --save-dev --save-exact @girs/gnome-shell@<new>`
2. `npm run check` and fix errors. If an older version still needs the old
   API, add a helper to `src/compat.ts`.
3. Add the version to `shell-version` in `metadata.json` and test on it.

### Manual test

1. `LANG=C gnome-extensions info scratchpad@exclude-barrier.github.io` shows `State: ACTIVE`.
2. `Super+Q`: the terminal slides up, the rest of the screen is dark and blurred.
3. `Super+Q`: the overlay slides away, the dimming goes.
4. Focus another window, `Super+Shift+Q`: it slides away. `Super+Q`: both
   windows are in the overlay, the second at its old position.
5. Move or resize a window in the overlay, `Super+Q` twice: position stays.
6. Overlay open, switch workspace: the overlay hides.
7. Overlay open, click a window outside it: the overlay hides.
8. Overlay open, in the scratchpad terminal run
   `sleep 2 && gnome-text-editor &`: the new window does not flash above the
   dimming. It takes focus, so the overlay then hides.
9. Overlay open, window focused, `Super+Shift+Q`: the window is normal again.
10. Window in the overlay, lock and unlock the screen: it is still in the scratchpad.
11. Add and release a window set to "Always on Top": the setting is back.
12. Two monitors, overlay open: drag a window to the other monitor and back.
    It stays in the scratchpad, and the monitor it is on is dimmed.
13. Press `Super+Q` quickly several times with an empty scratchpad: only one terminal starts.
14. `tile-windows true`, add and release a maximized window: it is maximized again.
15. Preferences window: change a shortcut and the dimming; both apply at once.
16. Errors: `journalctl --user -b | grep -i scratchpad`.

## Contributing

`main` is protected: changes go in through pull requests, squash-merged, with
CI (`build`) and CodeQL passing. Force pushes and branch deletion are blocked.

Release:

1. Bump `version-name` in `metadata.json` and `version` in `package.json`,
   run `npm install --package-lock-only`.
2. Pull request, merge.
3. `npm run pack`, check with shexli, then
   `gh release create vX.Y.Z build/scratchpad@exclude-barrier.github.io.shell-extension.zip`
   and upload the same zip to extensions.gnome.org.

Dependencies: Dependabot opens pull requests for npm and GitHub Actions
updates, but they are never merged; CI fails on them on purpose. Apply the
update in your own pull request instead; Dependabot then closes its own.
`@types/node` stays on the Node.js major used to build (24).

## Security

See [SECURITY.md](SECURITY.md). Please report vulnerabilities privately.

## License

GPL-2.0-or-later, see [LICENSE](LICENSE).
