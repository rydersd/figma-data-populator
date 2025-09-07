# Figma Data Populator — Usage Guide

This plugin generates tables and card content from CSV/TSV text or files. It supports typography controls, per‑column sizing, symbol components, update‑in‑place, schema export, and more.

## Install & Run

- Figma Desktop → Plugins → Development → Import plugin from manifest…
- Select `manifest.json` from this repo
- Run via Plugins → Development → Figma Data Populator

## Data Input

- Paste CSV/TSV into the text area
- Or use Import CSV/TSV (file picker) or drag‑and‑drop onto the text area
- Toggle “First row is header” if needed

## Modes

- Cards
  - Select one or more card frames/components/instances
  - Paste/import CSV; choose Card Type (Custom/Metric/Active Work)
  - Generate: text is applied to matching layer names on each selected card
  - Optional: map an Image URL field to an image layer name

- Table
  - Table options: header row, zebra striping, scrollable body (fixed header)
  - Table Setup: set target width, define columns, typography, symbols
  - Generate: creates a table with your column order, widths, and per‑column behavior
  - Update In Place: select a previously generated table and update using the new CSV

## Table Setup

- Columns
  - Add/Remove rows
  - Name: must match a CSV header
  - Type: Text or Symbol
  - Width & Mode: px (fixed) or fill (Auto Layout grow)
  - Align: Left/Center/Right
  - Only on error (Text/Symbol): hides indicator unless the value looks like an error
- Symbol details (shown when Type = Symbol)
  - Variant property: the component variant property to set (e.g., `State`)
  - Mappings: semicolon‑separated, e.g. `success=Success;warning=Warning;error=Error`
  - Only show when mapped: hide symbol when value is not mapped (spacing preserved)
  - Error‑only preset: sets common error mappings and hides otherwise
  - Use current selection: capture the selected component/variant for this column

- Target Width & Warning
  - Shows a warning if total fixed widths exceed the target (table will scroll)

- Typography
  - Header/Body family, style, and size
  - The plugin attempts to load fonts safely before updating text

- Key Column
  - Choose a unique key column (or it will be inferred)
  - Used for naming rows and for key‑diff Update In Place

## Update In Place (Tables)

- Select a previously generated table frame
- Paste/import new CSV
- Click Update In Place
- With a Key set:
  - Rows are updated, inserted, and reordered by key
  - Option “Keep unmatched rows” preserves rows not present in the new data

## Schema Export

- Click Export Schema to generate a CSV describing your columns
- Includes hints for symbol columns (mapped values)
- Copy to clipboard or download as `schema.csv`

## Best Practices

- Keep column names stable across updates (especially keys)
- For symbol columns, capture a dedicated component for each column
- Use fill mode for flexible columns; keep fixed columns within target width
- Use Update In Place (with key) for predictable diffs

## Troubleshooting

- Runtime syntax errors: the plugin avoids modern syntax in `main.js`; if you still see a syntax error, share the exact line and we’ll patch
- Fonts: if a template uses unavailable fonts, the plugin falls back to Inter/Roboto to avoid errors when editing text
- Images: image fields fetch in the main context; some hosts may still block or fail — a placeholder is used

## Contributing

See `docs/CONTRIBUTING.md` for how to develop and propose changes.

