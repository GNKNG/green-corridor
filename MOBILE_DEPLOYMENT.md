# Mobile Deployment & Offline Survey Guide

The Swindon Green Corridors application is architected as a **single-template unified system**. A single codebase (`az-viewer/`) simultaneously serves:
1. **Live Web Application** (hosted via GitHub Pages).
2. **Instant Installable PWA** (Progressive Web App on Android, iOS, Windows, Mac).
3. **Autonomous Offline Field Survey Tool** (with local tile caching, offline vector map packs, and background upload queue).
4. **Standalone Native Android APK** (via Capacitor wrapper).

Any commit pushed to `main` updates all tiers simultaneously without needing separate codebases.

---

## 1. Option A: Progressive Web App (PWA) - Instant Install

No app store approvals or developer accounts are needed.

### On Android (Chrome / Firefox / Edge)
1. Open `https://gnkng.github.io/green-corridor/az-viewer/` on the mobile browser.
2. An **"Install App"** prompt appears automatically at the bottom.
3. Alternatively, tap the browser menu (three dots) -> **"Install app"** or **"Add to Home screen"**.
4. The app installs as a native standalone app on the phone with its own green corridor icon, full-screen view (no address bar), and persistent offline storage.

### On iPhone / iPad (Safari)
1. Open the URL in Safari.
2. Tap the **Share** button (box with upward arrow).
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **Add**. The app runs full screen directly from the iOS home screen.

---

## 2. Option B: Autonomous Field Operation (Offline GPS & Map Packs)

When volunteers walk through countryside, woods, or river corridors with poor or zero cell reception:

### Real-Time GPS Tracking
- Tap the **GPS** button (`◎`) on the floating map toolbar.
- The phone acquires GPS lock, displays a high-contrast pulsing blue marker with an accuracy radius ring, and centers the map.
- Works offline via phone satellite GPS hardware without internet.

### Sat-Nav Style "Map Packs"
1. **Pre-Cache View Tiles**:
   - Open **Layers** -> **OFFLINE MAP PACKS** -> **Cache View**.
   - Caches OpenStreetMap tiles for the current zoom and bounds directly into device storage (`gc-data-v2`).
2. **Import Offline Map Pack**:
   - Tap **Import Pack** and pick any `.json` or `.geojson` file (or map pack generated via `worker/build_map_pack.py`).
   - The vector layers load immediately onto the map and are available permanently offline.
3. **Generating Map Packs**:
   ```bash
   python worker/build_map_pack.py --gzip --output az-viewer/data/swindon_greens_pack.json.gz
   ```

### Offline Survey Submission Queue
- If a volunteer draws a boundary or pins a feature while offline, submitting the form saves the return safely to the local device storage (`gc_offline_queue_v1`).
- The user sees an immediate confirmation: *"Saved locally on device. Will auto-upload when back online."*
- As soon as the device reconnects to Wi-Fi or 4G/5G, the background queue flushes automatically to the Cloudflare ingestion worker.

---

## 3. Option C: Standalone Native Android APK (Capacitor)

If a pre-packaged Android `.apk` file is needed for distribution or sideloading:

### Prerequisites
- Node.js (v18+)
- Android Studio / Android SDK

### Steps to Build APK
```bash
# 1. Install dependencies
npm install

# 2. Add Android native platform
npm run cap:add:android

# 3. Synchronize az-viewer/ web assets to Android project
npm run cap:sync

# 4. Open in Android Studio to build signed APK or run on connected device
npm run cap:open:android
```

---

## 4. Sensitive Species Compliance (Protection of Badgers Act 1992)

Under all deployment options (Web, PWA, APK):
- Any survey return mentioning badgers or setts is **automatically snapped to Swindon Borough Council Civic Offices (Euclid Street, SN1 2JH)** before leaving the device.
- Pinpoint badger coordinates are never stored locally, transmitted across the network, or published to public layers.

---

## 5. Additional Field Surveyor Features (v=32)

### Client-Side EXIF Photo Scrubbing
- Volunteers can attach photos of veteran trees, habitats, ponds, or boundary features.
- An in-browser canvas re-encoder automatically discards all EXIF metadata (GPS coordinates, timestamps, device make/model) and optimizes photo size to 1280px before storage or upload.

### One-Click "Share This Space" & Deep Links
- Every feature popup has a **Share this space** button.
- On mobile devices, triggers the native OS share sheet (`navigator.share`) for instant WhatsApp, Email, or Messaging dispatch.
- Supports URL hash routing (e.g. `#parcel=23` or `#parcel=p12` or `#loc=51.56,-1.78,16`) which automatically zooms to the exact parcel and opens its details.

### Baseline Reference Layers
- **Natural England Ancient Woodland Inventory**: 51 irreplaceable ancient semi-natural woodland sites in Swindon (NPPF protected).
- **Swindon Borough Public Rights of Way (PRoW)**: 684 official legal footpaths, bridleways, and byways across Swindon Borough.

---

## 6. Wildlife & Habitat Library (v=33)

- Accessible via **Library** in the top navigation bar or inside the main Menu (`Browse`).
- Cached offline via `data/library.json` in Service Worker (`gc-viewer-v5`).
- Covers local Wiltshire/Swindon wildlife rescues (Oak & Furrows `01793 640136`, Wiltshire Wildlife Hospital `07850 778752`), statutory protection (Badgers Act 1992, Wildlife & Countryside Act 1981), feeding guidelines (hedgehogs, birds, badgers), pond escape ramps, and pollinator planting.
- Supports live keyword filtering, category tabs, direct mobile calling (`tel:` links), and hash deep-linking (`#library=hedgehogs`).

---

## 7. Pending Planning Applications Layer (v=34)

- **Harvest Script:** `worker/fetch_planning_swindon.py` pulls recent (120d) pending/undecided applications for Swindon from PlanIt UK (`planit.org.uk`, OGL) into `az-viewer/data/planning-swindon.geojson` and bundles it into `swindon_greens_pack.json.gz`.
- **Hidden by Default:** Layer starts unchecked in the **Layers** menu so corridors remain uncluttered.
- **Colour-Coded Categories:** Large/Major (red), Medium (orange), Trees/Hedgerow (purple), Standard Full/Outline (magenta), Conditions/Amendments (slate grey).
- **Direct Portal & Annotation Links:** Popups show reference ID, proposal text, target decision date, Swindon Public Access links (Portal Summary, Documents, Comment), and **Add corridor note here** to pre-populate a field survey return next to the site.
- **Snapshot Recency Notice:** Exact harvest date (`harvested_date`) is displayed inside the Layers drawer, sidebar disclaimer card, annotation panel, and every application popup.



