var remote = require('@electron/remote');
var events = require('events');
var path = require('path');

require('./lib/node_lib');
global.EventEmitter2 = require('eventemitter2').EventEmitter2;
global.logger = require('./app/logger').make('info');

var RenderView = require('./app/components/render_view');

class UserError extends Error {
  /*::
    description: string
  */
  constructor(message, description = null) {
    super(message);
    this.description = description;
    Error.captureStackTrace(this, UserError);
  }
}

/*::

interface AppTab {
  instance: DbScreen,
  name: string,
  tabHandler: JQuery<HTMLElement>,
  content: JQuery<HTMLElement>,
  is_active: boolean,
  activate: () => void
}

interface App {
  root: string
  activeTab: number
  tabs: AppTab[]
  loginScreen?: LoginScreen;
  init: () => void;
  addTab: (name: string, contentHtml: string, instance: any) => void;
  closeCurrentTab: () => void;
  activateLoginTab: () => void;
  lastAddedTab: () => void;
  activeTabObj: () => AppTab;
  addConnectionTab: () => any;
  addDbScreen: (connection: Connection, connectionName: any, options: any) => void;
  addHelpScreen: () => void;
  helpScreenOpen: () => boolean;
  renderView: (viewName: string, options?: any) => JQuery<HTMLElement>;
  setSizes: () => void;
  startLoading: (message: string, timeout?: number, options?: any) => void;
  stopLoading: () => void;
  stopRunningQuery: () => void;
  openConnection: (options: any, connectionName?: string, callback?: Function) => void;
  humanErrorMessage: (error: any, options?: any) => string;

  on(event: string | symbol, listener: (...args: any[]) => void): this;
  removeListener(event: string | symbol, listener: (...args: any[]) => void): this;

  activateTab: (index: number) => void;
  closeTab: (index) => void;
  currentTab?: AppTab;

  log?: any;
  logger?: any;
  remote?: Electron.Remote;
  emit?: (eventName, ...any) => void;
  logEvents?: any[];
  helpScreen?: HelpScreen;
  snippersWin?: Electron.BrowserWindow;
  historyWin?: Electron.BrowserWindow;
  vendorPath: string;
  cliConnectString?: string;
  UserError?: typeof UserError;
  isFocused: boolean;
}
*/

