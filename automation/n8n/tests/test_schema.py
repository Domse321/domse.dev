import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import validate_workflow as VALIDATOR

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

    def test_validator_rejects_schedule_and_gate_bypasses(self):
        source=json.loads((ROOT/'ebike-research.workflow.json').read_text())
        def errors_for(mutator):
            workflow=json.loads(json.dumps(source)); mutator(workflow)
            with tempfile.TemporaryDirectory() as directory:
                path=pathlib.Path(directory)/'workflow.json'; path.write_text(json.dumps(workflow))
                return VALIDATOR.validate(path)
        def no_op_gate(workflow):
            next(n for n in workflow['nodes'] if n['name']=='Allow First Sunday Only')['parameters']['jsCode']='return $input.all();'
        self.assertIn('FIRST_SUNDAY_GATE_INVALID',errors_for(no_op_gate))
        def schedule_bypass(workflow):
            workflow['connections']['Sunday 05:00 Monthly Check']={'main':[[{'node':'Build Overpass Discovery','type':'main','index':0}]]}
        self.assertIn('SCHEDULE_GATE_CONNECTION_INVALID',errors_for(schedule_bypass))
        def manual_through_gate(workflow):
            workflow['connections']['Manual Trigger']={'main':[[{'node':'Allow First Sunday Only','type':'main','index':0}]]}
        self.assertIn('MANUAL_BYPASS_CONNECTION_INVALID',errors_for(manual_through_gate))
        def add_schedule(workflow):
            schedule=json.loads(json.dumps(next(n for n in workflow['nodes'] if n['type']=='n8n-nodes-base.scheduleTrigger')))
            schedule['id']='extra-schedule'; schedule['name']='Extra Schedule'; workflow['nodes'].append(schedule)
        self.assertIn('EXACTLY_ONE_SCHEDULE_REQUIRED',errors_for(add_schedule))

if __name__=='__main__': unittest.main()
