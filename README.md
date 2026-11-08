# Scratchpad

A drop-down scratchpad overlay for GNOME Shell 46–51.

[Releases](https://github.com/exclude-barrier/scratchpad/releases) ·
[Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md) ·
[Release checklist](RELEASE.md) · [Security](SECURITY.md)

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
  scratchpad. On lock, the overlay hides and its shortcuts are removed;
  unlocking registers them again without automatically opening the overlay.
- When the extension is turned off, all hidden windows come back.

## Requirements

- GNOME Shell 46–51 is declared in the metadata. Release 1.3.1 is integration-
  tested on GNOME 51 with two virtual Wayland monitors, real GTK preferences
  and Ghostty. Versions 46–50 have API/source checks, not session-test results.
  Physical-input and authenticated screen-lock tests remain manual; see
  [release validation](RELEASE.md).
- A terminal that can set its own WM class. The default is
  [Ghostty](https://ghostty.org). Without one, `Super+Q` on an empty
  scratchpad shows the empty overlay.
- To build from source: Node.js 24 with npm, `glib-compile-schemas` and `zip`.
  Package validation also needs `unzip` (Debian/Ubuntu packages:
  `libglib2.0-bin zip unzip`). Node.js is not needed to run the extension.

## Installation

From a release: download `scratchpad@exclude-barrier.github.io.shell-extension.zip`
from the [latest release](https://github.com/exclude-barrier/scratchpad/releases/latest)
(not GitHub's source-code ZIP), then

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

The source installer additionally installs a hidden desktop entry for the
default Ghostty terminal's dock icon and enables the extension in GSettings.
The release ZIP intentionally contains neither the installer nor that desktop
entry; it is not required for the overlay or terminal launch to work.

`./install.sh --workspace-keys` also binds `Super+Shift+1..4` to "move window
to workspace 1..4". It only adds these keys and keeps existing bindings, and
it reports other actions that use the same keys.

`./install.sh --rollback` puts the previously installed version back. It is
kept in `~/.local/share/scratchpad/previous`.
This backup is made by the source installer, not by `gnome-extensions install`.
The extension and backup paths respect `XDG_DATA_HOME` when set.

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
gsettings --schemadir "$S" list-recursively org.gnome.shell.extensions.scratchpad
gsettings --schemadir "$S" set org.gnome.shell.extensions.scratchpad tile-windows true
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
gsettings --schemadir "$S" set org.gnome.shell.extensions.scratchpad terminal-command \
  "['ghostty', '--class=io.github.exclude_barrier.Scratchpad', '--gtk-single-instance=false']"
# Alacritty
gsettings --schemadir "$S" set org.gnome.shell.extensions.scratchpad terminal-command \
  "['alacritty', '--class', 'io.github.exclude_barrier.Scratchpad']"
# kitty
gsettings --schemadir "$S" set org.gnome.shell.extensions.scratchpad terminal-command \
   "['kitty', '--class', 'io.github.exclude_barrier.Scratchpad']"
```

The command is an argument list, not a shell script. Pipes, redirects,
environment-variable expansion and `~` expansion are not performed. Use only
commands you trust; see [SECURITY.md](SECURITY.md). Window membership is kept
in memory, not saved across logout. On enable, matching terminal windows can
be adopted again, but arbitrary windows must be added again.

## Development

```
src/extension.ts      the extension
src/prefs.ts          preferences window (GTK 4, libadwaita)
src/compat.ts         differences between GNOME versions
src/geometry.ts       pure geometry (overlay, tiles, monitor index), testable without GNOME
test/                 geometry and package regression tests (node:test)
test/session/         real GNOME/GTK integration driver; never included in ZIP
src/ambient.d.ts      types for GJS and GNOME Shell (@girs)
extension/<uuid>/     metadata.json and GSettings schema
scripts/assemble.sh   builds build/<uuid> from compiled JS, metadata and schema
scripts/pack.sh       packs build/<uuid> into the release zip
scripts/check-package.mjs validates ZIP contents and versions; writes SHA-256
scripts/test-session.py runs ZIP tests in a private headless GNOME session
data/                 desktop entry for the scratchpad terminal
deploy.sh             optional helper: build and install on a remote machine via an SSH jump host
```

`npm run check` type-checks, `npm test` runs the unit tests, `npm run build`
writes the extension to `build/scratchpad@exclude-barrier.github.io`, and
`npm run pack` also packs `build/scratchpad@exclude-barrier.github.io.shell-extension.zip`
for a release or extensions.gnome.org (without the compiled schema; GNOME
compiles it on install). `npm run check:release` type-checks, tests, builds,
packs and validates the actual archive, then writes a `.zip.sha256` file.
CI also runs `npm audit`, Bash syntax and ShellCheck, and keeps the ZIP and
checksum as build artifacts. CodeQL is configured through GitHub default setup.

Before an upload, follow [RELEASE.md](RELEASE.md), including the independent
shexli review and its documented GNOME-version limitation. Passing static
checks is not evidence of successful GNOME runtime testing or EGO approval.

`npm test` runs 13 geometry/package tests without GNOME. On a GNOME 51 test
host, `npm run test:session` additionally installs the exact ZIP into a
disposable HOME, private D-Bus and headless compositor with two virtual
monitors. It tests 13 runtime scenarios, including real GTK preferences,
membership, animation, lock-mode transitions and cleanup. Requirements and
limitations are documented in [CONTRIBUTING.md](CONTRIBUTING.md#isolated-gnome-51-integration-tests).
This optional suite is not run by the standard Ubuntu CI job.

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

See [CONTRIBUTING.md](CONTRIBUTING.md) for checks and bug reports,
[CHANGELOG.md](CHANGELOG.md) for release history, and
[RELEASE.md](RELEASE.md) for packaging, manual acceptance tests and upload.

Dependencies: Dependabot opens pull requests for npm and GitHub Actions
updates, but they are never merged; CI fails on them on purpose. Apply the
update in your own pull request instead; Dependabot then closes its own.
`@types/node` stays on the Node.js major used to build (24).

## Security

See [SECURITY.md](SECURITY.md). Please report vulnerabilities privately.

## License

GPL-2.0-or-later, see [LICENSE](LICENSE).
