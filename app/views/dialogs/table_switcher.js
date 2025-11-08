class TableSwitcher extends DialogBase {
  constructor (handler) {
    super(handler, {
      title: "",
      dialogClass: "table-switcher-dialog"
    });

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

      const nodes = App.renderView('dialogs/table_switcher', {tables: this.filteredTables});
      this.content = this.renderWindow(this.title, nodes);

      this.searchInput = this.content.find('input.search-input');
      this.resultsList = this.content.find('ul.results-list');

      this.bindEvents();
      this.updateResults();

    } catch (error) {
      console.error(error);
      $u.alert("Could not load tables", {type: "warning"});
    }
  }

  bindEvents () {
    this.searchInput.bind('keyup', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        return;
      }
      this.filterTables();
    });

    this.searchInput.bind('keydown', (e) => {
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
        e.preventDefault();
        this.close();
      }
    });

    this.resultsList.bind('click', (e) => {
      const li = $u(e.target).closest('li')[0];
      if (li) {
        const index = Array.from(this.resultsList.find('li')).indexOf(li);
        this.selectedIndex = index;
        this.selectCurrent();
      }
    });

    this.resultsList.bind('mousemove', (e) => {
      const li = $u(e.target).closest('li')[0];
      if (li) {
        const index = Array.from(this.resultsList.find('li')).indexOf(li);
        this.selectedIndex = index;
        this.updateSelection();
      }
    });
  }

  filterTables () {
    const query = this.searchInput.val().toLowerCase();

    if (!query) {
      this.filteredTables = this.tables.slice();
    } else {
      this.filteredTables = this.tables.filter(table =>
        table.displayName.toLowerCase().includes(query) ||
        table.name.toLowerCase().includes(query)
      );

      this.filteredTables.sort((a, b) => {
        const aDisplayLower = a.displayName.toLowerCase();
        const bDisplayLower = b.displayName.toLowerCase();
        const aNameLower = a.name.toLowerCase();
        const bNameLower = b.name.toLowerCase();

        const aDisplayStarts = aDisplayLower.startsWith(query);
        const bDisplayStarts = bDisplayLower.startsWith(query);
        const aNameStarts = aNameLower.startsWith(query);
        const bNameStarts = bNameLower.startsWith(query);

        if (aDisplayStarts && !bDisplayStarts) return -1;
        if (!aDisplayStarts && bDisplayStarts) return 1;
        if (aNameStarts && !bNameStarts) return -1;
        if (!aNameStarts && bNameStarts) return 1;

        return aDisplayLower.localeCompare(bDisplayLower);
      });
    }

    this.selectedIndex = 0;
    this.updateResults();
  }

  updateResults () {
    this.resultsList.empty();

    this.filteredTables.forEach((table, index) => {
      const typeLabel = this.getTypeLabel(table.type);
      const li = $dom(['li',
        ['span.table-name', table.displayName],
        ['span.table-type', typeLabel]
      ]);

      if (index === this.selectedIndex) {
        $u(li).addClass('selected');
      }

      this.resultsList.append(li);
    });

    if (this.filteredTables.length === 0) {
      const emptyLi = $dom(['li.empty-state', 'No tables found']);
      this.resultsList.append(emptyLi);
    }
  }

  updateSelection () {
    this.resultsList.find('li').forEach((li, index) => {
      if (index === this.selectedIndex) {
        $u(li).addClass('selected');
        li.scrollIntoView({ block: 'nearest' });
      } else {
        $u(li).removeClass('selected');
      }
    });
  }

  selectNext () {
    if (this.filteredTables.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.filteredTables.length;
    this.updateSelection();
  }

  selectPrevious () {
    if (this.filteredTables.length === 0) return;
    this.selectedIndex = (this.selectedIndex - 1 + this.filteredTables.length) % this.filteredTables.length;
    this.updateSelection();
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
      "VIEW": 'View',
      "BASE TABLE": 'Table',
      "MATERIALIZED VIEW": 'Mat. View',
      "FOREIGN TABLE": "Foreign Table",
      "LOCAL TEMPORARY": "Temp",
      'SEQUENCE': 'Sequence'
    };
    return labels[type] || type;
  }
}

module.exports = TableSwitcher;
