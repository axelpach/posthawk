# PostHawk 🦅

A keyboard-first PostgreSQL GUI client, forked from [Postbird](https://github.com/Paxa/postbird) with enhanced keyboard navigation and shortcuts.

PostHawk is a cross-platform PostgreSQL GUI client, written in JavaScript, runs with Electron.

## What's Different from Postbird?

PostHawk enhances the original Postbird with powerful keyboard-first workflows:

- ⌨️ **Tab Navigation**: Switch between database tabs with `Cmd+1` through `Cmd+9`
- 🔍 **Quick Table Switcher**: Press `Cmd+T` to search and switch between tables instantly
- 🆕 **Duplicate Connection**: `Cmd+N` opens a new tab with the same database connection
- 📊 **Table Navigation**: Navigate between tables with `Cmd+Shift+Up/Down`
- 🎨 **Color-Coded Connections**: Each database connection gets a unique color for easy identification
- 📋 **Quick Copy**: Double-click any cell to copy its content to clipboard
- 🎯 **Smart Defaults**: Content tab auto-selected, search parameter focused when opening tables
- ⚡ **All shortcuts work even when inputs are focused** - truly keyboard-first

## Development

To run the project:

```sh
git clone git@github.com:axelpach/posthawk.git
cd posthawk
yarn
yarn start
```

Build package:
```sh
yarn dist
ls ./dist
```

## Keyboard Shortcuts

- `Cmd+1` to `Cmd+9` - Switch between tabs
- `Cmd+T` - Open table switcher modal
- `Cmd+N` - Duplicate current database connection in new tab
- `Cmd+Shift+Up/Down` - Navigate between tables in sidebar
- `Cmd+Shift+Left/Right` - Navigate between tabs (with wraparound)
- Double-click cell - Copy cell content to clipboard

## Original Project

PostHawk is based on [Postbird](https://github.com/Paxa/postbird) by Pavel Evstigneev.

Original Postbird is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## License

MIT License - see [LICENSE](LICENSE) file for details.

Original work Copyright (c) 2013-2017 Pavel Evstigneev
Modified work Copyright (c) 2025 Axel Pacheco Tellez
