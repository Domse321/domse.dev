#!/usr/bin/env python3
"""Repair and audit an E-Bike route catalog using authoritative Commons metadata.

The script never modifies tracks. It resolves every selected ``File:`` title through
MediaWiki, writes a repaired catalog and a machine-readable audit manifest. Runtime
inputs/outputs belong below the git-ignored ``ebike/data/`` tree.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "domse-ebike-gallery-audit/1.0 (https://domse.dev/)"
PHOTO_MIMES = {"image/jpeg", "image/webp", "image/tiff"}
MIN_WIDTH = 800
MIN_HEIGHT = 600
REQUIRED = ("url", "title", "artist", "license", "license_url", "commons_url", "mime", "width", "height")
GENERIC_LICENSES = {"", "wikimedia commons", "unknown", "unbekannt"}

# Deliberately reviewed, route-specific choices. Search rank is never used to select.
# Each title describes landscape, route environment or an actual waypoint/POI.
ROUTE_GALLERIES: dict[str, list[str]] = {
    "weser-emmerauen-kurz": [
        "Tündern an der Weser.jpg", "Windmühle Tündern von der Weser.jpg", "Tündern.jpg",
    ],
    "haemelschenburg-emmertal-ebike": [
        "Hämelschenburg Wassermühle Gesamtansicht flussabwärts mit Emmer.jpg",
        "Schafweide östlich der Emmer bei Schloss Hämelschenburg.jpg",
        "Schloss Hämelschenburg II.jpg",
    ],
    "grohnde-weser-genuss-ebike": [
        "Gierseilfähre Grohnde.jpg", "Grohnder Fähre an der Weser bei Grohnde (Emmerthal) IMG 5182.jpg",
        "Weserfähre in Grohnde (Emmerthal) IMG 5179.jpg",
    ],
    "bodenwerder-weser-radweg-ebike": [
        "Weser Bodenwerder.jpg", "Weser bei Hehlen.jpg", "Wasserschloss Hehlen an der Weser (2021).jpg",
    ],
    "fischbeck-hessisch-oldendorf-weser-ebike": [
        "Rittergut Stau P1660849.jpg", "Evangelische Stiftskirche Fischbeck fm811794.jpg",
        "Marienkirche Hessisch Oldendorf fm811823.jpg",
    ],
    "bad-pyrmont-kurpark-ebike": [
        "Kurpark Bad Pyrmont 1.jpg", "20241017-Bad Pyrmont Kurpark-01-Palaisgarten.jpg",
        "Fontaine im Kurpark, 1, Bad Pyrmont, Landkreis Hameln-Pyrmont.jpg",
    ],
    "coppenbruegge-salzhemmendorf-ebike": [
        "2020-07-23 112438 Salzhemmendorf Bergmannsweg.jpg", "2020-07-23 111005 Salzhemmendorf Bergmannsweg.jpg",
        "HA 140 Thüste und Wallensen.JPG",
    ],
    "rinteln-weserauen-ebike": [
        "Rinteln Weser from Hindenburgbrücke.jpg", "Doktorsee.jpg", "Großenwieden Weser.jpg",
    ],
    # Replace low-resolution historic scans and visibly repetitive same-subject
    # sets where stronger route variety exists.
    "suentel-hohenstein-genuss": [
        "Hess Oldendorf, HM - Pappmühle v S, Hohenstein Süntel 220724.jpg",
        "Hohenstein Süntel von unten.jpg", "Süntel, NSG Hohenstein 01.jpg",
    ],
    "ohrberg-weser-kluet-mix": [
        "Taschentuchbaum Ohrbergpark Hameln.jpg", "Taschentuchbaum Ohrbergpark Hameln Detail.jpg",
        "Ohrbergpark Ausflugsgaststätte.jpg",
    ],
    "ith-lauenstein-abenteuer": [
        "Blick vom Ith auf den Kahnstein.JPG", "Lauenstein Burg 9302266-Pano.jpg",
        "Knabenburg (Lauenstein) Front Picture.jpg", "Coppenbrügge Panorama von Süden.jpg",
    ],
    "bodenwerder-weserbergland-tag": [
        "Bodenwerder-Kemnade.jpg", "Bodenwerder.jpg", "Bodenwerder-Weser mit Schiff und Brücke.jpg",
        "Weser und Altstadtblick (Bodenwerder).jpg",
    ],
    "coppenbruegge-bisperode-ith-vorland": [
        "2020-07-23 121809 Coppenbrügge Gelbbach.jpg", "2020-07-23 124009 Coppenbrügge Steinbrinkstollen.jpg",
        "Coppenbrügge Panorama von Süden.jpg", "Coppenbruegge Burg.jpg",
    ],
    "lauenstein-ithwiesen-transfer": [
        "Knabenburg (Lauenstein) Front Picture.jpg", "Lauenstein Burg 9302266-Pano.jpg",
        "Blick vom Ith auf den Kahnstein.JPG",
    ],
    "fischbeck-weser-suentel-soft": [
        "B83 Fischbeck.JPG", "Evangelische Stiftskirche Fischbeck fm811789.jpg",
        "Fischbeck-Weser Rittergut Stau.JPG", "Süntel, NSG Hohenstein 01.jpg",
    ],
    "osterwald-lauenstein-hoehenzug": [
        "2023-03-24 - Panorama Osterwald - 5896-99.jpg",
        "2020-07-23 104610 Salzhemmendorf Osterwald Halde am Hohe-Warte-Stollen.jpg",
        "Bahnhof Osterwald 01.jpg", "2020-07-23 103841 Salzhemmendorf Osterwald Christuskirche.jpg",
    ],
}

TAG_RE = re.compile(r"<[^>]*>")
CC_LICENSE_RE = re.compile(r"^/(?:licenses/(?:by|by-sa)/(?:2\.0/de|3\.0(?:/de)?|4\.0)|publicdomain/zero/1\.0)(?:/|/deed\.[a-z]{2})?$")
COMMONS_LICENSE_PATHS = {"/wiki/Commons:Public_domain"}


def plain(value: str | None) -> str:
    """Turn Commons' small HTML attribution fragments into compact plain text."""
    value = html.unescape(TAG_RE.sub(" ", value or ""))
    return re.sub(r"\s+", " ", value).strip()


