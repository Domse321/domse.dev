import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUNNER = ROOT / "scripts" / "ebike-mobile-release-gate.js"
RELEASE_GATE = ROOT / "scripts" / "validate-ebike-release.sh"


class MobileReleaseGateContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.runner = RUNNER.read_text(encoding="utf-8")
        cls.release_gate = RELEASE_GATE.read_text(encoding="utf-8")

    def test_required_portrait_widths_zoom_and_landscape_are_committed(self):
        for width in (320, 360, 390, 430):
            self.assertRegex(self.runner, rf"\bwidth:\s*{width}\b")
        self.assertIn("zoom: 1.25", self.runner)
        self.assertIn("zoom: 2", self.runner)
        self.assertRegex(self.runner, r"orientation:\s*['\"]landscape['\"]")

    def test_gate_uses_trusted_playwright_actions_only(self):
        self.assertIn(".click()", self.runner)
        self.assertIn(".press('Enter')", self.runner)
        self.assertIn(".press('Space')", self.runner)
        self.assertNotIn("force:", self.runner)
        self.assertNotIn("dispatchEvent", self.runner)
        self.assertNotRegex(self.runner, r"\.evaluate\([^)]*\.click\(")

    def test_geometry_reflow_inventory_and_runtime_evidence_are_asserted(self):
        required_tokens = (
            "MIN_TOUCH_TARGET",
            "horizontalOverflow",
            "overflowOffenders",
            "detailTitle",
            "inventory",
            "button",
            "form",
            "navigation",
            "console",
            "pageerror",
            "requestfailed",
            "httpErrors",
        )
        for token in required_tokens:
            self.assertIn(token, self.runner)

    def test_optional_public_skip_and_private_fail_closed_are_explicit(self):
        self.assertIn("REQUIRE_PRIVATE_EBIKE_DATA", self.runner)
        self.assertRegex(self.runner, r"SKIP:.*Playwright")
        self.assertRegex(self.runner, r"FAIL:.*Playwright")
        self.assertIn("ebike-mobile-release-gate.js", self.release_gate)

    def test_evidence_is_written_as_json(self):
        self.assertIn("EBIKE_MOBILE_EVIDENCE", self.runner)
        self.assertIn("JSON.stringify", self.runner)
        self.assertIn("matrix", self.runner)
        self.assertIn("summary", self.runner)

    def test_remote_collector_is_target_bound_and_reads_headers_from_a_protected_file(self):
        self.assertIn("EBIKE_BASE_URL", self.runner)
        self.assertIn("EBIKE_EXPECTED_HOST", self.runner)
        self.assertIn("EBIKE_HTTP_HEADERS_FILE", self.runner)
        self.assertIn("EBIKE_RELEASE_ID", self.runner)
        self.assertIn("bindTargetHeaders", self.runner)
        self.assertIn("CF-Access-Client-Id", self.runner)
        self.assertIn("CF-Access-Client-Secret", self.runner)
        self.assertNotIn("console.log(extraHTTPHeaders", self.runner)


if __name__ == "__main__":
    unittest.main()
