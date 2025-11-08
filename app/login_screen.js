class LoginScreen {

  /*::
    type: string;
    content: JQuery<HTMLElement>;
    connections: JQuery<HTMLElement>;
    standardForm: LoginStandardForm;
    urlForm: LoginPostgresUrlForm;
    savedConnections: any; // Hash<string, SavedConn>;
    connectionName: string;
    herokuClient: HerokuClient;
    activeForm: string;
  */

  constructor (cliConnectString) {
    this.type = "login_screen";
    this.herokuClient = new HerokuClient();
    this.activeForm = 'standard';

    this.content = App.renderView('login_screen');
    this.standardForm = new LoginStandardForm(this, this.content);
    this.urlForm = new LoginPostgresUrlForm(this, this.content);
    this.connections = this.content.find('ul.connections');

    this.content.find('textarea').forEach(el => {
      $u.textareaAutoSize(el);
    });

    this.initEvents();

    this.fillSavedConnections();

    if (Object.keys(this.savedConnections).length > 0) {
      this.connectionName = Object.keys(this.savedConnections)[0];
      this.connectionSelected(this.connectionName);
    } else {
      this.fillForm({user: process.env.USER || 'user'});
    }

    if (cliConnectString) {
      this.makeConnection(cliConnectString, {});
    } else {
      this.checkAutoLogin();
    }
  }

  initEvents() {
    PaneBase.prototype.initEvents.call(this, this.content);

    this.content.find('a.go-to-help').bind('click', () => {
      var help = HelpScreen.open();
      help.activatePage("get-postgres");
    });
  }

  showPart (name) {
    this.activeForm = name;
    this.content.find('.middle-window-content').hide();
    this.content.find('.middle-window-content.' + name).show().css('display', 'block');
    this.content.find('.middle-window').attr('active-part', name);
  }

  showStandardPane () {
    this.content.find('.header-tabs a').removeClass('selected');
    this.content.find('.header-tabs .login-with-password').addClass('selected');
    this.showPart('standard');
  }

  showHerokuPane () {
    this.content.find('.header-tabs a').removeClass('selected');
    this.content.find('.header-tabs .login-with-heroku').addClass('selected');
    this.showPart('heroku-1');
  }

  showUrlPane () {
    this.content.find('.header-tabs a').removeClass('selected');
    this.content.find('.header-tabs .enter-postgres-url').addClass('selected');
    this.showPart('postgres-url');
  }

  showHerokuOAuthPane () {
    this.showPart('heroku-oauth');
  }

  showExtraLogingFields () {
    this.content.find('.middle-window').toggleClass('extra-login-fields-open');
  }

  startHerokuOAuth () {
    this.showHerokuOAuthPane();
    var steps = this.content.find('.heroku-oauth ul.steps');
    var options = {
      onAccessTokenStart:  () => { steps.find('.access-token').addClass('started'); },
      onAccessTokenDone:   () => { steps.find('.access-token').addClass('done'); },
      onRequestTokenStart: () => { steps.find('.request-token').addClass('started'); },
      onRequestTokenDone:  () => { steps.find('.request-token').addClass('done'); },
      onGetAppsStarted:    () => { steps.find('.get-apps').addClass('started'); },
      onGetAppsDone:       () => { steps.find('.get-apps').addClass('done'); }
    };

    var appsList = this.content.find('ul.apps').html('');
    this.herokuClient.authAndGetApps(apps => {
      apps.forEach((app) => {
        var appEl = $dom(['li', ['span', app.name], ['button', 'Connect'], {'app-name': app.name}]);
        appsList.append(appEl);
        $u(appEl).find('button').bind('click', (event) => {
          event.preventDefault();
          this.connectToHeroku(app);
        });
      });
    }, options);
  }

  connectToHeroku (heroku_app) {
    App.startLoading("Fetching config...");
    this.herokuClient.getDatabaseUrl(heroku_app.id, (db_url) => {
      if (!db_url) {
        window.alertify.alert("Seems like app <b>" + heroku_app.name + "</b> don't have database");
        App.stopLoading();
        return;
      }
      db_url = db_url + "?ssl=require&rejectUnauthorized=false";
      console.log('connecting to', db_url);
      this.makeConnection(db_url, {fetchDbList: false, name: heroku_app.name}, (tab) => {
        if (tab) {
          tab.instance.switchToHerokuMode(heroku_app.name, db_url);
        }
        console.log('connected to heroku');
      });
    });
  }

  fillSavedConnections () {
    this.connections.empty();
    this.savedConnections = Model.SavedConn.savedConnections();

    ObjectKit.forEach(this.savedConnections, (name, params) => {
      const connectionKey = this.getConnectionKey(params);
      const color = App.getConnectionColor(connectionKey);

      var line = $dom(['li', {'data-auto-connect': params.auto_connect, 'data-name': name},
        ['span.connection-color-dot', {'data-connection-key': connectionKey, 'style': `background-color: ${color}`}],
        ['span.connection-name', name]
      ]);

      var colorDot = $u(line).find('.connection-color-dot')[0];

      $u(colorDot).bind('click', (e) => {
        e.stopPropagation();
        this.changeConnectionColor(name, params, connectionKey);
      });

      $u.contextMenu(line, {
        "Fill form with ...": () => { this.fillForm(params) },
        "Connect" () {
          this.fillForm(params);
          this.submitCurrentForm();
        },
        'separator': 'separator',
        "Change Color": () => {
          this.changeConnectionColor(name, params, connectionKey);
        },
        "Rename": () => {
          this.renameConnection(name);
        },
        "Delete": () => {
          this.deleteConnection(name);
        }
      });

      $u(line).single_double_click_nowait((e) => {
        if (!$u(e.target).hasClass('connection-color-dot')) {
          this.connectionSelected(name);
        }
      }, (e) => {
        if (!$u(e.target).hasClass('connection-color-dot')) {
          this.connectionSelected(name);
          this.submitCurrentForm();
        }
      });

      this.connections.append(line)
    });
  }

  getConnectionKey(params) {
    if (params.type === 'url') {
      const urlMatch = params.url ? params.url.match(/\/\/([^\/]+)/) : null;
      return urlMatch ? urlMatch[1] : 'unknown';
    } else {
      return `${params.host || 'localhost'}:${params.port || '5432'}/${params.database || 'postgres'}`;
    }
  }

  changeConnectionColor(name, params, connectionKey) {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
      '#FF9FF3', '#54A0FF', '#FF6348', '#1DD1A1', '#FFC312'
    ];

    const currentColor = App.getConnectionColor(connectionKey);

    let colorOptionsHtml = '';
    colors.forEach(color => {
      const selected = color === currentColor ? 'selected' : '';
      colorOptionsHtml += `<div class="color-option ${selected}" data-color="${color}" style="background-color: ${color}"></div>`;
    });

    const dialogHtml = `
      <div class="color-picker-dialog">
        <p>Choose a color for this connection:</p>
        <div class="color-grid">
          ${colorOptionsHtml}
        </div>
      </div>
    `;

    window.alertify.alert(dialogHtml);

    setTimeout(() => {
      const alertifyContent = document.querySelector('.alertify');
      if (!alertifyContent) return;

      alertifyContent.querySelectorAll('.color-option').forEach(option => {
        option.addEventListener('click', () => {
          const newColor = option.getAttribute('data-color');

          const colorMap = JSON.parse(window.localStorage.connectionColors || '{}');
          colorMap[connectionKey] = newColor;
          window.localStorage.connectionColors = JSON.stringify(colorMap);

          this.connections.find(`[data-name='${name}'] .connection-color-dot`).css('background-color', newColor);

          App.tabs.forEach(tab => {
            if (tab.instance && tab.instance.type === 'db_screen' && tab.instance.connectionColor) {
              const tabConnectionKey = this.getConnectionKey(tab.instance.connection.options);
              if (tabConnectionKey === connectionKey) {
                tab.instance.connectionColor = newColor;
                tab.colorDotElement.css('background-color', newColor);
              }
            }
          });

          window.alertify.hide();
        });
      });
    }, 100);
  }

  connectionSelected (name) {
    var params = this.savedConnections[name];
    var line = this.connections.find(`[data-name='${name}']`);

    this.connections.find('.selected').removeClass('selected');
    $u(line).addClass('selected');
    this.connectionName = name;
    this.fillForm(params);
    if (params.type == 'url') {
      this.showUrlPane();
      this.urlForm.setButtonShown(false);
    } else {
      this.showStandardPane();
      this.standardForm.setButtonShown(false);
    }
    //this.setButtonShown(false);
  }

  std_testConnection () {
    this.standardForm.testConnection();
  }

  url_testConnection () {
    this.urlForm.testConnection();
  }

  addNewConnection () {
    this.connections.find('.selected').removeClass('selected');
    this.connectionName = "**new**";
    this.fillForm({host: "localhost", user: "", password: "", database: "", port: ""});
    this.standardForm.form.find('[name=host]').focus();
    this.standardForm.setButtonShown(true);
    this.urlForm.setButtonShown(true);
    var data = {
      type: 'url',
      url: null,
      auto_connect: false
    };
    Model.SavedConn.saveConnection('**new**', data);
    this.fillSavedConnections();
  }

  fillForm (params) {
    if (params.type == "url") {
      this.urlForm.fillForm(params);
      this.standardForm.fillForm({});
      this.activeForm = 'postgres-url';
    } else {
      this.standardForm.fillForm(params);
      this.urlForm.fillForm({});
      this.activeForm = 'standard';
    }
  }

  submitCurrentForm() {
    if (this.activeForm == 'standard') {
      this.standardForm.onFormSubmit();
    } else {
      this.urlForm.onFormSubmit();
    }
  }

  async renameConnection (name, filledValue = null) {
    var newName = await $u.prompt("Rename connection?", filledValue || name);
    if (newName) {
      if (Model.SavedConn.hasConnection(newName)) {
        await $u.alert(`Connection '${newName}' already exists`, {detail: "Choose another connection name"})
        this.renameConnection(name, newName);
      } else {
        Model.SavedConn.renameConnection(name, newName);
        this.fillSavedConnections();
      }
    }
  }

  deleteConnection (name) {
    window.alertify.labels.ok = "Remove";
    window.alertify.confirm("Remove connection " + name + "?", (res) => {
      window.alertify.labels.ok = "OK";
      if (res) {
        Model.SavedConn.removeConnection(name);
        this.fillSavedConnections();
      }
    });
  }

  std_saveAndConnect (e) {
    $u.stopEvent(e);
    this.standardForm.saveAndConnect();
  }

  url_saveAndConnect (e) {
    $u.stopEvent(e);
    this.urlForm.saveAndConnect();
  }

  makeConnection (connectionOptions, options, callback /*:: ?: Function */) {
    App.openConnection(connectionOptions, options.name || this.connectionName, callback);
  }

  checkAutoLogin () {
    var autoConnect = null;
    ObjectKit.forEach(this.savedConnections, (key, connection) => {
      if (!autoConnect && connection.auto_connect) {
        autoConnect = key;
      }
    });

    if (autoConnect) {
      var connection = this.savedConnections[autoConnect];
      console.log("Connecting to auto-connect saved connection: " + autoConnect, connection);
      App.startLoading("Connecting...", 500, {
        cancel() {
          App.stopRunningQuery();
          App.stopLoading();
        }
      });
      this.connectionSelected(autoConnect);
      this.submitCurrentForm();
    }
  }

  isNewConnection () {
    return this.connectionName == "**new**";
  }

  sameAsCurrent (formData) {
    return Model.SavedConn.isEqualWithSaved(this.connectionName, formData);
  }
}

global.LoginScreen = LoginScreen;
