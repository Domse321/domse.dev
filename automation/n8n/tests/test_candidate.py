import copy
import json
import pathlib
import sys
import unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from validate_candidate import build_package,validate
ROOT=pathlib.Path(__file__).resolve().parents[1]
class CandidateTests(unittest.TestCase):
    def setUp(self):
        self.candidate=json.loads((ROOT/'fixtures/manual-candidate.json').read_text()); self.allowlist=json.loads((ROOT/'config/allowlist.json').read_text())
    def test_dry_run_fixture_builds_deterministic_manual_review_package(self):
        first=build_package(self.candidate,self.allowlist); second=build_package(self.candidate,self.allowlist); self.assertEqual(first,second); self.assertEqual(first['status'],'ready_for_manual_review'); self.assertTrue(first['manualApprovalRequired'])
    def test_source_allowlist_and_provenance_fail_closed(self):
        value=copy.deepcopy(self.candidate); value['source']['id']='unknown'; self.assertIn('SOURCE_NOT_ALLOWLISTED',validate(value,self.allowlist)); del value['source']['author']; self.assertIn('SOURCE_PROVENANCE_REQUIRED',validate(value,self.allowlist))
    def test_source_url_must_match_allowlisted_scheme_and_host(self):
        value=copy.deepcopy(self.candidate); value['source']['originalUrl']='https://attacker.invalid/spoofed'; self.assertIn('SOURCE_URL_NOT_ALLOWLISTED',validate(value,self.allowlist))
        value['source']={'id':'openstreetmap','originalUrl':'https://www.openstreetmap.org/way/1','retrievedAt':'2026-07-18T12:00:00Z','author':'OpenStreetMap contributors','license':'ODbL-1.0'}; self.assertNotIn('SOURCE_URL_NOT_ALLOWLISTED',validate(value,self.allowlist))
        value['source']['originalUrl']='http://www.openstreetmap.org/way/1'; self.assertIn('SOURCE_URL_NOT_ALLOWLISTED',validate(value,self.allowlist))
    def test_track_distance_loop_and_coordinate_validation(self):
        for mutate,code in [(lambda c:c['track'].__setitem__('declaredDistanceKm',999),'TRACK_DISTANCE_MISMATCH'),(lambda c:c['track'].__setitem__('coordinates',[[9.3,52.1],[999,52.1]]),'TRACK_COORDINATE_INVALID'),(lambda c:c['track'].__setitem__('coordinates',[[9.3,52.1],[9.4,52.2]]),'TRACK_LOOP_OPEN')]:
            value=copy.deepcopy(self.candidate); mutate(value); self.assertIn(code,validate(value,self.allowlist))
    def test_deduplication_marks_but_never_merges(self):
        package=build_package(self.candidate,self.allowlist,[{'stableId':'fixture-weser-loop','imageHashes':[]}]); self.assertTrue(package['deduplication']['stableId']); self.assertEqual(package['candidateId'],'fixture-weser-loop')
    def test_media_download_requires_compatible_license_or_own_source(self):
        value=copy.deepcopy(self.candidate); value['source']['id']='openstreetmap'; value['media'][0]['license']='unknown'; self.assertIn('MEDIA_DOWNLOAD_LICENSE_DENIED',validate(value,self.allowlist))
if __name__=='__main__': unittest.main()
