// SPDX-License-Identifier: GPL-2.0-or-later
// Scratchpad – a drop-down style scratchpad overlay for GNOME Shell 46-51.
//
// GNOME has no hidden or special workspaces, so the scratchpad is built out
// of windows:
//
//   Super + Q          show/hide the overlay
//   Super + Shift + Q  add the focused window, or release it
//
// Feature                                -> how
//   overlays the current workspace        -> overlay windows are sticky + above
//   windows keep their own size/position  -> default; tile-windows lays them
//                                            out in columns instead
//   dims what is underneath               -> dimmer below the overlay, on every
//                                            monitor with an overlay window
//   blurs what is underneath              -> Shell.BlurEffect on the dimmer
//   hides on workspace switch             -> active-workspace-changed hides it
//   add a window without following it     -> the window slides away and is parked
//   move it out with Super+Shift+1..4     -> leaving "all workspaces" releases it
//   empty scratchpad                      -> starts terminal-command
//
// The extension stays enabled on the lock screen (session-modes in
// metadata.json): GNOME otherwise disables it on every lock, which would
// drop all parked windows out of the scratchpad. disable() therefore only
// runs when the extension is really turned off, and then gives every window
// back its state from before it joined.
//
// Calls whose API differs between GNOME versions go through ./compat.js,
// pure geometry lives in ./geometry.js.

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Compat from './compat.js';
import { overlayRect, tileColumns, validMonitor, type Rect } from './geometry.js';

const SLIDE_IN_MS = 220;
const SLIDE_OUT_MS = 180;
const DIM_FADE_MS = 180;
const BLUR_RADIUS = 30;
// How long a started terminal may take to map its window before Super+Q may
// start another one.
const TERMINAL_LAUNCH_TIMEOUT_S = 10;

type Binding = [name: string, handler: () => void];

// State of a window before it joined the scratchpad, restored on release.
interface Member {
    ids: number[];
    wasAbove: boolean;
    wasSticky: boolean;
    // Set when tiling took these away; release gives them back.
    restoreMaximized: boolean;
    restoreFullscreen: boolean;
    // Last known monitor, to tell a monitor move from a workspace move.
    monitor: number;
}

interface ReleaseOptions {
    // Extension is turned off: also bring back windows parked minimized.
    restoreVisibility?: boolean;
    // Window already left "all workspaces" (moved to a workspace): keep it so.
    leftAllWorkspaces?: boolean;
}

interface SlideParams {
    translation_y: number;
    duration: number;
    mode: Clutter.AnimationMode;
    onComplete?: () => void;
}

// gnome-shell's ease() finds the running transition by the property key with
// '_' turned into '-' (js/ui/environment.js _easeActor, 46 and 51). The types
// only accept camelCase, but 'translationY' matches no transition, and then
// onComplete fires at once. So the key stays snake_case and the type is cast.
function easeTranslation(actor: Clutter.Actor, params: SlideParams): void {
    (actor as unknown as { ease(params: object): void }).ease(params);
}

function windowActor(win: Meta.Window): Meta.WindowActor | null {
    return win.get_compositor_private() as Meta.WindowActor | null;
}

export default class ScratchpadExtension extends Extension {
    private _settings: Gio.Settings | null = null;
    private _windows = new Map<Meta.Window, Member>();
    private _pending = new Map<Meta.Window, number[]>(); // created, not yet shown
    private _expected = new Set<Meta.Window>(); // windows we (un)minimize ourselves
    private _placed = new Set<Meta.Window>(); // windows that have their own geometry
    private _shown = false;
    private _monitor = 0;
    // Full-stage container, not reactive; holds one dim pane per monitor.
    private _dimmer: St.Widget | null = null;
    private _panes: St.Widget[] = [];
    private _idleIds = new Set<number>();
    private _bindings: Binding[] = [];
    private _signals: [GObjectLike, number][] = [];
    private _launchTimeoutId = 0;
    // Bumped per launch, so callbacks of an older terminal cannot end the
    // lock of a newer one.
    private _launchGeneration = 0;

