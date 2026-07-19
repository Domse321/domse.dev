#!/usr/bin/env python3
"""Small static release validator for the domse.dev landing page."""
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
import sys

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"


class LandingParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.h1 = 0
        self.ids: set[str] = set()
        self.local_refs: list[str] = []
        self.empty_controls: list[str] = []
        self._control_stack: list[tuple[str, bool, dict[str, str]]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = {key: value or "" for key, value in attrs}
        if tag == "h1":
            self.h1 += 1
        if data.get("id"):
            self.ids.add(data["id"])
        if tag in {"a", "link", "script", "img"}:
            ref = data.get("href") or data.get("src")
            if ref and ref.startswith("/") and not ref.startswith("//"):
                self.local_refs.append(ref.split("?", 1)[0])
        if tag in {"a", "button"}:
            self._control_stack.append((tag, False, data))

    def handle_data(self, data: str) -> None:
        if self._control_stack and data.strip():
            tag, _, attrs = self._control_stack[-1]
            self._control_stack[-1] = (tag, True, attrs)

    def handle_endtag(self, tag: str) -> None:
        if tag not in {"a", "button"} or not self._control_stack:
            return
        control_tag, has_text, attrs = self._control_stack.pop()
        if control_tag != tag:
            return
        if not has_text and not attrs.get("aria-label"):
            self.empty_controls.append(str(attrs))


def main() -> int:
    parser = LandingParser()
    parser.feed(HTML.read_text(encoding="utf-8"))
    errors: list[str] = []
    if parser.h1 != 1:
        errors.append(f"expected exactly one h1, got {parser.h1}")
    if "main" not in parser.ids:
        errors.append("skip-link target #main is missing")
    if parser.empty_controls:
        errors.append(f"unlabelled controls: {parser.empty_controls}")
    for ref in sorted(set(parser.local_refs)):
        parsed = urlparse(ref)
        path = parsed.path
        candidate = ROOT / path.lstrip("/")
        if path.endswith("/"):
            candidate /= "index.html"
        if not candidate.exists():
            errors.append(f"missing local resource: {ref}")
    if errors:
        print("Landing validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"Landing validation passed: h1=1, ids={len(parser.ids)}, local_refs={len(set(parser.local_refs))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