global.App = {
  root: remote.app.getAppPath(),
  // used for running binaries inside asar package
  vendorPath: remote.app.MainFilename.includes('app.asar') ?
    path.join(remote.app.MainFilename, `../../../vendor/${process.platform}`) :
    path.join(remote.app.MainFilename.replace('node_modules/electron-mocha/lib/main.js', 'index.html'), `../vendor/${process.platform}`),

  activeTab: null,
  tabs: [], // {name, content, is_active}
  isFocused: true,

  init: function () {
    RenderView.pugCacheLoad();
    this.container = $('#content');
    this.tabsContainer = $('#tabs');
    // skip first page
    this.addConnectionTab();
    this.activateTab(0);

    logger.info('Loaded in ' + (Date.now() - remote.app.ApplicationStart) + 'ms');
    console.log('Loaded in ' + (Date.now() - remote.app.ApplicationStart) + 'ms');
    /* auto connect, for development *\/

    this.loginScreen.onFormSubmit(false, () => {
      setTimeout(() => {
        this.activeTabObj().instance.view.databaseSelect.val('ds2').change();
      }, 50);
    });

    /* --- auto connect */

    this.setSizes();
    $(window).trigger('window-ready');
  },

  addTab: function (name, contentHtml, instance) {
    var tree = DOMinate([ 'div.tab', ['span$colorDot.tab-color-dot'], ['span$text.tab-text', name], ['span$shortcut.tab-shortcut', ''], ['a$close.close', '']]);
    $u(this.tabsContainer).prepend(tree[0]);

    var contentTree = DOMinate([ 'div.tabContent' ]);
    if (typeof contentHtml == "string") {
      contentTree[0].innerHTML = contentHtml;
    } else {
      $u(contentTree[0]).append(contentHtml);
    }

    $u(contentTree[0]).hide();
    $u(this.container).prepend(contentTree[0]);

    var tabData = {
      instance: instance,
      name: name,
      tabHandler: $u(tree[0]),
      content: $u(contentTree[0]),
      colorDotElement: $u(tree.colorDot),
      textElement: $u(tree.text),
      shortcutElement: $u(tree.shortcut),
      is_active: false,
      activate: () => {
        if (App.tabs.indexOf(tabData) == -1) {
          logger.info('Try to activate removed tab', tabData);
        }
        App.activateTab(App.tabs.indexOf(tabData));
      }
    };

    tabData.textElement.attr('title', name);

    this.tabs.unshift(tabData);
    if (this.activeTab !== null) this.activeTab += 1;

    tabData.tabHandler.bind('click', () => {
      tabData.activate();
    });

    $u(tree.close).bind('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      App.closeTab(App.tabs.indexOf(tabData));
    });

    this.updateTabShortcuts();

    return tabData;
  },

  updateTabTitle: function(instance, title) {
    const tab = this.tabs.find(t => t.instance === instance);
    if (tab) {
      tab.textElement.text(title);
      tab.textElement.attr('title', title);
    }
  },

  getConnectionColor: function(connectionKey) {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
      '#FF9FF3', '#54A0FF', '#FF6348', '#1DD1A1', '#FFC312'
    ];

    if (!window.localStorage.connectionColors) {
      window.localStorage.connectionColors = JSON.stringify({});
    }

    const colorMap = JSON.parse(window.localStorage.connectionColors);

    if (!colorMap[connectionKey]) {
      const usedColors = Object.values(colorMap);
      const availableColors = colors.filter(c => !usedColors.includes(c));
      colorMap[connectionKey] = availableColors.length > 0
        ? availableColors[Math.floor(Math.random() * availableColors.length)]
        : colors[Math.floor(Math.random() * colors.length)];
      window.localStorage.connectionColors = JSON.stringify(colorMap);
    }

    return colorMap[connectionKey];
  },

  updateTabShortcuts: function () {
    this.tabs.forEach((tab, index) => {
      const shortcutNumber = index + 1;
      if (shortcutNumber <= 9) {
        tab.shortcutElement.text(`⌘${shortcutNumber}`);
        tab.shortcutElement.show();
      } else {
        tab.shortcutElement.hide();
      }
    });
  },

  closeTab: function(index) {
    var tab = this.tabs[index];
    tab.tabHandler.remove();
    tab.content.remove();
    if (tab.instance.destroy) tab.instance.destroy();
    this.tabs.splice(index, 1);

    if (this.activeTab == index) {
      if (this.activeTab == 0 && this.tabs.length == 0) {
        this.activeTab = null;
        this.addConnectionTab();
      } else if (this.activeTab == 0 && this.tabs.length > 0) {
        this.activeTab = null;
        this.activateTab(index);
      } else if (this.activeTab == index) {
        this.activeTab = null;
        this.activateTab(index - 1);
      }
    } else if (this.activeTab > index) {
      this.activeTab -= 1;
    }

    this.updateTabShortcuts();
  },

  closeCurrentTab: function () {
    if (this.tabs[this.activeTab].instance instanceof LoginScreen) {
      console.log("Can not close 'Connection' tab");
    } else {
      this.closeTab(this.activeTab);
    }
  },

  activateLoginTab: function () {
    if (this.tabs[this.activeTab].instance instanceof LoginScreen) {
      console.log("Current tab is 'Connection' tab");
    } else {
      this.tabs.forEach((tab, tabIndex) => {
        if (tab.instance instanceof LoginScreen) {
          this.activateTab(tabIndex);
        }
      });
    }
  },

  lastAddedTab: function () {
    return this.tabs[this.tabs.length - 1];
  },

  activateTab: function (idx) {
    if (!this.tabs[idx]) throw "There is no tab with index " + idx;

    if (this.activeTab !== null) {
      this.currentTab.tabHandler.removeClass('active');
      this.currentTab.content.hide();
    }

    this.activeTab = idx;
    this.tabs[idx].tabHandler.addClass('active');
    this.tabs[idx].content.show();
    this.emit('tab.changed', idx);
  },

  activeTabObj: function () {
    return this.tabs[this.activeTab];
  },

  addConnectionTab: function() {
    this.loginScreen = new LoginScreen(this.cliConnectString);
    var tab = this.addTab('Connection', this.loginScreen.content, this.loginScreen);
    tab.tabHandler.find('.close').hide();
    tab.colorDotElement.hide();
    return tab;
  },

  addDbScreen: function(connection, connectionName, options) {
    if (connectionName == '') connectionName = false;
    var dbs = new DbScreen(connection, options);
    dbs.connectionName = connectionName || 'DB';

    const connectionKey = `${connection.options.host || 'localhost'}:${connection.options.port || '5432'}/${connection.options.database || 'postgres'}`;
    dbs.connectionColor = this.getConnectionColor(connectionKey);

    const tab = this.addTab(dbs.connectionName, dbs.view.content, dbs);
    tab.colorDotElement.css('background-color', dbs.connectionColor);

    return tab;
  },

  addHelpScreen: function() {
    this.helpScreen = new HelpScreen();
    var tab = this.addTab('Help', this.helpScreen.content, this.helpScreen);
    tab.colorDotElement.hide();
    return tab;
  },

  helpScreenOpen: function () {
    if (!this.helpScreen) return false;

    var tabs = this.tabs.filter((tab) => {
      if (tab.instance == this.helpScreen) {
        return true;
      }
      return false;
    });

    return !!tabs.length;
  },

  renderView: function (file, options) {
    return RenderView.renderView(file, options);
  },

  setSizes: function() {
    var height = $u(window).height();
    var topOffset = $u('body > #tabs').height();
    $u('body > #content').css('height', height - topOffset);
  },

  startLoading: function (message, timeout, options) {
    if (!options) options = {};

    if (this.loader) this.loader.hide();
    this.stopLoading();

    this.loader = this.renderView('_loader', {
      message: message,
      cancel: options.cancel
    });

    if (options.cancel) {
      $u(this.loader).find('a.cancel-btn').on('click', () => {
        options.cancel();
      });
    }

    $u(window.document.body).append(this.loader);

    if (timeout === undefined || timeout === null) timeout = 300;

    this.loaderTimeout = setTimeout(() => {
      delete this.loaderTimeout;
      this.loader.addClass('appear');
    }, timeout);
  },

  stopLoading: function () {
    if (this.loader) {
      if (this.loaderTimeout) clearTimeout(this.loaderTimeout);
      var loader = this.loader;
      delete this.loader;
      loader.removeClass('appear');
      setTimeout(() => {
        loader.remove();
      }, 250);
    }
  },

  stopRunningQuery: function () {
    if (this.currentTab.instance.connection) {
      this.currentTab.instance.connection.stopRunningQuery();
    }
  },

  openConnection: function (options, connectionName, callback) {
    var showConnectionError = true;
    var runCallback = true;

    this.startLoading("Connecting...", 500, {
      cancel() {
        App.stopRunningQuery();
        App.stopLoading();
        showConnectionError = false
        if (callback) callback(false);
        runCallback = false
      }
    });
    //this.startLoading("Connecting...");

    if (typeof options == 'string') {
      options = Connection.parseConnectionString(options);
      if (!connectionName) {
        if (options.tab_name && options.tab_name != "") {
          connectionName = options.tab_name;
        } else {
          connectionName = options.host;
        }
      }
    }

    var conn = new Connection();
    conn.connectToServer(options, (status, error) => {
      this.stopLoading();
      if (status) {
        if (conn.options.tab_name) {
          connectionName = conn.options.tab_name;
        }
        var tab = this.addDbScreen(conn, connectionName, options);
        tab.activate();
        if (callback && runCallback) callback(tab);
      } else {
        if (showConnectionError) {
          $u.alertError("Connection error", {
            detail: this.humanErrorMessage(error)
          });
        } else {
          console.error(error)
        }
        //window.alertify.alert(this.humanErrorMessage(message));
        if (callback && runCallback) callback(false);
      }
    });
  },

  humanErrorMessage: (error, options = {}) => {
    if (error.message == "connect ECONNREFUSED") {
      return "Connection refused.<br>Make sure postgres is running";
    } else if (error.message.match(/^getaddrinfo ENOTFOUND/)) {
      var host = error.message.match(/^getaddrinfo ENOTFOUND\s+(.+)$/);
      return `Can not resolve host '${host[1]}'`;
    } else if (error.message.match(/^connect ENOENT /)) {
      var socket = error.message.match(/^connect ENOENT\s+(.+)$/);
      return `Unix socket not found at ${socket[1]}`;
    } else {
      var message = error.message;
      if (options.showQuery && error.query) {
        message += `\n\nSQL:\n${error.query}`;
      }
      return message;
    }
  },

  /*::
  on(event, listener) { return this },
  removeListener(event, listener) { return this },
  */
};

