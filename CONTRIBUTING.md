# Contributing

Scratchpad is a GNOME Shell extension written in TypeScript. Documentation and
code comments are in English. Keep changes focused and document every
observable behaviour change in [CHANGELOG.md](CHANGELOG.md).

## Setup

Needs Node.js 24 with npm, `glib-compile-schemas`, `zip` and `unzip`
(Debian/Ubuntu: `libglib2.0-bin zip unzip`).

```sh
npm ci
npm run build    # writes build/scratchpad@exclude-barrier.github.io
./install.sh     # installs into your own session; log out and in afterwards
```

`install.sh` changes local files and enabled-extension settings.
`--workspace-keys` also changes global window-manager shortcuts; `--rollback`
restores extension files, not those shortcuts.

## Checks

| Command | What it does |
|---|---|
| `npm run check` | Type check |
| `npm test` | 13 unit tests (geometry and package validation), no GNOME needed |
| `npm run pack` | Build and pack `build/<uuid>.shell-extension.zip` |
| `npm run check:package` | Validate the ZIP contents and versions, write the `.sha256` file |
| `npm run check:release` | All of the above in order |
| `npm run test:session` | Native GNOME 51 tests, see below |

CI runs `check:release`, `npm audit --audit-level=high`, `bash -n` and
ShellCheck on all shell scripts. CodeQL runs through GitHub's default setup.

### Native GNOME 51 tests

`npm run test:session` installs the built ZIP into a disposable HOME with a
private D-Bus and a headless compositor with two virtual monitors. It never
touches the running desktop. It runs 13 scenarios in real GJS/Mutter and GTK:
preferences, terminal adoption, membership, animation, cross-monitor dimming,
lock-mode transitions and cleanup.

Requirements: GNOME Shell 51, `gjs`, GTK 4/libadwaita, Ghostty, Python 3,
`dbus-daemon`, the `gnome-extensions` CLI and a headless EGL renderer.

```sh
npm run pack
npm run test:session
# dbus-daemon not in PATH:
npm run test:session -- --dbus-daemon /path/to/dbus-daemon
# Upgrade over an older release ZIP:
npm run test:session -- --upgrade-from /path/to/old.shell-extension.zip \
  --output build/session-upgrade-test
```

Reports, a screenshot and logs go to `build/session-test/` (or `--output`).
Limits:

- Assertions call extension methods directly. Physical input and PAM
  authentication are not tested.
- Warnings about missing desktop services (CalendarServer, portals) are
  expected in this minimal session.
- The compositor emits GLib/GObject assertions during final shutdown, after
  all scenarios pass. Their cause is not known.
- CI does not run this suite.

## Project layout

```text
src/extension.ts          Shell side: lifecycle, membership, animation, dimming, terminal, keys
src/prefs.ts              preferences window (GTK 4, libadwaita), separate process
src/compat.ts             API differences between GNOME versions
src/geometry.ts           pure geometry, unit-tested without GNOME
src/ambient.d.ts          GJS and GNOME Shell types (@girs)
extension/<uuid>/         metadata.json and GSettings schema
test/                     unit tests (node:test)
test/session/             native test driver, never shipped
scripts/assemble.sh       builds build/<uuid>
scripts/pack.sh           packs the release ZIP from an explicit file list
scripts/check-package.mjs validates the ZIP, writes the checksum
scripts/test-session.py   runs the native GNOME 51 tests
data/                     desktop entry for the terminal's dock icon
deploy.sh                 optional: build and install on a remote machine over SSH
```

## Code rules

- Release every signal, timeout, actor and keybinding in `disable()`.
- `prefs.ts` must not import Shell UI modules. Shell code must not import
  GTK, GDK or libadwaita.
- Route every API that differs between GNOME versions through `src/compat.ts`.
- Add a regression test in `test/geometry.test.ts` for geometry fixes.
- Update the settings table in the README when a setting or default changes.
- Never minify or obfuscate the shipped JavaScript.
- Do not commit `build/`, `node_modules/`, compiled schemas, credentials or
  `deploy.env`.
- Describe a manual test when a runtime change cannot be unit-tested.

See the [GNOME review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html).

### GNOME versions

The code is type-checked against the newest GNOME (`@girs/gnome-shell`). That
alone does not prove compatibility with older versions. Today `compat.ts` only
covers maximizing: mutter 49 replaced `maximize(flags)`/`unmaximize(flags)`
with argument-free versions and removed `get_maximized()`. The state is read
from the `maximized-horizontally` and `maximized-vertically` properties, which
exist in every supported version.

gnome-shell's `ease()` finds a running transition only by the snake_case key
`translation_y`. The types allow only `translationY`, so `easeTranslation()`
in `src/extension.ts` uses a cast.

To add a GNOME version:

1. `npm install --save-dev --save-exact @girs/gnome-shell@<new>`
2. `npm run check` and fix errors. Add a helper to `src/compat.ts` if older
   versions still need the old API.
3. Add the version to `shell-version` in `metadata.json` and test on it.

## Pull requests

Open a pull request against `main`. Merging requires the `build` check,
CodeQL, resolved conversations and linear history; changes are squash-merged.
Direct pushes, force pushes and branch deletion are blocked.

Dependabot pull requests are reminders only, and CI fails on them on purpose.
Apply the update in your own pull request; Dependabot then closes its own.
Keep `@types/node` on the Node.js major used to build (24), and update the
lockfile with every dependency or version change.

## Reporting bugs

Use [GitHub Issues](https://github.com/exclude-barrier/scratchpad/issues).
Include:

- Extension version and installation method (source, GitHub ZIP or EGO).
- Distribution, `gnome-shell --version`, Wayland/X11, monitors and scaling.
- Steps to reproduce, expected and actual behaviour, changed settings.
- Other enabled extensions, especially docks and tiling tools.
- Output of `journalctl --user -b | grep -i scratchpad`, without private data.

Report vulnerabilities privately instead, see [SECURITY.md](SECURITY.md).
