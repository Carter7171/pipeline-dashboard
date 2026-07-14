/* tour.js — guided help tour for all AFS dashboard pages */
(function () {
  'use strict';

  var PAGE = location.pathname.split('/').pop().replace('.html', '') || 'index';
  if (!PAGE || PAGE === 'pipeline-dashboard') PAGE = 'index';

  var TOURS = {
    index: [
      {
        sel: 'button.logo, .logo-btn',
        title: 'Sidebar Navigation',
        body: 'Click the AFS logo anytime to open the navigation menu. Use the 📌 pin button inside to keep it pinned open. It stays pinned across all pages.',
      },
      {
        sel: '#fc-store',
        title: 'Store Filter',
        body: 'Click store chips to include or exclude specific locations. Active stores are highlighted blue. Click again to deselect.',
      },
      {
        sel: '#ms-jobtype-btn',
        title: 'Job Type Filter',
        body: 'Click to open the job type selector. Check or uncheck types to narrow the view. Use "Select All" and "Clear All" for quick changes.',
        fallback: '.filter-bar',
      },
      {
        sel: '.chip[data-period]',
        title: 'Projection Period Tabs',
        body: 'Switch between Past Due, Current Month, Next Month, Rollover, and Future. The KPI cards and charts update instantly to match the selected period.',
        fallback: '.filter-bar',
      },
      {
        sel: '#kpi-past',
        title: 'KPI Summary Cards',
        body: 'At-a-glance revenue and gross profit for each projection window. Colors signal health — green is strong margin, red flags past-due concern.',
        fallback: '.kpi',
      },
      {
        sel: '#table-body tr:first-child',
        title: 'Double-Click Any Row for Notes',
        body: 'Double-click any CG number row to open a side panel with all notes logged in Constellation for that job — inspection history, status changes, installer comments, and more.',
        fallback: '#table-body, .table-wrap',
      },
      {
        sel: '.done-cb',
        title: 'Completion Checkboxes',
        body: 'Check off a job to mark it done for your team. Status syncs in real time to Firestore — everyone on the team sees the same checked rows.',
        fallback: '#table-body tr:first-child',
      },
      {
        sel: '.btn-success',
        title: 'Export CSV',
        body: 'Downloads the current filtered view as a CSV file — paste it into Excel or share it for reporting.',
      },
    ],

    materials: [
      {
        sel: 'button.logo, .logo-btn',
        title: 'Sidebar Navigation',
        body: 'Click the AFS logo to open the navigation menu and switch to any dashboard.',
      },
      {
        sel: '#fc-store, .filter-bar',
        title: 'Filters',
        body: 'Filter by store, status, or search by order number, style, or color. Active filters are highlighted.',
        fallback: '.hdr',
      },
      {
        sel: '#table-body tr:first-child',
        title: 'Material Line Items — Double-Click for Notes',
        body: 'Each row is a material line from the open order report. Double-click a row to open all Constellation notes for that order.',
        fallback: 'table, .table-wrap',
      },
      {
        sel: '[class*="st-"], [class*="status-badge"]',
        title: 'Status Colors',
        body: 'Material status at a glance: On Order = ordered, awaiting delivery. Confirmed = received and ready. None = not yet ordered or status unknown — these need attention.',
        fallback: '#table-body tr:first-child',
      },
    ],

    chargebacks: [
      {
        sel: 'button.logo, .logo-btn',
        title: 'Sidebar Navigation',
        body: 'Click the AFS logo to open the navigation menu and switch to any dashboard.',
      },
      {
        sel: '#fc-store, .filter-bar',
        title: 'Filters',
        body: 'Filter chargebacks by store. Use the search bar to find a specific order number or installer name.',
        fallback: '.hdr',
      },
      {
        sel: '#table-body tr:first-child',
        title: 'Chargeback Records — Double-Click for Notes',
        body: 'Each row is an installer chargeback. Double-click any row to open the full notes from Constellation — reason codes, amounts, and resolution history.',
        fallback: 'table, .table-wrap',
      },
      {
        sel: '.btn-success, button[onclick*="CSV"]',
        title: 'Export CSV',
        body: 'Export the current filtered view for reporting or sharing with the installer relations team.',
        fallback: '.hdr',
      },
    ],

    postfails: [
      {
        sel: 'button.logo, .logo-btn',
        title: 'Sidebar Navigation',
        body: 'Click the AFS logo to open the navigation menu and switch to any dashboard.',
      },
      {
        sel: '#sum-total',
        title: 'Summary Cards',
        body: 'Quick counts of total post-fails, unresolved, addressed, service started, and non-issues. Click a card to filter the table to that status group.',
        fallback: '.hdr',
      },
      {
        sel: '#fc-store, .filter-bar',
        title: 'Filters',
        body: 'Filter by store and job type. The search bar matches order numbers, customer names, and inspector names.',
        fallback: '.hdr',
      },
      {
        sel: '#table-body tr:first-child',
        title: 'Post-Fail Rows — Double-Click for Notes',
        body: 'Each row is an order that failed post-inspection. Double-click to read the full post-fail entry — issues found, inspector name, and timestamp.',
        fallback: 'table, .table-wrap',
      },
      {
        sel: '.act-btn',
        title: 'Action Buttons',
        body: 'Log your response per order:\n• Addressed — issue resolved with installer\n• Svc Started — service work order created\n• Not an Issue — outcome confirmed OK\n\nStatus syncs across all users via Firestore.',
        fallback: '#table-body tr:first-child',
      },
    ],

    preinspect: [
      {
        sel: 'button.logo, .logo-btn',
        title: 'Sidebar Navigation',
        body: 'Click the AFS logo to open the navigation menu and switch to any dashboard.',
      },
      {
        sel: '#fc-store, .filter-bar',
        title: 'Filters',
        body: 'Filter by store and job type. Only builder jobs with installs in the next 5 business days are shown here.',
        fallback: '.hdr',
      },
      {
        sel: '.chip',
        title: 'Urgency Filter',
        body: '🔴 Critical — install is today/tomorrow, pre-fail unresolved\n🟠 Warning — 2–3 days out\n🟡 Watch — 4–5 days out\n🟢 OK — pre-pass or inspection scheduled\n✅ Action Taken — team already marked it',
        fallback: '.filter-bar',
      },
      {
        sel: '#table-body tr:first-child',
        title: 'Pre-Inspection Rows — Double-Click for Notes',
        body: 'Each row is a builder job installing soon. Pre Status shows whether a pre-inspection passed, failed, or is pending. Double-click to read the full pre-inspection notes.',
        fallback: 'table, .table-wrap',
      },
      {
        sel: '.act-btn',
        title: 'Action Buttons',
        body: 'Log your response per order:\n• Contacted — reached out to superintendent\n• Pre Sched — re-inspection booked\n• Pushed — install date moved out\n\nStatus syncs to Firestore so the whole team sees it.',
        fallback: '#table-body tr:first-child',
      },
    ],

    material_risk: [
      {
        sel: 'button.logo, .logo-btn',
        title: 'Sidebar Navigation',
        body: 'Click the AFS logo to open the navigation menu and switch to any dashboard.',
      },
      {
        sel: '#table-body tr:first-child',
        title: 'Material Risk Alerts — Double-Click for Notes',
        body: 'Two alert types:\n• Late Delivery — ETA is after the install date\n• Unconfirmed Bulk — status is None (not ordered or confirmed)\n\nDouble-click a row to open the order\'s Constellation notes.',
        fallback: 'table, .table-wrap',
      },
      {
        sel: '#fc-store, .filter-bar',
        title: 'Filters',
        body: 'Filter by store or alert type. Rows are sorted by urgency — closest install dates appear first.',
        fallback: '.hdr',
      },
    ],

    nonbillable: [
      {
        sel: 'button.logo, .logo-btn',
        title: 'Sidebar Navigation',
        body: 'Click the AFS logo to open the navigation menu and switch to any dashboard.',
      },
      {
        sel: '#sum-cost',
        title: 'Cost Summary Cards',
        body: 'Total cost AFS absorbed for non-billable service work — callbacks and warranty jobs done without billing the builder. Cards show total records, unique builders, top builder, and average cost.',
        fallback: '.hdr',
      },
      {
        sel: '#scorecard-grid',
        title: 'Builder Scorecards',
        body: 'Click any builder card to filter the table to that builder\'s orders. Sort cards by cost, visit count, or name. The trend bar shows job type breakdown.',
        fallback: '.hdr',
      },
      {
        sel: '#table-body tr:first-child',
        title: 'Non-Billable Records — Double-Click for Notes',
        body: 'Each row is a closed SERVICE WORK NON-BILLABLE order. The cost column shows what AFS absorbed — nothing was billed to the builder. Double-click to open the order\'s Constellation notes.',
        fallback: 'table, .table-wrap',
      },
    ],
  };

  // ── Tour Engine ──────────────────────────────────────────────────────────────

  var steps = [], stepIdx = 0;
  var spotEl, tipEl;
  var active = false;

  function findEl(sel) {
    if (!sel) return null;
    var parts = sel.split(',').map(function (s) { return s.trim(); });
    for (var i = 0; i < parts.length; i++) {
      try {
        var el = document.querySelector(parts[i]);
        if (el) return el;
      } catch (e) {}
    }
    return null;
  }

  function positionSpot(el) {
    var r = el.getBoundingClientRect();
    var pad = 8;
    spotEl.style.top    = (r.top    - pad) + 'px';
    spotEl.style.left   = (r.left   - pad) + 'px';
    spotEl.style.width  = (r.width  + pad * 2) + 'px';
    spotEl.style.height = (r.height + pad * 2) + 'px';
  }

  function positionTip(el) {
    var r = el.getBoundingClientRect();
    var pad = 8;
    var tipW = 310;
    var vw = window.innerWidth, vh = window.innerHeight;

    // Prefer below, fallback above
    var top, left;
    var below = r.bottom + pad + 12;
    var above = r.top - pad - 12;
    var tipH  = tipEl.offsetHeight || 200;

    if (below + tipH < vh - 8) {
      top = below;
    } else if (above - tipH > 8) {
      top = above - tipH;
    } else {
      top = Math.max(8, vh / 2 - tipH / 2);
    }

    left = (r.left + r.right) / 2 - tipW / 2;
    left = Math.max(8, Math.min(left, vw - tipW - 8));

    tipEl.style.top  = top  + 'px';
    tipEl.style.left = left + 'px';
  }

  function updateButtons() {
    tipEl.querySelector('.t-prev').disabled = stepIdx === 0;
    var nextBtn = tipEl.querySelector('.t-next');
    nextBtn.textContent = stepIdx === steps.length - 1 ? 'Done ✓' : 'Next →';
  }

  function showStep(idx) {
    var step = steps[idx];
    var el = findEl(step.sel);
    if (!el && step.fallback) el = findEl(step.fallback);
    if (!el) el = document.querySelector('.hdr') || document.body;

    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    setTimeout(function () {
      positionSpot(el);
      positionTip(el);

      tipEl.querySelector('.t-step').textContent  = (idx + 1) + ' of ' + steps.length;
      tipEl.querySelector('.t-title').textContent = step.title;
      // Support \n line breaks in body text
      var bodyEl = tipEl.querySelector('.t-body');
      bodyEl.innerHTML = '';
      var lines = step.body.split('\n');
      for (var i = 0; i < lines.length; i++) {
        if (i > 0) bodyEl.appendChild(document.createElement('br'));
        bodyEl.appendChild(document.createTextNode(lines[i]));
      }
      updateButtons();
    }, step.sel && findEl(step.sel) ? 150 : 0);
  }

  function startTour() {
    steps    = TOURS[PAGE] || TOURS['index'];
    stepIdx  = 0;
    active   = true;
    spotEl.style.display = 'block';
    tipEl.style.display  = 'block';
    showStep(0);
  }

  function endTour() {
    active = false;
    spotEl.style.display = 'none';
    tipEl.style.display  = 'none';
  }

  function nextStep() {
    if (stepIdx >= steps.length - 1) { endTour(); return; }
    stepIdx++;
    showStep(stepIdx);
  }

  function prevStep() {
    if (stepIdx <= 0) return;
    stepIdx--;
    showStep(stepIdx);
  }

  // Keyboard navigation
  document.addEventListener('keydown', function (e) {
    if (!active) return;
    if (e.key === 'Escape')      endTour();
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextStep();
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   prevStep();
  });

  // ── Build DOM ────────────────────────────────────────────────────────────────
  // tour.js loads at end of body — DOMContentLoaded may already have fired.
  // Use readyState to handle both cases.

  function init() {

    // Spotlight overlay
    spotEl = document.createElement('div');
    spotEl.id = 'tour-spot';
    spotEl.style.cssText = [
      'display:none',
      'position:fixed',
      'z-index:9998',
      'border-radius:6px',
      'box-shadow:0 0 0 9999px rgba(0,0,0,.68)',
      'pointer-events:none',
      'transition:top .22s ease,left .22s ease,width .22s ease,height .22s ease',
    ].join(';');
    document.body.appendChild(spotEl);

    // Tooltip card
    tipEl = document.createElement('div');
    tipEl.id = 'tour-tip';
    tipEl.style.cssText = [
      'display:none',
      'position:fixed',
      'z-index:9999',
      'width:310px',
      'background:#161b22',
      'border:1px solid #30363d',
      'border-radius:10px',
      'padding:16px 18px',
      'box-shadow:0 8px 36px rgba(0,0,0,.6)',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    ].join(';');
    tipEl.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">' +
        '<span class="t-step" style="font-size:11px;color:#8b949e;font-weight:500"></span>' +
        '<button class="t-close" style="background:none;border:none;cursor:pointer;color:#8b949e;font-size:17px;line-height:1;padding:2px 4px;border-radius:4px" title="Close (Esc)">✕</button>' +
      '</div>' +
      '<div class="t-title" style="font-size:14px;font-weight:700;color:#58a6ff;margin-bottom:8px;line-height:1.3"></div>' +
      '<div class="t-body" style="font-size:13px;line-height:1.7;color:#c9d1d9;margin-bottom:14px;white-space:pre-line"></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between">' +
        '<button class="t-prev" style="padding:5px 13px;border-radius:6px;border:1px solid #30363d;background:#21262d;color:#c9d1d9;cursor:pointer;font-size:12px">← Prev</button>' +
        '<button class="t-next" style="padding:5px 13px;border-radius:6px;border:none;background:#58a6ff;color:#0d1117;cursor:pointer;font-size:12px;font-weight:700">Next →</button>' +
      '</div>';
    document.body.appendChild(tipEl);

    tipEl.querySelector('.t-close').addEventListener('click', endTour);
    tipEl.querySelector('.t-prev').addEventListener('click', prevStep);
    tipEl.querySelector('.t-next').addEventListener('click', nextStep);

    // Add help button to sidebar
    var navLinks = document.querySelector('#nav-sb .nav-links');
    if (navLinks) {
      var sep = document.createElement('div');
      sep.style.cssText = 'border-top:1px solid #30363d;margin:8px 0 4px';
      navLinks.appendChild(sep);

      var helpBtn = document.createElement('button');
      helpBtn.id = 'tour-help-btn';
      helpBtn.title = 'Walk me through this dashboard';
      helpBtn.style.cssText = [
        'display:flex',
        'align-items:center',
        'gap:10px',
        'padding:10px 16px',
        'width:100%',
        'background:linear-gradient(135deg,rgba(88,166,255,.18),rgba(188,140,255,.18))',
        'border:1px solid rgba(88,166,255,.3)',
        'border-radius:7px',
        'color:#a0c4ff',
        'cursor:pointer',
        'font-size:13px',
        'font-weight:600',
        'letter-spacing:.1px',
        'transition:background .15s,border-color .15s',
        'margin:0 8px 8px',
        'width:calc(100% - 16px)',
        'box-sizing:border-box',
        'animation:tour-pulse 2.4s ease-in-out 1.5s 3',
      ].join(';');
      helpBtn.innerHTML = '<span style="font-size:16px;flex-shrink:0">❓</span>How to Use This Page';
      helpBtn.addEventListener('click', function () { startTour(); });
      helpBtn.addEventListener('mouseenter', function () {
        this.style.background = 'linear-gradient(135deg,rgba(88,166,255,.28),rgba(188,140,255,.28))';
        this.style.borderColor = 'rgba(88,166,255,.5)';
      });
      helpBtn.addEventListener('mouseleave', function () {
        this.style.background = 'linear-gradient(135deg,rgba(88,166,255,.18),rgba(188,140,255,.18))';
        this.style.borderColor = 'rgba(88,166,255,.3)';
      });
      navLinks.appendChild(helpBtn);

      // Inject keyframe animation once
      if (!document.getElementById('tour-styles')) {
        var styleEl = document.createElement('style');
        styleEl.id = 'tour-styles';
        styleEl.textContent =
          '@keyframes tour-pulse{0%,100%{box-shadow:0 0 0 0 rgba(88,166,255,.5)}50%{box-shadow:0 0 0 6px rgba(88,166,255,0)}}' +
          '#tour-help-btn:focus{outline:2px solid #58a6ff;outline-offset:2px}';
        document.head.appendChild(styleEl);
      }
    }

    // Expose globally for debug
    window._tourStart = startTour;
    window._tourEnd   = endTour;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
