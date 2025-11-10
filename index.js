global.errorReporter = require('./lib/error_reporter');
require('./lib/object_extras');

require('./lib/dominate');
require('./lib/alertify');
require('./lib/node_lib');
require('./lib/sidebar_resize');
require('./lib/query_tab_resizer');
require('./lib/widgets/generic_table');
require('./lib/psql_runner');
require('./lib/sql_importer');
require('./lib/pg_dump_runner');
require('./lib/sql_exporter');
require('./lib/pg_type_names');
require('./lib/sql_snippets');
require('./lib/resizable_columns');

require('./app');
global.Pane = require('./app/views/panes/all');
require('./app/connection');
require('./app/view_helpers');
require('./app/db_screen');
require('./app/login_components/heroku_client');
require('./app/login_components/login_postgres_url_form');
require('./app/login_components/login_standard_form');
require('./app/login_screen');
require('./app/help_screen');
require('./app/views/db_screen_view');
require('./app/views/snippets');

global.Dialog = require('./app/views/dialogs/all');
global.Model = require('./app/models/all');

require('./app/controllers/import_controller');
require('./app/controllers/export_controller');
require('./app/controllers/updates_controller');
require('./app/controllers/server_controller');

require('./app/views/history_window');

var CliUtil = require('./lib/cli_util');
var electronRemote = require('@electron/remote');

global.$u = window.$u = window.jQuery;


/*
global.$ = function (selector) {
  return document.querySelector(selector);
};
*/

global.$dom = function(tags) { return global.DOMinate(tags)[0]; };

require('./app/utils');

// eslint-disable-next-line
function reloadCss() {
  var queryString = '?reload=' + new Date().getTime();
  global.$u('link[rel="stylesheet"]').each(function () {
    this.href = this.href.replace(/\?.*|$/, queryString);
  });
}

//var gui = require('nw.gui');
//global.gui = gui;
global.electron = require('electron');

electron.ipcRenderer.on('open-file', function(event, message) {
  console.log('open-file', event, message);
});

electron.ipcRenderer.on('open-url', function(event, url) {
  CliUtil.resolveArg(url, (resultUrl) => {
    console.log('CliUtil.resolveArg', resultUrl);
    App.openConnection(resultUrl);
  });
});

$(window).on('window-ready', () => {
  electron.ipcRenderer.send('main-window-ready', {});
});

require('./app/top_menu');

var cliArgs = electronRemote.process.argv;
// Skip argument parsing when running tests
var isTestMode = cliArgs.some(arg => arg.includes('electron-mocha') || arg.includes('tests/') || arg.includes('test'));
if (cliArgs.length > 2 && !isTestMode) {
  var connectionStr = cliArgs[2];
  if (connectionStr.startsWith("postgres://") || connectionStr.startsWith("postgresql://")) {
    App.cliConnectString = connectionStr;
  } else {
    $u.alertError(`Can't recognize argument ${cliArgs[2]}`, {
      detail: `Expected:\n  postgres://user@server/dbname \n  postgresql://user@server/dbname`
    });
  }
}

