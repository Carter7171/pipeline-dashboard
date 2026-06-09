// process_chargebacks.js — parses closed Mechanic Claim Work orders → chargebacks_data.json

const XLSX = require('./node_modules/xlsx');
const fs   = require('fs');
const path = require('path');

const INPUT  = path.join(__dirname, 'chargebacks_report.xlsx');
const OUTPUT = path.join(__dirname, 'chargebacks_data.json');

// ─── ISSUE KEYWORD TAXONOMY ──────────────────────────────────────────────────
// Precedence order — first match wins
const ISSUE_RULES = [
  { keywords: ['seam'],                 label: 'Bad Seam' },
  { keywords: ['transition'],           label: 'Transition' },
  { keywords: ['buckl'],                label: 'Buckling' },
  { keywords: ['lippage'],              label: 'Lippage' },
  { keywords: ['scratch'],              label: 'Scratched' },
  { keywords: ['stain'],                label: 'Stained' },
  { keywords: ['wrinkle'],              label: 'Wrinkle' },
  { keywords: ['re-stretch','restretch','re stretch','stretch'], label: 'Re-Stretch' },
  { keywords: ['tack strip','tackstrip'], label: 'Tack Strip' },
  { keywords: ['damage','damaged'],     label: 'Damage' },
  { keywords: ['adhesive','glue'],      label: 'Adhesive' },
  { keywords: ['grout'],                label: 'Grout Issue' },
  { keywords: ['measur'],               label: 'Measure Error' },
  { keywords: ['pattern','misalign'],   label: 'Pattern Error' },
  { keywords: ['gap'],                  label: 'Gap' },
  { keywords: ['clean','debris','trash','sweep'], label: 'Cleanup' },
  { keywords: ['cut ','cutting'],       label: 'Poor Cut' },
  { keywords: ['warranty'],             label: 'Warranty' },
  { keywords: ['repair'],               label: 'Repair' },
  { keywords: ['squeaky','squeak'],     label: 'Squeak' },
  { keywords: ['hollow','delamina'],    label: 'Delamination' },
  { keywords: ['lippage'],              label: 'Lippage' },
];

function detectIssue(notes) {
  if (!notes || !notes.length) return 'Other';
  const allText = notes.map(n => (n.comment || '') + ' ' + (n.type || '')).join(' ').toLowerCase();
  for (const rule of ISSUE_RULES) {
    if (rule.keywords.some(kw => allText.includes(kw))) return rule.label;
  }
  return 'Other';
}

function notesSummary(notes) {
  if (!notes || !notes.length) return '';
  // Prefer work order custom notes, fall back to any note with content
  const best = notes.find(n => /work order/i.test(n.type||'') && (n.comment||'').length > 20)
            || notes.find(n => (n.comment||'').length > 20)
            || notes[0];
  return (best ? best.comment || '' : '').replace(/\s+/g, ' ').trim().substring(0, 250);
}

// ─── HELPERS (same as process_report.js) ─────────────────────────────────────
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
function cell(row, idx) {
  const v = row ? row[idx] : undefined;
  return v !== undefined && v !== null ? String(v).trim() : '';
}
function cellNum(row, idx) { return parseDollar(row ? row[idx] : undefined); }
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

// ─── LOAD FILE ───────────────────────────────────────────────────────────────
if (!fs.existsSync(INPUT)) {
  console.error(`ERROR: ${INPUT} not found.`);
  console.error('Please download the Closed Orders Mechanic Claim Work report from Constellation and save it as chargebacks_report.xlsx in this folder.');
  process.exit(1);
}

console.log('Reading:', INPUT);
const wb  = XLSX.readFile(INPUT, { cellDates: false, dense: false });
const ws  = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
console.log(`Total rows: ${raw.length}  Sheet: ${wb.SheetNames[0]}`);

