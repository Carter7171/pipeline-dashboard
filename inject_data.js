// inject_data.js — embeds processed report_data.json into index.html

const fs   = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'report_data.json');
const HTML_FILE = path.join(__dirname, 'index.html');

const reportData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const records    = reportData.data;
console.log(`Embedding ${records.length} orders into dashboard...`);

let html = fs.readFileSync(HTML_FILE, 'utf8');

// Remove any previously injected block
html = html.replace(/\/\/ ──── AUTO-EMBEDDED DATA[\s\S]*?\/\/ ──── END AUTO-EMBEDDED DATA\n?/g, '');

const loadFn = `
// ──── AUTO-EMBEDDED DATA (generated ${new Date().toISOString().slice(0,10)}) ────
const PRELOADED_DATA = ${JSON.stringify(records)};

function loadPreprocessedData(records) {
  const BADGE_MAP = {
    past:'b-past', likely:'b-likely', possible:'b-possible',
    rollover:'b-rollover', next:'b-next', future:'b-future'
  };
  S.rawData = records.map((r, i) => ({
    _i: i,
    orderNumber:         r.orderNumber         || '',
    customerName:        r.customerName        || '',
    store:               r.store               || '',
    jobType:             r.jobType             || '',
    scheduledInstallDate: r.scheduledInstallDate
      ? new Date(r.scheduledInstallDate + 'T12:00:00') : null,
    currentStatus:       r.currentStatus       || '',
    serviceOffering:     r.serviceOffering     || '',
    customerType:        r.customerType        || '',
    proj: { ...r.proj, badge: BADGE_MAP[r.proj.cat] || 'b-future' },
    tile:        r.tile,
    revenue:     r.revenue      || 0,
    cost:        r.cost         || 0,
    grossProfit: r.grossProfit  || 0,
    margin:      r.margin       || 0,
    notes:       r.notes        || [],
    lot:         r.lot          || '',
    tract:       r.tract        || '',
    jobNumber:   r.jobNumber    || '',
    startingPrice:  r.startingPrice  != null ? r.startingPrice  : null,
    startingMargin: r.startingMargin != null ? r.startingMargin : null,
  }));

  const stores    = uniq(S.rawData.map(r=>r.store).filter(Boolean)).sort();
  const services  = uniq(S.rawData.map(r=>r.serviceOffering).filter(Boolean)).sort();
  const custTypes = uniq(S.rawData.map(r=>r.customerType).filter(Boolean)).sort();

  S.activeStores    = new Set(stores);
  S.activeServices  = new Set(services);
  S.activeCustTypes = new Set(custTypes);

  buildChips('fc-store',    stores,    S.activeStores,    'store');
  buildChips('fc-service',  services,  S.activeServices,  'service');
  buildChips('fc-custtype', custTypes, S.activeCustTypes, 'cust');

  populateSelect('fsel-store',    stores,    'All Stores');
  populateSelect('fsel-custtype', custTypes, 'All Cust. Types');

  const jobTypes = uniq(S.rawData.map(r=>r.jobType).filter(Boolean)).sort();
  buildJobTypePanel(jobTypes);  // initializes S.activeJobTypes and S.allJobTypes

  const customers = uniq(S.rawData.map(r=>r.customerName).filter(Boolean)).sort();
  buildCustomerPanel(customers);  // initializes S.activeCustomers and S.allCustomers

  document.getElementById('kn-current').textContent = MONTHS[TODAY.getMonth()];
  document.getElementById('kn-next').textContent    = MONTHS[(TODAY.getMonth()+1)%12];
  document.getElementById('lbl-updated').textContent =
    \`\${records.length.toLocaleString()} jobs · \${new Date().toLocaleDateString()}\`;
  document.getElementById('upload-section').style.display = 'none';
  document.getElementById('dashboard').style.display      = 'block';

  applyFilters();
  toast(\`Loaded \${records.length.toLocaleString()} jobs from Constellation report\`, 'success');
}

loadPreprocessedData(PRELOADED_DATA);
// ──── END AUTO-EMBEDDED DATA
`;

// Inject just before closing </script>
html = html.replace('</script>\n</body>\n</html>', loadFn + '</script>\n</body>\n</html>');

fs.writeFileSync(HTML_FILE, html);
console.log(`Done — updated ${HTML_FILE}`);
console.log(`File size: ${(fs.statSync(HTML_FILE).size / 1024).toFixed(0)} KB`);

