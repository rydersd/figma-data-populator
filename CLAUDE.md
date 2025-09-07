# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Figma Data Populator is a no-bundle Figma plugin that generates tables and card grids populated with user-provided CSV/TSV/JSON data. The plugin supports Auto Layout, variable-aware styling, symbol components, images, and update-in-place functionality.

## Development Workflow

### Local Development
- Open Figma Desktop → Plugins → Development → Import plugin from manifest…
- Select `manifest.json` from this repo
- Run via Plugins → Development → Figma Data Populator
- **No build step required** - this is a no-bundle plugin using vanilla JS

### Testing Changes
- Make changes to `main.js` or `ui.html`
- Refresh plugin in Figma Desktop (close and reopen)
- Test with various CSV/TSV data formats in both Table and Card modes

## Architecture

### Core Files
- `main.js` - Plugin main thread (node creation, fonts, networking, update logic)
- `ui.html` - Plugin UI (vanilla HTML/CSS/JS, includes all styles and scripts inline)
- `manifest.json` - Figma plugin manifest v2 configuration

### Key Features
- **Table Mode**: Creates Auto Layout tables with configurable columns, typography, symbols, zebra striping
- **Card Mode**: Applies data to selected components/frames, supports image URL fills
- **Update In Place**: Re-applies data to previously generated layouts using key-diff matching
- **Variable Integration**: Automatically binds to document color variables when available
- **Symbol Columns**: Supports component variants with value mappings for status indicators

## Coding Guidelines

### JavaScript Compatibility
- **Avoid modern syntax in `main.js`** - no optional chaining, object spread, arrow functions
- Use vanilla DOM APIs in `ui.html` - no frameworks or modern JS features
- Always use `figma.loadFontAsync()` before editing text layers
- Batch node operations to reduce layout thrash

### Figma API Patterns
- Use Auto Layout for all generated structures (`layoutMode: 'HORIZONTAL'/'VERTICAL'`)
- Construct nodes off-canvas before inserting to minimize reflows
- Use `layoutGrow: 1` for "fill" columns, fixed `width` for pixel columns
- Store metadata in `node.setPluginData()` for update functionality
- Handle font loading gracefully with fallbacks (Inter, Roboto)

### Data Persistence
- User preferences: `figma.clientStorage`
- Layout metadata: `node.setPluginData()` / `node.getPluginData()`
- Include fields like schema hash, mappings, generation timestamp

## Key Functions & Utilities

### Font Management
- `ensureFonts()` - Pre-loads common fonts with fallbacks
- `loadFontSafe(family, style)` - Safe font loading with error handling

### Variable Integration
- `loadColorVariableMap()` - Caches document color variables for styling
- Variables are matched by name (case-insensitive) for automatic binding

### Image Handling
- `fetchImageHash(url)` - Downloads and creates Figma image objects from URLs
- Always provide placeholders for failed image fetches

### Symbol Components
- Support for component variants through `componentId` and property mappings
- `onlyWhenMapped` option sets opacity to 0 for unmapped values (preserves spacing)
- Component resolution via selection or stored IDs

## Common Operations

### Creating Tables
1. Parse CSV data and detect headers/delimiters
2. Create outer Auto Layout frame (vertical)
3. Generate header row with text layers
4. Create body rows as horizontal Auto Layout frames
5. Apply typography, colors, zebra striping
6. Store metadata for future updates

### Creating Cards
1. Use selected component/frame as template
2. Create instances for each data row
3. Map CSV fields to layer names (case-insensitive matching)
4. Handle image URLs by fetching and setting as fills
5. Arrange in Auto Layout grid with configurable columns/gaps

### Update In Place
1. Read existing `pluginData` to get schema and mappings
2. Compare new data structure with existing
3. Update/insert/reorder rows based on key matching
4. Preserve styling and layout configuration

## File Structure Reference

```
docs/
├── figma-data-populator-prd.md    # Complete product requirements
├── USAGE.md                        # User-facing documentation
├── CONTRIBUTING.md                 # Development guidelines
└── PUBLISHING.md                   # Publishing instructions

.cursor/
├── rules/cursor_rules.mdc         # Cursor IDE guidelines
└── mcp.json                       # Task Master AI integration

main.js                            # Plugin main thread
ui.html                           # Plugin UI (self-contained)
manifest.json                     # Figma plugin configuration
```

## Important Constraints

### Performance Limits
- Soft limits: 500 text rows, 200 cards with images
- Always provide progress indicators for large datasets
- Process in batches with `await Promise.resolve()` yields

### Security & Privacy
- All data stays within Figma document
- Only network access is for user-provided image URLs
- Handle PII sensitively in documentation and UX

### Compatibility
- Maintain runtime compatibility with older Figma Desktop versions
- Test symbol component resolution across different document states
- Graceful degradation when fonts or variables are unavailable