import json
import pathlib
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]

class SchemaTests(unittest.TestCase):
    def test_schema_matches_mapping_and_excludes_human_state(self):
        schema=json.loads((ROOT/'data-table.schema.json').read_text())
        workflow=json.loads((ROOT/'ebike-research.workflow.json').read_text())
        upsert=next(n for n in workflow['nodes'] if n['name']=='Upsert Machine Evidence V2')
        columns={c['name'] for c in schema['columns']}
        self.assertEqual(columns,set(upsert['parameters']['columns']['value']))
        self.assertEqual(schema['table'],'ebike_route_evidence_v2')
        self.assertTrue({'review_status','first_seen'}.isdisjoint(columns))

    def test_builder_is_byte_reproducible(self):
        before=(ROOT/'ebike-research.workflow.json').read_bytes()
        subprocess.run(['python3',str(ROOT/'build_workflow.py')],check=True,capture_output=True)
        self.assertEqual(before,(ROOT/'ebike-research.workflow.json').read_bytes())
        self.assertEqual(before,(ROOT/'ebike-candidate.workflow.json').read_bytes())

    def test_adversarial_fixtures_exist(self):
        for name in ('overpass-discovery.json','overpass-relation-geometry.json','commons-adversarial.json'):
            self.assertIsInstance(json.loads((ROOT/'fixtures'/name).read_text()),dict)

if __name__=='__main__': unittest.main()