// ─── MATERIALS PAGE ───────────────────────────────────────────────────────
const MATERIALS_DATA = path.join(__dirname, 'materials_data.json');
const MATERIALS_HTML = path.join(__dirname, 'materials.html');
if (fs.existsSync(MATERIALS_DATA) && fs.existsSync(MATERIALS_HTML)) {
  const matRaw = JSON.parse(fs.readFileSync(MATERIALS_DATA, 'utf8'));
  const matRecords = matRaw.data || [];
  console.log(`\nEmbedding ${matRecords.length} line items into materials page...`);

  let mhtml = fs.readFileSync(MATERIALS_HTML, 'utf8');
  // Strip any previous injected block
  mhtml = mhtml.replace(/\/\/ ──── AUTO-EMBEDDED MATERIALS[\s\S]*?\/\/ ──── END AUTO-EMBEDDED MATERIALS\n?/g, '');

  const matBlock = `
// ──── AUTO-EMBEDDED MATERIALS (generated ${new Date().toISOString().slice(0,10)}) ────
const PRELOADED_MATERIALS = ${JSON.stringify(matRecords)};
loadLines(PRELOADED_MATERIALS);
// ──── END AUTO-EMBEDDED MATERIALS
`;

  mhtml = mhtml.replace('</script>\n\n</body>', matBlock + '</script>\n\n</body>');

  fs.writeFileSync(MATERIALS_HTML, mhtml);
  console.log(`Done — updated ${MATERIALS_HTML}`);
  console.log(`File size: ${(fs.statSync(MATERIALS_HTML).size / 1024).toFixed(0)} KB`);
} else {
  console.log('Skipping materials page (materials_data.json or materials.html not found)');
}

// ─── CHARGEBACKS PAGE ─────────────────────────────────────────────────────────
const CHARGEBACKS_DATA = path.join(__dirname, 'chargebacks_data.json');
const CHARGEBACKS_HTML = path.join(__dirname, 'chargebacks.html');
if (fs.existsSync(CHARGEBACKS_DATA) && fs.existsSync(CHARGEBACKS_HTML)) {
  const cbRaw = JSON.parse(fs.readFileSync(CHARGEBACKS_DATA, 'utf8'));
  const cbRecords = cbRaw.data || [];
  console.log(`\nEmbedding ${cbRecords.length} chargeback records into chargebacks page...`);

  let chtml = fs.readFileSync(CHARGEBACKS_HTML, 'utf8');
  chtml = chtml.replace(/\/\/ ──── AUTO-EMBEDDED CHARGEBACKS[\s\S]*?\/\/ ──── END AUTO-EMBEDDED CHARGEBACKS\n?/g, '');

  const cbBlock = `
// ──── AUTO-EMBEDDED CHARGEBACKS (generated ${new Date().toISOString().slice(0,10)}) ────
const PRELOADED_CHARGEBACKS = ${JSON.stringify(cbRecords)};
loadChargebacks(PRELOADED_CHARGEBACKS);
// ──── END AUTO-EMBEDDED CHARGEBACKS
`;
  chtml = chtml.replace(
    "document.getElementById('hdr-sub').textContent = 'No data loaded — run inject_data.js after process_chargebacks.js';",
    cbBlock + "\ndocument.getElementById('hdr-sub').textContent = 'No data loaded — run inject_data.js after process_chargebacks.js';"
  );

  fs.writeFileSync(CHARGEBACKS_HTML, chtml);
  console.log(`Done — updated ${CHARGEBACKS_HTML}`);
  console.log(`File size: ${(fs.statSync(CHARGEBACKS_HTML).size / 1024).toFixed(0)} KB`);
} else {
  console.log('Skipping chargebacks page (chargebacks_data.json or chargebacks.html not found)');
}

