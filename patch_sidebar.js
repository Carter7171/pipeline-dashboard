// patch_sidebar.js — one-time script to add collapsible pinnable sidebar to all dashboard pages
// Run: node patch_sidebar.js
// Then run: node inject_data.js  (to re-inject data with updated targets)

const fs   = require('fs');
const path = require('path');
const DIR  = __dirname;

// ── Sidebar CSS ──────────────────────────────────────────────────────────────
const SIDEBAR_CSS = `
/* ── SIDEBAR NAV ────────────────────────────────────────────────────────── */
.nav-sb{position:fixed;left:0;top:0;bottom:0;width:224px;background:var(--surface);border-right:1px solid var(--border);z-index:600;transform:translateX(-100%);transition:transform .22s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;box-shadow:4px 0 24px rgba(0,0,0,.5)}
.nav-sb.open{transform:translateX(0)}
.nav-sb-top{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);flex-shrink:0;min-height:57px;box-sizing:border-box}
.nav-sb-logo{font-size:17px;font-weight:800;color:var(--primary);letter-spacing:-.5px}
.nav-pin{background:none;border:none;cursor:pointer;color:var(--muted);font-size:15px;padding:5px 7px;border-radius:5px;transition:all .15s;line-height:1;display:flex;align-items:center}
.nav-pin:hover,.nav-pin.on{color:var(--primary);background:rgba(88,166,255,.12)}
.nav-links{flex:1;overflow-y:auto;padding:8px 0}
.nav-link{display:flex;align-items:center;gap:10px;padding:10px 16px;color:var(--muted);text-decoration:none;font-size:13px;font-weight:500;transition:background .12s,color .12s;border-left:3px solid transparent}
.nav-link:hover{background:var(--surface2);color:var(--text)}
.nav-link.cur{color:var(--primary);border-left-color:var(--primary);background:rgba(88,166,255,.08);font-weight:600}
.nav-link-ic{width:18px;text-align:center;flex-shrink:0;font-size:14px;line-height:1}
.nav-ov{display:none;position:fixed;inset:0;z-index:550;background:rgba(0,0,0,.45)}
.nav-ov.open{display:block}
body.sb-pinned{padding-left:224px}
.logo-btn{cursor:pointer;background:none;border:none;padding:0;font-size:18px;font-weight:800;color:var(--primary);letter-spacing:-.5px;line-height:1;flex-shrink:0}
.logo-btn:hover{opacity:.8}
/* ───────────────────────────────────────────────────────────────────────── */
`;

// ── Sidebar HTML (active page gets class "cur") ──────────────────────────────
function sidebarHTML(active) {
  const pages = [
    ['index',         'index.html',         '📊', 'Pipeline'],
    ['materials',     'materials.html',      '📦', 'Materials'],
    ['chargebacks',   'chargebacks.html',    '💸', 'Chargebacks'],
    ['postfails',     'postfails.html',      '✗',  'Post Fails'],
    ['preinspect',    'preinspect.html',     '🔍', 'Pre-Inspect'],
    ['material_risk', 'material_risk.html',  '⚠',  'Material Risk'],
    ['nonbillable',   'nonbillable.html',    '🔧', 'Non-Billable'],
  ];
  const links = pages.map(([key, href, icon, label]) =>
    `  <a href="${href}" class="nav-link${key === active ? ' cur' : ''}"><span class="nav-link-ic">${icon}</span>${label}</a>`
  ).join('\n');
  return `<!-- ── SIDEBAR NAV ── -->
<div id="nav-sb" class="nav-sb">
  <div class="nav-sb-top">
    <span class="nav-sb-logo">AFS</span>
    <button id="nav-pin" class="nav-pin" onclick="navPin()" title="Pin sidebar open">📌</button>
  </div>
  <div class="nav-links">
${links}
  </div>
</div>
<div id="nav-ov" class="nav-ov" onclick="navClose()"></div>
<!-- ── END SIDEBAR NAV ── -->
`;
}

