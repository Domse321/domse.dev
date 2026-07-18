import json
import importlib.util
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location('validate_routes',ROOT/'validate_routes.py')
assert SPEC is not None and SPEC.loader is not None
validate_routes=importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(validate_routes)

class RouteDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data=json.loads((ROOT/'routes.json').read_text(encoding='utf-8'))
    def test_inventory_has_exactly_30_unique_routes(self):
        routes=self.data['routes']; self.assertEqual(len(routes),30); self.assertEqual(len({r['id'] for r in routes}),30)
    def test_all_unapproved_routes_fail_closed(self):
        for route in self.data['routes']:
            self.assertEqual(route['status'],'candidate')
            self.assertIsNone(route['publicTrack'])
            for key in ('gpxFile','geojsonFile','navigationUrl','plannerUrl','waypoints','recommended'):
                self.assertNotIn(key,route)
            self.assertEqual(route['presentation']['mode'],'track_only')
            self.assertTrue(route['presentation']['reason'])
    def test_catalog_contains_no_remote_browser_media_or_private_home_record(self):
        self.assertNotIn('home',self.data)
        text=json.dumps(self.data,ensure_ascii=False).lower()
        self.assertNotIn('http://',text); self.assertNotIn('https://',text)
    def test_catalog_root_fields_are_strict(self):
        value=dict(self.data); value['unexpected']=True
        self.assertIn('ROUTE_CATALOG_UNKNOWN_FIELDS',validate_routes.validate(value))
    def test_public_track_assets_are_confined_to_expected_roots(self):
        value=json.loads(json.dumps(self.data)); route=value['routes'][0]; route['status']='reviewed'; route['publicTrack']={'gpxFile':'/etc/passwd','geojsonFile':'/etc/hosts','distanceKm':1.0,'approvalId':'approval-1'}
        errors=validate_routes.validate(value)
        self.assertTrue(any('PUBLIC_TRACK_PATH_INVALID' in error for error in errors),errors)
    def test_stale_summary_cannot_advertise_removed_tracks_or_live_services(self):
        summary=json.loads((ROOT/'ha-summary.json').read_text(encoding='utf-8')); text=json.dumps(summary).lower()
        for stale in ('gpx','open-meteo','satellite','wikimedia','weather_mud'):
            self.assertNotIn(stale,text)
    def test_low_height_desktop_has_a_compact_first_viewport_mode(self):
        css=(ROOT/'style.css').read_text(encoding='utf-8').replace(' ','')
        self.assertIn('@media(min-width:761px)and(max-height:700px)',css)
        compact=css.split('@media(min-width:761px)and(max-height:700px)',1)[1]
        self.assertIn('.hero{min-height:0',compact)
        self.assertIn('.workspace{',compact)

if __name__=='__main__': unittest.main()
