import copy
import hashlib
import importlib.util
import json
import pathlib
import tempfile
import unittest

MODULE=pathlib.Path(__file__).resolve().parents[1]/'tools'/'privacy_scan.py'
SPEC=importlib.util.spec_from_file_location('ebike_privacy_scan',MODULE)
assert SPEC is not None and SPEC.loader is not None
privacy_scan=importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(privacy_scan)
validate_approvals=privacy_scan.validate_approvals

def sha256(path): return hashlib.sha256(path.read_bytes()).hexdigest()

class ApprovalTests(unittest.TestCase):
    def test_zero_public_tracks_is_valid(self):
        self.assertEqual(validate_approvals({'schemaVersion':'1.0.0','approvals':[]}),[])

    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); base=pathlib.Path(self.temp.name)
        self.asset_root=base/'ebike'; self.source_root=base/'private'
        (self.asset_root/'gpx').mkdir(parents=True); (self.asset_root/'tracks').mkdir(); self.source_root.mkdir()
        source_points=[(52.0,9.0),(52.1,9.1),(52.2,9.2)]
        public_points=source_points[1:]
        def gpx(points):
            body=''.join(f'<trkpt lat="{lat}" lon="{lon}" />' for lat,lon in points)
            return f'<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>{body}</trkseg></trk></gpx>'
        self.source=self.source_root/'source.gpx'; self.source.write_text(gpx(source_points),encoding='utf-8')
        self.gpx=self.asset_root/'gpx'/'route.gpx'; self.gpx.write_text(gpx(public_points),encoding='utf-8')
        self.geojson=self.asset_root/'tracks'/'route.geojson'; self.geojson.write_text(json.dumps({'type':'Feature','geometry':{'type':'LineString','coordinates':[[9.1,52.1],[9.2,52.2]]},'properties':{}}),encoding='utf-8')
        self.catalog={'routes':[{'id':'route-1','status':'reviewed','publicTrack':{'gpxFile':'gpx/route.gpx','geojsonFile':'tracks/route.geojson','distanceKm':1.0,'approvalId':'approval-route-1'}}]}
        self.approval={'approval_id':'approval-route-1','route_id':'route-1','source_track_file':'source.gpx','source_track_sha256':sha256(self.source),'public_start_index':1,'public_end_index':2,'public_start_coordinate':[9.1,52.1],'public_end_coordinate':[9.2,52.2],'point_source_url':'https://example.test/public-point-review','point_source_label':'Manual public-point review','reviewed_by':'QA Reviewer','reviewed_at':'2026-07-18T12:00:00Z','output_gpx_sha256':sha256(self.gpx),'output_geojson_sha256':sha256(self.geojson)}

    def tearDown(self): self.temp.cleanup()

    def validate(self,approval=None,catalog=None):
        document={'schemaVersion':'1.0.0','approvals':[approval or self.approval]}
        return validate_approvals(document,catalog=self.catalog if catalog is None else catalog,asset_root=self.asset_root,source_root=self.source_root)

    def test_approval_is_bound_to_route_files_hashes_and_source_coordinates(self):
        self.assertEqual(self.validate(),[])

    def test_unknown_route_and_unbound_approval_id_are_rejected(self):
        bad=copy.deepcopy(self.approval); bad['route_id']='nonexistent'
        self.assertIn('PUBLIC_TRACK_APPROVAL_ROUTE_UNKNOWN',self.validate(bad))
        catalog=copy.deepcopy(self.catalog); catalog['routes'][0]['publicTrack']['approvalId']='invented'
        self.assertIn('PUBLIC_TRACK_APPROVAL_UNBOUND',self.validate(catalog=catalog))

    def test_hash_coordinate_and_reviewer_tampering_are_rejected(self):
        mutations=[('output_gpx_sha256','a'*64,'PUBLIC_TRACK_OUTPUT_HASH_MISMATCH'),('source_track_sha256','b'*64,'PUBLIC_TRACK_SOURCE_HASH_MISMATCH'),('public_start_coordinate',[9.9,52.1],'PUBLIC_TRACK_COORDINATE_MISMATCH'),('reviewed_by',' ','PUBLIC_TRACK_APPROVAL_INVALID')]
        for field,value,code in mutations:
            with self.subTest(field=field):
                bad=copy.deepcopy(self.approval); bad[field]=value; self.assertIn(code,self.validate(bad))

    def test_source_file_cannot_escape_private_source_root(self):
        bad=copy.deepcopy(self.approval); bad['source_track_file']='/etc/passwd'
        self.assertIn('PUBLIC_TRACK_SOURCE_PATH_INVALID',self.validate(bad))