# Security policy

## Supported versions

Only the latest release gets security fixes.
The GNOME versions declared by that release are listed in `metadata.json`;
declared compatibility does not mean every version has been runtime-tested.

## Reporting a vulnerability

Please do not open a public issue. Report it privately through
[GitHub's private vulnerability reporting](https://github.com/exclude-barrier/scratchpad/security/advisories/new)
(Security tab, "Report a vulnerability").

Include the extension version and installation source, GNOME Shell version,
distribution, Wayland/X11 session type, steps to reproduce, and the expected
and actual impact. Attach a minimal proof of concept if possible. Remove
tokens, private window titles and terminal output from logs and screenshots.

The maintainer aims to acknowledge reports within seven days; this is not a
guaranteed response time. Fix timing and coordinated disclosure depend on
severity and reproducibility. Please agree on disclosure before publishing
details. A GitHub advisory can be published once a fix is available; approval
and update delivery on extensions.gnome.org are separate steps.

## Scope

The extension runs inside GNOME Shell with your user's rights. Relevant are,
for example, ways to make it run commands other than the configured
`terminal-command`, or to expose windows or input across the lock screen.

Also in scope: callbacks or UI left active after disable, unexpected command
execution without the configured user action, and sensitive data disclosure
caused by the extension. Ordinary geometry, animation and shortcut conflicts
belong in [public issues](https://github.com/exclude-barrier/scratchpad/issues)
unless they have a security impact. Never post a suspected vulnerability there.

## Trust boundaries and privacy

- Scratchpad is not a sandbox, window vault or privacy filter. Hidden windows
  are minimized and may still appear in the overview, dock, switcher or screen
  capture. Dimming and blur do not provide access control.
- `terminal-command` is trusted local configuration. The extension launches
  that argument list with `Gio.Subprocess`, without an implicit shell. Explicitly
  configuring a shell such as `sh -c` gives that shell the usual execution power.
  Do not paste commands from untrusted sources into preferences or GSettings.
- The terminal class is a window-matching hint, not authentication. Another
  local application can use the same class and be adopted into the scratchpad.
- The extension stays enabled in `unlock-dialog` to retain window membership.
  It removes its keybindings and hides the overlay while locked. GNOME Shell,
  not Scratchpad, is responsible for the lock-screen security boundary.
- The extension itself makes no network requests, collects no telemetry and
  does not access the clipboard. Settings are stored in GSettings; membership
  is held in memory. A configured terminal or its child programs may perform
  their own networking, logging and storage.
- Disabling releases windows and removes extension UI, signals, sources and
  shortcuts. It does not terminate the user's terminal or other applications.

## Build and release security

Use the committed npm lockfile (`npm ci`). Node.js dependencies are build-time
only and are not shipped in the extension ZIP. `npm run check:release` checks
the archive allowlist, version consistency and build contents, and writes a
SHA-256 checksum. Checksums detect changed bytes; an unsigned checksum from
the same download location does not independently authenticate the publisher.
See [RELEASE.md](RELEASE.md) for review and testing requirements.

The optional `npm run test:session` suite runs in a disposable HOME and private
D-Bus/headless compositor. It must not be confused with a successful physical
lock-screen authentication test: it exercises Shell session-mode transitions,
not PAM, the real greeter or physical input. Test drivers and their subprocess
fixtures are development-only and are excluded from the seven-file release ZIP.
