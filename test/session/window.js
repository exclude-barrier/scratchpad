// SPDX-License-Identifier: GPL-2.0-or-later
// Disposable non-terminal window for real Mutter membership/focus tests.
import Gtk from 'gi://Gtk?version=4.0';
import Gio from 'gi://Gio';

const app = new Gtk.Application({ application_id: 'org.example.ScratchpadTestWindow',
    flags: Gio.ApplicationFlags.NON_UNIQUE });
app.connect('activate', () => {
    const window = new Gtk.ApplicationWindow({ application: app,
        title: 'Scratchpad release test', default_width: 480, default_height: 320,
        child: new Gtk.Label({ label: 'Disposable test window' }) });
    window.present();
});
app.run([]);
