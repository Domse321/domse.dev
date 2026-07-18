#!/usr/bin/env python3
"""Offline candidate validation and deterministic review-package builder."""
from __future__ import annotations
import hashlib
import json
import math
import pathlib
import re
from datetime import datetime
from urllib.parse import urlsplit

ID=re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
def haversine(a,b):
    lat1,lon1=map(math.radians,(a[1],a[0])); lat2,lon2=map(math.radians,(b[1],b[0])); dlat=lat2-lat1; dlon=lon2-lon1
    return 2*6371.0088*math.asin(math.sqrt(math.sin(dlat/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2))
def validate(candidate,allowlist):
    errors=[]
    if candidate.get('schemaVersion')!='1.0.0': errors.append('CANDIDATE_SCHEMA_VERSION')
    source=candidate.get('source',{}); allowed={item['id']:item for item in allowlist.get('allowedSources',[])}
    if source.get('id') not in allowed: errors.append('SOURCE_NOT_ALLOWLISTED')
    if not all(source.get(key) for key in ('originalUrl','retrievedAt','author','license')): errors.append('SOURCE_PROVENANCE_REQUIRED')
    source_rule=allowed.get(source.get('id'))
    try:
        parsed=urlsplit(source.get('originalUrl',''))
        if source_rule:
            if source_rule.get('mode')=='manual':
                if parsed.scheme!='manual' or not parsed.netloc or parsed.username or parsed.password: errors.append('SOURCE_URL_NOT_ALLOWLISTED')
            elif parsed.scheme!='https' or parsed.hostname not in source_rule.get('hosts',[]) or parsed.username or parsed.password or parsed.port not in (None,443): errors.append('SOURCE_URL_NOT_ALLOWLISTED')
    except (TypeError,ValueError): errors.append('SOURCE_URL_NOT_ALLOWLISTED')
    try:
        retrieved=datetime.fromisoformat(source.get('retrievedAt','').replace('Z','+00:00'))
        if retrieved.tzinfo is None: raise ValueError
    except (TypeError,ValueError): errors.append('SOURCE_TIMESTAMP_INVALID')
    stable_id=candidate.get('candidate',{}).get('stableId','')
    if not ID.fullmatch(stable_id): errors.append('STABLE_ID_INVALID')
    coords=candidate.get('track',{}).get('coordinates',[])
    if not 2<=len(coords)<=100000: errors.append('TRACK_POINT_COUNT')
    for point in coords:
        if not isinstance(point,list) or len(point)<2 or not all(isinstance(v,(int,float)) and math.isfinite(v) for v in point[:2]) or not (-180<=point[0]<=180 and -90<=point[1]<=90): errors.append('TRACK_COORDINATE_INVALID'); break
    if len(coords)>=2:
        distance=sum(haversine(a,b) for a,b in zip(coords,coords[1:])); declared=candidate.get('track',{}).get('declaredDistanceKm')
        if not isinstance(declared,(int,float)) or abs(distance-declared)>max(.2,distance*.01): errors.append('TRACK_DISTANCE_MISMATCH')
        if candidate.get('track',{}).get('loop') and haversine(coords[0],coords[-1])>.2: errors.append('TRACK_LOOP_OPEN')
    for media in candidate.get('media',[]):
        required=('originalUrl','license','author','sha256','downloadAllowed')
        if any(key not in media for key in required): errors.append('MEDIA_PROVENANCE_REQUIRED'); continue
        if media['downloadAllowed'] and not (source.get('id') in allowlist.get('downloadOwnSourceIds',[]) or media['license'] in allowlist.get('compatibleImageLicenses',[])): errors.append('MEDIA_DOWNLOAD_LICENSE_DENIED')
        if not re.fullmatch(r'[0-9a-f]{64}',media['sha256']): errors.append('MEDIA_HASH_INVALID')
    return sorted(set(errors))
def fingerprint(candidate):
    payload=json.dumps(candidate,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode(); return hashlib.sha256(payload).hexdigest()
def duplicate_markers(candidate,existing):
    stable=candidate['candidate']['stableId']; image_hashes={m['sha256'] for m in candidate.get('media',[])}
    return {'stableId':any(item.get('stableId')==stable for item in existing),'imageHash':any(image_hashes.intersection(item.get('imageHashes',[])) for item in existing),'trackProximity':'manual_review'}
def build_package(candidate,allowlist,existing=()):
    errors=validate(candidate,allowlist); return {'schemaVersion':'1.0.0','status':'rejected' if errors else 'ready_for_manual_review','candidateId':candidate.get('candidate',{}).get('stableId'),'source':candidate.get('source'),'validation':{'errors':errors},'deduplication':duplicate_markers(candidate,existing),'contentSha256':fingerprint(candidate),'manualApprovalRequired':True}
def main():
    import argparse
    p=argparse.ArgumentParser(); p.add_argument('candidate',type=pathlib.Path); p.add_argument('--allowlist',type=pathlib.Path,required=True); args=p.parse_args()
    candidate=json.loads(args.candidate.read_text(encoding='utf-8')); allowlist=json.loads(args.allowlist.read_text(encoding='utf-8')); package=build_package(candidate,allowlist); print(json.dumps(package,ensure_ascii=False,sort_keys=True,indent=2)); return 0 if package['status']!='rejected' else 1
if __name__=='__main__': raise SystemExit(main())
