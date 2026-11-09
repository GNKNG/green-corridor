/* Read-only A-Z viewer + community suggestions (indicative). No backend in page, no login. */
(function () {
  var layout = document.getElementById('layout');
  var toggle = document.getElementById('panel-toggle');
  if (window.innerWidth < 700) { layout.classList.add('panel-hidden'); if (toggle) toggle.textContent = 'Show panel'; }
  if (toggle) toggle.onclick = function () {
    layout.classList.toggle('panel-hidden');
    var hidden = layout.classList.contains('panel-hidden');
    toggle.textContent = hidden ? 'Show panel' : 'Hide panel';
    toggle.setAttribute('aria-label', hidden ? 'Show panel' : 'Hide panel');
    setTimeout(function () { map.invalidateSize(); }, 50);
  };

  var map = L.map('map').setView([51.568, -1.78], 11);
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
    for (i=0;i<official.length;i++){ v=nonempty(p[official[i]]); if(v) return v; }
    for (i=0;i<generic.length;i++){ v=nonempty(p[generic[i]]); if(v) return v; }
    return String(p.id || '');
  }

  var CLASS_META = {
    en1_green_corridor: { label: 'Adopted EN1 green corridor (policy context)', color: '#1B7F3A', fill: '#27AE60', weight: 3, dash: '8 5', fillOpacity: 0, hatch: 'hatch-en1' },
    proposed_new_areas: { label: 'Proposed new area (DRAFT / indicative)', color: '#C77700', fill: '#F9A825', weight: 3, dash: null, fillOpacity: 0, hatch: 'hatch-proposed' },
    amenity_water:      { label: 'Amenity water (indicative)', color: '#1565C0', fill: '#42A5F5', weight: 2, dash: null, fillOpacity: 0.28, hatch: null },
    community_suggestion: { label: 'Community suggestion (indicative, reviewed)', color: '#6A1B9A', fill: '#BA68C8', weight: 2, dash: '4 4', fillOpacity: 0.18, hatch: null },
    my_pending: { label: 'My pending suggestion (local, awaiting review)', color: '#455A64', fill: '#90A4AE', weight: 2, dash: '6 4', fillOpacity: 0.2, hatch: null }
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
  var layersControl = null;
  var myPendingLayer = L.layerGroup();
  var selectedLabelLayer = null;
  function clearSelectedLabel() {
    try { if (selectedLabelLayer && selectedLabelLayer.closeTooltip) selectedLabelLayer.closeTooltip(); } catch (e) {}
    try { if (selectedLabelLayer && selectedLabelLayer.unbindTooltip) { /* keep popup */ } } catch (e) {}
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
    if (p.place) rows.push('Place: ' + esc(p.place));
    if (p.street_area) rows.push('Area: ' + esc(p.street_area));
    if (p.broad_type) rows.push('Type: ' + esc(p.broad_type));
    if (p.wildlife_tick) rows.push('Wildlife noted (general)');
    if (p.use_note) rows.push('Use: ' + esc(p.use_note));
    if (p.meaning_note) rows.push('Meaning: ' + esc(p.meaning_note));
    if (p.joins_barrier) rows.push('Joins/barrier: ' + esc(p.joins_barrier));
    if (p.notes || p.notes_note) rows.push('Notes: ' + esc(p.notes || p.notes_note));
    return '<strong>' + esc(lab) + '</strong> <span style="color:#666">(community)</span><br>' +
      'Type: ' + esc(CLASS_META.community_suggestion.label) + '<br>' +
      (rows.length ? rows.join('<br>') + '<br>' : '') +
      '<em>Community indicative sketch - not a boundary, designation, survey, approval, or ownership claim.</em>';
  }
  function myPendingPopupHtml(p, lab) {
    var rows = [];
    if (p.place) rows.push('Place: ' + esc(p.place));
    if (p.street_area || p.street) rows.push('Area: ' + esc(p.street_area || p.street));
    if (p.broad_type) rows.push('Type: ' + esc(p.broad_type));
    if (p.wildlife_tick) rows.push('Wildlife noted (general)');
    if (p.use_note || p.use) rows.push('Use: ' + esc(p.use_note || p.use));
    if (p.meaning_note || p.meaning) rows.push('Meaning: ' + esc(p.meaning_note || p.meaning));
    if (p.joins_barrier) rows.push('Joins/barrier: ' + esc(p.joins_barrier));
    if (p.notes || p.notes_note) rows.push('Notes: ' + esc(p.notes || p.notes_note));
    return '<strong>' + esc(lab) + '</strong> <span style="color:#666">(pending)</span><br>' +
      'Type: ' + esc(CLASS_META.my_pending.label) + '<br>' +
      (rows.length ? rows.join('<br>') + '<br>' : '') +
      '<em>Queued for review - only visible on this device until approved. Indicative only, not a boundary/designation/ownership claim.</em>';
  }

  function popupHtml(p, lab) {
    if (p.feature_class === 'my_pending') return myPendingPopupHtml(p, lab);
    if (p.feature_class === 'community_suggestion') return communityPopupHtml(p, lab);
    var meta = CLASS_META[p.feature_class] || { label: p.feature_class || '' };
    return '<strong>' + esc(lab) + '</strong>' +
      ' <span style="color:#666">(' + esc(p.id) + ')</span><br>' +
      'Type: ' + esc(meta.label) + '<br>' +
      'Status: ' + esc(p.status) + '<br>' +
      'Date: ' + esc(p.date || '') + '<br>' +
      'Contact: <a href="https://gnkng.github.io/green-corridor/survey-swindon.html">survey form</a><br>' +
      '<em>DRAFT / NOTHING FILED. Indicative only, not a legal boundary.</em>';
  }

  function loadParcels() {
    return fetch('data/parcels-public.geojson?v=16').then(function (r) { return r.json(); }).then(function (fc) {
      parcels = fc.features || [];
      var proposedSeq = buildProposedSeq(parcels);
      parcels.forEach(function (f) { f.properties = f.properties || {}; f.properties._label = displayLabel(f.properties, proposedSeq, null); });
      document.getElementById('count').textContent = parcels.length;

      var order = ['en1_green_corridor','proposed_new_areas','amenity_water'];
      order.forEach(function (cls) {
        var meta = CLASS_META[cls] || { color:'#607D8B', weight:2, fillOpacity:0.15 };
        groups[cls] = L.geoJSON({type:'FeatureCollection', features: parcels.filter(function(f){return (f.properties.feature_class||'')===cls;})}, {
          style: function () {
            var s = { color: meta.color, weight: meta.weight, fillColor: meta.fill || meta.color, fillOpacity: meta.hatch ? 0.001 : (meta.fillOpacity != null ? meta.fillOpacity : 0.1), opacity: 0.95 };
            if (meta.dash) s.dashArray = meta.dash;
            return s;
          },
          pointToLayer: function (f, latlng) { return L.circleMarker(latlng, { radius: 5, color: meta.color, fillColor: meta.fill || meta.color, fillOpacity: 0.7, weight: 2 }); },
          onEachFeature: function (f, l) {
            var lab = f.properties._label || f.properties.id;
            l.bindPopup(popupHtml(f.properties, lab));
            l.on('click', function (ev) { try { L.DomEvent.stopPropagation(ev); } catch(e){} showSelectedLabel(l, lab, cls); });
          }
        }).addTo(map);
      });
      injectHatchDefs();
      order.forEach(function (cls) { if (CLASS_META[cls] && CLASS_META[cls].hatch) applyHatch(groups[cls], cls); });

      overlays['Adopted EN1 green corridors (' + (groups.en1_green_corridor ? groups.en1_green_corridor.getLayers().length : 0) + ')'] = groups.en1_green_corridor;
      overlays['Proposed new areas - draft (' + (groups.proposed_new_areas ? groups.proposed_new_areas.getLayers().length : 0) + ')'] = groups.proposed_new_areas;
      overlays['Amenity water (' + (groups.amenity_water ? groups.amenity_water.getLayers().length : 0) + ')'] = groups.amenity_water;

      try {
        var all = L.featureGroup(order.map(function(c){return groups[c];}).filter(Boolean));
        map.fitBounds(all.getBounds());
      } catch (e) {}

      var list = document.getElementById('parcel-list');
      if (list) {
        list.innerHTML = '';
        parcels.forEach(function (f) {
          var li = document.createElement('li');
          var lab = f.properties._label || f.properties.id;
          li.textContent = lab + ' \u2014 ' + ((CLASS_META[f.properties.feature_class]||{}).label || f.properties.feature_class || '');
          li.onclick = function () { try { var b = L.geoJSON(f.geometry).getBounds(); map.fitBounds(b.pad(0.5)); } catch(e){} };
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
      // off by default (user toggles on); listed last
      overlays['Community suggestions - indicative (approved)'] = layer;
    }).catch(function () {
      overlays['Community suggestions - indicative (approved)'] = L.layerGroup();
    });
  }

  loadParcels().then(function () { return loadCommunity(); }).catch(function () { return loadCommunity(); }).then(function () {
    renderMyPending();
    overlays['My pending (local, awaiting review)'] = myPendingLayer;
    myPendingLayer.addTo(map); // keep visible locally so it does not disappear
    layersControl = L.control.layers(null, overlays, { collapsed: window.innerWidth < 700 }).addTo(map);
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
        return (String(p.id||'') + ' ' + String(p._label||'') + ' ' + String(p.short_label||'')).toLowerCase().indexOf(ql) !== -1;
      }).slice(0, 8).forEach(function (f) {
        var lab = f.properties._label || f.properties.id;
        addLine('Parcel ' + lab, function () {
          try { var b = L.geoJSON(f.geometry).getBounds().pad(0.5); map.fitBounds(b); markFound(b.getCenter(), 'Parcel ' + lab); } catch(e){}
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
            map.setView(ll, 15); markFound(ll, label); clearOut();
            var near = parcelsNear(ll);
            if (near.length) {
              near.forEach(function (f) {
                var lab = f.properties._label || f.properties.id;
                addLine('Parcel here: ' + lab, function () { try { var b = L.geoJSON(f.geometry).getBounds().pad(0.5); map.fitBounds(b); markFound(b.getCenter(), 'Parcel ' + lab); } catch(e){} }, 'parcel-hit');
              });
            } else { addLine('No mapped parcel at this spot. Pan around or tell us on the form.', null, 'info'); }
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
  function clearDrawing() {
    try { if (drawnLayer) { map.removeLayer(drawnLayer); drawnLayer = null; } } catch (e) {}
    try { if (map.pm && map.pm.disableDraw) map.pm.disableDraw(); } catch (e) {}
    setDrawStatus('No drawing yet.');
  }
  function captureDraw(layer) {
    if (drawnLayer) { try { map.removeLayer(drawnLayer); } catch (e) {} }
    drawnLayer = layer;
    try { layer.addTo(map); } catch (e) {}
    setDrawStatus('Drawing captured (indicative). Fill the form and send for review.', 'ok');
  }
  if (map.pm) {
    try {
      map.pm.setLang('en');
      // keep global edit/removal off; we only draw a single submission shape
    } catch (e) {}
    map.on('pm:create', function (e) {
      try { if (map.pm.disableDraw) map.pm.disableDraw(); } catch (x) {}
      if (e && e.layer) captureDraw(e.layer);
    });
  }

  var btnArea = document.getElementById('draw-area');
  var btnMarker = document.getElementById('draw-marker');
  var btnClear = document.getElementById('draw-clear');
  if (btnArea) btnArea.onclick = function () {
    setResult('');
    if (!map.pm) { setDrawStatus('Drawing tool not available. Please use the contact form.', 'err'); return; }
    clearDrawing();
    try {
      map.pm.enableDraw('Polygon', { snappable: false, templineStyle: { color: '#6A1B9A' }, hintlineStyle: { color: '#6A1B9A', dashArray: '5,5' }, pathOptions: { color: '#6A1B9A', fillColor: '#BA68C8', fillOpacity: 0.25 } });
      setDrawStatus('Tap/click the map to draw an indicative area. Double-click/tap last point to finish.');
    } catch (e) { setDrawStatus('Could not start drawing. Please use the contact form.', 'err'); }
  };
  if (btnMarker) btnMarker.onclick = function () {
    setResult('');
    if (!map.pm) { setDrawStatus('Drawing tool not available. Please use the contact form.', 'err'); return; }
    clearDrawing();
    try {
      map.pm.enableDraw('Marker');
      setDrawStatus('Tap/click the map to place an indicative marker.');
    } catch (e) { setDrawStatus('Could not start marker. Please use the contact form.', 'err'); }
  };
  if (btnClear) btnClear.onclick = function () { clearDrawing(); setResult(''); };

  var form = document.getElementById('community-form');
  if (form) form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    setResult('');
    if (!drawnLayer) { setResult('Please draw an indicative area or add a marker first.', 'err'); return; }
    var streetRaw = asciiVal(document.getElementById('c-street').value);
    var street = stripHouseNumberClient(streetRaw);
    var place = asciiVal(document.getElementById('c-place').value).trim();
    if (!street && !place) { setResult('Please add a street/area or a place name (no house numbers).', 'err'); return; }
    var attrs = {
      place: place,
      street: street,
      broad_type: asciiVal(document.getElementById('c-type').value),
      wildlife_tick: !!document.getElementById('c-wildlife').checked,
      use: asciiVal(document.getElementById('c-use').value).trim(),
      meaning: asciiVal(document.getElementById('c-meaning').value).trim(),
      joins_barrier: asciiVal(document.getElementById('c-joins').value).trim(),
      notes: asciiVal(document.getElementById('c-notes').value).trim(),
      interested_in_helping: asciiVal(document.getElementById('c-help').value),
      quote_ok: asciiVal(document.getElementById('c-quote').value)
    };
    if (hasSensitiveClient([place, street, attrs.use, attrs.meaning, attrs.joins_barrier, attrs.notes].join(' '))) {
      setResult('Please do not include precise wildlife locations (sett, den, nest, roost). Keep it street-level and general.', 'err');
      return;
    }
    var geom = null;
    try { geom = drawnLayer.toGeoJSON().geometry; } catch (e) { geom = null; }
    if (!geom) { setResult('Could not read the drawing. Please try again.', 'err'); return; }

    var endpoint = String(window.COMMUNITY_SUBMIT_URL || '').trim();
    if (!endpoint) {
      setResult('Submissions are not configured yet. Please use the contact/survey form for now: https://gnkng.github.io/green-corridor/survey-swindon.html', 'err');
      return;
    }
    var payload = { geometry: geom, attributes: attrs, website: asciiVal(document.getElementById('c-website').value) };
    var btn = document.getElementById('c-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
    setResult('Sending for review...');
    fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().catch(function(){ return {}; }).then(function(d){ return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        var msg = (res.data && (res.data.message || res.data.error)) || '';
        if (res.ok && res.data && res.data.ok) {
          var pending = loadLocalPending();
          pending.push({ geometry: geom, properties: attrs, submitted_at: new Date().toISOString() });
          saveLocalPending(pending);
          renderMyPending();
          try { if (!map.hasLayer(myPendingLayer)) myPendingLayer.addTo(map); } catch (e) {}
          setResult((msg || 'Thank you. Your suggestion was queued for review.') + ' It stays visible here on this device (P) until approved publicly.', 'ok');
          form.reset();
          clearDrawing();
        } else {
          setResult(msg || 'Could not send right now. Please try the contact/survey form.', 'err');
        }
      })
      .catch(function () { setResult('Network error. Please try the contact/survey form.', 'err'); })
      .then(function () { if (btn) { btn.disabled = false; btn.textContent = 'Send for review'; } });
  });
})();
