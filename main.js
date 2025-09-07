// Figma Data Populator — main

// Simple helpers
async function ensureFonts() {
  // Attempt to load common fonts; fall back silently if missing
  const fonts = [
    { family: "Roboto", style: "Regular" },
    { family: "Roboto", style: "Medium" },
    { family: "Inter", style: "Regular" },
    { family: "Inter", style: "Medium" }
  ];
  for (const f of fonts) {
    try { await figma.loadFontAsync(f); } catch (e) {}
  }
}

function solid(r, g, b, opacity = 1) {
  return { type: 'SOLID', color: { r, g, b }, opacity };
}

async function loadFontSafe(family, style) {
  try { if (family && style) { await figma.loadFontAsync({ family, style }); return true; } } catch (_) {}
  return false;
}

// Variable helpers
let _varCache = null;
async function loadColorVariableMap() {
  if (_varCache) return _varCache;
  try {
    if (!('variables' in figma) || !figma.variables.getLocalVariablesAsync) return (_varCache = {});
    const vars = await figma.variables.getLocalVariablesAsync();
    const map = {};
    for (const v of vars) {
      if (v.resolvedType === 'COLOR') {
        map[v.name.toLowerCase()] = v;
      }
    }
    _varCache = map;
    return map;
  } catch (_) { return (_varCache = {}); }
}

async function fetchImageHash(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const img = figma.createImage(bytes);
    return img.hash;
  } catch (_) {
    return null;
  }
}

async function bindPaintToColorVar(paint, varName) {
  if (!varName) return paint;
  const map = await loadColorVariableMap();
  const v = map[varName.toLowerCase()];
  if (!v) return paint;
  try {
    const p = Object.assign({}, paint);
    p.boundVariables = { color: v.id };
    return p;
  } catch (_) {
    return paint;
  }
}

async function ensureFontsForTextNode(textNode) {
  try {
    const fontName = textNode.fontName;
    if (fontName === figma.mixed) {
      const len = textNode.characters.length;
      const seen = {};
      for (let i = 0; i < len; i++) {
        const rfn = textNode.getRangeFontName(i, i + 1);
        if (rfn !== figma.mixed) {
          const key = rfn.family + '|' + rfn.style;
          if (!seen[key]) { await figma.loadFontAsync(rfn); seen[key] = true; }
        }
      }
    } else if (fontName && fontName.family && fontName.style) {
      await figma.loadFontAsync(fontName);
    }
    return true;
  } catch (_) { return false; }
}

async function setTextCharacters(node, value) {
  const ok = await ensureFontsForTextNode(node);
  if (!ok) {
    try {
      await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
      node.fontName = { family: 'Inter', style: 'Regular' };
    } catch (e) {
      try {
        await figma.loadFontAsync({ family: 'Roboto', style: 'Regular' });
        node.fontName = { family: 'Roboto', style: 'Regular' };
      } catch (_) {}
    }
  }
  node.characters = (value === undefined || value === null) ? '' : String(value);
}

function createTextNode(text, opts = {}) {
  const t = figma.createText();
  if (opts.fontName) t.fontName = opts.fontName;
  if (opts.fontSize) t.fontSize = opts.fontSize;
  if (opts.fills) t.fills = opts.fills;
  t.characters = (text === undefined || text === null) ? '' : String(text);
  try { t.textAutoResize = 'HEIGHT'; } catch(_) {}
  return t;
}

function setAutoLayout(frame, direction, spacing = 8, padding = 8) {
  frame.layoutMode = direction; // 'HORIZONTAL' | 'VERTICAL'
  frame.itemSpacing = spacing;
  frame.paddingLeft = frame.paddingRight = frame.paddingTop = frame.paddingBottom = padding;
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'AUTO';
  try { frame.counterAxisAlignItems = 'MIN'; } catch(_) {}
}

function setBackground(frame, paintArray) {
  try { frame.fills = paintArray; } catch (_) {}
}

function applyColumnWidth(cell, cfg) {
  try {
    const width = parseInt(cfg.width || 160, 10) || 160;
    const height = cell.height > 0 ? cell.height : 10;
    const hasNewSizing = ('layoutSizingHorizontal' in cell);

    if (cfg.mode === 'fill') {
      // Fill available space within a horizontal row
      try { cell.layoutGrow = 1; } catch(_) {}
      if (hasNewSizing) {
        try { cell.layoutSizingHorizontal = 'FILL'; } catch(_) {}
      } else {
        // In older API, for a vertical auto‑layout cell, width is on counter axis
        try { cell.counterAxisSizingMode = 'AUTO'; } catch(_) {}
      }
      // Height should continue to hug content unless explicitly set elsewhere
      try { cell.primaryAxisSizingMode = 'AUTO'; } catch(_) {}
    } else {
      // Fixed pixel width
      try { cell.layoutGrow = 0; } catch(_) {}
      if (hasNewSizing) {
        try { cell.layoutSizingHorizontal = 'FIXED'; } catch(_) {}
      } else {
        try { cell.counterAxisSizingMode = 'FIXED'; } catch(_) {}
      }
      try { cell.resizeWithoutConstraints(width, height); } catch(_) {}
    }
  } catch (_) {}
}

