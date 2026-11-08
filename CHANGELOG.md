# Changelog

Version names follow the repository's semantic versions. The independent
numeric submission version on extensions.gnome.org is assigned by that site.

## Unreleased

### Changed

- Default keys are now `Super+S` (show or hide the overlay) and
  `Ctrl+Super+S` (add or release the focused window), previously
  `Super+Q` and `Super+Shift+Q`. Keys you set yourself are kept.
- GNOME binds `Super+S` to quick settings by default; `install.sh` reports
  this, and the README explains how to free the key.

## 1.3.1 — 2026-11-08

### Fixed

- Remove scratchpad keybindings while the session is locked and restore them
  on unlock. Hide the overlay on lock while retaining scratchpad membership.
- Do not open the overlay if a terminal finishes starting while locked;
  park its window instead.
- Cancel the terminal-process wait on launch completion, timeout or disable
  without terminating the terminal, and consume the async result.
- Update dimming immediately when a window on another monitor joins an open
  overlay. A native regression test reproduces the failure without this fix.
- Explicitly detach blur effects and stop dimmer transitions during cleanup
  and monitor-pane replacement.

### Release preparation

- Package only an explicit list of runtime files and the license.
- Validate the upload ZIP, matching package/metadata/lockfile versions and
  generate a SHA-256 checksum. Retain ZIP and checksum as CI artifacts.
- Document security boundaries, contribution checks, review rationale and
  the remaining manual acceptance tests for the GNOME Extensions submission.
- Add six package regression tests and a private headless GNOME 51 suite with
  13 real GJS/Mutter/GTK scenarios, clean/upgrade install reports and screenshot.
- Check shell scripts with ShellCheck in CI.

## 1.3.0 — 2026-11-08

- Add preferences for shortcuts, behaviour, terminal, dimming, blur and tiling.
- Put new background windows below the dimmer immediately, without a flash.
- Redraw blur when background content changes to avoid dark marks.

## 1.2.1 — 2026-11-08

- Prepare the upload for extensions.gnome.org: avoid APIs removed in GNOME 49
  and omit the compiled schema from the release ZIP.

## 1.2.0 — 2026-11-08

- Hide on focus loss to a window outside the scratchpad; ignore scratchpad
  dialogs. Add the `hide-on-focus-loss` setting.

## 1.1.0 — 2026-11-08

- Keep membership when dragging windows between monitors.
- Dim each monitor containing a scratchpad window.

## 1.0.1 — 2026-11-08

- Fix dark trails when moving a window over the blurred background.

## 1.0.0 — 2026-11-08

- First public release: animated overlay, terminal launch, configurable keys,
  optional tiling and restoration of window state on release.

[Published GitHub releases](https://github.com/exclude-barrier/scratchpad/releases)