def filename_from_url(url: str) -> str:
    path = urllib.parse.unquote(urllib.parse.urlparse(url).path)
    parts = path.split("/")
    if "/thumb/" in path:
        return parts[6]
    return parts[-1]


def expected_hash(filename: str) -> tuple[str, str]:
    digest = hashlib.md5(filename.replace(" ", "_").encode("utf-8")).hexdigest()
    return digest[0], digest[:2]


def parsed_https_url(value: object, host: str) -> urllib.parse.ParseResult | None:
    """Parse an exact-host HTTPS URL without credentials, query or fragment."""
    if not isinstance(value, str) or len(value) > 4096:
        return None
    try:
        parsed = urllib.parse.urlparse(value)
        invalid_authority = parsed.port is not None or parsed.username or parsed.password
    except ValueError:
        return None
    if parsed.scheme != "https" or parsed.hostname != host or invalid_authority:
        return None
    if parsed.query or parsed.fragment:
        return None
    return parsed


def valid_image_url(url: object, title: object) -> bool:
    parsed = parsed_https_url(url, "upload.wikimedia.org")
    if parsed is None or not isinstance(title, str) or not title:
        return False
    decoded = urllib.parse.unquote(parsed.path)
    canonical = title.replace(" ", "_")
    regular = re.fullmatch(r"/wikipedia/commons/([0-9a-f])/([0-9a-f]{2})/([^/]+)", decoded)
    thumb = re.fullmatch(r"/wikipedia/commons/thumb/([0-9a-f])/([0-9a-f]{2})/([^/]+)/[^/]+", decoded)
    match = thumb or regular
    return bool(match and match.group(3) == canonical and match.group(1, 2) == expected_hash(title))


def valid_commons_url(url: object, title: object) -> bool:
    parsed = parsed_https_url(url, "commons.wikimedia.org")
    if parsed is None or not isinstance(title, str):
        return False
    prefix = "/wiki/File:"
    return parsed.path.startswith(prefix) and urllib.parse.unquote(parsed.path[len(prefix):]).replace("_", " ") == title.replace("_", " ")


def valid_license_url(url: object) -> bool:
    if not isinstance(url, str):
        return False
    try:
        parsed = urllib.parse.urlparse(url)
        invalid_authority = parsed.port is not None or parsed.username or parsed.password
    except ValueError:
        return False
    if parsed.scheme != "https" or invalid_authority or parsed.query or parsed.fragment:
        return False
    if parsed.hostname == "creativecommons.org":
        return bool(CC_LICENSE_RE.fullmatch(parsed.path))
    return parsed.hostname == "commons.wikimedia.org" and parsed.path in COMMONS_LICENSE_PATHS


def has_correct_hash_path(url: str, title: str) -> bool:
    return valid_image_url(url, title)


def request_json(params: dict[str, str], attempts: int = 5) -> dict:
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            if exc.code not in (429, 500, 502, 503, 504) or attempt == attempts - 1:
                raise
            retry_after = exc.headers.get("Retry-After") if exc.headers else None
            delay = float(retry_after) if retry_after and retry_after.isdigit() else 2 ** attempt
            time.sleep(min(30, delay))
    raise RuntimeError("unreachable")


