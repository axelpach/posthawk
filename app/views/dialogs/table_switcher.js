class TableSwitcher {
  constructor (handler) {
    this.handler = handler;

    if (!handler || !handler.connection || !handler.database) {
      $u.alert("Please select a database first", {type: "info"});
      return;
    }

    this.tables = [];
    this.filteredTables = [];
    this.selectedIndex = 0;
    this.showWindow();
  }

  async showWindow () {
    try {
      const data = await this.handler.connection.tablesAndSchemas();

      this.tables = [];
      Object.keys(data).forEach((schema) => {
        data[schema].forEach((table) => {
          this.tables.push({
            schema: schema,
            name: table.table_name,
            type: table.table_type,
            displayName: schema === 'public' ? table.table_name : `${schema}.${table.table_name}`
          });
        });
      });

      this.tables.sort((a, b) => a.displayName.localeCompare(b.displayName));
      this.filteredTables = this.tables.slice();

      this.render();
      this.bindEvents();
      this.updateResults();

    } catch (error) {
      console.error(error);
      $u.alert("Could not load tables", {type: "warning"});
    }
  }

  render() {
    const backdrop = document.createElement('div');
    backdrop.className = 'table-switcher-backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'table-switcher-dialog-custom';
    dialog.innerHTML = `
      <div class="search-container">
        <input type="text" class="search-input" placeholder="Search tables..." autofocus>
      </div>
      <ul class="results-list"></ul>
    `;

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    this.backdrop = backdrop;
    this.dialog = dialog;
    this.searchInput = dialog.querySelector('.search-input');
    this.resultsList = dialog.querySelector('.results-list');

    setTimeout(() => this.searchInput.focus(), 0);
  }

  close() {
    if (this.backdrop && this.backdrop.parentNode) {
      this.backdrop.parentNode.removeChild(this.backdrop);
    }
  }

  bindEvents () {
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) {
        this.close();
      }
    });

    this.searchInput.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        return;
      }
      this.filterTables();
    });

    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectPrevious();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.selectCurrent();
      } else if (e.key === 'Escape') {
        this.close();
      }
    });

    this.resultsList.addEventListener('click', (e) => {
      const li = e.target.closest('li');
      if (li && li.dataset.index !== undefined) {
        this.selectedIndex = parseInt(li.dataset.index);
        this.selectCurrent();
      }
    });
  }

  filterTables () {
    const query = this.searchInput.value.toLowerCase().trim();

    if (!query) {
      this.filteredTables = this.tables.slice();
    } else {
      this.filteredTables = this.tables.filter(table => {
        const startsWithQuery = table.displayName.toLowerCase().startsWith(query);
        const containsQuery = table.displayName.toLowerCase().includes(query);
        return startsWithQuery || containsQuery;
      }).sort((a, b) => {
        const aStarts = a.displayName.toLowerCase().startsWith(query);
        const bStarts = b.displayName.toLowerCase().startsWith(query);

        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        return a.displayName.localeCompare(b.displayName);
      });
    }

    this.selectedIndex = 0;
    this.updateResults();
  }

  updateResults () {
    this.resultsList.innerHTML = '';

    if (this.filteredTables.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'empty-state';
      emptyLi.textContent = 'No tables found';
      this.resultsList.appendChild(emptyLi);
      return;
    }

    this.filteredTables.forEach((table, index) => {
      const li = document.createElement('li');
      li.dataset.index = index;

      if (index === this.selectedIndex) {
        li.classList.add('selected');
      }

      const nameSpan = document.createElement('span');
      nameSpan.className = 'table-name';
      nameSpan.textContent = table.displayName;

      const typeSpan = document.createElement('span');
      typeSpan.className = 'table-type';
      typeSpan.textContent = this.getTypeLabel(table.type);

      li.appendChild(nameSpan);
      li.appendChild(typeSpan);

      this.resultsList.appendChild(li);
    });

    const selectedItem = this.resultsList.querySelector('li.selected');
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  selectNext () {
    if (this.filteredTables.length === 0) return;

    this.selectedIndex = (this.selectedIndex + 1) % this.filteredTables.length;
    this.updateResults();
  }

  selectPrevious () {
    if (this.filteredTables.length === 0) return;

    this.selectedIndex = this.selectedIndex - 1;
    if (this.selectedIndex < 0) {
      this.selectedIndex = this.filteredTables.length - 1;
    }
    this.updateResults();
  }

  selectCurrent () {
    if (this.filteredTables.length === 0) return;

    const selectedTable = this.filteredTables[this.selectedIndex];
    if (selectedTable) {
      this.handler.tableSelected(selectedTable.schema, selectedTable.name);
      this.close();
    }
  }

  getTypeLabel (type) {
    const labels = {
      'BASE TABLE': 'table',
      'VIEW': 'view',
      'MATERIALIZED VIEW': 'mat view',
      'FOREIGN TABLE': 'foreign',
      'SEQUENCE': 'sequence'
    };
    return labels[type] || type.toLowerCase();
  }
}

module.exports = TableSwitcher;
