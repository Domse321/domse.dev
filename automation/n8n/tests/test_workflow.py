import json
import pathlib
import unittest
from urllib.parse import urlsplit

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / "ebike-research.workflow.json"

class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.workflow = json.loads(WORKFLOW.read_text(encoding="utf-8"))
        self.nodes = {n["name"]: n for n in self.workflow["nodes"]}

    def test_import_boundary_is_inactive_manual_and_no_webhook(self):
        self.assertIs(self.workflow["active"], False)
        self.assertEqual(self.nodes["Manual Trigger"]["type"], "n8n-nodes-base.manualTrigger")
        self.assertNotIn("n8n-nodes-base.webhook", {n["type"] for n in self.workflow["nodes"]})

    def test_weekly_schedule_is_sunday_0700_berlin(self):
        self.assertEqual(self.workflow["settings"]["timezone"], "Europe/Berlin")
        rule = self.nodes["Weekly Sunday 07:00"]["parameters"]["rule"]["interval"][0]
        self.assertEqual(rule, {"field":"weeks","weeksInterval":1,"triggerAtDay":[0],"triggerAtHour":7,"triggerAtMinute":0})

    def test_real_acquisition_nodes_use_only_approved_targets(self):
        http = [n for n in self.workflow["nodes"] if n["type"] == "n8n-nodes-base.httpRequest"]
        self.assertEqual(len(http), 2)
        self.assertEqual({n["name"] for n in http}, {"Search SearXNG Routes", "Search Wikimedia Commons Images"})
        self.assertIn("searxng.internal:8080", self.nodes["Create Search Jobs"]["parameters"]["jsCode"])
        self.assertIn("searxngBaseUrl", self.nodes["Search SearXNG Routes"]["parameters"]["url"])
        self.assertEqual(self.nodes["Search Wikimedia Commons Images"]["parameters"]["url"], "https://commons.wikimedia.org/w/api.php")
        for n in http:
            self.assertEqual(n["parameters"]["method"], "GET")
            self.assertEqual(n["typeVersion"], 4.4)
        searx_params = {p["name"]: p["value"] for p in self.nodes["Search SearXNG Routes"]["parameters"]["queryParameters"]["parameters"]}
        self.assertEqual(searx_params["engines"], "bing")
        batch = self.nodes["Search SearXNG Routes"]["parameters"]["options"]["batching"]["batch"]
        self.assertEqual(batch, {"batchSize": 1, "batchInterval": 2000})
        commons_options = self.nodes["Search Wikimedia Commons Images"]["parameters"]["options"]
        self.assertEqual(commons_options["batching"]["batch"], {"batchSize": 1, "batchInterval": 3000})
        self.assertTrue(commons_options["response"]["response"]["neverError"])
        self.assertEqual(commons_options["response"]["response"]["responseFormat"], "text")
        media_code = self.nodes["Attach Best Commons Image"]["parameters"]["jsCode"]
        self.assertIn("item.json.body ?? item.json.data ?? item.json", media_code)
        self.assertIn("JSON.parse(body)", media_code)
        self.assertIn("catch { body={}; }", media_code)

    def test_candidate_volume_is_bounded_before_image_requests(self):
        code = self.nodes["Dedupe and Score"]["parameters"]["jsCode"]
        self.assertIn(".slice(0,40)", code)
        region_code = self.nodes["Build Region Image Jobs"]["parameters"]["jsCode"]
        self.assertIn("seen.has(region)", region_code)
        self.assertIn(".slice(0,12)", region_code)
        self.assertIn("${region} Niedersachsen", region_code)
        commons_limit = next(
            p["value"] for p in self.nodes["Search Wikimedia Commons Images"]["parameters"]["queryParameters"]["parameters"]
            if p["name"] == "gsrlimit"
        )
        self.assertEqual(commons_limit, "1")

    def test_search_jobs_are_diverse_and_named_regions(self):
        code = self.nodes["Create Search Jobs"]["parameters"]["jsCode"]
        for region in ("Hameln","Weserbergland","Süntel","Deister","Ith","Hils","Ottensteiner Hochfläche","Emmerthal","Hessisch Oldendorf","Bad Pyrmont","Coppenbrügge"):
            self.assertIn(region, code)
        self.assertIn("E-MTB", code); self.assertIn("E-Bike", code)

    def test_normalizer_is_compatible_with_n8n_code_sandbox(self):
        code = self.nodes["Normalize SearXNG Results"]["parameters"]["jsCode"]
        self.assertNotIn("new URL(", code)
        self.assertIn("function parseHttpUrl", code)
        self.assertIn("parsedUrl.hostname", code)

    def test_data_table_is_upsert_not_placeholder(self):
        node = self.nodes["Upsert Review Data Table"]
        self.assertEqual(node["parameters"]["operation"], "upsert")
        self.assertEqual(node["parameters"]["dataTableId"], {"mode":"name","value":"ebike_route_research"})
        self.assertEqual(node["parameters"]["filters"]["conditions"][0]["keyName"], "stable_key")
        text = json.dumps(self.workflow).lower()
        self.assertNotIn("needs_review", text)
        self.assertIn("review_status:'offen'", text)

    def test_no_publish_write_or_credential_boundary(self):
        types = " ".join(n["type"].lower() for n in self.workflow["nodes"])
        for forbidden in ("webhook", "wordpress", "git", "ssh", "executecommand", "email", "ftp"):
            self.assertNotIn(forbidden, types)
        self.assertFalse(any("credentials" in n for n in self.workflow["nodes"]))
        self.assertIn("publish_performed:false", self.nodes["Final Run Summary"]["parameters"]["jsCode"])

    def test_graph_ends_at_summary_and_has_acquisition_before_persistence(self):
        expected = ["Create Search Jobs","Search SearXNG Routes","Normalize SearXNG Results","Dedupe and Score","Build Region Image Jobs","Search Wikimedia Commons Images","Attach Best Commons Image","Build Review Rows","Upsert Review Data Table","Final Run Summary"]
        for a,b in zip(expected, expected[1:]):
            self.assertEqual(self.workflow["connections"][a]["main"][0][0]["node"], b)
        self.assertNotIn("Final Run Summary", self.workflow["connections"])

    def test_offline_api_fixtures_have_real_response_shapes(self):
        searx = json.loads((ROOT/"fixtures/searxng-search.json").read_text())
        commons = json.loads((ROOT/"fixtures/wikimedia-commons.json").read_text())
        self.assertGreaterEqual(len(searx["results"]), 2)
        self.assertEqual(urlsplit(searx["results"][0]["url"]).scheme, "https")
        page = next(iter(commons["query"]["pages"].values()))
        info = page["imageinfo"][0]
        self.assertTrue(info["thumburl"].startswith("https://upload.wikimedia.org/"))
        self.assertIn("LicenseShortName", info["extmetadata"])

if __name__ == "__main__": unittest.main()
