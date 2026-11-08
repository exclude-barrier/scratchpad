# Release and GNOME Extensions submission

## Release 1.3.1

This is a new release after `v1.3.0`; do not overwrite earlier tags or assets.
GitHub publication and GNOME Extensions approval are separate. The automated
and headless GNOME 51 checks below support GitHub publication with documented
compatibility limits; physical-input/lock-screen checks and EGO review are
still required before claiming full manual acceptance or EGO approval.

Preparation checks run on 2026-11-08:

| Check | Result |
|---|---|
| Clean `npm ci`, TypeScript check, build and schema compilation | Passed |
| Geometry and package regression tests | 13/13 passed |
| `npm audit --audit-level=high` | No vulnerabilities reported |
| ZIP integrity, seven-file allowlist, version/build consistency | Passed |
| Validator negative checks (extra file, missing schema, wrong version, stale build, numeric EGO version) | Rejected each invalid package |
| Shell syntax, ShellCheck warning/error level, Python syntax, local Markdown links | Passed |
| GNOME 51 headless clean ZIP install, real GTK/GJS/Mutter | 13/13 runtime scenarios passed |
| File upgrade from published 1.3.0 ZIP, followed by fresh GNOME startup | 13/13 runtime scenarios passed |
| Multi-monitor dimming regression with the fix deliberately removed from a test ZIP | Failed at the intended assertion; fixed ZIP passes |
| shexli 0.2.1 | One `EGO-M-004` finding for GNOME 51; see below |
| Physical input, real screen-lock authentication, GNOME 46–50 sessions | Not tested |

The native suite runs on Ubuntu 26.10, GNOME Shell/Mutter 51.0, GJS 1.90.0,
Wayland, two virtual monitors (1280×720 and 1024×768), and Ghostty. It tests
actual GTK/libadwaita widgets and uses a separate private D-Bus plus disposable
HOME/XDG directories, never the running user's desktop. `unlock-dialog` is
entered through Shell's session-mode API, not by authenticating a real screen
lock. There is no physical-input or visual-quality acceptance claim.

