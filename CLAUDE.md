# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A static dashboard system for AFS Group's flooring installation pipeline. Seven self-contained HTML pages display data extracted from Constellation ERP exports. All data is embedded directly into the HTML files at build time — no server required. Pages are hosted on GitHub Pages at `carter7171.github.io/pipeline-dashboard`.

## Update Workflow

When a new Constellation Excel export arrives, run these two commands in order:

```bash
node process_report.js
node inject_data.js
```

Then commit and push the updated HTML files. The `process_report.js` filename constant on line 7 must be updated to match the new Excel filename first.

For chargebacks or non-billable data, run the respective parsers first:
```bash
node process_chargebacks.js
node process_nonbillable.js
node inject_data.js
```

## Architecture

**Data flow:** Excel export → `process_report.js` → `report_data.json` → `inject_data.js` → HTML pages (data embedded inline)

**No bundler, no transpiler, no framework.** Pure Node.js scripts + vanilla HTML/CSS/JS.

**Only external npm dependency:** `xlsx` (via `./node_modules/xlsx`). All other packages in `node_modules/` are transitive deps of `xlsx`.

**Injection mechanism:** Each HTML page contains a marker comment `// ── INJECT_END ──`. `inject_data.js` strips any previous `// ──── AUTO-EMBEDDED * ────` block and replaces it with a new `const PRELOADED_*` constant holding the full dataset as an inlined JSON literal, followed by a call to the page's loader function (e.g. `loadPreprocessedData(...)`, `loadLines(...)`, `loadChargebacks(...)`).

**preinspect.html** uses a different injection pattern — it matches the sentinel string `"document.getElementById('hdr-sub').textContent = 'No data loaded..."` instead of `// ── INJECT_END ──`.

## The 7 Pages

| File | Purpose |
|---|---|
| `index.html` | Main projection dashboard — open orders bucketed by period (past due / current / next / rollover / future) |
| `materials.html` | Material line item allocations per job |
| `chargebacks.html` | Installer chargeback records |
| `nonbillable.html` | Non-billable service orders |
| `postfails.html` | Post-inspection failures (parsed from Work Order Custom notes) |
| `preinspect.html` | Pre-inspection tracker for builder jobs in the next 5 business days |
| `material_risk.html` | Orders with material delivery risk (late or unconfirmed bulk) |

## process_report.js Key Logic

- Reads a Constellation "Open Orders Detailed" Excel export (multi-row format — each order spans several rows).
- Projection buckets: `past` (overdue), `likely` (current month scheduled), `possible` (current month unconfirmed), `rollover` (install date passed into current month window), `next` (next month), `future` (2+ months out), `unscheduled` (no install date).
- Detects tile/LVP jobs via keyword matching on `jobType`.
- Extracts starting price/margin from historical "Order Remark - MARGIN" notes.
- Also writes `materials_data.json` (line items).

## inject_data.js Key Logic

- Reads `report_data.json` and `materials_data.json` (and `chargebacks_data.json`, `nonbillable_data.json` if present).
- Derives `postfails` and `preinspect` data inline from the orders — no separate parser needed for those.
- Pre-inspection: only includes BUILDER + NORMAL/MODEL/SAMPLES orders scheduled within the next 5 business days that have pre-fail/pre-pass/pre-on-sched notes in their Work Order Custom entries.
- After embedding, calls Firestore via REST API to wipe the `completions` collection (checkbox state resets on each refresh). Pass `--keep-completions` to skip.
- Ends with a `fixTourSplit()` IIFE that ensures the tour's `step.body.split('\n')` call uses a literal backslash-n (not an actual LF byte), which would otherwise silently break the tour after reinjection.

## Firebase / Firestore

- Project: `afs-pipeline`
- The HTML pages load Firebase SDK from CDN and use Firestore for real-time checkbox sync (completions, post-fail statuses, pre-inspect action statuses).
- `inject_data.js` wipes Firestore collections via REST API (not the Admin SDK) using the project's API key embedded in the HTML pages.
- Password gate: `afs2025` stored in `sessionStorage` key `afs_dash_auth`.

## Tour System

`update_tour.js` patches a guided walkthrough into all 7 HTML pages. Run `node update_tour.js` after modifying tour step content. Tour steps use `sel` (CSS selector), `title`, `body`, optional `fallback`. The `showTimeout` guard variable prevents spotlight reappearing after tour close.

## Gitignored Files

```
node_modules/
*.xlsx
report_data.json
```

The generated `*_data.json` files (except `report_data.json`) **are** committed. The Excel source files are not.

## Common Pitfalls

- **LF in tour strings:** Do not use `'\\n'` inside Node.js heredocs or template literals to produce a backslash-n in the HTML — the shell converts it to an actual LF (U+000A), which causes a JavaScript syntax error in the tour IIFE. Use `String.fromCharCode(92) + 'n'` instead. The `fixTourSplit()` IIFE in `inject_data.js` auto-repairs this after each inject.
- **process_report.js line 7:** Must be updated to the new Excel filename before running — it has no auto-discovery logic.
- **Chargebacks page uses a sentinel string** for injection, not `INJECT_END`. See `inject_data.js` around the chargebacks section.