// ─── PARSE ORDER BLOCKS ───────────────────────────────────────────────────────
const chargebacks = [];
let i = 0;
while (i < raw.length) {
  const row = raw[i];
  const c0  = cell(row, 0);

  if (/^Order\s*#\s*:/i.test(c0)) {
    const orderNumber = afterLabel(c0);

    let store = '', installDateStr = '', orderDateStr = '',
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
        revenue = cellNum(r, 9);
        cost    = cellNum(r, 10);
        totalsFound = true;
        continue;
      }

      if (!totalsFound) {
        // "Sold To:" row — customer name block
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

        // Scan cells for store, install date, order date
        for (let k = 0; k < (r.length || 15); k++) {
          const v = cell(r, k);
          if (!v) continue;
          if (/^Store\s*:/i.test(v) && !store)
            store = afterLabel(v).split(/\s+/)[0];
          if (/^Install\s*Date\s*:/i.test(v) && !installDateStr)
            installDateStr = afterLabel(v);
          if (/^Order\s*Date\s*:/i.test(v) && !orderDateStr)
            orderDateStr = afterLabel(v);
        }

      } else {
        // Post-totals notes
        if (/^Note.Remark\s*Type/i.test(r0)) { inNotesSection = true; continue; }
        if (inNotesSection && r0 && cell(r, 2)) {
          notes.push({ type: r0, date: cell(r, 1), comment: cell(r, 2) });
        }
        // Work Order Custom notes also appear pre-totals sometimes — capture them
        if (!inNotesSection && /^Work\s*Order\s*Custom/i.test(r0) && cell(r, 2)) {
          notes.push({ type: r0, date: cell(r, 1), comment: cell(r, 2) });
        }
      }
    }

    // Extract installer name — strip " - BACK CHARGE" suffix
    const installerName = customerName
      .replace(/\s*[-–—]\s*BACK\s*CHARGE\s*$/i, '')
      .replace(/\s*[-–—]\s*BC\s*$/i, '')
      .trim();

    const closedDate = parseDate(installDateStr);
    const orderDate  = parseDate(orderDateStr);
    const grossProfit = revenue - cost;

    chargebacks.push({
      orderNumber,
      installerName: installerName || customerName,
      customerNameRaw: customerName,
      store,
      closedDate:  closedDate  ? closedDate.toISOString().split('T')[0]  : null,
      orderDate:   orderDate   ? orderDate.toISOString().split('T')[0]   : null,
      jobType:     orderType,
      serviceOffering,
      currentStatus,
      revenue:      Math.round(revenue      * 100) / 100,
      cost:         Math.round(cost         * 100) / 100,
      grossProfit:  Math.round(grossProfit  * 100) / 100,
      issueTag:     detectIssue(notes),
      notesSummary: notesSummary(notes),
      notes,
    });
  }
  i++;
}

console.log(`\nParsed ${chargebacks.length} chargebacks`);

// ─── SUMMARY ─────────────────────────────────────────────────────────────────
const stores    = [...new Set(chargebacks.map(c=>c.store).filter(Boolean))].sort();
const installers= [...new Set(chargebacks.map(c=>c.installerName).filter(Boolean))].sort();
const issueCounts = {};
chargebacks.forEach(c => { issueCounts[c.issueTag] = (issueCounts[c.issueTag]||0) + 1; });
const totalAmount = chargebacks.reduce((s,c)=>s+(c.revenue||0), 0);

console.log(`Stores: ${stores.join(', ')}`);
console.log(`Unique installers: ${installers.length}`);
console.log(`Total chargeback amount: $${Math.round(totalAmount).toLocaleString()}`);
console.log('\nIssue breakdown:');
Object.entries(issueCounts).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(`  ${String(v).padStart(5)}  ${k}`));

// ─── INSTALLER TOTALS ─────────────────────────────────────────────────────────
const byInstaller = {};
chargebacks.forEach(c => {
  const n = c.installerName || 'Unknown';
  if (!byInstaller[n]) byInstaller[n] = { count:0, total:0, issues:{} };
  byInstaller[n].count++;
  byInstaller[n].total += (c.revenue||0);
  byInstaller[n].issues[c.issueTag] = (byInstaller[n].issues[c.issueTag]||0)+1;
});

console.log('\nTop installers by chargeback count:');
Object.entries(byInstaller)
  .sort((a,b)=>b[1].count-a[1].count)
  .slice(0,10)
  .forEach(([n,v])=>console.log(`  ${String(v.count).padStart(4)}  $${Math.round(v.total).toLocaleString().padStart(8)}  ${n}`));

// ─── OUTPUT ───────────────────────────────────────────────────────────────────
const output = {
  generatedAt: new Date().toISOString(),
  recordCount: chargebacks.length,
  summary: { totalAmount: Math.round(totalAmount*100)/100, uniqueInstallers: installers.length, issueCounts, byInstaller },
  data: chargebacks,
};
fs.writeFileSync(OUTPUT, JSON.stringify(output));
console.log(`\nWrote ${OUTPUT}`);
