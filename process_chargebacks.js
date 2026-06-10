// process_chargebacks.js — parses closed Mechanic Claim Work orders → chargebacks_data.json

const XLSX = require('./node_modules/xlsx');
const fs   = require('fs');
const path = require('path');

const INPUT  = path.join(__dirname, 'chargebacks_report.xlsx');
const OUTPUT = path.join(__dirname, 'chargebacks_data.json');

// ─── ISSUE DETECTION ─────────────────────────────────────────────────────────
// Step 1: Extract the "mechanics claim due to X" phrase from Order Internal notes.
//         This is the most reliable source — set by the service coordinator.
// Step 2: Normalize the extracted reason text into a clean label.
// Step 3: Fall back to full-note keyword scanning if step 1 yields nothing.

function normalizeReason(raw) {
  if (!raw) return null;
  const r = raw.toLowerCase().trim();

  // SHORT MATERIAL — installer ran short, didn't cover the area
  if (/\bshort\b|cut short|being short|install short|cut wrong|cut to short|cutting to short|cut too short|lvt short|lvp short|carpet short|laminate short|tile short|vinyl short|short boards|short lvt|short lvp|short carpet|short laminate|short install|short at|plank.{0,10}short|board.{0,10}short/.test(r))
    return 'Short Material';

  // INCOMPLETE INSTALL — didn't finish the job
  if (/incomplete|not finishing|not complet|leaving unfinish|left unfinish|unfinished|not done at install|not finish|missing area|missed area|not installed|missing section|not properly finish|not properly complet|installer not finishing|installer not completing|installer missing|being incomplete/.test(r))
    return 'Incomplete Install';

  // NOT FOLLOWING WORK ORDER — ignored specs/prints/builder instructions
  if (/work order|work sheet|builder spec|prints|builder req|spec\b|builder direction|per the order|per order/.test(r))
    return 'Not Per Work Order';

  // LOOSE / COMING UP / SEPARATING — material not secured
  if (/\bloose\b|coming up|pulling away|separat|shifting|not secure|not tucked|coming loose|not locked|plank.{0,10}loose|carpet.{0,10}loose|tile.{0,10}loose|lvt.{0,10}loose|lvp.{0,10}loose|lvt coming|lvp coming|separating|lvt separ|planks separ/.test(r))
    return 'Loose / Coming Up';

  // SILICONE / CAULK — missing or poor silicone/caulk
  if (/\bsilicone\b|\bcaulk/.test(r))
    return 'Missing Silicone';

  // ADHESIVE / GLUE — not enough adhesive/glue/mortar
  if (/adhesive|lack of glue|not.{0,10}enough glue|not.{0,10}glue|lack of mortar|thinset coverage|improper.{0,10}coverage|not enough adhesive|lack of adhesive|minimal adhesive/.test(r))
    return 'Adhesive Issue';

  // DEBRIS / CLEANUP — installed over debris, messy install
  if (/\bdebris\b|clean up|clean-up|cleanup|not cleaning|messy install|installing over debris|laying over debris|sloppy clean|improper clean|left.{0,10}mess|excess grout|glue residue|guide marks/.test(r))
    return 'Debris / Cleanup';

  // OUT OF SQUARE / CROOKED / LEVEL
  if (/out of square|out of level|crooked|not square|being crooked|installed out of square|installed crooked|out of alignment|not level/.test(r))
    return 'Out of Square';

  // EXPANSION ISSUE — improper or missing expansion gap
  if (/expansion|no expansion|lack of expansion|expansion gap|not enough expansion|too much expansion|impropper expansion|improper expansion/.test(r))
    return 'Expansion Issue';

  // GROUT — grout problems (already in keyword fallback, keep here for "due to" extractions)
  if (/\bgrout\b/.test(r))
    return 'Grout Issue';

  // SEAM — visible or bad seams
  if (/\bseam\b/.test(r))
    return 'Bad Seam';

  // TRANSITION / STAIRNOSE / METALS — transition/metal trim issues
  if (/transition|stairnose|stair.?nose|reducer|naploc|t-molding|\bmetal\b|tubmold|tub mold|tub strip|cove base|stair nose|rubber shoe/.test(r))
    return 'Transition';

  // SQUEAK — floor/subfloor squeak
  if (/squeak|squak|floor squeak|subfloor squeak/.test(r))
    return 'Squeak';

  // DAMAGE / CRACKING — damaged, cracked, broken material
  if (/\bdamage\b|\bcrack\b|\bbroken\b|chipped|damaged|cracking/.test(r))
    return 'Damage';

  // WRONG MATERIAL — wrong tile/color/material installed
  if (/wrong tile|wrong grout|wrong material|incorrect tile|wrong color|wrong product/.test(r))
    return 'Wrong Material';

  // SCRATCH / STAIN
  if (/\bscratch/.test(r)) return 'Scratched';
  if (/\bstain/.test(r))   return 'Stained';

  // LIPPAGE
  if (/lippage/.test(r)) return 'Lippage';

  // BUCKLE / WRINKLE
  if (/\bbuckl/.test(r)) return 'Buckling';
  if (/\bwrinkle/.test(r)) return 'Wrinkle';

  // RE-STRETCH
  if (/re.?stretch|stretch/.test(r)) return 'Re-Stretch';

  // TACK STRIP
  if (/tack strip/.test(r)) return 'Tack Strip';

  // WORKMANSHIP — generic poor/improper work (catch-all after specifics)
  if (/poor craft|poor work|improper|imrproper|improepr|inproper|imprper|impproper|installer error|insteller error|poor install|sloppy|bad install|install error|poor fabricat/.test(r))
    return 'Workmanship';

  return null; // fallback to keyword scan
}

