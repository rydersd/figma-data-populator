# Contributing to Figma Data Populator

Thanks for your interest in contributing! This plugin helps designers quickly generate tables and cards from CSV/TSV/JSON, with optional variable-aware styling, symbols, images, and update‑in‑place.

## Features Overview

- Paste/import CSV/TSV or drag & drop files
- Table mode
  - Table Setup: define columns (text/symbol), widths, px or fill, and error‑only behavior
  - Typography controls for header/body (family, style, size)
  - Symbol columns: per‑column component capture, variant property, value mappings, “only show when mapped”
  - Target width with overage warning; supports horizontally scrolling layouts
  - Update In Place with optional key‑diff matching (by a chosen or inferred key)
- Cards mode
  - Applies CSV rows to selected card(s), preserving fonts/styles
  - Presets: Metric (Metric, Label) and Active Work (Name, Description)
  - Optional image URL → layer fills
- Variable‑aware colors (binds to document color variables if present)
- Schema export to share with teammates/LLMs

## Repo Structure

- `manifest.json` – Figma manifest (v2)
- `main.js` – Plugin main thread (node creation, fonts, networking, update logic)
- `ui.html` – Plugin UI (vanilla JS + HTML)
- `docs/figma-data-populator-prd.md` – Product requirements
- `docs/CONTRIBUTING.md` – This guide

## Local Development

1. Open Figma Desktop → Plugins → Development → Import plugin from manifest…
2. Select `manifest.json` from this repo.
3. Run via Plugins → Development → Figma Data Populator.

No build step is required (no‑bundle plugin).

## How to Contribute

1. Pick an area (bugs, UI/UX, features) and open an issue to discuss scope.
2. Keep changes small and focused; follow existing coding style (vanilla JS, no modern syntax requiring bundling).
3. Validate in Figma Desktop; share screenshots or short videos where helpful.

### Coding Guidelines

- Avoid optional chaining and object spread in `main.js` for runtime compatibility.
- Keep UI scripts within `ui.html` concise; prefer simple DOM APIs.
- Use `figma.loadFontAsync` before editing text layers; preserve existing fonts/styles.
- Batch node edits to reduce layout thrash; construct off‑canvas where possible.
- Prefer Auto Layout for rows/columns; use `layoutGrow` for “fill” columns.

### Adding a Symbol Column Behavior

1. Add inputs in Table Setup (Column Setup row) for component, property, and mappings.
2. Ensure `serializeColSetup()` includes: `{ name, type:'symbol', width, mode, componentId, prop, mappings, onlyWhenMapped, onlyError }`.
3. In `main.js`, combine symbol configs from `options.symbols` and `options.columnSetup`.
4. Resolve components via `componentId` or fallback to current selection.
5. When `onlyWhenMapped` is true and value is unmapped, set instance `opacity = 0` to preserve spacing.

### Update In Place (Key‑Diff)

- Rows store `dp_row_key`. During update, match by key, update/insert/reorder, and optionally keep unmatched rows.
- Add/extend UI flags like “Keep unmatched rows on Update In Place”.

## Roadmap Ideas

- Sticky header, column alignments, vertical dividers
- Per‑column text alignment and number/date formatting
- Google Sheets/Airtable on‑demand import (manual)
- Richer schema export (types + docs), “prompt CSV” for LLMs
- Tests for parser and narrow utilities

## Community

If you publish a fork or add templates/components that others can use, please share! PRs with presets (e.g., indicator components, dummy sparklines) are welcome.

Thanks again for helping improve the plugin.

