/**
 * reportHtmlExport — Exports the report as a self-contained HTML file via DOM snapshot.
 *
 * Strategy:
 *   1. The caller (ReportPanel) expands all collapsible sections before calling this
 *   2. We snapshot any <canvas> elements (Cosmograph WebGL) as PNG data-URLs
 *   3. Clone the rendered report panel DOM
 *   4. Replace <canvas> with <img> in the clone
 *   5. Collect ALL CSS from the document (Chakra runtime, ReactFlow, custom)
 *   6. Clean up the clone (remove interactive-only elements, fix positioning)
 *   7. Package as a standalone HTML file and trigger download
 *
 * The CSS classes on DOM elements are preserved in the clone, and the collected
 * CSS rules (from Chakra runtime, ReactFlow, index.css) define those classes.
 * This means layout, responsiveness, and styling all work naturally — no need
 * to inline computed styles.
 */
import { ReportData } from '../types';

// ── Helpers ─────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Collect all CSS rules from every stylesheet in the document.
 * Includes Chakra runtime styles, ReactFlow styles, index.css, etc.
 */
function collectAllCSS(): string {
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        rules.push(rule.cssText);
      }
    } catch {
      // Cross-origin stylesheets throw SecurityError — skip them.
    }
  }
  return rules.join('\n');
}

/**
 * Collect CSS custom properties (variables) from the <html> element.
 * Chakra v3 sets semantic tokens as CSS variables via data-theme conditions,
 * but some may be set as inline styles or computed at runtime.
 */
function collectCSSVariables(): string {
  const html = document.documentElement;
  const computed = getComputedStyle(html);
  const vars: string[] = [];
  for (let i = 0; i < computed.length; i++) {
    const prop = computed[i];
    if (prop.startsWith('--')) {
      vars.push(`  ${prop}: ${computed.getPropertyValue(prop)};`);
    }
  }
  if (vars.length === 0) return '';
  return `:root, [data-theme="light"] {\n${vars.join('\n')}\n}`;
}

/**
 * Snapshot <canvas> elements inside a container.
 * We read the canvas data *before* cloning (canvas content doesn't survive cloneNode).
 */
function snapshotCanvases(container: HTMLElement): { index: number; dataUrl: string; width: string; height: string }[] {
  const results: { index: number; dataUrl: string; width: string; height: string }[] = [];
  const canvases = container.querySelectorAll('canvas');
  canvases.forEach((canvas, i) => {
    const rect = canvas.getBoundingClientRect();
    try {
      const dataUrl = (canvas as HTMLCanvasElement).toDataURL('image/png');
      results.push({ index: i, dataUrl, width: `${rect.width}px`, height: `${rect.height}px` });
    } catch {
      // Tainted canvas or WebGL context loss
      results.push({ index: i, dataUrl: '', width: `${rect.width}px`, height: `${rect.height}px` });
    }
  });
  return results;
}

/**
 * In the cloned DOM, replace <canvas> elements with <img> (or a placeholder).
 */
function replaceCanvasesInClone(
  clone: HTMLElement,
  snapshots: { index: number; dataUrl: string; width: string; height: string }[],
): void {
  const canvases = clone.querySelectorAll('canvas');
  canvases.forEach((canvas, i) => {
    const snap = snapshots[i];
    if (!snap) return;

    if (snap.dataUrl) {
      const img = document.createElement('img');
      img.src = snap.dataUrl;
      img.style.width = snap.width;
      img.style.height = snap.height;
      img.style.display = 'block';
      canvas.parentNode?.replaceChild(img, canvas);
    } else {
      const placeholder = document.createElement('div');
      placeholder.style.cssText = `
        width: ${snap.width}; height: ${snap.height};
        background: #f0f0f0; display: flex; align-items: center;
        justify-content: center; color: #999; font-size: 14px;
        border-radius: 8px; font-family: sans-serif;
      `;
      placeholder.textContent = 'Knowledge Graph (interactive — view in app)';
      canvas.parentNode?.replaceChild(placeholder, canvas);
    }
  });
}

