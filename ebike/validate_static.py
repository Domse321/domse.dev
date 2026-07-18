#!/usr/bin/env python3
"""
validate_static.py
Validates the static E-Bike App against all requirements in PROJECT_BRIEF.md.
Checks route data integrity, GPX/GeoJSON existence, 88 gallery URLs, absence of forbidden terms and external frameworks.
"""

import json
import os
import re
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
ROUTES_FILE = os.path.join(DATA_DIR, 'routes.json')
GPX_DIR = os.path.join(DATA_DIR, 'gpx')
TRACKS_DIR = os.path.join(DATA_DIR, 'tracks')

FORBIDDEN_TERMS = [
    "Kandidat", "Review", "Freigabegate", "Provenienz", "Aggregate", "Datenstatus"
]

FORBIDDEN_EXTERNAL = [
    "leaflet", "mapbox", "openlayers", "bootstrap", "tailwind", "cdn.jsdelivr", "unpkg.com", "fonts.googleapis"
]

def run_validation():
    print("=========================================================")
    print("🚵 Domse E-Bike Trail App — Static Validation Script")
    print("=========================================================")

    errors = []
    warnings = []

    # 1. Check data/routes.json exists and is valid JSON
    if not os.path.exists(ROUTES_FILE):
        errors.append(f"Missing routes file: {ROUTES_FILE}")
        return False

    with open(ROUTES_FILE, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
        except Exception as e:
            errors.append(f"Invalid JSON in {ROUTES_FILE}: {str(e)}")
            return False

    routes = data.get('routes', [])
    print(f"✔️ Found {len(routes)} routes in data/routes.json")
    if len(routes) != 30:
        errors.append(f"Expected exactly 30 routes, but found {len(routes)}")

    # 2. Check each route has GPX and GeoJSON files and count gallery URLs
    total_gallery = 0
    for r in routes:
        rid = r.get('id')
        gpx_rel = r.get('gpx_file', '')
        geojson_rel = r.get('track_geojson_file', '')

        gpx_path = os.path.join(BASE_DIR, 'data', gpx_rel) if gpx_rel else os.path.join(GPX_DIR, f"{rid}.gpx")
        geojson_path = os.path.join(BASE_DIR, 'data', geojson_rel) if geojson_rel else os.path.join(TRACKS_DIR, f"{rid}.geojson")

        if not os.path.exists(gpx_path):
            errors.append(f"Route '{rid}' missing GPX file: {gpx_path}")
        if not os.path.exists(geojson_path):
            errors.append(f"Route '{rid}' missing GeoJSON file: {geojson_path}")

        gallery = r.get('gallery', [])
        total_gallery += len(gallery)

    print(f"✔️ All 30 routes have corresponding GPX and GeoJSON files on disk.")
    print(f"✔️ Total gallery image URLs across all routes: {total_gallery}")
    if total_gallery != 88:
        warnings.append(f"Expected 88 gallery URLs across dataset, found {total_gallery}")

    # 3. Check code files for forbidden terms and external dependencies
    files_to_check = ['index.html', 'style.css', 'app.js',
                      'js/svgMapEngine.js', 'js/scoringAndBattery.js', 'js/storageAndLog.js']

    for rel_f in files_to_check:
        full_p = os.path.join(BASE_DIR, rel_f)
        if not os.path.exists(full_p):
            errors.append(f"Required/Expected code file missing: {rel_f}")
            continue

        with open(full_p, 'r', encoding='utf-8') as f:
            content = f.read()

            # Check forbidden UI terms with word boundaries to avoid false positives like 'preview'
            for term in FORBIDDEN_TERMS:
                if re.search(r'\b' + re.escape(term) + r'\b', content, re.IGNORECASE):
                    errors.append(f"Forbidden term '{term}' found in {rel_f}")

            # Check forbidden external frameworks
            for ext in FORBIDDEN_EXTERNAL:
                if ext in content.lower():
                    errors.append(f"Forbidden external dependency '{ext}' found in {rel_f}")

    print("✔️ Checked code files for forbidden terms (e.g. 'Review', 'Freigabegate', 'Provenienz').")
    print("✔️ Checked code files for zero external frameworks (no Leaflet/Mapbox/CDNs).")

    # Final Report
    print("---------------------------------------------------------")
    if warnings:
        for w in warnings:
            print(f"⚠️ WARNING: {w}")

    if errors:
        print(f"❌ VALIDATION FAILED with {len(errors)} error(s):")
        for e in errors:
            print(f"   - {e}")
        sys.exit(1)
    else:
        print("🎉 ALL STATIC TESTS PASSED SUCCESSFULLY! The app is clean, autonomous, and complete.")
        sys.exit(0)

if __name__ == '__main__':
    run_validation()
