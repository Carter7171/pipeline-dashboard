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
