# A-Z viewer (read-only borough viewer) - minimal live test

STATUS: DRAFT / NOTHING PUBLISHED. Local files only. Separate from the editor (corridor-editor.html + baseline sqlite); no shared code.

Files:
- index.html - Leaflet page, OSM live base, banner + panel + map
- app.js - read-only logic: load parcels-public.geojson, click popups, parcel list, prefix search over IDs
- style.css - Constable Road leaflet palette (paper/forest/moss/sage/berry)
- data/parcels-public.geojson - 40 features, 1507021 bytes, adopted EN1 context only (not Reg 19 layer), DRAFT indicative
- .nojekyll + README needed before Pages publish

Run locally: serve site/az-viewer over http (file:// blocks fetch). Example: python -m http.server 8000 in site/az-viewer, open http://127.0.0.1:8000/index.html.

Banners: DRAFT / NOTHING FILED, indicative only, adopted EN1 vs emerging Reg 19, Constable Road separate, [FORM LINK] + [MAP URL + DATE] placeholders.

Next: parcel ID prefix freeze, street/postcode JSON drop-in, GitHub repo + Pages URL, 10-page pilot PDF from same source.
