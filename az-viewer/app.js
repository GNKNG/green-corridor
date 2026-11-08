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

  // Minimal local search: matches parcel IDs and SN sector text; street index lands later as drop-in.
  var box = document.getElementById('search');
  var out = document.getElementById('results');
  box.addEventListener('input', function () {
    out.innerHTML = '';
    var q = box.value.trim().toLowerCase();
    if (!parcels || q.length < 2) return;
    var hits = parcels.filter(function (f) {
      return (f.properties.id + ' ' + f.properties.short_label).toLowerCase().indexOf(q) !== -1;
    }).slice(0, 20);
    hits.forEach(function (f) {
      var li = document.createElement('li');
      li.textContent = f.properties.id;
      li.onclick = function () { map.fitBounds(L.geoJSON(f.geometry).getBounds().pad(0.5)); };
      out.appendChild(li);
    });
    if (!hits.length) {
      var li = document.createElement('li');
      li.textContent = 'No parcel match. Street/postcode index lands as upgrade; pan and zoom for now.';
      out.appendChild(li);
    }
  });
})();
