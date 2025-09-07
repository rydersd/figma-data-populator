# Figma Data Populator — Product Requirements Document (PRD)

## 1. Overview

Build a Figma plugin that generates tables or card grids and populates them with user-provided data. Users paste or upload structured text (CSV/TSV/JSON) into a text box, configure layout/styling, preview, and generate Auto Layout frames with properly styled text layers (and optional images). The plugin should infer headers/fields, map data to layers intelligently, and support updating previously generated layouts.

## 2. Goals

- Rapidly create data-driven tables and card collections directly in Figma.
- Reduce manual formatting by applying consistent, configurable Auto Layout and styling.
- Support common data inputs: pasted text, CSV/TSV upload, JSON.
- Provide intuitive field mapping, basic data formatting, and preview before generating.
- Enable “update in place” to refresh previously generated designs without rebuilding from scratch.

## 3. Non-Goals (Initial)

- Full live data binding/sync to external sources (Google Sheets/Airtable/API) beyond manual paste/import.
- Complex formula language, joins, or relational modeling.
- Full-blown design system manager; we integrate with existing components/variables rather than creating them.

## 4. Target Users

- Product designers needing realistic content for tables and list/card UIs.
- Design system contributors prototyping data-heavy components.
- PMs/content designers wanting quick mock data for reviews.

## 5. Key Use Cases

- Paste CSV and generate a styled table with header row, zebra striping, and proper column widths.
- Upload CSV/TSV file and create a grid of card instances, each populated with title, subtitle, description, and optional image.
- Map data fields to specific layer names on a chosen component (e.g., map `title` -> `Title` text layer).
- Update previously generated table/card grid after editing the input data or settings.

## 6. User Experience Summary

Plugin UI uses a sidebar with four primary sections: Data, Map, Layout, Style. A compact Preview panel shows a small subset (e.g., first 5 rows/cards). Actions include Generate and Update.

- Data: paste/upload text, choose format or auto-detect, set delimiter/encoding, inspect parsed fields.
- Map: select target template (table or card), map fields to layer names, set field transforms (date/number/text truncation), fallback/default values.
- Layout: choose Table or Card Grid; configure rows/columns, gaps, header, zebra striping, pagination/slicing; column width rules.
- Style: typography (font, size, weight), colors (fills, strokes), spacing, corner radius, shadows; adopt existing variables when available.

## 7. Functional Requirements

7.1 Data Input

- Accept pasted text in a multiline text box (primary path).
- Accept file upload for CSV/TSV; support drag & drop into the Data section.
- Optional JSON input (array of objects) with field inference.
- Auto-detect delimiter (comma/semicolon/tab/pipe) and headers row; allow manual override.
- Handle quoted fields, line breaks within quotes, and UTF-8 text reliably.
- Preview parsed data (first 20 rows) with column names; show total rows.

7.2 Field Mapping

- Display detected fields; allow renaming fields.
- Mapping modes:
  - Table mode: map each field to a column (header cell + body cells).
  - Card mode: map fields to layer names in a chosen component/template (freeform frame or library component instance).
- Provide auto-map by matching field names to layer names (case/space-insensitive, common synonyms).
- Show validation (unmapped fields, unmapped layers) and allow ignoring extras.

7.3 Layout Generation

- Table mode:
  - Create an outer frame with Auto Layout (vertical) for header + body.
  - Header row (optional) with text layers for each column; sticky header not required.
  - Body rows as frames with Auto Layout (horizontal) for cells.
  - Column width options: fixed px, fit to content min/max, or distribute equally.
  - Row options: min height, vertical alignment, zebra striping, row separators.
  - Pagination: allow slicing large datasets (e.g., first N rows or chunks of N).
- Card mode:
  - Choose source: selected component/frame as template or built-in default.
  - Create instances/duplicates per data row.
  - Place instances in an Auto Layout grid (wrap by rows) or multi-row layout: define columns count, row/column gaps, and max width.
  - Support images: if a field contains an image URL or base64, set as fill on a rectangle or component image placeholder.

7.4 Styling Controls

- Typography presets (font family, size, weight) per role: header, body, caption.
- Color presets for header background, zebra strip, text, borders; adopt library variables if present.
- Spacing controls: cell padding (x/y), column gap, row gap, section spacing.
- Corners and shadows for cards; stroke styles for tables.
- Optional alternating row backgrounds; hover states out of scope.

7.5 Data Formatting & Transforms

- Text: trim, ellipsis with max chars, title case/sentence case options.
- Numbers: thousands separators, decimals, currency symbol.
- Dates: parse common formats (ISO, MM/DD/YYYY, DD/MM/YYYY) and reformat via patterns.
- Booleans: map to ✓/✗, Yes/No, or hide layer when false.
- Images: fetch by URL and set fills; fallbacks when invalid.

7.6 Generate, Update, and Persistence

- Generate: create new frames/instances with data applied.
- Update in place: if a previously generated layout is selected, re-apply mapping and styling to update content without rebuilding structure (when compatible).
- Persist settings: store recent configuration (delimiter, mappings, styling) in `clientStorage`.
- Persist per-node metadata in `pluginData` (e.g., schema hash, field mappings, generation timestamp, version) to support update flows.

7.7 Error Handling & Guidance

- Show clear parse errors (bad quotes, inconsistent columns), with pointers to the problematic row.
- Warn on large datasets; offer pagination/slicing with recommended limits.
- Image fetch failures do not block generation; show count of failed images and use placeholder.
- Validate mapping for required layers; provide quick-fix suggestions.