// ─── POST FAILS PAGE ──────────────────────────────────────────────────────────
const POSTFAILS_HTML = path.join(__dirname, 'postfails.html');
if (fs.existsSync(POSTFAILS_HTML)) {
  // Extract post fail orders from report_data.json (already loaded above)
  const postfailRecords = [];

  for (const order of records) {
    // Find Work Order Custom notes containing "post fail".
    // Notes accumulate multiple inspection entries separated by "______" lines.
    // We split each note into entries and look for the MOST RECENT one labelled "post fail".
    const wocNotes = (order.notes || []).filter(n =>
      /work\s*order\s*custom/i.test(n.type || '')
    );
    if (!wocNotes.length) continue;

    // Collect all individual post-fail inspection entries across all WOC notes
    let postFailEntries = [];

    for (const n of wocNotes) {
      const comment = n.comment || '';
      // Split into sections on separator lines (8+ underscores)
      const sections = comment.split(/_{8,}/);
      for (const section of sections) {
        const s = section.trim();
        if (!s) continue;
        // Must contain "post fail" (case insensitive, allow "post  fail" with extra spaces)
        if (!/post\s+fail/i.test(s)) continue;
        // Must NOT be "post pass/passed" or "pre fail/pass"
        if (/post\s*pass|pre\s*fail|pre\s*pass/i.test(s)) continue;
        // Extract timestamp from first line: "Inspector Name M/D/YYYY, H:MM:SS AM/PM"
        const firstLine = s.split('\n')[0].trim();
        const tsMatch = firstLine.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})/);
        let entryDate = null;
        if (tsMatch) {
          entryDate = new Date(`${tsMatch[3]}-${tsMatch[1].padStart(2,'0')}-${tsMatch[2].padStart(2,'0')}T${tsMatch[4].padStart(2,'0')}:${tsMatch[5]}:${tsMatch[6]}`);
        } else if (n.date) {
          entryDate = new Date(n.date);
        }
        postFailEntries.push({ section: s, entryDate, noteDate: n.date });
      }
    }

    if (!postFailEntries.length) continue;

    // Sort entries newest-first
    postFailEntries.sort((a, b) => {
      if (!a.entryDate && !b.entryDate) return 0;
      if (!a.entryDate) return 1;
      if (!b.entryDate) return -1;
      return b.entryDate - a.entryDate;
    });

    // Synthesize a "pfNote" from the most recent entry
    const bestEntry = postFailEntries[0];
    const latestNoteComment = bestEntry.section;

    // Sort by date descending — most recent first
    // Parse inspector name from first line of the most recent entry: "Name M/D/YYYY, H:MM:SS"
    const firstLine = latestNoteComment.split('\n')[0].trim();
    const nameMatch = firstLine.match(/^([A-Za-z][A-Za-z\s\.]+?)\s+\d{1,2}\/\d{1,2}\/\d{4}/);
    const inspector = nameMatch ? nameMatch[1].trim() : '';

    // Post fail date from the entry's parsed timestamp
    let postFailDate = null;
    if (bestEntry.entryDate && !isNaN(bestEntry.entryDate)) {
      postFailDate = bestEntry.entryDate.toISOString().split('T')[0];
    } else {
      const m = latestNoteComment.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (m) postFailDate = `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
    }

    // Extract numbered issues from the entry (lines starting with 1., 2., -, •, etc.)
    const postFailIssues = [];
    const entryLines = latestNoteComment.split(/\n|\r/);
    for (const line of entryLines) {
      const m = line.trim().match(/^(?:\d+\.|[-•])\s*(.+)/);
      if (m && m[1].length > 3) postFailIssues.push(m[1].trim());
    }

    postfailRecords.push({
      orderNumber:         order.orderNumber || '',
      customerName:        order.customerName || '',
      store:               order.store || '',
      jobType:             order.jobType || '',
      scheduledInstallDate: order.scheduledInstallDate
        ? (order.scheduledInstallDate instanceof Date
            ? order.scheduledInstallDate.toISOString().split('T')[0]
            : String(order.scheduledInstallDate).slice(0,10))
        : null,
      currentStatus:       order.currentStatus || '',
      lot:                 order.lot || '',
      tract:               order.tract || '',
      jobNumber:           order.jobNumber || '',
      postFailDate,
      postFailInspector:   inspector,
      postFailNote:        latestNoteComment.substring(0, 600),
      postFailIssues,
      notes:               order.notes || [],
    });
  }

  console.log(`\nEmbedding ${postfailRecords.length} post fail records into post fails page...`);

  // Sort by post fail date descending
  postfailRecords.sort((a,b) => {
    if (!a.postFailDate) return 1;
    if (!b.postFailDate) return -1;
    return b.postFailDate.localeCompare(a.postFailDate);
  });

  let pfhtml = fs.readFileSync(POSTFAILS_HTML, 'utf8');
  pfhtml = pfhtml.replace(/\/\/ ──── AUTO-EMBEDDED POSTFAILS[\s\S]*?\/\/ ──── END AUTO-EMBEDDED POSTFAILS\n?/g, '');

  const pfBlock = `
// ──── AUTO-EMBEDDED POSTFAILS (generated ${new Date().toISOString().slice(0,10)}) ────
const PRELOADED_POSTFAILS = ${JSON.stringify(postfailRecords)};
loadPostFails(PRELOADED_POSTFAILS);
// ──── END AUTO-EMBEDDED POSTFAILS
`;

  pfhtml = pfhtml.replace(
    "document.getElementById('hdr-sub').textContent = 'No data loaded — run inject_data.js after pulling a new report';",
    pfBlock + "\ndocument.getElementById('hdr-sub').textContent = 'No data loaded — run inject_data.js after pulling a new report';"
  );

  fs.writeFileSync(POSTFAILS_HTML, pfhtml);
  console.log(`Done — updated ${POSTFAILS_HTML}`);
  console.log(`File size: ${(fs.statSync(POSTFAILS_HTML).size / 1024).toFixed(0)} KB`);

  // Export the post fail order numbers so Firestore cleanup can use them
  global._postfailOrderNumbers = new Set(postfailRecords.map(r => r.orderNumber));
} else {
  console.log('Skipping post fails page (postfails.html not found)');
}

// ─── CLEAR FIRESTORE COMPLETIONS ──────────────────────────────────────────
// Every new report wipes previous checked-off state so the team starts fresh.
// Pass --keep-completions on the command line to skip this step.
const https = require('https');
const FIREBASE_PROJECT = 'afs-pipeline';
const COMPLETIONS_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/completions`;

function httpReq(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function clearFirestoreCompletions() {
  if (process.argv.includes('--keep-completions')) {
    console.log('\n(Keeping completion checkboxes — --keep-completions flag set.)');
    return;
  }
  console.log('\nClearing Firestore completions (checked-off rows)...');
  try {
    let totalDeleted = 0;
    let pageToken = null;
    do {
      const url = `${COMPLETIONS_BASE}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
      const listRes = await httpReq(url);
      if (listRes.status !== 200) {
        console.warn(`  list failed: HTTP ${listRes.status} ${listRes.body.substring(0,200)}`);
        return;
      }
      const obj = JSON.parse(listRes.body);
      const docs = obj.documents || [];
      pageToken = obj.nextPageToken || null;
      for (const d of docs) {
        // d.name like "projects/afs-pipeline/databases/(default)/documents/completions/CG12345"
        const delRes = await httpReq(`https://firestore.googleapis.com/v1/${d.name}`, 'DELETE');
        if (delRes.status === 200) totalDeleted++;
        else console.warn(`  delete failed for ${d.name}: HTTP ${delRes.status}`);
      }
    } while (pageToken);
    console.log(`  Cleared ${totalDeleted} completion entr${totalDeleted===1?'y':'ies'}.`);
  } catch (e) {
    console.warn('  Could not clear completions (network/Firestore issue):', e.message);
  }
}

clearFirestoreCompletions();

// ─── CLEAN UP STALE POST FAIL STATUSES ────────────────────────────────────────
// Delete postfail_status entries for orders no longer in the open order report.
// This keeps the tracker clean as jobs close and fall off the report.
async function cleanStalePostfailStatuses() {
  const activeOrders = global._postfailOrderNumbers;
  if (!activeOrders || activeOrders.size === 0) return;
  const BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/postfail_status`;
  console.log('\nCleaning stale post fail statuses...');
  try {
    let totalDeleted = 0;
    let pageToken = null;
    do {
      const url = `${BASE}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
      const listRes = await httpReq(url);
      if (listRes.status !== 200) { console.warn(`  list failed: HTTP ${listRes.status}`); return; }
      const obj = JSON.parse(listRes.body);
      const docs = obj.documents || [];
      pageToken = obj.nextPageToken || null;
      for (const d of docs) {
        // Extract orderNumber from document name path
        const orderNumber = d.name.split('/').pop();
        if (!activeOrders.has(orderNumber)) {
          const delRes = await httpReq(`https://firestore.googleapis.com/v1/${d.name}`, 'DELETE');
          if (delRes.status === 200) totalDeleted++;
        }
      }
    } while (pageToken);
    if (totalDeleted > 0) console.log(`  Removed ${totalDeleted} stale post fail status entr${totalDeleted===1?'y':'ies'}.`);
    else console.log('  No stale post fail statuses found.');
  } catch (e) {
    console.warn('  Could not clean post fail statuses:', e.message);
  }
}

