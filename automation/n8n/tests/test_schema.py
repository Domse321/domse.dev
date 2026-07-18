import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]

class SchemaTests(unittest.TestCase):
    def test_schema_matches_workflow_mapping_exactly(self):
        schema = json.loads((ROOT/"data-table.schema.json").read_text())
        workflow = json.loads((ROOT/"ebike-research.workflow.json").read_text())
        upsert = next(n for n in workflow["nodes"] if n["name"] == "Upsert Review Data Table")
        columns = {c["name"] for c in schema["columns"]}
        mapping = set(upsert["parameters"]["columns"]["value"])
        self.assertEqual(columns, mapping)
        self.assertEqual(len(columns), 20)
        self.assertEqual(schema["invariants"]["upsert_match"], ["stable_key"])
        self.assertFalse(schema["invariants"]["website_fields"])

    def test_builder_is_reproducible_and_legacy_export_is_not_dummy(self):
        canonical = json.loads((ROOT/"ebike-research.workflow.json").read_text())
        legacy = json.loads((ROOT/"ebike-candidate.workflow.json").read_text())
        self.assertEqual(canonical, legacy)
        self.assertEqual(len(canonical["nodes"]), 12)
        self.assertEqual(sum(n["type"] == "n8n-nodes-base.httpRequest" for n in canonical["nodes"]), 2)

if __name__ == "__main__": unittest.main()
