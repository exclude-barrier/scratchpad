// SPDX-License-Identifier: GPL-2.0-or-later
// Runs ONLY in the private compositor created by scripts/test-session.py.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import System from 'system';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const UUID = 'scratchpad@exclude-barrier.github.io';
const delay = ms => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
    resolve();
    return GLib.SOURCE_REMOVE;
}));
function check(value, message) {
    if (!value)
        throw new Error(message);
}

export default class ReleaseTests extends Extension {
    enable() {
        this._id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
            this._id = 0;
            this.run().then(() => this.finish('passed'), error => this.finish('failed', error));
            return GLib.SOURCE_REMOVE;
        });
        this.results = [];
    }

    disable() {
        if (this._id)
            GLib.source_remove(this._id);
        this._id = 0;
    }

    finish(status, error) {
        const report = {
            status,
            gnome: Config.PACKAGE_VERSION,
            archive_sha256: GLib.getenv('SCRATCHPAD_TEST_SHA256'),
            install_mode: GLib.getenv('SCRATCHPAD_TEST_INSTALL_MODE'),
            source_commit: GLib.getenv('SCRATCHPAD_TEST_COMMIT'),
            source_dirty: GLib.getenv('SCRATCHPAD_TEST_DIRTY') === 'true',
            system_bus_isolated: GLib.getenv('DBUS_SYSTEM_BUS_ADDRESS') === GLib.getenv('DBUS_SESSION_BUS_ADDRESS'),
            monitors: Main.layoutManager.monitors.length,
            tests: this.results,
            error: error ? `${error.message}\n${error.stack}` : null,
            limitations: 'Headless virtual monitors; no physical input, PAM authentication, or visual approval',
        };
        GLib.file_set_contents(GLib.getenv('SCRATCHPAD_TEST_REPORT'), JSON.stringify(report, null, 2));
        System.gc();
    }

    async run() {
        const entry = Main.extensionManager.lookup(UUID);
        check(entry?.stateObj, `Extension did not load: ${entry?.error}`);
        const extension = entry.stateObj;
        check(extension._settings && extension._dimmer, 'enable did not initialize extension');
        check(extension._bindings.length === 2, 'Expected two registered shortcuts');
        this.results.push('ZIP install, schema compilation and enable');

        extension._settings.set_boolean('launch-terminal', false);
        extension._toggle();
        await delay(300);
        check(extension._shown && extension._dimmer.visible, 'Empty overlay failed to show');
        extension._toggle();
        await delay(300);
        check(!extension._shown && !extension._dimmer.visible, 'Empty overlay failed to hide');
        this.results.push('Empty overlay show/hide with blur');

        const prefs = Gio.Subprocess.new(['gjs', '-m',
            `${GLib.getenv('SCRATCHPAD_TEST_REPO')}/test/session/prefs.js`, entry.path],
        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
        const output = await new Promise((resolve, reject) => {
            prefs.communicate_utf8_async(null, null, (_proc, result) => {
                try {
                    resolve(prefs.communicate_utf8_finish(result));
                } catch (error) {
                    reject(error);
                }
            });
        });
        check(prefs.get_successful(), `Preferences test failed: ${output}`);
        this.results.push('GTK/libadwaita preferences, bindings, command validation and shortcut recorder');

        extension._settings.set_strv('terminal-command', [
            'ghostty', '--class=io.github.exclude_barrier.Scratchpad',
            '--gtk-single-instance=false', '-e', 'sleep', '90',
        ]);
        extension._settings.set_boolean('launch-terminal', true);
        extension._toggle();
        extension._toggle();
        for (let i = 0; i < 60 && extension._windows.size === 0; i++)
            await delay(100);
        check(extension._windows.size === 1, 'Ghostty was not adopted exactly once');
        await delay(400);
        const win = [...extension._windows.keys()][0];
        check(extension._shown && !win.minimized && win.is_on_all_workspaces() && win.is_above(),
            'Terminal did not join visible overlay');
        this.results.push('Default Ghostty launch, duplicate suppression and membership');

        const rect = win.get_frame_rect();
        extension._hide();
        await delay(400);
        check(win.minimized && !extension._shown, 'Window did not park');
        extension._show();
        await delay(400);
        const restored = win.get_frame_rect();
        check(!win.minimized && rect.x === restored.x && rect.y === restored.y &&
            rect.width === restored.width && rect.height === restored.height, 'Free geometry changed');
        this.results.push('Animated hide/show preserves free-mode geometry');

        // Save an artifact from this synthetic desktop only, never the user's session.
        const image = Gio.File.new_for_path(`${GLib.path_get_dirname(GLib.getenv('SCRATCHPAD_TEST_REPORT'))}/screenshot.png`);
        const stream = image.replace(null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        try {
            const screenshot = new Shell.Screenshot();
            await new Promise((resolve, reject) => screenshot.screenshot(false, stream, (_object, result) => {
                try {
                    screenshot.screenshot_finish(result);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            }));
        } finally {
            stream.close(null);
        }

        extension._settings.set_boolean('hide-on-focus-loss', false);
        Gio.Subprocess.new(['gjs', '-m',
            `${GLib.getenv('SCRATCHPAD_TEST_REPO')}/test/session/window.js`],
        Gio.SubprocessFlags.NONE);
        let extra;
        for (let i = 0; i < 60 && !extra; i++) {
            await delay(100);
            extra = global.get_window_actors().map(actor => actor.meta_window)
                .find(window => window?.get_wm_class() === 'org.example.ScratchpadTestWindow');
        }
        check(extra, 'Non-terminal test window did not map');
        await delay(600); // Wait for the initial Wayland configure/map to settle.
        extra.move_to_monitor(1);
        await delay(500);
        for (let i = 0; i < 20 && global.display.get_focus_window() !== extra; i++) {
            const focusTime = global.display.get_current_time_roundtrip();
            extra.activate(focusTime);
            extra.focus(focusTime);
            await delay(100);
        }
        check(global.display.get_focus_window() === extra,
            `Could not focus non-terminal test window (focused=${global.display.get_focus_window()?.get_wm_class()}, minimized=${extra.minimized}, overview=${Main.overview.visible}, mode=${Main.sessionMode.currentMode})`);
        check(extra.get_monitor() === 1, 'Non-terminal window did not reach the second monitor');
        check(extension._shown, 'Overlay unexpectedly hidden before adding non-terminal window');
        extension._toggleMembership();
        await delay(400);
        check(extension._windows.has(extra) && extension._panes[1].visible,
            `Adding a window on another monitor did not update dimming (member=${extension._windows.has(extra)}, monitor=${extra.get_monitor()}, shown=${extension._shown}, panes=${extension._panes.map(pane => pane.visible)})`);
        extension._release(extra);
        extra.delete(global.get_current_time());
        await delay(250);
        extension._settings.set_boolean('hide-on-focus-loss', true);
        this.results.push('Add/release a focused non-terminal window on another monitor');

        Main.sessionMode.pushMode('unlock-dialog');
        await delay(400);
        check(extension._bindings.length === 0 && !extension._shown && win.minimized,
            'Lock session did not remove shortcuts and park windows');
        extension._show();
        check(!extension._shown && win.minimized, 'Overlay opened in unlock-dialog');
        Main.sessionMode.popMode('unlock-dialog');
        await delay(300);
        check(extension._bindings.length === 2 && !extension._shown && extension._windows.has(win),
            'Unlock lost bindings or membership, or opened overlay');
        this.results.push('Real Shell unlock-dialog mode removes/restores shortcuts and retains membership');

        // A fresh terminal-class window must be parked if it maps after lock.
        Main.sessionMode.pushMode('unlock-dialog');
        extension._settings.set_string('terminal-class', 'org.example.ScratchpadTestWindow');
        Gio.Subprocess.new(['gjs', '-m',
            `${GLib.getenv('SCRATCHPAD_TEST_REPO')}/test/session/window.js`],
        Gio.SubprocessFlags.NONE);
        let late;
        for (let i = 0; i < 60 && !late; i++) {
            await delay(100);
            late = [...extension._windows.keys()].find(window => window !== win);
        }
        check(late && late.minimized && !extension._shown, 'Late terminal opened while locked');
        Main.sessionMode.popMode('unlock-dialog');
        await delay(300);
        check(!extension._shown && late.minimized, 'Unlock opened late terminal');
        extension._release(late, { restoreVisibility: true });
        late.delete(global.get_current_time());
        extension._settings.set_string('terminal-class', 'io.github.exclude_barrier.Scratchpad');
        await delay(250);
        this.results.push('Late terminal-class window is parked through lock/unlock');

        extension._settings.set_boolean('tile-windows', true);
        extension._show();
        await delay(400);
        check(win.get_frame_rect().width > 0, 'Tiling produced invalid width');
        if (Main.layoutManager.monitors.length > 1) {
            win.move_to_monitor(1);
            await delay(500);
            check(extension._windows.has(win) && win.get_monitor() === 1, 'Monitor move lost member');
            check(extension._panes[1].visible, 'Dimming did not follow monitor');
            // Secondary-monitor windows can be implicitly sticky when only
            // the primary monitor has workspaces. Compare release on primary.
            win.move_to_monitor(Main.layoutManager.primaryIndex);
            await delay(500);
            check(extension._windows.has(win), 'Return to primary lost member');
        }
        this.results.push('Tiling and cross-monitor membership/dimming');

        extension._settings.set_boolean('tile-windows', false);
        extension._release(win);
        check(!extension._windows.has(win) && !win.is_above() && !win.is_on_all_workspaces(),
            'Release did not restore original window state');
        this.results.push('Release restores above/sticky window flags');

        win.move_to_monitor(Main.layoutManager.primaryIndex);
        win.maximize();
        await delay(300);
        extension._adopt(win);
        extension._settings.set_boolean('tile-windows', true);
        extension._show();
        await delay(400);
        check(!win.is_maximized(), 'Tiling did not unmaximize window');
        extension._release(win);
        await delay(300);
        check(win.is_maximized(), 'Release did not restore maximization');
        win.unmaximize();
        win.make_fullscreen();
        await delay(300);
        extension._adopt(win);
        extension._show();
        await delay(400);
        check(!win.is_fullscreen(), 'Tiling did not leave fullscreen');
        extension._release(win);
        await delay(300);
        check(win.is_fullscreen(), 'Release did not restore fullscreen');
        win.unmake_fullscreen();
        await delay(250);
        extension._settings.set_boolean('tile-windows', false);
        this.results.push('Tiling restores maximized and fullscreen states on release');

        extension._adopt(win);
        extension._show();
        extension._hide();
        extension.disable();
        await delay(400);
        check(!win.minimized && !extension._dimmer && !extension._settings &&
            extension._bindings.length === 0 && extension._signals.length === 0 &&
            extension._idleIds.size === 0 && extension._damageIds.size === 0 &&
            extension._pending.size === 0, 'Disable left resources or parked window');
        extension.enable();
        check(extension._settings && extension._bindings.length === 2, 'Re-enable failed');
        this.results.push('Disable during animation restores windows and cleans up; re-enable succeeds');

        extension._settings.set_strv('terminal-command', ['sleep', '2']);
        extension._launchTerminal();
        const first = extension._launchCancellable;
        extension._launchTerminal();
        check(extension._launchCancellable === first, 'Duplicate process launch was not suppressed');
        extension._endTerminalLaunch();
        check(first.is_cancelled(), 'Process wait was not cancelled');
        extension._launchTerminal();
        const second = extension._launchCancellable;
        await delay(150);
        check(!second.is_cancelled() && extension._launchTimeoutId !== 0,
            'Stale completion cancelled newer launch');
        extension.disable();
        await delay(150);
        check(second.is_cancelled() && extension._launchTimeoutId === 0,
            'Disable left process wait or launch timeout');
        this.results.push('Real Gio subprocess cancellation, stale callbacks and duplicate launch suppression');

        win.delete(global.get_current_time());
        await delay(200);
    }
}