    // Non-null accessors for state that only exists while enabled.
    private get settings(): Gio.Settings {
        if (!this._settings)
            throw new Error('scratchpad: used while disabled');
        return this._settings;
    }

    private get dimmer(): St.Widget {
        if (!this._dimmer)
            throw new Error('scratchpad: used while disabled');
        return this._dimmer;
    }

    enable(): void {
        this._settings = this.getSettings();
        this._windows = new Map();
        this._pending = new Map();
        this._expected = new Set();
        this._placed = new Set();
        this._shown = false;
        this._monitor = global.display.get_current_monitor();

        this._dimmer = new St.Widget({ visible: false, opacity: 0 });
        global.window_group.add_child(this._dimmer);
        this._createPanes();

        // NORMAL | OVERVIEW only: the keys do nothing on the lock screen.
        this._bindings = [
            ['toggle-scratchpad', () => this._toggle()],
            ['move-to-scratchpad', () => this._toggleMembership()],
        ];
        for (const [name, handler] of this._bindings) {
            const action = Main.wm.addKeybinding(
                name,
                this.settings,
                Meta.KeyBindingFlags.NONE,
                Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
                handler
            );
            if (action === Meta.KeyBindingAction.NONE)
                console.warn(`scratchpad: keybinding ${name} could not be grabbed`);
        }

        this._connect(global.display, global.display.connect('window-created',
            (_d: Meta.Display, win: Meta.Window) => this._watchNewWindow(win)));
        this._connect(global.display, global.display.connect('restacked',
            () => this._syncDimmerStack()));
        this._connect(global.display, global.display.connect('window-entered-monitor',
            (_d: Meta.Display, index: number, win: Meta.Window) => this._onEnteredMonitor(win, index)));
        this._connect(global.workspace_manager, global.workspace_manager.connect(
            'active-workspace-changed', () => {
                if (this._shown && this.settings.get_boolean('hide-on-workspace-switch'))
                    this._hide();
            }));
        // LayoutManager declares 'monitors-changed' in $signals but does not
        // override connect(), so its typed overloads only know GObject's
        // signals. Hence the cast.
        const layout = Main.layoutManager as unknown as SignalSource;
        this._connect(layout, layout.connect('monitors-changed', () => this._onMonitorsChanged()));
        this._connect(this.settings, this.settings.connect('changed', () => {
            this._updateDimmerStyle();
            if (this._shown && this._tiling())
                this._layout(false);
        }));

        // Pick up a terminal that survived an extension reload.
        for (const actor of global.get_window_actors()) {
            const win = actor.meta_window;
            if (win && this._isTerminal(win))
                this._adopt(win);
        }
        if (this._visibleWindows().length > 0)
            this._show();
    }

    disable(): void {
        for (const [name] of this._bindings)
            Main.wm.removeKeybinding(name);
        this._bindings = [];

        for (const [obj, id] of this._signals)
            obj.disconnect(id);
        this._signals = [];
        for (const [win, ids] of this._pending)
            ids.forEach(id => win.disconnect(id));
        this._pending.clear();
        this._endTerminalLaunch();
        this._idleIds.forEach(id => GLib.source_remove(id));
        this._idleIds.clear();

        for (const win of [...this._windows.keys()])
            this._release(win, { restoreVisibility: true });
        this._windows.clear();
        this._expected.clear();
        this._placed.clear();
        this._shown = false;

        this._dimmer?.destroy();
        this._dimmer = null;
        this._panes = [];
        this._settings = null;
    }

    private _connect(obj: GObjectLike, id: number): void {
        this._signals.push([obj, id]);
    }

    // ---- new windows ------------------------------------------------------