def chunks(values: list[str], size: int = 40):
    for index in range(0, len(values), size):
        yield values[index:index + size]


def resolve_titles(titles: list[str]) -> dict[str, dict]:
    """Resolve names to canonical image URLs and rights metadata in API batches."""
    wanted = sorted(set(title.removeprefix("File:") for title in titles))
    resolved: dict[str, dict] = {}
    for batch in chunks(wanted):
        data = request_json({
            "action": "query", "format": "json", "formatversion": "2", "redirects": "1",
            "titles": "|".join("File:" + title for title in batch),
            "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": "1280",
        })
        aliases: dict[str, str] = {}
        for item in data.get("query", {}).get("normalized", []) + data.get("query", {}).get("redirects", []):
            aliases[item["to"].removeprefix("File:")] = item["from"].removeprefix("File:")
        for page in data.get("query", {}).get("pages", []):
            if page.get("missing") or not page.get("imageinfo"):
                continue
            canonical = page["title"].removeprefix("File:")
            info = page["imageinfo"][0]
            meta = info.get("extmetadata", {})
            def m(key: str) -> str:
                return str(meta.get(key, {}).get("value", ""))
            license_name = plain(m("LicenseShortName") or m("UsageTerms"))
            license_url = m("LicenseUrl").replace("http://", "https://", 1)
            if not license_url and license_name.lower() in {"public domain", "gemeinfrei"}:
                license_url = "https://commons.wikimedia.org/wiki/Commons:Public_domain"
            artist = plain(m("Artist") or m("Credit"))
            description_url = info.get("descriptionurl") or (
                "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(canonical.replace(" ", "_"), safe="()_,.-")
            )
            thumb = info.get("thumburl") or info["url"]
            record = {
                "url": thumb.replace("http://", "https://", 1),
                "title": canonical,
                "artist": artist,
                "license": license_name,
                "license_url": license_url,
                "commons_url": description_url.replace("http://", "https://", 1),
                "mime": info.get("mime", ""), "width": info.get("width", 0), "height": info.get("height", 0),
            }
            resolved[canonical] = record
            if canonical in aliases:
                resolved[aliases[canonical]] = record
        time.sleep(0.25)
    missing = sorted(set(wanted) - set(resolved))
    if missing:
        raise ValueError("Commons files not found: " + ", ".join(missing))
    return resolved


def selected_titles(catalog: dict) -> dict[str, list[str]]:
    selections = {}
    for route in catalog["routes"]:
        override = ROUTE_GALLERIES.get(route["id"])
        # Historic ``title`` values sometimes contain editorial labels rather than
        # the real Commons filename. The upload URL remains sufficient to recover it.
        selections[route["id"]] = override or [filename_from_url(image["url"]) for image in route.get("gallery", [])]
    return selections


def link_status(url: str, attempts: int = 4) -> dict:
    if not url:
        return {"ok": False, "status": 0, "error": "empty URL"}
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=25) as response:
                return {"ok": 200 <= response.status < 400, "status": response.status}
        except urllib.error.HTTPError as exc:
            if exc.code == 429 and attempt < attempts - 1:
                retry_after = exc.headers.get("Retry-After") if exc.headers else None
                delay = float(retry_after) if retry_after and retry_after.isdigit() else 2 ** attempt
                time.sleep(min(30, delay))
                continue
            return {"ok": False, "status": exc.code, "error": str(exc)[:240]}
        except Exception as exc:  # diagnostics belong in the manifest, not a traceback
            return {"ok": False, "status": getattr(exc, "code", 0), "error": str(exc)[:240]}
    return {"ok": False, "status": 429, "error": "rate limited after retries"}