## 8. Technical Requirements

- Figma Plugin Manifest v2.
- UI stack: TypeScript + React (or Preact) for plugin UI; minimal CSS or Tailwind (if size permits).
- Build: esbuild or Vite for bundling; single command build.
- Parsing: `papaparse`-equivalent logic (own or small lib) for CSV/TSV; robust delimiter detection. If third-party not allowed, implement a small, reliable parser with quoted field handling.
- Data persistence: `figma.clientStorage` for user prefs; `node.setPluginData`/`getPluginData` for layout metadata.
- Images: `fetch` in plugin sandbox to retrieve images; convert to bytes and set as fills on rectangles/image layers.
- Performance: chunk creation (e.g., process rows in batches of 50-100 with `await Promise.resolve()` yields), avoid layout thrash by constructing off-canvas and only then inserting.
- Accessibility: generate readable layer names; group layers logically.

## 9. Performance & Limits

- MVP soft limit: 500 rows for text-only tables, 200 cards with images; configurable but warn above limits.
- Batch operations and progress indicator with estimated time for large sets.
- Avoid heavy reflows by building rows/cards in memory, then appending to parent.

## 10. Security & Privacy

- All data stays within the Figma file/session; no external transmission unless user provides image URLs for fetch.
- Provide a toggle to not persist raw data in pluginStorage; only store schema/config.
- Handle PII sensitively; encourage redacted or sample data in UX copy.

## 11. Dependencies & Integrations

- Optional: Figma variables if document defines typography/color variables; adopt picked variables for styles.
- Optional: Support for selected component instance as template source for card mode.
- Future: Google Sheets/Airtable connectors (out of scope for MVP).

## 12. UX Flows

Primary flow (Table):
1) Open plugin → Data tab → Paste CSV → Auto-detect delimiter/headers → Preview.
2) Map tab → Confirm columns → Optional transforms.
3) Layout tab → Table → Set header on/off, zebra, column widths.
4) Style tab → Typography, colors, spacing.
5) Preview (first 5 rows) → Generate.

Primary flow (Cards):
1) Select a card component/frame or choose built-in template.
2) Data tab → Paste/Upload → Preview.
3) Map tab → Auto-map fields to layer names; fix unmatched fields.
4) Layout tab → Grid columns, gaps, max width.
5) Style tab → Card corners, shadows, typography/colors.
6) Preview → Generate.

Update flow:
1) Select previously generated table/card frame (plugin reads `pluginData`).
2) Adjust data/settings → Click Update → Apply changes in place.

## 13. Edge Cases

- Uneven rows (missing fields): use defaults or leave blank; warn if many.
- Very long text: apply ellipsis/truncation or auto-height with line clamp.
- Right-to-left text: respect document language setting where possible; basic RTL support by text alignment options.
- Mixed encodings: assume UTF-8; allow manual override if necessary (MVP can skip custom encodings).
- Huge images or broken URLs: skip with placeholder; don’t block pipeline.

## 14. Metrics & Success Criteria

- Time-to-output: median < 2 minutes for a 10-column table with 100 rows.
- Error rate: < 2% parse failures on valid CSVs; visible guidance when failures occur.
- Adoption: 30% of users return within 1 week; 3+ generations per session on average.
- Update usage: > 40% of generations followed by at least one Update.

## 15. Milestones

MVP (Weeks 1–3):
- Paste/upload CSV/TSV; auto-detect delimiter/headers; preview.
- Table generation with header, zebra, column width presets; basic typography/colors.
- Card generation from selected component or default template; grid layout.
- Basic field mapping; simple transforms (trim, number/date formatting, boolean labels).
- Generate + Update in place (same structure); clientStorage + pluginData.

V1 (Weeks 4–6):
- Image field support (URL → fills), placeholders on failure.
- Variables adoption (typography/colors) when present.
- Advanced column sizing (min/max, fit to content) and better pagination.
- Improved auto-mapping (synonyms, fuzzy match) and mapping presets.

V1.1 (Weeks 7–8):
- Preset styles/themes; export/import config.
- More robust CSV parser edge cases and performance tuning.
- Accessibility polish and naming conventions.

V2 (Later):
- External data connectors (Sheets/Airtable via manual import or authenticated fetch).
- Custom transformations (small expression editor or templating).

## 16. Open Questions

- What max row/image limits feel right for typical files? Make soft + hard caps?
- Should we add TSV/pipe delimiter presets visible by default or keep auto-only?
- What minimum support for RTL and localization is required for V1?
- Do we support per-column typographic overrides in table mode?

## 17. Acceptance Criteria (MVP)

- Users can paste CSV and generate a 5-column, 100-row table with header and zebra striping in under 2 minutes.
- Users can select a card component, map 4 fields (title, subtitle, description, image URL), and generate a 4-column grid of 50 cards.
- Update in place correctly changes content and preserves layout when schema hasn’t changed; if schema changed, provide a helpful prompt to rebuild or remap.
- No crashes; clear error messages on parse or image fetch failures.

## 18. Implementation Notes

- Use Auto Layout consistently: vertical (table sections) and horizontal (row cells).
- Construct nodes off-canvas (or hidden) to minimize reflows; append to final frame.
- Store mapping as a JSON blob (fields → layer names, transforms, types) in `pluginData` on the root frame.
- Provide a relaunch button (relaunchData) to jump back into Update mode for selected frames.

## 19. Documentation & Support

- Add in-plugin help tips for delimiter detection, mapping, and common errors.
- Include a README snippet describing usage, limits, and troubleshooting.