    // A new window only has its final app id once it is shown. Windows that
    // vanish before that must not stay in _pending.
    private _watchNewWindow(win: Meta.Window): void {
        const done = () => {
            this._pending.get(win)?.forEach(id => win.disconnect(id));
            this._pending.delete(win);
        };
        const ids = [
            win.connect('shown', () => {
                done();
                if (this._isTerminal(win)) {
                    this._endTerminalLaunch();
                    this._adopt(win);
                    this._show();
                }
            }),
            win.connect('unmanaged', done),
        ];
        this._pending.set(win, ids);
    }

    // ---- membership -------------------------------------------------------

    private _isTerminal(win: Meta.Window | null): boolean {
        const cls = this.settings.get_string('terminal-class');
        return cls !== '' && win?.get_wm_class() === cls;
    }

    private _tiling(): boolean {
        return this.settings.get_boolean('tile-windows');
    }

    private _visibleWindows(): Meta.Window[] {
        return [...this._windows.keys()].filter(w => !w.minimized);
    }

    private _adopt(win: Meta.Window): void {
        if (this._windows.has(win))
            return;
        const member: Member = {
            ids: [],
            wasAbove: win.is_above(),
            wasSticky: win.is_on_all_workspaces(),
            restoreMaximized: false,
            restoreFullscreen: false,
            monitor: win.get_monitor(),
        };
        member.ids = [
            win.connect('unmanaged', () => this._forget(win)),
            // Moving the window to a workspace (Super+Shift+1..4, window menu)
            // takes it off "all workspaces": it leaves the scratchpad.
            //
            // With workspaces-only-on-primary, mutter does the same when the
            // user drags a window onto the primary monitor
            // (meta_window_update_monitor). Then get_monitor() is already the
            // new monitor, member.monitor is still the old one
            // (window-entered-monitor comes later), and the window stays.
            win.connect('notify::on-all-workspaces', () => {
                if (win.is_on_all_workspaces())
                    return;
                if (win.get_monitor() !== member.monitor)
                    this._restick(win);
                else
                    this._release(win, { leftAllWorkspaces: true });
            }),
            win.connect('notify::minimized', () => this._onMinimizedChanged(win)),
            win.connect('position-changed', () => this._redrawBlur()),
            win.connect('size-changed', () => this._redrawBlur()),
        ];
        this._windows.set(win, member);
        // Every window keeps the position and size you give it, including
        // the fresh terminal. Only tiling mode moves windows.
        this._placed.add(win);
        win.stick();
        win.make_above();
    }