def validate_catalog(catalog: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(catalog, dict) or not isinstance(catalog.get("routes"), list) or not catalog["routes"]:
        return ["catalog: routes must be a non-empty array"]
    for route in catalog["routes"]:
        if not isinstance(route, dict) or not isinstance(route.get("id"), str):
            errors.append("catalog: every route must be an object with a string id")
            continue
        gallery = route.get("gallery", [])
        if not isinstance(gallery, list) or not gallery:
            errors.append(f"{route.get('id')}: no images")
            continue
        seen = set()
        for index, image in enumerate(gallery):
            where = f"{route.get('id')}[{index}]"
            if not isinstance(image, dict):
                errors.append(f"{where}: image must be an object")
                continue
            missing = [key for key in REQUIRED if image.get(key) in (None, "")]
            if missing:
                errors.append(f"{where}: missing {', '.join(missing)}")
            if str(image.get("license", "")).lower() in GENERIC_LICENSES:
                errors.append(f"{where}: invalid license")
            if image.get("mime") not in PHOTO_MIMES:
                errors.append(f"{where}: non-photographic MIME {image.get('mime')}")
            dimensions_valid = all(type(image.get(key)) is int and image[key] > 0 for key in ("width", "height"))
            if not dimensions_valid:
                errors.append(f"{where}: width and height must be positive integers")
            elif image["width"] < MIN_WIDTH or image["height"] < MIN_HEIGHT:
                errors.append(f"{where}: resolution below {MIN_WIDTH}x{MIN_HEIGHT}")
            if not valid_image_url(image.get("url"), image.get("title")):
                errors.append(f"{where}: invalid image URL, filename or Commons hash path")
            if not valid_commons_url(image.get("commons_url"), image.get("title")):
                errors.append(f"{where}: invalid Commons file URL or filename")
            if not valid_license_url(image.get("license_url")):
                errors.append(f"{where}: invalid license URL")
            if image.get("commons_url") in seen:
                errors.append(f"{where}: duplicate within gallery")
            seen.add(image.get("commons_url"))
    return errors


def repair(catalog: dict, check_links: bool = False) -> tuple[dict, dict]:
    before_geometry = {r["id"]: (r.get("gpx_file"), r.get("track_geojson_file"), r.get("track_points"), r.get("waypoints")) for r in catalog["routes"]}
    selections = selected_titles(catalog)
    metadata = resolve_titles([title for titles in selections.values() for title in titles])
    output = copy.deepcopy(catalog)
    before_counts = {r["id"]: len(r.get("gallery", [])) for r in catalog["routes"]}
    for route in output["routes"]:
        route["gallery"] = [copy.deepcopy(metadata[title]) for title in selections[route["id"]]]
        if route.get("photo_note", "").startswith("Noch keine eigenen Fotos"):
            route["photo_note"] = "Kuratiertes Wikimedia-Commons-Material; sichtbare Lizenzangaben stehen direkt am Bild."
    after_geometry = {r["id"]: (r.get("gpx_file"), r.get("track_geojson_file"), r.get("track_points"), r.get("waypoints")) for r in output["routes"]}
    if before_geometry != after_geometry:
        raise AssertionError("track/waypoint geometry changed")
    errors = validate_catalog(output)
    if errors:
        raise ValueError("Repaired catalog failed audit:\n" + "\n".join(errors))
    urls = sorted({image[key] for route in output["routes"] for image in route["gallery"] for key in ("url", "license_url", "commons_url")})
    links = {}
    if check_links:
        # Deliberately sequential and paced: rate limits are diagnostics, not a
        # reason to hammer Commons or make the default audit flaky.
        for url in urls:
            links[url] = link_status(url)
            time.sleep(0.35)
    occurrences = defaultdict(list)
    for route in output["routes"]:
        for image in route["gallery"]:
            occurrences[image["commons_url"]].append(route["id"])
    manifest = {
        "schema_version": 1, "api": API, "route_count": len(output["routes"]),
        "coverage_before": sum(count > 0 for count in before_counts.values()),
        "coverage_after": sum(bool(r["gallery"]) for r in output["routes"]),
        "images_before": sum(before_counts.values()), "images_after": sum(len(r["gallery"]) for r in output["routes"]),
        "empty_routes_before": [route_id for route_id, count in before_counts.items() if not count],
        "empty_routes_after": [r["id"] for r in output["routes"] if not r["gallery"]],
        "cross_route_duplicates": {url: routes for url, routes in occurrences.items() if len(routes) > 1},
        "mime_counts": Counter(i["mime"] for r in output["routes"] for i in r["gallery"]),
        "link_check_performed": check_links, "link_checks": links,
        "link_failures": {url: result for url, result in links.items() if not result["ok"]},
        "validation_errors": [], "geometry_unchanged": True,
    }
    return output, manifest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=Path("ebike/data/runtime/routes.live.json"))
    parser.add_argument("--output", type=Path, default=Path("ebike/data/runtime/routes.repaired.json"))
    parser.add_argument("--manifest", type=Path, default=Path("ebike/data/runtime/commons-audit.json"))
    parser.add_argument("--check-links", action="store_true", help="rate-limited URL diagnostics (non-blocking by default)")
    parser.add_argument("--require-links", action="store_true", help="fail on link diagnostics (implies --check-links)")
    args = parser.parse_args()
    catalog = json.loads(args.input.read_text(encoding="utf-8"))
    repaired, manifest = repair(catalog, args.check_links or args.require_links)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(repaired, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"coverage {manifest['coverage_before']}/{manifest['route_count']} -> {manifest['coverage_after']}/{manifest['route_count']}")
    print(f"images {manifest['images_before']} -> {manifest['images_after']}; link failures {len(manifest['link_failures'])}")
    return 1 if args.require_links and manifest["link_failures"] else 0


if __name__ == "__main__":
    sys.exit(main())