// Fallback: keyword scan across ALL note text (used when no "due to" phrase found)
const FALLBACK_RULES = [
  { kw: ['visible seam','bad seam','seam coming','seam apart','seam in carpet','missed seam','seams coming'], label: 'Bad Seam' },
  { kw: ['transition','stairnose','stair nose','naploc','t-molding','tub mold','tub strip','cove base'], label: 'Transition' },
  { kw: ['buckling','buckle'],                     label: 'Buckling' },
  { kw: ['lippage','lipped tile'],                 label: 'Lippage' },
  { kw: ['scratch'],                               label: 'Scratched' },
  { kw: ['stained','stain on'],                    label: 'Stained' },
  { kw: ['wrinkle'],                               label: 'Wrinkle' },
  { kw: ['re-stretch','re stretch','restretch'],   label: 'Re-Stretch' },
  { kw: ['tack strip'],                            label: 'Tack Strip' },
  { kw: ['squeak'],                                label: 'Squeak' },
  { kw: ['hollow spot','lack of mortar','delamina'], label: 'Delamination' },
  { kw: ['adhesive','lack of glue','not enough glue','lack of adhesive','minimal adhesive'], label: 'Adhesive Issue' },
  { kw: ['grout'],                                 label: 'Grout Issue' },
  { kw: ['debris','installing over debris','laying over debris','installed over debris'], label: 'Debris / Cleanup' },
  { kw: ['out of square','out of level','installed crooked'], label: 'Out of Square' },
  { kw: ['expansion gap','improper expansion','no expansion'], label: 'Expansion Issue' },
  { kw: ['silicone','caulk'],                      label: 'Missing Silicone' },
  { kw: ['short','cut short'],                     label: 'Short Material' },
  { kw: ['loose','coming up','pulling away','separating'], label: 'Loose / Coming Up' },
  { kw: ['incomplete','not finishing','unfinished'], label: 'Incomplete Install' },
  { kw: ['work order','builder spec'],             label: 'Not Per Work Order' },
  { kw: ['damage','cracked','broken','chipped'],   label: 'Damage' },
  { kw: ['wrong tile','wrong grout','wrong material'], label: 'Wrong Material' },
  { kw: ['clean up','cleanup','messy','debris'],   label: 'Debris / Cleanup' },
  { kw: ['improper','poor craft','poor work','installer error','poor install'], label: 'Workmanship' },
];

function detectIssue(notes) {
  if (!notes || !notes.length) return 'Other';

  // Step 1: find "mechanics claim due to X" in Order Internal notes first
  const internalNotes = notes.filter(n => /order.internal/i.test(n.type||''));
  const allNotes = [...internalNotes, ...notes.filter(n => !/order.internal/i.test(n.type||''))];

  for (const n of allNotes) {
    const m = (n.comment||'').match(/mechanics?\s+claim\s+due\s+to\s+([^.\n\r]{3,80})/i);
    if (m) {
      const label = normalizeReason(m[1]);
      if (label) return label;
    }
  }

  // Step 2: fallback keyword scan across all note text
  const allText = notes.map(n => (n.comment||'') + ' ' + (n.type||'')).join(' ').toLowerCase();
  for (const rule of FALLBACK_RULES) {
    if (rule.kw.some(kw => allText.includes(kw))) return rule.label;
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
