// process_report.js — parses multi-row order blocks from Constellation Excel export

const XLSX = require('./node_modules/xlsx');
const fs   = require('fs');
const path = require('path');

const INPUT  = path.join(__dirname, 'OrdersDetailed20260529030503.xlsx');
const OUTPUT = path.join(__dirname, 'report_data.json');

const TODAY           = new Date(); TODAY.setHours(0,0,0,0);
const CUR_MONTH_END   = new Date(TODAY.getFullYear(), TODAY.getMonth()+1, 0, 23, 59, 59);
const NEXT_MONTH_START= new Date(TODAY.getFullYear(), TODAY.getMonth()+1, 1);
const NEXT_MONTH_END  = new Date(TODAY.getFullYear(), TODAY.getMonth()+2, 0, 23, 59, 59);

const TILE_KW = ['tile','ceramic','porcelain','stone','mosaic','travertine','marble','slate','natural stone','quarry','lvt','lvp','vinyl plank','vinyl tile'];

function parseDate(val) {
  if (!val && val !== 0) return null;
  if (val instanceof Date) return isNaN(val) ? null : val;
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(d) ? null : d;
  }
  const s = String(val).trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) { const d = new Date(+m[3],+m[1]-1,+m[2]); return isNaN(d)?null:d; }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) { const d = new Date(+m[1],+m[2]-1,+m[3]); return isNaN(d)?null:d; }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function parseDollar(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const n = parseFloat(String(val).replace(/[$,]/g, ''));
  return isNaN(n) ? 0 : n;
}

function isTile(jobType) {
  if (!jobType) return false;
  const lc = String(jobType).toLowerCase();
  return TILE_KW.some(k => lc.includes(k));
}

function daysBeforeMonthEnd(date) {
  const d = new Date(date); d.setHours(0,0,0,0);
  const last = new Date(d.getFullYear(), d.getMonth()+1, 0); last.setHours(0,0,0,0);
  return Math.round((last - d) / 86400000);
}

function project(date, jobType) {
  if (!date) return { cat:'unscheduled', label:'No Install Date', section:'unscheduled' };
  const d = new Date(date); d.setHours(0,0,0,0);
  if (d < TODAY) return { cat:'past', label:'Past / Overdue', section:'past' };
  const tile = isTile(jobType);
  const dbe  = daysBeforeMonthEnd(d);
  if (d <= CUR_MONTH_END) {
    if (tile) {
      if (dbe >= 4 && dbe <= 6) return { cat:'possible', label:'Possible Close This Month', section:'current' };
      if (dbe < 4)              return { cat:'rollover', label:'Probable Close Next Month',  section:'current' };
      return { cat:'likely', label:'Likely Close This Month', section:'current' };
    } else {
      if (dbe >= 2 && dbe <= 3) return { cat:'possible', label:'Possible Close This Month', section:'current' };
      if (dbe < 2)              return { cat:'rollover', label:'Probable Close Next Month',  section:'current' };
      return { cat:'likely', label:'Likely Close This Month', section:'current' };
    }
  }
  if (d >= NEXT_MONTH_START && d <= NEXT_MONTH_END) {
    const dbeNext = daysBeforeMonthEnd(d);
    let label = 'Next Month Scheduled';
    if (tile && dbeNext < 4)  label = 'Next Month → Rolls Further';
    if (!tile && dbeNext < 2) label = 'Next Month → Rolls Further';
    return { cat:'next', label, section:'next' };
  }
  return { cat:'future', label:'Future (2+ months)', section:'future' };
}

// Load as array-of-arrays
console.log('Reading:', INPUT);
const wb = XLSX.readFile(INPUT, { cellDates: false, dense: false });
const ws = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
console.log(`Total rows: ${raw.length}  Sheet: ${wb.SheetNames[0]}`);

function cell(row, idx) {
  const v = row ? row[idx] : undefined;
  return v !== undefined && v !== null ? String(v).trim() : '';
}

