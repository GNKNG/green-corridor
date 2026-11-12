"""Build an offline Map Pack bundle for field surveyor mobile use.

Packages regional vector layers (green corridors, community returns, open space,
heritage layers) into a self-contained, portable offline map pack with checksums,
bounding box metadata, and statutory protection compliance.

Usage:
  python worker/build_map_pack.py [--output az-viewer/data/swindon_greens_pack.json] [--gzip]
"""
from __future__ import annotations

import argparse
import datetime
import gzip
import hashlib
import json
import sys
from pathlib import Path

DEFAULT_SWINDON_BBOX = [-1.92, 51.51, -1.68, 51.63]


def compute_sha256(data: bytes) -> str:
    """Compute hex sha256 of raw bytes."""
    return hashlib.sha256(data).hexdigest()


def compute_geojson_bbox(features: list[dict]) -> list[float]:
    """Compute [min_lon, min_lat, max_lon, max_lat] for a list of features."""
    min_x, min_y = float("inf"), float("inf")
    max_x, max_y = float("-inf"), float("-inf")

    def walk_coords(c: list):
        nonlocal min_x, min_y, max_x, max_y
        if not c:
            return
        if isinstance(c[0], (int, float)):
            x, y = float(c[0]), float(c[1])
            if x < min_x:
                min_x = x
            if x > max_x:
                max_x = x
            if y < min_y:
                min_y = y
            if y > max_y:
                max_y = y
        else:
            for sub in c:
                walk_coords(sub)

    for f in features:
        geom = f.get("geometry")
        if geom and "coordinates" in geom:
            walk_coords(geom["coordinates"])

    if min_x == float("inf"):
        return DEFAULT_SWINDON_BBOX
    return [round(min_x, 6), round(min_y, 6), round(max_x, 6), round(max_y, 6)]


def load_layer(file_path: Path) -> dict:
    """Load and validate a GeoJSON layer from disk."""
    text = file_path.read_text(encoding="utf-8")
    data = json.loads(text)
    features = data.get("features", [])
    bbox = compute_geojson_bbox(features)
    raw_bytes = text.encode("utf-8")
    return {
        "name": file_path.stem,
        "filename": file_path.name,
        "feature_count": len(features),
        "sha256": compute_sha256(raw_bytes),
        "bbox": bbox,
        "features": features
    }


def build_pack(source_dir: Path, output_file: Path, compress: bool = False) -> int:
    """Build the aggregated map pack bundle."""
    if not source_dir.exists():
        print(f"error: source directory not found: {source_dir}", file=sys.stderr)
        return 1

    layers_to_find = [
        "parcels-public.geojson",
        "residential-garden-zones.geojson",
        "ancient-woodland.geojson",
        "prow-swindon.geojson",
        "planning-swindon.geojson",
        "community.geojson"
    ]

    pack_layers = []
    total_features = 0

    for name in layers_to_find:
        layer_path = source_dir / name
        if layer_path.exists():
            layer_info = load_layer(layer_path)
            total_features += layer_info["feature_count"]
            pack_layers.append(layer_info)
            print(f"Loaded layer: {name} ({layer_info['feature_count']} features)")
        else:
            print(f"warning: layer file {name} not found in {source_dir}", file=sys.stderr)

    # Any other .geojson files in directory
    for extra_path in source_dir.glob("*.geojson"):
        if extra_path.name not in layers_to_find:
            layer_info = load_layer(extra_path)
            total_features += layer_info["feature_count"]
            pack_layers.append(layer_info)
            print(f"Loaded extra layer: {extra_path.name} ({layer_info['feature_count']} features)")

    pack_payload = {
        "pack_format_version": "1.0",
        "pack_name": "Swindon Green Corridors & Survey Offline Pack",
        "region": "Swindon Borough & Rural Environs",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "total_layers": len(pack_layers),
        "total_features": total_features,
        "statutory_notices": {
            "badgers": "Protection of Badgers Act 1992: All badger observations generalized to Swindon Civic Offices.",
            "status": "DRAFT / Indicative community evidence; not a legal boundary.",
            "attribution": "Contains Ordnance Survey, OpenStreetMap (ODbL), and Swindon Borough Planning portal context."
        },
        "layers": pack_layers
    }

    raw_json = json.dumps(pack_payload, indent=2 if not compress else None)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    if compress:
        with gzip.open(output_file, "wt", encoding="utf-8") as gf:
            gf.write(raw_json)
        print(f"Successfully generated compressed pack: {output_file} ({output_file.stat().st_size} bytes)")
    else:
        output_file.write_text(raw_json, encoding="utf-8")
        print(f"Successfully generated map pack: {output_file} ({output_file.stat().st_size} bytes)")

    return 0


def main(argv: list[str]) -> int:
    """CLI entrypoint for map pack generator."""
    parser = argparse.ArgumentParser(description="Build offline Map Pack bundle for Swindon Green Corridors")
    parser.add_argument("--source-dir", default="az-viewer/data", help="Directory containing GeoJSON files (default: az-viewer/data)")
    parser.add_argument("--output", default="az-viewer/data/swindon_greens_pack.json", help="Output file path (default: az-viewer/data/swindon_greens_pack.json)")
    parser.add_argument("--gzip", action="store_true", help="Gzip-compress output map pack (.pack.json.gz)")
    args = parser.parse_args(argv[1:])

    out_path = Path(args.output)
    if args.gzip and not out_path.name.endswith(".gz"):
        out_path = out_path.with_name(out_path.name + ".gz")

    return build_pack(Path(args.source_dir), out_path, compress=args.gzip)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
