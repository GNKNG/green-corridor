# Community submission worker (az-viewer)

Receives community map submissions from `az-viewer` and opens a GitHub pull request for owner review. **No secrets in page JS.** No respondent email collected.

## What it does
- Validates/sanitizes input (ASCII, strips house numbers to street-level, blocks sensitive wildlife-location terms: sett/den/nest/roost, size limits, geometry simplification).
- Requires a marker or freehand indicative area. Indicative only - not a boundary/designation/ownership claim.
- Creates a branch + `az-viewer/data/submissions/pending-*.json` + PR against `main` for moderation.
- Approved items are moved/merged into `az-viewer/data/community.geojson` (the viewer loads that file).

## Deploy (Cloudflare Workers)
1. Install Wrangler: `npm i -g wrangler` (or use Cloudflare dashboard).
2. From `worker/`: `wrangler init` if needed, or use the dashboard "Quick edit"/deploy with `worker.js`.
3. Set secrets (never commit):
   - `GITHUB_TOKEN` (fine-grained PAT: Contents read/write, Pull requests read/write, scoped to this repo)
   - `GITHUB_OWNER` = `GNKNG`
   - `GITHUB_REPO` = `green-corridor`
   - `GITHUB_BRANCH` = `main` (optional)
4. Deploy and note the Worker URL (e.g. `https://...workers.dev/`).
5. In `az-viewer/index.html` set `window.COMMUNITY_SUBMIT_URL` to that URL, commit/push.

## Moderation (owner eyeball, no admin UI)
- Queue = open PRs titled "Community submission (pending review)".
- Review: indicative only, no house numbers, no precise wildlife locations, no ownership/designation/boundary/approval claim, not spam.
- **Approve:** move/merge the feature into `az-viewer/data/community.geojson` (append to `features`, keep `feature_class: community_suggestion`, set a stable id/label if desired) and merge/close; push to `main` -> viewer shows it.
- **Reject/spam:** close PR, delete branch. For repeat abuse, add rate-limiting / Turnstile at the Worker.

## Privacy / schema
- No respondent email is collected. `contact` is accepted by the form but **raw contact is not stored** in PR records (worker stores `contact_provided` flag only) to avoid publishing PII in a public repo. Submissions include `notes` (comments) and `geometry_kind` (marker/area).
- Redeploy the worker (e.g. `worker-safe.js`) after pulling updates so server-side behavior matches.

## Rate limiting / spam (v1 minimal)
The worker includes a honeypot and validation. For production hardening add Cloudflare Rate Limiting / Turnstile and an IP denylist in KV. Git history remains the safety net (revert bad merges).

## Moderation helper
See `az-viewer/MODERATE.md` for the checklist. Optional: `python worker/promote_pending.py <pending.json> az-viewer/data/community.geojson` (drops `ip_hash`, sets approved, appends; review then commit).