Repeat checks on the final merged release commit and keep the exact tested
ZIP. Attach the clean and upgrade JSON reports, `shexli-report.json`, and the
synthetic-desktop screenshot to the GitHub release. The reports include the
source commit, clean/dirty state and archive SHA-256. See
[CONTRIBUTING.md](CONTRIBUTING.md#isolated-gnome-51-integration-tests) for the
runner's dependencies and expected missing-service warnings.
The isolated compositor also emits native GLib/GObject assertions during final
shutdown, after the test operations pass; their cause has not been established.
These are retained in the local Shell logs, not silently counted as a clean
journal. Normal-session journal validation remains an outstanding EGO check.

The UUID is `scratchpad@exclude-barrier.github.io`; keep it unchanged for
updates. The human-readable `version-name` must match `package.json` and
`package-lock.json`. Do **not** add a numeric `version` to source metadata:
extensions.gnome.org (EGO) assigns its own submission number.

## 1. Build and inspect the upload

Run from the repository root, using Node.js 24 and installed GLib/ZIP tools:

```sh
npm ci
npm audit --audit-level=high
npm run check:release
npm run test:session
# Also test replacing a previously downloaded 1.3.0 ZIP before Shell startup:
npm run test:session -- --upgrade-from /path/to/1.3.0.shell-extension.zip \
  --output build/session-upgrade-test
for script in install.sh deploy.sh scripts/*.sh; do
  bash -n "$script"
done
unzip -l build/scratchpad@exclude-barrier.github.io.shell-extension.zip
```

The archive contains exactly these seven files, directly at the ZIP root
except for the schema:

```text
LICENSE
compat.js
extension.js
geometry.js
metadata.json
prefs.js
schemas/org.gnome.shell.extensions.scratchpad.gschema.xml
```

The build strictly compiles the schema locally. The ZIP deliberately omits
`gschemas.compiled`; GNOME 45+ compiles it during installation. There are no
Node.js modules, TypeScript sources, source maps, install/deploy scripts,
desktop entries, credentials or native binaries in the upload. Transpiled
JavaScript retains comments and is not minified.

`npm run check:package` validates the actual archive and writes the sibling
`.zip.sha256` checksum. It requires an existing build/ZIP; `check:release`
builds them first. CI performs these checks and stores both files as the
`scratchpad-extension` artifact. To verify the checksum:

```sh
(cd build && sha256sum -c scratchpad@exclude-barrier.github.io.shell-extension.zip.sha256)
```

Do not rebuild after testing and then upload different bytes. Keep the tested
ZIP and its checksum together.

## 2. Independent static review

With [uv](https://docs.astral.sh/uv/) available, run the pinned checker:

```sh
uvx --python 3.12 --with 'tree-sitter<0.26' shexli==0.2.1 --format json \
  "$PWD/build/scratchpad@exclude-barrier.github.io.shell-extension.zip" \
  > build/shexli-report.json
```

shexli 0.2.1 needs `tree-sitter<0.26`. Its ruleset (`2026-04-02`) flags the
declared GNOME 51 entry as `EGO-M-004` (future/implausible Shell version),
even on a GNOME 51 host. This finding remains unresolved by the tool. Inspect
it explicitly against the [current metadata rules](https://gjs.guide/extensions/review-guidelines/review-guidelines.html#metadata-json-must-be-well-formed)
and GNOME's actual release schedule when uploading. Do not suppress all
metadata errors or remove valid compatibility merely to make an old checker
green. Any additional findings must be investigated. A checker result is not
an EGO review or runtime test.

## 3. Native checks and remaining manual EGO acceptance

Install the **exact ZIP** into a test user's GNOME session, not just the
source build. Do not run installation from CI or a headless build host:

```sh
gnome-extensions install --force build/scratchpad@exclude-barrier.github.io.shell-extension.zip
# Log out and back in before enabling/testing.
gnome-extensions enable scratchpad@exclude-barrier.github.io
gnome-extensions prefs scratchpad@exclude-barrier.github.io
```

Record distribution, GNOME version, Wayland/X11, monitor layout/scaling,
terminal, tested commit and archive SHA-256. Run the [README manual tests](README.md#manual-test)
and complete these additional release checks:

Completed by the native headless suite (not physical/manual acceptance):

- [x] Clean ZIP installation and file replacement over 1.3.0 load in a fresh Shell.
- [x] Preferences open; switch/spin bindings, quoted/invalid/empty commands,
  shortcut recording, Escape cancellation and Backspace disabling work.
- [x] Ghostty launch/adoption and duplicate suppression; terminal-disabled empty overlay.
- [x] Real `unlock-dialog` mode removes/restores shortcuts, hides/parks the
  overlay and retains membership without reopening on return to user mode.
- [x] A newly mapped terminal-class window stays parked through lock-mode exit.
- [x] Disable during animation restores windows and clears owned resources;
  re-enable works. Real Gio wait cancellation and stale callback isolation work.
- [x] Non-terminal window membership, cross-monitor dimming, and restoration
  of above/sticky, maximized and fullscreen window states.

Remaining manual checks before EGO acceptance:

- [ ] Physical shortcuts and clicks; authenticated lock/unlock while open,
  hidden, animating and starting a terminal. Repeat lock/unlock several times.
- [ ] Every preference/default on all declared GNOME versions; another configured
  terminal, missing executables, user-created dialogs and existing custom shortcuts.
- [ ] Test workspace switching, focus loss, transient dialogs and overview.
- [ ] Physical multi-monitor dragging, mixed scaling and monitor hotplug.
- [ ] Visual blur/animation quality, rapid physical toggles, and a normal-session
  Shell journal without extension errors.

Compatibility evidence for this candidate:

| GNOME | Available evidence | Required before claiming runtime validation |
|---|---|---|
| 46–50 | Compatibility helpers and earlier API/source inspection | Real-session acceptance tests, including preferences |
| 51 | Type check and 13 native headless scenarios on clean/upgrade ZIP installs | Physical-input, authentication and normal-session manual checks |

GNOME 51 runtime results are candidate-specific; GNOME 46–50 remain API-only
claims, as explicitly stated in README and release notes. Before EGO submission,
test the declared versions or narrow `shell-version` to the versions you can
substantiate and rebuild/retest. Do not turn an API-only check into an assertion
of tested compatibility.

## 4. Notes for the EGO reviewer

- **Why `unlock-dialog`:** Scratchpad retains in-memory membership of parked,
  minimized windows across screen locks. Disabling on every lock would release
  them and restore their visibility/state. While locked, keybindings are removed,
  the overlay hides and late terminal windows are parked. `disable()` contains
  the required explanation and still cleans up fully whenever Shell calls it.
- **Lifecycle:** signals, pending window watches, idle sources, launch timeout,
  cancellable terminal wait, animation transitions, dimmer actors and keybindings
  are cleaned up on disable.
  Window state is restored; the user's applications are intentionally left running.
- **Subprocess:** only the locally configured terminal argument list is launched
  with `Gio.Subprocess`, in response to opening an empty scratchpad. There is no
  implicit shell, privilege escalation or bundled executable.
- **Process separation:** `prefs.js` imports GTK/libadwaita, not Shell UI. The
  Shell entry point imports no GTK/GDK/libadwaita modules.
- **Privacy/license:** no clipboard access, networking or telemetry in extension
  code. GPL-2.0-or-later; license and SPDX comments are included.

## 5. GitHub publication and subsequent EGO submission

1. Complete automated/native tests, investigate checker findings and document
   all remaining limitations. Update the [changelog](CHANGELOG.md) with the date.
2. Submit a PR, pass `build` and CodeQL, and merge. Build and run clean/upgrade
   native tests on the intended release commit from a clean checkout.
3. Create the new tag/release from that commit. The following is a manual
   publication command, **not** part of the build:

   ```sh
   gh release create v1.3.1 \
     build/scratchpad@exclude-barrier.github.io.shell-extension.zip \
     build/scratchpad@exclude-barrier.github.io.shell-extension.zip.sha256 \
     --target "$(git rev-parse HEAD)" --title 'Scratchpad 1.3.1' \
     --notes 'See CHANGELOG.md for changes, installation notes and compatibility limits.'
   ```

4. For EGO, additionally resolve the remaining manual acceptance gates and
   GNOME-version compatibility evidence above. Then sign in to
   [extensions.gnome.org](https://extensions.gnome.org/) and use
   [Upload Extension](https://extensions.gnome.org/upload/). For an existing
   listing, use its new-version upload flow. Submit the same tested ZIP;
   source-code archives and checksum files are not extension uploads.
5. Supply a representative screenshot captured in a real session (no private
   data), check name/description/project URL, and provide the reviewer notes
   above. No screenshot or EGO listing ID is fabricated by this repository.
6. Respond to review feedback. Add an EGO install link to README only after the
   listing exists; verify installation/update from the approved listing.

For later releases, update `version-name`, `package.json` and the lockfile
(`npm install --package-lock-only`), then repeat the entire process. If a
submission needs correction, use a new package version rather than silently
replacing a published GitHub asset.

References: [review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html),
[extension anatomy](https://gjs.guide/extensions/overview/anatomy.html),
[session modes](https://gjs.guide/extensions/topics/session-modes.html).
