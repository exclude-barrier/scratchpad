# Security policy

## Supported versions

Only the [latest release](https://github.com/exclude-barrier/scratchpad/releases/latest)
gets security fixes.

## Reporting a vulnerability

Do not open a public issue. Report privately through
[GitHub's private vulnerability reporting](https://github.com/exclude-barrier/scratchpad/security/advisories/new)
(Security tab, "Report a vulnerability").

Include:

- Extension version and installation source
- GNOME Shell version, distribution, Wayland/X11
- Steps to reproduce, expected and actual impact
- A minimal proof of concept, if possible

Remove tokens, private window titles and terminal output from logs and
screenshots.

The maintainer aims to acknowledge reports within seven days; this is not
guaranteed. Fix timing depends on severity. Please agree on disclosure before
publishing details.

## Scope

The extension runs inside GNOME Shell with your user's rights. In scope:

- Running commands other than the configured `terminal-command`
- Exposing windows or input across the lock screen
- Callbacks or UI that stay active after disable
- Leaking sensitive data

Shortcut conflicts, geometry and animation bugs without security impact go to
[public issues](https://github.com/exclude-barrier/scratchpad/issues).

## Security model

- **Not a privacy tool.** Hidden windows are minimized. They can still appear
  in the overview, dock, window switcher and screen captures. Dimming and blur
  are no access control.
- **`terminal-command` is trusted configuration.** It is started with
  `Gio.Subprocess`, without a shell. If you configure `sh -c`, that shell has
  its usual power. Do not paste commands from untrusted sources.
- **The terminal class is a matching hint, not authentication.** Another local
  application with the same WM class can be adopted into the scratchpad.
- **Lock screen.** The extension stays enabled in `unlock-dialog` to keep
  window membership. It removes its shortcuts and hides the overlay while
  locked. GNOME Shell owns the lock-screen boundary.
- **No network, telemetry or clipboard access.** Settings live in GSettings;
  membership is held in memory only. The configured terminal may do its own
  networking and logging.
- **Disable** releases windows and removes all UI, signals, sources and
  shortcuts. It does not close your applications.

## Build and release

Builds use the committed npm lockfile (`npm ci`). Node.js dependencies are
build-time only and are not shipped. The release ZIP contains seven files
from an explicit allowlist, checked by `npm run check:release`. The published
SHA-256 checksum detects corrupted downloads; it comes from the same place as
the ZIP and does not prove who published it.
