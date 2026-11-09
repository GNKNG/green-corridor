/* Read-only A-Z viewer. No editing, no backend, no login. Layers/labels aligned with A-Z product. */
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
  function displayLabel(props, proposedSeq) {
    var p = props || {}, fc = p.feature_class || '';
    var official = ['en_number','designation_ref','official_designation','ref'];
    var generic = ['display_name','short_label','name'];
    var i, v;
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
    for (i=0;i<official.length;i++){ v=nonempty(p[official[i]]); if(v) return v; }
    for (i=0;i<generic.length;i++){ v=nonempty(p[generic[i]]); if(v) return v; }
    return String(p.id || '');
  }

  var CLASS_META = {
    en1_green_corridor: { label: 'Adopted EN1 green corridor (policy context)', color: '#1B7F3A', fill: '#27AE60', weight: 3, dash: '8 5', fillOpacity: 0, hatch: 'hatch-en1' },
    proposed_new_areas: { label: 'Proposed new area (DRAFT / indicative)', color: '#C77700', fill: '#F9A825', weight: 3, dash: null, fillOpacity: 0, hatch: 'hatch-proposed' },
    amenity_water:      { label: 'Amenity water (indicative)', color: '#1565C0', fill: '#42A5F5', weight: 2, dash: null, fillOpacity: 0.28, hatch: null }
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
  var groupLayers = {};
  var foundMarker = null;

  function popupHtml(p, lab) {
    var meta = CLASS_META[p.feature_class] || { label: p.feature_class || '' };
    return '<strong>' + esc(lab) + '</strong>' +
      ' <span style="color:#666">(' + esc(p.id) + ')</span><br>' +
      'Type: ' + esc(meta.label) + '<br>' +
      'Status: ' + esc(p.status) + '<br>' +
      'Date: ' + esc(p.date || '') + '<br>' +
      'Contact: <a href="https://gnkng.github.io/green-corridor/survey-swindon.html">survey form</a><br>' +
      '<em>DRAFT / NOTHING FILED. Indicative only, not a legal boundary.</em>';
  }

  fetch('data/parcels-public.geojson').then(function (r) { return r.json(); }).then(function (fc) {
    parcels = fc.features || [];
    var proposedSeq = buildProposedSeq(parcels);
    parcels.forEach(function (f) { f.properties = f.properties || {}; f.properties._label = displayLabel(f.properties, proposedSeq); });
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
        onEachFeature: function (f, l) {
          var lab = f.properties._label || f.properties.id;
          l.bindPopup(popupHtml(f.properties, lab));
          l.bindTooltip(String(lab), { permanent: true, direction: 'center', className: 'feat-label feat-' + cls });
        }
      }).addTo(map);
    });
    injectHatchDefs();
    order.forEach(function (cls) { if (CLASS_META[cls] && CLASS_META[cls].hatch) applyHatch(groups[cls], cls); });

    var overlays = {};
    overlays['Adopted EN1 green corridors (' + (groups.en1_green_corridor ? groups.en1_green_corridor.getLayers().length : 0) + ')'] = groups.en1_green_corridor;
    overlays['Proposed new areas - draft (' + (groups.proposed_new_areas ? groups.proposed_new_areas.getLayers().length : 0) + ')'] = groups.proposed_new_areas;
    overlays['Amenity water (' + (groups.amenity_water ? groups.amenity_water.getLayers().length : 0) + ')'] = groups.amenity_water;
    L.control.layers(null, overlays, { collapsed: window.innerWidth < 700 }).addTo(map);

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
  }).catch(function (e) {
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
})();