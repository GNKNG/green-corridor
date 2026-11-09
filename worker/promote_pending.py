"""Promote a pending community submission into az-viewer/data/community.geojson.

Owner-side helper. Reviews nothing automatically - inspect output before committing.
Usage:
  python worker/promote_pending.py az-viewer/data/submissions/pending-XYZ.json az-viewer/data/community.geojson
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

DROP_PUBLIC = {"ip_hash", "contact", "website"}  # never publish raw PII/internal


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("usage: promote_pending.py <pending.json> <community.geojson>", file=sys.stderr)
        return 2
    pending_path, community_path = Path(argv[1]), Path(argv[2])
    pending = json.loads(pending_path.read_text(encoding="utf-8"))
    feat = pending if pending.get("type") == "Feature" else (pending.get("features") or [None])[0]
    if not feat or feat.get("type") != "Feature":
        print("error: pending file is not a GeoJSON Feature", file=sys.stderr)
        return 1
    props = dict(feat.get("properties") or {})
    for k in list(props.keys()):
        if k in DROP_PUBLIC:
            props.pop(k, None)
    props["feature_class"] = "community_suggestion"
    props["status"] = "approved"
    out_feat = {"type": "Feature", "geometry": feat.get("geometry"), "properties": props}

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
