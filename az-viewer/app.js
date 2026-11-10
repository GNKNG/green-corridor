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
  document.addEventListener('click', function (ev) {
    if (layersMenu && !layersMenu.hidden && !layersMenu.contains(ev.target) && ev.target !== layersBtn && !layersBtn.contains(ev.target)) {
      layersMenu.hidden = true;
      if (layersBtn) layersBtn.classList.remove('active');
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
      if (p.feature_class === 'proposed_new_areas') { n += 1; if (p.id != null) seq[String(p.id)] = n; }
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
    if (fc === 'proposed_new_areas') {
      for (i=0;i<official.length;i++){ v=nonempty(p[official[i]]); if(v) return v; }
      var pn = proposedSeq && proposedSeq[String(p.id)];
      if (pn != null) return 'p' + pn;
      for (i=0;i<generic.length;i++){ v=nonempty(p[generic[i]]); if(v) return v; }
    }
    if (fc === 'en1_green_corridor') {
      v = nonempty(p.map_label) || nonempty(p.short_ref); if (v) return v;
      v = en1Short(p); if (v) return v;
    }
    if (fc === 'amenity_water') {
      for (i=0;i<generic.length;i++){ v=nonempty(p[generic[i]]); if(v && String(v).indexOf('osm-waterway')!==0) return v; }
      return 'Water';
    }
    if (fc === 'scheduled_monument' || fc === 'registered_park_garden' || fc === 'listed_building' || fc === 'conservation_area' || fc === 'unscheduled_archaeology' || fc === 'country_park_core' || fc === 'recreation_ground') {
      return nonempty(p.name) || nonempty(p.short_label) || nonempty(p.ref) || String(p.id || '');
    }
    for (i=0;i<official.length;i++){ v=nonempty(p[official[i]]); if(v) return v; }
    for (i=0;i<generic.length;i++){ v=nonempty(p[generic[i]]); if(v) return v; }
    return String(p.id || '');
  }

  var CLASS_META = {
    en1_green_corridor: { label: 'Adopted EN1 green corridor (policy context)', color: '#1B7F3A', fill: '#27AE60', weight: 3, dash: '8 5', fillOpacity: 0, hatch: 'hatch-en1', defaultVisible: true, swatch: 'layer-swatch-en1' },
    proposed_new_areas: { label: 'Proposed new area (DRAFT / indicative)', color: '#C77700', fill: '#F9A825', weight: 3, dash: null, fillOpacity: 0, hatch: 'hatch-proposed', defaultVisible: true, swatch: 'layer-swatch-proposed' },
    amenity_water:      { label: 'Amenity water (indicative)', color: '#1565C0', fill: '#42A5F5', weight: 2, dash: null, fillOpacity: 0.28, hatch: null, defaultVisible: true, swatch: 'layer-swatch-water' },
    country_park_core:  { label: 'Country Park & Nature Reserve', color: '#1B5E20', fill: '#4CAF50', weight: 2.2, dash: null, fillOpacity: 0.25, hatch: null, defaultVisible: false, swatch: 'layer-swatch-countrypark' },
    recreation_ground:  { label: 'Recreation Ground & Public Open Space', color: '#2E7D32', fill: '#81C784', weight: 2, dash: null, fillOpacity: 0.22, hatch: null, defaultVisible: false, swatch: 'layer-swatch-recreation' },
    scheduled_monument: { label: 'Scheduled Monument (archaeological designation)', color: '#6A1B9A', fill: '#BA68C8', weight: 2.5, dash: '6 4', fillOpacity: 0.15, hatch: 'hatch-heritage', defaultVisible: false, swatch: 'layer-swatch-monument' },
    unscheduled_archaeology: { label: 'Unscheduled Archaeology (Local Plan)', color: '#B7410E', fill: '#E07A5F', weight: 2, dash: '4 4', fillOpacity: 0.22, hatch: null, defaultVisible: false, swatch: 'layer-swatch-archaeology' },
    conservation_area:  { label: 'Conservation Area (statutory heritage)', color: '#8D6E63', fill: '#D7CCC8', weight: 2, dash: '5 4', fillOpacity: 0.22, hatch: null, defaultVisible: false, swatch: 'layer-swatch-conservation' },
    listed_building:    { label: 'Listed Building (Grade I & II*)', color: '#B45309', fill: '#F59E0B', weight: 2, dash: null, fillOpacity: 0.9, hatch: null, defaultVisible: false, swatch: 'layer-swatch-listed' },
    registered_park_garden: { label: 'Registered Park & Garden (heritage designation)', color: '#2E7D32', fill: '#81C784', weight: 2, dash: '4 4', fillOpacity: 0.22, hatch: null, defaultVisible: false, swatch: 'layer-swatch-park' },
    community_suggestion: { label: 'Community suggestion (indicative, reviewed)', color: '#6A1B9A', fill: '#BA68C8', weight: 2, dash: '4 4', fillOpacity: 0.18, hatch: null, defaultVisible: false, swatch: 'layer-swatch-community' },
    my_pending: { label: 'My pending suggestion (local, awaiting review)', color: '#455A64', fill: '#90A4AE', weight: 2, dash: '6 4', fillOpacity: 0.2, hatch: null, defaultVisible: true, swatch: 'layer-swatch-pending' }
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
        var el = l.getElement && l.getElement();
        if (el) el.setAttribute('fill', 'url(#' + meta.hatch + ')');
      });
    } catch (e) {}
  }

  var parcels = [];
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
    if (p.place) rows.push('Location: ' + esc(p.place));
    if (p.street_area || p.street) rows.push('Street: ' + esc(p.street_area || p.street));
    if (p.broad_type) rows.push('Type: ' + esc(p.broad_type));
    if (p.notes || p.notes_note) rows.push('Comments: ' + esc(p.notes || p.notes_note));
    if (p.contact) rows.push('Contact: ' + esc(p.contact));
    return '<strong>' + esc(lab) + '</strong> <span style="color:#666">(community)</span><br>' +
      'Type: ' + esc(CLASS_META.community_suggestion.label) + '<br>' +
      (rows.length ? rows.join('<br>') + '<br>' : '') +
      '<em>Community indicative sketch - not a legal boundary or designation claim.</em>';
  }
  function myPendingPopupHtml(p, lab) {
    var rows = [];
    if (p.place) rows.push('Location: ' + esc(p.place));
    if (p.street_area || p.street) rows.push('Street: ' + esc(p.street_area || p.street));
    if (p.broad_type) rows.push('Type: ' + esc(p.broad_type));
    if (p.notes || p.notes_note) rows.push('Comments: ' + esc(p.notes || p.notes_note));
    if (p.contact) rows.push('Contact: ' + esc(p.contact));
    return '<strong>' + esc(lab) + '</strong> <span style="color:#666">(pending)</span><br>' +
      'Type: ' + esc(CLASS_META.my_pending.label) + '<br>' +
      (rows.length ? rows.join('<br>') + '<br>' : '') +
      '<em>Queued for review - only visible on this device until approved. Indicative only.</em>';
  }

  function popupHtml(p, lab) {
    if (p.feature_class === 'my_pending') return myPendingPopupHtml(p, lab);
    if (p.feature_class === 'community_suggestion') return communityPopupHtml(p, lab);
    var meta = CLASS_META[p.feature_class] || { label: p.feature_class || '' };

    if (p.feature_class === 'scheduled_monument' || p.feature_class === 'registered_park_garden') {
      return '<strong>' + esc(lab) + '</strong>' +
        (p.ref ? ' <span style="color:#666">(NHLE ' + esc(p.ref) + ')</span>' : '') + '<br>' +
        'Type: ' + esc(meta.label) + '<br>' +
        'Status: ' + esc(p.status || 'Statutory designation') + '<br>' +
        (p.hyperlink ? 'Register: <a href="' + esc(p.hyperlink) + '" target="_blank" rel="noopener">Historic England National Heritage List</a><br>' : '') +
        '<em>Statutory designation, Historic England NHLE (OGL v3.0).</em>';
    }
    if (p.feature_class === 'listed_building') {
      return '<strong>' + esc(lab) + '</strong>' +
        (p.ref ? ' <span style="color:#666">(NHLE ' + esc(p.ref) + ')</span>' : '') + '<br>' +
        'Grade: <strong>' + esc(p.grade || 'I / II*') + '</strong><br>' +
        'Status: ' + esc(p.status || 'Statutory designation') + '<br>' +
        (p.hyperlink ? '<a href="' + esc(p.hyperlink) + '" target="_blank" rel="noopener">Historic England List Entry</a><br>' : '') +
        '<em>Statutory Listed Building, Historic England NHLE (OGL v3.0).</em>';
    }
    if (p.feature_class === 'conservation_area') {
      return '<strong>' + esc(lab) + '</strong>' +
        (p.ref ? ' <span style="color:#666">(UID ' + esc(p.ref) + ')</span>' : '') + '<br>' +
        'Type: ' + esc(meta.label) + '<br>' +
        (p.date_designated ? 'Designated: ' + esc(p.date_designated) + '<br>' : '') +
        'Status: ' + esc(p.status || 'Statutory designation') + '<br>' +
        '<em>Designated under Planning (Listed Buildings and Conservation Areas) Act 1990.</em>';
    }
    if (p.feature_class === 'unscheduled_archaeology') {
      return '<strong>' + esc(lab) + '</strong>' +
        ' <span style="color:#666">(' + esc(p.id) + ')</span><br>' +
        'Type: ' + esc(meta.label) + '<br>' +
        'Policy: ' + esc(p.official_designation || 'Swindon Local Plan') + '<br>' +
        'Source: ' + esc(p.source || 'SBC Planning Portal WFS') + '<br>' +
        '<em>Local Plan archaeological notification area (indicative context).</em>';
    }
    if (p.feature_class === 'country_park_core' || p.feature_class === 'recreation_ground') {
      return '<strong>' + esc(lab) + '</strong>' +
        ' <span style="color:#666">(' + esc(p.id) + ')</span><br>' +
        'Type: ' + esc(meta.label) + '<br>' +
        'Status: ' + esc(p.status || 'Adopted / Protected Open Space') + '<br>' +
        '<em>Public open space / recreation asset (adopted planning baseline).</em>';
    }

    return '<strong>' + esc(lab) + '</strong>' +
      ' <span style="color:#666">(' + esc(p.id) + ')</span><br>' +
      'Type: ' + esc(meta.label) + '<br>' +
      'Status: ' + esc(p.status) + '<br>' +
      'Date: ' + esc(p.date || '') + '<br>' +
      '<em>DRAFT / NOTHING FILED. Indicative only, not a legal boundary.</em>';
  }

  function buildLayersMenu() {
    if (!layersList) return;
    layersList.innerHTML = '';
    var layerSpecs = [
      { layer: groups.en1_green_corridor, cls: 'layer-swatch-en1', name: 'Adopted EN1 corridors (' + (groups.en1_green_corridor ? groups.en1_green_corridor.getLayers().length : 0) + ')' },
      { layer: groups.proposed_new_areas, cls: 'layer-swatch-proposed', name: 'Proposed new areas (' + (groups.proposed_new_areas ? groups.proposed_new_areas.getLayers().length : 0) + ')' },
      { layer: groups.amenity_water, cls: 'layer-swatch-water', name: 'Amenity water (' + (groups.amenity_water ? groups.amenity_water.getLayers().length : 0) + ')' },
      { layer: groups.country_park_core, cls: 'layer-swatch-countrypark', name: 'Country Parks (' + (groups.country_park_core ? groups.country_park_core.getLayers().length : 0) + ')' },
      { layer: groups.recreation_ground, cls: 'layer-swatch-recreation', name: 'Recreation Grounds (' + (groups.recreation_ground ? groups.recreation_ground.getLayers().length : 0) + ')' },
      { layer: groups.scheduled_monument, cls: 'layer-swatch-monument', name: 'Scheduled Monuments (' + (groups.scheduled_monument ? groups.scheduled_monument.getLayers().length : 0) + ')' },
      { layer: groups.unscheduled_archaeology, cls: 'layer-swatch-archaeology', name: 'Unscheduled Archaeology (' + (groups.unscheduled_archaeology ? groups.unscheduled_archaeology.getLayers().length : 0) + ')' },
      { layer: groups.conservation_area, cls: 'layer-swatch-conservation', name: 'Conservation Areas (' + (groups.conservation_area ? groups.conservation_area.getLayers().length : 0) + ')' },
      { layer: groups.listed_building, cls: 'layer-swatch-listed', name: 'Listed Buildings Grade I & II* (' + (groups.listed_building ? groups.listed_building.getLayers().length : 0) + ')' },
      { layer: groups.registered_park_garden, cls: 'layer-swatch-park', name: 'Registered Parks & Gardens (' + (groups.registered_park_garden ? groups.registered_park_garden.getLayers().length : 0) + ')' },
      { layer: overlays['Community suggestions - indicative (approved)'], cls: 'layer-swatch-community', name: 'Community suggestions' },
      { layer: myPendingLayer, cls: 'layer-swatch-pending', name: 'My pending suggestions' }
    ];

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
  }

  function loadParcels() {
    return fetch('data/parcels-public.geojson?v=26').then(function (r) { return r.json(); }).then(function (fc) {
      parcels = fc.features || [];
      var proposedSeq = buildProposedSeq(parcels);
      parcels.forEach(function (f) { f.properties = f.properties || {}; f.properties._label = displayLabel(f.properties, proposedSeq, null); });
      var countEl = document.getElementById('count');
      if (countEl) countEl.textContent = parcels.length;

      var order = [
        'en1_green_corridor',
        'proposed_new_areas',
        'amenity_water',
        'country_park_core',
        'recreation_ground',
        'scheduled_monument',
        'unscheduled_archaeology',
        'conservation_area',
        'registered_park_garden',
        'listed_building'
      ];
      order.forEach(function (cls) {
        var meta = CLASS_META[cls] || { color:'#607D8B', weight:2, fillOpacity:0.15 };
        var clsFeats = parcels.filter(function(f){ return (f.properties.feature_class||'')===cls; });
        var g = L.geoJSON({type:'FeatureCollection', features: clsFeats}, {
          style: function () {
            var s = { color: meta.color, weight: meta.weight, fillColor: meta.fill || meta.color, fillOpacity: meta.hatch ? 0.001 : (meta.fillOpacity != null ? meta.fillOpacity : 0.1), opacity: 0.95 };
            if (meta.dash) s.dashArray = meta.dash;
            return s;
          },
          pointToLayer: function (f, latlng) {
            var r = (cls === 'listed_building') ? 6 : 5;
            return L.circleMarker(latlng, { radius: r, color: meta.color, fillColor: meta.fill || meta.color, fillOpacity: 0.85, weight: 2 });
          },
          onEachFeature: function (f, l) {
            var lab = f.properties._label || f.properties.id;
            l.bindPopup(popupHtml(f.properties, lab));
            l.on('click', function (ev) { try { L.DomEvent.stopPropagation(ev); } catch(e){} showSelectedLabel(l, lab, cls); });
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
      overlays['Proposed new areas - draft (' + (groups.proposed_new_areas ? groups.proposed_new_areas.getLayers().length : 0) + ')'] = groups.proposed_new_areas;
      overlays['Amenity water (' + (groups.amenity_water ? groups.amenity_water.getLayers().length : 0) + ')'] = groups.amenity_water;
      overlays['Country Parks (' + (groups.country_park_core ? groups.country_park_core.getLayers().length : 0) + ')'] = groups.country_park_core;
      overlays['Recreation Grounds (' + (groups.recreation_ground ? groups.recreation_ground.getLayers().length : 0) + ')'] = groups.recreation_ground;
      overlays['Scheduled Monuments (' + (groups.scheduled_monument ? groups.scheduled_monument.getLayers().length : 0) + ')'] = groups.scheduled_monument;
      overlays['Unscheduled Archaeology (' + (groups.unscheduled_archaeology ? groups.unscheduled_archaeology.getLayers().length : 0) + ')'] = groups.unscheduled_archaeology;
      overlays['Conservation Areas (' + (groups.conservation_area ? groups.conservation_area.getLayers().length : 0) + ')'] = groups.conservation_area;
      overlays['Listed Buildings (' + (groups.listed_building ? groups.listed_building.getLayers().length : 0) + ')'] = groups.listed_building;
      overlays['Registered Parks & Gardens (' + (groups.registered_park_garden ? groups.registered_park_garden.getLayers().length : 0) + ')'] = groups.registered_park_garden;

      try {
        var baseGroups = ['en1_green_corridor','proposed_new_areas','amenity_water'].map(function(c){return groups[c];}).filter(Boolean);
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

  loadParcels().then(function () { return loadCommunity(); }).catch(function () { return loadCommunity(); }).then(function () {
    renderMyPending();
    overlays['My pending (local, awaiting review)'] = myPendingLayer;
    myPendingLayer.addTo(map);
    buildLayersMenu();
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
    t = t.replace(/^\s*\d+\s*-\s*\d+\s*,?\s*/i, '');
    return t.trim();
  }
  function hasSensitiveClient(text) {
    return /\b(sett|den|nest|roost|badger sett|fox den|bird nest)\b/i.test(String(text || ''));
  }

  // Toolbar & Prompt Elements
  var tbArea = document.getElementById('tb-draw-area');
  var tbFinish = document.getElementById('tb-draw-finish');
  var tbMarker = document.getElementById('tb-draw-marker');
  var tbClear = document.getElementById('tb-clear');
  var tbMeasure = document.getElementById('tb-measure');
  var tbAreaCalc = document.getElementById('tb-area-calc');

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
    var attrs = {
      place: place,
      street: street,
      broad_type: asciiVal(document.getElementById('c-type').value),
      notes: notesVal,
      contact: contactVal
    };
    if (hasSensitiveClient([place, street, notesVal, contactVal].join(' '))) {
      setResult('Please do not include precise wildlife locations (sett, den, nest, roost). Keep it general.', 'err');
      return;
    }
    var geom = null;
    try { geom = drawnLayer.toGeoJSON().geometry; } catch (e) { geom = null; }
    if (!geom) { setResult('Could not read the drawing. Please try again.', 'err'); return; }

    var endpoint = String(window.COMMUNITY_SUBMIT_URL || '').trim();
    if (!endpoint) {
      setResult('Submissions endpoint is not configured.', 'err');
      return;
    }
    var payload = { geometry: geom, attributes: attrs, website: asciiVal(document.getElementById('c-website').value) };
    var btn = document.getElementById('c-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
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
          clearDrawing();
          showToast('Return submitted! Queued for review.');
          setTimeout(function () {
            layout.classList.add('panel-hidden');
            updateToggleText();
            setTimeout(function () { map.invalidateSize(); }, 50);
          }, 1200);
        } else {
          setResult(msg || 'Could not send right now.', 'err');
        }
      })
      .catch(function () { setResult('Network error. Please try again.', 'err'); })
      .then(function () { if (btn) { btn.disabled = false; btn.textContent = 'Send return'; } });
  });
})();
