/* Read-only borough viewer. No editing, no backend, no login. */
(function () {
  var map = L.map('map').setView([51.568, -1.78], 11);
  var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: 'OpenStreetMap contributors'
  }).addTo(map);

  var parcels = null;
  var layer = null;

  function popupHtml(p) {
    return '<strong>' + p.short_label + '</strong><br>' +
      'Type: adopted EN1 corridor (context)<br>' +
      'Status: ' + p.status + '<br>' +
      'Source: ' + p.source + '<br>' +
      'Are you already working on this area?<br>' +
      'Contact: [FORM LINK]<br>' +
      '<em>DRAFT / NOTHING FILED. Indicative only, not a legal boundary.</em>';
  }

  fetch('data/parcels-public.geojson').then(function (r) { return r.json(); }).then(function (fc) {
    parcels = fc.features || [];
    document.getElementById('count').textContent = parcels.length;
    layer = L.geoJSON(fc, {
      style: { color: '#1B7F3A', weight: 2, dashArray: '6 4', fillColor: '#27AE60', fillOpacity: 0.08 },
      onEachFeature: function (f, l) { l.bindPopup(popupHtml(f.properties)); }
    }).addTo(map);
    try { map.fitBounds(layer.getBounds()); } catch (e) {}
    var list = document.getElementById('parcel-list');
    parcels.forEach(function (f) {
      var li = document.createElement('li');
      li.textContent = f.properties.id + ' - ' + f.properties.short_label;
      li.onclick = function () {
        var b = L.geoJSON(f.geometry).getBounds();
        map.fitBounds(b.pad(0.5));
      };
      list.appendChild(li);
    });
  });

  // Search: parcel IDs locally, plus Swindon place navigation via Nominatim.
  // Any postcode/street moves the map; parcels are then listed as overlapping or none-here.
  var box = document.getElementById('search');
  var out = document.getElementById('results');
  var searchTimer = null;
  function clearOut() { out.innerHTML = ''; }
  function addLine(text, onclick) {
    var li = document.createElement('li');
    li.textContent = text;
    if (onclick) li.onclick = onclick;
    out.appendChild(li);
  }
  function parcelsNear(latlng) {
    if (!parcels || !parcels.length) return [];
    var near = [];
    parcels.forEach(function (f) {
      try {
        var b = L.geoJSON(f.geometry).getBounds().pad(0.15);
        if (b.contains(latlng)) near.push(f);
      } catch (e) {}
    });
    return near;
  }
  box.addEventListener('input', function () {
    clearOut();
    var q = box.value.trim();
    if (q.length < 2) return;
    var ql = q.toLowerCase();
    if (parcels) {
      parcels.filter(function (f) {
        return (f.properties.id + ' ' + f.properties.short_label).toLowerCase().indexOf(ql) !== -1;
      }).slice(0, 8).forEach(function (f) {
        addLine('Parcel ' + f.properties.id, function () {
          map.fitBounds(L.geoJSON(f.geometry).getBounds().pad(0.5));
        });
      });
    }
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=6&viewbox=-1.95,51.65,-1.60,51.50&bounded=1&q=' + encodeURIComponent(q + ', Swindon');
      fetch(url).then(function (r) { return r.json(); }).then(function (rows) {
        if (!rows || !rows.length) {
          addLine('No place found. Try an SN postcode or street + Swindon.');
          return;
        }
        rows.forEach(function (row) {
          var ll = L.latLng(parseFloat(row.lat), parseFloat(row.lon));
          addLine(row.display_name.split(',').slice(0, 3).join(','), function () {
            map.setView(ll, 15);
            clearOut();
            var near = parcelsNear(ll);
            if (near.length) {
              near.forEach(function (f) {
                addLine('Parcel here: ' + f.properties.id, function () {
                  map.fitBounds(L.geoJSON(f.geometry).getBounds().pad(0.5));
                });
              });
            } else {
              addLine('No mapped parcel at this spot. Pan around or tell us on the form.');
            }
          });
        });
      }).catch(function () {
        addLine('Place lookup failed (network?). Pan and zoom for now.');
      });
    }, 450);
  });
})();
