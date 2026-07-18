#!/usr/bin/env python3
"""One-way, fail-closed migration of the legacy 0.5 catalog to public 1.0 candidates."""
from __future__ import annotations
import argparse
import json
import pathlib
import re

DROP_FIELDS={"waypoints","komoot_link","navigation_link","gpx_file","planner_link","track_geojson_file","gallery","photo_note","next_actions","nav_label","track_source","track_points","battery_model"}

def duration_minutes(value: str) -> list[int]:
    nums=[float(item.replace(",",".")) for item in re.findall(r"\d+(?:[.,]\d+)?",str(value))]
    if not nums: return [60,120]
    if len(nums)==1: nums=[nums[0],nums[0]]
    return [max(1,round(nums[0]*60)),max(1,round(nums[-1]*60))]

def surface_parts(value: str) -> list[str]:
    parts=[part.strip() for part in re.split(r"[,;]",str(value)) if part.strip()]
    return parts[:12] or ["nicht dokumentiert"]

def migrate(source: dict) -> tuple[dict,dict]:
    routes=[]
    for old in source.get("routes",[]):
        route={
            "id":old["id"],"name":old["name"],"region":old.get("region","Region Hameln"),
            "rideStyle":"tour" if old.get("ride_style")=="tour" else "mtb","status":"candidate",
            "distanceKm":float(old["distance_km"]),"elevationM":int(old["elevation_m"]),
            "durationMinutes":duration_minutes(old.get("duration","")),"difficulty":old.get("difficulty","nicht bewertet"),
            "surface":surface_parts(old.get("surface","")),"bestFor":old.get("best_for","Bestandsroute zur Prüfung"),
            "season":old.get("season","nicht bewertet"),"highlights":list(old.get("highlights",[]))[:20],
            "riskNotes":list(old.get("risk_notes",[]))[:20],"score":float(old.get("score",0)),
            "trafficProfile":old.get("traffic_profile","nicht bewertet"),"familyFriendly":bool(old.get("family_friendly",False)),
            "source":{"legacyStatus":str(old.get("status","unbekannt")),"migratedFrom":"0.5.0"},
            "presentation":{"mode":"track_only","reason":"Öffentlicher Track und Medien fehlen bis zur manuellen, quellenbelegten Freigabe."},
            "publicTrack":None,
        }
        routes.append(route)
    catalog={"schemaVersion":"1.0.0","generatedFrom":"0.5.0","routes":routes}
    report={"schemaVersion":"1.0.0","sourceRouteCount":len(source.get("routes",[])),"outputRouteCount":len(routes),"status":"candidate","publicTrackCount":0,"reason":"PUBLIC_TRACK_APPROVAL_MISSING","droppedFieldNames":sorted(DROP_FIELDS),"privateValuesRecorded":False}
    return catalog,report

def main() -> int:
    parser=argparse.ArgumentParser(); parser.add_argument("source",type=pathlib.Path); parser.add_argument("output",type=pathlib.Path); parser.add_argument("--report",type=pathlib.Path,required=True); args=parser.parse_args()
    source=json.loads(args.source.read_text(encoding="utf-8")); catalog,report=migrate(source)
    if len(catalog["routes"])!=30 or len({r["id"] for r in catalog["routes"]})!=30: raise SystemExit("MIGRATION_INVENTORY_INVALID")
    args.output.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("ok: 30 inventory routes migrated; 0 public tracks; all candidate")
    return 0
if __name__=="__main__": raise SystemExit(main())