function createSparklineFromCell(value, width, height, delimiter) {
  try {
    if (!value) return null;
    const parts = String(value).split(delimiter || ',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    if (parts.length < 2) return null;
    const w = width || 80, h = height || 24;
    const min = Math.min.apply(null, parts);
    const max = Math.max.apply(null, parts);
    const range = (max - min) || 1;
    const step = w / (parts.length - 1);
    let d = '';
    for (let i = 0; i < parts.length; i++) {
      const x = Math.round(i * step);
      const y = Math.round(h - ((parts[i] - min) / range) * h);
      d += (i === 0 ? 'M ' : ' L ') + x + ' ' + y;
    }
    const vec = figma.createVector();
    vec.vectorPaths = [{ windingRule: 'NONZERO', data: d }];
    vec.strokes = [solid(0.12,0.57,1.0,1)];
    vec.strokeWeight = 2;
    const frame = figma.createFrame();
    frame.resizeWithoutConstraints(w, h);
    frame.clipsContent = true;
    frame.appendChild(vec);
    vec.x = 0; vec.y = 0;
    return frame;
  } catch (_) { return null; }
}

// Build Table
async function buildTable({ headers, rows, options }) {
  await ensureFonts();
  const {
    header = true,
    zebra = true,
    rowGap = 2,
    columnGap = 16,
    cellPadding = 8,
    headerBg = { r: 0.95, g: 0.96, b: 0.98 },
    zebraBg = { r: 0.98, g: 0.98, b: 0.98 },
    textColor = { r: 0.12, g: 0.12, b: 0.14 },
    headerTextColor = { r: 0.12, g: 0.12, b: 0.18 },
    fontFamily = "Roboto"
  } = options || {};

  const root = figma.createFrame();
  root.name = 'Table';
  setAutoLayout(root, 'VERTICAL', rowGap, 0);
  try { root.fills = []; } catch(_) {}
  const typo = (options && options.typography) ? options.typography : {};
  const headerFamily = typo.headerFamily || fontFamily;
  const headerStyle = typo.headerStyle || 'Medium';
  const headerSize = typo.headerSize || 12;
  const bodyFamily = typo.bodyFamily || fontFamily;
  const bodyStyle = typo.bodyStyle || 'Regular';
  const bodySize = typo.bodySize || 12;
  // Load fonts safely (avoid top-level await issues elsewhere)
  await loadFontSafe(headerFamily, headerStyle);
  await loadFontSafe(bodyFamily, bodyStyle);

  // Columns to render
  let cols = (headers && headers.length) ? headers.slice() : [];
  const colSetup = (options && options.columnSetup && options.columnSetup.length) ? options.columnSetup : null;
  if (colSetup) {
    const names = colSetup.map(c => c.name).filter(Boolean);
    cols = names.filter(n => headers.indexOf(n) >= 0);
  } else if (options && options.columnsCount && options.columnsCount > 0) {
    cols = cols.slice(0, options.columnsCount);
  }
  // Symbol columns setup (from symbols and columnSetup)
  const symbolConfigs = [];
  if (options && Array.isArray(options.symbols)) {
    for (const s of options.symbols) {
      const idx = headers ? headers.findIndex(h => String(h).toLowerCase() === String(s.column || '').toLowerCase()) : -1;
      if (idx >= 0) symbolConfigs.push(Object.assign({ index: idx }, s));
    }
  }
  if (colSetup) {
    for (let i = 0; i < colSetup.length; i++) {
      const c = colSetup[i];
      if (c && c.type === 'symbol') {
        const idx = headers ? headers.findIndex(h => String(h) === String(c.name)) : -1;
        if (idx >= 0) {
          const cfg = { index: idx, type: 'variant', column: c.name, prop: c.prop || 'State', mappings: c.mappings || null, onlyWhenMapped: !!c.onlyWhenMapped, componentId: c.componentId || null };
          symbolConfigs.push(cfg);
        }
      }
    }
  }

  // Resolve components per symbol (per-column capture)
  const symbolComponents = {};
  for (const s of symbolConfigs) {
    let comp = null;
    if (s.componentId) {
      const node = figma.getNodeById(s.componentId);
      if (node && node.type === 'COMPONENT') comp = node;
      if (node && node.type === 'INSTANCE' && node.mainComponent) comp = node.mainComponent;
    }
    if (!comp) comp = getSelectedComponentLike();
    symbolComponents[s.column] = comp;
  }

  // Header
  if (header && cols && cols.length) {
    const head = figma.createFrame();
    head.name = 'Header';
    setAutoLayout(head, 'HORIZONTAL', columnGap, cellPadding);
    {
      let paint = solid(headerBg.r, headerBg.g, headerBg.b, 1);
      if (options && options.variables && options.variables.headerBg) {
        paint = await bindPaintToColorVar(paint, options.variables.headerBg);
      }
      setBackground(head, [paint]);
    }
    for (const h of cols) {
      const cell = figma.createFrame();
      setAutoLayout(cell, 'VERTICAL', 0, 0);
      cell.name = `${h}.f`;
      try { cell.fills = []; } catch(_) {}
      const headerFill = await bindPaintToColorVar(
        solid(headerTextColor.r, headerTextColor.g, headerTextColor.b, 1),
        options && options.variables ? options.variables.headerText : null
      );
      const t = createTextNode(String(h), {
        fontSize: headerSize,
        fills: [headerFill],
        fontName: { family: headerFamily, style: headerStyle }
      });
      try { t.layoutGrow = 1; } catch(_) {}
      // Alignment per column
      if (colSetup) {
        const c = colSetup.find(x => x.name === h);
        if (c && c.align) { try { t.textAlignHorizontal = c.align; } catch (_) {} }
      }
      cell.appendChild(t);
      // Apply width from setup
      if (colSetup) {
        const c = colSetup.find(x => x.name === h);
        if (c) applyColumnWidth(cell, c);
      }
      head.appendChild(cell);
    }
    root.appendChild(head);
  }

  // Body
  const body = figma.createFrame();
  body.name = 'Body';
  setAutoLayout(body, 'VERTICAL', rowGap, 0);
  try { body.fills = []; } catch(_) {}
  for (let i = 0; i < rows.length; i++) {
    const row = figma.createFrame();
    const rowKey = (options && options.keyColumn) ? rows[i][options.keyColumn] : null;
    row.name = rowKey ? `Row ${i + 1} — ${String(rowKey)}` : `Row ${i + 1}`;
    if (rowKey != null) { try { row.setPluginData('dp_row_key', String(rowKey)); } catch (_) {} }
    setAutoLayout(row, 'HORIZONTAL', columnGap, cellPadding);
    if (zebra && i % 2 === 1) setBackground(row, [solid(zebraBg.r, zebraBg.g, zebraBg.b, 1)]); else { try { row.fills = []; } catch(_) {} }
    const values = cols && cols.length ? cols.map(h => rows[i][h]) : Object.values(rows[i]);
    for (let cIndex = 0; cIndex < values.length; cIndex++) {
      const v = values[cIndex];
      const cell = figma.createFrame();
      setAutoLayout(cell, 'VERTICAL', 0, 0);
      const colName = cols[cIndex] != null ? String(cols[cIndex]) : `Col${cIndex+1}`;
      cell.name = `${colName}.f`;
      try { cell.fills = []; } catch(_) {}
      const bodyFill = await bindPaintToColorVar(
        solid(textColor.r, textColor.g, textColor.b, 1),
        options && options.variables ? options.variables.bodyText : null
      );
      const matchingSymbol = symbolConfigs.find(s => headers && headers[s.index] === cols[cIndex]);
      if (matchingSymbol) {
        const comp = symbolComponents[matchingSymbol.column];
        if ((matchingSymbol.type === 'variant' || matchingSymbol.type === 'sparkline') && comp) {
          try {
            const inst = createInstanceFromComponent(comp);
            if (inst && 'setProperties' in inst) {
              const propName = matchingSymbol.prop || 'State';
              const raw = (v == null ? '' : String(v)).trim();
              const hasMap = matchingSymbol.mappings && Object.prototype.hasOwnProperty.call(matchingSymbol.mappings, raw);
              if (hasMap) {
                const mapped = matchingSymbol.mappings[raw];
                try { inst.setProperties({ [propName]: mapped }); } catch (_) {}
              } else if (!matchingSymbol.onlyWhenMapped) {
                try { inst.setProperties({ [propName]: raw }); } catch (_) {}
              } else {
                // Hide but keep spacing
                inst.opacity = 0;
              }
            }
            cell.appendChild(inst);
          } catch (_) {
            const t = createTextNode(v == null ? '' : String(v), { fontSize: 12, fills: [bodyFill], fontName: { family: fontFamily, style: 'Regular' } });
            try { t.layoutGrow = 1; } catch(_) {}
            cell.appendChild(t);
          }
        } else if (matchingSymbol.type === 'sparkline') {
          const spark = createSparklineFromCell(v, 80, 24, ',');
          if (spark) cell.appendChild(spark); else {
            const t = createTextNode(v == null ? '' : String(v), { fontSize: 12, fills: [bodyFill], fontName: { family: fontFamily, style: 'Regular' } });
            try { t.layoutGrow = 1; } catch(_) {}
            cell.appendChild(t);
          }
        } else {
          const t = createTextNode(v == null ? '' : String(v), { fontSize: 12, fills: [bodyFill], fontName: { family: fontFamily, style: 'Regular' } });
          try { t.layoutGrow = 1; } catch(_) {}
          cell.appendChild(t);
        }
      } else {
        const t = createTextNode(v == null ? '' : String(v), {
          fontSize: bodySize,
          fills: [bodyFill],
          fontName: { family: bodyFamily, style: bodyStyle }
        });
        try { t.layoutGrow = 1; } catch(_) {}
        if (colSetup) {
          const c = colSetup.find(x => x.name === cols[cIndex]);
          if (c && c.align) { try { t.textAlignHorizontal = c.align; } catch (_) {} }
        }
        cell.appendChild(t);
      }
      // Apply width from setup
      if (colSetup) {
        const c = colSetup.find(x => x.name === cols[cIndex]);
        if (c) applyColumnWidth(cell, c);
      }
      row.appendChild(cell);
    }
    body.appendChild(row);
  }
  if (options && options.bodyScrollable) {
    // Convert body to a component and place an instance in a clipped container
    const comp = figma.createComponent();
    comp.name = 'BodyRows';
    while (body.children.length) comp.appendChild(body.children[0]);
    const inst = comp.createInstance();
    inst.name = 'Body';
    const wrap = figma.createFrame();
    wrap.name = 'BodyScroll';
    wrap.clipsContent = true;
    const h = options.bodyHeight || 400;
    try { wrap.resizeWithoutConstraints(inst.width || 800, h); } catch(_) { try { wrap.resizeWithoutConstraints(800, h); } catch(_) {} }
    wrap.appendChild(inst);
    root.appendChild(wrap);
    // Keep component near root for visibility
    root.appendChild(comp);
    body.remove();
  } else {
    root.appendChild(body);
  }
  return root;
}

async function fitTextToCellWidth(root, options) {
  try {
    const pad = (options && options.cellPadding != null) ? options.cellPadding : 8;
    const cells = root.findAll(n => n.type === 'FRAME' && (n.parent && n.parent.type === 'FRAME'));
    for (const cell of cells) {
      if (!('findOne' in cell)) continue;
      const t = cell.findOne(n => n.type === 'TEXT');
      if (!t) continue;
      const maxW = Math.max(16, Math.floor((cell.width || 0) - 2 * pad));
      try {
        await ensureFontsForTextNode(t);
        try { t.textAutoResize = 'HEIGHT'; } catch(_) {}
        if ('layoutSizingHorizontal' in t) {
          try { t.layoutSizingHorizontal = 'FILL'; } catch(_) {}
        } else {
          try { t.resize(Math.max(8, maxW), Math.max(8, t.height || 8)); } catch(_) {}
        }
      } catch(_) {}
    }
  } catch(_) {}
}

// Card template utils
function cloneNodeDeep(node) {
  const clone = node.clone();
  // Ensure names are preserved; Figma clone does deep clone
  return clone;
}

function getSelectedComponentLike() {
  const sel = figma.currentPage.selection;
  if (!sel || sel.length === 0) return null;
  const n = sel[0];
  if (n.type === 'COMPONENT') return n;
  if (n.type === 'COMPONENT_SET') {
    if ('children' in n) {
      for (const c of n.children) { if (c.type === 'COMPONENT') return c; }
    }
    return null;
  }
  if (n.type === 'INSTANCE') return n.mainComponent || null;
  return null;
}

function createInstanceFromComponent(componentOrVariant) {
  try { return componentOrVariant.createInstance(); } catch (_) { return null; }
}

function findNamedLayers(node, acc = {}) {
  if ('children' in node) {
    for (const child of node.children) {
      if (child.name) acc[child.name] = child;
      findNamedLayers(child, acc);
    }
  }
  return acc;
}

function normalizeName(s) {
  try { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, ''); } catch (_) { return String(s || ''); }
}

function levenshtein(a, b) {
  a = String(a); b = String(b);
  const m = a.length, n = b.length;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = i - 1, cur = i;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(
        dp[j] + 1,      // deletion
        dp[j - 1] + 1,  // insertion
        prev + cost     // substitution
      );
      prev = tmp;
    }
  }
  return dp[n];
}

