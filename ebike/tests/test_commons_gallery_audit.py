import copy
import importlib.util
import json
import pathlib
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "repair-ebike-commons.py"
spec = importlib.util.spec_from_file_location("commons_audit", SCRIPT)
assert spec is not None and spec.loader is not None
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

PROMOTE_SCRIPT = ROOT / "scripts" / "promote-ebike-routes.py"
promote_spec = importlib.util.spec_from_file_location("commons_promote", PROMOTE_SCRIPT)
assert promote_spec is not None and promote_spec.loader is not None
promotion = importlib.util.module_from_spec(promote_spec)
promote_spec.loader.exec_module(promotion)


class CommonsGalleryAuditTests(unittest.TestCase):
    def valid_image(self):
        title = "Example photo.jpg"
        first, pair = audit.expected_hash(title)
        return {
            "url": f"https://upload.wikimedia.org/wikipedia/commons/thumb/{first}/{pair}/Example_photo.jpg/1280px-Example_photo.jpg",
            "title": title,
            "artist": "Example photographer",
            "license": "CC BY-SA 4.0",
            "license_url": "https://creativecommons.org/licenses/by-sa/4.0",
            "commons_url": "https://commons.wikimedia.org/wiki/File:Example_photo.jpg",
            "mime": "image/jpeg",
            "width": 2400,
            "height": 1600,
        }

    def catalog(self):
        return {
            "version": 1,
            "bike": {"name": "Test bike"},
            "routes": [{
                "id": "test-route",
                "track_geojson_file": "tracks/test-route.geojson",
                "waypoints": [{"lat": 52.1, "lon": 9.3}],
                "gallery": [self.valid_image()],
            }],
        }

    def write_promotion_pair(self, root, source_catalog=None, target_catalog=None):
        source = root / "routes.repaired.json"
        target = root / "routes.json"
        source.write_text(json.dumps(source_catalog or self.catalog()), encoding="utf-8")
        target.write_text(json.dumps(target_catalog or self.catalog()), encoding="utf-8")
        return source, target

    def test_all_eight_previously_empty_routes_have_reviewed_photo_sets(self):
        expected = {
            "weser-emmerauen-kurz", "haemelschenburg-emmertal-ebike", "grohnde-weser-genuss-ebike",
            "bodenwerder-weser-radweg-ebike", "fischbeck-hessisch-oldendorf-weser-ebike",
            "bad-pyrmont-kurpark-ebike", "coppenbruegge-salzhemmendorf-ebike", "rinteln-weserauen-ebike",
        }
        self.assertTrue(expected.issubset(audit.ROUTE_GALLERIES))
        for route_id in expected:
            titles = audit.ROUTE_GALLERIES[route_id]
            self.assertGreaterEqual(len(titles), 3)
            self.assertEqual(len(titles), len(set(titles)))
            self.assertTrue(all(pathlib.Path(title).suffix.lower() in {".jpg", ".jpeg", ".tif", ".tiff", ".webp"} for title in titles))

    def test_audit_rejects_empty_gallery_and_missing_metadata(self):
        catalog = {"routes": [{"id": "empty", "gallery": []}]}
        self.assertIn("empty: no images", audit.validate_catalog(catalog))
        broken = self.catalog()
        del broken["routes"][0]["gallery"][0]["artist"]
        self.assertTrue(any("missing artist" in error for error in audit.validate_catalog(broken)))

    def test_audit_rejects_generic_license_non_photo_and_low_resolution(self):
        for key, value, expected in [
            ("license", "Wikimedia Commons", "invalid license"),
            ("mime", "application/pdf", "non-photographic MIME"),
            ("width", 400, "resolution below"),
        ]:
            broken = self.catalog()
            broken["routes"][0]["gallery"][0][key] = value
            self.assertTrue(any(expected in error for error in audit.validate_catalog(broken)))

    def test_audit_rejects_bad_urls_filenames_and_dimension_types(self):
        cases = [
            ("url", "http://upload.wikimedia.org/wikipedia/commons/a/ab/Example_photo.jpg", "invalid image URL"),
            ("url", "https://evil.example/wikipedia/commons/a/ab/Example_photo.jpg", "invalid image URL"),
            ("commons_url", "https://commons.wikimedia.org/wiki/File:Other.jpg", "invalid Commons file URL"),
            ("license_url", "https://creativecommons.org/licenses/by-nc/4.0", "invalid license URL"),
            ("license_url", "https://commons.wikimedia.org/wiki/Main_Page", "invalid license URL"),
            ("width", "2400", "positive integers"),
            ("height", True, "positive integers"),
        ]
        for key, value, expected in cases:
            with self.subTest(key=key, value=value):
                broken = self.catalog()
                broken["routes"][0]["gallery"][0][key] = value
                self.assertTrue(any(expected in error for error in audit.validate_catalog(broken)))

    def test_three_known_bad_hash_paths_are_detected(self):
        bad = [
            ("https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/2022-06-05_111809_Süntel_Bad_Münder_Süntelturm.jpg/1280px-x.jpg", "2022-06-05 111809 Süntel Bad Münder Süntelturm.jpg"),
            ("https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/LSG_Süntel_-_Der_Süntelturm_11-2018_(16).jpg/1280px-x.jpg", "LSG Süntel - Der Süntelturm 11-2018 (16).jpg"),
            ("https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Bodenwerder.jpg/1280px-Bodenwerder.jpg", "Bodenwerder.jpg"),
        ]
        for url, title in bad:
            self.assertFalse(audit.has_correct_hash_path(url, title), title)

    def test_generated_runtime_catalog_passes_when_present(self):
        runtime = ROOT / "ebike" / "data" / "runtime" / "routes.repaired.json"
        if not runtime.exists():
            self.skipTest("ignored runtime catalog is not present")
        catalog = json.loads(runtime.read_text(encoding="utf-8"))
        self.assertEqual([], audit.validate_catalog(catalog))
        self.assertTrue(all(route["gallery"] for route in catalog["routes"]))

    def test_promotion_is_dry_run_by_default_and_apply_creates_verified_backup(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            target_catalog = self.catalog()
            target_catalog["routes"][0]["gallery"] = []
            source, target = self.write_promotion_pair(root, target_catalog=target_catalog)
            original = target.read_bytes()

            self.assertIsNone(promotion.promote(source, target, apply=False))
            self.assertEqual(original, target.read_bytes())
            backup = promotion.promote(source, target, apply=True)
            self.assertIsNotNone(backup)
            self.assertEqual(original, backup.read_bytes())
            self.assertEqual(self.catalog(), json.loads(target.read_text(encoding="utf-8")))

    def test_promotion_rejects_one_route_source_against_30_route_target_in_dry_run(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            target_catalog = self.catalog()
            prototype = target_catalog["routes"][0]
            target_catalog["routes"] = [dict(copy.deepcopy(prototype), id=f"route-{index}") for index in range(30)]
            source, target = self.write_promotion_pair(root, target_catalog=target_catalog)
            original = target.read_bytes()

            with self.assertRaisesRegex(ValueError, "route IDs and order"):
                promotion.promote(source, target, apply=False)
            self.assertEqual(original, target.read_bytes())

    def test_promotion_rejects_track_waypoint_and_top_level_changes_in_dry_run(self):
        mutations = [
            ("track", lambda catalog: catalog["routes"][0].update(track_geojson_file="tracks/other.geojson"), "non-gallery data"),
            ("waypoint", lambda catalog: catalog["routes"][0]["waypoints"][0].update(lat=53.0), "non-gallery data"),
            ("top-level", lambda catalog: catalog.pop("bike"), "top-level data"),
        ]
        for name, mutate, message in mutations:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as directory:
                root = pathlib.Path(directory)
                source_catalog = self.catalog()
                mutate(source_catalog)
                source, target = self.write_promotion_pair(root, source_catalog=source_catalog)
                original = target.read_bytes()

                with self.assertRaisesRegex(ValueError, message):
                    promotion.promote(source, target, apply=False)
                self.assertEqual(original, target.read_bytes())
                self.assertEqual([], list(root.glob("routes.json.backup-*")))

    def test_promotion_fails_closed_before_touching_target(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            source = root / "routes.repaired.json"
            target = root / "routes.json"
            source.write_text('{"routes": []}', encoding="utf-8")
            original = b'{"old": true}\n'
            target.write_bytes(original)
            with self.assertRaisesRegex(ValueError, "failed validation"):
                promotion.promote(source, target, apply=True)
            self.assertEqual(original, target.read_bytes())
            self.assertEqual([], list(root.glob("routes.json.backup-*")))


if __name__ == "__main__":
    unittest.main()