/**
 * Clean up the cloned DOM for export:
 * - Fix root positioning (was position:fixed for the in-app overlay)
 * - Remove elements marked with data-export-hide
 * - Remove ReactFlow controls (zoom/fit buttons — not functional without React)
 * - Disable interactive affordances (cursors, hover states on buttons)
 * - Flatten sticky header
 */
function cleanUpClone(clone: HTMLElement): void {
  // Fix root positioning — the panel is a full-screen fixed overlay in the app
  clone.style.position = 'relative';
  clone.style.top = 'auto';
  clone.style.left = 'auto';
  clone.style.right = 'auto';
  clone.style.bottom = 'auto';
  clone.style.zIndex = 'auto';
  clone.style.overflowY = 'visible';
  clone.style.height = 'auto';

  // Remove elements flagged for export removal (TOC, download button, theme toggle, knowledge graph)
  clone.querySelectorAll('[data-export-hide]').forEach(el => el.remove());

  // Remove ReactFlow controls (zoom/fit buttons — not functional in static HTML)
  clone.querySelectorAll('.react-flow__controls, .react-flow__attribution').forEach(el => el.remove());

  // Disable pointer cursor on buttons (not clickable in static HTML)
  clone.querySelectorAll('button, [role="button"]').forEach(el => {
    (el as HTMLElement).style.cursor = 'default';
  });

  // Flatten sticky header to static
  const stickyHeader = clone.querySelector('[data-report-header]');
  if (stickyHeader) {
    (stickyHeader as HTMLElement).style.position = 'relative';
    (stickyHeader as HTMLElement).style.backdropFilter = 'none';
  }
}


// ── Interactivity script (vanilla JS, injected into exported HTML) ──

const EXPORT_INTERACTIVITY_SCRIPT = `<script>
(function() {
  var cards = document.getElementById('export-tooltip-cards');
  if (!cards) return;

  // ── Shared tooltip logic ──────────────────────────────────────
  var activeTooltip = null;

  function dismissTooltip() {
    if (activeTooltip) {
      activeTooltip.remove();
      activeTooltip = null;
    }
  }

  /** Show a floating card tooltip near the given element. */
  function showCardTooltip(anchorEl, cardEl, e) {
    if (e) e.stopPropagation();
    dismissTooltip();

    var rect = anchorEl.getBoundingClientRect();
    var tooltip = document.createElement('div');
    tooltip.className = 'export-tooltip';

    var clone = cardEl.cloneNode(true);
    clone.style.display = 'block';
    tooltip.appendChild(clone);

    // Position: prefer below, flip above if near bottom
    var spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow > 280) {
      tooltip.style.top = (rect.bottom + window.scrollY + 8) + 'px';
    } else {
      tooltip.style.top = (rect.top + window.scrollY - 280) + 'px';
    }

    // Center horizontally on anchor, clamp to viewport
    var left = rect.left + rect.width / 2 - 140;
    left = Math.max(8, Math.min(left, window.innerWidth - 296));
    tooltip.style.left = left + 'px';
    tooltip.style.position = 'absolute';

    document.body.appendChild(tooltip);
    activeTooltip = tooltip;
  }

  // ── Risk chart: click dot → show card in sidebar ──────────────
  var sidebar = document.querySelector('[data-risk-sidebar]');
  var sidebarDefault = sidebar ? sidebar.innerHTML : '';

  document.querySelectorAll('[data-consequence-id]').forEach(function(dot) {
    var id = dot.getAttribute('data-consequence-id');
    var card = cards.querySelector('[data-tooltip-card="' + id + '"]');
    if (!card || !sidebar) return;

    dot.addEventListener('click', function(e) {
      e.stopPropagation();
      sidebar.innerHTML = '';
      var clone = card.cloneNode(true);
      clone.style.display = 'block';
      sidebar.appendChild(clone);
    });
  });

  // ── Consequence chips: click → show floating card ─────────────
  document.querySelectorAll('[data-chip-id]').forEach(function(chip) {
    var id = chip.getAttribute('data-chip-id');
    var card = cards.querySelector('[data-tooltip-card="' + id + '"]');
    if (!card) return;
    chip.addEventListener('click', function(e) { showCardTooltip(chip, card, e); });
  });

  // ── Map nodes: click → show floating card ─────────────────────
  document.querySelectorAll('.react-flow__node').forEach(function(node) {
    var id = node.getAttribute('data-id');
    if (!id || id === 'seed') return;
    var card = cards.querySelector('[data-tooltip-card="' + id + '"]');
    if (!card) return;
    node.style.cursor = 'pointer';
    node.addEventListener('click', function(e) { showCardTooltip(node, card, e); });
  });

  // ── Global dismiss ────────────────────────────────────────────
  document.addEventListener('click', function(e) {
    if (activeTooltip && !activeTooltip.contains(e.target)) {
      dismissTooltip();
    }
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') dismissTooltip();
  });
})();
<\/script>`;