cleanStalePostfailStatuses();

// ─── PRE-INSPECTION TRACKER ───────────────────────────────────────────────────
const PREINSPECT_HTML = path.join(__dirname, 'preinspect.html');
if (fs.existsSync(PREINSPECT_HTML)) {

  // ── Business day helpers ──────────────────────────────────────────────────
  function getNext5BusinessDays() {
    const dates = new Set();
    const cur = new Date(); cur.setHours(0,0,0,0);
    // Include today if it's a weekday
    if (cur.getDay() !== 0 && cur.getDay() !== 6) dates.add(cur.toISOString().split('T')[0]);
    const d = new Date(cur);
    while (dates.size < 5) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) dates.add(d.toISOString().split('T')[0]);
    }
    return dates;
  }
  function businessDaysUntil(dateStr) {
    if (!dateStr) return 999;
    const target = new Date(dateStr + 'T00:00:00');
    const today  = new Date(); today.setHours(0,0,0,0);
    if (target < today) return -1;
    if (target.getTime() === today.getTime()) return 0;
    let days = 0; const cur = new Date(today);
    while (cur < target) {
      cur.setDate(cur.getDate() + 1);
      if (cur.getDay() !== 0 && cur.getDay() !== 6) days++;
    }
    return days;
  }

  // ── Date normalization helper ─────────────────────────────────────────────
  function toISO(dateStr) {
    if (!dateStr) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0,10);
    const m = String(dateStr).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m) {
      const yr = m[3].length === 2 ? '20'+m[3] : m[3];
      return `${yr}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
    }
    return null;
  }

  // ── Build true install date map from line items ───────────────────────────
  // Group materialLines by orderNumber; pick most common non-inspection lineInstallDate
  const linesByOrder = {};
  if (fs.existsSync(path.join(__dirname, 'materials_data.json'))) {
    const matData = JSON.parse(fs.readFileSync(path.join(__dirname, 'materials_data.json'), 'utf8')).data || [];
    matData.forEach(ln => {
      if (!ln.lineInstallDate || !ln.orderNumber) return;
      // Exclude inspection lines
      if (/inspect|pre.?insp|slab.?insp|slab\s*insp/i.test(ln.style || '')) return;
      const isoDate = toISO(ln.lineInstallDate);
      if (!isoDate) return;
      if (!linesByOrder[ln.orderNumber]) linesByOrder[ln.orderNumber] = {};
      const d = linesByOrder[ln.orderNumber];
      d[isoDate] = (d[isoDate] || 0) + 1;
    });
  }
  // Build inspection line map (lines with inspection-related descriptions)
  const inspLinesByOrder = {};
  if (fs.existsSync(path.join(__dirname, 'materials_data.json'))) {
    const matData = JSON.parse(fs.readFileSync(path.join(__dirname, 'materials_data.json'), 'utf8')).data || [];
    matData.forEach(ln => {
      if (!ln.lineInstallDate || !ln.orderNumber) return;
      if (!/inspect|pre.?insp|slab.?insp/i.test(ln.style || '')) return;
      const isoDate = toISO(ln.lineInstallDate);
      if (!isoDate) return;
      if (!inspLinesByOrder[ln.orderNumber]) inspLinesByOrder[ln.orderNumber] = [];
      inspLinesByOrder[ln.orderNumber].push(isoDate);
    });
  }

  function getTrueInstallDate(orderNumber, fallback) {
    const d = linesByOrder[orderNumber];
    if (!d) return fallback;
    // Pick most frequent date (already normalized to ISO)
    const best = Object.entries(d).sort((a,b) => b[1]-a[1])[0];
    return best ? best[0] : fallback;
  }

  // ── Filter to Builder NORMAL/MODEL/SAMPLES + SCHEDULED/JOB CUT/INSP FAILED ─
  const window5 = getNext5BusinessDays();
  const VALID_STATUS   = new Set(['SCHEDULED', 'JOB CUT', 'INSPECTION FAILED - HALT', 'NEEDS RESCHEDULED']);
  const VALID_CT       = new Set(['BUILDER']);
  const VALID_SO       = /^(normal|model.*parade|samples)/i;

  const preinspectRecords = [];

  for (const order of records) {
    if (!VALID_CT.has(order.customerType || '')) continue;
    if (!VALID_SO.test(order.serviceOffering || '')) continue;
    if (!VALID_STATUS.has(order.currentStatus || '')) continue;

    const headerDate  = order.scheduledInstallDate
      ? String(order.scheduledInstallDate).slice(0,10) : null;
    const trueDate    = getTrueInstallDate(order.orderNumber, headerDate);
    if (!trueDate || !window5.has(trueDate)) continue;

    const daysOut = businessDaysUntil(trueDate);

    // ── Pre-fail detection from Work Order Custom notes ───────────────────
    const wocNotes = (order.notes || []).filter(n => /work.*order.*custom/i.test(n.type||''));

    let preFailEntries = [];
    let hasPrePassSignal = false;
    let hasBulderContactSignal = false;

    for (const n of wocNotes) {
      const sections = (n.comment || '').split(/_{8,}/);
      for (const section of sections) {
        const s = section.trim();
        if (!s) continue;

        // Parse timestamp from first line
        const firstLine = s.split('\n')[0].trim();
        const tsMatch = firstLine.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})/);
        let entryDate = null;
        if (tsMatch) {
          entryDate = new Date(`${tsMatch[3]}-${tsMatch[1].padStart(2,'0')}-${tsMatch[2].padStart(2,'0')}T${tsMatch[4].padStart(2,'0')}:${tsMatch[5]}:${tsMatch[6]}`);
        } else if (n.date) {
          const d = new Date(n.date); if (!isNaN(d)) entryDate = d;
        }

        // Pre pass / ready signal
        if (/pre\s*pass|pre\s*ready|pre\s*passed|ready\s+to\s+go/i.test(s)) {
          hasPrePassSignal = true;
        }
        // Builder contact signal
        if (/reached\s+out|emailed.*builder|emailed.*super|texted.*super|called.*builder/i.test(s)) {
          hasBulderContactSignal = true;
        }

        // Pre fail entry — must contain "pre fail", exclude "pre pass/ready" and "post fail"
        if (!/pre\s+fail/i.test(s)) continue;
        if (/pre\s*pass|pre\s*ready|post\s*fail/i.test(s)) continue;

        // Extract numbered issues
        const issues = [];
        s.split(/\n|\r/).forEach(line => {
          const m = line.trim().match(/^(?:\d+\.|[-•])\s*(.+)/);
          if (m && m[1].length > 3) issues.push(m[1].trim());
        });

        // Inspector name from first line
        const nameMatch = firstLine.match(/^([A-Za-z][A-Za-z\s\.]+?)\s+\d{1,2}\/\d{1,2}\/\d{4}/);
        const inspector = nameMatch ? nameMatch[1].trim() : '';

        preFailEntries.push({ section: s, entryDate, inspector, issues });
      }
    }

    // Determine preStatus
    let preStatus = 'no_pre';
    let preFailDate = null, preFailInspector = '', preFailNote = '', preFailIssues = [];

    if (preFailEntries.length > 0) {
      // Sort newest first
      preFailEntries.sort((a,b) => {
        if (!a.entryDate && !b.entryDate) return 0;
        if (!a.entryDate) return 1; if (!b.entryDate) return -1;
        return b.entryDate - a.entryDate;
      });
      const latest = preFailEntries[0];
      preFailInspector = latest.inspector;
      preFailIssues    = latest.issues;
      preFailNote      = latest.section.substring(0, 600);
      if (latest.entryDate && !isNaN(latest.entryDate)) {
        preFailDate = latest.entryDate.toISOString().split('T')[0];
      }

      if (hasPrePassSignal) {
        preStatus = 'pre_pass';
      } else {
        preStatus = 'pre_fail';
      }
    }

    // Check for pre-inspection line before true install date
    // Only override pre_fail → pre_on_sched if the inspection line is AFTER the pre-fail date
    // (meaning a NEW pre was scheduled after the fail — resolution in progress)
    if (inspLinesByOrder[order.orderNumber] && preStatus !== 'pre_pass') {
      const inspDates = inspLinesByOrder[order.orderNumber];
      const today = new Date(); today.setHours(0,0,0,0);
      const todayISO = today.toISOString().split('T')[0];
      const hasNewPreLine = inspDates.some(d => {
        if (!d || !trueDate) return false;
        if (d >= trueDate) return false; // inspection must be before install
        if (preFailDate && d <= preFailDate) return false; // must be AFTER the pre-fail date
        return true; // future or post-fail inspection line
      });
      if (hasNewPreLine) preStatus = 'pre_on_sched';
      else if (preStatus === 'no_pre') {
        // Has an inspection line but no fail notes — upcoming pre inspection is scheduled
        const hasAnyPreLine = inspDates.some(d => d && trueDate && d < trueDate);
        if (hasAnyPreLine) preStatus = 'pre_on_sched';
      }
    }

    // Skip orders with no pre-inspection notes at all
    if (preStatus === 'no_pre') continue;

    preinspectRecords.push({
      orderNumber:      order.orderNumber || '',
      customerName:     order.customerName || '',
      store:            order.store || '',
      jobType:          order.jobType || '',
      jobNumber:        order.jobNumber || '',
      lot:              order.lot || '',
      tract:            order.tract || '',
      trueInstallDate:  trueDate,
      headerInstallDate: headerDate,
      currentStatus:    order.currentStatus || '',
      daysOut,
      preStatus,
      preFailDate,
      preFailInspector,
      preFailNote,
      preFailIssues,
      notes: order.notes || [],
    });
  }

  // Sort: urgency rank asc, then daysOut asc
  const urgRank = { critical:0, warning:1, watch:2, no_pre:3, ok:4 };
  function getUrgRank(r) {
    if (r.preStatus === 'pre_pass' || r.preStatus === 'pre_on_sched') return 4; // ok
    if (r.preStatus === 'pre_fail') {
      if (r.daysOut <= 1) return 0;
      if (r.daysOut <= 3) return 1;
      return 2;
    }
    // no_pre
    if (r.daysOut <= 1) return 0;
    if (r.daysOut <= 3) return 1;
    return 3;
  }
  preinspectRecords.sort((a,b) => {
    const ra = getUrgRank(a), rb = getUrgRank(b);
    if (ra !== rb) return ra - rb;
    return a.daysOut - b.daysOut;
  });

  console.log(`\nEmbedding ${preinspectRecords.length} pre-inspection records into pre-inspect page...`);

  let pihtml = fs.readFileSync(PREINSPECT_HTML, 'utf8');
  pihtml = pihtml.replace(/\/\/ ──── AUTO-EMBEDDED PREINSPECT[\s\S]*?\/\/ ──── END AUTO-EMBEDDED PREINSPECT\n?/g, '');

  const piBlock = `
// ──── AUTO-EMBEDDED PREINSPECT (generated ${new Date().toISOString().slice(0,10)}) ────
const PRELOADED_PREINSPECT = ${JSON.stringify(preinspectRecords)};
loadPreInspect(PRELOADED_PREINSPECT);
// ──── END AUTO-EMBEDDED PREINSPECT
`;

  pihtml = pihtml.replace(
    "document.getElementById('hdr-sub').textContent = 'No data loaded — run inject_data.js after pulling a new report';",
    piBlock + "\ndocument.getElementById('hdr-sub').textContent = 'No data loaded — run inject_data.js after pulling a new report';"
  );

  fs.writeFileSync(PREINSPECT_HTML, pihtml);
  console.log(`Done — updated ${PREINSPECT_HTML}`);
  console.log(`File size: ${(fs.statSync(PREINSPECT_HTML).size / 1024).toFixed(0)} KB`);

  global._preinspectOrderNumbers = new Set(preinspectRecords.map(r => r.orderNumber));

  // ── Cleanup stale preinspect_status docs ─────────────────────────────────
  async function cleanStalePreinspectStatuses() {
    const active = global._preinspectOrderNumbers;
    if (!active || active.size === 0) return;
    const BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/preinspect_status`;
    try {
      let deleted = 0, pageToken = null;
      do {
        const url = `${BASE}?pageSize=300${pageToken?`&pageToken=${encodeURIComponent(pageToken)}`:''}`;
        const res = await httpReq(url);
        if (res.status !== 200) { console.warn(`  preinspect list failed: HTTP ${res.status}`); return; }
        const obj = JSON.parse(res.body);
        for (const d of (obj.documents||[])) {
          const on = d.name.split('/').pop();
          if (!active.has(on)) {
            const r = await httpReq(`https://firestore.googleapis.com/v1/${d.name}`, 'DELETE');
            if (r.status === 200) deleted++;
          }
        }
        pageToken = obj.nextPageToken || null;
      } while (pageToken);
      if (deleted > 0) console.log(`  Removed ${deleted} stale preinspect status entries.`);
    } catch(e) { console.warn('  Could not clean preinspect statuses:', e.message); }
  }
  cleanStalePreinspectStatuses();

} else {
  console.log('Skipping pre-inspect page (preinspect.html not found)');
}

