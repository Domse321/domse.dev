#!/usr/bin/env python3
"""Validate E-Bike route data, total distances, and full-loop navigation links."""
from __future__ import annotations

import json
import math
import pathlib
import sys
from urllib.parse import parse_qs, urlparse

ROOT = pathlib.Path(__file__).resolve().parent
ROUTES = json.loads((ROOT / "routes.json").read_text(encoding="utf-8"))["routes"]


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * 6371.0088 * math.asin(math.sqrt(h))


def track_points(route: dict) -> list[tuple[float, float]]:
    track_file = route.get("track_geojson_file")
    if not track_file:
        raise AssertionError(f"{route['id']}: missing track_geojson_file")
    geojson = json.loads((ROOT / track_file).read_text(encoding="utf-8"))
    coords = geojson["features"][0]["geometry"]["coordinates"]
    return [(float(lat), float(lon)) for lon, lat, *_rest in coords]


def track_distance_km(route: dict) -> float:
    points = track_points(route)
    return sum(haversine_km(points[i - 1], points[i]) for i in range(1, len(points)))


def planner_coords(route: dict) -> list[tuple[float, float]]:
    fragment = urlparse(route.get("planner_link", "")).fragment
    lonlats = parse_qs(fragment).get("lonlats", [""])[0]
    coords: list[tuple[float, float]] = []
    for pair in lonlats.split(";"):
        if not pair:
            continue
        lon, lat = pair.split(",", 1)
        coords.append((float(lat), float(lon)))
    return coords


def nav_coords(route: dict) -> tuple[tuple[float, float], tuple[float, float], list[tuple[float, float]]]:
    query = parse_qs(urlparse(route.get("navigation_link", "")).query)
    def parse_pair(value: str) -> tuple[float, float]:
        lat, lon = value.split(",", 1)
        return (float(lat), float(lon))
    origin = parse_pair(query.get("origin", [""])[0])
    destination = parse_pair(query.get("destination", [""])[0])
    waypoints = [parse_pair(item) for item in query.get("waypoints", [""])[0].split("|") if item]
    return origin, destination, waypoints


def close(a: tuple[float, float], b: tuple[float, float], tolerance_km: float = 0.15) -> bool:
    return haversine_km(a, b) <= tolerance_km


def main() -> int:
    errors: list[str] = []
    for route in ROUTES:
        route_id = route["id"]
        distance = track_distance_km(route)
        listed = float(route.get("distance_km", 0))
        if abs(distance - listed) > 0.25:
            errors.append(f"{route_id}: listed {listed:.1f} km but track is {distance:.1f} km")
        points = track_points(route)
        if not close(points[0], points[-1], tolerance_km=0.35):
            errors.append(f"{route_id}: track is not closed enough for a round trip")
        planner = planner_coords(route)
        if len(planner) < 2:
            errors.append(f"{route_id}: planner link has no usable lonlats")
            continue
        origin, destination, waypoints = nav_coords(route)
        if not close(origin, planner[0]) or not close(destination, planner[-1]):
            errors.append(f"{route_id}: Google navigation does not use full planner loop origin/destination")
        if len(planner) > 2 and len(waypoints) < len(planner) - 2:
            errors.append(f"{route_id}: Google navigation misses loop waypoints")
        if "Gesamt" not in route.get("nav_label", ""):
            errors.append(f"{route_id}: nav_label does not clarify Gesamtstrecke")
        if "Gesamt" not in route.get("distance_note", ""):
            errors.append(f"{route_id}: distance_note does not clarify total distance")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"ok: {len(ROUTES)} routes have total-distance tracks and full-loop navigation links")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
