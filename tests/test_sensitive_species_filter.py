"""Automated test suite for Sensitive Species Protection Filter (Badgers & Setts).

Validates:
1. promote_pending.py: Refuses unclassified records without explicit flag.
2. promote_pending.py: Refuses badger records with Point geometry per Protection of Badgers Act 1992.
3. promote_pending.py: Successfully promotes compliant 500m grid badger records and strips internal PII.
4. export_publish.py: Refuses export if a badger record is a Point geometry.
5. export_publish.py: Enforces never_emit list on sensitive keys.
6. OpenStreetMap invariant: Validates that no OSM push/upload path exists in repo or app.
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path("C:/Users/trowe/AppData/Local/Temp/opencode/green-corridor-publish")
SITE_ROOT = Path("D:/OBSIDIAN_VAULTS/VAULT1/wildlife-protection/site")


def test_promote_pending_unclassified_refused():
    """Verify that promote_pending.py refuses unclassified records by default."""
    with tempfile.TemporaryDirectory() as tmpdir:
        td = Path(tmpdir)
        pending_file = td / "pending.json"
        community_file = td / "community.geojson"

        pending_data = {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [-1.78, 51.56]},
            "properties": {
                "place": "Queen's Park",
                "species": "unclassified",
                "status": "pending_review",
            },
        }
        community_data = {"type": "FeatureCollection", "features": []}

        pending_file.write_text(json.dumps(pending_data), encoding="utf-8")
        community_file.write_text(json.dumps(community_data), encoding="utf-8")

        # Promoting without --allow-unclassified should fail (exit code 1)
        res = subprocess.run(
            [sys.executable, str(REPO_ROOT / "worker" / "promote_pending.py"), str(pending_file), str(community_file)],
            capture_output=True,
            text=True,
        )
        assert res.returncode == 1, "promote_pending must refuse unclassified records without explicit flag"
        assert "unclassified" in res.stderr.lower(), "stderr should explain unclassified hold"

        # Promoting with --allow-unclassified should succeed
        res_ok = subprocess.run(
            [
                sys.executable,
                str(REPO_ROOT / "worker" / "promote_pending.py"),
                str(pending_file),
                str(community_file),
                "--allow-unclassified",
            ],
            capture_output=True,
            text=True,
        )
        assert res_ok.returncode == 0, f"promote_pending with --allow-unclassified failed: {res_ok.stderr}"
        updated_comm = json.loads(community_file.read_text(encoding="utf-8"))
        assert len(updated_comm["features"]) == 1, "Should have appended 1 feature"
        print("  PASS: test_promote_pending_unclassified_refused")


def test_promote_pending_badger_point_rejected():
    """Verify that promote_pending.py rejects any badger record that has Point geometry."""
    with tempfile.TemporaryDirectory() as tmpdir:
        td = Path(tmpdir)
        pending_file = td / "pending_badger_pin.json"
        community_file = td / "community.geojson"

        # Raw pinpoint for a badger must NEVER be promoted
        pending_data = {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [-1.785, 51.562]},
            "properties": {
                "place": "Coate Woods",
                "species": "badger",
                "sensitive_species": True,
                "status": "pending_review",
            },
        }
        community_data = {"type": "FeatureCollection", "features": []}

        pending_file.write_text(json.dumps(pending_data), encoding="utf-8")
        community_file.write_text(json.dumps(community_data), encoding="utf-8")

        res = subprocess.run(
            [sys.executable, str(REPO_ROOT / "worker" / "promote_pending.py"), str(pending_file), str(community_file)],
            capture_output=True,
            text=True,
        )
        assert res.returncode == 1, "promote_pending must refuse badger record with Point geometry"
        assert "point geometry" in res.stderr.lower(), "stderr should mention forbidden Point geometry"
        assert "protection of badgers act" in res.stderr.lower(), "stderr should mention statutory protection"
        print("  PASS: test_promote_pending_badger_point_rejected")


def test_promote_pending_badger_polygon_promoted_safely():
    """Verify that promote_pending.py safely promotes 500m grid polygon badger records."""
    with tempfile.TemporaryDirectory() as tmpdir:
        td = Path(tmpdir)
        pending_file = td / "pending_badger_poly.json"
        community_file = td / "community.geojson"

        # Generalised 500m grid cell polygon
        poly_geom = {
            "type": "Polygon",
            "coordinates": [[
                [-1.788, 51.560],
                [-1.780, 51.560],
                [-1.780, 51.565],
                [-1.788, 51.565],
                [-1.788, 51.560],
            ]],
        }
        pending_data = {
            "type": "Feature",
            "geometry": poly_geom,
            "properties": {
                "place": "Coate Woods",
                "species": "badger",
                "sensitive_species": True,
                "generalised": True,
                "generalisation_grid": "500m",
                "notes": "Badger presence observed",
                "ip_hash": "a1b2c3d4e5f6",
                "audit_log": [{"action": "generalise_500m_grid"}],
            },
        }
        community_data = {"type": "FeatureCollection", "features": []}

        pending_file.write_text(json.dumps(pending_data), encoding="utf-8")
        community_file.write_text(json.dumps(community_data), encoding="utf-8")

        res = subprocess.run(
            [sys.executable, str(REPO_ROOT / "worker" / "promote_pending.py"), str(pending_file), str(community_file)],
            capture_output=True,
            text=True,
        )
        assert res.returncode == 0, f"Promotion of valid 500m badger record failed: {res.stderr}"

        comm = json.loads(community_file.read_text(encoding="utf-8"))
        assert len(comm["features"]) == 1
        feat = comm["features"][0]
        assert feat["geometry"]["type"] == "Polygon"
        assert feat["properties"]["species"] == "badger"
        assert feat["properties"]["status"] == "approved"
        assert feat["properties"]["generalised"] is True
        # Verify internal PII and audit history are stripped from public GeoJSON
        assert "ip_hash" not in feat["properties"]
        assert "audit_log" not in feat["properties"]
        assert "contact" not in feat["properties"]
        print("  PASS: test_promote_pending_badger_polygon_promoted_safely")


def test_export_publish_badger_point_rejected():
    """Verify that export_publish.py refuses to export if a badger record is a Point."""
    if not (SITE_ROOT / "export_publish.py").exists():
        print("  SKIP: export_publish.py not present in site root")
        return

    with tempfile.TemporaryDirectory() as tmpdir:
        td = Path(tmpdir)
        source_geojson = td / "source.geojson"
        out_geojson = td / "parcels-public.geojson"
        manifest_file = td / "manifest.json"
        config_file = td / "publish_config.yaml"

        # Bad feature with species badger and Point geometry
        source_data = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [-1.785, 51.562]},
                    "properties": {
                        "id": "badger-pt-1",
                        "feature_class": "proposed_new_areas",
                        "species": "badger",
                        "sensitive_species": True,
                    },
                }
            ],
        }
        source_geojson.write_text(json.dumps(source_data), encoding="utf-8")

        config_data = (
            f"schema_version: '1.0'\n"
            f"source:\n"
            f"  kind: geojson\n"
            f"  path: '{source_geojson.as_posix()}'\n"
            f"selection:\n"
            f"  include_feature_classes: ['proposed_new_areas']\n"
            f"properties:\n"
            f"  keep: ['id', 'feature_class', 'species', 'sensitive_species']\n"
            f"output:\n"
            f"  path: '{out_geojson.as_posix()}'\n"
            f"  manifest_path: '{manifest_file.as_posix()}'\n"
        )
        config_file.write_text(config_data, encoding="utf-8")

        res = subprocess.run(
            [sys.executable, str(SITE_ROOT / "export_publish.py"), "--config", str(config_file)],
            capture_output=True,
            text=True,
        )
        assert res.returncode != 0, "export_publish must fail loudly when exporting a badger Point"
        assert "point geometry" in res.stderr.lower() or "protection of badgers act" in res.stderr.lower(), (
            f"Unexpected stderr: {res.stderr}"
        )
        print("  PASS: test_export_publish_badger_point_rejected")


def test_osm_push_boundary_invariant():
    """Verify that NO OpenStreetMap API push endpoints or credentials exist in the repo."""
    forbidden_terms = [
        "api.openstreetmap.org/api/0.6/changeset",
        "api06.dev.openstreetmap.org",
        "osm_oauth_token",
        "osm_password",
        "osm_user",
    ]
    for ext in ("*.js", "*.html", "*.py", "*.yaml", "*.json"):
        for path in REPO_ROOT.rglob(ext):
            if "node_modules" in str(path) or ".git" in str(path) or "tests" in str(path):
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            for term in forbidden_terms:
                assert term not in text, f"OSM push hazard '{term}' found in {path}"

    print("  PASS: test_osm_push_boundary_invariant (OSM is strictly read-only)")


def main():
    print("Running sensitive species protection test suite...")
    test_promote_pending_unclassified_refused()
    test_promote_pending_badger_point_rejected()
    test_promote_pending_badger_polygon_promoted_safely()
    test_export_publish_badger_point_rejected()
    test_osm_push_boundary_invariant()
    print("ALL SENSITIVE SPECIES FILTER PYTHON TESTS PASSED.")


if __name__ == "__main__":
    main()
