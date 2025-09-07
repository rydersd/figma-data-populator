# Publishing Figma Data Populator

This guide helps you publish the plugin to Figma Community.

## Manifest settings

- `name`: Choose your final public name.
- `editorType`: `["figma"]` (validated for Figma; FigJam optional).
- `networkAccess.allowedDomains`: Limit to hosts you actually fetch images from (default includes `gravatar.com` and `s3-alpha.figma.com`). Add more if your data uses other hosts.
- Keep `id` stable after first publish.

## Assets

- Icon: `assets/icon.svg` (export PNG 128×128 for upload)
- Cover: `assets/cover.svg` (export PNG 1920×960)
- 2–5 screenshots or GIFs showing:
  - Table Setup (columns, typography, symbols)
  - Import CSV/drag‑drop and preview
  - Key‑diff Update In Place
  - Cards with symbol-by-layer mapping

## Listing copy (draft)

Title: Figma Data Populator

Short: Generate tables and cards from CSV/TSV — with symbols, per‑column widths, typography, and update‑in‑place.

Details:
- Paste or import CSV/TSV, or drag‑and‑drop files
- Table Setup: define columns, widths (px/fill), alignment, and symbol components per column
- Typography controls for header/body (family, style, size)
- Symbols: map CSV values to component variants; error‑only and only‑when‑mapped options
- Sticky‑like header (scrollable body), zebra rows
- Update In Place with key‑diff (update/add/reorder; optional keep unmatched)
- Cards: apply text to selected cards and set symbols by layer name; image field fills supported
- Variable‑aware color binding (header/body)
- Export schema CSV for teams/LLMs

Permissions:
- Reads and writes nodes; stores minimal pluginData for updates; uses clientStorage for preferences; optional network fetch for user‑provided image URLs

Privacy:
- Data stays local in your file. The plugin only fetches images you provide via URL to set fills.

## Submission

1) Figma Desktop → Plugins → Development → Manage plugins → your plugin → Publish to Community.
2) Upload icon + cover, add screenshots, paste listing copy.
3) Submit for review.

## Tips

- Validate on a clean file with typical CSVs.
- Restrict network domains to speed approval.
- Include a link to docs/USAGE.md in your listing.