$(document).ready(function() {
  global.App.init();
  //renderHome();
  $(window).bind('resize', function () {
    global.App.setSizes();
  });

  $u.makeDroppable(document.body, function (path) {
    var importer = new ImportController();
    importer.filename = path;
    importer.showImportDialog();
  });

  window.Mousetrap.stopCallback = function(e, element, combo) {
    if (element.classList && element.classList.contains('mousetrap')) {
      return false;
    }

    if (combo.includes('shift+') && (combo.includes('mod+') || combo.includes('command+') || combo.includes('ctrl+'))) {
      return false;
    }

    if (combo.includes('mod+') || combo.includes('command+') || combo.includes('ctrl+')) {
      return false;
    }

    if (element.tagName == 'SELECT' && (combo === 'up' || combo === 'down')) {
      return true;
    }

    return element.tagName == 'INPUT' || element.tagName == 'SELECT' || element.tagName == 'TEXTAREA' ||
           (element.contentEditable && element.contentEditable == 'true');
  };

  window.Mousetrap.bind("down", function () {
    GenericTable.keyPressed('down');
    return false;
  });

  window.Mousetrap.bind("up", function () {
    GenericTable.keyPressed('up');
    return false;
  });

  window.Mousetrap.bind(["backspace", "del"], function () {
    GenericTable.keyPressed('backspace');
  });

  document.addEventListener('keydown', function(e) {
    const isMod = e.metaKey || e.ctrlKey;

    if (isMod && e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const tabIndex = parseInt(e.key) - 1;
      if (tabIndex >= 0 && tabIndex < global.App.tabs.length) {
        global.App.activateTab(tabIndex);
      }
      return false;
    }
  }, true);

  window.Mousetrap.bind("mod+t", function () {
    const currentTab = global.App.currentTab;
    if (currentTab && currentTab.instance && currentTab.instance.constructor.name === 'DbScreen') {
      new Dialog.TableSwitcher(currentTab.instance);
    }
    return false;
  });

  window.Mousetrap.bind("mod+n", function () {
    const currentTab = global.App.currentTab;
    if (currentTab && currentTab.instance && currentTab.instance.constructor.name === 'DbScreen') {
      const dbScreen = currentTab.instance;
      const connectionOptions = dbScreen.connection.options;
      const connectionName = connectionOptions.tab_name || connectionOptions.host || 'DB';
      global.App.openConnection(connectionOptions, connectionName);
    }
    return false;
  });

  document.addEventListener('keydown', function(e) {
    const isMod = e.metaKey || e.ctrlKey;
    const isShift = e.shiftKey;

    if (isMod && isShift && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const currentTab = global.App.currentTab;
      if (currentTab && currentTab.instance && currentTab.instance.constructor.name === 'DbScreen') {
        if (e.key === 'ArrowDown') {
          currentTab.instance.navigateToNextTable();
        } else if (e.key === 'ArrowUp') {
          currentTab.instance.navigateToPreviousTable();
        }
      }
      return false;
    }

    if (isMod && e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const currentIndex = global.App.activeTab;
      if (currentIndex !== null) {
        if (e.key === 'ArrowRight') {
          const nextIndex = currentIndex < global.App.tabs.length - 1 ? currentIndex + 1 : 0;
          global.App.activateTab(nextIndex);
        } else if (e.key === 'ArrowLeft') {
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : global.App.tabs.length - 1;
          global.App.activateTab(prevIndex);
        }
      }
      return false;
    }
  }, true);

  electron.ipcRenderer.on('Snippet.insert', function(event, message) {
    console.log('Snippet.insert', event, message);
    Pane.Content.insertSnippet(message);
  });

  setTimeout(function () {
    console.log("Checking updates info");
    (new UpdatesController).checkUpdates();
  }, 10000);

  /*
  var win = gui.Window.get();
  win.focus();

  win.on('closed', function() {
    if (global.App.snippersWin) {
      global.App.snippersWin.close();
    }
    if (global.App.historyWin) {
      global.App.historyWin.close();
    }
  });
  */

  var windowEvents = {
    focus: () => {
      document.body.classList.remove('unfocused');
      App.isFocused = true;
    },
    blur: () => {
      document.body.classList.add('unfocused');
      App.isFocused = false;
    }
  };

  var mainWindow = electronRemote.app.mainWindow;
  mainWindow.on('focus', windowEvents.focus);
  mainWindow.on('blur', windowEvents.blur);

  // used when we reload app, usually for development
  window.addEventListener('beforeunload', () => {
    mainWindow.removeListener('focus', windowEvents.focus);
    mainWindow.removeListener('blur', windowEvents.blur);
  });

  if (mainWindow.isFocused()) {
    windowEvents.focus();
  } else {
    windowEvents.blur();
  }

  if (electronRemote.systemPreferences && electronRemote.systemPreferences.subscribeNotification) {
    electronRemote.systemPreferences.subscribeNotification('AppleInterfaceThemeChangedNotification', () => {
      if (electronRemote.systemPreferences.isDarkMode()) {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
    });
  }
});