    // Stick again after mutter's own workspace change has finished; sticking
    // inside its notify would cut that change short.
    private _restick(win: Meta.Window): void {
        const id = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._idleIds.delete(id);
            if (this._windows.has(win) && !win.is_on_all_workspaces())
                win.stick();
            return GLib.SOURCE_REMOVE;
        });
        this._idleIds.add(id);
    }

    private _onEnteredMonitor(win: Meta.Window, index: number): void {
        const member = this._windows.get(win);
        if (!member)
            return;
        member.monitor = index;
        if (this._shown)
            this._syncPanes();
    }

    private _forget(win: Meta.Window): void {
        const member = this._windows.get(win);
        if (!member)
            return;
        member.ids.forEach(id => win.disconnect(id));
        this._windows.delete(win);
        this._expected.delete(win);
        this._placed.delete(win);
        this._afterMembershipChange();
    }

    private _release(win: Meta.Window, opts: ReleaseOptions = {}): void {
        const member = this._windows.get(win);
        if (!member)
            return;
        member.ids.forEach(id => win.disconnect(id));
        this._windows.delete(win);
        this._expected.delete(win);
        this._placed.delete(win);

        const actor = windowActor(win);
        if (actor) {
            actor.remove_all_transitions();
            actor.translation_y = 0;
        }
        // Give back what the window had before it joined.
        if (!member.wasAbove && win.is_above())
            win.unmake_above();
        if (!member.wasSticky && !opts.leftAllWorkspaces && win.is_on_all_workspaces())
            win.unstick();
        if (opts.restoreVisibility && win.minimized)
            win.unminimize();
        if (member.restoreMaximized && !Compat.isMaximized(win))
            Compat.maximize(win);
        if (member.restoreFullscreen && !win.is_fullscreen())
            win.make_fullscreen();
        this._afterMembershipChange();
    }

    private _afterMembershipChange(): void {
        if (!this._shown || !this._settings)
            return;
        if (this._visibleWindows().length === 0) {
            this._setShown(false);
        } else {
            this._layout(false);
            this._syncPanes();
        }
    }

    // Reacts to minimize/unminimize the user did (dock, Alt+Tab, title bar).
    private _onMinimizedChanged(win: Meta.Window): void {
        if (this._expected.delete(win))
            return;
        if (win.minimized) {
            if (this._shown && this._visibleWindows().length === 0)
                this._setShown(false);
            else if (this._shown)
                this._layout(false);
        } else if (!this._shown) {
            this._show();
        } else {
            this._layout(false);
        }
        if (this._shown)
            this._syncPanes();
    }

    private _minimize(win: Meta.Window): void {
        if (win.minimized)
            return;
        const actor = windowActor(win);
        if (actor)
            Main.wm.skipNextEffect(actor);
        this._expected.add(win);
        win.minimize();
    }

    private _unminimize(win: Meta.Window): void {
        if (!win.minimized)
            return;
        const actor = windowActor(win);
        if (actor)
            Main.wm.skipNextEffect(actor);
        this._expected.add(win);
        win.unminimize();
    }

    // ---- geometry ---------------------------------------------------------

    private _monitorIndex(index: number): number {
        return validMonitor(index, Main.layoutManager.monitors.length,
            global.display.get_current_monitor());
    }

    private _monitorRect(index: number): Rect {
        return Main.layoutManager.monitors[this._monitorIndex(index)];
    }

    private _overlayRect(): Rect {
        const area = Main.layoutManager.getWorkAreaForMonitor(this._monitorIndex(this._monitor));
        return overlayRect(area, {
            gapOuter: this.settings.get_int('gap-outer'),
            widthPercent: this.settings.get_int('width-percent'),
            heightPercent: this.settings.get_int('height-percent'),
        });
    }

    // Distance that moves a window fully below the edge of its monitor.
    private _slideDistance(win: Meta.Window): number {
        const mon = this._monitorRect(win.get_monitor());
        return Math.max(0, mon.y + mon.height - win.get_frame_rect().y);
    }

    // Free mode (default): windows are never moved or resized. Tiling mode:
    // the visible windows are laid out side by side in the overlay
    // rectangle.
    private _layout(animate: boolean): void {
        this._monitor = this._monitorIndex(this._monitor);
        const rect = this._overlayRect();
        const wins = this._visibleWindows();
        const tiling = this._tiling();
        const columns = tileColumns(rect, wins.length, this.settings.get_int('gap-inner'));
        const mon = this._monitorRect(this._monitor);
        wins.forEach((win, i) => {
            // move_resize_frame is async, so a window placed now slides from
            // the overlay rectangle, not from its old frame.
            const place = tiling || !this._placed.has(win);
            if (place) {
                const member = this._windows.get(win);
                if (win.is_fullscreen()) {
                    if (member)
                        member.restoreFullscreen = true;
                    win.unmake_fullscreen();
                }
                if (Compat.isMaximized(win)) {
                    if (member)
                        member.restoreMaximized = true;
                    Compat.unmaximize(win);
                }
                const r = tiling ? columns[i] : rect;
                win.move_resize_frame(true, r.x, r.y, r.width, r.height);
                this._placed.add(win);
            }
            if (animate)
                this._slideIn(win, place ? mon.y + mon.height - rect.y : this._slideDistance(win));
        });
    }

    // Monitor plugged in or out: keep the overlay on a monitor that exists.
    // Free-mode windows are not moved; mutter already relocates windows of a
    // removed monitor.
    private _onMonitorsChanged(): void {
        this._monitor = this._monitorIndex(this._monitor);
        this._createPanes();
        if (!this._shown)
            return;
        this._syncPanes();
        if (this._tiling())
            this._layout(false);
    }

    // ---- dimmer -----------------------------------------------------------

    // One pane per monitor, so the dimmed area can follow the windows.
    private _createPanes(): void {
        this._panes.forEach(p => p.destroy());
        this.dimmer.set_position(0, 0);
        this.dimmer.set_size(global.stage.width, global.stage.height);
        this._panes = Main.layoutManager.monitors.map(mon => {
            const pane = new St.Widget({ reactive: true, visible: false });
            pane.set_position(mon.x, mon.y);
            pane.set_size(mon.width, mon.height);
            pane.connect('button-press-event', () => {
                this._hide();
                return Clutter.EVENT_STOP;
            });
            this.dimmer.add_child(pane);
            return pane;
        });
        this._updateDimmerStyle();
    }

    // Dim every monitor that has a visible overlay window; with none (empty
    // overlay) the monitor the overlay was opened on.
    private _syncPanes(): void {
        const wanted = new Set(this._visibleWindows().map(w => w.get_monitor()));
        if (wanted.size === 0)
            wanted.add(this._monitorIndex(this._monitor));
        this._panes.forEach((pane, i) => {
            pane.visible = wanted.has(i);
        });
    }

    private _updateDimmerStyle(): void {
        const dim = this.settings.get_double('dim');
        // BACKGROUND blur cannot be cached and costs GPU time every frame
        // while the overlay is open; `blur false` turns it off.
        const wantBlur = this.settings.get_boolean('blur');
        const scale = St.ThemeContext.get_for_stage(global.stage as Clutter.Stage).scale_factor;
        for (const pane of this._panes) {
            pane.set_style(`background-color: rgba(0, 0, 0, ${dim});`);
            const blur = pane.get_effect('blur');
            if (wantBlur && !blur) {
                pane.add_effect_with_name('blur', new Shell.BlurEffect({
                    mode: Shell.BlurMode.BACKGROUND,
                    radius: BLUR_RADIUS * scale,
                    brightness: 1.0,
                }));
            } else if (!wantBlur && blur) {
                pane.remove_effect(blur);
            }
        }
    }

    // BACKGROUND blur reads back what is already on screen. When a window
    // moves, mutter repaints only the damaged area, so the blur would mix in
    // stale or black pixels around it and leave a dark trail. Repaint the
    // whole dimmer instead.
    private _redrawBlur(): void {
        if (this._shown && this.settings.get_boolean('blur'))
            this._panes.forEach(p => p.visible && p.queue_redraw());
    }

    // Keeps the dimmer directly below the lowest visible overlay window. The
    // stacking order comes from mutter (sort_windows_by_stacking), not from
    // the order of get_window_actors().
    private _syncDimmerStack(): void {
        if (!this._dimmer?.visible)
            return;
        const [lowest] = global.display.sort_windows_by_stacking(this._visibleWindows());
        const actor = lowest ? windowActor(lowest) : null;
        if (actor && actor.get_parent() === global.window_group)
            global.window_group.set_child_below_sibling(this._dimmer, actor);
        else
            global.window_group.set_child_above_sibling(this._dimmer, null);
    }

    private _setShown(shown: boolean): void {
        this._shown = shown;
        const d = this.dimmer;
        d.remove_all_transitions();
        if (shown) {
            this._syncPanes();
            d.show();
            this._syncDimmerStack();
            d.ease({ opacity: 255, duration: DIM_FADE_MS, mode: Clutter.AnimationMode.EASE_OUT_QUAD });
        } else {
            d.ease({
                opacity: 0,
                duration: DIM_FADE_MS,
                mode: Clutter.AnimationMode.EASE_IN_QUAD,
                onComplete: () => d.hide(),
            });
        }
    }

    // ---- show / hide ------------------------------------------------------
    //
    // State is _shown plus each window's minimized flag. Every slide first
    // removes the window's running transitions, so a new slide always wins.
    // A slide-out minimizes only if it finished (onComplete is not called for
    // interrupted transitions), the window is still a member and the overlay
    // is still hidden. A release or disable() removes the transitions too.

    private _slideIn(win: Meta.Window, distance: number): void {
        const actor = windowActor(win);
        if (!actor)
            return;
        actor.remove_all_transitions();
        actor.translation_y = distance;
        easeTranslation(actor, {
            translation_y: 0,
            duration: SLIDE_IN_MS,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    private _slideOut(win: Meta.Window, distance: number): void {
        const actor = windowActor(win);
        if (!actor) {
            this._minimize(win);
            return;
        }
        actor.remove_all_transitions();
        easeTranslation(actor, {
            translation_y: distance,
            duration: SLIDE_OUT_MS,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
            onComplete: () => {
                if (this._windows.has(win) && !this._shown)
                    this._minimize(win);
                actor.translation_y = 0;
            },
        });
    }

    private _show(): void {
        if (Main.overview.visible)
            Main.overview.hide();
        this._monitor = this._monitorIndex(global.display.get_current_monitor());
        for (const win of this._windows.keys())
            this._unminimize(win);
        this._setShown(true);
        this._layout(true);
        this._visibleWindows().at(-1)?.activate(global.get_current_time());
    }

    private _hide(): void {
        if (!this._shown)
            return;
        this._setShown(false);
        for (const win of this._visibleWindows())
            this._slideOut(win, this._slideDistance(win));
    }

    private _toggle(): void {
        if (this._shown) {
            this._hide();
            return;
        }
        if (this._windows.size > 0) {
            this._show();
            return;
        }
        // Empty scratchpad: start the terminal, or show the empty, dimmed
        // overlay if there is none to start.
        if (!this.settings.get_boolean('launch-terminal') || !this._launchTerminal())
            this._showEmpty();
    }

    private _showEmpty(): void {
        this._monitor = this._monitorIndex(global.display.get_current_monitor());
        this._setShown(true);
    }

    private _toggleMembership(): void {
        const win = global.display.get_focus_window();
        if (!win || win.get_window_type() !== Meta.WindowType.NORMAL)
            return;
        if (this._windows.has(win)) {
            this._release(win);
            return;
        }
        this._adopt(win);
        if (this._shown) {
            // Overlay is open: the window joins it.
            this._layout(false);
            this._slideIn(win, this._slideDistance(win));
            return;
        }
        // Overlay is hidden: park the window there without following.
        this._slideOut(win, this._slideDistance(win));
    }

    // ---- terminal ---------------------------------------------------------

    // One launch at a time: pressing Super+Q again while the terminal starts
    // does not start a second one. The lock ends when the window shows up,
    // the process exits, or after TERMINAL_LAUNCH_TIMEOUT_S.
    //
    // Returns false if nothing could be started (empty command, terminal not
    // installed); the caller then shows the empty overlay.
    private _launchTerminal(): boolean {
        if (this._launchTimeoutId)
            return true;
        const argv = this.settings.get_strv('terminal-command');
        if (argv.length === 0)
            return false;
        let proc: Gio.Subprocess;
        try {
            proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
        } catch (e) {
            console.error(`scratchpad: cannot start ${argv[0]}`, e);
            return false;
        }
        const generation = ++this._launchGeneration;
        this._launchTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT,
            TERMINAL_LAUNCH_TIMEOUT_S, () => {
                this._launchTimeoutId = 0;
                return GLib.SOURCE_REMOVE;
            });
        proc.wait_async(null, () => {
            if (generation === this._launchGeneration)
                this._endTerminalLaunch();
        });
        return true;
    }

    private _endTerminalLaunch(): void {
        if (this._launchTimeoutId) {
            GLib.source_remove(this._launchTimeoutId);
            this._launchTimeoutId = 0;
        }
    }
}

// Anything with GObject-style disconnect(), for the signal list.
interface GObjectLike {
    disconnect(id: number): void;
}

interface SignalSource extends GObjectLike {
    connect(signal: string, callback: () => void): number;
}
