# Community moderation checklist (az-viewer)

Submissions arrive as GitHub pull requests (created by the Worker). Approved items appear publicly only after they are added to `az-viewer/data/community.geojson` on `main`.

## Review a submission PR
- Open PRs titled "Community submission (pending review)". Check the pending JSON file under `az-viewer/data/submissions/`.
- Confirm:
  - [ ] Indicative only (not a boundary, designation, survey, approval, or ownership claim)
  - [ ] No house numbers (street/area-level only)
  - [ ] No precise wildlife locations (sett, den, nest, roost)
  - [ ] No personal/sensitive data; `contact_provided` may be true but raw contact is not stored
  - [ ] Geometry is reasonable (not spam/junk)
- **Reject/spam:** close the PR (delete the branch if desired). For repeat abuse, add rate limiting/Turnstile at the Worker.
- **Approve:** promote the feature into `az-viewer/data/community.geojson` (see below), commit to `main` (via the PR or a follow-up commit), then merge/close the PR.

## Approve (promote) into community.geojson
1. Open `az-viewer/data/community.geojson` and append the feature from the pending file into `"features"`.
2. Ensure properties include at minimum: `feature_class: "community_suggestion"`, `status` (e.g. `"approved"`), and keep the submission fields (`place, street_area, broad_type, notes, geometry_kind`, etc.). Remove internal-only fields you do not want public (e.g. `ip_hash`).
3. Keep valid GeoJSON (Feature with `geometry` + `properties`). Commit and push to `main` -> GitHub Pages serves it; viewers see it in "Community suggestions (indicative, approved)".

Optional helper (owner-side): `python worker/promote_pending.py <pending.json> az-viewer/data/community.geojson` (review the result, then commit).

## Notes
- Public "C" labels render only from approved `community.geojson`. A user's local "P" (pending, this device) marker is stored in their browser only and is not auto-removed when approved (they can use "Clear my pending" in the viewer).
- Git history is the safety net: revert a bad merge/commit to undo.