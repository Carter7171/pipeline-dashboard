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
