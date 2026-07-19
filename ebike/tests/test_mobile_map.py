import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class MobileMapContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (ROOT / "index.html").read_text(encoding="utf-8")
        cls.engine = (ROOT / "js/svgMapEngine.js").read_text(encoding="utf-8")
        cls.css = (ROOT / "style.css").read_text(encoding="utf-8")

    def test_leaflet_is_bundled_locally_and_loaded_before_map_engine(self):
        self.assertIn("vendor/leaflet/leaflet.css", self.html)
        self.assertIn("vendor/leaflet/leaflet.js", self.html)
        self.assertLess(self.html.index("vendor/leaflet/leaflet.js"), self.html.index("js/svgMapEngine.js"))
        self.assertTrue((ROOT / "vendor/leaflet/leaflet.js").is_file())
        self.assertTrue((ROOT / "vendor/leaflet/leaflet.css").is_file())

    def test_real_map_has_tiles_route_and_mobile_gestures(self):
        for token in (
            "L.map(",
            "tile.openstreetmap.org",
            "touchZoom: true",
            "dragging: true",
            "scrollWheelZoom: true",
            "L.polyline(",
            "fitBounds(",
            "data-map-ready",
            "data-map-zoom",
        ):
            self.assertIn(token, self.engine)

    def test_map_exposes_fit_and_fullscreen_controls(self):
        self.assertIn("btn-map-fit", self.engine)
        self.assertIn("btn-map-fullscreen", self.engine)
        self.assertIn("requestFullscreen", self.engine)
        self.assertIn("invalidateSize", self.engine)

    def test_map_has_mobile_size_and_visible_fallback_background(self):
        self.assertIn(".leaflet-map", self.css)
        self.assertIn("touch-action: none", self.css)
        self.assertIn(".route-map-actions", self.css)
        self.assertRegex(self.css, r"(?s)@media \(max-width: 768px\).*?\.route-map-actions\s*\{[^}]*top:\s*4\.75rem")
        self.assertRegex(self.css, r"(?s)@media \(max-width: 768px\).*?\.leaflet-top\s*\{[^}]*top:\s*4\.2rem")


if __name__ == "__main__":
    unittest.main()