function findInstanceLayerApprox(childMap, target) {
  const names = Object.keys(childMap);
  // exact
  if (childMap[target] && childMap[target].type === 'INSTANCE') return { node: childMap[target], matched: target, auto: false };
  // case-insensitive
  const ci = names.find(n => n.toLowerCase() === String(target).toLowerCase());
  if (ci && childMap[ci].type === 'INSTANCE') return { node: childMap[ci], matched: ci, auto: false };
  // normalized
  const norm = normalizeName(target);
  const nn = names.find(n => normalizeName(n) === norm && childMap[n].type === 'INSTANCE');
  if (nn) return { node: childMap[nn], matched: nn, auto: true };
  // includes/prefix
  const inc = names.find(n => n.toLowerCase().includes(String(target).toLowerCase()) && childMap[n].type === 'INSTANCE');
  if (inc) return { node: childMap[inc], matched: inc, auto: true };
  // closest by edit distance among INSTANCEs
  let best = null, bestD = Infinity;
  for (const n of names) {
    const node = childMap[n];
    if (node && node.type === 'INSTANCE') {
      const d = levenshtein(normalizeName(n), norm);
      if (d < bestD) { bestD = d; best = n; }
    }
  }
  if (best != null && bestD <= 2) return { node: childMap[best], matched: best, auto: true };
  return { node: null, matched: null, auto: false };
}

function createDefaultCardTemplate() {
  const card = figma.createFrame();
  card.name = 'Card Template';
  card.resizeWithoutConstraints(240, 140);
  setAutoLayout(card, 'VERTICAL', 6, 12);
  setBackground(card, [solid(1,1,1,1)]);
  card.strokes = [solid(0.9,0.9,0.92,1)];
  card.strokeWeight = 1;
  card.cornerRadius = 8;

  const title = createTextNode('Title', { fontSize: 16, fontName: { family: 'Roboto', style: 'Medium' } });
  title.name = 'title';
  const subtitle = createTextNode('Subtitle', { fontSize: 12, fontName: { family: 'Roboto', style: 'Regular' } });
  subtitle.name = 'subtitle';
  const desc = createTextNode('Description', { fontSize: 12, fontName: { family: 'Roboto', style: 'Regular' } });
  desc.name = 'description';
  card.appendChild(title);
  card.appendChild(subtitle);
  card.appendChild(desc);
  return card;
}

function createPresetTemplate(cardType) {
  const card = figma.createFrame();
  card.name = cardType === 'metric' ? 'Metric Card' : (cardType === 'activeWork' ? 'Active Work Card' : 'Card Template');
  card.resizeWithoutConstraints(240, 120);
  setAutoLayout(card, 'VERTICAL', 6, 12);
  setBackground(card, [solid(1,1,1,1)]);
  card.strokes = [solid(0.9,0.9,0.92,1)];
  card.strokeWeight = 1;
  card.cornerRadius = 8;

  if (cardType === 'metric') {
    const metric = createTextNode('42', { fontSize: 24, fontName: { family: 'Roboto', style: 'Medium' } });
    metric.name = 'Metric';
    const label = createTextNode('Label', { fontSize: 12, fontName: { family: 'Roboto', style: 'Regular' } });
    label.name = 'Label';
    card.appendChild(metric);
    card.appendChild(label);
  } else if (cardType === 'activeWork') {
    const name = createTextNode('Work Item', { fontSize: 16, fontName: { family: 'Roboto', style: 'Medium' } });
    name.name = 'Name';
    const desc = createTextNode('Short description...', { fontSize: 12, fontName: { family: 'Roboto', style: 'Regular' } });
    desc.name = 'Description';
    card.appendChild(name);
    card.appendChild(desc);
  }
  return card;
}

