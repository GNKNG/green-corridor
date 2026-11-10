# Community moderation checklist (az-viewer)

Submissions arrive as GitHub pull requests (created by the Worker). Approved items appear publicly only after they are added to `az-viewer/data/community.geojson` on `main`.

## Sensitive Species Protection (Protection of Badgers Act 1992)
Badgers and their setts receive strict statutory protection. Under Natural England guidelines:
1. **Never publish pinpoint badger coordinates:** Badger sightings must be snapped to a 500m grid cell Polygon (`sensitive_species: true`, `generalised: true`). If a submission contains a Point geometry for a badger, it must NEVER be promoted to public GeoJSON.
2. **Sett terms:** Raw sett terms ("sett entrance", "badger sett") are sanitized to "[presence noted]". Explicit residential addresses near setts are withheld (`geometry: null`, `status: "withheld_sensitive"`).
3. **Unclassified records default to held:** Records without a verified species tag or marked `unclassified` are held for review (`status: "pending_review"`). They cannot be promoted without explicit approval (`--allow-unclassified` or `--set-species <name>`).
4. **Photos:** Location EXIF metadata is stripped, and badger-tagged photos are restricted (`photo_restricted: true`).

## Review a submission PR
- Open PRs titled "Community submission (pending review)" or "[BADGER - 500m Generalised]" or "[HELD - ...]". Check the pending JSON file under `az-viewer/data/submissions/`.
- Confirm:
  - [ ] Indicative only (not a boundary, designation, survey, approval, or ownership claim)
  - [ ] No house numbers (street/area-level only)
  - [ ] No precise wildlife locations (sett, den, nest, roost). Badger records must be 500m grid Polygons, never Points.
  - [ ] Unclassified records have been reviewed and classified where appropriate.
  - [ ] No personal/sensitive data; `contact_provided` may be true but raw contact is not stored.
  - [ ] Geometry is reasonable (not spam/junk).
- **Reject/spam:** close the PR (delete the branch if desired). For repeat abuse, add rate limiting/Turnstile at the Worker.
- **Approve:** promote the feature into `az-viewer/data/community.geojson` (see below), commit to `main` (via the PR or a follow-up commit), then merge/close the PR.

## Approve (promote) into community.geojson
1. Recommended helper (enforces Badger Act and unclassified invariants):
   ```bash
   python worker/promote_pending.py az-viewer/data/submissions/pending-XYZ.json az-viewer/data/community.geojson
   ```
   If unclassified, specify `--set-species <species>` or `--allow-unclassified`.
2. Inspect the output diff in `az-viewer/data/community.geojson`.
3. Commit and push to `main` -> GitHub Pages deploys live; viewers see approved features.

## Notes
- Public "C" labels render only from approved `community.geojson`. A user's local "P" (pending, this device) marker is stored in their browser only and is not auto-removed when approved (they can use "Clear my pending" in the viewer).
- Git history is the safety net: revert a bad merge/commit to undo.