// ─── MATERIAL RISK PAGE ───────────────────────────────────────────────────────
const MAT_RISK_HTML = path.join(__dirname, 'material_risk.html');
if (fs.existsSync(MAT_RISK_HTML) && fs.existsSync(path.join(__dirname, 'materials_data.json'))) {

  const TODAY_ISO = new Date().toISOString().split('T')[0];

  // Parse "On Order M/D/YYYY" from rawStatus → return "YYYY-MM-DD" or null
  function parseETA(rawStatus) {
    if (!rawStatus) return null;
    const m = rawStatus.match(/on\s*order\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
    if (!m) return null;
    return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
  }

  // True for bulk floor-covering materials only (not accessories)
  function isBulkMaterial(ln) {
    // prCode 25 = transitions — always exclude
    if ((ln.prCode || 0) === 25) return false;
    // UM-based primary signal: SF (square feet) or SY (square yards)
    const um = (ln.um || '').trim().toUpperCase();
    const isBulkUM = um === 'SF' || um === 'SY';
    // Keyword exclusion list (accessories)
    const desc = ((ln.style || '') + ' ' + (ln.color || '')).toLowerCase();
    const excluded = /transition|adhesive|grout|mortar|caulk|base\s+mold|base\b|trim|tack\s*strip|threshold|reducer/i.test(desc);
    if (excluded) return false;
    if (isBulkUM) return true;
    // Secondary: keyword match on material type when UM is not SF/SY
    return /\blvp\b|luxury\s*vinyl|carpet|vinyl\s*plank|laminate|\btile\b|hardwood|ceramic|porcelain/i.test(desc);
  }

  function daysBetween(fromISO, toISO) {
    if (!fromISO || !toISO) return null;
    const a = new Date(fromISO + 'T00:00:00');
    const b = new Date(toISO  + 'T00:00:00');
    if (isNaN(a) || isNaN(b)) return null;
    return Math.round((b - a) / 86400000);
  }

  const matData = JSON.parse(fs.readFileSync(path.join(__dirname, 'materials_data.json'), 'utf8')).data || [];

  // Group lines by orderNumber; also pull installDate (use lineInstallDate, fallback to line's order header)
  const orderMap = {};
  matData.forEach(ln => {
    const on = ln.orderNumber;
    if (!on) return;
    if (!orderMap[on]) {
      orderMap[on] = {
        orderNumber:  on,
        customerName: ln.customerName || '',
        store:        ln.store || '',
        installDate:  null,
        lines: [],
      };
    }
    orderMap[on].lines.push(ln);
    // Pick most common non-inspection lineInstallDate as the order install date
    const ld = ln.lineInstallDate;
    if (ld && !/inspect/i.test(ln.style || '')) {
      if (!orderMap[on].installDate) orderMap[on].installDate = ld;
    }
  });

  const riskRecords = [];

  for (const on of Object.keys(orderMap)) {
    const order = orderMap[on];
    // Normalize installDate to ISO
    let installISO = null;
    if (order.installDate) {
      const raw = String(order.installDate).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(raw)) installISO = raw.slice(0,10);
      else {
        const mm = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
        if (mm) {
          const yr = mm[3].length === 2 ? '20'+mm[3] : mm[3];
          installISO = `${yr}-${mm[1].padStart(2,'0')}-${mm[2].padStart(2,'0')}`;
        }
      }
    }

    const alerts = [];

    for (const ln of order.lines) {
      const status = (ln.status || '').trim();
      const rawStatus = (ln.rawStatus || ln.status || '').trim();

      // ── Late Delivery alert ───────────────────────────────────────────────
      if (/^on\s*order/i.test(status) || /^on\s*order/i.test(rawStatus)) {
        const eta = parseETA(rawStatus) || parseETA(status);
        if (eta && installISO) {
          const daysLate = daysBetween(installISO, eta); // positive = ETA after install
          if (daysLate !== null && daysLate > 0) {
            alerts.push({
              alertType: 'late_delivery',
              style:     ln.style || '',
              color:     ln.color || '',
              qty:       ln.qty   || '',
              um:        ln.um    || '',
              eta,
              daysLate,
            });
          }
        }
      }

      // ── Unconfirmed Bulk alert ─────────────────────────────────────────────
      if (/^none$/i.test(status) && isBulkMaterial(ln)) {
        alerts.push({
          alertType: 'unconfirmed_bulk',
          style:     ln.style || '',
          color:     ln.color || '',
          qty:       ln.qty   || '',
          um:        ln.um    || '',
        });
      }
    }

    if (!alerts.length) continue;

    const daysUntilInstall = installISO ? daysBetween(TODAY_ISO, installISO) : null;
    const hasLateDelivery  = alerts.some(a => a.alertType === 'late_delivery');
    const hasUnconfirmed   = alerts.some(a => a.alertType === 'unconfirmed_bulk');

    // Pull notes from the matching open order (if available)
    const openOrder = records.find(r => r.orderNumber === on);

    riskRecords.push({
      orderNumber:      on,
      customerName:     order.customerName,
      store:            order.store,
      installDate:      installISO,
      daysUntilInstall,
      hasLateDelivery,
      hasUnconfirmed,
      alerts,
      notes: openOrder ? (openOrder.notes || []) : [],
    });
  }

  // Sort by urgencyRank then daysUntilInstall
  riskRecords.sort((a, b) => {
    function rank(r) {
      const d = r.daysUntilInstall;
      if (d === null) return 999;
      if (d < 0) return 0;
      if (d <= 3) return 1;
      if (d <= 7) return 2;
      if (d <= 14) return 3;
      return 4;
    }
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    const da = a.daysUntilInstall ?? 999, db = b.daysUntilInstall ?? 999;
    return da - db;
  });

  const lateCount = riskRecords.filter(r => r.hasLateDelivery).length;
  const noneCount = riskRecords.filter(r => r.hasUnconfirmed).length;
  console.log(`\nEmbedding ${riskRecords.length} material risk orders into material_risk page...`);
  console.log(`  Late delivery: ${lateCount}  Unconfirmed bulk: ${noneCount}`);

  let mrhtml = fs.readFileSync(MAT_RISK_HTML, 'utf8');
  mrhtml = mrhtml.replace(/\/\/ ──── AUTO-EMBEDDED MATERIALRISK[\s\S]*?\/\/ ──── END AUTO-EMBEDDED MATERIALRISK\n?/g, '');

  const mrBlock = `
// ──── AUTO-EMBEDDED MATERIALRISK (generated ${new Date().toISOString().slice(0,10)}) ────
const PRELOADED_MATERIAL_RISK = ${JSON.stringify(riskRecords)};
loadMaterialRisk(PRELOADED_MATERIAL_RISK);
// ──── END AUTO-EMBEDDED MATERIALRISK
`;

  mrhtml = mrhtml.replace(
    "document.getElementById('hdr-sub').textContent = 'No data loaded — run inject_data.js';",
    mrBlock + "\ndocument.getElementById('hdr-sub').textContent = 'No data loaded — run inject_data.js';"
  );

  fs.writeFileSync(MAT_RISK_HTML, mrhtml);
  console.log(`Done — updated ${MAT_RISK_HTML}`);
  console.log(`File size: ${(fs.statSync(MAT_RISK_HTML).size / 1024).toFixed(0)} KB`);
} else {
  console.log('Skipping material risk page (material_risk.html or materials_data.json not found)');
}

