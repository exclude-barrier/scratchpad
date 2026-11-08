# Contributing

Scratchpad is a TypeScript GNOME Shell extension. User-facing documentation
and code comments are in English. Keep changes focused and document any
observable behaviour change.

## Development setup

Use Node.js 24 with npm, `glib-compile-schemas`, `zip` and `unzip`.
On Debian/Ubuntu the system tools are in `libglib2.0-bin zip unzip`.

```sh
npm ci
npm run check:release
npm audit --audit-level=high
for script in install.sh deploy.sh scripts/*.sh; do
  bash -n "$script"
done
```

`check:release` performs the type check, 13 tests (seven geometry and six package
regressions), build, packaging and archive validation. The geometry tests compile
with `tsconfig.test.json`; package tests use native Node.js modules and temporary
ZIP fixtures. Both use `node:test`, without GJS, GTK or Mutter. CI also runs
ShellCheck at warning/error severity; the deployment helper's informational
SC2029 messages describe intentional expansion of local SSH parameters.

## Isolated GNOME 51 integration tests

On a Linux GNOME 51 test host, install `gnome-shell`, `gjs`, GTK 4/libadwaita,
Ghostty, Python 3, `dbus-daemon`, and the GNOME Extensions CLI. The runner
requires a usable headless EGL renderer (software rendering is requested).
It creates a private D-Bus, disposable HOME/XDG directories and two virtual
Wayland monitors. It does not install into or change the running desktop's
settings. No private-bus service activation is allowed.
System-bus requests are also redirected to the private bus, so the test
compositor cannot register with the real GDM/logind session.

```sh
npm run pack
npm run test:session
# If dbus-daemon is not in PATH:
npm run test:session -- --dbus-daemon /path/to/dbus-daemon
# File upgrade from a previously downloaded 1.3.0 release ZIP:
npm run test:session -- --upgrade-from /path/to/1.3.0.shell-extension.zip \
  --output build/session-upgrade-test
```

The suite checks 13 scenarios under actual GJS/Mutter and a separate GTK
process. It exercises the installed ZIP, preferences and shortcut recorder,
terminal adoption, animations, cross-monitor dimming, `unlock-dialog`
transitions, late windows, maximized/fullscreen restoration and cancellation
of real Gio subprocess waits. Assertions call extension methods directly;
they do not emulate physical shortcut delivery or PAM authentication.
The driver uses private extension fields deliberately for lifecycle assertions
and is never shipped in the extension ZIP.

Reports, a synthetic-desktop screenshot, and private-bus/Shell logs are kept in
`build/session-test/` (or `--output`). Reports include the tested ZIP SHA-256,
source commit, dirty status and installation mode. A file upgrade installs
the old ZIP then replaces it before the fresh compositor starts; it is not an
in-session reload of an old cached module. Missing desktop services can cause
expected CalendarServer/portal warnings in this deliberately minimal session.
Native GLib/GObject assertions were also observed during final compositor
teardown; their cause is not established by this suite. A passed JSON report
means the scripted operations passed, not that the entire Shell journal is
clean. Inspect logs and repeat normal-session validation before EGO submission.
The ordinary Ubuntu CI job runs only the Node
tests, package validation and static checks, not this GNOME 51 suite.

Also follow the physical/manual tests in [README.md](README.md#manual-test)
and the EGO acceptance checks in [RELEASE.md](RELEASE.md).

## Local installation

Use `npm run build` and `./install.sh` only when you want to install into your
own desktop session. Installation changes local files and enabled-extension
settings. `--workspace-keys` also changes global window-manager shortcuts;
rollback restores extension files, not those shortcut settings.
The SSH deployment helpers are optional developer tools, not release dependencies.

## Code layout and review rules

- `src/extension.ts`: GNOME Shell lifecycle, window membership, animations,
  dimming, terminal launch and keybindings. Release every owned signal,
  timeout, actor and binding in `disable()`.
- `src/prefs.ts`: GTK 4/libadwaita preferences in a separate process. Do not
  import Shell UI modules here, or GTK/GDK/libadwaita into Shell code.
- `src/compat.ts`: version-specific Mutter APIs. A type check against GNOME
  51 alone does not demonstrate compatibility with 46–50.
- `src/geometry.ts` and `test/geometry.test.ts`: GNOME-independent geometry
  and its unit tests. Add regression tests here for geometry fixes.
- `test/package.test.mjs`: valid and intentionally invalid ZIP fixtures.
- `test/session/` and `scripts/test-session.py`: disposable native-runtime tests.
- `extension/<uuid>/`: release metadata and the GSettings schema. Update
  README defaults whenever settings change.
- `scripts/assemble.sh`, `scripts/pack.sh`, `scripts/check-package.mjs`:
  readable JS build, explicit upload allowlist, and archive validation.

Do not commit `build/`, `node_modules/`, compiled schemas, credentials or
`deploy.env`. Never minify or obfuscate the submitted JavaScript. Runtime
changes need a reproducible manual test description when unit testing cannot
exercise them. See the [GNOME review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html).

## Pull requests and dependencies

Open a pull request against `main`. Repository rules require the `build`
check and CodeQL, resolved review conversations and linear history; changes
are squash-merged. The rules also block force pushes and branch deletion.
CodeQL uses GitHub's default setup, not a workflow in this repository.

Dependabot pull requests are reminders only: the current CI intentionally
fails for them. Apply the update in your own pull request rather than merging
the bot's branch. Keep `@types/node` on the build's Node.js major (24).
Update the lockfile together with dependency or package-version changes.

## Reporting bugs

Use [GitHub Issues](https://github.com/exclude-barrier/scratchpad/issues) for
non-security bugs. Include:

- Extension version and installation method (source, GitHub ZIP or EGO).
- Distribution, `gnome-shell --version`, Wayland/X11, monitor layout and scaling.
- Steps to reproduce, expected behaviour, actual behaviour and relevant settings.
- Other enabled extensions, especially docks, tiling and window-management tools.
- Relevant output from `journalctl --user -b | grep -i scratchpad`, with private
  information removed.

Use [SECURITY.md](SECURITY.md) instead for vulnerabilities. Release maintainers
should follow [RELEASE.md](RELEASE.md); a successful build is not approval to publish.
