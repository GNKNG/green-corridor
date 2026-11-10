"""Promote a pending community submission into az-viewer/data/community.geojson.

Owner-side helper. Enforces sensitive species invariants (Protection of Badgers Act 1992)
and unclassified holding policy before any record enters public data.
Usage:
  python worker/promote_pending.py <pending.json> <community.geojson> [--allow-unclassified] [--set-species <species>]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

DROP_PUBLIC = {"ip_hash", "contact", "website", "audit_log", "hold_reason"}
BADGER_TERMS_RE = re.compile(r"\b(badger|badgers|sett|setts|brock|meles|meles meles)\b", re.IGNORECASE)


def is_badger_record(props: dict) -> bool:
    """Check if properties indicate a badger sighting or sett."""
    if props.get("species") == "badger" or props.get("sensitive_species") is True:
        return True
    combined = " ".join([
        str(props.get("place") or ""),
        str(props.get("street_area") or props.get("street") or ""),
        str(props.get("notes") or ""),
        str(props.get("broad_type") or "")
    ])
    return bool(BADGER_TERMS_RE.search(combined))


def main(argv: list[str]) -> int:
    """Run promotion gatekeeper on a pending submission."""
    parser = argparse.ArgumentParser(description="Promote a pending community submission to public community.geojson")
    parser.add_argument("pending", help="Path to pending-XYZ.json")
    parser.add_argument("community", help="Path to community.geojson")
    parser.add_argument("--allow-unclassified", action="store_true", help="Explicitly allow promoting an unclassified species record")
    parser.add_argument("--set-species", help="Set/override the species category during moderation")
    args = parser.parse_args(argv[1:])

    pending_path = Path(args.pending)
    community_path = Path(args.community)
    if not pending_path.exists():
        print(f"error: pending file does not exist: {pending_path}", file=sys.stderr)
        return 1
    if not community_path.exists():
        print(f"error: community file does not exist: {community_path}", file=sys.stderr)
        return 1

    pending = json.loads(pending_path.read_text(encoding="utf-8"))
    feat = pending if pending.get("type") == "Feature" else (pending.get("features") or [None])[0]
    if not feat or feat.get("type") != "Feature":
        print("error: pending file is not a GeoJSON Feature", file=sys.stderr)
        return 1

    props = dict(feat.get("properties") or {})
    geom = feat.get("geometry")

    if args.set_species:
        props["species"] = args.set_species.lower().strip()

    species = str(props.get("species") or "").lower().strip()
    is_badger = is_badger_record(props) or species == "badger"

    # Enforce unclassified holding policy
    if not is_badger and (not species or species == "unclassified"):
        if not args.allow_unclassified:
            print(
                "error: record is unclassified. Unclassified records default to held for review.\n"
                "Pass --allow-unclassified or --set-species <name> to promote explicitly.",
                file=sys.stderr
            )
            return 1

    # Enforce Protection of Badgers Act 1992 invariant
    if is_badger:
        if not geom:
            print("error: record geometry was withheld for sensitive protection and cannot be published.", file=sys.stderr)
            return 1
        if geom.get("type") == "Point":
            print(
                "FATAL: Badger record has Point geometry! Pinpoint coordinates violate the\n"
                "Protection of Badgers Act 1992 and Natural England guidelines.\n"
                "Refusing to publish precise badger location. Geometry must be snapped to Council HQ Polygon.",
                file=sys.stderr
            )
            return 1
        props["species"] = "badger"
        props["sensitive_species"] = True
        props["generalised"] = True
        props["generalisation_mode"] = "council_hq_swindon"
        props["generalisation_location"] = "Swindon Borough Council Civic Offices, Euclid Street, SN1 2JH"
        props["privacy_protection"] = "Protection of Badgers Act 1992"
        props["place"] = "Swindon Borough Council Civic Offices"
        props["street_area"] = "Euclid Street, Swindon SN1 2JH"

    for k in list(props.keys()):
        if k in DROP_PUBLIC:
            props.pop(k, None)

    props["feature_class"] = "community_suggestion"
    props["status"] = "approved"

    out_feat = {"type": "Feature", "geometry": geom, "properties": props}

    comm = json.loads(community_path.read_text(encoding="utf-8"))
    if comm.get("type") != "FeatureCollection":
        print("error: community file is not a FeatureCollection", file=sys.stderr)
        return 1

    comm.setdefault("features", []).append(out_feat)
    community_path.write_text(json.dumps(comm, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
    print(f"appended 1 feature -> {community_path} (total {len(comm['features'])}). Review and commit.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
