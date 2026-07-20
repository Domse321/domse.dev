#!/usr/bin/env python3
"""Validate and safely promote a repaired E-Bike catalog to a private routes.json.

The command is validation-only unless ``--apply`` is supplied. The destination has
no default and must be an explicit absolute path named ``routes.json``. Existing
content is backed up and verified before an atomic replacement is attempted.
Promotion is limited to galleries and explicitly named gallery-audit metadata.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import stat
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
AUDITOR_PATH = SCRIPT_DIR / "repair-ebike-commons.py"
_spec = importlib.util.spec_from_file_location("ebike_commons_audit", AUDITOR_PATH)
if _spec is None or _spec.loader is None:
    raise RuntimeError(f"cannot load validator: {AUDITOR_PATH}")
auditor = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(auditor)

# A plausible audit-looking key must not silently bypass this boundary.
GALLERY_AUDIT_TOP_LEVEL_FIELDS = frozenset({"gallery_audit", "gallery_audit_metadata"})
GALLERY_ROUTE_FIELDS = frozenset({"gallery", "photo_note"})


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_validated(path: Path) -> tuple[bytes, dict]:
    if path.is_symlink() or not path.is_file():
        raise ValueError(f"source must be a regular, non-symlink file: {path}")
    raw = path.read_bytes()
    try:
        catalog = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"source is not valid UTF-8 JSON: {exc}") from exc
    errors = auditor.validate_catalog(catalog)
    if errors:
        raise ValueError("source catalog failed validation:\n" + "\n".join(errors))
    return raw, catalog


def load_target(path: Path) -> tuple[bytes, dict]:
    if path.is_symlink() or not path.is_file():
        raise ValueError("promotion requires an existing regular, non-symlink target")
    raw = path.read_bytes()
    try:
        catalog = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"target is not valid UTF-8 JSON: {exc}") from exc
    if not isinstance(catalog, dict) or not isinstance(catalog.get("routes"), list):
        raise ValueError("target catalog must be an object with a routes array")
    return raw, catalog


def semantically_equal(left: object, right: object) -> bool:
    """Compare decoded JSON without treating booleans as numbers."""
    if type(left) is not type(right):
        return False
    if isinstance(left, dict) and isinstance(right, dict):
        return left.keys() == right.keys() and all(semantically_equal(left[key], right[key]) for key in left)
    if isinstance(left, list) and isinstance(right, list):
        return len(left) == len(right) and all(semantically_equal(a, b) for a, b in zip(left, right))
    return left == right


def validate_gallery_only_change(source: dict, target: dict) -> None:
    source_routes = source["routes"]
    target_routes = target["routes"]
    source_ids = [route.get("id") if isinstance(route, dict) else None for route in source_routes]
    target_ids = [route.get("id") if isinstance(route, dict) else None for route in target_routes]
    if source_ids != target_ids:
        raise ValueError("promotion rejected: route IDs and order must exactly match target")

    for route_id, source_route, target_route in zip(source_ids, source_routes, target_routes):
        source_non_gallery = {key: value for key, value in source_route.items() if key not in GALLERY_ROUTE_FIELDS}
        target_non_gallery = {key: value for key, value in target_route.items() if key not in GALLERY_ROUTE_FIELDS}
        if not semantically_equal(source_non_gallery, target_non_gallery):
            raise ValueError(f"promotion rejected: non-gallery data changed for route {route_id!r}")

    allowed = GALLERY_AUDIT_TOP_LEVEL_FIELDS | {"routes"}
    source_top = {key: value for key, value in source.items() if key not in allowed}
    target_top = {key: value for key, value in target.items() if key not in allowed}
    if not semantically_equal(source_top, target_top):
        raise ValueError("promotion rejected: non-gallery top-level data changed")


def fsync_directory(directory: Path) -> None:
    descriptor = os.open(directory, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def atomic_write(destination: Path, data: bytes, mode: int, *, refuse_existing: bool = False) -> None:
    fd, temporary_name = tempfile.mkstemp(prefix=f".{destination.name}.", suffix=".tmp", dir=destination.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, mode)
        if refuse_existing:
            # Hard-linking is an atomic no-clobber publish on the same filesystem.
            os.link(temporary, destination)
            temporary.unlink()
        else:
            os.replace(temporary, destination)
        fsync_directory(destination.parent)
    finally:
        temporary.unlink(missing_ok=True)


def promote(source: Path, target: Path, apply: bool = False) -> Path | None:
    if not target.is_absolute() or target.name != "routes.json":
        raise ValueError("--target must be an explicit absolute path named routes.json")
    if source.resolve() == target.resolve(strict=False):
        raise ValueError("source and target must differ")
    source_raw, source_catalog = load_validated(source)
    target_raw, target_catalog = load_target(target)
    validate_gallery_only_change(source_catalog, target_catalog)
    source_hash = digest(source_raw)
    print(f"validated source: {source} (sha256 {source_hash})")
    if not apply:
        print(f"dry-run: would back up and atomically promote to {target}")
        return None

    target_mode = stat.S_IMODE(target.stat().st_mode)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = target.with_name(f"{target.name}.backup-{stamp}-{digest(target_raw)[:12]}")
    atomic_write(backup, target_raw, target_mode, refuse_existing=True)
    if backup.read_bytes() != target_raw or digest(backup.read_bytes()) != digest(target_raw):
        raise RuntimeError("backup verification failed; target was not modified")
    if target.is_symlink() or target.read_bytes() != target_raw:
        raise RuntimeError("target changed while backup was created; refusing promotion")

    try:
        atomic_write(target, source_raw, target_mode)
        promoted_raw, promoted_catalog = load_validated(target)
        if digest(promoted_raw) != source_hash or promoted_raw != source_raw or promoted_catalog != source_catalog:
            raise RuntimeError("post-promotion byte/semantic verification failed")
    except Exception:
        atomic_write(target, target_raw, target_mode)
        if target.read_bytes() != target_raw:
            raise RuntimeError(f"promotion and rollback verification failed; backup is {backup}")
        raise

    print(f"backup verified: {backup}")
    print(f"promotion verified: {target} (sha256 {source_hash})")
    return backup


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path("ebike/data/runtime/routes.repaired.json"))
    parser.add_argument("--target", type=Path, required=True, help="explicit absolute private routes.json path")
    parser.add_argument("--apply", action="store_true", help="perform backup and atomic promotion; default is validation-only")
    args = parser.parse_args()
    try:
        promote(args.source, args.target, args.apply)
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
