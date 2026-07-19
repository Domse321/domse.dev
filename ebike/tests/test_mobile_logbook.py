import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class MobileLogbookLayoutTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.css = (ROOT / "style.css").read_text(encoding="utf-8")

    def test_collapsed_log_grid_can_shrink_below_select_intrinsic_width(self):
        self.assertRegex(
            self.css,
            r"(?s)@media \(max-width: 960px\).*?\.log-grid-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)",
        )

    def test_log_grid_children_and_controls_are_width_constrained(self):
        self.assertRegex(
            self.css,
            r"(?s)\.log-form-box,\s*\.log-history-column\s*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%",
        )
        self.assertRegex(
            self.css,
            r"(?s)\.log-entry-form\s+\.form-input,.*?\.log-entry-form\s+\.form-select,.*?\.log-entry-form\s+\.form-textarea\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0",
        )


if __name__ == "__main__":
    unittest.main()