// ── Main export function ────────────────────────────────────────

/**
 * Build a standalone HTML string from the rendered report panel.
 *
 * Call this AFTER expanding all sections (the caller manages that state).
 * The panelEl should be the live DOM element with data-report-panel.
 *
 * Returns the full HTML string, or null on failure.
 */
export async function buildReportHtmlString(
  panelEl: HTMLElement,
  report: ReportData,
): Promise<string | null> {
  try {
    // 1. Snapshot canvas elements BEFORE cloning (canvas content doesn't survive clone)
    const canvasSnapshots = snapshotCanvases(panelEl);

    // 2. Clone the entire panel DOM
    const clone = panelEl.cloneNode(true) as HTMLElement;

    // 3. Replace <canvas> with <img> in the clone
    replaceCanvasesInClone(clone, canvasSnapshots);

    // 4. Clean up the clone (positioning, interactive elements)
    cleanUpClone(clone);

    // 5. Collect all CSS rules from the document
    //    This captures Chakra runtime classes, ReactFlow styles, index.css, @font-face, etc.
    const allCSS = collectAllCSS();
    const cssVars = collectCSSVariables();

    // 6. Build standalone HTML
    const title = report.input.title || 'Futurescaper Report';
    const html = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} — Futurescaper Report</title>
  <!-- Font fallback: JetBrains Mono from Google Fonts (app fonts may not resolve from file://) -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
/* === Captured CSS variables === */
${cssVars}

/* === Captured document styles === */
${allCSS}

/* === Export overrides === */
html, body {
  margin: 0;
  padding: 0;
  background: #fff;
  color: #1a1a1a;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
/* Ensure SVGs render correctly */
svg { overflow: visible; }
/* Clickable elements in export */
[data-chip-id] { cursor: pointer; }
[data-consequence-id] { cursor: pointer; }
/* Floating tooltip styling */
.export-tooltip {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  filter: drop-shadow(0 4px 16px rgba(0,0,0,0.18));
}
/* Print-friendly */
@media print {
  body { background: #fff; }
  [data-report-header] { position: static !important; }
}
  </style>
</head>
<body data-theme="light">
${clone.outerHTML}
${EXPORT_INTERACTIVITY_SCRIPT}
</body>
</html>`;

    return html;
  } catch (err) {
    console.error('Report HTML build failed:', err);
    return null;
  }
}

/**
 * Snapshot the rendered report panel and download as a standalone HTML file.
 *
 * Call this AFTER expanding all sections (the caller manages that state).
 * The panelEl should be the live DOM element with data-report-panel.
 */
export async function snapshotReportToHtml(
  panelEl: HTMLElement,
  report: ReportData,
): Promise<void> {
  const html = await buildReportHtmlString(panelEl, report);
  if (!html) {
    alert('Failed to export report. See console for details.');
    return;
  }

  const title = report.input.title || 'Futurescaper Report';
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
  a.download = `${slug}-report.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