// ─── NON-BILLABLE PAGE ────────────────────────────────────────────────────────
const NONBILLABLE_DATA = path.join(__dirname, 'nonbillable_data.json');
const NONBILLABLE_HTML = path.join(__dirname, 'nonbillable.html');
if (fs.existsSync(NONBILLABLE_DATA) && fs.existsSync(NONBILLABLE_HTML)) {
  const nbRaw = JSON.parse(fs.readFileSync(NONBILLABLE_DATA, 'utf8'));
  const nbRecords = nbRaw.data || [];
  console.log(`\nEmbedding ${nbRecords.length} non-billable records into nonbillable page...`);

  let nbhtml = fs.readFileSync(NONBILLABLE_HTML, 'utf8');
  nbhtml = nbhtml.replace(/\/\/ ──── AUTO-EMBEDDED NONBILLABLE[\s\S]*?\/\/ ──── END AUTO-EMBEDDED NONBILLABLE\n?/g, '');

  const nbBlock = `
// ──── AUTO-EMBEDDED NONBILLABLE (generated ${new Date().toISOString().slice(0,10)}) ────
const PRELOADED_NONBILLABLE = ${JSON.stringify(nbRecords)};
loadNonBillable(PRELOADED_NONBILLABLE);
// ──── END AUTO-EMBEDDED NONBILLABLE
`;

  nbhtml = nbhtml.replace(
    "document.getElementById('hdr-sub').textContent = 'No data loaded — run process_nonbillable.js then inject_data.js';",
    nbBlock + "\ndocument.getElementById('hdr-sub').textContent = 'No data loaded — run process_nonbillable.js then inject_data.js';"
  );

  fs.writeFileSync(NONBILLABLE_HTML, nbhtml);
  console.log(`Done — updated ${NONBILLABLE_HTML}`);
  console.log(`File size: ${(fs.statSync(NONBILLABLE_HTML).size / 1024).toFixed(0)} KB`);
} else {
  if (!fs.existsSync(NONBILLABLE_DATA)) {
    console.log('Skipping nonbillable page (nonbillable_data.json not found — pull report and run process_nonbillable.js first)');
  } else {
    console.log('Skipping nonbillable page (nonbillable.html not found)');
  }
}
