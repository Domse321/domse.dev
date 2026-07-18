import json
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
WORKFLOW=ROOT/'ebike-candidate.workflow.json'

class WorkflowTests(unittest.TestCase):
    def setUp(self): self.workflow=json.loads(WORKFLOW.read_text(encoding='utf-8'))
    def test_export_is_inactive_and_manual(self):
        self.assertFalse(self.workflow['active'])
        self.assertTrue(any(n['type']=='n8n-nodes-base.manualTrigger' for n in self.workflow['nodes']))
    def test_no_publish_git_mail_execute_or_credentials(self):
        text=json.dumps(self.workflow).lower()
        for forbidden in ('sendemail','gmail','git','executecommand','ssh','credential'):
            self.assertNotIn(forbidden,text)
    def test_graph_has_separate_geo_track_media_and_manual_review(self):
        names={n['name'] for n in self.workflow['nodes']}
        self.assertTrue({'Normalize Candidate','Validate Geo and POIs','Validate Track','Review Media License','Detect Duplicates','Build Review Package','Manual Approval Required'} <= names)
    def test_validation_stages_form_one_deterministic_package_chain(self):
        expected=[('Normalize Candidate','Validate Geo and POIs'),('Validate Geo and POIs','Validate Track'),('Validate Track','Review Media License'),('Review Media License','Detect Duplicates'),('Detect Duplicates','Build Review Package'),('Build Review Package','Manual Approval Required')]
        for source,target in expected:
            edges=self.workflow['connections'][source]['main'][0]
            self.assertEqual([edge['node'] for edge in edges],[target])

if __name__=='__main__': unittest.main()
