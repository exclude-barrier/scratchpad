#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-or-later
"""Test the packed extension in a disposable, private headless GNOME session."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

REPO = Path(__file__).resolve().parent.parent
UUID = 'scratchpad@exclude-barrier.github.io'
DRIVER = 'scratchpad-release-tests@local'


def stop(process):
    if process is None or process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dbus-daemon', default=shutil.which('dbus-daemon'))
    parser.add_argument('--timeout', type=int, default=120)
    parser.add_argument('--archive', type=Path)
    parser.add_argument('--upgrade-from', type=Path)
    parser.add_argument('--output', type=Path, default=REPO / 'build' / 'session-test')
    args = parser.parse_args()
    if not args.dbus_daemon:
        parser.error('dbus-daemon is required; pass --dbus-daemon /path/to/dbus-daemon')
    archive = args.archive.resolve() if args.archive else REPO / 'build' / f'{UUID}.shell-extension.zip'
    if not archive.is_file():
        parser.error('Run npm run pack first')
    # Keep evidence outside the disposable HOME, and retain it on failures too.
    results = args.output.resolve()
    results.mkdir(parents=True, exist_ok=True)
    report = results / 'report.json'
    report.unlink(missing_ok=True)
    shell = bus = None
    with tempfile.TemporaryDirectory(prefix='scratchpad-session-', dir='/tmp/opencode'
                                     if Path('/tmp/opencode').is_dir() else None) as tmp:
        root = Path(tmp)
        env = os.environ.copy()
        for key in ('HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME',
                    'XDG_STATE_HOME', 'XDG_RUNTIME_DIR'):
            folder = root / key.lower()
            folder.mkdir(mode=0o700)
            env[key] = str(folder)
        for key in ('DISPLAY', 'WAYLAND_DISPLAY', 'SESSION_MANAGER', 'XDG_SESSION_ID'):
            env.pop(key, None)
        env.update(GSETTINGS_BACKEND='keyfile', LIBGL_ALWAYS_SOFTWARE='1',
                   NO_AT_BRIDGE='1', GTK_A11Y='none', SCRATCHPAD_TEST_REPORT=str(report),
                   SCRATCHPAD_TEST_INSTALL_MODE='upgrade' if args.upgrade_from else 'clean',
                   SCRATCHPAD_TEST_COMMIT=subprocess.check_output(
                       ['git', 'rev-parse', 'HEAD'], cwd=REPO, text=True).strip(),
                   SCRATCHPAD_TEST_DIRTY=str(bool(subprocess.check_output(
                       ['git', 'status', '--porcelain'], cwd=REPO, text=True))).lower(),
                   SCRATCHPAD_TEST_REPO=str(REPO),
                   SCRATCHPAD_TEST_SHA256=hashlib.sha256(archive.read_bytes()).hexdigest())
        typelib = '/usr/lib/gnome-shell/girepository-1.0'
        if Path(typelib).is_dir():
            env['GI_TYPELIB_PATH'] = typelib + ':' + env.get('GI_TYPELIB_PATH', '')
        config = root / 'bus.conf'
        # No service activation: the private bus must not start desktop services.
        config.write_text(f'<busconfig><type>session</type><listen>unix:path={root}/bus</listen>'
                          '<policy context="default"><allow send_destination="*"/>'
                          '<allow receive_sender="*"/><allow own="*"/></policy></busconfig>')
        try:
            with (results / 'bus.log').open('w') as buslog:
                bus = subprocess.Popen([args.dbus_daemon, '--nofork', '--print-address=1',
                                        f'--config-file={config}'], env=env,
                                       stdout=subprocess.PIPE, stderr=buslog, text=True)
                env['DBUS_SESSION_BUS_ADDRESS'] = bus.stdout.readline().strip()
                if not env['DBUS_SESSION_BUS_ADDRESS']:
                    raise RuntimeError('Private D-Bus failed to start')
                # Keep logind/GDM/UPower requests off the real system bus too.
                env['DBUS_SYSTEM_BUS_ADDRESS'] = env['DBUS_SESSION_BUS_ADDRESS']
                if args.upgrade_from:
                    subprocess.run(['gnome-extensions', 'install', '--force',
                                    str(args.upgrade_from.resolve())], env=env, check=True)
                subprocess.run(['gnome-extensions', 'install', '--force', str(archive)],
                               env=env, check=True)
                driver = Path(env['XDG_DATA_HOME']) / 'gnome-shell' / 'extensions' / DRIVER
                shutil.copytree(REPO / 'test' / 'session', driver)
                subprocess.run(['gsettings', 'set', 'org.gnome.shell', 'enabled-extensions',
                                str([UUID, DRIVER])], env=env, check=True)
                subprocess.run(['gsettings', 'set', 'org.gnome.shell', 'start-in-overview',
                                'false'], env=env, check=True)
                with (results / 'shell.log').open('w') as log:
                    shell = subprocess.Popen(['gnome-shell', '--headless', '--no-x11',
                                              '--virtual-monitor=1280x720',
                                              '--virtual-monitor=1024x768',
                                              '--wayland-display=scratchpad-test'],
                                             env=env, stdout=log, stderr=subprocess.STDOUT)
                    deadline = time.monotonic() + args.timeout
                    while shell.poll() is None and not report.is_file():
                        if time.monotonic() >= deadline:
                            raise TimeoutError('GNOME session test timed out')
                        time.sleep(0.1)
                    # Let the driver's async stack unwind before normal SIGTERM
                    # shutdown, rather than tearing down Shell inside a test callback.
                    if report.is_file() and shell.poll() is None:
                        try:
                            shell.wait(timeout=1)
                        except subprocess.TimeoutExpired:
                            stop(shell)
                if not report.is_file():
                    raise RuntimeError(f'No test report; inspect {results / "shell.log"}')
                evidence = json.loads(report.read_text())
                evidence['shell_exit_code'] = shell.returncode
                shell_log = (results / 'shell.log').read_text()
                evidence['native_teardown_assertions'] = "shell_global_get: assertion" in shell_log
                report.write_text(json.dumps(evidence, indent=2) + '\n')
                print(json.dumps(evidence, indent=2))
                if evidence.get('status') != 'passed' or shell.returncode != 0:
                    raise RuntimeError(f'Session tests failed; inspect {results}')
        finally:
            stop(shell)
            stop(bus)


if __name__ == '__main__':
    main()
