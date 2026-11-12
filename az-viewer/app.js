/* Read-only A-Z viewer + community suggestions (indicative). No backend in page, no login. */
(function () {
  var layout = document.getElementById('layout');
  var toggle = document.getElementById('panel-toggle');
  var viewMenu = document.getElementById('view-menu');
  var viewEntry = document.getElementById('view-entry');

  function showMenuView() {
    if (viewMenu) viewMenu.hidden = false;
    if (viewEntry) viewEntry.hidden = true;
  }
  function showEntryView() {
    if (viewMenu) viewMenu.hidden = true;
    if (viewEntry) viewEntry.hidden = false;
    layout.classList.remove('panel-hidden');
    updateToggleText();
    setTimeout(function () {
      var p = document.getElementById('c-place');
      if (p) p.focus();
    }, 80);
  }

  function updateToggleText() {
    if (!toggle) return;
    var hidden = layout.classList.contains('panel-hidden');
    toggle.classList.toggle('active', !hidden);
    toggle.innerHTML = hidden
      ? '<span class="top-btn-icon">&#9776;</span><span class="top-btn-label">Menu</span>'
      : '<span class="top-btn-icon">&#10005;</span><span class="top-btn-label">Close</span>';
    toggle.setAttribute('aria-label', hidden ? 'Open menu and search' : 'Close menu');
  }

  function closePanelOnMobile() {
    if (window.innerWidth <= 768) {
      layout.classList.add('panel-hidden');
      updateToggleText();
      setTimeout(function () { map.invalidateSize(); }, 60);
    }
  }

  if (window.innerWidth <= 768) { layout.classList.add('panel-hidden'); }
  updateToggleText();
  window.addEventListener('resize', function () { updateToggleText(); });

  if (toggle) toggle.onclick = function () {
    var wasHidden = layout.classList.contains('panel-hidden');
    layout.classList.toggle('panel-hidden');
    if (wasHidden) {
      showMenuView(); // default to Search/Parcels when tapping Menu
    }
    updateToggleText();
    setTimeout(function () { map.invalidateSize(); }, 50);
  };

  var entryCloseBtn = document.getElementById('entry-close-btn');
  var entryCancelBtn = document.getElementById('entry-cancel-btn');
  if (entryCloseBtn) entryCloseBtn.onclick = function () {
    layout.classList.add('panel-hidden');
    updateToggleText();
    setTimeout(function () { map.invalidateSize(); }, 50);
  };
  if (entryCancelBtn) entryCancelBtn.onclick = function () {
    clearDrawing();
    layout.classList.add('panel-hidden');
    updateToggleText();
    setTimeout(function () { map.invalidateSize(); }, 50);
  };

  // Top Bar Layers Menu
  var layersBtn = document.getElementById('layers-toggle-btn');
  var layersMenu = document.getElementById('layers-menu');
  var layersClose = document.getElementById('layers-close-btn');
  var layersList = document.getElementById('layers-list');

  function toggleLayersMenu() {
    if (!layersMenu) return;
    var isHidden = layersMenu.hidden;
    layersMenu.hidden = !isHidden;
    if (layersBtn) layersBtn.classList.toggle('active', !layersMenu.hidden);
  }
  if (layersBtn) layersBtn.onclick = function (ev) { ev.stopPropagation(); toggleLayersMenu(); };
  if (layersClose) layersClose.onclick = function () {
    if (layersMenu) layersMenu.hidden = true;
    if (layersBtn) layersBtn.classList.remove('active');
  };
  // Help & Surveyor Guide Modal
  var helpBtn = document.getElementById('help-toggle-btn');
  var helpModal = document.getElementById('help-modal');
  var helpClose = document.getElementById('help-close-btn');
  var menuHelpBtn = document.getElementById('menu-help-btn');
  var helpPwaInstallBtn = document.getElementById('help-pwa-install-btn');

  function openHelpModal() {
    if (typeof closeLibraryModal === 'function') closeLibraryModal();
    if (!helpModal) return;
    helpModal.hidden = false;
    if (helpBtn) helpBtn.classList.add('active');
  }
  function closeHelpModal() {
    if (!helpModal) return;
    helpModal.hidden = true;
    if (helpBtn) helpBtn.classList.remove('active');
  }
  if (helpBtn) helpBtn.onclick = function (ev) {
    ev.stopPropagation();
    if (helpModal && !helpModal.hidden) closeHelpModal();
    else openHelpModal();
  };
  if (menuHelpBtn) menuHelpBtn.onclick = function (ev) {
    ev.stopPropagation();
    openHelpModal();
  };
  if (helpClose) helpClose.onclick = function () {
    closeHelpModal();
  };
  if (helpModal) helpModal.onclick = function (ev) {
    if (ev.target === helpModal) {
      closeHelpModal();
    }
  };

  // Wildlife & Habitat Library Modal
  var libraryBtn = document.getElementById('library-toggle-btn');
  var libraryModal = document.getElementById('library-modal');
  var libraryClose = document.getElementById('library-close-btn');
  var menuLibraryBtn = document.getElementById('menu-library-btn');
  var librarySearch = document.getElementById('library-search');
  var libraryTabs = document.getElementById('library-tabs');
  var libraryList = document.getElementById('library-list');
  var libraryItems = null;
  var libraryLoadPending = false;
  var currentLibCategory = 'all';

  function openLibraryModal(optCat) {
    closeHelpModal();
    if (layersMenu) layersMenu.hidden = true;
    if (layersBtn) layersBtn.classList.remove('active');
    if (optCat && libraryTabs) {
      var targetTab = libraryTabs.querySelector('[data-cat="' + optCat + '"]');
      if (targetTab) {
        currentLibCategory = optCat;
        var allTabs = libraryTabs.querySelectorAll('.lib-tab');
        for (var i = 0; i < allTabs.length; i++) {
          allTabs[i].classList.toggle('active', allTabs[i] === targetTab);
        }
      }
    }
    if (!libraryModal) return;
    libraryModal.hidden = false;
    if (libraryBtn) libraryBtn.classList.add('active');
    loadLibraryData();
  }
  function closeLibraryModal() {
    if (!libraryModal) return;
    libraryModal.hidden = true;
    if (libraryBtn) libraryBtn.classList.remove('active');
  }
  function safeExtUrl(u) {
    var s = String(u || '').trim();
    if (/^https?:\/\//i.test(s)) return s;
    return '#';
  }
  function loadLibraryData() {
    if (libraryItems) {
      renderLibrary();
      return;
    }
    if (libraryLoadPending) return;
    libraryLoadPending = true;
    fetch('data/library.json')
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (items) {
        libraryItems = Array.isArray(items) ? items : [];
        libraryLoadPending = false;
        renderLibrary();
      })
      .catch(function () {
        libraryLoadPending = false;
        if (libraryList) {
          libraryList.innerHTML = '<div class="help-section help-section-warning"><p>Could not load library file offline. Please connect once to cache the library or reload the page.</p></div>';
        }
      });
  }
  function renderLibrary() {
    if (!libraryList || !libraryItems) return;
    var q = librarySearch ? String(librarySearch.value || '').trim().toLowerCase() : '';
    var matches = [];
    for (var i = 0; i < libraryItems.length; i++) {
      var item = libraryItems[i];
      if (currentLibCategory !== 'all' && item.category !== currentLibCategory) continue;
      if (q) {
        var hay = [
          item.title,
          item.category_label,
          item.badge,
          item.summary,
          item.phone,
          item.alt_phone,
          item.location,
          (item.advice || []).join(' '),
          (item.tags || []).join(' ')
        ].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) continue;
      }
      matches.push(item);
    }

    if (!matches.length) {
      libraryList.innerHTML = '<div class="help-section" style="text-align:center;"><p class="sub">No entries found matching "' + esc(q) + '".</p><button type="button" id="lib-reset-btn" class="btn btn-sm btn-muted">Show all topics</button></div>';
      var resetBtn = document.getElementById('lib-reset-btn');
      if (resetBtn) {
        resetBtn.onclick = function () {
          currentLibCategory = 'all';
          if (librarySearch) librarySearch.value = '';
          if (libraryTabs) {
            var tabs = libraryTabs.querySelectorAll('.lib-tab');
            for (var t = 0; t < tabs.length; t++) {
              tabs[t].classList.toggle('active', tabs[t].getAttribute('data-cat') === 'all');
            }
          }
          renderLibrary();
        };
      }
      return;
    }

    var html = [];
    for (var m = 0; m < matches.length; m++) {
      var c = matches[m];
      var catCls = esc(c.category || 'general');
      var badge = c.badge || c.category_label || '';
      var block = '<article class="lib-card lib-card-' + catCls + '">';
      block += '<div class="lib-card-top"><span class="lib-badge lib-badge-' + catCls + '">' + esc(badge) + '</span></div>';
      block += '<h3>' + esc(c.title) + '</h3>';
      if (c.summary) {
        block += '<p class="lib-summary">' + esc(c.summary) + '</p>';
      }
      if (c.phone || c.alt_phone) {
        block += '<div class="lib-phone-row">';
        if (c.phone) {
          var telMain = String(c.phone).replace(/[^+\d]/g, '');
          block += '<a href="tel:' + esc(telMain) + '" class="lib-phone-btn">Call ' + esc(c.phone) + '</a>';
        }
        if (c.alt_phone) {
          var telAlt = String(c.alt_phone).replace(/[^+\d]/g, '');
          block += '<a href="tel:' + esc(telAlt) + '" class="lib-phone-btn">Alt: ' + esc(c.alt_phone) + '</a>';
        }
        block += '</div>';
      }
      if (c.location) {
        block += '<div class="lib-location"><strong>Location:</strong> ' + esc(c.location) + '</div>';
      }
      if (Array.isArray(c.advice) && c.advice.length) {
        block += '<ul class="lib-advice-list">';
        for (var a = 0; a < c.advice.length; a++) {
          block += '<li>' + esc(c.advice[a]) + '</li>';
        }
        block += '</ul>';
      }
      if (Array.isArray(c.links) && c.links.length) {
        block += '<div class="lib-links-list">';
        for (var l = 0; l < c.links.length; l++) {
          var lk = c.links[l];
          block += '<div><a href="' + esc(safeExtUrl(lk.url)) + '" target="_blank" rel="noopener noreferrer" class="lib-ext-link">' + esc(lk.title) + ' &rarr;</a>';
          if (lk.desc) {
            block += '<span class="lib-link-desc">' + esc(lk.desc) + '</span>';
          }
          block += '</div>';
        }
        block += '</div>';
      }
      block += '</article>';
      html.push(block);
    }
    libraryList.innerHTML = html.join('');
  }

  if (libraryBtn) libraryBtn.onclick = function (ev) {
    ev.stopPropagation();
    if (libraryModal && !libraryModal.hidden) closeLibraryModal();
    else openLibraryModal();
  };
  if (menuLibraryBtn) menuLibraryBtn.onclick = function (ev) {
    ev.stopPropagation();
    openLibraryModal();
  };
  if (libraryClose) libraryClose.onclick = function () {
    closeLibraryModal();
  };
  if (libraryModal) libraryModal.onclick = function (ev) {
    if (ev.target === libraryModal) {
      closeLibraryModal();
    }
  };
  if (librarySearch) librarySearch.addEventListener('input', function () {
    renderLibrary();
  });
  if (libraryTabs) libraryTabs.addEventListener('click', function (ev) {
    var btn = ev.target.closest ? ev.target.closest('.lib-tab') : null;
    if (!btn) return;
    currentLibCategory = btn.getAttribute('data-cat') || 'all';
    var tabs = libraryTabs.querySelectorAll('.lib-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i] === btn);
    }
    renderLibrary();
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      if (helpModal && !helpModal.hidden) closeHelpModal();
      if (libraryModal && !libraryModal.hidden) closeLibraryModal();
    }
  });

  // PWA beforeinstallprompt capture
  var deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (helpPwaInstallBtn) {
      helpPwaInstallBtn.style.display = 'inline-block';
      helpPwaInstallBtn.onclick = function () {
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          deferredInstallPrompt.userChoice.then(function () {
            deferredInstallPrompt = null;
            helpPwaInstallBtn.style.display = 'none';
          });
        }
      };
    }
  });

  // Toast notification
  var toastTimer = null;
  function showToast(msg) {
    var toast = document.getElementById('toast-msg');
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 3200);
  }

  // Leaflet map without default zoomControl (+/- removed for clean touchscreen/wheel use)
  var map = L.map('map', { zoomControl: false }).setView([51.568, -1.78], 11);
  map.createPane('gardenMatrixPane');
  map.getPane('gardenMatrixPane').style.zIndex = 350;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: 'OpenStreetMap contributors'
  }).addTo(map);

  function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // --- label rules (aligned with A-Z product) ---
  function nonempty(v) { if (v == null) return null; var s = String(v).trim(); return s || null; }
  function en1Short(props) {
    var p = props || {};
    var num = nonempty(p.corridor_number);
    var part = (nonempty(p.corridor_part) || '').toLowerCase();
    part = (part.length === 1 && /[a-z]/.test(part)) ? part : '';
    if (num != null) { var n = parseInt(num, 10); return (isNaN(n) ? String(num) : String(n)) + part; }
    var src = nonempty(p.designation_ref) || nonempty(p.short_label) || nonempty(p.name) || '';
    var m = src.match(/Corridor\s+(\d+)\s*([a-z])?/i);
    if (m) return String(parseInt(m[1],10)) + (m[2] ? m[2].toLowerCase() : '');
    m = src.match(/\b(\d+)\s*([a-z])?\b/);
    if (m && /EN1/i.test(src)) return String(parseInt(m[1],10)) + (m[2] ? m[2].toLowerCase() : '');
    return nonempty(p.map_label) || nonempty(p.short_label) || nonempty(p.name) || '';
  }
  function buildProposedSeq(features) {
    var seq = {}, n = 0;
    (features || []).forEach(function (f) {
      var p = f.properties || {};
      if (p.feature_class === 'proposed_green_network_additions_2026' || p.feature_class === 'proposed_new_areas') {
        n += 1;
        if (p.id != null) seq[String(p.id)] = n;
      }
    });
    return seq;
  }
  function displayLabel(props, proposedSeq, communityIndex) {
    var p = props || {}, fc = p.feature_class || '';
    var official = ['en_number','designation_ref','official_designation','ref'];
    var generic = ['display_name','short_label','name'];
    var i, v;
    if (fc === 'my_pending') return 'P' + (communityIndex != null ? communityIndex : '?');
    if (fc === 'community_suggestion') {
      if (p.map_label) return String(p.map_label);
      if (communityIndex != null) return 'C' + communityIndex;
      return 'C?';
    }
    if (fc === 'proposed_green_network_additions_2026' || fc === 'proposed_new_areas') {
      for (i=0;i<official.length;i++){ v=nonempty(p[official[i]]); if(v) return v; }
      var pn = proposedSeq && proposedSeq[String(p.id)];
      if (pn != null) return 'p' + pn;
      for (i=0;i<generic.length;i++){ v=nonempty(p[generic[i]]); if(v) return v; }
    }
    if (fc === 'osm_auto_green_draft' || fc === 'strategic_railway' || fc === 'high_value_habitat' || fc === 'extra_urban_woodland' || fc === 'amenity_allotments' || fc === 'allotments_community_growing' || fc === 'amenity_cemetery' || fc === 'amenity_open_green') {
      return nonempty(p.name) || nonempty(p.short_label) || nonempty(p.ref) || String(p.id || '');
    }
    if (fc === 'en1_green_corridor') {
      v = nonempty(p.map_label) || nonempty(p.short_ref); if (v) return v;
      v = en1Short(p); if (v) return v;
    }
    if (fc === 'amenity_water') {
      for (i=0;i<generic.length;i++){ v=nonempty(p[generic[i]]); if(v && String(v).indexOf('osm-waterway')!==0) return v; }
      return 'Water';
    }
    if (fc === 'scheduled_monument' || fc === 'registered_park_garden' || fc === 'listed_building' || fc === 'conservation_area' || fc === 'unscheduled_archaeology' || fc === 'country_park_core' || fc === 'open_space_large' || fc === 'recreation_ground') {
      return nonempty(p.name) || nonempty(p.short_label) || nonempty(p.ref) || String(p.id || '');
    }
    for (i=0;i<official.length;i++){ v=nonempty(p[official[i]]); if(v) return v; }
    for (i=0;i<generic.length;i++){ v=nonempty(p[generic[i]]); if(v) return v; }
    return String(p.id || '');
  }

  var CLASS_META = {
    en1_green_corridor: { label: 'Adopted EN1 green corridor (policy context)', color: '#1B7F3A', fill: '#27AE60', weight: 3, dash: '8 5', fillOpacity: 0, hatch: 'hatch-en1', defaultVisible: true, swatch: 'layer-swatch-en1' },
    proposed_green_network_additions_2026: { label: 'Proposed addition 2026 (DRAFT / indicative)', color: '#C77700', fill: '#F9A825', weight: 3, dash: null, fillOpacity: 0, hatch: 'hatch-proposed', defaultVisible: true, swatch: 'layer-swatch-proposed' },
    osm_auto_green_draft: { label: 'Proposed auto-draft green area (DRAFT / indicative)', color: '#D97706', fill: '#F59E0B', weight: 2.2, dash: '4 3', fillOpacity: 0, hatch: 'hatch-proposed', defaultVisible: true, swatch: 'layer-swatch-proposed-auto' },
    proposed_new_areas: { label: 'Proposed new area (DRAFT / indicative)', color: '#C77700', fill: '#F9A825', weight: 3, dash: null, fillOpacity: 0, hatch: 'hatch-proposed', defaultVisible: true, swatch: 'layer-swatch-proposed' },
    amenity_water:      { label: 'Rivers, canals & amenity water (indicative)', color: '#1565C0', fill: '#42A5F5', weight: 2, dash: null, fillOpacity: 0.28, hatch: null, defaultVisible: true, swatch: 'layer-swatch-water' },
    strategic_railway:  { label: 'Strategic railway corridor (GWML)', color: '#1E293B', fill: '#334155', weight: 3.2, dash: '8 4', fillOpacity: 0, hatch: null, defaultVisible: true, swatch: 'layer-swatch-rail' },
    country_park_core:  { label: 'Country Park & Nature Reserve', color: '#1B5E20', fill: '#4CAF50', weight: 2.2, dash: null, fillOpacity: 0.25, hatch: null, defaultVisible: false, swatch: 'layer-swatch-countrypark' },
    open_space_large:   { label: 'Large Open Space & Recreation Ground', color: '#2E7D32', fill: '#81C784', weight: 2, dash: null, fillOpacity: 0.22, hatch: null, defaultVisible: false, swatch: 'layer-swatch-recreation' },
    recreation_ground:  { label: 'Recreation Ground & Public Open Space', color: '#2E7D32', fill: '#81C784', weight: 2, dash: null, fillOpacity: 0.22, hatch: null, defaultVisible: false, swatch: 'layer-swatch-recreation' },
    high_value_habitat: { label: 'High Value Habitat (mapped baseline)', color: '#047857', fill: '#10B981', weight: 2.2, dash: null, fillOpacity: 0.24, hatch: null, defaultVisible: false, swatch: 'layer-swatch-highhabitat' },
    extra_urban_woodland: { label: 'Extra-urban Woodland (mapped baseline)', color: '#15803D', fill: '#4ADE80', weight: 1.8, dash: null, fillOpacity: 0.24, hatch: null, defaultVisible: false, swatch: 'layer-swatch-woodland' },
    green_amenities:    { label: 'Allotments, Cemeteries & Local Green', color: '#65A30D', fill: '#A3E635', weight: 1.8, dash: null, fillOpacity: 0.25, hatch: null, defaultVisible: false, swatch: 'layer-swatch-amenities' },
    amenity_allotments: { label: 'Allotments & Community Growing', color: '#65A30D', fill: '#A3E635', weight: 1.8, dash: null, fillOpacity: 0.25, hatch: null, defaultVisible: false, swatch: 'layer-swatch-amenities' },
    allotments_community_growing: { label: 'Allotments & Community Growing', color: '#65A30D', fill: '#A3E635', weight: 1.8, dash: null, fillOpacity: 0.25, hatch: null, defaultVisible: false, swatch: 'layer-swatch-amenities' },
    amenity_cemetery:   { label: 'Cemetery / Quiet Green Space', color: '#65A30D', fill: '#A3E635', weight: 1.8, dash: null, fillOpacity: 0.25, hatch: null, defaultVisible: false, swatch: 'layer-swatch-amenities' },
    amenity_open_green: { label: 'Local Open Green Space', color: '#65A30D', fill: '#A3E635', weight: 1.8, dash: null, fillOpacity: 0.25, hatch: null, defaultVisible: false, swatch: 'layer-swatch-amenities' },
    scheduled_monument: { label: 'Scheduled Monument (archaeological designation)', color: '#6A1B9A', fill: '#BA68C8', weight: 2.5, dash: '6 4', fillOpacity: 0.15, hatch: 'hatch-heritage', defaultVisible: false, swatch: 'layer-swatch-monument' },
    unscheduled_archaeology: { label: 'Unscheduled Archaeology (Local Plan)', color: '#B7410E', fill: '#E07A5F', weight: 2, dash: '4 4', fillOpacity: 0.22, hatch: null, defaultVisible: false, swatch: 'layer-swatch-archaeology' },
    conservation_area:  { label: 'Conservation Area (statutory heritage)', color: '#8D6E63', fill: '#D7CCC8', weight: 2, dash: '5 4', fillOpacity: 0.22, hatch: null, defaultVisible: false, swatch: 'layer-swatch-conservation' },
    listed_building:    { label: 'Listed Building (Grade I & II*)', color: '#B45309', fill: '#F59E0B', weight: 2, dash: null, fillOpacity: 0.9, hatch: null, defaultVisible: false, swatch: 'layer-swatch-listed' },
    registered_park_garden: { label: 'Registered Park & Garden (heritage designation)', color: '#2E7D32', fill: '#81C784', weight: 2, dash: '4 4', fillOpacity: 0.22, hatch: null, defaultVisible: false, swatch: 'layer-swatch-park' },
    ancient_woodland: { label: 'Ancient Woodland (Natural England Inventory)', color: '#166534', fill: '#22c55e', weight: 2.5, dash: '5 3', fillOpacity: 0.28, hatch: null, defaultVisible: false, swatch: 'layer-swatch-ancientwoodland' },
    public_right_of_way: { label: 'Public Rights of Way (Footpaths & Bridleways)', color: '#d97706', fill: null, weight: 2.4, dash: '4 4', fillOpacity: 0, hatch: null, defaultVisible: false, swatch: 'layer-swatch-prow' },
    planning_application: { label: 'Planning Application (Pending / Undecided)', color: '#831843', fill: '#db2777', weight: 2, dash: null, fillOpacity: 0.85, hatch: null, defaultVisible: false, swatch: 'layer-swatch-planning' },
    community_suggestion: { label: 'Community suggestion (indicative, reviewed)', color: '#6A1B9A', fill: '#BA68C8', weight: 2, dash: '4 4', fillOpacity: 0.18, hatch: null, defaultVisible: false, swatch: 'layer-swatch-community' },
    my_pending: { label: 'My pending suggestion (local, awaiting review)', color: '#455A64', fill: '#90A4AE', weight: 2, dash: '6 4', fillOpacity: 0.2, hatch: null, defaultVisible: true, swatch: 'layer-swatch-pending' }
  };

  var PLANNING_STYLE_MAP = {
    major:      { label: 'Major / Large', color: '#7f1d1d', fill: '#dc2626', radius: 9, badgeBg: '#fee2e2', badgeFg: '#991b1b' },
    medium:     { label: 'Medium', color: '#7c2d12', fill: '#ea580c', radius: 7.5, badgeBg: '#ffedd5', badgeFg: '#9a3412' },
    trees:      { label: 'Trees / Hedgerow', color: '#4c1d95', fill: '#7c3aed', radius: 6.5, badgeBg: '#ede9fe', badgeFg: '#5b21b6' },
    conditions: { label: 'Conditions / Amend', color: '#334155', fill: '#64748b', radius: 5, badgeBg: '#f1f5f9', badgeFg: '#475569' },
    standard:   { label: 'Standard Pending', color: '#831843', fill: '#db2777', radius: 6, badgeBg: '#fce7f3', badgeFg: '#9d174d' }
  };

  function injectHatchDefs() {
    try {
      var svg = map.getRenderer(map)._container;
      if (!svg || svg.tagName.toLowerCase() !== 'svg') return;
      if (svg.querySelector('#hatch-en1')) return;
      var ns = 'http://www.w3.org/2000/svg';
      var defs = document.createElementNS(ns, 'defs');
      function mk(id, color) {
        var p = document.createElementNS(ns, 'pattern');
        p.setAttribute('id', id); p.setAttribute('patternUnits', 'userSpaceOnUse');
        p.setAttribute('width', '8'); p.setAttribute('height', '8'); p.setAttribute('patternTransform', 'rotate(45)');
        var ln = document.createElementNS(ns, 'line');
        ln.setAttribute('x1','0'); ln.setAttribute('y1','0'); ln.setAttribute('x2','0'); ln.setAttribute('y2','8');
        ln.setAttribute('stroke', color); ln.setAttribute('stroke-width', '2'); ln.setAttribute('stroke-opacity', '0.55');
        p.appendChild(ln); defs.appendChild(p);
      }
      mk('hatch-en1', '#1B7F3A');
      mk('hatch-proposed', '#C77700');
      mk('hatch-heritage', '#6A1B9A');
      svg.insertBefore(defs, svg.firstChild);
    } catch (e) {}
  }
  function applyHatch(layerGroup, cls) {
    var meta = CLASS_META[cls] || {};
    if (!meta.hatch) return;
    try {
      layerGroup.eachLayer(function (l) {
        var gtype = l && l.feature && l.feature.geometry && l.feature.geometry.type;
        if (gtype === 'LineString' || gtype === 'MultiLineString' || gtype === 'Point' || gtype === 'MultiPoint') return;
        var el = l.getElement && l.getElement();
        if (el) el.setAttribute('fill', 'url(#' + meta.hatch + ')');
      });
    } catch (e) {}
  }

  var parcels = [];
  var planningFeats = [];
  var planningMeta = null;
  var groups = {};
  var foundMarker = null;
  var overlays = {};
  var myPendingLayer = L.layerGroup();
  var selectedLabelLayer = null;

  function clearSelectedLabel() {
    try { if (selectedLabelLayer && selectedLabelLayer.closeTooltip) selectedLabelLayer.closeTooltip(); } catch (e) {}
    selectedLabelLayer = null;
  }
  function showSelectedLabel(l, lab, cls) {
    clearSelectedLabel();
    selectedLabelLayer = l;
    try {
      l.bindTooltip(String(lab), { permanent: true, direction: 'center', className: 'feat-label feat-' + (cls || ''), opacity: 1 }).openTooltip();
    } catch (e) {}
  }
  map.on('click', function () { clearSelectedLabel(); });

  var LOCAL_KEY = 'gc_pending_v1';
  function loadLocalPending() {
    try { var raw = localStorage.getItem(LOCAL_KEY); var arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr : []; } catch (e) { return []; }
  }
  function saveLocalPending(arr) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(arr || [])); } catch (e) {}
  }
  function renderMyPending() {
    try { myPendingLayer.clearLayers(); } catch (e) {}
    var items = loadLocalPending();
    var meta = CLASS_META.my_pending;
    var n = 0;
    items.forEach(function (it) {
      if (!it || !it.geometry) return;
      n += 1;
      var p = it.properties || {};
      p.feature_class = 'my_pending';
      var lab = 'P' + n;
      var feat = { type: 'Feature', geometry: it.geometry, properties: p };
      var g = L.geoJSON(feat, {
        style: function () { return { color: meta.color, weight: meta.weight, dashArray: meta.dash, fillColor: meta.fill, fillOpacity: meta.fillOpacity, opacity: 0.95 }; },
        pointToLayer: function (f, latlng) { return L.circleMarker(latlng, { radius: 7, color: meta.color, fillColor: meta.fill, fillOpacity: 0.7, weight: 2 }); },
        onEachFeature: function (f, l) {
          l.bindPopup(popupHtml(f.properties, lab));
          l.on('click', function (ev) { try { L.DomEvent.stopPropagation(ev); } catch(e){} showSelectedLabel(l, lab, 'my_pending'); });
        }
      });
      g.eachLayer(function (l) { myPendingLayer.addLayer(l); });
    });
    return n;
  }

  function communityPopupHtml(p, lab) {
    var rows = [];
    if (p.species && p.species !== 'none') rows.push('Wildlife focus: ' + esc(p.species));
    if (p.sensitive_species === 'badger' || p.generalised) {
      rows.push('<span style="color:#b45309;font-weight:600;">[Generalised to Borough Council HQ - Badger presence recorded]</span>');
    }
    if (p.place) rows.push('Location: ' + esc(p.place));
    if (p.street_area || p.street) rows.push('Street: ' + esc(p.street_area || p.street));
    if (p.broad_type) rows.push('Type: ' + esc(p.broad_type));
    if (p.notes || p.notes_note) rows.push('Comments: ' + esc(p.notes || p.notes_note));
    if (p.contact) rows.push('Contact: ' + esc(p.contact));
    return '<strong>' + esc(lab) + '</strong> <span style="color:#666">(community)</span><br>' +
      'Type: ' + esc(CLASS_META.community_suggestion.label) + '<br>' +
      (rows.length ? rows.join('<br>') + '<br>' : '') +
      '<em>Community indicative sketch - not a legal boundary or designation claim. All badger records are snapped to Swindon Borough Council Civic Offices per Protection of Badgers Act 1992.</em>';
  }
  function myPendingPopupHtml(p, lab) {
    var rows = [];
    if (p.species && p.species !== 'none') rows.push('Wildlife focus: ' + esc(p.species));
    if (p.sensitive_species === 'badger' || p.generalised) {
      rows.push('<span style="color:#b45309;font-weight:600;">[Generalised to Borough Council HQ - Badger presence recorded]</span>');
    }
    if (p.place) rows.push('Location: ' + esc(p.place));
    if (p.street_area || p.street) rows.push('Street: ' + esc(p.street_area || p.street));
    if (p.broad_type) rows.push('Type: ' + esc(p.broad_type));
    if (p.notes || p.notes_note) rows.push('Comments: ' + esc(p.notes || p.notes_note));
    if (p.contact) rows.push('Contact: ' + esc(p.contact));
    return '<strong>' + esc(lab) + '</strong> <span style="color:#666">(pending)</span><br>' +
      'Type: ' + esc(CLASS_META.my_pending.label) + '<br>' +
      (rows.length ? rows.join('<br>') + '<br>' : '') +
      '<em>Queued for review - only visible on this device until approved. Indicative only. All badger records are snapped to Swindon Borough Council Civic Offices per Protection of Badgers Act 1992.</em>';
  }

  function shareButtonHtml(shareId, shareTitle) {
    if (!shareId) return '';
    return '<div class="popup-share-container">' +
      '<button type="button" class="popup-share-btn" data-share-id="' + esc(shareId) + '" data-share-title="' + esc(shareTitle || 'Green Space') + '">' +
      '<span style="font-size:12px;">&#128279;</span> Share this space' +
      '</button>' +
      '</div>';
  }

  function planningPopupHtml(p, lab, latlng) {
    var st = PLANNING_STYLE_MAP[p.category] || PLANNING_STYLE_MAP.standard;
    var badge = '<span class="plan-popup-badge" style="background:' + esc(st.badgeBg) + ';color:' + esc(st.badgeFg) + ';">Pending &bull; ' + esc(st.label) + '</span><br>';
    var header = '<strong>' + esc(p.uid || lab) + '</strong>' +
      (p.application_type ? ' <span style="color:#475569;font-size:11px;">(' + esc(p.application_type) + ')</span>' : '') + '<br>';
    var locParts = [];
    if (p.address) locParts.push('<strong>Site:</strong> ' + esc(p.address));
    if (p.ward_name) locParts.push('<strong>Ward:</strong> ' + esc(p.ward_name));
    if (p.parish) locParts.push('<strong>Parish:</strong> ' + esc(p.parish));
    var locHtml = locParts.length ? locParts.join('<br>') + '<br>' : '';
    var descHtml = p.description ? '<div class="plan-desc-box">' + esc(p.description) + '</div>' : '';
    var dateParts = [];
    if (p.start_date) dateParts.push('Received: ' + esc(p.start_date));
    if (p.target_decision_date) dateParts.push('Target decision: ' + esc(p.target_decision_date));
    var dateHtml = dateParts.length ? '<div style="font-size:11px;color:#475569;margin-bottom:4px;">' + dateParts.join(' &bull; ') + '</div>' : '';

    var links = [];
    if (p.url) links.push('<a class="plan-portal-btn" href="' + esc(safeExtUrl(p.url)) + '" target="_blank" rel="noopener noreferrer">Swindon Portal</a>');
    if (p.docs_url) links.push('<a class="plan-portal-btn" href="' + esc(safeExtUrl(p.docs_url)) + '" target="_blank" rel="noopener noreferrer">Documents</a>');
    if (p.comment_url) links.push('<a class="plan-portal-btn" href="' + esc(safeExtUrl(p.comment_url)) + '" target="_blank" rel="noopener noreferrer">Comment</a>');
    var linksHtml = links.length ? '<div class="plan-portal-links">' + links.join('') + '</div>' : '';

    var latVal = latlng ? latlng.lat : '';
    var lngVal = latlng ? latlng.lng : '';
    var noteBtn = (latlng != null)
      ? '<button type="button" class="plan-annotate-btn" data-plan-uid="' + esc(p.uid || '') + '" data-plan-lat="' + esc(latVal) + '" data-plan-lng="' + esc(lngVal) + '" data-plan-ward="' + esc(p.ward_name || p.parish || '') + '">Add corridor note here</button>'
      : '';

    var hDate = p.harvested_date || (planningMeta && planningMeta.harvested_date) || 'unknown';
    var recency = '<div class="plan-recency-note">Cached snapshot harvested ' + esc(hDate) + ' (via PlanIt). Verify live dates &amp; status on pa.swindon.gov.uk.</div>';

    return badge + header + locHtml + descHtml + dateHtml + linksHtml + noteBtn + recency + shareButtonHtml('plan:' + (p.uid || lab), p.uid || lab);
  }

  function popupHtml(p, lab) {
    if (p.feature_class === 'my_pending') return myPendingPopupHtml(p, lab);
    if (p.feature_class === 'community_suggestion') return communityPopupHtml(p, lab);
    if (p.feature_class === 'planning_application') return planningPopupHtml(p, lab, null);
    var meta = CLASS_META[p.feature_class] || { label: p.feature_class || '' };
    var content = '';

    if (p.feature_class === 'ancient_woodland') {
      content = '<strong>' + esc(lab) + '</strong><br>' +
        'Designation: ' + esc(p.designation || 'Natural England Ancient Woodland') + '<br>' +
        'Status: ' + esc(p.status || 'Statutory Ancient Woodland') + '<br>' +
        (p.area_ha ? 'Area: ' + esc(p.area_ha) + ' ha<br>' : '') +
        'Source: ' + esc(p.source || 'Natural England Inventory (Defra)') + '<br>' +
        '<em>Irreplaceable ancient habitat protected under NPPF paragraph 186.</em>';
    } else if (p.feature_class === 'public_right_of_way') {
      content = '<strong>' + esc(p.name || lab) + '</strong><br>' +
        'Type: <strong>' + esc(p.prow_type || 'Public Right of Way') + '</strong><br>' +
        'Source: ' + esc(p.source || 'Swindon Borough Council Definitive Map') + '<br>' +
        '<em>Legal public highway network (Definitive Map interpretation, OGL).</em>';
    } else if (p.feature_class === 'scheduled_monument' || p.feature_class === 'registered_park_garden') {
      content = '<strong>' + esc(lab) + '</strong>' +
        (p.ref ? ' <span style="color:#666">(NHLE ' + esc(p.ref) + ')</span>' : '') + '<br>' +
        'Type: ' + esc(meta.label) + '<br>' +
        'Status: ' + esc(p.status || 'Statutory designation') + '<br>' +
        (p.hyperlink ? 'Register: <a href="' + esc(p.hyperlink) + '" target="_blank" rel="noopener">Historic England National Heritage List</a><br>' : '') +
        '<em>Statutory designation, Historic England NHLE (OGL v3.0).</em>';
    } else if (p.feature_class === 'listed_building') {
      content = '<strong>' + esc(lab) + '</strong>' +
        (p.ref ? ' <span style="color:#666">(NHLE ' + esc(p.ref) + ')</span>' : '') + '<br>' +
        'Grade: <strong>' + esc(p.grade || 'I / II*') + '</strong><br>' +
        'Status: ' + esc(p.status || 'Statutory designation') + '<br>' +
        (p.hyperlink ? '<a href="' + esc(p.hyperlink) + '" target="_blank" rel="noopener">Historic England List Entry</a><br>' : '') +
        '<em>Statutory Listed Building, Historic England NHLE (OGL v3.0).</em>';
    } else if (p.feature_class === 'conservation_area') {
      content = '<strong>' + esc(lab) + '</strong>' +
        (p.ref ? ' <span style="color:#666">(UID ' + esc(p.ref) + ')</span>' : '') + '<br>' +
        'Type: ' + esc(meta.label) + '<br>' +
        (p.date_designated ? 'Designated: ' + esc(p.date_designated) + '<br>' : '') +
        'Status: ' + esc(p.status || 'Statutory designation') + '<br>' +
        '<em>Designated under Planning (Listed Buildings and Conservation Areas) Act 1990.</em>';
    } else if (p.feature_class === 'unscheduled_archaeology') {
      content = '<strong>' + esc(lab) + '</strong>' +
        ' <span style="color:#666">(' + esc(p.id) + ')</span><br>' +
        'Type: ' + esc(meta.label) + '<br>' +
        'Policy: ' + esc(p.official_designation || 'Swindon Local Plan') + '<br>' +
        'Source: ' + esc(p.source || 'SBC Planning Portal WFS') + '<br>' +
        '<em>Local Plan archaeological notification area (indicative context).</em>';
    } else if (p.feature_class === 'country_park_core' || p.feature_class === 'open_space_large' || p.feature_class === 'recreation_ground' || p.feature_class === 'high_value_habitat') {
      content = '<strong>' + esc(lab) + '</strong>' +
        ' <span style="color:#666">(' + esc(p.id) + ')</span><br>' +
        'Type: ' + esc(meta.label) + '<br>' +
        'Status: ' + esc(p.status || 'Adopted / Protected Open Space') + '<br>' +
        (p.area_ha != null ? 'Area: ' + esc(p.area_ha) + ' ha<br>' : '') +
        '<em>Public open space / ecological asset (mapped baseline).</em>';
    } else if (p.feature_class === 'strategic_railway') {
      content = '<strong>' + esc(lab) + '</strong>' +
        ' <span style="color:#666">(' + esc(p.id) + ')</span><br>' +
        'Type: ' + esc(meta.label) + '<br>' +
        '<em>Strategic rail corridor / linear green-network context.</em>';
    } else if (p.feature_class === 'residential_garden_zone') {
      var hint = p.street_hint ? ('Near ' + esc(p.street_hint)) : 'Residential Block';
      content = '<strong>' + hint + '</strong>' +
        ' <span style="color:#666">(' + esc(p.id) + ')</span><br>' +
        'Tier: <strong>' + esc(p.tier_label || p.garden_tier || '') + '</strong><br>' +
        'Est. vegetated garden cover: <strong>' + esc(p.est_veg_pct) + '%</strong> (' + esc(p.est_garden_ha) + ' ha of ' + esc(p.area_ha) + ' ha block)<br>' +
        'OSM building footprint: ' + esc(p.bldg_pct) + '% (' + esc(p.bldg_cnt) + ' buildings)<br>' +
        'Sentinel-2 10m NDVI (May/Jun composite): ' + esc(p.ndvi_mean) + '<br>' +
        '<em>Indicative residential matrix permeability estimate (OSM + Sentinel-2 10m). Excluded from core corridor hectare totals.</em>';
    } else {
      content = '<strong>' + esc(lab) + '</strong>' +
        ' <span style="color:#666">(' + esc(p.id) + ')</span><br>' +
        'Type: ' + esc(meta.label) + '<br>' +
        'Status: ' + esc(p.status) + '<br>' +
        (p.area_ha != null ? 'Area: ' + esc(p.area_ha) + ' ha<br>' : '') +
        'Date: ' + esc(p.date || '') + '<br>' +
        '<em>DRAFT / NOTHING FILED. Indicative only, not a legal boundary.</em>';
    }
    return content + shareButtonHtml(p._label || p.id || lab, lab);
  }

  var importedLayers = [];

  function buildLayersMenu() {
    if (!layersList) return;
    layersList.innerHTML = '';
    var layerSpecs = [
      { layer: groups.en1_green_corridor, cls: 'layer-swatch-en1', name: 'Adopted EN1 corridors (' + (groups.en1_green_corridor ? groups.en1_green_corridor.getLayers().length : 0) + ')' },
      { layer: groups.proposed_green_network_additions_2026, cls: 'layer-swatch-proposed', name: 'Proposed: 2026 additions (' + (groups.proposed_green_network_additions_2026 ? groups.proposed_green_network_additions_2026.getLayers().length : 0) + ')' },
      { layer: groups.osm_auto_green_draft, cls: 'layer-swatch-proposed-auto', name: 'Proposed: OSM auto-drafts (' + (groups.osm_auto_green_draft ? groups.osm_auto_green_draft.getLayers().length : 0) + ')' },
      { layer: groups.amenity_water, cls: 'layer-swatch-water', name: 'Rivers & water (' + (groups.amenity_water ? groups.amenity_water.getLayers().length : 0) + ')' },
      { layer: groups.strategic_railway, cls: 'layer-swatch-rail', name: 'Strategic railway corridor (' + (groups.strategic_railway ? groups.strategic_railway.getLayers().length : 0) + ')' },
      { layer: groups.country_park_core, cls: 'layer-swatch-countrypark', name: 'Country Parks (' + (groups.country_park_core ? groups.country_park_core.getLayers().length : 0) + ')' },
      { layer: groups.open_space_large, cls: 'layer-swatch-recreation', name: 'Large Open Space & Recreation (' + (groups.open_space_large ? groups.open_space_large.getLayers().length : 0) + ')' },
      { layer: groups.high_value_habitat, cls: 'layer-swatch-highhabitat', name: 'High Value Habitat (' + (groups.high_value_habitat ? groups.high_value_habitat.getLayers().length : 0) + ')' },
      { layer: groups.extra_urban_woodland, cls: 'layer-swatch-woodland', name: 'Extra-urban Woodland (' + (groups.extra_urban_woodland ? groups.extra_urban_woodland.getLayers().length : 0) + ')' },
      { layer: groups.green_amenities, cls: 'layer-swatch-amenities', name: 'Allotments, Cemetery & Local Green (' + (groups.green_amenities ? groups.green_amenities.getLayers().length : 0) + ')' },
      { layer: groups.scheduled_monument, cls: 'layer-swatch-monument', name: 'Scheduled Monuments (' + (groups.scheduled_monument ? groups.scheduled_monument.getLayers().length : 0) + ')' },
      { layer: groups.unscheduled_archaeology, cls: 'layer-swatch-archaeology', name: 'Unscheduled Archaeology (' + (groups.unscheduled_archaeology ? groups.unscheduled_archaeology.getLayers().length : 0) + ')' },
      { layer: groups.conservation_area, cls: 'layer-swatch-conservation', name: 'Conservation Areas (' + (groups.conservation_area ? groups.conservation_area.getLayers().length : 0) + ')' },
      { layer: groups.listed_building, cls: 'layer-swatch-listed', name: 'Listed Buildings Grade I & II* (' + (groups.listed_building ? groups.listed_building.getLayers().length : 0) + ')' },
      { layer: groups.registered_park_garden, cls: 'layer-swatch-park', name: 'Registered Parks & Gardens (' + (groups.registered_park_garden ? groups.registered_park_garden.getLayers().length : 0) + ')' },
      { layer: groups.ancient_woodland, cls: 'layer-swatch-ancientwoodland', name: 'Ancient Woodland (' + (groups.ancient_woodland ? groups.ancient_woodland.getLayers().length : 0) + ')' },
      { layer: groups.public_right_of_way, cls: 'layer-swatch-prow', name: 'Public Rights of Way (' + (groups.public_right_of_way ? groups.public_right_of_way.getLayers().length : 0) + ')' },
      { layer: groups.residential_garden_zones, cls: 'layer-swatch-gardens', name: 'Residential Gardens: Rich / Moderate / Poor (' + (groups.residential_garden_zones ? groups.residential_garden_zones.getLayers().length : 0) + ')' },
      { layer: groups.planning_applications, cls: 'layer-swatch-planning', name: 'Planning Apps - Pending (' + (groups.planning_applications ? groups.planning_applications.getLayers().length : 0) + ')' },
      { layer: groups.contours_10m, cls: 'layer-swatch-contour', name: 'Elevation Contours 10m (' + (groups.contours_10m && groups.contours_10m.getLayers ? groups.contours_10m.getLayers().length : 0) + ')' },
      { layer: groups.soilscapes, cls: 'layer-swatch-soil', name: 'Soilscapes - Cranfield Soils (' + (groups.soilscapes && groups.soilscapes.getLayers ? groups.soilscapes.getLayers().length : 0) + ')' },
      { layer: groups.agricultural_land, cls: 'layer-swatch-alc', name: 'Agricultural Land - ALC Grades 1-5 (' + (groups.agricultural_land && groups.agricultural_land.getLayers ? groups.agricultural_land.getLayers().length : 0) + ')' },
      { layer: groups.geology_bedrock, cls: 'layer-swatch-bedrock', name: 'BGS Bedrock Geology 625k (' + (groups.geology_bedrock && groups.geology_bedrock.getLayers ? groups.geology_bedrock.getLayers().length : 0) + ')' },
      { layer: groups.geology_superficial, cls: 'layer-swatch-superficial', name: 'BGS Superficial Deposits 625k (' + (groups.geology_superficial && groups.geology_superficial.getLayers ? groups.geology_superficial.getLayers().length : 0) + ')' },
      { layer: groups.lidar_dtm_wms, cls: 'layer-swatch-lidar', name: 'LiDAR 1m DTM Hillshade (EA WMS)' },
      { layer: groups.bgs_geology_wms, cls: 'layer-swatch-bgs50k', name: 'BGS 1:50k Geology (WMS)' },
      { layer: groups.opentopo_map, cls: 'layer-swatch-opentopo', name: 'OpenTopoMap (Topographic Basemap)' },
      { layer: overlays['Community suggestions - indicative (approved)'], cls: 'layer-swatch-community', name: 'Community suggestions' },
      { layer: myPendingLayer, cls: 'layer-swatch-pending', name: 'My pending suggestions' }
    ];

    importedLayers.forEach(function (imp) {
      layerSpecs.push(imp);
    });

    layerSpecs.forEach(function (spec) {
      if (!spec.layer) return;
      var row = document.createElement('label');
      row.className = 'layer-row';
      var chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = map.hasLayer(spec.layer);
      chk.onchange = function () {
        if (chk.checked) {
          if (!map.hasLayer(spec.layer)) map.addLayer(spec.layer);
        } else {
          if (map.hasLayer(spec.layer)) map.removeLayer(spec.layer);
        }
      };
      var sw = document.createElement('span');
      sw.className = 'layer-swatch ' + spec.cls;
      var lbl = document.createElement('span');
      lbl.className = 'layer-label-text';
      lbl.textContent = spec.name;
      row.appendChild(chk);
      row.appendChild(sw);
      row.appendChild(lbl);
      layersList.appendChild(row);
    });

    var harvestEl = document.getElementById('layers-harvest-info');
    if (harvestEl) {
      if (planningMeta && planningMeta.harvested_date) {
        harvestEl.hidden = false;
        harvestEl.innerHTML = '<strong>Planning Layer Snapshot:</strong> harvested <strong>' + esc(planningMeta.harvested_date) + '</strong> (' +
          esc(planningMeta.window_days || 120) + 'd pending only; off by default). Verify live status on pa.swindon.gov.uk.' +
          '<div class="plan-key-row">' +
          '<span class="plan-key-item"><span class="plan-key-dot" style="background:#dc2626"></span>Large</span>' +
          '<span class="plan-key-item"><span class="plan-key-dot" style="background:#ea580c"></span>Medium</span>' +
          '<span class="plan-key-item"><span class="plan-key-dot" style="background:#7c3aed"></span>Trees</span>' +
          '<span class="plan-key-item"><span class="plan-key-dot" style="background:#db2777"></span>Standard</span>' +
          '<span class="plan-key-item"><span class="plan-key-dot" style="background:#64748b"></span>Cond.</span>' +
          '</div>';
      } else {
        harvestEl.hidden = true;
      }
    }
  }

  // Offline Map Pack & Tile Caching Controls
  var btnCacheTiles = document.getElementById('btn-cache-tiles');
  var btnImportPack = document.getElementById('btn-import-pack');
  var fileImportPack = document.getElementById('file-import-pack');
  var cacheStatusEl = document.getElementById('offline-cache-status');

  function lon2tile(lon, zoom) {
    return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
  }
  function lat2tile(lat, zoom) {
    return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  }

  if (btnCacheTiles) {
    btnCacheTiles.onclick = function () {
      if (!('caches' in window)) {
        showToast('Offline cache storage not supported on this browser.');
        return;
      }
      var bounds = map.getBounds();
      var currentZ = Math.round(map.getZoom());
      var zooms = [currentZ, Math.min(18, currentZ + 1)];
      var tileUrls = [];

      zooms.forEach(function (z) {
        var minX = lon2tile(bounds.getWest(), z);
        var maxX = lon2tile(bounds.getEast(), z);
        var minY = lat2tile(bounds.getNorth(), z);
        var maxY = lat2tile(bounds.getSouth(), z);

        for (var x = Math.min(minX, maxX); x <= Math.max(minX, maxX); x++) {
          for (var y = Math.min(minY, maxY); y <= Math.max(minY, maxY); y++) {
            tileUrls.push('https://tile.openstreetmap.org/' + z + '/' + x + '/' + y + '.png');
          }
        }
      });

      if (tileUrls.length > 150) {
        tileUrls = tileUrls.slice(0, 150);
      }

      if (cacheStatusEl) cacheStatusEl.textContent = 'Caching ' + tileUrls.length + ' map tiles...';
      showToast('Caching ' + tileUrls.length + ' map tiles for offline use...');

      caches.open('gc-data-v6').then(function (cache) {
        var completed = 0;
        return Promise.all(tileUrls.map(function (url) {
          return fetch(url).then(function (resp) {
            if (resp && resp.ok) {
              cache.put(url, resp);
              completed += 1;
              if (cacheStatusEl && completed % 10 === 0) {
                cacheStatusEl.textContent = 'Cached ' + completed + '/' + tileUrls.length + ' tiles...';
              }
            }
          }).catch(function () {});
        })).then(function () {
          if (cacheStatusEl) cacheStatusEl.textContent = 'Cached ' + completed + ' tiles. Ready offline!';
          showToast('Success: ' + completed + ' tiles cached! Map works offline.');
        });
      }).catch(function (err) {
        if (cacheStatusEl) cacheStatusEl.textContent = 'Cache error: ' + (err.message || 'failed');
        showToast('Could not cache tiles: ' + (err.message || 'unknown error'));
      });
    };
  }

  if (btnImportPack && fileImportPack) {
    btnImportPack.onclick = function () {
      fileImportPack.click();
    };

    fileImportPack.onchange = function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var data = JSON.parse(e.target.result);
          var layersAdded = 0;

          if (data.layers && Array.isArray(data.layers)) {
            data.layers.forEach(function (packLayer) {
              var fc = { type: 'FeatureCollection', features: packLayer.features || [] };
              var lyr = L.geoJSON(fc, {
                style: { color: '#0d9488', weight: 2, fillOpacity: 0.35, fillColor: '#14b8a6' },
                pointToLayer: function (f, latlng) { return L.circleMarker(latlng, { radius: 6, color: '#0f766e', fillColor: '#2dd4bf', fillOpacity: 0.8 }); },
                onEachFeature: function (f, l) {
                  var p = f.properties || {};
                  l.bindPopup('<strong>' + esc(p.name || packLayer.name || 'Offline Feature') + '</strong><br>' +
                    'Pack: ' + esc(data.pack_name || 'Imported Pack') + '<br>' +
                    (p.notes ? 'Notes: ' + esc(p.notes) + '<br>' : '') +
                    '<em>Loaded from offline map pack.</em>');
                }
              }).addTo(map);

              importedLayers.push({
                name: (packLayer.name || 'Pack Layer') + ' (' + (packLayer.features ? packLayer.features.length : 0) + ')',
                layer: lyr,
                cls: 'layer-swatch-pack'
              });
              layersAdded += 1;
            });
            buildLayersMenu();
            if (cacheStatusEl) cacheStatusEl.textContent = 'Loaded ' + layersAdded + ' layers from map pack';
            showToast('Loaded ' + layersAdded + ' layers from ' + (data.pack_name || file.name) + '!');
          } else if (data.type === 'FeatureCollection' || data.features) {
            var lyrSingle = L.geoJSON(data, {
              style: { color: '#7c3aed', weight: 2, fillOpacity: 0.35, fillColor: '#8b5cf6' },
              pointToLayer: function (f, latlng) { return L.circleMarker(latlng, { radius: 6, color: '#6d28d9', fillColor: '#a78bfa', fillOpacity: 0.8 }); },
              onEachFeature: function (f, l) {
                var p = f.properties || {};
                l.bindPopup('<strong>' + esc(p.name || file.name) + '</strong><br><em>Imported GeoJSON layer.</em>');
              }
            }).addTo(map);

            importedLayers.push({
              name: file.name.replace(/\.[^/.]+$/, '') + ' (' + (data.features ? data.features.length : 0) + ')',
              layer: lyrSingle,
              cls: 'layer-swatch-pack'
            });
            buildLayersMenu();
            if (cacheStatusEl) cacheStatusEl.textContent = 'Loaded ' + file.name;
            showToast('Loaded GeoJSON: ' + file.name);
          } else {
            showToast('Unrecognized format. Please select a GeoJSON or Green Corridor Map Pack.');
          }
        } catch (err) {
          showToast('Failed to parse file: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
  }

  function loadParcels() {
    return fetch('data/parcels-public.geojson?v=27').then(function (r) { return r.json(); }).then(function (fc) {
      parcels = fc.features || [];
      var proposedSeq = buildProposedSeq(parcels);
      parcels.forEach(function (f) { f.properties = f.properties || {}; f.properties._label = displayLabel(f.properties, proposedSeq, null); });
      var countEl = document.getElementById('count');
      if (countEl) countEl.textContent = parcels.length;

      var groupMembers = {
        proposed_green_network_additions_2026: { proposed_green_network_additions_2026: true, proposed_new_areas: true },
        open_space_large: { open_space_large: true, recreation_ground: true },
        green_amenities: { amenity_allotments: true, allotments_community_growing: true, amenity_cemetery: true, amenity_open_green: true }
      };
      var order = [
        'en1_green_corridor',
        'proposed_green_network_additions_2026',
        'osm_auto_green_draft',
        'amenity_water',
        'strategic_railway',
        'country_park_core',
        'open_space_large',
        'high_value_habitat',
        'extra_urban_woodland',
        'green_amenities',
        'scheduled_monument',
        'unscheduled_archaeology',
        'conservation_area',
        'registered_park_garden',
        'listed_building'
      ];
      order.forEach(function (cls) {
        var meta = CLASS_META[cls] || { color:'#607D8B', weight:2, fillOpacity:0.15 };
        var members = groupMembers[cls];
        var clsFeats = parcels.filter(function(f){
          var fcName = (f.properties && f.properties.feature_class) || '';
          return members ? !!members[fcName] : fcName === cls;
        });
        var g = L.geoJSON({type:'FeatureCollection', features: clsFeats}, {
          style: function (feat) {
            var gtype = feat && feat.geometry && feat.geometry.type;
            var isLine = gtype === 'LineString' || gtype === 'MultiLineString';
            var s = { color: meta.color, weight: meta.weight, fillColor: meta.fill || meta.color, fillOpacity: isLine ? 0 : (meta.hatch ? 0.001 : (meta.fillOpacity != null ? meta.fillOpacity : 0.1)), opacity: 0.95 };
            if (isLine) s.fill = false;
            if (meta.dash) s.dashArray = meta.dash;
            return s;
          },
          pointToLayer: function (f, latlng) {
            var r = (cls === 'listed_building') ? 6 : 5;
            return L.circleMarker(latlng, { radius: r, color: meta.color, fillColor: meta.fill || meta.color, fillOpacity: 0.85, weight: 2 });
          },
          onEachFeature: function (f, l) {
            var featCls = (f.properties && f.properties.feature_class) || cls;
            var lab = f.properties._label || f.properties.id;
            l.bindPopup(popupHtml(f.properties, lab));
            l.on('click', function (ev) { try { L.DomEvent.stopPropagation(ev); } catch(e){} showSelectedLabel(l, lab, featCls); });
          }
        });
        groups[cls] = g;
        if (meta.defaultVisible !== false) {
          g.addTo(map);
        }
      });
      injectHatchDefs();
      order.forEach(function (cls) { if (CLASS_META[cls] && CLASS_META[cls].hatch && groups[cls]) applyHatch(groups[cls], cls); });

      overlays['Adopted EN1 green corridors (' + (groups.en1_green_corridor ? groups.en1_green_corridor.getLayers().length : 0) + ')'] = groups.en1_green_corridor;
      overlays['Proposed: 2026 additions - draft (' + (groups.proposed_green_network_additions_2026 ? groups.proposed_green_network_additions_2026.getLayers().length : 0) + ')'] = groups.proposed_green_network_additions_2026;
      overlays['Proposed: OSM auto-drafts - draft (' + (groups.osm_auto_green_draft ? groups.osm_auto_green_draft.getLayers().length : 0) + ')'] = groups.osm_auto_green_draft;
      overlays['Rivers & water (' + (groups.amenity_water ? groups.amenity_water.getLayers().length : 0) + ')'] = groups.amenity_water;
      overlays['Strategic railway corridor (' + (groups.strategic_railway ? groups.strategic_railway.getLayers().length : 0) + ')'] = groups.strategic_railway;
      overlays['Country Parks (' + (groups.country_park_core ? groups.country_park_core.getLayers().length : 0) + ')'] = groups.country_park_core;
      overlays['Large Open Space & Recreation (' + (groups.open_space_large ? groups.open_space_large.getLayers().length : 0) + ')'] = groups.open_space_large;
      overlays['High Value Habitat (' + (groups.high_value_habitat ? groups.high_value_habitat.getLayers().length : 0) + ')'] = groups.high_value_habitat;
      overlays['Extra-urban Woodland (' + (groups.extra_urban_woodland ? groups.extra_urban_woodland.getLayers().length : 0) + ')'] = groups.extra_urban_woodland;
      overlays['Allotments, Cemetery & Local Green (' + (groups.green_amenities ? groups.green_amenities.getLayers().length : 0) + ')'] = groups.green_amenities;
      overlays['Scheduled Monuments (' + (groups.scheduled_monument ? groups.scheduled_monument.getLayers().length : 0) + ')'] = groups.scheduled_monument;
      overlays['Unscheduled Archaeology (' + (groups.unscheduled_archaeology ? groups.unscheduled_archaeology.getLayers().length : 0) + ')'] = groups.unscheduled_archaeology;
      overlays['Conservation Areas (' + (groups.conservation_area ? groups.conservation_area.getLayers().length : 0) + ')'] = groups.conservation_area;
      overlays['Listed Buildings (' + (groups.listed_building ? groups.listed_building.getLayers().length : 0) + ')'] = groups.listed_building;
      overlays['Registered Parks & Gardens (' + (groups.registered_park_garden ? groups.registered_park_garden.getLayers().length : 0) + ')'] = groups.registered_park_garden;

      try {
        var baseGroups = ['en1_green_corridor','proposed_green_network_additions_2026','osm_auto_green_draft','amenity_water','strategic_railway'].map(function(c){return groups[c];}).filter(Boolean);
        var all = L.featureGroup(baseGroups);
        map.fitBounds(all.getBounds());
      } catch (e) {}

      var list = document.getElementById('parcel-list');
      if (list) {
        list.innerHTML = '';
        parcels.forEach(function (f) {
          var li = document.createElement('li');
          var lab = f.properties._label || f.properties.id;
          li.textContent = lab + ' \u2014 ' + ((CLASS_META[f.properties.feature_class]||{}).label || f.properties.feature_class || '');
          li.onclick = function () {
            try {
              var b = L.geoJSON(f.geometry).getBounds();
              map.fitBounds(b.pad(0.5));
              closePanelOnMobile();
            } catch(e){}
          };
          list.appendChild(li);
        });
      }
    });
  }

  function loadCommunity() {
    return fetch('data/community.geojson').then(function (r) { if (!r.ok) throw new Error('no'); return r.json(); }).then(function (fc) {
      var feats = (fc && fc.features) ? fc.features : [];
      var n = 0;
      feats.forEach(function (f) {
        f.properties = f.properties || {};
        f.properties.feature_class = 'community_suggestion';
        n += 1;
        f.properties._label = displayLabel(f.properties, null, n);
      });
      var meta = CLASS_META.community_suggestion;
      var layer = L.geoJSON({type:'FeatureCollection', features: feats}, {
        style: function () { return { color: meta.color, weight: meta.weight, dashArray: meta.dash, fillColor: meta.fill, fillOpacity: meta.fillOpacity, opacity: 0.95 }; },
        pointToLayer: function (f, latlng) { return L.circleMarker(latlng, { radius: 7, color: meta.color, fillColor: meta.fill, fillOpacity: 0.7, weight: 2 }); },
        onEachFeature: function (f, l) {
          var lab = f.properties._label || 'C';
          l.bindPopup(popupHtml(f.properties, lab));
          l.on('click', function (ev) { try { L.DomEvent.stopPropagation(ev); } catch(e){} showSelectedLabel(l, lab, 'community_suggestion'); });
        }
      });
      overlays['Community suggestions - indicative (approved)'] = layer;
    }).catch(function () {
      overlays['Community suggestions - indicative (approved)'] = L.layerGroup();
    });
  }

  function loadGardenZones() {
    var tierStyles = {
      garden_rich: { color: '#16a34a', fillColor: '#22c55e', weight: 0.7, opacity: 0.32, fillOpacity: 0.22 },
      garden_moderate: { color: '#65a30d', fillColor: '#bef264', weight: 0.6, opacity: 0.24, fillOpacity: 0.14 },
      garden_poor: { color: '#475569', fillColor: '#64748b', weight: 0.7, opacity: 0.34, fillOpacity: 0.22 }
    };
    return fetch('data/residential-garden-zones.geojson?v=1').then(function (r) { if (!r.ok) throw new Error('no'); return r.json(); }).then(function (fc) {
      var feats = (fc && fc.features) ? fc.features : [];
      var layer = L.geoJSON({ type: 'FeatureCollection', features: feats }, {
        pane: 'gardenMatrixPane',
        style: function (f) {
          var t = (f && f.properties && f.properties.garden_tier) || 'garden_moderate';
          return tierStyles[t] || tierStyles.garden_moderate;
        },
        onEachFeature: function (f, l) {
          var p = f.properties || {};
          var lab = p.street_hint ? ('Near ' + p.street_hint) : (p.id || 'Residential Block');
          l.bindPopup(popupHtml(p, lab));
        }
      });
      groups.residential_garden_zones = layer;
      layer.addTo(map);
      overlays['Residential Gardens: Rich / Moderate / Poor (' + feats.length + ')'] = layer;
    }).catch(function () {
      groups.residential_garden_zones = L.layerGroup();
      overlays['Residential Gardens: Rich / Moderate / Poor (0)'] = groups.residential_garden_zones;
    });
  }

  function loadAncientWoodland() {
    return fetch('data/ancient-woodland.geojson').then(function (r) { if (!r.ok) throw new Error('no'); return r.json(); }).then(function (fc) {
      var feats = (fc && fc.features) ? fc.features : [];
      var meta = CLASS_META.ancient_woodland;
      var layer = L.geoJSON({type: 'FeatureCollection', features: feats}, {
        style: function () {
          return { color: meta.color, weight: meta.weight, dashArray: meta.dash, fillColor: meta.fill, fillOpacity: meta.fillOpacity, opacity: 0.95 };
        },
        onEachFeature: function (f, l) {
          var p = f.properties || {};
          var lab = p.name || 'Ancient Woodland';
          l.bindPopup(popupHtml(p, lab));
          l.on('click', function (ev) { try { L.DomEvent.stopPropagation(ev); } catch(e){} showSelectedLabel(l, lab, 'ancient_woodland'); });
        }
      });
      groups.ancient_woodland = layer;
      overlays['Ancient Woodland (' + feats.length + ')'] = layer;
    }).catch(function () {
      groups.ancient_woodland = L.layerGroup();
    });
  }

  function loadProw() {
    return fetch('data/prow-swindon.geojson').then(function (r) { if (!r.ok) throw new Error('no'); return r.json(); }).then(function (fc) {
      var feats = (fc && fc.features) ? fc.features : [];
      var layer = L.geoJSON({type: 'FeatureCollection', features: feats}, {
        style: function (f) {
          var p = (f && f.properties) || {};
          var col = '#d97706';
          var dash = '4 4';
          if (p.code === 'Br') { col = '#0284c7'; dash = '6 4'; }
          else if (p.code === 'By' || p.code === 'Ru') { col = '#dc2626'; dash = null; }
          return { color: col, weight: 2.4, dashArray: dash, opacity: 0.9 };
        },
        onEachFeature: function (f, l) {
          var p = f.properties || {};
          var lab = p.name || 'Right of Way';
          l.bindPopup(popupHtml(p, lab));
          l.on('click', function (ev) { try { L.DomEvent.stopPropagation(ev); } catch(e){} showSelectedLabel(l, lab, 'public_right_of_way'); });
        }
      });
      groups.public_right_of_way = layer;
      overlays['Public Rights of Way (' + feats.length + ')'] = layer;
    }).catch(function () {
      groups.public_right_of_way = L.layerGroup();
    });
  }

  function loadPlanningApplications() {
    return fetch('data/planning-swindon.geojson').then(function (r) { if (!r.ok) throw new Error('no'); return r.json(); }).then(function (fc) {
      planningFeats = (fc && fc.features) ? fc.features : [];
      planningMeta = (fc && fc.metadata) ? fc.metadata : { harvested_date: 'unknown', window_days: 120 };

      var menuDatesEl = document.getElementById('menu-data-dates');
      if (menuDatesEl && planningMeta.harvested_date) {
        menuDatesEl.textContent = 'Corridors data: 2026-11-12 \u2022 Planning snapshot: ' + planningMeta.harvested_date +
          ' (pending only, off by default). Verify live deadlines on pa.swindon.gov.uk.';
      }
      var entryRecencyEl = document.getElementById('entry-recency-note');
      if (entryRecencyEl && planningMeta.harvested_date) {
        entryRecencyEl.textContent = 'Planning layer snapshot harvested ' + planningMeta.harvested_date +
          ' (off by default in Layers); always verify live application status and deadlines on Swindon Public Access.';
      }

      var layer = L.geoJSON({type: 'FeatureCollection', features: planningFeats}, {
        pointToLayer: function (f, latlng) {
          var p = (f && f.properties) || {};
          var st = PLANNING_STYLE_MAP[p.category] || PLANNING_STYLE_MAP.standard;
          return L.circleMarker(latlng, {
            radius: st.radius,
            color: st.color,
            fillColor: st.fill,
            fillOpacity: 0.88,
            weight: (p.category === 'major') ? 2.5 : 1.8
          });
        },
        onEachFeature: function (f, l) {
          var p = f.properties || {};
          var lab = p.uid || 'Planning App';
          var latlng = l.getLatLng ? l.getLatLng() : null;
          l.bindPopup(planningPopupHtml(p, lab, latlng));
          l.on('click', function (ev) { try { L.DomEvent.stopPropagation(ev); } catch(e){} showSelectedLabel(l, lab, 'planning_application'); });
        }
      });
      groups.planning_applications = layer;
      overlays['Planning Apps - Pending (' + planningFeats.length + ')'] = layer;
      // Intentionally NOT added to map by default (user toggles on in Layers)
    }).catch(function () {
      groups.planning_applications = L.layerGroup();
    });
  }

  function loadContours10m() {
    return fetch('data/contours-10m.geojson').then(function (r) { if (!r.ok) throw new Error('no'); return r.json(); }).then(function (fc) {
      var feats = (fc && fc.features) ? fc.features : [];
      var layer = L.geoJSON({type: 'FeatureCollection', features: feats}, {
        style: function (f) {
          var p = (f && f.properties) || {};
          var isIdx = !!p.is_index;
          return {
            color: '#b45309',
            weight: isIdx ? 2.5 : 1.2,
            opacity: isIdx ? 0.9 : 0.6,
            dashArray: isIdx ? null : '4, 4'
          };
        },
        onEachFeature: function (f, l) {
          var p = f.properties || {};
          var elevM = p.elevation_m != null ? p.elevation_m : '?';
          var elevFt = p.elevation_ft != null ? p.elevation_ft : '?';
          var html = '<strong>Elevation Contour: ' + esc(elevM) + 'm</strong> (' + esc(elevFt) + ' ft AOD)<br>' +
            '<span>' + (p.is_index ? 'Index contour (50m interval)' : '10m intermediate contour') + '</span><br>' +
            '<span style="color:#64748b;font-size:10.5px">Source: Copernicus DEM / AWS Terrarium</span>';
          l.bindPopup(html);
        }
      });
      groups.contours_10m = layer;
      overlays['Elevation Contours 10m (' + feats.length + ')'] = layer;
    }).catch(function () {
      groups.contours_10m = L.layerGroup();
    });
  }

  function loadSoilscapes() {
    return fetch('data/soilscapes-swindon.geojson').then(function (r) { if (!r.ok) throw new Error('no'); return r.json(); }).then(function (fc) {
      var feats = (fc && fc.features) ? fc.features : [];
      var palette = ['#a16207', '#ca8a04', '#d97706', '#b45309', '#65a30d', '#15803d', '#0f766e', '#0369a1', '#7c3aed'];
      var layer = L.geoJSON({type: 'FeatureCollection', features: feats}, {
        style: function (f) {
          var p = (f && f.properties) || {};
          var col = palette[Math.abs(p.SS_ID || 0) % palette.length];
          return {
            color: '#854d0e',
            weight: 1.5,
            fillColor: col,
            fillOpacity: 0.38
          };
        },
        onEachFeature: function (f, l) {
          var p = f.properties || {};
          var html = '<strong>Soilscape: ' + esc(p.SOILSCAPE || 'Cranfield Soil') + '</strong><br>' +
            '<strong>Texture:</strong> ' + esc(p.TEXTURE || 'N/A') + '<br>' +
            '<strong>Drainage:</strong> ' + esc(p.DRAINAGE || 'N/A') + '<br>' +
            '<strong>Natural Fertility:</strong> ' + esc(p.FERTILITY || 'N/A') + '<br>' +
            '<strong>Associated Habitat:</strong> ' + esc(p.HABITAT || 'N/A') + '<br>' +
            '<span style="color:#64748b;font-size:10.5px">Cranfield NSRI Soilscapes (1:250k) &copy; Cranfield University</span>';
          l.bindPopup(html);
        }
      });
      groups.soilscapes = layer;
      overlays['Soilscapes - Cranfield Soils (' + feats.length + ')'] = layer;
    }).catch(function () {
      groups.soilscapes = L.layerGroup();
    });
  }

  function loadAgriculturalLand() {
    return fetch('data/alc-swindon.geojson').then(function (r) { if (!r.ok) throw new Error('no'); return r.json(); }).then(function (fc) {
      var feats = (fc && fc.features) ? fc.features : [];
      function alcColor(grade) {
        var g = String(grade || '').toLowerCase();
        if (g.indexOf('grade 1') >= 0) return '#15803d';
        if (g.indexOf('grade 2') >= 0) return '#22c55e';
        if (g.indexOf('grade 3') >= 0) return '#eab308';
        if (g.indexOf('grade 4') >= 0) return '#f97316';
        if (g.indexOf('grade 5') >= 0) return '#ef4444';
        return '#94a3b8';
      }
      var layer = L.geoJSON({type: 'FeatureCollection', features: feats}, {
        style: function (f) {
          var p = (f && f.properties) || {};
          return {
            color: '#334155',
            weight: 1.2,
            fillColor: alcColor(p.ALC_GRADE),
            fillOpacity: 0.42
          };
        },
        onEachFeature: function (f, l) {
          var p = f.properties || {};
          var html = '<strong>Agricultural Land: ' + esc(p.ALC_GRADE || 'ALC Grade') + '</strong><br>' +
            '<span>Provisional Agricultural Land Classification (England).</span><br>' +
            '<span style="color:#64748b;font-size:10.5px">Source: Natural England Open Data &copy; Crown Copyright</span>';
          l.bindPopup(html);
        }
      });
      groups.agricultural_land = layer;
      overlays['Agricultural Land - ALC Grades 1-5 (' + feats.length + ')'] = layer;
    }).catch(function () {
      groups.agricultural_land = L.layerGroup();
    });
  }

  function loadGeology() {
    var pBedrock = fetch('data/geology-bedrock-swindon.geojson').then(function (r) { if (!r.ok) throw new Error('no'); return r.json(); });
    var pSuperficial = fetch('data/geology-superficial-swindon.geojson').then(function (r) { if (!r.ok) throw new Error('no'); return r.json(); });

    return Promise.all([pBedrock, pSuperficial]).then(function (results) {
      var bFc = results[0];
      var sFc = results[1];
      var bFeats = (bFc && bFc.features) ? bFc.features : [];
      var sFeats = (sFc && sFc.features) ? sFc.features : [];

      groups.geology_bedrock = L.geoJSON({type: 'FeatureCollection', features: bFeats}, {
        style: function (f) {
          var p = (f && f.properties) || {};
          return {
            color: '#0369a1',
            weight: 1.5,
            fillColor: p.HEX_COLOR || '#0284c7',
            fillOpacity: 0.4
          };
        },
        onEachFeature: function (f, l) {
          var p = f.properties || {};
          var title = p.AGE || p.LEX_RCS || 'Bedrock Geology';
          var html = '<strong>BGS Bedrock: ' + esc(title) + '</strong><br>' +
            '<strong>Lithology:</strong> ' + esc(p.LITHOLOGY || 'N/A') + '<br>' +
            '<strong>Period:</strong> ' + esc(p.PERIOD || 'N/A') + (p.ERA ? ' (' + esc(p.ERA) + ')' : '') + '<br>' +
            '<strong>Environment:</strong> ' + esc(p.ENVIRONMENT || 'N/A') + '<br>' +
            '<span style="color:#64748b;font-size:10.5px">BGS 1:625k Bedrock Geology &copy; British Geological Survey</span>';
          l.bindPopup(html);
        }
      });
      overlays['BGS Bedrock Geology 625k (' + bFeats.length + ')'] = groups.geology_bedrock;

      groups.geology_superficial = L.geoJSON({type: 'FeatureCollection', features: sFeats}, {
        style: function () {
          return {
            color: '#b45309',
            weight: 1.5,
            fillColor: '#f59e0b',
            fillOpacity: 0.45
          };
        },
        onEachFeature: function (f, l) {
          var p = f.properties || {};
          var title = p.LEGEND_DESCRIPTION || p.LEX_ROCK || 'Superficial Deposit';
          var html = '<strong>BGS Superficial: ' + esc(title) + '</strong><br>' +
            '<strong>Process:</strong> ' + esc(p.PROCESS || 'Water processes') + '<br>' +
            '<strong>Environment:</strong> ' + esc(p.ENVIRONMENT || 'River deposits / alluvium') + '<br>' +
            '<span style="color:#64748b;font-size:10.5px">BGS 1:625k Superficial Deposits &copy; British Geological Survey</span>';
          l.bindPopup(html);
        }
      });
      overlays['BGS Superficial Deposits 625k (' + sFeats.length + ')'] = groups.geology_superficial;
    }).catch(function () {
      groups.geology_bedrock = L.layerGroup();
      groups.geology_superficial = L.layerGroup();
    });
  }

  function initWmsLayers() {
    try {
      groups.lidar_dtm_wms = L.tileLayer.wms('https://environment.data.gov.uk/spatialdata/lidar-composite-digital-terrain-model-dtm-1m/wms', {
        layers: 'Lidar_Composite_Hillshade_DTM_1m',
        format: 'image/png',
        transparent: true,
        attribution: 'LiDAR 1m DTM &copy; Environment Agency',
        maxZoom: 19,
        opacity: 0.75
      });
      overlays['LiDAR 1m DTM Hillshade (EA WMS)'] = groups.lidar_dtm_wms;

      groups.bgs_geology_wms = L.tileLayer.wms('https://map.bgs.ac.uk/arcgis/services/BGS_Detailed_Geology/MapServer/WMSServer', {
        layers: 'BGS.50k.Bedrock,BGS.50k.Superficial.deposits',
        format: 'image/png',
        transparent: true,
        attribution: 'BGS 1:50k Geology &copy; British Geological Survey',
        maxZoom: 19,
        opacity: 0.65
      });
      overlays['BGS 1:50k Geology (WMS)'] = groups.bgs_geology_wms;

      groups.opentopo_map = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: 'Map: &copy; OpenStreetMap contributors, SRTM | Style: &copy; OpenTopoMap (CC-BY-SA)',
        opacity: 0.85
      });
      overlays['OpenTopoMap (Topographic Basemap)'] = groups.opentopo_map;
    } catch (e) {}
    return Promise.resolve();
  }

  function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {});
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
    }
  }

  function navigateToParcel(targetId) {
    if (!targetId) return;
    var lower = targetId.toLowerCase().trim();
    if (lower.indexOf('plan:') === 0 && groups.planning_applications) {
      var planUid = lower.slice(5);
      if (!map.hasLayer(groups.planning_applications)) {
        map.addLayer(groups.planning_applications);
        buildLayersMenu();
      }
      groups.planning_applications.eachLayer(function (l) {
        var lp = (l.feature && l.feature.properties) || {};
        if (String(lp.uid || '').toLowerCase() === planUid || String(lp.id || '').toLowerCase() === lower) {
          var ll = l.getLatLng();
          map.setView(ll, 16, { animate: true });
          showToast('Planning: ' + (lp.uid || planUid));
          setTimeout(function () { l.openPopup(); }, 350);
        }
      });
      return;
    }
    var found = null;
    for (var i = 0; i < parcels.length; i++) {
      var p = parcels[i].properties || {};
      var lab = (p._label || '').toLowerCase();
      var pid = String(p.id || '').toLowerCase();
      if (pid === lower || lab === lower) {
        found = parcels[i];
        break;
      }
    }
    if (found) {
      try {
        var b = L.geoJSON(found.geometry).getBounds();
        map.fitBounds(b.pad(0.5), { animate: true });
        var labText = found.properties._label || found.properties.id;
        showToast('Viewing: ' + labText);
        var fc = found.properties.feature_class;
        var grp = groups[fc];
        if (grp) {
          if (!map.hasLayer(grp)) map.addLayer(grp);
          grp.eachLayer(function (l) {
            var lp = (l.feature && l.feature.properties) || {};
            if (String(lp.id) === String(found.properties.id)) {
              setTimeout(function () { l.openPopup(); }, 350);
            }
          });
        }
      } catch (e) {}
    }
  }

  function handleUrlHash() {
    var hash = String(window.location.hash || '').trim();
    if (!hash || hash === '#') return;
    var mLib = hash.match(/^#library(?:=(.+))?$/i);
    if (mLib) {
      var cat = mLib[1] ? decodeURIComponent(mLib[1]).trim() : 'all';
      openLibraryModal(cat);
      return;
    }
    var mParcel = hash.match(/^#(?:parcel|id)=(.+)$/i);
    if (mParcel) {
      var targetId = decodeURIComponent(mParcel[1]).trim();
      navigateToParcel(targetId);
      return;
    }
    var mLoc = hash.match(/^#loc=([-\d.]+),([-\d.]+),?(\d+)?$/i);
    if (mLoc) {
      var lat = parseFloat(mLoc[1]);
      var lng = parseFloat(mLoc[2]);
      var z = mLoc[3] ? parseInt(mLoc[3], 10) : 15;
      if (!isNaN(lat) && !isNaN(lng)) {
        map.setView([lat, lng], z);
      }
    }
  }

  window.addEventListener('hashchange', handleUrlHash);

  // Popup share & annotate button listeners
  map.on('popupopen', function (e) {
    var el = e.popup && e.popup.getElement();
    if (!el) return;
    var shareBtn = el.querySelector('.popup-share-btn');
    if (shareBtn) {
      shareBtn.onclick = function (ev) {
        ev.stopPropagation();
        var shareId = shareBtn.getAttribute('data-share-id') || '';
        var shareTitle = shareBtn.getAttribute('data-share-title') || 'Swindon Green Corridor';
        var url = window.location.origin + window.location.pathname + '#parcel=' + encodeURIComponent(shareId);
        if (history.replaceState) {
          history.replaceState(null, null, '#parcel=' + encodeURIComponent(shareId));
        }
        if (navigator.share) {
          navigator.share({
            title: 'Swindon Green Corridor - ' + shareTitle,
            text: 'View this feature on the Swindon Green Corridor map:',
            url: url
          }).catch(function () {});
        } else {
          copyTextToClipboard(url);
          showToast('Link copied to clipboard!');
        }
      };
    }
    var planNoteBtn = el.querySelector('.plan-annotate-btn');
    if (planNoteBtn) {
      planNoteBtn.onclick = function (ev) {
        ev.stopPropagation();
        var uid = planNoteBtn.getAttribute('data-plan-uid') || '';
        var lat = parseFloat(planNoteBtn.getAttribute('data-plan-lat'));
        var lng = parseFloat(planNoteBtn.getAttribute('data-plan-lng'));
        var ward = planNoteBtn.getAttribute('data-plan-ward') || '';
        if (!isNaN(lat) && !isNaN(lng)) {
          try { map.closePopup(); } catch (err) {}
          captureDraw(L.marker([lat, lng]));
          var cPlace = document.getElementById('c-place');
          var cNotes = document.getElementById('c-notes');
          if (cPlace) {
            cPlace.value = 'Near planning ref ' + uid + (ward ? ' (' + ward + ')' : '');
          }
          if (cNotes && !cNotes.value.trim()) {
            cNotes.value = 'Ref planning application ' + uid + ': ';
          }
        }
      };
    }
  });

  loadParcels()
    .then(function () { return loadGardenZones(); })
    .then(function () { return loadCommunity(); })
    .then(function () { return loadAncientWoodland(); })
    .then(function () { return loadProw(); })
    .then(function () { return loadPlanningApplications(); })
    .then(function () { return loadContours10m(); })
    .then(function () { return loadSoilscapes(); })
    .then(function () { return loadAgriculturalLand(); })
    .then(function () { return loadGeology(); })
    .then(function () { return initWmsLayers(); })
    .catch(function () {})
    .then(function () {
      renderMyPending();
      overlays['My pending (local, awaiting review)'] = myPendingLayer;
      myPendingLayer.addTo(map);
      buildLayersMenu();
      handleUrlHash();
    }).catch(function () {
      var c = document.getElementById('count'); if (c) c.textContent = 'load error';
    });

  // Search: parcel IDs/labels locally, plus Swindon place navigation via Nominatim.
  var box = document.getElementById('search');
  var out = document.getElementById('results');
  var searchTimer = null;
  function clearOut() { if (out) out.innerHTML = ''; }
  function addLine(text, onclick, cls) {
    var li = document.createElement('li'); li.textContent = text;
    if (cls) li.className = cls; if (onclick) li.onclick = onclick; out.appendChild(li);
  }
  function markFound(latlng, label) {
    if (foundMarker) { map.removeLayer(foundMarker); foundMarker = null; }
    foundMarker = L.circleMarker(latlng, { radius: 10, color: '#a8452f', weight: 3, fillColor: '#f9a825', fillOpacity: 0.9 }).addTo(map);
    foundMarker.bindPopup('<strong>Search result</strong><br>' + esc(label)).openPopup();
  }
  function parcelsNear(latlng) {
    if (!parcels || !parcels.length) return [];
    var near = [];
    parcels.forEach(function (f) {
      try { var b = L.geoJSON(f.geometry).getBounds().pad(0.15); if (b.contains(latlng)) near.push(f); } catch (e) {}
    });
    return near;
  }
  if (box) box.addEventListener('input', function () {
    clearOut();
    var q = box.value.trim(); if (q.length < 2) return;
    var ql = q.toLowerCase();
    if (parcels) {
      parcels.filter(function (f) {
        var p = f.properties || {};
        return (String(p.id||'') + ' ' + String(p._label||'') + ' ' + String(p.short_label||'') + ' ' + String(p.name||'')).toLowerCase().indexOf(ql) !== -1;
      }).slice(0, 8).forEach(function (f) {
        var lab = f.properties._label || f.properties.id;
        addLine('Parcel ' + lab, function () {
          try {
            var b = L.geoJSON(f.geometry).getBounds().pad(0.5);
            map.fitBounds(b);
            markFound(b.getCenter(), 'Parcel ' + lab);
            closePanelOnMobile();
          } catch(e){}
        }, 'parcel-hit');
      });
    }
    if (planningFeats && planningFeats.length) {
      planningFeats.filter(function (f) {
        var p = f.properties || {};
        return (String(p.uid||'') + ' ' + String(p.address||'') + ' ' + String(p.description||'') + ' ' + String(p.postcode||'')).toLowerCase().indexOf(ql) !== -1;
      }).slice(0, 4).forEach(function (f) {
        var p = f.properties || {};
        var shortDesc = String(p.address || p.description || '').slice(0, 42);
        addLine('Pending Plan: ' + p.uid + (shortDesc ? ' - ' + shortDesc : ''), function () {
          navigateToParcel('plan:' + p.uid);
          closePanelOnMobile();
        }, 'parcel-hit');
      });
    }
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=6&viewbox=-1.95,51.65,-1.60,51.50&bounded=1&q=' + encodeURIComponent(q + ', Swindon');
      fetch(url).then(function (r) { return r.json(); }).then(function (rows) {
        if (!rows || !rows.length) { addLine('No place found. Try an SN postcode or street + Swindon.', null, 'info'); return; }
        rows.forEach(function (row) {
          var ll = L.latLng(parseFloat(row.lat), parseFloat(row.lon));
          var label = row.display_name.split(',').slice(0, 3).join(',');
          addLine(label, function () {
            map.setView(ll, 15);
            markFound(ll, label);
            clearOut();
            closePanelOnMobile();
            var near = parcelsNear(ll);
            if (near.length) {
              near.forEach(function (f) {
                var lab = f.properties._label || f.properties.id;
                addLine('Parcel here: ' + lab, function () {
                  try {
                    var b = L.geoJSON(f.geometry).getBounds().pad(0.5);
                    map.fitBounds(b);
                    markFound(b.getCenter(), 'Parcel ' + lab);
                    closePanelOnMobile();
                  } catch(e){}
                }, 'parcel-hit');
              });
            } else {
              addLine('No mapped parcel at this spot. Pan around or tell us on the form.', null, 'info');
            }
          }, 'place');
        });
      }).catch(function () { addLine('Place lookup failed (network?). Pan and zoom for now.'); });
    }, 450);
  });

  // --- Community drawing + submission (indicative) ---
  var drawnLayer = null;
  function setDrawStatus(msg, cls) {
    var el = document.getElementById('draw-status'); if (!el) return;
    el.textContent = msg; el.className = 'sub' + (cls ? ' ' + cls : '');
  }
  function setResult(msg, cls) {
    var el = document.getElementById('c-result'); if (!el) return;
    el.textContent = msg; el.className = 'sub' + (cls ? ' ' + cls : '');
  }
  function asciiVal(s) { return String(s == null ? '' : s).replace(/[^\x20-\x7E\n\r\t]/g, ''); }
  function stripHouseNumberClient(s) {
    var t = asciiVal(s);
    t = t.replace(/^\s*(flat|unit|apt|apartment)?\s*\d+[a-zA-Z]?([\/\-]\d+[a-zA-Z]?)?\s*,?\s*/i, '');
    t = t.replace(/^\s*(no\.?|number)?\s*\d+[a-zA-Z]?([\/\-]\d+[a-zA-Z]?)?\s*,?\s*/i, '');
    t = t.replace(/^\s*\d+\s*-\s*\d+\s*,?\s*/i, '');
    return t.trim();
  }
  var BADGER_TERMS_RE = /\b(badger|badgers|sett|setts|brock|meles)\b/i;
  var SENSITIVE_TERMS_RE = /\b(sett|setts|den|dens|roost|roosts|nest|nests)\b/i;

  function isBadgerClient(species, text) {
    var s = String(species || '').toLowerCase().trim();
    if (s === 'badger' || s.indexOf('badger') !== -1 || s.indexOf('meles') !== -1) return true;
    return BADGER_TERMS_RE.test(String(text || ''));
  }
  function hasSensitiveClient(text) {
    return SENSITIVE_TERMS_RE.test(String(text || ''));
  }
  // Swindon Borough Council Civic Offices, Euclid Street, SN1 2JH (51.56011 N, -1.77796 W)
  var COUNCIL_HQ_POLYGON = {
    type: 'Polygon',
    coordinates: [[
      [-1.7798, 51.5593],
      [-1.7761, 51.5593],
      [-1.7761, 51.5609],
      [-1.7798, 51.5609],
      [-1.7798, 51.5593]
    ]]
  };
  function snapToCouncilHqClient(geom) {
    return COUNCIL_HQ_POLYGON;
  }
  function sanitizeBadgerTextClient(text) {
    var s = String(text || '');
    s = s.replace(/\b(badger\s*setts?)\b/gi, 'badger presence');
    s = s.replace(/\b(setts?(\s+(entrance|location|hole|found|here))?)\b/gi, '[presence noted]');
    s = stripHouseNumberClient(s);
    return s.replace(/\s+/g, ' ').trim();
  }

  // Toolbar & Prompt Elements
  var tbArea = document.getElementById('tb-draw-area');
  var tbFinish = document.getElementById('tb-draw-finish');
  var tbMarker = document.getElementById('tb-draw-marker');
  var tbClear = document.getElementById('tb-clear');
  var tbMeasure = document.getElementById('tb-measure');
  var tbAreaCalc = document.getElementById('tb-area-calc');
  var tbGpsLocate = document.getElementById('tb-gps-locate');

  var drawPrompt = document.getElementById('drawing-prompt');
  var drawPromptText = document.getElementById('drawing-prompt-text');
  var promptFinishBtn = document.getElementById('prompt-finish-btn');
  var promptCancelBtn = document.getElementById('prompt-cancel-btn');

  function setToolbarDrawingState(mode) {
    if (tbArea) tbArea.classList.toggle('active', mode === 'Polygon');
    if (tbMarker) tbMarker.classList.toggle('active', mode === 'Marker');
    if (tbFinish) tbFinish.disabled = (mode !== 'Polygon');
    if (drawPrompt) {
      if (mode === 'Polygon') {
        drawPrompt.hidden = false;
        if (drawPromptText) drawPromptText.textContent = 'Drawing area: double-tap to place point';
        if (promptFinishBtn) promptFinishBtn.hidden = false;
      } else if (mode === 'Marker') {
        drawPrompt.hidden = false;
        if (drawPromptText) drawPromptText.textContent = 'Tap map to place point/flag';
        if (promptFinishBtn) promptFinishBtn.hidden = true;
      } else {
        drawPrompt.hidden = true;
      }
    }
  }

  function clearDrawing() {
    try { if (drawnLayer) { map.removeLayer(drawnLayer); drawnLayer = null; } } catch (e) {}
    try { if (map.pm && map.pm.disableDraw) map.pm.disableDraw(); } catch (e) {}
    setDrawStatus('No drawing yet.');
    setToolbarDrawingState(null);
  }

  function captureDraw(layer) {
    if (drawnLayer) { try { map.removeLayer(drawnLayer); } catch (e) {} }
    drawnLayer = layer;
    try { layer.addTo(map); } catch (e) {}
    setDrawStatus('Drawing captured. Please fill in details below.', 'ok');
    setToolbarDrawingState(null);
    showToast('Drawing captured! Jumping to data entry...');
    // Automatically transition to the dedicated Data Entry view!
    setTimeout(function () {
      showEntryView();
    }, 450);
  }

  if (map.pm) {
    try {
      map.pm.setLang('en');
    } catch (e) {}
    map.on('pm:create', function (e) {
      try { if (map.pm.disableDraw) map.pm.disableDraw(); } catch (x) {}
      if (e && e.layer) captureDraw(e.layer);
    });
  }

  function startDrawPolygon() {
    setResult('');
    if (!map.pm) { showToast('Drawing tool not available.'); return; }
    clearDrawing();
    try {
      map.pm.enableDraw('Polygon', { snappable: false, templineStyle: { color: '#6A1B9A' }, hintlineStyle: { color: '#6A1B9A', dashArray: '5,5' }, pathOptions: { color: '#6A1B9A', fillColor: '#BA68C8', fillOpacity: 0.25 } });
      setDrawStatus('Tap/click map to draw indicative area. Double-tap to place point/finish.');
      setToolbarDrawingState('Polygon');
    } catch (e) {
      setDrawStatus('Could not start drawing.', 'err');
      setToolbarDrawingState(null);
    }
  }

  function startDrawMarker() {
    setResult('');
    if (!map.pm) { showToast('Drawing tool not available.'); return; }
    clearDrawing();
    try {
      map.pm.enableDraw('Marker');
      setDrawStatus('Tap map to place point/flag.');
      setToolbarDrawingState('Marker');
    } catch (e) {
      setDrawStatus('Could not place marker.', 'err');
      setToolbarDrawingState(null);
    }
  }

  function finishPolygonDrawing() {
    try {
      if (map.pm && map.pm.Draw && map.pm.Draw.Polygon && map.pm.Draw.Polygon.enabled()) {
        map.pm.Draw.Polygon._finishShape();
        setToolbarDrawingState(null);
        return;
      }
    } catch (e) {}
    showToast('Add points on the map first.');
  }

  // Permanent Map Toolbar clicks
  if (tbArea) tbArea.onclick = function () { startDrawPolygon(); };
  if (tbMarker) tbMarker.onclick = function () { startDrawMarker(); };
  if (tbFinish) tbFinish.onclick = function () { finishPolygonDrawing(); };
  if (tbClear) tbClear.onclick = function () { clearDrawing(); setResult(''); showToast('Drawing cleared.'); };
  if (promptFinishBtn) promptFinishBtn.onclick = function () { finishPolygonDrawing(); };
  if (promptCancelBtn) promptCancelBtn.onclick = function () { clearDrawing(); setResult(''); };

  // Placeholders for Measure and Area
  if (tbMeasure) tbMeasure.onclick = function () {
    showToast('Distance measure tool (preview placeholder) - coming in next release.');
  };
  if (tbAreaCalc) tbAreaCalc.onclick = function () {
    showToast('Area calculation tool (preview placeholder) - coming in next release.');
  };

  // Real-time GPS location tracking
  var gpsWatchId = null;
  var gpsMarker = null;
  var gpsAccuracyCircle = null;
  var gpsFirstFix = false;

  function stopGpsTracking() {
    if (gpsWatchId !== null && navigator.geolocation) {
      try { navigator.geolocation.clearWatch(gpsWatchId); } catch (e) {}
      gpsWatchId = null;
    }
    if (gpsMarker) {
      try { map.removeLayer(gpsMarker); } catch (e) {}
      gpsMarker = null;
    }
    if (gpsAccuracyCircle) {
      try { map.removeLayer(gpsAccuracyCircle); } catch (e) {}
      gpsAccuracyCircle = null;
    }
    if (tbGpsLocate) {
      tbGpsLocate.classList.remove('active');
    }
    gpsFirstFix = false;
  }

  function startGpsTracking() {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your device or browser.');
      return;
    }
    stopGpsTracking();
    if (tbGpsLocate) tbGpsLocate.classList.add('active');
    showToast('Acquiring GPS fix...');

    var pulseIcon = L.divIcon({
      className: 'gps-pulse-marker',
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    gpsWatchId = navigator.geolocation.watchPosition(
      function (pos) {
        if (!pos || !pos.coords) return;
        var lat = pos.coords.latitude;
        var lng = pos.coords.longitude;
        var acc = pos.coords.accuracy || 0;
        var latlng = [lat, lng];

        if (!gpsMarker) {
          gpsMarker = L.marker(latlng, { icon: pulseIcon, zIndexOffset: 1000 }).addTo(map);
          gpsAccuracyCircle = L.circle(latlng, {
            radius: acc,
            color: '#2563eb',
            fillColor: '#3b82f6',
            fillOpacity: 0.15,
            weight: 1.5,
            interactive: false
          }).addTo(map);
          gpsMarker.bindPopup('You are here<br><span style="font-size:11px;color:#64748b;">Accuracy: ~' + Math.round(acc) + 'm</span>');
        } else {
          gpsMarker.setLatLng(latlng);
          gpsAccuracyCircle.setLatLng(latlng);
          gpsAccuracyCircle.setRadius(acc);
          gpsMarker.setPopupContent('You are here<br><span style="font-size:11px;color:#64748b;">Accuracy: ~' + Math.round(acc) + 'm</span>');
        }

        if (!gpsFirstFix) {
          gpsFirstFix = true;
          map.setView(latlng, Math.max(map.getZoom(), 16), { animate: true });
          showToast('GPS position locked (accuracy ~' + Math.round(acc) + 'm)');
        }
      },
      function (err) {
        var msg = 'Could not acquire GPS position.';
        if (err && err.code === 1) msg = 'Location access permission denied.';
        else if (err && err.code === 2) msg = 'GPS signal unavailable.';
        else if (err && err.code === 3) msg = 'GPS timeout.';
        showToast(msg);
        stopGpsTracking();
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 5000
      }
    );
  }

  if (tbGpsLocate) {
    tbGpsLocate.onclick = function () {
      if (gpsWatchId !== null) {
        stopGpsTracking();
        showToast('GPS tracking disabled.');
      } else {
        startGpsTracking();
      }
    };
  }

  // Offline Submission Queue
  var OFFLINE_QUEUE_KEY = 'gc_offline_queue_v1';
  function getOfflineQueue() {
    try {
      var raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }
  function saveOfflineQueue(items) {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items));
    } catch (e) {}
  }
  function enqueueOfflineSubmission(item) {
    var q = getOfflineQueue();
    q.push(item);
    saveOfflineQueue(q);
  }
  var isFlushingQueue = false;
  function flushOfflineQueue() {
    if (isFlushingQueue || !navigator.onLine) return;
    var q = getOfflineQueue();
    if (!q || q.length === 0) return;
    var endpoint = String(window.COMMUNITY_SUBMIT_URL || '').trim();
    if (!endpoint) return;

    isFlushingQueue = true;
    var currentItem = q[0];
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentItem.payload)
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (res.ok && res.data && res.data.ok) {
          q.shift();
          saveOfflineQueue(q);
          showToast('Uploaded 1 offline survey return to server.');
        }
      })
      .catch(function () {
        // Will retry on next online event
      })
      .then(function () {
        isFlushingQueue = false;
        var remaining = getOfflineQueue();
        if (remaining.length > 0 && navigator.onLine) {
          setTimeout(flushOfflineQueue, 1500);
        }
      });
  }

  window.addEventListener('online', function () {
    showToast('Device back online! Syncing cached survey returns...');
    flushOfflineQueue();
  });
  setTimeout(flushOfflineQueue, 3500);

  // Species selector & badger protection notice toggling
  var speciesSelect = document.getElementById('c-species');
  var speciesNotice = document.getElementById('species-badger-notice');
  var notesInput = document.getElementById('c-notes');
  function checkBadgerNotice() {
    if (!speciesNotice) return;
    var sp = speciesSelect ? speciesSelect.value : '';
    var nt = notesInput ? notesInput.value : '';
    if (isBadgerClient(sp, nt)) {
      speciesNotice.style.display = 'block';
    } else {
      speciesNotice.style.display = 'none';
    }
  }
  if (speciesSelect) speciesSelect.addEventListener('change', checkBadgerNotice);
  if (notesInput) notesInput.addEventListener('input', checkBadgerNotice);

  // Photo Attachment & Client-Side EXIF Scrubbing
  var photoInput = document.getElementById('c-photo');
  var photoPreviewWrap = document.getElementById('photo-preview-wrap');
  var photoPreviewImg = document.getElementById('photo-preview-img');
  var photoRemoveBtn = document.getElementById('photo-remove-btn');
  var currentScrubbedPhotoData = null;

  function clearPhotoAttachment() {
    currentScrubbedPhotoData = null;
    if (photoInput) photoInput.value = '';
    if (photoPreviewImg) photoPreviewImg.src = '';
    if (photoPreviewWrap) photoPreviewWrap.style.display = 'none';
  }

  if (photoRemoveBtn) {
    photoRemoveBtn.onclick = function () {
      clearPhotoAttachment();
      showToast('Attached photo removed.');
    };
  }

  if (photoInput) {
    photoInput.onchange = function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;

      if (!file.type || !file.type.startsWith('image/')) {
        showToast('Please select a valid image file (JPEG, PNG).');
        clearPhotoAttachment();
        return;
      }

      showToast('Processing photo & stripping EXIF metadata...');
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          // Offscreen Canvas resizing & EXIF scrubbing
          var maxDim = 1280;
          var w = img.width;
          var h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);

          // toDataURL creates a fresh JPEG stream without EXIF/GPS tags
          currentScrubbedPhotoData = canvas.toDataURL('image/jpeg', 0.82);

          if (photoPreviewImg) photoPreviewImg.src = currentScrubbedPhotoData;
          if (photoPreviewWrap) photoPreviewWrap.style.display = 'block';
          showToast('Photo ready (EXIF location metadata scrubbed).');
        };
        img.onerror = function () {
          showToast('Could not load image. Please try another file.');
          clearPhotoAttachment();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    };
  }

  // Form submission (Send return)
  var form = document.getElementById('community-form');
  if (form) form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    setResult('');
    if (!drawnLayer) { setResult('Please draw an area or add a marker on the map first.', 'err'); return; }
    var streetRaw = asciiVal(document.getElementById('c-street').value);
    var street = stripHouseNumberClient(streetRaw);
    var place = asciiVal(document.getElementById('c-place').value).trim();
    if (!street && !place) { setResult('Please add a location name or street name (no house numbers).', 'err'); return; }
    var notesVal = asciiVal(document.getElementById('c-notes').value).trim();
    var contactVal = asciiVal(document.getElementById('c-contact').value).trim();
    var speciesRaw = speciesSelect ? asciiVal(speciesSelect.value) : '';
    var speciesVal = speciesRaw || 'unclassified';
    var isBadger = isBadgerClient(speciesVal, [place, street, notesVal].join(' '));

    var geom = null;
    try { geom = drawnLayer.toGeoJSON().geometry; } catch (e) { geom = null; }
    if (!geom) { setResult('Could not read the drawing. Please try again.', 'err'); return; }

    var attrs = {
      place: place,
      street: street,
      broad_type: asciiVal(document.getElementById('c-type').value),
      species: speciesVal,
      notes: notesVal,
      contact: contactVal
    };

    if (currentScrubbedPhotoData) {
      attrs.photo_data = currentScrubbedPhotoData;
      attrs.has_photo = true;
      if (isBadger) {
        attrs.photo_restricted = true;
      }
    }

    if (isBadger) {
      geom = snapToCouncilHqClient(geom);
      attrs.species = 'badger';
      attrs.sensitive_species = true;
      attrs.generalised = true;
      attrs.generalisation_mode = 'council_hq_swindon';
      attrs.generalisation_location = 'Swindon Borough Council Civic Offices, Euclid Street, SN1 2JH';
      attrs.privacy_protection = 'Protection of Badgers Act 1992';
      attrs.place = 'Swindon Borough Council Civic Offices';
      attrs.street = 'Euclid Street, Swindon SN1 2JH';
      attrs.notes = sanitizeBadgerTextClient(notesVal);
    } else if (speciesVal === 'unclassified') {
      attrs.hold_reason = 'unclassified_species_default_held';
      attrs.status = 'pending_review';
    }

    var endpoint = String(window.COMMUNITY_SUBMIT_URL || '').trim();
    if (!endpoint) {
      setResult('Submissions endpoint is not configured.', 'err');
      return;
    }
    var payload = { geometry: geom, attributes: attrs, website: asciiVal(document.getElementById('c-website').value) };
    var btn = document.getElementById('c-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

    // If currently offline, queue locally and notify immediately
    if (!navigator.onLine) {
      enqueueOfflineSubmission({ payload: payload, queued_at: new Date().toISOString() });
      var pendingOffline = loadLocalPending();
      pendingOffline.push({ geometry: geom, properties: attrs, submitted_at: new Date().toISOString(), offline_saved: true });
      saveLocalPending(pendingOffline);
      renderMyPending();
      buildLayersMenu();
      try { if (!map.hasLayer(myPendingLayer)) myPendingLayer.addTo(map); } catch (e) {}
      setResult('Offline: saved locally on device. Will auto-upload when back online.', 'ok');
      form.reset();
      clearPhotoAttachment();
      checkBadgerNotice();
      clearDrawing();
      if (isBadger) {
        showToast('Saved on phone! Badger location protected; will auto-upload when online.');
      } else {
        showToast('Saved on phone! Will auto-upload when connected.');
      }
      setTimeout(function () {
        layout.classList.add('panel-hidden');
        updateToggleText();
        setTimeout(function () { map.invalidateSize(); }, 50);
      }, 1200);
      if (btn) { btn.disabled = false; btn.textContent = 'Send return'; }
      return;
    }

    setResult('Sending return...');
    fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().catch(function(){ return {}; }).then(function(d){ return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        var msg = (res.data && (res.data.message || res.data.error)) || '';
        if (res.ok && res.data && res.data.ok) {
          var pending = loadLocalPending();
          pending.push({ geometry: geom, properties: attrs, submitted_at: new Date().toISOString() });
          saveLocalPending(pending);
          renderMyPending();
          buildLayersMenu();
          try { if (!map.hasLayer(myPendingLayer)) myPendingLayer.addTo(map); } catch (e) {}
          setResult('Thank you. Your return was queued for review.', 'ok');
          form.reset();
          clearPhotoAttachment();
          checkBadgerNotice();
          clearDrawing();
          if (isBadger) {
            showToast('Return submitted! Badger presence snapped to Swindon Borough Council HQ per 1992 Act.');
          } else {
            showToast('Return submitted! Queued for review.');
          }
          setTimeout(function () {
            layout.classList.add('panel-hidden');
            updateToggleText();
            setTimeout(function () { map.invalidateSize(); }, 50);
          }, 1200);
        } else {
          setResult(msg || 'Could not send right now.', 'err');
        }
      })
      .catch(function () {
        enqueueOfflineSubmission({ payload: payload, queued_at: new Date().toISOString() });
        var pendingOfflineCatch = loadLocalPending();
        pendingOfflineCatch.push({ geometry: geom, properties: attrs, submitted_at: new Date().toISOString(), offline_saved: true });
        saveLocalPending(pendingOfflineCatch);
        renderMyPending();
        buildLayersMenu();
        try { if (!map.hasLayer(myPendingLayer)) myPendingLayer.addTo(map); } catch (e) {}
        setResult('Saved locally on device (network unreachable). Will auto-upload when reconnected.', 'ok');
        form.reset();
        clearPhotoAttachment();
        checkBadgerNotice();
        clearDrawing();
        showToast('Network error: saved locally. Will auto-upload when connection returns.');
        setTimeout(function () {
          layout.classList.add('panel-hidden');
          updateToggleText();
          setTimeout(function () { map.invalidateSize(); }, 50);
        }, 1200);
      })
      .then(function () { if (btn) { btn.disabled = false; btn.textContent = 'Send return'; } });
  });

  // Service Worker Registration for PWA / offline support
  if ('serviceWorker' in navigator && window.location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').then(function () {
        // SW registered
      }).catch(function () {
        // SW registration failed
      });
    });
  }
})();
