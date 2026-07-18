#!/usr/bin/env python3
"""Cryptographically bind public tracks to reviewed source-track points."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import pathlib
import re
import xml.etree.ElementTree as ET
from datetime import datetime
from urllib.parse import urlsplit

ROOT=pathlib.Path(__file__).resolve().parents[1]
REQUIRED={"approval_id","route_id","source_track_file","source_track_sha256","public_start_index","public_end_index","public_start_coordinate","public_end_coordinate","point_source_url","point_source_label","reviewed_by","reviewed_at","output_gpx_sha256","output_geojson_sha256"}
ID=re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

def valid_hash(value): return isinstance(value,str) and re.fullmatch(r"[0-9a-f]{64}",value) is not None

def confined_file(root,value,prefix=None):
    if not isinstance(root,pathlib.Path): root=pathlib.Path(root)
    if not isinstance(value,str) or not value or "\\" in value or "%" in value: return None
    relative=pathlib.PurePosixPath(value)
    if relative.is_absolute() or any(part in {"",".",".."} for part in relative.parts): return None
    if prefix is not None and (not relative.parts or relative.parts[0]!=prefix): return None
    root=root.resolve(); candidate=(root/pathlib.Path(*relative.parts)).resolve()
    if not candidate.is_relative_to(root) or not candidate.is_file(): return None
    return candidate

def file_hash(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def gpx_coordinates(path):
    if path.stat().st_size>20*1024*1024: raise ValueError("GPX_TOO_LARGE")
    root=ET.parse(path).getroot(); points=[]
    for point in root.iter():
        if point.tag.rsplit('}',1)[-1] not in {'trkpt','rtept'}: continue
        lon=float(point.attrib['lon']); lat=float(point.attrib['lat'])
        if not math.isfinite(lon) or not math.isfinite(lat) or not (-180<=lon<=180 and -90<=lat<=90): raise ValueError("GPX_COORDINATE_INVALID")
        points.append([lon,lat])
    if len(points)<2: raise ValueError("GPX_POINT_COUNT")
    return points

def geojson_coordinates(path):
    if path.stat().st_size>20*1024*1024: raise ValueError("GEOJSON_TOO_LARGE")
    value=json.loads(path.read_text(encoding='utf-8'))
    geometry=value.get('geometry') if value.get('type')=='Feature' else value
    if not isinstance(geometry,dict) or geometry.get('type')!='LineString': raise ValueError("GEOJSON_GEOMETRY_INVALID")
    points=geometry.get('coordinates')
    if not isinstance(points,list) or len(points)<2: raise ValueError("GEOJSON_POINT_COUNT")
    result=[]
    for point in points:
        if not isinstance(point,list) or len(point)<2 or not all(isinstance(v,(int,float)) and math.isfinite(v) for v in point[:2]): raise ValueError("GEOJSON_COORDINATE_INVALID")
        result.append([point[0],point[1]])
    return result

def same_point(left,right,tolerance=1e-7):
    return len(left)==2 and len(right)==2 and all(abs(a-b)<=tolerance for a,b in zip(left,right))

def metadata_valid(approval):
    for key in ('approval_id','route_id','source_track_file','point_source_url','point_source_label','reviewed_by','reviewed_at'):
        if not isinstance(approval.get(key),str) or not approval[key].strip() or len(approval[key])>512: return False
    if not ID.fullmatch(approval['approval_id']) or not ID.fullmatch(approval['route_id']): return False
    parsed=urlsplit(approval['point_source_url'])
    if parsed.scheme!='https' or not parsed.hostname or parsed.username or parsed.password: return False
    try: reviewed=datetime.fromisoformat(approval['reviewed_at'].replace('Z','+00:00'))
    except ValueError: return False
    return reviewed.tzinfo is not None

def validate_approvals(document,*,catalog=None,asset_root=None,source_root=None):
    errors=[]
    if not isinstance(document,dict) or set(document)!={"schemaVersion","approvals"} or document.get("schemaVersion")!="1.0.0" or not isinstance(document.get("approvals"),list): return ["PUBLIC_TRACK_APPROVAL_INVALID"]
    if not document['approvals']:
        if isinstance(catalog,dict) and any(isinstance(route,dict) and route.get('status') in {'reviewed','ridden'} for route in catalog.get('routes',[])): return ["PUBLIC_TRACK_APPROVAL_UNBOUND"]
        return []
    if not isinstance(catalog,dict) or asset_root is None or source_root is None: return ["PUBLIC_TRACK_APPROVAL_CONTEXT_REQUIRED"]
    routes={route.get('id'):route for route in catalog.get('routes',[]) if isinstance(route,dict) and isinstance(route.get('id'),str)}
    seen_routes=set(); seen_approvals=set()
    for approval in document['approvals']:
        if not isinstance(approval,dict) or set(approval)!=REQUIRED or not metadata_valid(approval): errors.append("PUBLIC_TRACK_APPROVAL_INVALID"); continue
        route_id=approval['route_id']; approval_id=approval['approval_id']
        if route_id in seen_routes or approval_id in seen_approvals: errors.append("PUBLIC_TRACK_APPROVAL_DUPLICATE")
        seen_routes.add(route_id); seen_approvals.add(approval_id)
        if not all(valid_hash(approval[key]) for key in ("source_track_sha256","output_gpx_sha256","output_geojson_sha256")): errors.append("PUBLIC_TRACK_APPROVAL_INVALID"); continue
        start=approval['public_start_index']; end=approval['public_end_index']
        if not isinstance(start,int) or isinstance(start,bool) or not isinstance(end,int) or isinstance(end,bool) or start<0 or end<start: errors.append("PUBLIC_TRACK_APPROVAL_INVALID"); continue
        coordinates=(approval['public_start_coordinate'],approval['public_end_coordinate'])
        if any(not isinstance(point,list) or len(point)!=2 or not all(isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v) for v in point) for point in coordinates): errors.append("PUBLIC_TRACK_APPROVAL_INVALID"); continue
        route=routes.get(route_id)
        if route is None: errors.append("PUBLIC_TRACK_APPROVAL_ROUTE_UNKNOWN"); continue
        track=route.get('publicTrack')
        if route.get('status') not in {'reviewed','ridden'} or not isinstance(track,dict) or track.get('approvalId')!=approval_id: errors.append("PUBLIC_TRACK_APPROVAL_UNBOUND"); continue
        source=confined_file(pathlib.Path(source_root),approval['source_track_file'])
        if source is None: errors.append("PUBLIC_TRACK_SOURCE_PATH_INVALID"); continue
        gpx=confined_file(pathlib.Path(asset_root),track.get('gpxFile'),prefix='gpx')
        geojson=confined_file(pathlib.Path(asset_root),track.get('geojsonFile'),prefix='tracks')
        if gpx is None or geojson is None: errors.append("PUBLIC_TRACK_OUTPUT_PATH_INVALID"); continue
        if file_hash(source)!=approval['source_track_sha256']: errors.append("PUBLIC_TRACK_SOURCE_HASH_MISMATCH")
        if file_hash(gpx)!=approval['output_gpx_sha256'] or file_hash(geojson)!=approval['output_geojson_sha256']: errors.append("PUBLIC_TRACK_OUTPUT_HASH_MISMATCH")
        try:
            source_points=gpx_coordinates(source); gpx_points=gpx_coordinates(gpx); geojson_points=geojson_coordinates(geojson)
        except (ValueError,KeyError,TypeError,ET.ParseError,json.JSONDecodeError,UnicodeDecodeError): errors.append("PUBLIC_TRACK_ASSET_INVALID"); continue
        if end>=len(source_points) or not same_point(source_points[start],coordinates[0]) or not same_point(source_points[end],coordinates[1]): errors.append("PUBLIC_TRACK_COORDINATE_MISMATCH")
        if not same_point(gpx_points[0],coordinates[0]) or not same_point(gpx_points[-1],coordinates[1]) or not same_point(geojson_points[0],coordinates[0]) or not same_point(geojson_points[-1],coordinates[1]): errors.append("PUBLIC_TRACK_OUTPUT_COORDINATE_MISMATCH")
    for route in routes.values():
        if route.get('status') in {'reviewed','ridden'}:
            track=route.get('publicTrack'); approval_id=track.get('approvalId') if isinstance(track,dict) else None
            if approval_id not in seen_approvals: errors.append("PUBLIC_TRACK_APPROVAL_UNBOUND")
    return sorted(set(errors))

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('approval_file',type=pathlib.Path); parser.add_argument('--catalog',type=pathlib.Path,default=ROOT/'routes.json'); parser.add_argument('--asset-root',type=pathlib.Path,default=ROOT); parser.add_argument('--source-root',type=pathlib.Path)
    args=parser.parse_args(); document=json.loads(args.approval_file.read_text(encoding='utf-8')); catalog=json.loads(args.catalog.read_text(encoding='utf-8'))
    errors=validate_approvals(document,catalog=catalog,asset_root=args.asset_root,source_root=args.source_root)
    if errors: print('\n'.join(errors)); return 1
    print('ok: approval contract valid'); return 0

if __name__=='__main__': raise SystemExit(main())