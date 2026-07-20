import copy
import json
import pathlib
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
WORKFLOW=ROOT/'ebike-research.workflow.json'
HARNESS=ROOT/'tests/code_node_harness.js'

def run_code(script, inputs, refs):
    payload={'script':str(ROOT/'js'/script),'inputs':inputs,'refs':refs}
    result=subprocess.run(['node',str(HARNESS)],input=json.dumps(payload),text=True,capture_output=True,check=True)
    return json.loads(result.stdout)

class WorkflowV2Tests(unittest.TestCase):
    def setUp(self):
        self.workflow=json.loads(WORKFLOW.read_text())
        self.nodes={n['name']:n for n in self.workflow['nodes']}

    def test_inactive_schedule_and_no_publish_boundary(self):
        self.assertFalse(self.workflow['active'])
        self.assertEqual(self.workflow['settings']['timezone'],'Europe/Berlin')
        rule=self.nodes['Weekly Sunday 07:00']['parameters']['rule']['interval'][0]
        self.assertEqual(rule,{'field':'weeks','weeksInterval':1,'triggerAtDay':[0],'triggerAtHour':7,'triggerAtMinute':0})
        types=' '.join(n['type'].lower() for n in self.workflow['nodes'])
        for forbidden in ('webhook','wordpress','ssh','executecommand','email','ftp'):
            self.assertNotIn(forbidden,types)
        self.assertIn('publish_performed:false',self.nodes['Final Quality Summary']['parameters']['jsCode'])

    def test_overpass_discovery_and_real_relation_geometry(self):
        discovery=self.nodes['Discover Named OSM Relations']
        geometry=self.nodes['Fetch Real Relation Geometry']
        self.assertEqual(discovery['parameters']['url'],'https://overpass-api.de/api/interpreter')
        self.assertEqual(geometry['parameters']['url'],'https://overpass-api.de/api/interpreter')
        for n in (discovery,geometry):
            self.assertEqual(n['parameters']['method'],'GET')
            self.assertTrue(n['parameters']['sendQuery'])
            query_params={p['name']:p['value'] for p in n['parameters']['queryParameters']['parameters']}
            self.assertEqual(set(query_params),{'data'})
            self.assertNotIn('sendBody',n['parameters'])
            headers={p['name']:p['value'] for p in n['parameters']['headerParameters']['parameters']}
            self.assertEqual(headers['Accept-Encoding'],'identity')
        query=self.nodes['Build Overpass Discovery']['parameters']['jsCode']
        self.assertIn('["route"~"^(bicycle|mtb)$"]["name"]',query)
        self.assertIn('out tags center',query)
        geometry_jobs=self.nodes['Build Relation Geometry Jobs']['parameters']['jsCode']
        self.assertIn('relation(id:',geometry_jobs)
        self.assertIn('out geom',geometry_jobs)
        self.assertNotIn('out tags geom',geometry_jobs)
        self.assertIn('offset+=20',geometry_jobs)
        self.assertNotIn('relation(${Number(item.json.relation_id)',geometry_jobs)
        for n in (discovery,geometry):
            self.assertTrue(n['retryOnFail']); self.assertEqual(n['maxTries'],4)
            self.assertEqual(n['waitBetweenTries'],30000)
            self.assertEqual(n['onError'],'continueRegularOutput')
            response=n['parameters']['options']['response']['response']
            self.assertFalse(response['neverError']); self.assertTrue(response['fullResponse'])
            self.assertEqual(response['responseFormat'],'json')

    def test_empty_and_all_rejected_paths_always_reach_summary_without_sentinel_upsert(self):
        empty=run_code('normalize-discovery.js',[{'json':{'statusCode':200,'body':{'elements':[]}}}],
                       {'Build Overpass Discovery':[{'json':{'run_id':'empty','observed_at':'2026-07-20T07:00:00Z'}}]})
        self.assertEqual(empty[0]['json']['pipeline_signal'],'DISCOVERY_EMPTY_OR_FAILED')
        self.assertNotIn('stable_key',empty[0]['json'])
        self.assertNotIn('relation_id',empty[0]['json'])
        body=json.loads((ROOT/'fixtures/overpass-relation-geometry.json').read_text())
        bad=copy.deepcopy(body); bad['elements'][0]['members'][0]['geometry']=bad['elements'][0]['members'][0]['geometry'][:5]
        job={'json':{'relation_id':101,'route_name':'bad','route_tag':'mtb','stable_key':'osm_relation_101','run_id':'reject'}}
        rejected=run_code('gate-score-limit.js',[{'json':bad}],{'Normalize Relation Discovery':[job]})
        self.assertEqual(rejected[0]['json']['pipeline_signal'],'ALL_CANDIDATES_REJECTED')
        self.assertEqual(rejected[0]['json']['gate_rejected_count'],1)
        summary=run_code('summary.js',rejected,{'Gate Score and Fair Limit':rejected})[0]['json']
        self.assertEqual(summary['accepted_and_upserted'],0)
        self.assertEqual(summary['status'],'no_data')
        con=self.workflow['connections']
        self.assertEqual(con['Discovery Has Candidates']['main'][1][0]['node'],'Final Quality Summary')
        self.assertEqual(con['Gate Has Accepted Candidates']['main'][1][0]['node'],'Final Quality Summary')
        self.assertEqual(con['Discovery Has Candidates']['main'][0][0]['node'],'Build Relation Geometry Jobs')
        self.assertEqual(con['Gate Has Accepted Candidates']['main'][0][0]['node'],'Build Track-near Image Jobs')

    def test_discovery_is_ranked_for_subject_and_region_before_cap(self):
        elements=[{'type':'relation','id':i,'center':{'lat':51.71,'lon':8.46},'tags':{'route':'bicycle','name':f'Generic {i}'}} for i in range(1,252)]
        elements.append({'type':'relation','id':999999,'center':{'lat':52.20,'lon':9.40},'tags':{'route':'mtb','name':'Süntel MTB Runde','network':'lcn','distance':'32 km','roundtrip':'yes'}})
        out=run_code('normalize-discovery.js',[{'json':{'statusCode':200,'body':{'elements':elements}}}],
                     {'Build Overpass Discovery':[{'json':{'run_id':'rank'}}]})
        ids=[x['json']['relation_id'] for x in out]
        self.assertEqual(len(ids),250)
        self.assertIn(999999,ids)
        self.assertEqual(ids[0],999999)
        self.assertGreater(out[0]['json']['discovery_rank_score'],0)

    def test_stable_osm_identity_gates_metrics_and_fairness(self):
        code=self.nodes['Gate Score and Fair Limit']['parameters']['jsCode']
        for marker in ('TOO_FEW_POINTS','OUTSIDE_SEARCH_BBOX','OUTSIDE_TARGET_REGIONS','DISTANCE_IMPLAUSIBLE','GEOMETRY_DISCONTINUITY','NOT_PLAUSIBLE_LOOP','GEOMETRY_RATIO_IMPLAUSIBLE','TAG_DISTANCE_CONFLICT'):
            self.assertIn(marker,code)
        for metric in ('closure_ratio','geometry_ratio','geometry_points','distance_km'):
            self.assertIn(metric,code)
        self.assertIn('osm_relation_',code); self.assertNotIn('fnv',code.lower())
        self.assertIn("n>=2",code); self.assertIn('out.length>=30',code)
        self.assertIn("?'E-MTB':'E-Bike/Trekking'",code)
        self.assertIn('evidence_json',code)

    def test_valid_geometry_executes_and_bad_geometries_fail_closed(self):
        body=json.loads((ROOT/'fixtures/overpass-relation-geometry.json').read_text())
        job={'json':{'relation_id':101,'route_name':'Süntel Test-Runde','route_tag':'mtb','stable_key':'osm_relation_101','discovery_http_status':200,'run_id':'x'}}
        inputs=[{'json':body,'pairedItem':{'item':0}}]
        out=run_code('gate-score-limit.js',inputs,{'Normalize Relation Discovery':[job]})
        self.assertEqual(len(out),1); row=out[0]['json']
        self.assertEqual(row['stable_key'],'osm_relation_101'); self.assertEqual(row['bike_type'],'E-MTB')
        self.assertGreaterEqual(row['geometry_points'],20); self.assertLessEqual(row['closure_ratio'],.12)
        self.assertGreaterEqual(row['evidence_score'],80)
        too_short=copy.deepcopy(body); too_short['elements'][0]['members'][0]['geometry']=too_short['elements'][0]['members'][0]['geometry'][:5]
        self.assertEqual(run_code('gate-score-limit.js',[{'json':too_short,'pairedItem':{'item':0}}],{'Normalize Relation Discovery':[job]})[0]['json']['pipeline_signal'],'ALL_CANDIDATES_REJECTED')
        outside=copy.deepcopy(body); outside['elements'][0]['members'][0]['geometry'][4]['lat']=53.0
        self.assertEqual(run_code('gate-score-limit.js',[{'json':outside,'pairedItem':{'item':0}}],{'Normalize Relation Discovery':[job]})[0]['json']['pipeline_signal'],'ALL_CANDIDATES_REJECTED')

    def test_commons_geosearch_multiple_real_raster_license_candidates(self):
        node=self.nodes['Commons Track-near Raster Search']; params={p['name']:p['value'] for p in node['parameters']['queryParameters']['parameters']}
        self.assertEqual(node['parameters']['options']['response']['response']['responseFormat'],'json')
        self.assertEqual(params['generator'],'geosearch'); self.assertEqual(params['ggslimit'],'10'); self.assertEqual(params['ggsradius'],'10000')
        self.assertEqual(params['prop'],'imageinfo|coordinates')
        code=self.nodes['Select Licensed Raster Photos']['parameters']['jsCode']
        for marker in ('BITMAP','image/jpeg','image/png','image/webp','public domain','image_creator','image_license_url','image_page_url','image_distance_km','image_anchor_fraction','image_relevance_score'):
            self.assertIn(marker,code)
        self.assertNotIn("'image/tiff'",code)
        for rejected_title in ('schild','informationstafel','luftbild','orthophoto','dop20'):
            self.assertIn(rejected_title,code)
        fixture=json.loads((ROOT/'fixtures/commons-adversarial.json').read_text())
        route={'json':{'relation_id':101,'centroid':{'lat':52.1,'lon':9.35}}}
        jobs=[{'json':{'relation_id':101,'image_anchor_lat':52.1,'image_anchor_lon':9.35}}]
        out=run_code('select-images.js',[{'json':fixture,'pairedItem':{'item':0}}],{'Gate Score and Fair Limit':[route],'Build Track-near Image Jobs':jobs})
        self.assertEqual(out[0]['json']['image_candidate_count'],1)
        self.assertEqual(out[0]['json']['image_title'],'File:Suentel forest trail.jpg')
        self.assertEqual(out[0]['json']['image_creator'],'Erika Beispiel')

        incomplete=copy.deepcopy(fixture)
        incomplete['query']['pages']['1']['imageinfo'][0]['extmetadata']['Artist']['value']=''
        out=run_code('select-images.js',[{'json':incomplete,'pairedItem':{'item':0}}],{'Gate Score and Fair Limit':[route],'Build Track-near Image Jobs':jobs})
        self.assertEqual(out[0]['json']['image_candidate_count'],0)

    def test_image_anchors_follow_cumulative_track_length_not_point_index(self):
        route={'relation_id':101,'centroid':{'lat':52.0,'lon':9.0},'geometry_json':json.dumps([
            {'lat':52.0,'lon':9.0},{'lat':52.0,'lon':9.001},{'lat':52.0,'lon':9.002},{'lat':52.0,'lon':9.100}
        ])}
        out=run_code('build-image-jobs.js',[{'json':route}],{})
        self.assertEqual(len(out),3)
        self.assertGreater(out[0]['json']['image_anchor_lon'],9.015)
        self.assertAlmostEqual(out[1]['json']['image_anchor_lon'],9.05,delta=.005)

    def test_review_fields_never_written_and_summary_has_quality_metrics(self):
        upsert=self.nodes['Upsert Machine Evidence V2']; self.assertEqual(upsert['parameters']['dataTableId']['value'],'ebike_route_evidence_v2')
        mapping=upsert['parameters']['columns']['value']
        self.assertNotIn('review_status',mapping); self.assertNotIn('first_seen',mapping)
        for field, expression in mapping.items():
            self.assertEqual(expression, f'={{{{ $json.{field} }}}}')
        self.assertEqual(upsert['parameters']['filters']['conditions'][0]['keyName'],'stable_key')
        summary=self.nodes['Final Quality Summary']['parameters']['jsCode']
        for metric in ('rejected_by_hard_gates','total_geometry_points','total_distance_km','average_evidence_score','partial_failure_rows'):
            self.assertIn(metric,summary)

if __name__=='__main__': unittest.main()
