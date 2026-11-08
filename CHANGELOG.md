# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). extensions.gnome.org assigns its
own numeric version to each upload.

## [Unreleased]

## [1.3.2] — 2026-11-08

### Changed

- Default shortcuts are now `Super+S` (show or hide the overlay) and
  `Ctrl+Super+S` (add or release the focused window), replacing `Super+Q`
  and `Super+Shift+Q`. Shortcuts you set yourself are kept.
- `install.sh` reports when GNOME's quick settings still use `Super+S`.
  The README explains how to free the key.
- Restructured README, CONTRIBUTING, RELEASE and SECURITY.

## [1.3.1] — 2026-11-08

### Fixed

- Remove the shortcuts while the session is locked and restore them on unlock.
  Hide the overlay on lock and keep scratchpad membership.
- Do not open the overlay when a terminal finishes starting while locked;
  park its window instead.
- Cancel the terminal-process wait on launch, timeout or disable without
  killing the terminal.
- Update dimming at once when a window on another monitor joins the open
  overlay.
- Detach blur effects and stop dimmer transitions during cleanup and monitor
  changes.

### Added

- Package validation: explicit file allowlist, version consistency checks and
  a SHA-256 checksum. CI keeps the ZIP and checksum as artifacts.
- Six package regression tests and a headless GNOME 51 test suite with 13
  scenarios.
- ShellCheck in CI.
- Security policy, contribution guide and release checklist.

## [1.3.0] — 2026-11-08

### Added

- Preferences window for shortcuts, behaviour, terminal, dimming, blur and
  tiling.

### Fixed

- Put new background windows below the dimmer immediately, without a flash.
- Redraw blur when background content changes, avoiding dark marks.

## [1.2.1] — 2026-11-08

### Fixed

- Avoid APIs removed in GNOME 49 and leave the compiled schema out of the
  release ZIP, as required by extensions.gnome.org.

## [1.2.0] — 2026-11-08

### Added

- Hide the overlay when a window outside the scratchpad gets focus; dialogs of
  scratchpad windows do not count. New setting `hide-on-focus-loss`.

## [1.1.0] — 2026-11-08

### Added

- Dim every monitor that shows a scratchpad window.

### Fixed

- Keep membership when dragging windows between monitors.

## [1.0.1] — 2026-11-08

### Fixed

- Dark trails when moving a window over the blurred background.

## [1.0.0] — 2026-11-08

First release: animated overlay, terminal launch, configurable shortcuts,
optional tiling and restoration of window state on release.

[Unreleased]: https://github.com/exclude-barrier/scratchpad/compare/v1.3.2...HEAD
[1.3.2]: https://github.com/exclude-barrier/scratchpad/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/exclude-barrier/scratchpad/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/exclude-barrier/scratchpad/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/exclude-barrier/scratchpad/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/exclude-barrier/scratchpad/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/exclude-barrier/scratchpad/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/exclude-barrier/scratchpad/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/exclude-barrier/scratchpad/releases/tag/v1.0.0
