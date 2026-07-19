import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ProductInteractionContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = (ROOT / "app.js").read_text(encoding="utf-8")
        cls.css = (ROOT / "style.css").read_text(encoding="utf-8")

    def test_search_replacement_restores_focus_and_caret(self):
        self.assertIn("replacement.focus({ preventScroll: true })", self.app)
        self.assertIn("replacement.setSelectionRange(cursor, cursor)", self.app)

    def test_comparison_modal_has_one_close_path_and_scroll_lock(self):
        self.assertIn("function closeCompareModal()", self.app)
        self.assertIn("document.body.classList.add('modal-open')", self.app)
        self.assertIn("document.body.classList.remove('modal-open')", self.app)
        self.assertIn(".compare-open", self.app)
        self.assertIn("closeCompareModal", self.app)
        self.assertRegex(self.css, r"body\.modal-open\s*\{[^}]*overflow:\s*hidden")


if __name__ == "__main__":
    unittest.main()
