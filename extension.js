/*
 * byeads-manager@atareao.es
 *
 * Copyright (c) 2021 Lorenzo Carbonell Cerezo <a.k.a. atareao>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

imports.gi.versions.Gtk = "3.0";
imports.gi.versions.Gdk = "3.0";
imports.gi.versions.Gio = "2.0";
imports.gi.versions.Clutter = "1.0";
imports.gi.versions.St = "1.0";
imports.gi.versions.GObject = "3.0";
imports.gi.versions.GLib = "2.0";

const {Gtk, Gdk, Gio, Clutter, St, GObject, GLib} = imports.gi;

const Params = imports.misc.params;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const ExtensionUtils = imports.misc.extensionUtils;
const Extension = ExtensionUtils.getCurrentExtension();
const Convenience = Extension.imports.convenience;

const Gettext = imports.gettext.domain(Extension.uuid);
const _ = Gettext.gettext;

var ByeAdsManager = GObject.registerClass(
    class ByeAdsManager extends PanelMenu.Button{
        _init(){
            super._init(St.Align.START);

            this._exec = Extension.path + "/byeads.sh";
            this._hosts_file = Extension.path + "/hosts.tmp";

            Gtk.IconTheme.get_default().append_search_path(
                Extension.dir.get_child('icons').get_path());

            this._sourceId = 0;
            this._settings = Convenience.getSettings();
            this._settingsChanged();
            this._settings.connect('changed',
                                   this._settingsChanged.bind(this));

            let box = new St.BoxLayout();
            let label = new St.Label({text: 'Button',
                                       y_expand: true,
                                       y_align: Clutter.ActorAlign.CENTER });
            //box.add(label);
            this.icon = new St.Icon({style_class: 'system-status-icon'});
            box.add(this.icon);
            //box.add(PopupMenu.arrowIcon(St.Side.BOTTOM));
            this.add_child(box);

            this.byeadsSwitch = new PopupMenu.PopupSwitchMenuItem(
                _('Disable ByeAds'), {
                    active: true,
                    sensitive: false
            });
            let file = Gio.File.new_for_path(this._hosts_file);
            this.byeadsSwitch.setSensitive(file.query_exists(null));
            this.byeadsSwitch.label.set_text(_('Enable ByeAds'));
            this.byeadsSwitch.connect('toggled',
                                      this._toggleSwitch.bind(this));

            this.menu.addMenuItem(this.byeadsSwitch)
            
            let menuUpdateItem = new PopupMenu.PopupMenuItem(_("Update hosts file"));
            menuUpdateItem.connect('activate', () => {
                try {
                    let command = ['bash', this._exec, "--update"];
                    let proc = Gio.Subprocess.new(
                        command,
                        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                    );
                    proc.communicate_utf8_async(null, null, (proc, res) => {
                        try{
                            let [, stdout, stderr] = proc.communicate_utf8_finish(res);
                            let file = Gio.File.new_for_path(this._hosts_file);
                            this.byeadsSwitch.setSensitive(file.query_exists(null));
                            this._update();
                        }catch(e){
                            logError(e);
                        }
                    });
                } catch (e) {
                    logError(e);
                }
            });
            this.menu.addMenuItem(menuUpdateItem)

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this.settingsMenuItem = new PopupMenu.PopupMenuItem(_("Settings"));
            this.settingsMenuItem.connect('activate', () => {
                ExtensionUtils.openPrefs();
            });

            this.menu.addMenuItem(this.settingsMenuItem);
            this.menu.addMenuItem(this._get_help());

        }

        _toggleSwitch(widget, value){
            let setstatus = ((value == true) ? '--start': '--stop');
            try {
                if(setstatus == '--start'){
                    let file = Gio.File.new_for_path(this._hosts_file);
                    if(!file.query_exists(null)){
                        return;
                    }
                }
                let command = ['pkexec', '--user', 'root', 'bash', this._exec, setstatus];
                let proc = Gio.Subprocess.new(
                    command,
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                );
                proc.communicate_utf8_async(null, null, (proc, res) => {
                    try{
                        let [, stdout, stderr] = proc.communicate_utf8_finish(res);
                        this._update();
                    }catch(e){
                        logError(e);
                    }
                });
            } catch (e) {
                logError(e);
            }
        }

        _update(){
            try {
                let command = ['bash', this._exec, "--status"];
                let proc = Gio.Subprocess.new(
                    command,
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                );
                proc.communicate_utf8_async(null, null, (proc, res) => {
                    try {
                        let [, stdout, stderr] = proc.communicate_utf8_finish(res);
                        let active = (stdout.indexOf('ENABLED') > -1);
                        this._set_icon_indicator(active);
                    } catch (e) {
                        logError(e);
                    } finally {
                        //loop.quit();
                    }
                });
            } catch (e) {
                logError(e);
            }
            return true;
        }

        _set_icon_indicator(active){
            if(this.byeadsSwitch){
                let msg = '';
                let status_string = '';
                let darktheme = this._settings.get_value('darktheme').deep_unpack();
                if(active){
                    msg = _('Disable ByeAds');
                    status_string = 'active';
                }else{
                    msg = _('Enable ByeAds');
                    status_string = 'paused';
                }
                GObject.signal_handlers_block_by_func(this.byeadsSwitch,
                                                      this._toggleSwitch);
                this.byeadsSwitch.setToggleState(active);
                GObject.signal_handlers_unblock_by_func(this.byeadsSwitch,
                                                        this._toggleSwitch);
                this.byeadsSwitch.label.set_text(msg);
                let theme_string = (darktheme?'dark': 'light');
                let icon_string = 'byeads-' + status_string + '-' + theme_string;
                this.icon.set_gicon(this._get_icon(icon_string));
            }
        }

        _create_help_menu_item(text, icon_name, url){
            let icon = this._get_icon(icon_name);
            let menu_item = new PopupMenu.PopupImageMenuItem(text, icon);
            menu_item.connect('activate', () => {
                Gio.app_info_launch_default_for_uri(url, null);
            });
            return menu_item;
        }

        _get_help(){
            let menu_help = new PopupMenu.PopupSubMenuMenuItem(_('Help'));
            menu_help.menu.addMenuItem(this._create_help_menu_item(
                _('Project Page'), 'info', 'https://github.com/atareao/byeads-manager'));
            menu_help.menu.addMenuItem(this._create_help_menu_item(
                _('Get help online...'), 'help', 'https://www.atareao.es/aplicacion/byeads-manager/'));
            menu_help.menu.addMenuItem(this._create_help_menu_item(
                _('Report a bug...'), 'bug', 'https://github.com/atareao/byeads-manager/issues'));

            menu_help.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            
            menu_help.menu.addMenuItem(this._create_help_menu_item(
                _('El atareao'), 'atareao', 'https://www.atareao.es'));
            menu_help.menu.addMenuItem(this._create_help_menu_item(
                _('GitHub'), 'github', 'https://github.com/atareao'));
            menu_help.menu.addMenuItem(this._create_help_menu_item(
                _('Twitter'), 'twitter', 'https://twitter.com/atareao'));
            menu_help.menu.addMenuItem(this._create_help_menu_item(
                _('Telegram'), 'telegram', 'https://t.me/canal_atareao'));
            menu_help.menu.addMenuItem(this._create_help_menu_item(
                _('Mastodon'), 'mastodon', 'https://mastodon.social/@atareao'));
            menu_help.menu.addMenuItem(this._create_help_menu_item(
                _('Spotify'), 'spotify', 'https://open.spotify.com/show/2v0fC8PyeeUTQDD67I0mKW'));
            menu_help.menu.addMenuItem(this._create_help_menu_item(
                _('YouTube'), 'youtube', 'http://youtube.com/c/atareao'));
            return menu_help;
        }

        _get_icon(icon_name){
            let base_icon = Extension.path + '/icons/' + icon_name;
            let file_icon = Gio.File.new_for_path(base_icon + '.png')
            if(file_icon.query_exists(null) == false){
                file_icon = Gio.File.new_for_path(base_icon + '.svg')
            }
            if(file_icon.query_exists(null) == false){
                return null;
            }
            let icon = Gio.icon_new_for_string(file_icon.get_path());
            return icon;
        }

        _settingsChanged(){
            this._update();
            let checktime = this._settings.get_value('watch-time').deep_unpack();
            let monitor = this._settings.get_value('monitor').deep_unpack();
            if(this._sourceId > 0){
                GLib.source_remove(this._sourceId);
            }
            if(monitor){
                this._sourceId = GLib.timeout_add_seconds(
                    GLib.PRIORITY_DEFAULT, checktime,
                    this._update.bind(this));
                log(this._sourceId);
            }
        }
    }
);
var button;

function init() {
    Convenience.initTranslations();
}

function enable() {
    button = new ByeAdsManager();
    Main.panel.addToStatusArea('ByeAds Manager', button, 0, 'right');
}

function disable() {
    if(button.sourceId > 0){
        GLib.source_remove(button.sourceId);
    }
    button.destroy();
}
