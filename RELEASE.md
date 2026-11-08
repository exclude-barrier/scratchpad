# Release process

Checklist for maintainers. GitHub releases and the extensions.gnome.org (EGO)
listing are separate: a GitHub release does not mean EGO approval.

Test results for each release are in its
[GitHub release notes](https://github.com/exclude-barrier/scratchpad/releases).

## 1. Prepare the version

1. Set the new version in `package.json` and in `version-name` in
   `extension/<uuid>/metadata.json`, then run `npm install --package-lock-only`.
2. Move the `Unreleased` entries in [CHANGELOG.md](CHANGELOG.md) under the new
   version with today's date.
3. Open a pull request, wait for `build` and CodeQL, and squash-merge.

Keep the UUID `scratchpad@exclude-barrier.github.io`. Do not add a numeric
`version` to `metadata.json`; EGO assigns its own. Never reuse or overwrite a
published tag or asset: fix mistakes with a new version.

## 2. Build and test the merged commit

From a clean checkout of `main`, with Node.js 24:

```sh
npm ci
npm audit --audit-level=high
npm run check:release
npm run test:session
npm run test:session -- --upgrade-from /path/to/previous.shell-extension.zip \
  --output build/session-upgrade-test
```

`check:release` validates that the ZIP contains exactly these seven files:

```text
LICENSE
compat.js
extension.js
geometry.js
metadata.json
prefs.js
schemas/org.gnome.shell.extensions.scratchpad.gschema.xml
```

The compiled schema is left out on purpose; GNOME compiles it on install.
Upload exactly the ZIP you tested. Do not rebuild in between.

## 3. Static review

```sh
uvx --python 3.12 --with 'tree-sitter<0.26' shexli==0.2.1 --format json \
  "$PWD/build/scratchpad@exclude-barrier.github.io.shell-extension.zip" \
  > build/shexli-report.json
```

Known finding: shexli 0.2.1 (ruleset `2026-04-02`) reports `EGO-M-004` for the
GNOME 51 entry in `shell-version`, because its version list predates GNOME 51.
Check it against the [metadata rules](https://gjs.guide/extensions/review-guidelines/review-guidelines.html#metadata-json-must-be-well-formed);
do not drop a supported version to silence the checker. Investigate every
other finding.

## 4. Manual test

Install the tested ZIP in a real session, log out and in, then enable it:

```sh
gnome-extensions install --force build/scratchpad@exclude-barrier.github.io.shell-extension.zip
gnome-extensions enable scratchpad@exclude-barrier.github.io
```

Note the distribution, GNOME version, session type, monitors and terminal.

1. `LANG=C gnome-extensions info scratchpad@exclude-barrier.github.io` shows `State: ACTIVE`.
2. `Super+S`: the terminal slides up, the rest of the screen is dark and blurred.
3. `Super+S`: the overlay slides away, the dimming goes.
4. Focus another window, `Ctrl+Super+S`: it slides away. `Super+S`: both
   windows are in the overlay, the second at its old position.
5. Move or resize a window in the overlay, `Super+S` twice: position stays.
6. Overlay open, switch workspace: the overlay hides.
7. Overlay open, click a window outside it: the overlay hides.
8. Overlay open, run `sleep 2 && gnome-text-editor &` in the scratchpad
   terminal: the new window does not flash above the dimming.
9. Overlay open, window focused, `Ctrl+Super+S`: the window is normal again.
10. Window in the overlay, lock and unlock: it is still in the scratchpad.
11. Add and release an "Always on Top" window: the setting is back.
12. Two monitors: drag an overlay window to the other monitor and back. It
    stays in the scratchpad, and its monitor is dimmed.
13. Press `Super+S` quickly several times on an empty scratchpad: only one
    terminal starts.
14. `tile-windows true`, add and release a maximized window: it is maximized again.
15. Preferences: change a shortcut and the dimming; both apply at once.
16. `journalctl --user -b | grep -i scratchpad` shows no errors.

Not covered by the native tests and still open before EGO approval:

- [ ] Authenticated lock/unlock while the overlay is open, hidden, animating
      and starting a terminal; repeated several times.
- [ ] GNOME 46–50 sessions, including preferences. Otherwise narrow
      `shell-version` to the tested versions.
- [ ] Another terminal, a missing executable and existing custom shortcuts.
- [ ] Overview, transient dialogs, mixed scaling and monitor hotplug.
- [ ] Visual quality of blur and animation.

## 5. Publish on GitHub

Tag the tested commit and attach the ZIP, checksum, session reports,
shexli report and screenshot:

```sh
V=1.x.y
cp build/session-test/report.json build/session-clean.json
cp build/session-upgrade-test/report.json build/session-upgrade.json
cp build/session-test/screenshot.png build/screenshot.png
gh release create "v$V" \
  build/scratchpad@exclude-barrier.github.io.shell-extension.zip \
  build/scratchpad@exclude-barrier.github.io.shell-extension.zip.sha256 \
  build/session-clean.json build/session-upgrade.json \
  build/shexli-report.json build/screenshot.png \
  --target "$(git rev-parse HEAD)" --title "Scratchpad $V" --notes-file notes.md
```

The release notes list the changes and the test results.

## 6. Submit to extensions.gnome.org

1. Finish the open checks from step 4.
2. Sign in and open [Upload Extension](https://extensions.gnome.org/upload/).
3. Select the tested `scratchpad@exclude-barrier.github.io.shell-extension.zip`.
   Not GitHub's source archive, not the checksum file.
4. Read the license and maintainership declarations; agree only if you accept
   them. Upload.
5. Add a screenshot from a real session without private data, check name,
   description and project URL, and paste the reviewer notes below.
6. Answer review feedback. The result arrives by email. Add the EGO link to
   the README once the listing exists.

The upload page may show `No such native application org.gnome.chrome_gnome_shell`.
That concerns the browser connector for managing installed extensions. It does
not block the ZIP upload.

### Notes for the reviewer

- **`unlock-dialog` session mode:** Scratchpad keeps in-memory membership of
  parked, minimized windows across screen locks. Disabling on every lock would
  release them. While locked, keybindings are removed, the overlay hides and
  late terminal windows are parked. `disable()` still cleans up fully.
- **Cleanup:** signals, window watches, idle sources, the launch timeout, the
  cancellable terminal wait, transitions, dimmer actors and keybindings are
  removed on disable. Window state is restored; applications keep running.
- **Subprocess:** only the configured terminal argument list is started with
  `Gio.Subprocess`, when the user opens an empty scratchpad. No shell, no
  privilege escalation, no bundled binaries.
- **Process separation:** `prefs.js` imports GTK/libadwaita only; the Shell
  entry point imports no GTK, GDK or libadwaita.
- **Privacy:** no clipboard access, network requests or telemetry.
  GPL-2.0-or-later.

References: [review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html),
[extension anatomy](https://gjs.guide/extensions/overview/anatomy.html),
[session modes](https://gjs.guide/extensions/topics/session-modes.html).
