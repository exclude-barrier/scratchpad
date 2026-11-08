# Scratchpad

A drop-down scratchpad overlay for GNOME Shell.

[![check](https://github.com/exclude-barrier/scratchpad/actions/workflows/check.yml/badge.svg)](https://github.com/exclude-barrier/scratchpad/actions/workflows/check.yml)
[![Release](https://img.shields.io/github/v/release/exclude-barrier/scratchpad)](https://github.com/exclude-barrier/scratchpad/releases/latest)
![GNOME Shell 46–51](https://img.shields.io/badge/GNOME%20Shell-46%E2%80%9351-4a86cf)
[![License: GPL-2.0-or-later](https://img.shields.io/badge/license-GPL--2.0--or--later-blue)](LICENSE)

Press `Super+S` and an overlay slides up over the current workspace, with
everything underneath dimmed and blurred. If the scratchpad is empty, it
starts a terminal. Add any window to it, and the window stays there, at the
position and size you give it, until you release it.

## Features

- Any window can join the scratchpad, not only a terminal.
- Windows keep their position and size. Column tiling is optional.
- Dimmed, blurred background on every monitor that shows an overlay window.
- The overlay hides on workspace switch or when another window gets focus.
- Released windows get their earlier state back: always on top, all
  workspaces, maximized or fullscreen.
- Membership survives screen locks. While locked, shortcuts are off and the
  overlay is hidden.
- Preferences window with a shortcut recorder.

## Installation

The extension is not on [extensions.gnome.org](https://extensions.gnome.org)
yet. Install it from a GitHub release or from source.

### From a release

1. Download `scratchpad@exclude-barrier.github.io.shell-extension.zip` from the
   [latest release](https://github.com/exclude-barrier/scratchpad/releases/latest).
   Do not use GitHub's "Source code" archive.
2. Optional: download the `.sha256` file too and verify the download:

   ```sh
   sha256sum -c scratchpad@exclude-barrier.github.io.shell-extension.zip.sha256
   ```

3. Install the ZIP:

   ```sh
   gnome-extensions install --force scratchpad@exclude-barrier.github.io.shell-extension.zip
   ```

4. Log out and back in. GNOME Shell loads new extensions only at login.
5. Enable the extension:

   ```sh
   gnome-extensions enable scratchpad@exclude-barrier.github.io
   ```

### From source

Needs Node.js 24 with npm, `glib-compile-schemas` and `zip`. On Debian/Ubuntu,
install `libglib2.0-bin zip`.

```sh
git clone https://github.com/exclude-barrier/scratchpad.git
cd scratchpad
npm ci
npm run build
./install.sh
```

Then log out and back in. Updates also need a new login.

`install.sh` also enables the extension and installs a hidden desktop entry
for the terminal's dock icon. Options:

- `--workspace-keys` binds `Super+Shift+1..4` to "move window to workspace
  1..4". It keeps existing bindings and reports conflicts.
- `--rollback` restores the previously installed version from
  `~/.local/share/scratchpad/previous`.

### Uninstall

```sh
gnome-extensions disable scratchpad@exclude-barrier.github.io
rm -rf ~/.local/share/gnome-shell/extensions/scratchpad@exclude-barrier.github.io \
       ~/.local/share/scratchpad \
       ~/.local/share/applications/io.github.exclude_barrier.Scratchpad.desktop
```

## Usage

| Key | Action |
|---|---|
| `Super+S` | Show or hide the overlay. If the scratchpad is empty, start the terminal |
| `Ctrl+Super+S` | Add the focused window to the scratchpad, or release it |
| Click on the dimmed area | Hide the overlay |
| `Super+Shift+1..4` | Move the window to workspace 1..4 and release it (needs `--workspace-keys`) |

Adding a window while the overlay is hidden parks it out of sight.
Hidden windows are minimized, so they still appear in Alt+Tab and the dock.

> [!NOTE]
> GNOME opens quick settings with `Super+S` by default, which takes the key
> from Scratchpad. `install.sh` prints a note while that binding is active.
> Free the key:
>
> ```sh
> gsettings set org.gnome.shell.keybindings toggle-quick-settings "[]"
> ```
>
> Undo with `gsettings reset org.gnome.shell.keybindings toggle-quick-settings`,
> or choose other keys in the preferences window.

## Configuration

Open the preferences from the Extensions app (Scratchpad → Settings) or run:

```sh
gnome-extensions prefs scratchpad@exclude-barrier.github.io
```

All settings are also available with `gsettings`:

```sh
S=~/.local/share/gnome-shell/extensions/scratchpad@exclude-barrier.github.io/schemas
gsettings --schemadir "$S" list-recursively org.gnome.shell.extensions.scratchpad
gsettings --schemadir "$S" set org.gnome.shell.extensions.scratchpad tile-windows true
```

| Key | Default | Meaning |
|---|---|---|
| `toggle-scratchpad` | `['<Super>s']` | Show or hide the overlay |
| `move-to-scratchpad` | `['<Control><Super>s']` | Add or release the focused window |
| `hide-on-workspace-switch` | `true` | Hide the overlay on workspace switch |
| `hide-on-focus-loss` | `true` | Hide the overlay when another window gets focus |
| `launch-terminal` | `true` | Start a terminal when the scratchpad is empty |
| `terminal-command` | Ghostty | Command that starts the terminal |
| `terminal-class` | `'io.github.exclude_barrier.Scratchpad'` | WM class of the terminal window |
| `dim` | `0.6` | Background darkness, 0–1 |
| `blur` | `true` | Blur the background. Turn it off on slow GPUs |
| `tile-windows` | `false` | Lay out windows in columns |
| `height-percent` | `100` | Overlay height when tiling, % of the work area |
| `width-percent` | `100` | Overlay width when tiling, % of the work area |
| `gap-outer` | `10` | Gap between overlay and screen edge when tiling, px |
| `gap-inner` | `5` | Half the gap between tiled windows, px |

### Terminal

The default terminal is [Ghostty](https://ghostty.org). Any terminal works if
it can set its WM class to the value of `terminal-class`; that is how the
extension recognises its window. In the preferences window, enter the command
as one line, for example:

```text
alacritty --class io.github.exclude_barrier.Scratchpad
kitty --class io.github.exclude_barrier.Scratchpad
```

The command runs without a shell: pipes, redirects, `$VAR` and `~` are not
expanded. Use only commands you trust, see [SECURITY.md](SECURITY.md).
Without a working terminal, `Super+S` on an empty scratchpad shows the
empty overlay.

## Compatibility

- GNOME Shell 46–51. Releases are tested in a headless GNOME 51 session;
  46–50 are covered by API checks only.
- Scratchpad membership is kept in memory. After logout, add windows again.
- Scratchpad is not a privacy tool: hidden windows still show up in the
  overview, dock and screen captures.

Bugs and feature requests go to [GitHub Issues](https://github.com/exclude-barrier/scratchpad/issues).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tests and pull requests, and
[RELEASE.md](RELEASE.md) for the release process. Changes are listed in
[CHANGELOG.md](CHANGELOG.md).

## Security

Report vulnerabilities privately, see [SECURITY.md](SECURITY.md).

## License

[GPL-2.0-or-later](LICENSE)
