"""Fetch a polite cached snapshot of recent pending Swindon planning applications.

Queries the open PlanIt UK REST GeoJSON API (aggregates Swindon Public Access under OGL)
with pagination and throttling delays, strips private applicant details, classifies
applications by size and category, records explicit harvest timestamp metadata, and
outputs a deterministic GeoJSON snapshot for az-viewer.

Usage:
  python worker/fetch_planning_swindon.py [--recent 120] [--output az-viewer/data/planning-swindon.geojson]
"""
from __future__ import annotations

import argparse
import datetime
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

PLANIT_ENDPOINT = "https://www.planit.org.uk/api/applics/geojson"
USER_AGENT = "GreenCorridorViewer/1.0 (civic planning map; local cached snapshot)"


def classify_application(props: dict) -> str:
    """Classify an application into visual style category."""
    app_size = str(props.get("app_size") or "").strip()
    app_type = str(props.get("app_type") or "").strip()
    uid = str(props.get("uid") or "").strip().upper()

    if app_size == "Large":
        return "major"
    if app_size == "Medium":
        return "medium"
    if app_type == "Trees" or uid.startswith(("S/TWC/", "S/TPO/")):
        return "trees"
    if app_type in ("Conditions", "Amendment", "Advertising"):
        return "conditions"
    return "standard"


def sanitize_feature(feat: dict, harvest_date: str) -> dict | None:
    """Sanitize a raw PlanIt GeoJSON feature for public map output."""
    geom = feat.get("geometry")
    if not geom or geom.get("type") != "Point":
        return None
    coords = geom.get("coordinates")
    if not isinstance(coords, list) or len(coords) < 2:
        return None
    try:
        lon = round(float(coords[0]), 6)
        lat = round(float(coords[1]), 6)
    except (TypeError, ValueError):
        return None

    raw_p = feat.get("properties") or {}
    other = raw_p.get("other_fields") or {}
    uid = str(raw_p.get("uid") or raw_p.get("name") or "").strip()
    if not uid:
        return None

    app_state = str(raw_p.get("app_state") or "").strip()
    if app_state and app_state.lower() != "undecided":
        return None

    category = classify_application(raw_p)

    clean_props = {
        "id": f"plan:{uid}",
        "uid": uid,
        "feature_class": "planning_application",
        "category": category,
        "address": str(raw_p.get("address") or "").strip(),
        "postcode": str(raw_p.get("postcode") or "").strip() or None,
        "description": str(raw_p.get("description") or "").strip(),
        "app_size": str(raw_p.get("app_size") or "Small").strip(),
        "app_type": str(raw_p.get("app_type") or "").strip(),
        "application_type": str(other.get("application_type") or raw_p.get("app_type") or "").strip(),
        "app_state": app_state or "Undecided",
        "status": str(other.get("status") or "Application Pending Decision").strip(),
        "start_date": str(raw_p.get("start_date") or "").strip() or None,
        "target_decision_date": str(other.get("target_decision_date") or "").strip() or None,
        "ward_name": str(other.get("ward_name") or "").strip() or None,
        "parish": str(other.get("parish") or "").strip() or None,
        "url": str(raw_p.get("url") or "").strip() or None,
        "docs_url": str(other.get("docs_url") or "").strip() or None,
        "comment_url": str(other.get("comment_url") or "").strip() or None,
        "harvested_date": harvest_date,
    }

    return {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [lon, lat],
        },
        "properties": clean_props,
    }


def fetch_pages(auth: str, recent: int, app_state: str, pg_sz: int, max_pages: int) -> list[dict]:
    """Fetch paginated GeoJSON features from PlanIt politely."""
    all_raw: list[dict] = []
    for pg in range(1, max_pages + 1):
        params = urllib.parse.urlencode({
            "auth": auth,
            "recent": recent,
            "app_state": app_state,
            "pg_sz": pg_sz,
            "page": pg,
        })
        url = f"{PLANIT_ENDPOINT}?{params}"
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"PlanIt API returned HTTP {exc.code} on page {pg}: {exc.reason}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Network error contacting PlanIt on page {pg}: {exc.reason}") from exc

        feats = payload.get("features") or []
        print(f"Page {pg}: received {len(feats)} records", file=sys.stderr)
        if not feats:
            break
        all_raw.extend(feats)
        if len(feats) < pg_sz:
            break
        time.sleep(1.5)
    return all_raw


def main(argv: list[str]) -> int:
    """Run polite harvest and emit cleaned planning applications GeoJSON."""
    parser = argparse.ArgumentParser(description="Fetch Swindon pending planning applications snapshot via PlanIt")
    parser.add_argument("--auth", default="Swindon", help="Local planning authority name (default: Swindon)")
    parser.add_argument("--recent", type=int, default=120, help="Lookback window in days (default: 120)")
    parser.add_argument("--app-state", default="Undecided", help="Application state filter (default: Undecided)")
    parser.add_argument("--pg-sz", type=int, default=100, help="Page size for API queries (default: 100)")
    parser.add_argument("--max-pages", type=int, default=10, help="Safety max pages limit (default: 10)")
    parser.add_argument("--harvest-date", default="", help="Override harvest ISO date YYYY-MM-DD (default: today UTC)")
    parser.add_argument(
        "--output",
        default="az-viewer/data/planning-swindon.geojson",
        help="Output GeoJSON path (default: az-viewer/data/planning-swindon.geojson)",
    )
    args = parser.parse_args(argv[1:])

    now_utc = datetime.datetime.now(datetime.timezone.utc)
    harvest_iso = now_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
    harvest_date = args.harvest_date.strip() or now_utc.strftime("%Y-%m-%d")

    raw_feats = fetch_pages(args.auth, args.recent, args.app_state, args.pg_sz, args.max_pages)

    seen_uids: set[str] = set()
    cleaned: list[dict] = []
    skipped_ungeocoded = 0

    for raw in raw_feats:
        uid = str((raw.get("properties") or {}).get("uid") or "").strip()
        if uid and uid in seen_uids:
            continue
        item = sanitize_feature(raw, harvest_date)
        if item is None:
            skipped_ungeocoded += 1
            continue
        seen_uids.add(item["properties"]["uid"])
        cleaned.append(item)

    cleaned.sort(key=lambda f: (f["properties"].get("uid") or "", f["properties"].get("start_date") or ""))

    category_counts: dict[str, int] = {}
    for item in cleaned:
        cat = item["properties"]["category"]
        category_counts[cat] = category_counts.get(cat, 0) + 1

    output_doc = {
        "type": "FeatureCollection",
        "metadata": {
            "source": "PlanIt UK / Swindon Borough Council Public Access",
            "attribution": "Aggregated via planit.org.uk (OGL). Verify live details on pa.swindon.gov.uk.",
            "filter": f"Recent ({args.recent}d) & {args.app_state} only",
            "window_days": args.recent,
            "harvested_at": harvest_iso,
            "harvested_date": harvest_date,
            "total_fetched": len(raw_feats),
            "plotted_count": len(cleaned),
            "skipped_ungeocoded": skipped_ungeocoded,
            "categories": dict(sorted(category_counts.items())),
            "disclaimer": "Cached planning snapshot. Verify live status, documents, and comment deadlines on pa.swindon.gov.uk.",
        },
        "features": cleaned,
    }

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output_doc, ensure_ascii=True, separators=(",", ":")), encoding="utf-8")
    print(
        f"Wrote {len(cleaned)} pending applications ({skipped_ungeocoded} ungeocoded skipped) "
        f"harvested {harvest_date} to {out_path} ({out_path.stat().st_size} bytes)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
