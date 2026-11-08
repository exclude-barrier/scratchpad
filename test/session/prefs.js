// SPDX-License-Identifier: GPL-2.0-or-later
// Real GTK test; invoked only inside the private release-test compositor.
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';

Gio.Resource.load('/usr/share/gnome-shell/org.gnome.Shell.Extensions.src.gresource')._register();
Gio.Resource.load('/usr/share/gnome-shell/gnome-shell-dbus-interfaces.gresource')._register();
const path = ARGV[0];
const { default: Preferences } = await import(`file://${path}/prefs.js`);
const [, bytes] = GLib.file_get_contents(`${path}/metadata.json`);
const metadata = JSON.parse(new TextDecoder().decode(bytes));
metadata.path = path;
metadata.dir = Gio.File.new_for_path(path);
const prefs = new Preferences(metadata);
const settings = prefs.getSettings();
const saved = new Map(settings.list_keys().map(key => [key, settings.get_value(key)]));
const wait = ms => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
    resolve();
    return GLib.SOURCE_REMOVE;
}));
function check(value, message) {
    if (!value)
        throw new Error(message);
}
function descendants(widget) {
    const result = [widget];
    for (let child = widget.get_first_child(); child; child = child.get_next_sibling())
        result.push(...descendants(child));
    return result;
}
Adw.init();
const app = new Adw.Application({ application_id: 'org.example.ScratchpadPrefsTest',
    flags: Gio.ApplicationFlags.NON_UNIQUE });
app.register(null);
const window = new Adw.PreferencesWindow({ application: app });
try {
    await prefs.fillPreferencesWindow(window);
    window.present();
    await wait(250);
    const widgets = descendants(window);
    const row = title => widgets.find(widget => widget instanceof Adw.PreferencesRow &&
        widget.title === title);
    check(row('Command') && row('Blur') && row('Show or hide the scratchpad'), 'Missing preferences rows');
    row('Blur').active = false;
    check(!settings.get_boolean('blur'), 'Switch did not update GSettings');
    settings.set_boolean('blur', true);
    check(row('Blur').active, 'External setting did not update switch');
    row('Dimming').value = 0.35;
    check(Math.abs(settings.get_double('dim') - 0.35) < 0.001, 'Spin row did not update settings');
    row('Start a terminal when empty').active = false;
    check(!row('Command').sensitive && !row('Window class').sensitive, 'Terminal sensitivity binding failed');
    row('Start a terminal when empty').active = true;
    row('Window class').text = '  org.example.Test  ';
    row('Window class').emit('apply');
    check(settings.get_string('terminal-class') === 'org.example.Test', 'Window class was not trimmed');
    const before = settings.get_strv('terminal-command');
    row('Command').text = 'ghostty "unterminated';
    row('Command').emit('apply');
    check(row('Command').has_css_class('error') &&
        JSON.stringify(settings.get_strv('terminal-command')) === JSON.stringify(before),
    'Invalid command changed setting or was not marked');
    row('Command').text = 'ghostty --class="a b"';
    row('Command').emit('apply');
    check(JSON.stringify(settings.get_strv('terminal-command')) === '["ghostty","--class=a b"]' &&
        !row('Command').has_css_class('error'), 'Quoted command parsing failed');
    row('Command').text = '';
    row('Command').emit('apply');
    check(settings.get_strv('terminal-command').length === 0, 'Empty command did not clear argv');

    const shortcut = row('Show or hide the scratchpad');
    async function key(keyval, state) {
        shortcut.emit('activated');
        await wait(80);
        const dialog = window.get_visible_dialog();
        check(dialog, 'Shortcut dialog did not open');
        const controllers = dialog.observe_controllers();
        let controller;
        for (let i = 0; i < controllers.get_n_items(); i++) {
            if (controllers.get_item(i) instanceof Gtk.EventControllerKey)
                controller = controllers.get_item(i);
        }
        check(controller, 'Shortcut key controller missing');
        controller.emit('key-pressed', keyval, 0, state);
        await wait(200);
    }
    const oldShortcut = settings.get_strv('toggle-scratchpad')[0];
    await key(Gdk.KEY_Escape, 0);
    check(settings.get_strv('toggle-scratchpad')[0] === oldShortcut, 'Escape changed shortcut');
    await key(Gdk.KEY_BackSpace, 0);
    check(settings.get_strv('toggle-scratchpad').length === 0, 'Backspace did not disable shortcut');
    await key(Gdk.KEY_j, Gdk.ModifierType.CONTROL_MASK);
    check(settings.get_strv('toggle-scratchpad')[0] === '<Control>j', 'Shortcut recording failed');
    print('Preferences checks passed');
} finally {
    for (const [key, value] of saved)
        settings.set_value(key, value);
    window.destroy();
}