// ── Sidebar JS (DOMContentLoaded so sidebar divs are in DOM) ─────────────────
const SIDEBAR_JS = `
/* ── SIDEBAR JS ── */
document.addEventListener('DOMContentLoaded', function() {
  var sb = document.getElementById('nav-sb');
  var ov = document.getElementById('nav-ov');
  var pb = document.getElementById('nav-pin');
  if (!sb) return;
  var pinned = localStorage.getItem('afs_sb_pin') === '1';
  function apply() {
    document.body.classList.toggle('sb-pinned', pinned);
    if (pb) pb.classList.toggle('on', pinned);
    if (pinned) sb.classList.add('open');
  }
  window.navToggle = function() {
    var open = sb.classList.toggle('open');
    if (!pinned) ov.classList.toggle('open', open);
  };
  window.navClose = function() {
    if (pinned) return;
    sb.classList.remove('open');
    ov.classList.remove('open');
  };
  window.navPin = function() {
    pinned = !pinned;
    localStorage.setItem('afs_sb_pin', pinned ? '1' : '0');
    if (pinned) { ov.classList.remove('open'); }
    else { sb.classList.remove('open'); ov.classList.remove('open'); }
    apply();
  };
  apply();
});
/* ── END SIDEBAR JS ── */`;

// ── Patch one file ───────────────────────────────────────────────────────────
function patch(file, active, useMarker) {
  const fp = path.join(DIR, file);
  if (!fs.existsSync(fp)) { console.log(`SKIP (not found): ${file}`); return; }
  let html = fs.readFileSync(fp, 'utf8');
  if (html.includes('id="nav-sb"')) { console.log(`SKIP (already patched): ${file}`); return; }

  // Strip existing AUTO-EMBEDDED data blobs so we work on clean base
  html = html.replace(/\/\/ ──── AUTO-EMBEDDED [\s\S]*?\/\/ ──── END AUTO-EMBEDDED [^\n]*\n?/g, '');

  // 1. Add sidebar CSS
  html = html.replace('</style>', SIDEBAR_CSS + '</style>');

  // 2. Modify header
  if (file === 'index.html') {
    // Convert logo span to clickable button
    html = html.replace('<span class="logo">AFS</span>',
      '<button class="logo logo-btn" onclick="navToggle()">AFS</button>');
    // Remove nav link anchors from hdr-r (dashboard page links only)
    html = html.replace(
      /<a href="(?:index|materials|chargebacks|postfails|preinspect|material_risk|nonbillable)\.html"[^>]*>[^<]*<\/a>\s*/g,
      ''
    );
  } else if (file === 'materials.html') {
    // Remove back-link anchor, add logo button inside hdr-l
    html = html.replace('<a href="index.html" class="hdr-link">← Back to Pipeline</a>', '');
    html = html.replace(
      '<div class="hdr-l">',
      '<div class="hdr-l" style="display:flex;align-items:center;gap:14px"><button class="logo-btn" onclick="navToggle()" title="Menu">AFS</button>'
    );
  } else {
    // All other secondary pages: add logo button before title div, remove .hdr-nav
    html = html.replace(
      '<div class="hdr">\n  <div>',
      '<div class="hdr">\n  <button class="logo-btn" onclick="navToggle()" title="Menu">AFS</button>\n  <div>'
    );
    // Remove the hdr-nav div and its contents
    html = html.replace(/<div class="hdr-nav">[\s\S]*?<\/div>/, '');
  }

  // 3. Inject sidebar JS inside main <script> + optional INJECT_END marker
  //    Try both closing patterns (with and without blank line before </body>)
  const ENDINGS = ['</script>\n\n</body>\n</html>', '</script>\n</body>\n</html>'];
  let injected = false;
  for (const ending of ENDINGS) {
    if (html.includes(ending)) {
      const marker = useMarker ? '// ── INJECT_END ──\n' : '';
      html = html.replace(ending, marker + SIDEBAR_JS + '\n' + ending);
      injected = true;
      break;
    }
  }
  if (!injected) console.warn(`  WARN: could not find </script> closing in ${file}`);

  // 4. Add sidebar HTML before </body>
  html = html.replace('</body>\n</html>', sidebarHTML(active) + '</body>\n</html>');

  fs.writeFileSync(fp, html);
  console.log(`PATCHED: ${file}  (${(html.length / 1024).toFixed(0)} KB)`);
}

// useMarker=true → adds // ── INJECT_END ── for inject_data.js to target
patch('index.html',         'index',         true);
patch('materials.html',     'materials',     true);
patch('chargebacks.html',   'chargebacks',   false);
patch('postfails.html',     'postfails',     false);
patch('preinspect.html',    'preinspect',    false);
patch('material_risk.html', 'material_risk', true);
patch('nonbillable.html',   'nonbillable',   true);

console.log('\nDone. Now update inject_data.js injection targets, then run: node inject_data.js');
