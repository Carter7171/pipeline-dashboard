// process_nonbillable.js — parses closed orders for non-billable builder services
// Pull a Delivered/Closed Orders report from Constellation filtered to the relevant
// service offerings (e.g. WARRANTY, SERVICE, CALLBACK), save as nonbillable_report.xlsx
// in this folder, then run: node process_nonbillable.js

const XLSX = require('./node_modules/xlsx');
const fs   = require('fs');
const path = require('path');

const INPUT  = path.join(__dirname, 'nonbillable_report.xlsx');
const OUTPUT = path.join(__dirname, 'nonbillable_data.json');

if (!fs.existsSync(INPUT)) {
  console.error(`ERROR: ${INPUT} not found.`);
  console.error('Pull a Closed Orders report from Constellation, save as nonbillable_report.xlsx, and re-run.');
  process.exit(1);
}

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
  const d = new Date(s); return isNaN(d) ? null : d;
}
function parseDollar(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const n = parseFloat(String(val).replace(/[$,]/g, ''));
  return isNaN(n) ? 0 : n;
}
function cell(row, idx) {
  const v = row ? row[idx] : undefined;
  return v !== undefined && v !== null ? String(v).trim() : '';
}
function cellNum(row, idx) { return parseDollar(row ? row[idx] : undefined); }
function afterLabel(s) { const i = s.indexOf(':'); return i >= 0 ? s.slice(i+1).trim() : s.trim(); }
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

// Simplify job type into a category for display
function categorizeJobType(jobType) {
  const jt = (jobType || '').toLowerCase();
  if (/carpet/.test(jt))                    return 'Carpet';
  if (/tile/.test(jt))                      return 'Tile';
  if (/resilient|lvp|lvt|vinyl/.test(jt))   return 'Resilient / LVP';
  if (/hardwood/.test(jt))                  return 'Hardwood';
  if (/laminate/.test(jt))                  return 'Laminate';
  if (/concrete/.test(jt))                  return 'Concrete';
  if (/prep/.test(jt))                      return 'Prep';
  if (/inspect/.test(jt))                   return 'Inspection';
  if (/multiple/.test(jt))                  return 'Multiple';
  if (/cork|bamboo|stone/.test(jt))         return 'Specialty';
  return 'Other';
}

console.log('Reading:', INPUT);
const wb  = XLSX.readFile(INPUT, { cellDates: false, dense: false });
const ws  = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
console.log(`Total rows: ${raw.length}  Sheet: ${wb.SheetNames[0]}`);

const records = [];
let i = 0;
while (i < raw.length) {
  const row = raw[i];
  const c0  = cell(row, 0);

  if (/^Order\s*#\s*:/i.test(c0)) {
    const orderNumber = afterLabel(c0);
    let store = '', closedDateStr = '', orderDateStr = '',
        customerName = '', customerType = '', serviceOffering = '',
        orderType = '', currentStatus = '';
    let revenue = 0, cost = 0;
    const notes = [];
    let totalsFound = false, inNotesSection = false;

    for (let j = i; j < Math.min(i + 150, raw.length); j++) {
      const r  = raw[j];
      const r0 = cell(r, 0);
      if (j > i && /^Order\s*#\s*:/i.test(r0)) break;

      if (/^Order\s*Totals\s*:/i.test(r0)) {
        // Non-billable orders: col 9 = cost absorbed by AFS; nothing billed to builder
        cost    = cellNum(r, 9);
        revenue = 0;
        totalsFound = true;
        continue;
      }

      if (!totalsFound) {
        if (/^Sold\s*To\s*:?$/i.test(r0)) {
          customerType    = cell(r, 8) || findInRow(r, /Customer\s*Type\s*:/i);
          const nameRow   = raw[j+1] || [];
          customerName    = cell(nameRow, 0);
          serviceOffering = cell(nameRow, 8) || findInRow(nameRow, /Service\s*Offering\s*:/i);
          const typeRow   = raw[j+2] || [];
          orderType       = cell(typeRow, 8) || findInRow(typeRow, /Order\s*Type\s*:/i);
          continue;
        }
        for (let k = 0; k < (r.length || 15); k++) {
          const v = cell(r, k);
          if (!v) continue;
          if (/^Store\s*:/i.test(v) && !store) store = afterLabel(v).split(/\s+/)[0];
          if (/^Install\s*Date\s*:/i.test(v) && !closedDateStr) closedDateStr = afterLabel(v);
          if (/^Order\s*Date\s*:/i.test(v) && !orderDateStr) orderDateStr = afterLabel(v);
        }
      } else {
        if (/^Note.Remark\s*Type/i.test(r0)) { inNotesSection = true; continue; }
        if (inNotesSection && r0 && cell(r, 2)) {
          notes.push({ type: r0, date: cell(r, 1), comment: cell(r, 2) });
        }
      }
    }

    // Only keep non-billable service work — skip chargebacks and billable
    if (!/^SERVICE WORK NON-BILLABLE$/i.test(serviceOffering)) { i++; continue; }
    // Skip records with obviously corrupted cost/revenue values
    if (Math.abs(cost) > 500000 || Math.abs(revenue) > 500000) { i++; continue; }

    const closedDate  = parseDate(closedDateStr);
    const orderDate   = parseDate(orderDateStr);
    const grossProfit = revenue - cost;

    // Build notes summary from first notable note
    let notesSummary = '';
    for (const n of notes) {
      if (n.comment && n.comment.length > 10) {
        notesSummary = n.comment.substring(0, 300).replace(/\n/g, ' ');
        break;
      }
    }

    records.push({
      orderNumber,
      customerName,
      store,
      closedDate:      closedDate ? closedDate.toISOString().split('T')[0] : null,
      orderDate:       orderDate  ? orderDate.toISOString().split('T')[0]  : null,
      jobType:         orderType,
      serviceOffering,
      customerType,
      revenue:         Math.round(revenue     * 100) / 100,
      cost:            Math.round(cost        * 100) / 100,
      grossProfit:     Math.round(grossProfit * 100) / 100,
      issueTag:        categorizeJobType(orderType),
      notesSummary,
      notes,
    });
  }
  i++;
}

console.log(`\nParsed ${records.length} records`);

// Breakdown by builder
const byBuilder = {};
records.forEach(r => {
  byBuilder[r.customerName] = (byBuilder[r.customerName] || 0) + 1;
});
const builderList = Object.entries(byBuilder).sort((a,b)=>b[1]-a[1]).slice(0, 10);
console.log('\nTop 10 Builders:');
builderList.forEach(([n,c]) => console.log(`  ${c.toString().padStart(4)}  ${n}`));

const totalCost = records.reduce((s,r) => s + r.cost, 0);
const totalRev  = records.reduce((s,r) => s + r.revenue, 0);
console.log(`\nTotal Cost Absorbed: $${Math.round(totalCost).toLocaleString()}`);
console.log(`Total Revenue:       $${Math.round(totalRev).toLocaleString()}`);
console.log(`Net Loss:            $${Math.round(totalCost - totalRev).toLocaleString()}`);

const stores = [...new Set(records.map(r=>r.store).filter(Boolean))].sort();
console.log('Stores:', stores.join(', '));

const output = { generatedAt: new Date().toISOString(), recordCount: records.length, data: records };
fs.writeFileSync(OUTPUT, JSON.stringify(output));
console.log(`\nWrote ${OUTPUT}`);
