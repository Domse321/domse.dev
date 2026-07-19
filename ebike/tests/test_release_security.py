import json
import re
import unittest
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
ROUTE_ID = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
DATA_FILE = re.compile(r"^(?:gpx|tracks)/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:gpx|geojson)$")
FORBIDDEN_ROUTE_CHARS = set("<>\"'`")
URL_RULES = {
    "navigation_link": ("www.google.com", "/maps/"),
    "komoot_link": ("www.komoot.com", "/"),
    "planner_link": ("brouter.de", "/brouter-web/"),
}


def strings(value):
    if isinstance(value, dict):
        for child in value.values():
            yield from strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from strings(child)
    elif isinstance(value, str):
        yield value


class ReleaseSecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        catalog_path = ROOT / "data/routes.json"
        cls.catalog = json.loads(catalog_path.read_text()) if catalog_path.is_file() else None
        cls.routes = cls.catalog["routes"] if cls.catalog else []

    @unittest.skipUnless((ROOT / "data/routes.json").is_file(), "private runtime catalog not present in public checkout")
    def test_route_values_cannot_break_html_templates(self):
        bad = [value for value in strings(self.catalog) if FORBIDDEN_ROUTE_CHARS.intersection(value)]
        self.assertEqual(bad, [], "routes.json contains HTML/attribute-breaking characters")

    @unittest.skipUnless((ROOT / "data/routes.json").is_file(), "private runtime catalog not present in public checkout")
    def test_route_ids_and_local_files_are_bounded(self):
        for route in self.routes:
            self.assertRegex(route["id"], ROUTE_ID)
            self.assertRegex(route["gpx_file"], DATA_FILE)
            self.assertRegex(route["track_geojson_file"], DATA_FILE)
            self.assertTrue((ROOT / "data" / route["gpx_file"]).is_file())
            self.assertTrue((ROOT / "data" / route["track_geojson_file"]).is_file())

    @unittest.skipUnless((ROOT / "data/routes.json").is_file(), "private runtime catalog not present in public checkout")
    def test_external_urls_match_runtime_allowlist(self):
        for route in self.routes:
            for field, (host, prefix) in URL_RULES.items():
                parsed = urlsplit(route[field])
                self.assertEqual(parsed.scheme, "https")
                self.assertEqual(parsed.hostname, host)
                self.assertFalse(parsed.username or parsed.password)
                self.assertTrue(parsed.path.startswith(prefix))
            for image in route.get("gallery", []):
                parsed = urlsplit(image["url"])
                self.assertEqual(parsed.scheme, "https")
                self.assertEqual(parsed.hostname, "upload.wikimedia.org")
                self.assertTrue(parsed.path.startswith("/wikipedia/commons/"))

    def test_csp_referrer_and_no_inline_handlers(self):
        html = (ROOT / "index.html").read_text()
        self.assertIn("Content-Security-Policy", html)
        self.assertIn("script-src 'self'", html)
        self.assertIn("object-src 'none'", html)
        self.assertNotIn("'unsafe-inline'", html)
        self.assertIn('name="referrer" content="strict-origin-when-cross-origin"', html)
        source = "\n".join(path.read_text() for path in [ROOT / "index.html", ROOT / "app.js", *sorted((ROOT / "js").glob("*.js"))])
        self.assertIsNone(re.search(r"\s(?:on(?:click|error|load)|style)\s*=\s*[\"']", source, re.I))
        self.assertNotIn("javascript:", source.lower())

    def test_source_labels_are_not_rendered(self):
        visible_source = "\n".join(path.read_text() for path in [ROOT / "index.html", ROOT / "app.js", ROOT / "style.css", *sorted((ROOT / "js").glob("*.js"))])
        self.assertNotRegex(visible_source, r"(?i)wikimedia commons|quellen?:|lizenz")


if __name__ == "__main__":
    unittest.main()