async function buildCards({ headers, rows, options }) {
  await ensureFonts();
  const {
    imageField = null,
    imageLayer = 'image',
    cardType = 'custom',
    symbolProp = 'State',
    symbolHideBlank = false
  } = options || {};

  // Apply to selection: populate existing selected cards in order.
  const sel = (figma.currentPage.selection || []).filter(n => n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE');
  if (sel.length > 0) {
    const missing = new Set();
    const autoFixes = [];
    for (let i = 0; i < sel.length; i++) {
      const host = sel[i];
      const data = rows[i % rows.length];
      if (!data) break;
      const childMap = findNamedLayers(host, {});
      if (cardType === 'metric') {
        const keys = headers && headers.length ? headers : Object.keys(data);
        function findField(name) {
          const k = keys.find(k => k.toLowerCase() === name);
          return k ? data[k] : null;
        }
        const metricVal = findField('metric') || data[keys[0]] || '';
        const labelVal = findField('label') || data[keys[1]] || '';
        if (childMap['Metric'] && childMap['Metric'].type === 'TEXT') await setTextCharacters(childMap['Metric'], metricVal || '');
        if (childMap['Label'] && childMap['Label'].type === 'TEXT') await setTextCharacters(childMap['Label'], labelVal || '');
      } else if (cardType === 'activeWork') {
        const keys = headers && headers.length ? headers : Object.keys(data);
        function findField(name) {
          const k = keys.find(k => k.toLowerCase() === name);
          return k ? data[k] : null;
        }
        const nameVal = findField('name') || data[keys[0]] || '';
        const descVal = findField('description') || data[keys[1]] || '';
        if (childMap['Name'] && childMap['Name'].type === 'TEXT') await setTextCharacters(childMap['Name'], nameVal || '');
        if (childMap['Description'] && childMap['Description'].type === 'TEXT') await setTextCharacters(childMap['Description'], descVal || '');
      } else {
        const keys = headers && headers.length ? headers : Object.keys(data);
        for (const key of keys) {
          const val = data[key];
          const candidates = [key, key.toLowerCase(), key.toUpperCase()];
          for (const c of candidates) {
            const node = childMap[c];
            if (node) {
              if (node.type === 'TEXT') { await setTextCharacters(node, val); }
              break;
            }
          }
        }
      }
      // Images
      try {
        if (imageField) {
          const url = data[imageField];
          if (url && typeof url === 'string' && /^https?:\/\//i.test(url)) {
            const target = childMap[imageLayer] || childMap[imageLayer.toLowerCase()] || childMap[imageLayer.toUpperCase()] || childMap['image'] || childMap['Image'] || childMap['IMAGE'];
            if (target && 'fills' in target) {
              const hash = await fetchImageHash(url);
              if (hash) {
                const imgPaint = { type: 'IMAGE', imageHash: hash, scaleMode: 'FILL' };
                target.fills = [imgPaint];
              }
            }
          }
        }
      } catch (_) {}
      // Symbols by layer name (instances) with optional mapping
      try {
        const keysForSymbols = headers && headers.length ? headers : Object.keys(data);
        for (const key of keysForSymbols) {
          const val = data[key];
          const { node, matched, auto } = findInstanceLayerApprox(childMap, key);
          if (node && 'setProperties' in node) {
            let raw = (val == null ? '' : String(val)).trim();
            if (options && options.symbolMappings && options.symbolMappings[raw] !== undefined) raw = options.symbolMappings[raw];
            if (!raw && symbolHideBlank) { try { node.opacity = 0; } catch(_) {} }
            else {
              try { node.setProperties({ [symbolProp]: raw }); } catch(_) {}
              try { node.opacity = 1; } catch(_) {}
            }
            if (auto && matched && matched !== key) autoFixes.push(`${key}→${matched}`);
          } else {
            missing.add(String(key));
          }
        }
      } catch (_) {}
    }
    if (missing.size || autoFixes.length) {
      let msg = '';
      if (autoFixes.length) msg += `Auto-mapped symbols: ${autoFixes.slice(0,5).join(', ')}. `;
      if (missing.size) msg += `Missing symbol layers: ${Array.from(missing).slice(0,5).join(', ')}.`;
      figma.ui.postMessage({ type: 'hint', message: msg.trim() });
    }
    // Nothing to return; we modified in place
    return null;
  }

  // No selection: create a single card from preset/default and populate with first row
  let template = (cardType === 'metric' || cardType === 'activeWork') ? createPresetTemplate(cardType) : createDefaultCardTemplate();
  const host = template;
  const data = rows[0] || {};
  const childMap = findNamedLayers(host, {});
  if (cardType === 'metric') {
    const keys = headers && headers.length ? headers : Object.keys(data);
    function findField(name) {
      const k = keys.find(k => k.toLowerCase() === name);
      return k ? data[k] : null;
    }
    const metricVal = findField('metric') || data[keys[0]] || '';
    const labelVal = findField('label') || data[keys[1]] || '';
    if (childMap['Metric'] && childMap['Metric'].type === 'TEXT') await setTextCharacters(childMap['Metric'], metricVal || '');
    if (childMap['Label'] && childMap['Label'].type === 'TEXT') await setTextCharacters(childMap['Label'], labelVal || '');
  } else if (cardType === 'activeWork') {
    const keys = headers && headers.length ? headers : Object.keys(data);
    function findField(name) {
      const k = keys.find(k => k.toLowerCase() === name);
      return k ? data[k] : null;
    }
    const nameVal = findField('name') || data[keys[0]] || '';
    const descVal = findField('description') || data[keys[1]] || '';
    if (childMap['Name'] && childMap['Name'].type === 'TEXT') await setTextCharacters(childMap['Name'], nameVal || '');
    if (childMap['Description'] && childMap['Description'].type === 'TEXT') await setTextCharacters(childMap['Description'], descVal || '');
  } else {
    const keys = headers && headers.length ? headers : Object.keys(data);
    for (const key of keys) {
      const val = data[key];
      const candidates = [key, key.toLowerCase(), key.toUpperCase()];
      for (const c of candidates) {
        const node = childMap[c];
        if (node) {
          if (node.type === 'TEXT') { await setTextCharacters(node, val); }
          break;
        }
      }
    }
  }
  // Images for the single card
  try {
    if (imageField) {
      const url = data[imageField];
      if (url && typeof url === 'string' && /^https?:\/\//i.test(url)) {
        const target = childMap[imageLayer] || childMap[imageLayer.toLowerCase()] || childMap[imageLayer.toUpperCase()] || childMap['image'] || childMap['Image'] || childMap['IMAGE'];
        if (target && 'fills' in target) {
          const hash = await fetchImageHash(url);
          if (hash) {
            const imgPaint = { type: 'IMAGE', imageHash: hash, scaleMode: 'FILL' };
            target.fills = [imgPaint];
          }
        }
      }
    }
  } catch (_) {}
  // Symbols for the single card by layer name with optional mapping
  try {
    const keysForSymbols = headers && headers.length ? headers : Object.keys(data);
    const missing = [];
    const autoFixes = [];
    for (const key of keysForSymbols) {
      const val = data[key];
      const { node, matched, auto } = findInstanceLayerApprox(childMap, key);
      if (node && 'setProperties' in node) {
        let raw = (val == null ? '' : String(val)).trim();
        if (options && options.symbolMappings && options.symbolMappings[raw] !== undefined) raw = options.symbolMappings[raw];
        if (!raw && symbolHideBlank) { try { node.opacity = 0; } catch(_) {} }
        else {
          try { node.setProperties({ [symbolProp]: raw }); } catch(_) {}
          try { node.opacity = 1; } catch(_) {}
        }
        if (auto && matched && matched !== key) autoFixes.push(`${key}→${matched}`);
      } else {
        missing.push(String(key));
      }
    }
    if (missing.length || autoFixes.length) {
      let msg = '';
      if (autoFixes.length) msg += `Auto-mapped symbols: ${autoFixes.slice(0,5).join(', ')}. `;
      if (missing.length) msg += `Missing symbol layers: ${missing.slice(0,5).join(', ')}.`;
      figma.ui.postMessage({ type: 'hint', message: msg.trim() });
    }
  } catch (_) {}
  return host;
}

function setMeta(node, meta) {
  try { node.setPluginData('dp_meta', JSON.stringify(meta)); } catch (_) {}
}

function getMeta(node) {
  try {
    const s = node.getPluginData('dp_meta');
    if (!s) return null; return JSON.parse(s);
  } catch (_) { return null; }
}

// Handle messages from UI
figma.on('run', async () => {
  // Show UI with a good default size
  figma.showUI(__html__, { width: 420, height: 540 });
  // If user has a selection, try to capture table or cards and preload UI
  try {
    const sel = figma.currentPage.selection;
    if (sel && sel.length === 1) {
      // Attempt table capture first
      const base = findTableRoot(sel[0]);
      if (base) {
        // Reuse capture logic
        await (async () => {
          const meta = getMeta(base) || {};
          const head = base.findOne(n => n.type === 'FRAME' && n.name === 'Header');
          const body = base.findOne(n => n.type === 'FRAME' && (n.name === 'Body' || n.name === 'BodyScroll'));
          if (!head || !body) return;
          const headers = head.children
            .filter(n => n.type === 'FRAME')
            .map(c => { let s=String(c.name||''); s=s.replace(/^H:\s*/, ''); s=s.replace(/\.f$/, ''); return s; });
          function readMode(cell) {
            try {
              if ('layoutSizingHorizontal' in cell) {
                if (cell.layoutSizingHorizontal === 'FILL' || (cell.layoutGrow && cell.layoutGrow > 0)) return 'fill';
              } else {
                if ((cell.layoutGrow && cell.layoutGrow > 0) || cell.counterAxisSizingMode === 'AUTO') return 'fill';
              }
            } catch (_) {}
            return 'px';
          }
          function readAlign(cell) {
            try { const t = cell.findOne(n => n.type === 'TEXT'); if (t) return t.textAlignHorizontal || 'LEFT'; } catch(_) {}
            return 'LEFT';
          }
          const metaSetup = (meta.options && Array.isArray(meta.options.columnSetup)) ? meta.options.columnSetup : [];
          const columnSetup = headers.map((h, idx) => {
            const cell = head.children[idx];
            const mode = readMode(cell);
            const width = Math.round(cell.width || 160);
            const align = readAlign(cell);
            const prior = metaSetup.find(c => String(c.name).toLowerCase() === String(h).toLowerCase());
            const baseCfg = { name: h, type: 'text', width, mode, align, onlyError: false };
            if (prior && prior.type === 'symbol') {
              baseCfg.type = 'symbol';
              if (prior.prop) baseCfg.prop = prior.prop;
              if (prior.mappings) baseCfg.mappings = prior.mappings;
              if (prior.onlyWhenMapped != null) baseCfg.onlyWhenMapped = prior.onlyWhenMapped;
              if (prior.componentId) baseCfg.componentId = prior.componentId;
              if (prior.onlyError) baseCfg.onlyError = prior.onlyError;
            }
            return baseCfg;
          });
          const bodyFrame = (body.name === 'BodyScroll' && 'children' in body && body.children[0] && body.children[0].name === 'Body') ? body.children[0] : body;
          const rowsData = [];
          for (const row of bodyFrame.children) {
            if (row.type !== 'FRAME') continue;
            const obj = {};
            for (let i = 0; i < headers.length; i++) {
              const cell = row.children[i];
              let val = '';
              if (cell) {
                try {
                  const t = cell.findOne(n => n.type === 'TEXT');
                  if (t) val = t.characters || '';
                  else {
                    const cfg = columnSetup[i];
                    const inst = cell.findOne(n => n.type === 'INSTANCE');
                    if (cfg && cfg.type === 'symbol' && inst && 'componentProperties' in inst) {
                      const propName = cfg.prop || 'State';
                      const cp = inst.componentProperties || {};
                      if (cp[propName] && typeof cp[propName].value === 'string') val = cp[propName].value;
                    }
                  }
                } catch(_) {}
              }
              obj[headers[i]] = val;
            }
            rowsData.push(obj);
          }
          const options = Object.assign({ header: true, zebra: !!(meta.options && meta.options.zebra), columnSetup }, (meta.options || {}));
          options.columnSetup = columnSetup;
          const wrap = base.findOne(n => n.type === 'FRAME' && n.name === 'BodyScroll');
          if (wrap) { options.bodyScrollable = true; options.bodyHeight = Math.round(wrap.height || 400); }
          const payload = { mode: 'table', headers, rows: rowsData, options, targetWidth: Math.round(base.width || 1200) };
          figma.ui.postMessage({ type: 'capturedSelection', payload });
        })();
        return;
      }
      // Otherwise, attempt to capture cards from selection (one or more)
      const nodes = sel.filter(n => n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE');
      if (nodes.length) {
        const headers = [];
        const seen = new Set();
        function pushHeader(n){ const k=String(n).trim(); if (!k || seen.has(k)) return; seen.add(k); headers.push(k); }
        function dfsCollect(node){
          if ('children' in node && Array.isArray(node.children)) {
            for (const c of node.children) {
              if (c.name && (c.type === 'TEXT' || c.type === 'INSTANCE')) pushHeader(c.name);
              dfsCollect(c);
            }
          }
        }
        // Determine headers from the first node in selection
        dfsCollect(nodes[0]);
        // Also append headers present in later nodes that aren't in first
        for (let i=1;i<nodes.length;i++){ dfsCollect(nodes[i]); }

        function getByName(map, name){ return map[name] || map[name.toLowerCase()] || map[name.toUpperCase()] || null; }
        const rows = [];
        const layerSetup = [];
        // Prepare widths from first node where available
        const firstMap = findNamedLayers(nodes[0], {});
        for (const h of headers) { const n = getByName(firstMap, h); if (n && 'width' in n) layerSetup.push({ name: h, width: Math.round(n.width) }); }
        for (const host of nodes) {
          const map = findNamedLayers(host, {});
          const obj = {};
          for (const h of headers) {
            const node = getByName(map, h);
            let val = '';
            if (node) {
              if (node.type === 'TEXT') { try { val = node.characters || ''; } catch(_) {} }
              else if (node.type === 'INSTANCE' && 'componentProperties' in node) {
                const propName = (getMeta(host) && getMeta(host).options && getMeta(host).options.symbolProp) || 'State';
                const cp = node.componentProperties || {};
                if (cp[propName] && typeof cp[propName].value === 'string') val = cp[propName].value;
              }
            }
            obj[h] = val;
          }
          rows.push(obj);
        }
        const cardSizes = nodes.map(n => ({ name: n.name || 'Card', width: Math.round(n.width || 0), height: Math.round(n.height || 0) }));
        const payload = { mode: 'cards', headers, rows, options: { layerSetup }, cardSizes };
        figma.ui.postMessage({ type: 'capturedSelection', payload });
        return;
      }
    }
  } catch (_) {}
});

figma.ui.onmessage = async (msg) => {
  try {
    if (msg.type === 'resize') {
      const w = Math.max(320, Math.min(720, msg.width || 420));
      const h = Math.max(240, Math.min(760, msg.height || 540));
      figma.ui.resize(w, h);
      return;
    }
    if (msg.type === 'exportStructure') {
      try { figma.notify('Exporting structure…', { timeout: 1200 }); } catch(_) {}
      const sel = figma.currentPage.selection || [];
      if (!sel.length) { figma.ui.postMessage({ type: 'error', message: 'Select at least one node.' }); return; }

      function pickLiteFont(f){ try { if (!f) return null; return { family: f.family||null, style: f.style||null }; } catch(_) { return null; } }
      function serializeNode(n){
        const base = {
          id: n.id,
          type: n.type,
          name: n.name || '',
          visible: (n.visible !== false),
        };
        try { if ('locked' in n) base.locked = !!n.locked; } catch(_) {}
        try { if ('x' in n && 'y' in n) { base.x = Math.round(n.x||0); base.y = Math.round(n.y||0); } } catch(_) {}
        try { if ('width' in n && 'height' in n) { base.width = Math.round(n.width||0); base.height = Math.round(n.height||0); } } catch(_) {}
        // Auto layout
        try {
          if ('layoutMode' in n) {
            base.layout = {
              mode: n.layoutMode || 'NONE',
              primaryAxisSizingMode: n.primaryAxisSizingMode || null,
              counterAxisSizingMode: n.counterAxisSizingMode || null,
              primaryAxisAlignItems: n.primaryAxisAlignItems || null,
              counterAxisAlignItems: n.counterAxisAlignItems || null,
              itemSpacing: n.itemSpacing != null ? Math.round(n.itemSpacing) : null,
              paddingLeft: n.paddingLeft != null ? Math.round(n.paddingLeft) : null,
              paddingRight: n.paddingRight != null ? Math.round(n.paddingRight) : null,
              paddingTop: n.paddingTop != null ? Math.round(n.paddingTop) : null,
              paddingBottom: n.paddingBottom != null ? Math.round(n.paddingBottom) : null,
              layoutWrap: n.layoutWrap || 'NO_WRAP',
            };
          }
        } catch(_) {}
        // Constraints
        try { if ('constraints' in n && n.constraints) base.constraints = n.constraints; } catch(_) {}
        // Text specifics
        if (n.type === 'TEXT') {
          try {
            base.text = {
              characters: n.characters || '',
              fontName: pickLiteFont(n.fontName),
              fontSize: n.fontSize || null,
              textAutoResize: n.textAutoResize || null,
              textAlignHorizontal: n.textAlignHorizontal || null,
              textAlignVertical: n.textAlignVertical || null,
              lineHeight: (n.lineHeight && typeof n.lineHeight === 'object') ? n.lineHeight : null,
            };
          } catch(_) {}
        }
        // Instance/component
        if (n.type === 'INSTANCE') {
          try {
            base.instance = {
              mainComponent: n.mainComponent ? { id: n.mainComponent.id, name: n.mainComponent.name||'' } : null,
              componentProperties: n.componentProperties || null,
            };
          } catch(_) {}
        }
        if (n.type === 'COMPONENT') {
          try { base.component = { name: n.name||'', variantProperties: n.variantProperties || null }; } catch(_) {}
        }
        // Children
        try {
          if ('children' in n && Array.isArray(n.children)) {
            base.children = n.children.map(c => serializeNode(c));
          }
        } catch(_) {}
        return base;
      }

      const payload = sel.length === 1 ? serializeNode(sel[0]) : sel.map(serializeNode);
      const json = JSON.stringify(payload, null, 2);
      figma.ui.postMessage({ type: 'structureExport', json });
      return;
    }
    if (msg.type === 'captureSelection') {
      try { figma.notify('Capturing selection…', { timeout: 1200 }); } catch(_) {}
      const sel = figma.currentPage.selection;
      // Try to find a table root from any selected node (not just single selection)
      let base = null;
      if (sel && sel.length) {
        for (const n of sel) { const r = findTableRoot(n); if (r) { base = r; break; } }
      }
      try { console.log('[DP DEBUG]', { where:'main.capture', note:'selection', selectionCount: (sel||[]).length, types: (sel||[]).map(n=>n.type), tableDetected: !!base }); } catch(_) {}
      figma.ui.postMessage({ type: 'debug', data: { selectionCount: (sel||[]).length, types: (sel||[]).map(n=>n.type), tableDetected: !!base } });
      if (!base) {
        // Try cards capture instead
        const nodes = (sel || []).filter(n => n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE');
        if (!nodes.length) { figma.ui.postMessage({ type: 'hint', message: 'Capture: No valid selection (select a table or card(s)).' }); return; }
        figma.ui.postMessage({ type: 'hint', message: `Capture: Cards selection ×${nodes.length}` });
        try { console.log('[DP DEBUG]', { where:'main.capture', note:'path', mode: 'cards', count: nodes.length, names: nodes.map(n=>n.name) }); } catch(_) {}
        figma.ui.postMessage({ type: 'debug', data: { where:'main.capture', note:'path', mode: 'cards', count: nodes.length, names: nodes.map(n=>n.name) } });
        const headers = [];
        const seen = new Set();
        function pushHeader(n){ const k=String(n).trim(); if (!k || seen.has(k)) return; seen.add(k); headers.push(k); }
        function dfsCollect(node){ if ('children' in node && Array.isArray(node.children)) { for (const c of node.children) { if (c.name && (c.type === 'TEXT' || c.type === 'INSTANCE')) pushHeader(c.name); dfsCollect(c); } } }
        dfsCollect(nodes[0]); for (let i=1;i<nodes.length;i++){ dfsCollect(nodes[i]); }
        function getByName(map, name){ return map[name] || map[name.toLowerCase()] || map[name.toUpperCase()] || null; }
        const rows = [];
        const layerSetup = [];
        const firstMap = findNamedLayers(nodes[0], {});
        for (const h of headers) { const n = getByName(firstMap, h); if (n && 'width' in n) layerSetup.push({ name: h, width: Math.round(n.width) }); }
        for (const host of nodes) {
          const map = findNamedLayers(host, {});
          const obj = {};
          for (const h of headers) {
            const node = getByName(map, h);
            let val = '';
            if (node) {
              if (node.type === 'TEXT') { try { val = node.characters || ''; } catch(_) {} }
              else if (node.type === 'INSTANCE' && 'componentProperties' in node) {
                const propName = (getMeta(host) && getMeta(host).options && getMeta(host).options.symbolProp) || 'State';
                const cp = node.componentProperties || {};
                if (cp[propName] && typeof cp[propName].value === 'string') val = cp[propName].value;
              }
            }
            obj[h] = val;
          }
          rows.push(obj);
        }
        const cardSizes = nodes.map(n => ({ name: n.name || 'Card', width: Math.round(n.width || 0), height: Math.round(n.height || 0) }));
        const payload = { mode: 'cards', headers, rows, options: { layerSetup }, cardSizes };
        try { console.log('[DP DEBUG]', { where:'main.capture', note:'result', mode:'cards', headersCount: headers.length, rowsCount: rows.length, layerSetupCount: layerSetup.length }); } catch(_) {}
        figma.ui.postMessage({ type: 'debug', data: { where:'main.capture', note:'result', mode:'cards', headersCount: headers.length, rowsCount: rows.length, layerSetupCount: layerSetup.length } });
        figma.ui.postMessage({ type: 'capturedSelection', payload });
        try { figma.notify(`Captured ${rows.length} card(s)`, { timeout: 1200 }); } catch(_) {}
        return;
      }
      figma.ui.postMessage({ type: 'hint', message: 'Capture: Table detected' });
      const meta = getMeta(base) || {};
      const head = base.findOne(n => n.type === 'FRAME' && n.name === 'Header');
      const body = base.findOne(n => n.type === 'FRAME' && (n.name === 'Body' || n.name === 'BodyScroll'));
      if (!head || !body) { figma.ui.postMessage({ type: 'error', message: 'Could not read table structure.' }); return; }

      // Headers from header cells (strip legacy prefix and .f suffix)
      const headers = head.children
        .filter(n => n.type === 'FRAME')
        .map(c => {
          let s = String(c.name || '');
          s = s.replace(/^H:\s*/, '');
          s = s.replace(/\.f$/, '');
          return s;
        });

      // Build columnSetup from current cell sizing and meta (for symbol details)
      function readMode(cell) {
        try {
          if ('layoutSizingHorizontal' in cell) {
            if (cell.layoutSizingHorizontal === 'FILL' || (cell.layoutGrow && cell.layoutGrow > 0)) return 'fill';
          } else {
            if ((cell.layoutGrow && cell.layoutGrow > 0) || cell.counterAxisSizingMode === 'AUTO') return 'fill';
          }
        } catch (_) {}
        return 'px';
      }
      function readAlign(cell) {
        try { const t = cell.findOne(n => n.type === 'TEXT'); if (t) return t.textAlignHorizontal || 'LEFT'; } catch(_) {}
        return 'LEFT';
      }
      const metaSetup = (meta.options && Array.isArray(meta.options.columnSetup)) ? meta.options.columnSetup : [];
      const columnSetup = headers.map((h, idx) => {
        const cell = head.children[idx];
        const mode = readMode(cell);
        const width = Math.round(cell.width || 160);
        const align = readAlign(cell);
        const prior = metaSetup.find(c => String(c.name).toLowerCase() === String(h).toLowerCase());
        const baseCfg = { name: h, type: 'text', width, mode, align, onlyError: false };
        if (prior && prior.type === 'symbol') {
          baseCfg.type = 'symbol';
          if (prior.prop) baseCfg.prop = prior.prop;
          if (prior.mappings) baseCfg.mappings = prior.mappings;
          if (prior.onlyWhenMapped != null) baseCfg.onlyWhenMapped = prior.onlyWhenMapped;
          if (prior.componentId) baseCfg.componentId = prior.componentId;
          if (prior.onlyError) baseCfg.onlyError = prior.onlyError;
        }
        return baseCfg;
      });

      // Read rows from body
      const bodyFrame = (body.name === 'BodyScroll' && 'children' in body && body.children[0] && body.children[0].name === 'Body') ? body.children[0] : body;
      const rowsData = [];
      for (const row of bodyFrame.children) {
        if (row.type !== 'FRAME') continue;
        const obj = {};
        for (let i = 0; i < headers.length; i++) {
          const cell = row.children[i];
          let val = '';
          if (cell) {
            try {
              const t = cell.findOne(n => n.type === 'TEXT');
              if (t) val = t.characters || '';
              else {
                // Attempt to read symbol value when configured
                const h = headers[i];
                const cfg = columnSetup[i];
                const inst = cell.findOne(n => n.type === 'INSTANCE');
                if (cfg && cfg.type === 'symbol' && inst && 'componentProperties' in inst) {
                  const propName = cfg.prop || 'State';
                  const cp = inst.componentProperties || {};
                  if (cp[propName] && typeof cp[propName].value === 'string') val = cp[propName].value;
                }
              }
            } catch(_) {}
          }
          obj[headers[i]] = val;
        }
        rowsData.push(obj);
      }

      // Options object to send back
      const options = Object.assign({ header: true, zebra: !!(meta.options && meta.options.zebra), columnSetup }, (meta.options || {}));
      options.columnSetup = columnSetup; // ensure latest sizing/align preserved
      // Body scroll capture
      const wrap = base.findOne(n => n.type === 'FRAME' && n.name === 'BodyScroll');
      if (wrap) { options.bodyScrollable = true; options.bodyHeight = Math.round(wrap.height || 400); }

      const payload = { mode: 'table', headers, rows: rowsData, options, targetWidth: Math.round(base.width || 1200), tableSize: { width: Math.round(base.width || 0), height: Math.round(base.height || 0) } };
      try { console.log('[DP DEBUG]', { where:'main.capture', note:'result', mode: 'table', headersCount: headers.length, rowsCount: rowsData.length, size: payload.tableSize }); } catch(_) {}
      figma.ui.postMessage({ type: 'debug', data: { where:'main.capture', note:'result', mode: 'table', headersCount: headers.length, rowsCount: rowsData.length, size: payload.tableSize } });
      figma.ui.postMessage({ type: 'capturedSelection', payload });
      try { figma.notify(`Captured table: ${headers.length} columns, ${rowsData.length} rows`, { timeout: 1600 }); } catch(_) {}
      return;
    }
    if (msg.type === 'captureColumnComponent') {
      const id = msg.id;
      const sel = figma.currentPage.selection;
      let component = null;
      if (sel && sel.length === 1) {
        const n = sel[0];
        if (n.type === 'COMPONENT') component = n;
        else if (n.type === 'INSTANCE' && n.mainComponent) component = n.mainComponent;
        else if (n.type === 'COMPONENT_SET' && 'children' in n) {
          for (const c of n.children) { if (c.type === 'COMPONENT') { component = c; break; } }
        }
      }
      if (component) {
        figma.ui.postMessage({ type: 'colComponentCaptured', id, componentId: component.id, componentName: component.name });
      } else {
        figma.ui.postMessage({ type: 'colComponentCaptured', id, componentId: null, componentName: 'none' });
      }
      return;
    }
    if (msg.type === 'generate') {
      const { mode, headers, rows, options } = msg.payload;
      let node;
      if (mode === 'table') {
        node = await buildTable({ headers, rows, options });
      } else {
        node = await buildCards({ headers, rows, options });
      }
      // Position near viewport center
      if (node) {
        node.x = figma.viewport.center.x;
        node.y = figma.viewport.center.y;
        figma.currentPage.appendChild(node);
        figma.currentPage.selection = [node];
        setMeta(node, { version: 1, mode, headers, options });
        figma.viewport.scrollAndZoomIntoView([node]);
        if (mode === 'table') { try { await fitTextToCellWidth(node, options); } catch(_) {} }
      }
      figma.ui.postMessage({ type: 'done', count: rows.length });
    }
    if (msg.type === 'detectAction') {
      try {
        const mode = (msg.payload && msg.payload.mode) || 'table';
        const sel = figma.currentPage.selection;
        let hasTable = false;
        if (sel && sel.length) {
          for (const n of sel) { if (findTableRoot(n)) { hasTable = true; break; } }
        }
        let use = 'generate';
        if (mode === 'table' && hasTable) use = 'update'; else use = 'generate';
        figma.ui.postMessage({ type: 'detectActionResult', use });
      } catch (_) { figma.ui.postMessage({ type: 'detectActionResult', use: 'generate' }); }
      return;
    }
    if (msg.type === 'dumpSelection') {
      try {
        const lines = [];
        function push(line){ try { lines.push(line); } catch(_) {} }
        function walk(node, depth){
          const pad = '  '.repeat(depth);
          const name = (node && node.name) ? node.name : '(unnamed)';
          const type = node ? node.type : '(null)';
          let extra = '';
          try { if ('width' in node && 'height' in node) extra = ` [${Math.round(node.width||0)}×${Math.round(node.height||0)}]`; } catch(_) {}
          push(`${pad}- ${type}: ${name}${extra}`);
          if (node && 'children' in node && Array.isArray(node.children)) {
            for (const c of node.children) walk(c, depth+1);
          }
        }
        const sel = figma.currentPage.selection || [];
        if (!sel.length) { push('No selection.'); }
        else {
          push(`Selection (${sel.length})`);
          for (const n of sel) walk(n, 0);
        }
        try { console.log('[DP DEBUG] selection-tree\n' + lines.join('\n')); } catch(_) {}
        figma.ui.postMessage({ type: 'debug', data: lines.join('\n') });
      } catch (e) {
        try { console.log('[DP DEBUG] dumpSelection error', e && e.message); } catch(_) {}
        figma.ui.postMessage({ type: 'debug', data: 'dumpSelection error: ' + (e && e.message) });
      }
      return;
    }
    if (msg.type === 'update') {
      const { mode, headers, rows, options } = msg.payload;
      const sel = figma.currentPage.selection;
      const base = (sel && sel.length === 1) ? findTableRoot(sel[0]) : null;
      if (!base) {
        figma.notify('Select a previously generated frame.');
        figma.ui.postMessage({ type: 'error', message: 'Select a generated frame' });
        return;
      }
      const target = base;
      const meta = getMeta(target);
      if (!meta) {
        figma.notify('No Data Populator metadata found on selection.');
        figma.ui.postMessage({ type: 'error', message: 'No metadata on selection' });
        return;
      }
      const useMode = meta.mode || mode;
      let rebuilt;
      if (useMode === 'table') {
        // Key-diff update when key present and structure matches
        const keyCol = options && options.keyColumn;
        const body = target.findOne(n => n.type === 'FRAME' && (n.name === 'Body' || n.name === 'BodyScroll'));
        const head = target.findOne(n => n.type === 'FRAME' && n.name === 'Header');
        if (keyCol && body && head) {
          try { figma.ui.postMessage({ type: 'debug', data: { where:'update', note:'key-diff', keyCol, bodyName: body.name } }); } catch(_) {}
          // Build a minimal table offscreen for row template
          const tmp = await buildTable({ headers, rows: [], options });
          const templateRow = (await (async ()=>{
            const b = tmp.findOne(n => n.type === 'FRAME' && n.name === 'Body');
            if (b && b.children.length === 0) {
              // create one empty row to capture sizing
              const empty = {};
              if (headers) {
                for (let ii=0; ii<headers.length; ii++) empty[headers[ii]] = '';
              }
              const test = await buildTable({ headers, rows: [empty], options });
              const tb = test.findOne(n => n.type === 'FRAME' && n.name === 'Body');
              const r = tb && tb.children[0];
              return r || null;
            }
            return null;
          })());
          if (tmp) tmp.remove();

          // Index existing rows by key (handle BodyScroll/BodyRows)
          const bodyFrame = (body.name === 'BodyScroll' && 'children' in body && body.children[0] && body.children[0].name === 'Body') ? body.children[0] : body;
          const bodyRowsComponent = target.findOne(n => n.type === 'COMPONENT' && n.name === 'BodyRows');
          const rowsContainer = (body.name === 'BodyScroll' && bodyRowsComponent) ? bodyRowsComponent : bodyFrame;
          const existing = {};
          for (const r of rowsContainer.children) {
            if (r.type === 'FRAME') {
              const k = r.getPluginData('dp_row_key');
              if (k) existing[k] = r;
            }
          }
          const cols = (headers && options && options.columnsCount) ? headers.slice(0, options.columnsCount) : headers;
          // Build symbol config structures as in buildTable
          const symbolConfigs = [];
          if (options && Array.isArray(options.symbols)) {
            for (const s of options.symbols) {
              const idx = headers ? headers.findIndex(h => String(h).toLowerCase() === String(s.column || '').toLowerCase()) : -1;
              if (idx >= 0) symbolConfigs.push(Object.assign({ index: idx }, s));
            }
          }
          // For update flow, fall back to current selection's component for all symbol columns
          const fallbackComp = getSelectedComponentLike();
          const symbolComponents = {};
          for (const s of symbolConfigs) { symbolComponents[s.column] = fallbackComp; }

          // Helper to build a row frame for a given data object
          async function buildRowForData(data) {
            const row = figma.createFrame();
            setAutoLayout(row, 'HORIZONTAL', options.columnGap || 16, options.cellPadding || 8);
            const zebraBg = { r: 0.98, g: 0.98, b: 0.98 };
            const textColor = { r: 0.12, g: 0.12, b: 0.14 };
            const typo = (options && options.typography) ? options.typography : {};
            const bodyFamily = typo.bodyFamily || 'Roboto';
            const bodyStyle = typo.bodyStyle || 'Regular';
            const bodySize = typo.bodySize || 12;
            await loadFontSafe(bodyFamily, bodyStyle);
            for (let cIndex = 0; cIndex < cols.length; cIndex++) {
              const v = data[cols[cIndex]];
              const cell = figma.createFrame();
              setAutoLayout(cell, 'VERTICAL', 0, 0);
              cell.name = 'Cell';
              const bodyFill = solid(textColor.r, textColor.g, textColor.b, 1);
              const matchingSymbol = symbolConfigs.find(s => headers && headers[s.index] === cols[cIndex]);
              if (matchingSymbol) {
                const comp = symbolComponents[matchingSymbol.column];
                if (comp) {
                  try {
                    const inst = createInstanceFromComponent(comp);
                    if (inst && 'setProperties' in inst) {
                      const propName = matchingSymbol.prop || 'State';
                      const raw = (v == null ? '' : String(v)).trim();
                      const hasMap = matchingSymbol.mappings && Object.prototype.hasOwnProperty.call(matchingSymbol.mappings, raw);
                      if (hasMap) {
                        const mapped = matchingSymbol.mappings[raw];
                        try { inst.setProperties({ [propName]: mapped }); } catch (_) {}
                      } else if (!matchingSymbol.onlyWhenMapped) {
                        try { inst.setProperties({ [propName]: raw }); } catch (_) {}
                      } else {
                        inst.opacity = 0;
                      }
                    }
                    cell.appendChild(inst);
                  } catch (_) {
                    const t = createTextNode(v == null ? '' : String(v), { fontSize: bodySize, fills: [bodyFill], fontName: { family: bodyFamily, style: bodyStyle } });
                    cell.appendChild(t);
                  }
                } else {
                  const t = createTextNode(v == null ? '' : String(v), { fontSize: bodySize, fills: [bodyFill], fontName: { family: bodyFamily, style: bodyStyle } });
                  cell.appendChild(t);
                }
              } else {
                const t = createTextNode(v == null ? '' : String(v), { fontSize: bodySize, fills: [bodyFill], fontName: { family: bodyFamily, style: bodyStyle } });
                cell.appendChild(t);
              }
              row.appendChild(cell);
            }
            return row;
          }

          // Build new order of rows
          const newFrames = [];
          for (let i = 0; i < rows.length; i++) {
            const data = rows[i];
            const key = data[keyCol];
            if (key != null && existing[String(key)]) {
              const rf = existing[String(key)];
              // Replace rf children with new cells
              for (const c of rf.children.slice()) c.remove();
              const newRow = await buildRowForData(data);
              for (const c of newRow.children.slice()) rf.appendChild(c);
              newRow.remove();
              try { rf.setPluginData('dp_row_key', String(key)); } catch (_) {}
              newFrames.push(rf);
              delete existing[String(key)];
            } else {
              const nr = await buildRowForData(data);
              try { nr.setPluginData('dp_row_key', String(key)); } catch (_) {}
              newFrames.push(nr);
            }
          }
          // Remove leftover rows not present in new data (optional)
          if (!(options && options.keepUnmatchedRows)) {
            for (const k in existing) { existing[k].remove(); }
          }
          // Reorder/append to rows container
          for (const c of rowsContainer.children.slice()) c.remove();
          for (const r of newFrames) rowsContainer.appendChild(r);
          try { await fitTextToCellWidth(target, options); } catch(_) {}
          figma.ui.postMessage({ type: 'done', count: rows.length });
          return;
        }
        // fallback full rebuild
        rebuilt = await buildTable({ headers, rows, options });
      } else {
        rebuilt = await buildCards({ headers, rows, options });
      }
      // Replace children in place, keep node reference/position
      for (const c of target.children.slice()) c.remove();
      // Adopt layout of rebuilt
      try {
        target.layoutMode = rebuilt.layoutMode;
        target.itemSpacing = rebuilt.itemSpacing;
        target.paddingLeft = rebuilt.paddingLeft;
        target.paddingRight = rebuilt.paddingRight;
        target.paddingTop = rebuilt.paddingTop;
        target.paddingBottom = rebuilt.paddingBottom;
        target.primaryAxisSizingMode = rebuilt.primaryAxisSizingMode;
        target.counterAxisSizingMode = rebuilt.counterAxisSizingMode;
        target.fills = rebuilt.fills;
        target.strokes = rebuilt.strokes;
        target.strokeWeight = rebuilt.strokeWeight;
        target.cornerRadius = rebuilt.cornerRadius;
      } catch (_) {}
      // Move children
      for (const c of rebuilt.children.slice()) target.appendChild(c);
      rebuilt.remove();
      setMeta(target, { version: 1, mode: useMode, headers, options });
      if (useMode === 'table') { try { await fitTextToCellWidth(target, options); } catch(_) {} }
      figma.ui.postMessage({ type: 'done', count: rows.length });
    }
    if (msg.type === 'applyConfig') {
      const options = msg.payload && msg.payload.options;
      const sel = figma.currentPage.selection;
      const base = (sel && sel.length === 1) ? findTableRoot(sel[0]) : null;
      if (!options || !base) {
        figma.ui.postMessage({ type: 'error', message: 'Select a generated table to apply layout changes.' });
        return;
      }
      const target = base;
      const headersMeta = (function(){ const m = getMeta(target); return m && m.headers ? m.headers : null; })();
      const colSetup = options && options.columnSetup ? options.columnSetup : null;
      const newHeaders = (colSetup && colSetup.length) ? colSetup.map(c => c.name) : (headersMeta || []);
      const head = target.findOne(n => n.type === 'FRAME' && n.name === 'Header');
      const body = target.findOne(n => n.type === 'FRAME' && (n.name === 'Body' || n.name === 'BodyScroll'));
      if (!head || !body) { figma.ui.postMessage({ type: 'error', message: 'Selected frame does not look like a generated table.' }); return; }

      // Update header cells
      try {
        for (let i = 0; i < head.children.length; i++) {
          const cell = head.children[i];
          if (cell.type !== 'FRAME') continue;
          const curName = String(cell.name||'').replace(/^H:\s*/, '').replace(/\.f$/,'');
          const cfg = colSetup ? (colSetup.find(c => String(c.name) === curName) || colSetup.find(c => String(c.name).toLowerCase() === curName.toLowerCase()) || colSetup[i] || null) : null;
          if (cfg) applyColumnWidth(cell, cfg);
          const text = cell.findOne(n => n.type === 'TEXT');
          if (text) {
            if (options.typography) {
              try { await figma.loadFontAsync({ family: options.typography.headerFamily || 'Roboto', style: options.typography.headerStyle || 'Medium' }); } catch(_) {}
              try { text.fontName = { family: options.typography.headerFamily || 'Roboto', style: options.typography.headerStyle || 'Medium' }; } catch(_) {}
              try { text.fontSize = options.typography.headerSize || 12; } catch(_) {}
            }
            try { text.textAutoResize = 'HEIGHT'; } catch(_) {}
            try { text.layoutGrow = 1; } catch(_) {}
            if (cfg && cfg.align) { try { text.textAlignHorizontal = cfg.align; } catch(_) {} }
            if (cfg && cfg.name && text.characters !== cfg.name) { try { await ensureFontsForTextNode(text); text.characters = cfg.name; } catch(_) {} }
          }
          if (cfg && cfg.name) { try { cell.name = `${cfg.name}.f`; } catch(_) {} }
        }
      } catch(_) {}

      // Update BodyScroll height if present and configured
      try {
        const wrap = target.findOne(n => n.type === 'FRAME' && n.name === 'BodyScroll');
        if (wrap && options && options.bodyScrollable) {
          const h = options.bodyHeight || 400;
          try { wrap.resizeWithoutConstraints(wrap.width, h); } catch(_) {}
        }
      } catch(_) {}

      // Update body rows
      try {
        const bodyFrame = (body.name === 'BodyScroll' && 'children' in body && body.children[0] && body.children[0].name === 'Body') ? body.children[0] : body;
        const bodyRowsComponent = target.findOne(n => n.type === 'COMPONENT' && n.name === 'BodyRows');
        const rowsContainer = (body.name === 'BodyScroll' && bodyRowsComponent) ? bodyRowsComponent : bodyFrame;
        for (const row of rowsContainer.children) {
          if (row.type !== 'FRAME') continue;
          for (let i=0;i<row.children.length;i++) {
            const cell = row.children[i]; if (cell.type !== 'FRAME') continue;
            const original = (headersMeta && headersMeta[i]) ? headersMeta[i] : String(cell.name||'').replace(/\.f$/,'');
            const cfg = colSetup ? ((original ? (colSetup.find(c => String(c.name) === original) || colSetup.find(c => String(c.name).toLowerCase() === original.toLowerCase())) : null) || colSetup[i] || null) : null;
            if (cfg) applyColumnWidth(cell, cfg);
            const text = cell.findOne(n => n.type === 'TEXT');
            if (text) {
              if (options.typography) {
                try { await figma.loadFontAsync({ family: options.typography.bodyFamily || 'Roboto', style: options.typography.bodyStyle || 'Regular' }); } catch(_) {}
                try { text.fontName = { family: options.typography.bodyFamily || 'Roboto', style: options.typography.bodyStyle || 'Regular' }; } catch(_) {}
                try { text.fontSize = options.typography.bodySize || 12; } catch(_) {}
              }
              try { text.textAutoResize = 'HEIGHT'; } catch(_) {}
              try { text.layoutGrow = 1; } catch(_) {}
              if (cfg && cfg.align) { try { text.textAlignHorizontal = cfg.align; } catch(_) {} }
            }
            if (cfg && cfg.name) { try { cell.name = `${cfg.name}.f`; } catch(_) {} }
          }
        }
      } catch(_) {}
      // Persist updated headers in meta when provided
      try {
        const m = getMeta(target) || {};
        if (newHeaders && newHeaders.length) m.headers = newHeaders.slice();
        setMeta(target, m);
      } catch(_) {}
      figma.ui.postMessage({ type: 'done', count: 0 });
      return;
    }
    if (msg.type === 'captureColumnSpecs') {
      try {
        const sel = figma.currentPage.selection;
        let base = (sel && sel.length >= 1) ? findTableRoot(sel[0]) : null;
        if (!base) base = findLatestTableRootOnPage();
        if (!base) { figma.ui.postMessage({ type: 'error', message: 'Select a generated table to capture specs.' }); return; }
        const head = base.findOne(n => n.type === 'FRAME' && n.name === 'Header');
        if (!head) { figma.ui.postMessage({ type: 'error', message: 'No Header found on table.' }); return; }
        function readMode(cell) {
          try {
            if ('layoutSizingHorizontal' in cell) {
              if (cell.layoutSizingHorizontal === 'FILL' || (cell.layoutGrow && cell.layoutGrow > 0)) return 'fill';
            } else {
              if ((cell.layoutGrow && cell.layoutGrow > 0) || cell.counterAxisSizingMode === 'AUTO') return 'fill';
            }
          } catch (_) {}
          return 'px';
        }
        function readAlign(cell) {
          try { const t = cell.findOne(n => n.type === 'TEXT'); if (t) return t.textAlignHorizontal || 'LEFT'; } catch(_) {}
          return 'LEFT';
        }
        const columns = [];
        for (const cell of head.children) {
          if (cell.type !== 'FRAME') continue;
          let name = String(cell.name || '');
          name = name.replace(/^H:\s*/, '').replace(/\.f$/, '');
          const width = Math.round(cell.width || 160);
          const mode = readMode(cell);
          const align = readAlign(cell);
          columns.push({ name, width, mode, align, type: 'text' });
        }
        figma.ui.postMessage({ type: 'columnSpecs', columns });
      } catch (e) {
        figma.ui.postMessage({ type: 'error', message: 'captureColumnSpecs error: ' + (e && e.message) });
      }
      return;
    }
    if (msg.type === 'getComponents') {
      try {
        const comps = figma.root.findAll(n => n.type === 'COMPONENT').slice(0,500).map(c => ({ id: c.id, name: c.name }));
        figma.ui.postMessage({ type: 'componentsList', list: comps });
      } catch (_) { figma.ui.postMessage({ type: 'componentsList', list: [] }); }
      return;
    }
    if (msg.type === 'applyCardConfig') {
      const options = msg.options || {};
      const sel = (figma.currentPage.selection || []).filter(n => n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE');
      if (!sel.length) { figma.ui.postMessage({ type: 'error', message: 'Select one or more card frames to apply.' }); return; }
      for (const host of sel) {
        // Size
        try {
          const mode = options.cardSize && options.cardSize.mode;
          if (mode === 'px') {
            const w = Math.max(10, parseInt(options.cardSize.width||0,10)||0);
            const h = Math.max(10, parseInt(options.cardSize.height||0,10)||0);
            if (w && h) host.resizeWithoutConstraints(w,h);
          }
        } catch(_) {}
        // Layers
        const childMap = findNamedLayers(host, {});
        const layers = Array.isArray(options.layerSetup) ? options.layerSetup : [];
        for (const layer of layers) {
          const name = String(layer.name||''); if (!name) continue;
          const target = childMap[name] || childMap[name.toLowerCase()] || childMap[name.toUpperCase()] || null;
          if (layer.type === 'symbol' && layer.componentId) {
            try {
              const node = figma.getNodeById(layer.componentId);
              const comp = (node && node.type === 'COMPONENT') ? node : (node && node.type === 'INSTANCE' && node.mainComponent ? node.mainComponent : null);
              if (comp) {
                // Place instance inside target if exists; else at root
                const inst = comp.createInstance();
                if (target && 'children' in target) {
                  // clear target children
                  for (const c of target.children.slice()) c.remove();
                  target.appendChild(inst);
                } else if ('appendChild' in host) {
                  host.appendChild(inst); inst.name = name;
                }
              }
            } catch(_) {}
          }
        }
        // Persist meta on host
        const meta = getMeta(host) || {};
        meta.options = meta.options || {};
        meta.options.cardLayerSetup = layers;
        meta.options.cardSize = options.cardSize || null;
        setMeta(host, meta);
      }
      figma.ui.postMessage({ type: 'done', count: sel.length });
      return;
    }
    if (msg.type === 'getVariables') {
      try {
        const list = [];
        if ('variables' in figma && figma.variables.getLocalVariablesAsync) {
          const vars = await figma.variables.getLocalVariablesAsync();
          for (const v of vars) {
            if (v.resolvedType === 'COLOR') list.push(v.name);
          }
        }
        figma.ui.postMessage({ type: 'variablesList', list });
      } catch (_) {
        figma.ui.postMessage({ type: 'variablesList', list: [] });
      }
      return;
    }
    if (msg.type === 'resolveVarColors') {
      try {
        const names = Array.isArray(msg.names) ? msg.names : [];
        const out = {};
        if ('variables' in figma && figma.variables.getLocalVariablesAsync) {
          const vars = await figma.variables.getLocalVariablesAsync();
          for (const req of names) {
            const v = vars.find(x => x.name.toLowerCase() === String(req).toLowerCase() && x.resolvedType === 'COLOR');
            if (v) {
              const modes = Object.values(v.valuesByMode || {});
              const val = modes && modes[0];
              if (val && typeof val.r === 'number') {
                const toHex = (n)=>{
                  const h = Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2,'0');
                  return h;
                };
                const hex = `#${toHex(val.r)}${toHex(val.g)}${toHex(val.b)}`;
                out[v.name] = hex;
              }
            }
          }
        }
        figma.ui.postMessage({ type: 'varColorPreview', colors: out });
      } catch (e) {
        figma.ui.postMessage({ type: 'varColorPreview', colors: {} });
      }
      return;
    }
  } catch (e) {
    const msgText = (e && e.message) ? e.message : String(e);
    figma.notify('Error: ' + msgText);
    figma.ui.postMessage({ type: 'error', message: msgText });
  }
};
function findTableRoot(node) {
  let cur = node;
  while (cur) {
    if (cur.type === 'FRAME') {
      try {
        const head = cur.findOne(n => n.type === 'FRAME' && n.name === 'Header');
        const body = cur.findOne(n => n.type === 'FRAME' && (n.name === 'Body' || n.name === 'BodyScroll'));
        if (head && body) return cur;
      } catch (_) {}
    }
    cur = cur.parent;
  }
  return null;
}

function findLatestTableRootOnPage() {
  try {
    const nodes = figma.currentPage.children;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const root = findTableRoot(n);
      if (root) {
        // Check for our plugin meta
        const m = getMeta(root);
        if (m && m.mode === 'table') return root;
      }
    }
  } catch (_) {}
  return null;
}