function cellNum(row, idx) {
  const v = row ? row[idx] : undefined;
  return parseDollar(v);
}

function afterLabel(s) {
  const i = s.indexOf(':');
  return i >= 0 ? s.slice(i+1).trim() : s.trim();
}

function findInRow(row, labelRegex) {
  if (!row) return '';
  for (let k = 0; k < row.length; k++) {
    const v = cell(row, k);
    if (labelRegex.test(v)) {
      const afterColon = afterLabel(v);
      if (afterColon && !labelRegex.test(afterColon)) return afterColon;
      return cell(row, k+1);
    }
  }
  return '';
}

// Parse order blocks — anchor: col 0 matches "Order #:"
const orders = [];
let i = 0;
while (i < raw.length) {
  const row = raw[i];
  const c0  = cell(row, 0);

  if (/^Order\s*#\s*:/i.test(c0)) {
    const orderNumber = afterLabel(c0);

    let store = '', installDateStr = '',
        customerName = '', customerType = '', serviceOffering = '',
        orderType = '', currentStatus = '',
        lot = '', tract = '';
    let revenue = 0, cost = 0;
    const notes = [];
    let totalsFound = false, inNotesSection = false;

    for (let j = i; j < Math.min(i + 150, raw.length); j++) {
      const r  = raw[j];
      const r0 = cell(r, 0);

      // Stop at next order block
      if (j > i && /^Order\s*#\s*:/i.test(r0)) break;

      // "Order Totals:" — capture revenue/cost, switch to notes-collection mode
      if (/^Order\s*Totals\s*:/i.test(r0)) {
        revenue = cellNum(r, 9);
        cost    = cellNum(r, 10);
        totalsFound = true;
        continue;
      }

      if (!totalsFound) {
        // ── PRE-TOTALS: extract order header fields ────────────────────────

        // Line-level internal notes (col 1 = "Order Line Internal", col 3 = comment)
        if (!r0 && /^Order\s*Line\s*Internal$/i.test(cell(r, 1)) && cell(r, 3)) {
          notes.push({ type: 'Line Note', date: '', comment: cell(r, 3) });
          continue;
        }

        // "Sold To:" row — customer block
        if (/^Sold\s*To\s*:?$/i.test(r0)) {
          customerType    = cell(r, 8) || findInRow(r, /Customer\s*Type\s*:/i);
          const nameRow   = raw[j+1] || [];
          customerName    = cell(nameRow, 0);
          serviceOffering = cell(nameRow, 8) || findInRow(nameRow, /Service\s*Offering\s*:/i);
          const typeRow   = raw[j+2] || [];
          orderType       = cell(typeRow, 8) || findInRow(typeRow, /Order\s*Type\s*:/i);
          for (let s2 = j; s2 < Math.min(j+6, raw.length); s2++) {
            if (/Sch\s*Pro\s*Status\s*:/i.test(cell(raw[s2], 4))) {
              currentStatus = cell(raw[s2], 5);
              break;
            }
            const sv = findInRow(raw[s2], /Sch\s*Pro\s*Status\s*:/i);
            if (sv) { currentStatus = sv; break; }
          }
          continue;
        }

        // Scan all cells for store / install date / lot / tract
        for (let k = 0; k < (r.length || 15); k++) {
          const v = cell(r, k);
          if (!v) continue;
          if (/^Store\s*:/i.test(v) && !store)
            store = afterLabel(v).split(/\s+/)[0];
          if (/^Install\s*Date\s*:/i.test(v) && !installDateStr)
            installDateStr = afterLabel(v);
          if (/^Lot\s*:/i.test(v) && !lot) {
            const afterC = afterLabel(v);
            lot = afterC || cell(r, k+1);
          }
          if (/^Tract\s*:/i.test(v) && !tract) {
            const afterC = afterLabel(v);
            tract = afterC || cell(r, k+1);
          }
        }

      } else {
        // ── POST-TOTALS: collect end-of-order notes ────────────────────────

        // "Note/Remark Type" header row
        if (/^Note.Remark\s*Type/i.test(r0)) {
          inNotesSection = true;
          continue;
        }

        // Note data rows: col 0 = type, col 1 = date, col 2 = comment
        if (inNotesSection && r0 && cell(r, 2)) {
          notes.push({
            type:    r0,
            date:    cell(r, 1),
            comment: cell(r, 2), // col 2 only (repeated in cols 3–9)
          });
        }
      }
    }

    // Install Date only — no Key Date fallback
    const dateStr = installDateStr;
    const installDate = parseDate(dateStr);
    const proj        = project(installDate, orderType);
    const grossProfit = revenue - cost;
    const margin      = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    orders.push({
      orderNumber,
      customerName,
      store,
      jobType: orderType,
      scheduledInstallDate: installDate ? installDate.toISOString().split('T')[0] : null,
      currentStatus,
      serviceOffering,
      customerType,
      proj,
      tile: isTile(orderType),
      revenue:     Math.round(revenue     * 100) / 100,
      cost:        Math.round(cost        * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      margin:      Math.round(margin      * 10)  / 10,
      lot:         String(lot   || '').trim(),
      tract:       String(tract || '').trim(),
      notes,
    });
  }
  i++;
}

console.log(`\nParsed ${orders.length} orders`);

const counts = { past:0, likely:0, possible:0, rollover:0, next:0, future:0, unscheduled:0 };
const vol    = { past:0, likely:0, possible:0, rollover:0, next:0, future:0, unscheduled:0 };
const gp     = { past:0, likely:0, possible:0, rollover:0, next:0, future:0, unscheduled:0 };

orders.forEach(o => {
  counts[o.proj.cat] = (counts[o.proj.cat]||0) + 1;
  vol[o.proj.cat]    = (vol[o.proj.cat]||0)    + o.revenue;
  gp[o.proj.cat]     = (gp[o.proj.cat]||0)     + o.grossProfit;
});

const fmt = n => '$' + Math.round(n).toLocaleString();

console.log('\n=== PROJECTION SUMMARY ===');
console.log(`${'Category'.padEnd(28)} ${'Count'.padStart(6)} ${'Revenue'.padStart(14)} ${'Gross Profit'.padStart(14)}`);
for (const cat of ['likely','possible','rollover','next','future','past','unscheduled']) {
  console.log(`${cat.padEnd(28)} ${String(counts[cat]).padStart(6)} ${fmt(vol[cat]).padStart(14)} ${fmt(gp[cat]).padStart(14)}`);
}
const totalRev = Object.values(vol).reduce((a,b)=>a+b,0);
const totalGP  = Object.values(gp).reduce((a,b)=>a+b,0);
console.log(`\nTotal Revenue: ${fmt(totalRev)}`);
console.log(`Total Gross Profit: ${fmt(totalGP)}`);
console.log(`Overall Margin: ${totalRev > 0 ? (totalGP/totalRev*100).toFixed(1) : 0}%`);

// Check for zero-revenue orders
const zeroRev = orders.filter(o => o.revenue === 0).length;
console.log(`\nZero-revenue orders: ${zeroRev} of ${orders.length}`);

const stores = [...new Set(orders.map(r=>r.store).filter(Boolean))].sort();
console.log('Stores:', stores.join(', '));

console.log('\nSample orders (first 3):');
orders.slice(0,3).forEach((o,idx) => console.log(`  [${idx}]`, JSON.stringify(o)));

const output = {
  generatedAt: new Date().toISOString(),
  rowCount: orders.length,
  summary: { counts, vol, gp },
  data: orders,
};
fs.writeFileSync(OUTPUT, JSON.stringify(output));
console.log(`\nWrote ${OUTPUT}`);