Object.defineProperty(App, "currentTab", {
  get: function () {
    return this.activeTabObj();
  },

  set: function (tab_or_id) {
    if (typeof tab_or_id == 'number') {
      this.activateTab(tab_or_id);
    } else {
      if (this.tabs.indexOf(tab_or_id) != -1) {
        this.activateTab(this.tabs.indexOf(tab_or_id));
      } else {
        throw "object is not in App.tabs";
      }
    }
  }
});

Object.defineProperty(App, "currentTable", {
  get: function () {
    if (this.currentTab && this.currentTab.instance) {
      return this.currentTab.instance.table;
    } else {
      return null;
    }
  }
});

Object.setPrototypeOf(global.App, new events.EventEmitter);

global.App.remote = remote;

global.App.emit = function () {
  //if (!this._events[eventName]) {
  //  console.log("Fire event '" + eventName + "' but no listeners");
  //}
  var fn = events.EventEmitter.prototype.emit;
  fn.apply(this, arguments);
}

global.App.logEvents = [];
global.App.logger = new EventEmitter2({
  wildcard: true
});

global.App.log = function App_log() {
  return this.logger.emit.apply(this.logger, arguments);
}.bind(App);

global.App.logger.onAny((ev, ...args) => {
  if (args[2] && args[2] instanceof Error) {
    args[2] = {
      message: args[2].message
    };
  }
  var event = {type: ev, time: (new Date()), args: args};
  global.App.logEvents.push(event);
  //if (global.App._events["log.message"]) {
    global.App.emit("log.message", event);
  //}
});


global.App.UserError = UserError;
