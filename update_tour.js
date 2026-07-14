// update_tour.js — patches inlined tour.js in all 7 HTML pages
// Fixes: endTour showTimeout race, adds notes/yellow/checkbox steps to index.html
// Run: node update_tour.js

const fs   = require('fs');
const path = require('path');
const DIR  = __dirname;

const files = [
  'index.html', 'materials.html', 'chargebacks.html',
  'postfails.html', 'preinspect.html', 'material_risk.html', 'nonbillable.html',
];

// ── New TOURS.index (index.html only) ────────────────────────────────────────
const NEW_INDEX_TOUR = `    index: [
      {
        sel: 'button.logo, .logo-btn',
        title: 'Sidebar Navigation',
        body: 'Click the AFS logo anytime to open the navigation menu. Use the \u{1F4CC} pin button inside to keep it pinned open. It stays pinned across all pages.',
      },
      {
        sel: '#fc-store',
        title: 'Store Filter',
        body: 'Click store chips to include or exclude specific locations. Active stores are highlighted blue. Click again to deselect.',
      },
      {
        sel: '#ms-jobtype-btn',
        title: 'Job Type Filter',
        body: 'Click to open the job type selector. Check or uncheck types to narrow the view. Use “Select All” and “Clear All” for quick changes.',
        fallback: '.filter-bar',
      },
      {
        sel: '.chip[data-period]',
        title: 'Projection Period Tabs',
        body: 'Switch between Past Due, Current Month, Next Month, Rollover, and Future. The KPI cards and charts update instantly to match the selected period.',
        fallback: '.filter-bar',
      },
      {
        sel: '#kpi-past',
        title: 'KPI Summary Cards',
        body: 'At-a-glance revenue and gross profit for each projection window. Colors signal health — green is strong margin, red flags past-due concern.',
        fallback: '.kpi',
      },
      {
        sel: '#table-body tr:first-child',
        title: 'Double-Click Any Row for Notes',
        body: 'Double-click any row in the table to open that job\\'s notes panel. The panel slides in from the right.',
        fallback: '#table-body, .table-wrap',
      },
      {
        sel: '.notes-overlay',
        title: 'Notes Panel',
        body: 'The notes panel shows every Constellation entry for that job — inspector comments, status history, work order details, and timestamps. Scroll through the full activity log without leaving the dashboard. Click anywhere outside or press ✕ to close.',
        fallback: '#table-body tr:first-child',
      },
      {
        sel: '.chip.active.warn-chip, .kpi.k-warn, tr.row-mismatch',
        title: 'Yellow / Amber Highlights',
        body: 'Yellow always means a warning:\\n• Yellow period tab — this projection bucket has jobs at risk\\n• Yellow KPI card — revenue/GP totals for those at-risk jobs\\n• Yellow row — install date on the order header doesn\\'t match the line-item date (usually a reschedule updated in only one place)',
        fallback: '.kpi, #table-body',
      },
      {
        sel: '.done-cb',
        title: 'Completion Checkboxes',
        body: 'Checking this box marks the job as closed/delivered for your team. The row dims and is excluded from the active count — KPI totals update immediately. The checked state syncs to Firestore so everyone on the team sees the same view.',
        fallback: '#table-body tr:first-child',
      },
      {
        sel: '.btn-success',
        title: 'Export CSV',
        body: 'Downloads the current filtered view as a CSV file — paste it into Excel or share it for reporting.',
      },
    ],`;

files.forEach(function (file) {
  const fp = path.join(DIR, file);
  if (!fs.existsSync(fp)) { console.log('SKIP (not found): ' + file); return; }
  let html = fs.readFileSync(fp, 'utf8');
  if (!html.includes('/* tour.js')) { console.log('SKIP (no tour): ' + file); return; }

  let changed = 0;

  // ── Fix 1: add showTimeout variable after "var active = false;" ────────────
  const VAR_OLD = '  var active = false;\n';
  const VAR_NEW = '  var active = false;\n  var showTimeout = null;\n';
  if (html.includes(VAR_OLD) && !html.includes('var showTimeout')) {
    html = html.replace(VAR_OLD, VAR_NEW);
    changed++;
  } else if (html.includes('var showTimeout')) {
    // Already patched
  } else {
    console.warn('  WARN: showTimeout insertion point not found in ' + file);
  }

  // ── Fix 2: cancel pending timeout inside showStep ─────────────────────────
  const STEP_OLD = '    el.scrollIntoView({ block: \'nearest\', behavior: \'smooth\' });\n\n    setTimeout(function () {\n      positionSpot(el);';
  const STEP_NEW = '    el.scrollIntoView({ block: \'nearest\', behavior: \'smooth\' });\n\n    if (showTimeout) clearTimeout(showTimeout);\n    showTimeout = setTimeout(function () {\n      showTimeout = null;\n      if (!active) return;\n      positionSpot(el);';
  if (html.includes(STEP_OLD)) {
    html = html.replace(STEP_OLD, STEP_NEW);
    changed++;
  } else if (html.includes('showTimeout = setTimeout')) {
    // Already patched
  } else {
    console.warn('  WARN: showStep setTimeout not matched in ' + file);
  }

  // ── Fix 3: endTour clears the pending timeout ─────────────────────────────
  const END_OLD = "    active = false;\n    spotEl.style.display = 'none';\n    tipEl.style.display  = 'none';\n  }";
  const END_NEW = "    active = false;\n    if (showTimeout) { clearTimeout(showTimeout); showTimeout = null; }\n    spotEl.style.display = 'none';\n    tipEl.style.display  = 'none';\n  }";
  if (html.includes(END_OLD)) {
    html = html.replace(END_OLD, END_NEW);
    changed++;
  } else if (html.includes('clearTimeout(showTimeout)')) {
    // Already patched
  } else {
    console.warn('  WARN: endTour body not matched in ' + file);
  }

  // ── Fix 4: updated TOURS.index (index.html only) ─────────────────────────
  if (file === 'index.html') {
    const replaced = html.replace(
      /    index: \[[\s\S]*?    \],(?=\s*\n\s*\n?\s*materials:)/,
      NEW_INDEX_TOUR
    );
    if (replaced !== html) {
      html = replaced;
      changed++;
    } else {
      console.warn('  WARN: TOURS.index regex did not match in index.html');
    }
  }

  fs.writeFileSync(fp, html);
  console.log('UPDATED (' + changed + ' patches): ' + file);
});

console.log('\nDone.');
