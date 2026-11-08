// SPDX-License-Identifier: GPL-2.0-or-later
// Preferences window (Extensions app → Scratchpad → Settings).
//
// Runs in a separate GTK process, so it must not import extension.js or
// any GNOME Shell UI module.

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ScratchpadPreferences extends ExtensionPreferences {
    // Async only because the type says so; it does not await anything, so
    // GNOME 46, which ignores the returned promise, gets a filled window too.
    async fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({ title: 'Scratchpad', icon_name: 'utilities-terminal-symbolic' });
        window.add(page);

        const keys = new Adw.PreferencesGroup({ title: 'Shortcuts' });
        keys.add(shortcutRow(settings, 'toggle-scratchpad', 'Show or hide the scratchpad'));
        keys.add(shortcutRow(settings, 'move-to-scratchpad', 'Add or release the focused window'));
        page.add(keys);

        const behaviour = new Adw.PreferencesGroup({ title: 'Behaviour' });
        behaviour.add(switchRow(settings, 'hide-on-focus-loss', 'Hide when another window gets focus',
            'A click on or Alt+Tab to a window outside the scratchpad hides it'));
        behaviour.add(switchRow(settings, 'hide-on-workspace-switch', 'Hide on workspace switch'));
        page.add(behaviour);

        const terminal = new Adw.PreferencesGroup({
            title: 'Terminal',
            description: 'Started when you open an empty scratchpad. The terminal window must get ' +
                'the window class below, so the extension can recognise it.',
        });
        terminal.add(switchRow(settings, 'launch-terminal', 'Start a terminal when empty',
            'Otherwise the empty, dimmed overlay is shown'));
        const command = commandRow(settings);
        const wmClass = textRow(settings, 'terminal-class', 'Window class');
        for (const row of [command, wmClass])
            settings.bind('launch-terminal', row, 'sensitive', Gio.SettingsBindFlags.GET);
        terminal.add(command);
        terminal.add(wmClass);
        page.add(terminal);

        const look = new Adw.PreferencesGroup({ title: 'Background' });
        look.add(spinRow(settings, 'dim', 'Dimming', 0, 1, 0.05, 2, '0 = none, 1 = black'));
        look.add(switchRow(settings, 'blur', 'Blur', 'Turn off on slow graphics'));
        page.add(look);

        const tiling = new Adw.PreferencesGroup({
            title: 'Tiling',
            description: 'By default windows keep the position and size you give them.',
        });
        tiling.add(switchRow(settings, 'tile-windows', 'Tile windows',
            'Lay out the windows side by side in the overlay area'));
        const sized = [
            spinRow(settings, 'height-percent', 'Height', 20, 100, 5, 0, 'Percent of the screen'),
            spinRow(settings, 'width-percent', 'Width', 20, 100, 5, 0, 'Percent of the screen'),
            spinRow(settings, 'gap-outer', 'Outer gap', 0, 100, 1, 0, 'Pixels to the screen edge'),
            spinRow(settings, 'gap-inner', 'Inner gap', 0, 50, 1, 0, 'Half the pixels between windows'),
        ];
        for (const row of sized) {
            settings.bind('tile-windows', row, 'sensitive', Gio.SettingsBindFlags.GET);
            tiling.add(row);
        }
        page.add(tiling);
    }
}

function switchRow(settings: Gio.Settings, key: string, title: string, subtitle = ''): Adw.SwitchRow {
    const row = new Adw.SwitchRow({ title, subtitle });
    settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

function spinRow(settings: Gio.Settings, key: string, title: string,
    lower: number, upper: number, step: number, digits: number, subtitle = ''): Adw.SpinRow {
    const row = new Adw.SpinRow({
        title,
        subtitle,
        digits,
        adjustment: new Gtk.Adjustment({ lower, upper, step_increment: step, page_increment: step * 5 }),
    });
    settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

// Text is saved with the apply button (or Enter), not on every key press.
function textRow(settings: Gio.Settings, key: string, title: string): Adw.EntryRow {
    const row = new Adw.EntryRow({ title, show_apply_button: true, text: settings.get_string(key) });
    row.connect('apply', () => settings.set_string(key, row.text.trim()));
    settings.connect(`changed::${key}`, () => {
        row.text = settings.get_string(key);
    });
    return row;
}

// terminal-command is a string list; it is edited as one shell-quoted line.
function commandRow(settings: Gio.Settings): Adw.EntryRow {
    const key = 'terminal-command';
    // Quote only arguments that need it, so the line stays readable.
    const quote = (arg: string) => (/^[\w@%+=:,./-]+$/.test(arg) ? arg : GLib.shell_quote(arg));
    const show = () => settings.get_strv(key).map(quote).join(' ');
    const row = new Adw.EntryRow({ title: 'Command', show_apply_button: true, text: show() });
    row.connect('apply', () => {
        const text = row.text.trim();
        if (text === '') {
            settings.set_strv(key, []);
            row.remove_css_class('error');
            return;
        }
        try {
            const [, argv] = GLib.shell_parse_argv(text);
            settings.set_strv(key, argv ?? []);
            row.remove_css_class('error');
        } catch {
            row.add_css_class('error');
        }
    });
    settings.connect(`changed::${key}`, () => {
        row.text = show();
    });
    return row;
}

// Shows the current shortcut; activating the row records a new one.
function shortcutRow(settings: Gio.Settings, key: string, title: string): Adw.ActionRow {
    const row = new Adw.ActionRow({ title, activatable: true });
    const label = new Gtk.ShortcutLabel({
        disabled_text: 'Disabled',
        valign: Gtk.Align.CENTER,
        accelerator: settings.get_strv(key)[0] ?? '',
    });
    row.add_suffix(label);
    settings.connect(`changed::${key}`, () => {
        label.accelerator = settings.get_strv(key)[0] ?? '';
    });
    row.connect('activated', () => recordShortcut(row, settings, key, title));
    return row;
}

function recordShortcut(parent: Gtk.Widget, settings: Gio.Settings, key: string, title: string): void {
    const status = new Adw.StatusPage({
        title,
        description: 'Press a key combination with Super, Ctrl or Alt.\n' +
            'Escape cancels, Backspace disables the shortcut.',
        icon_name: 'preferences-desktop-keyboard-shortcuts-symbolic',
    });
    const dialog = new Adw.Dialog({ title: 'Set shortcut', content_width: 420, child: status });

    const controller = new Gtk.EventControllerKey();
    controller.connect('key-pressed', (_c: Gtk.EventControllerKey, keyval: number, _code: number, state: Gdk.ModifierType) => {
        const mods = state & Gtk.accelerator_get_default_mod_mask();
        const key_ = Gdk.keyval_to_lower(keyval);
        if (mods === 0 && key_ === Gdk.KEY_Escape) {
            dialog.close();
            return Gdk.EVENT_STOP;
        }
        if (mods === 0 && key_ === Gdk.KEY_BackSpace) {
            settings.set_strv(key, []);
            dialog.close();
            return Gdk.EVENT_STOP;
        }
        // Needs Super, Ctrl or Alt; a bare or Shift-only key would type.
        if ((mods & ~Gdk.ModifierType.SHIFT_MASK) === 0 || !Gtk.accelerator_valid(key_, mods))
            return Gdk.EVENT_STOP;
        settings.set_strv(key, [Gtk.accelerator_name(key_, mods)]);
        dialog.close();
        return Gdk.EVENT_STOP;
    });
    dialog.add_controller(controller);
    dialog.present(parent);
}
