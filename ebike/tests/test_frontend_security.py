import json
import re
import unittest
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]


class FrontendSecurityTests(unittest.TestCase):
    def test_csp_and_referrer_policy_are_restrictive(self):
        html = (ROOT / 'index.html').read_text(encoding='utf-8')
        self.assertIn('name="referrer" content="strict-origin-when-cross-origin"', html)
        match = re.search(r'http-equiv="Content-Security-Policy" content="([^"]+)"', html)
        self.assertIsNotNone(match)
        csp = match.group(1)
        self.assertNotIn('unsafe-inline', csp)
        self.assertNotIn('unsafe-eval', csp)
        for directive in ("default-src 'self'", "script-src 'self'", "style-src 'self'", "object-src 'none'", "base-uri 'none'"):
            self.assertIn(directive, csp)

    def test_no_inline_handlers_or_styles(self):
        for path in [ROOT / 'index.html', ROOT / 'app.js', *sorted((ROOT / 'js').glob('*.js'))]:
            source = path.read_text(encoding='utf-8')
            self.assertIsNone(re.search(r'\s(?:on\w+|style)\s*=\s*["\']', source, re.I), path)
            self.assertNotIn('.style.', source, path)

    def test_required_security_sinks_are_guarded(self):
        app = (ROOT / 'app.js').read_text(encoding='utf-8')
        self.assertIn("safeRouteId(encodedId.trim(), AppState.allRoutes.map", app)
        self.assertIn("h(entry.notes)", app)
        self.assertIn("safeExternalUrl(image.url, 'gallery')", app)
        self.assertNotRegex(app, r'Tour \\"\$\{routeId\}')

    @unittest.skipUnless((ROOT / 'data' / 'routes.json').is_file(), 'private runtime catalog not present in public checkout')
    def test_route_external_urls_match_the_runtime_allowlist(self):
        routes = json.loads((ROOT / 'data' / 'routes.json').read_text(encoding='utf-8'))['routes']
        rules = {
            'navigation_link': ('www.google.com', '/maps/'),
            'komoot_link': ('www.komoot.com', '/'),
            'planner_link': ('brouter.de', '/brouter-web/'),
        }
        for route in routes:
            for field, (host, prefix) in rules.items():
                value = route.get(field)
                if value:
                    parsed = urlparse(value)
                    self.assertEqual((parsed.scheme, parsed.hostname), ('https', host), (route['id'], field))
                    self.assertTrue(parsed.path.startswith(prefix), (route['id'], field))
            for image in route.get('gallery', []):
                parsed = urlparse(image['url'])
                self.assertEqual((parsed.scheme, parsed.hostname), ('https', 'upload.wikimedia.org'), route['id'])
                self.assertTrue(parsed.path.startswith('/wikipedia/commons/'), route['id'])


if __name__ == '__main__':
    unittest.main()
