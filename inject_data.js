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
