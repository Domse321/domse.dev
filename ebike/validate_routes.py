#!/usr/bin/env python3
"""Validate the public E-Bike catalog and cryptographic track approvals."""
from __future__ import annotations

import importlib.util
import json
import os
import pathlib
import sys

ROOT=pathlib.Path(__file__).resolve().parent
CATALOG_KEYS={"schemaVersion","generatedFrom","routes"}
ALLOWED_ROUTE_KEYS={"id","name","region","rideStyle","status","distanceKm","elevationM","durationMinutes","difficulty","surface","bestFor","season","highlights","riskNotes","score","trafficProfile","familyFriendly","source","presentation","publicTrack"}
PUBLIC_TRACK_KEYS={"gpxFile","geojsonFile","distanceKm","approvalId"}

def privacy_module():
    spec=importlib.util.spec_from_file_location('ebike_privacy_scan',ROOT/'tools'/'privacy_scan.py')
    assert spec is not None and spec.loader is not None
    module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module); return module

def confined_track(root,value,prefix):
    if not isinstance(value,str) or not value or "\\" in value or "%" in value: return None
    relative=pathlib.PurePosixPath(value)
    if relative.is_absolute() or not relative.parts or relative.parts[0]!=prefix or any(part in {'','.','..'} for part in relative.parts): return None
    root=root.resolve(); candidate=(root/pathlib.Path(*relative.parts)).resolve()
    if not candidate.is_relative_to(root) or not candidate.is_file(): return None
    return candidate

def validate(catalog: dict,approvals: dict|None=None,*,root: pathlib.Path=ROOT,source_root: pathlib.Path|None=None) -> list[str]:
    errors=[]
    if not isinstance(catalog,dict): return ["ROUTE_CATALOG_INVALID"]
    if set(catalog)!=CATALOG_KEYS: errors.append("ROUTE_CATALOG_UNKNOWN_FIELDS")
    routes=catalog.get("routes",[])
    if catalog.get("schemaVersion")!="1.0.0": errors.append("ROUTE_SCHEMA_VERSION")
    if not isinstance(routes,list) or len(routes)!=30 or len({route.get('id') for route in routes if isinstance(route,dict)})!=30: errors.append("ROUTE_INVENTORY_INVALID")
    if not isinstance(routes,list): return sorted(set(errors))
    for route in routes:
        if not isinstance(route,dict): errors.append("ROUTE_ENTRY_INVALID"); continue
        route_id=route.get("id","<missing>")
        extra=set(route)-ALLOWED_ROUTE_KEYS
        if extra: errors.append(f"{route_id}: ROUTE_UNKNOWN_FIELDS")
        if route.get("status")=="candidate":
            if route.get("publicTrack") is not None: errors.append(f"{route_id}: CANDIDATE_TRACK_EXPOSED")
            if route.get("presentation",{}).get("mode")!="track_only" or not route.get("presentation",{}).get("reason"): errors.append(f"{route_id}: CANDIDATE_PRESENTATION_INVALID")
        elif route.get("status") in {"reviewed","ridden"}:
            track=route.get("publicTrack")
            if not isinstance(track,dict): errors.append(f"{route_id}: PUBLIC_TRACK_REQUIRED"); continue
            if set(track)!=PUBLIC_TRACK_KEYS: errors.append(f"{route_id}: PUBLIC_TRACK_INCOMPLETE")
            for key,prefix in (("gpxFile","gpx"),("geojsonFile","tracks")):
                if confined_track(root,track.get(key),prefix) is None: errors.append(f"{route_id}: PUBLIC_TRACK_PATH_INVALID")
        else: errors.append(f"{route_id}: ROUTE_STATUS_INVALID")
    if approvals is None:
        approval_path=root/'config'/'public-route-approvals.json'
        approvals=json.loads(approval_path.read_text(encoding='utf-8')) if approval_path.is_file() else {"schemaVersion":"1.0.0","approvals":[]}
    binding_errors=privacy_module().validate_approvals(approvals,catalog=catalog,asset_root=root,source_root=source_root)
    errors.extend(binding_errors)
    return sorted(set(errors))

def main() -> int:
    catalog=json.loads((ROOT/"routes.json").read_text(encoding="utf-8"))
    source_root_value=os.environ.get('EBIKE_PRIVATE_SOURCE_ROOT'); source_root=pathlib.Path(source_root_value) if source_root_value else None
    errors=validate(catalog,root=ROOT,source_root=source_root)
    if errors: print("\n".join(errors),file=sys.stderr); return 1
    public=sum(route["publicTrack"] is not None for route in catalog["routes"])
    print(f"ok: 30 inventory routes; {public} public tracks; {30-public} fail-closed candidates")
    return 0

if __name__=="__main__": raise SystemExit(main())