import copy
import json
import pathlib
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
WORKFLOW=ROOT/'ebike-research.workflow.json'
HARNESS=ROOT/'tests/code_node_harness.js'

def run_code(script, inputs, refs, now=None):
    payload={'script':str(ROOT/'js'/script),'inputs':inputs,'refs':refs}
    if now is not None: payload['now']=now
    result=subprocess.run(['node',str(HARNESS)],input=json.dumps(payload),text=True,capture_output=True,check=True)
    return json.loads(result.stdout)

def commons_item(body, item=0, status=200):
    return {'json':{'statusCode':status,'body':body},'pairedItem':{'item':item}}

class WorkflowV2Tests(unittest.TestCase):
    def setUp(self):
        self.workflow=json.loads(WORKFLOW.read_text())
        self.nodes={n['name']:n for n in self.workflow['nodes']}

    def test_first_sunday_monthly_schedule_and_no_publish_boundary(self):
        self.assertFalse(self.workflow['active'])
        self.assertEqual(self.workflow['settings']['timezone'],'Europe/Berlin')
        rule=self.nodes['Sunday 05:00 Monthly Check']['parameters']['rule']['interval'][0]
        self.assertEqual(rule,{'field':'weeks','weeksInterval':1,'triggerAtDay':[0],'triggerAtHour':5,'triggerAtMinute':0})
        gate=self.nodes['Allow First Sunday Only']['parameters']['jsCode']
        self.assertIn("setZone('Europe/Berlin')",gate)
        self.assertIn('weekday !== 7',gate)
        self.assertIn('day > 7',gate)
        connections=self.workflow['connections']
        self.assertEqual(connections['Sunday 05:00 Monthly Check']['main'][0][0]['node'],'Allow First Sunday Only')
        self.assertEqual(connections['Allow First Sunday Only']['main'][0][0]['node'],'Build Overpass Discovery')
        self.assertEqual(connections['Manual Trigger']['main'][0][0]['node'],'Build Overpass Discovery')
        self.assertIn('Require Licensed Route Image',self.nodes)
        self.assertIn('Image Gate Has Candidates',self.nodes)
        self.assertEqual(connections['Select Licensed Raster Photos']['main'][0][0]['node'],'Require Licensed Route Image')
        self.assertEqual(connections['Require Licensed Route Image']['main'][0][0]['node'],'Image Gate Has Candidates')
        self.assertEqual(connections['Image Gate Has Candidates']['main'][0][0]['node'],'Build Machine Evidence Rows')
        self.assertEqual(connections['Image Gate Has Candidates']['main'][1][0]['node'],'Final Quality Summary')
        scheduled=[{'json':{'scheduled':True}}]
        self.assertEqual(run_code('first-sunday-gate.js',scheduled,{}, {'weekday':7,'day':6}),scheduled)
        self.assertEqual(run_code('first-sunday-gate.js',scheduled,{}, {'weekday':7,'day':13}),[])
        self.assertEqual(run_code('first-sunday-gate.js',scheduled,{}, {'weekday':1,'day':1}),[])
        types=' '.join(n['type'].lower() for n in self.workflow['nodes'])
        for forbidden in ('webhook','wordpress','ssh','executecommand','email','ftp'):
            self.assertNotIn(forbidden,types)
        self.assertIn('publish_performed:false',self.nodes['Final Quality Summary']['parameters']['jsCode'])

    def test_overpass_discovery_and_real_relation_geometry(self):
        discovery=self.nodes['Discover Named OSM Relations']
        geometry=self.nodes['Fetch Real Relation Geometry']
        self.assertEqual(discovery['parameters']['url'],'https://overpass.kumi.systems/api/interpreter')
        self.assertEqual(geometry['parameters']['url'],'https://overpass.kumi.systems/api/interpreter')
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
            self.assertEqual(n['waitBetweenTries'],15000)
            self.assertEqual(n['parameters']['options']['timeout'],120000)
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
        self.assertEqual(len(ids),120)
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
        self.assertEqual(params['generator'],'geosearch'); self.assertEqual(params['ggslimit'],'50'); self.assertEqual(params['ggsradius'],'10000')
        self.assertEqual(params['prop'],'imageinfo|coordinates')
        self.assertIn('size',params['iiprop'])
        code=self.nodes['Select Licensed Raster Photos']['parameters']['jsCode']
        for marker in ('BITMAP','image/jpeg','image/png','image/webp','public domain','image_creator','image_license_url','image_page_url','image_distance_km','image_anchor_fraction','image_relevance_score'):
            self.assertIn(marker,code)
        self.assertNotIn("'image/tiff'",code)
        for rejected_title in ('schild','informationstafel','luftbild','orthophoto','dop20','kriegsgraber','friedhof','cemetery'):
            self.assertIn(rejected_title,code)
        fixture=json.loads((ROOT/'fixtures/commons-adversarial.json').read_text())
        route={'json':{'relation_id':101,'route_name':'Süntel Test-Runde','region':'Süntel','centroid':{'lat':52.1,'lon':9.35}}}
        jobs=[{'json':{'relation_id':101,'route_name':'Süntel Test-Runde','region':'Süntel','image_anchor_lat':52.1,'image_anchor_lon':9.35}}]
        out=run_code('select-images.js',[commons_item(fixture)],{'Gate Score and Fair Limit':[route],'Build Track-near Image Jobs':jobs})
        self.assertEqual(out[0]['json']['image_candidate_count'],1)
        self.assertEqual(out[0]['json']['image_title'],'File:Suentel forest trail.jpg')
        self.assertEqual(out[0]['json']['image_creator'],'Erika Beispiel')

        named_place=copy.deepcopy(fixture)
        named_place['query']['pages']['1']['title']='File:Süntel Hochfläche.jpg'
        named_place['query']['pages']['1']['imageinfo'][0]['extmetadata']['ImageDescription']={'value':''}
        named_place['query']['pages']['1']['imageinfo'][0]['extmetadata']['Categories']={'value':''}
        out=run_code('select-images.js',[commons_item(named_place)],{'Gate Score and Fair Limit':[route],'Build Track-near Image Jobs':jobs})
        self.assertEqual(out[0]['json']['image_candidate_count'],1)

        substring_only=copy.deepcopy(fixture)
        substring_only['query']['pages']['1']['title']='File:Harzburg Rathaus.jpg'
        substring_only['query']['pages']['1']['imageinfo'][0]['extmetadata']['ImageDescription']={'value':''}
        substring_only['query']['pages']['1']['imageinfo'][0]['extmetadata']['Categories']={'value':''}
        harz_route={'json':{'relation_id':202,'route_name':'Harz Runde','region':'Harz'}}
        harz_jobs=[{'json':{'relation_id':202,'route_name':'Harz Runde','region':'Harz','image_anchor_lat':52.1,'image_anchor_lon':9.35}}]
        out=run_code('select-images.js',[commons_item(substring_only)],{'Gate Score and Fair Limit':[harz_route],'Build Track-near Image Jobs':harz_jobs})
        self.assertEqual(out[0]['json']['image_candidate_count'],0)

        incomplete=copy.deepcopy(fixture)
        incomplete['query']['pages']['1']['imageinfo'][0]['extmetadata']['Artist']['value']=''
        out=run_code('select-images.js',[commons_item(incomplete)],{'Gate Score and Fair Limit':[route],'Build Track-near Image Jobs':jobs})
        self.assertEqual(out[0]['json']['image_candidate_count'],0)

        too_small=copy.deepcopy(fixture)
        too_small['query']['pages']['1']['imageinfo'][0]['width']=700
        out=run_code('select-images.js',[commons_item(too_small)],{'Gate Score and Fair Limit':[route],'Build Track-near Image Jobs':jobs})
        self.assertEqual(out[0]['json']['image_candidate_count'],0)

        for bad_title in ('File:Bushaltestelle Suentel.jpg','File:Suentel Wegekreuz.jpg','File:Suentel Landschaft 1957.jpg','File:Suentel Kriegsgräberstätte.jpg','File:LandschaftsschutzgebietNDS.jpg'):
            unsuitable=copy.deepcopy(fixture)
            unsuitable['query']['pages']['1']['title']=bad_title
            out=run_code('select-images.js',[commons_item(unsuitable)],{'Gate Score and Fair Limit':[route],'Build Track-near Image Jobs':jobs})
            self.assertEqual(out[0]['json']['image_candidate_count'],0,bad_title)

        portrait=copy.deepcopy(fixture)
        portrait['query']['pages']['1']['imageinfo'][0]['width']=1200
        portrait['query']['pages']['1']['imageinfo'][0]['height']=1600
        out=run_code('select-images.js',[commons_item(portrait)],{'Gate Score and Fair Limit':[route],'Build Track-near Image Jobs':jobs})
        self.assertEqual(out[0]['json']['image_candidate_count'],0)

        panorama=copy.deepcopy(fixture)
        panorama['query']['pages']['1']['imageinfo'][0]['width']=2400
        panorama['query']['pages']['1']['imageinfo'][0]['height']=1000
        out=run_code('select-images.js',[commons_item(panorama)],{'Gate Score and Fair Limit':[route],'Build Track-near Image Jobs':jobs})
        self.assertEqual(out[0]['json']['image_candidate_count'],0)

        for field,value in (
            ('thumburl','https://evil.example/photo.jpg'),
            ('descriptionurl','http://commons.wikimedia.org/wiki/File:Suentel_forest_trail.jpg'),
        ):
            unsafe_url=copy.deepcopy(fixture)
            unsafe_url['query']['pages']['1']['imageinfo'][0][field]=value
            out=run_code('select-images.js',[commons_item(unsafe_url)],{'Gate Score and Fair Limit':[route],'Build Track-near Image Jobs':jobs})
            self.assertEqual(out[0]['json']['image_candidate_count'],0)
        unsafe_license=copy.deepcopy(fixture)
        unsafe_license['query']['pages']['1']['imageinfo'][0]['extmetadata']['LicenseUrl']['value']='https://evil.example/license'
        out=run_code('select-images.js',[commons_item(unsafe_license)],{'Gate Score and Fair Limit':[route],'Build Track-near Image Jobs':jobs})
        self.assertEqual(out[0]['json']['image_candidate_count'],0)

        malformed_size=copy.deepcopy(fixture)
        malformed_size['query']['pages']['1']['imageinfo'][0]['width']='not-a-number'
        out=run_code('select-images.js',[commons_item(malformed_size)],{'Gate Score and Fair Limit':[route],'Build Track-near Image Jobs':jobs})
        self.assertEqual(out[0]['json']['image_candidate_count'],0)

        for bad_coord in ({'lat':'bad','lon':9.351},{'lat':95,'lon':9.351},{'lat':52.101,'lon':181}):
            malformed_coord=copy.deepcopy(fixture)
            malformed_coord['query']['pages']['1']['coordinates']=[bad_coord]
            out=run_code('select-images.js',[commons_item(malformed_coord)],{'Gate Score and Fair Limit':[route],'Build Track-near Image Jobs':jobs})
            self.assertEqual(out[0]['json']['image_candidate_count'],0)

    def test_primary_images_are_unique_across_distinct_routes(self):
        fixture=json.loads((ROOT/'fixtures/commons-adversarial.json').read_text())
        routes=[
            {'json':{'relation_id':101,'route_name':'Süntel Runde','region':'Süntel'}},
            {'json':{'relation_id':202,'route_name':'Süntel Höhenweg','region':'Süntel'}},
        ]
        jobs=[
            {'json':{'relation_id':101,'route_name':'Süntel Runde','region':'Süntel','image_anchor_lat':52.1,'image_anchor_lon':9.35,'image_anchor_fraction':.5}},
            {'json':{'relation_id':202,'route_name':'Süntel Höhenweg','region':'Süntel','image_anchor_lat':52.1,'image_anchor_lon':9.35,'image_anchor_fraction':.5}},
        ]
        inputs=[
            commons_item(copy.deepcopy(fixture),0),
            commons_item(copy.deepcopy(fixture),1),
        ]
        out=run_code('select-images.js',inputs,{'Gate Score and Fair Limit':routes,'Build Track-near Image Jobs':jobs})
        self.assertTrue(out[0]['json']['image_found'])
        self.assertFalse(out[1]['json']['image_found'])
        self.assertNotEqual(out[0]['json'].get('image_page_url'),out[1]['json'].get('image_page_url'))

    def test_primary_image_uniqueness_falls_back_beyond_top_three(self):
        pages={}
        for index,name in enumerate(('Alpha','Bravo','Charlie','Delta'),1):
            pages[str(index)]={
                'pageid':index,'title':f'File:Suentel forest trail {name}.jpg',
                'coordinates':[{'lat':52.101,'lon':9.351}],
                'imageinfo':[{'thumburl':f'https://upload.wikimedia.org/{name}.jpg',
                    'descriptionurl':f'https://commons.wikimedia.org/wiki/File:Suentel_forest_trail_{name}.jpg',
                    'mime':'image/jpeg','mediatype':'BITMAP','width':1600,'height':1000,
                    'extmetadata':{'Artist':{'value':'Erika Beispiel'},'LicenseShortName':{'value':'CC BY-SA 4.0'},
                        'LicenseUrl':{'value':'https://creativecommons.org/licenses/by-sa/4.0/'}}}]
            }
        fixture={'query':{'pages':pages}}
        routes=[{'json':{'relation_id':rid,'route_name':f'Süntel Runde {rid}','region':'Süntel'}} for rid in (101,202,303,404)]
        jobs=[{'json':{'relation_id':rid,'route_name':f'Süntel Runde {rid}','region':'Süntel','image_anchor_lat':52.1,'image_anchor_lon':9.35,'image_anchor_fraction':.5}} for rid in (101,202,303,404)]
        inputs=[commons_item(copy.deepcopy(fixture),index) for index in range(4)]
        out=run_code('select-images.js',inputs,{'Gate Score and Fair Limit':routes,'Build Track-near Image Jobs':jobs})
        primaries=[item['json'].get('image_page_url') for item in out]
        self.assertEqual(len(set(primaries)),4)
        self.assertTrue(primaries[3].endswith('_Delta.jpg'))

    def test_non_success_commons_bodies_never_produce_candidates(self):
        fixture=json.loads((ROOT/'fixtures/commons-adversarial.json').read_text())
        route={'json':{'relation_id':101,'route_name':'Süntel Runde','region':'Süntel'}}
        jobs=[{'json':{'relation_id':101,'route_name':'Süntel Runde','region':'Süntel','image_anchor_lat':52.1,'image_anchor_lon':9.35,'image_anchor_fraction':.5}}]
        for response,expected_status in (({'statusCode':503,'body':fixture},503),({'body':fixture},0)):
            selected=run_code('select-images.js',[{'json':response,'pairedItem':{'item':0}}],{'Gate Score and Fair Limit':[route],'Build Track-near Image Jobs':jobs})
            self.assertFalse(selected[0]['json']['image_found'])
            self.assertTrue(selected[0]['json']['image_partial_failure'])
            self.assertEqual(selected[0]['json']['commons_http_statuses'][0]['status'],expected_status)

    def test_mixed_commons_http_failures_are_preserved_as_partial_evidence(self):
        fixture=json.loads((ROOT/'fixtures/commons-adversarial.json').read_text())
        route={'json':{'relation_id':101,'route_name':'Süntel Runde','region':'Süntel','stable_key':'osm_relation_101','run_id':'mixed','discovery_http_status':200,'geometry_http_status':200}}
        jobs=[{'json':{'relation_id':101,'route_name':'Süntel Runde','region':'Süntel','image_anchor_lat':52.1,'image_anchor_lon':9.35,'image_anchor_fraction':fraction}} for fraction in (.2,.5,.8)]
        inputs=[
            {'json':{'statusCode':503,'body':{}},'pairedItem':{'item':0}},
            {'json':{'statusCode':200,'body':fixture},'pairedItem':{'item':1}},
            {'json':{'error':{'status':503}},'pairedItem':{'item':2}},
        ]
        selected=run_code('select-images.js',inputs,{'Gate Score and Fair Limit':[route],'Build Track-near Image Jobs':jobs})
        self.assertTrue(selected[0]['json']['image_found'])
        self.assertTrue(selected[0]['json']['image_partial_failure'])
        self.assertEqual([entry['status'] for entry in selected[0]['json']['commons_http_statuses']],[503,200,503])
        row=run_code('build-evidence-rows.js',selected,{})[0]['json']
        self.assertTrue(row['partial_failure'])
        statuses=json.loads(row['http_status_json'])
        self.assertEqual(statuses['commons'],[503,200,503])

    def test_image_anchors_follow_cumulative_track_length_not_point_index(self):
        route={'relation_id':101,'centroid':{'lat':52.0,'lon':9.0},'geometry_json':json.dumps([
            {'lat':52.0,'lon':9.0},{'lat':52.0,'lon':9.001},{'lat':52.0,'lon':9.002},{'lat':52.0,'lon':9.100}
        ])}
        out=run_code('build-image-jobs.js',[{'json':route}],{})
        self.assertEqual(len(out),5)
        self.assertIn('[0.1,0.3,0.5,0.7,0.9]',self.nodes['Build Track-near Image Jobs']['parameters']['jsCode'])
        self.assertIn('[0.1,0.3,0.5,0.7,0.9]',self.nodes['Select Licensed Raster Photos']['parameters']['jsCode'])
        self.assertGreater(out[0]['json']['image_anchor_lon'],9.005)
        self.assertAlmostEqual(out[2]['json']['image_anchor_lon'],9.05,delta=.005)

    def test_required_image_gate_allows_only_complete_licensed_images(self):
        good={'json':{'stable_key':'osm_relation_1','image_found':True,'image_title':'Waldweg','image_thumb_url':'https://upload.wikimedia.org/a.jpg','image_page_url':'https://commons.wikimedia.org/wiki/File:a.jpg','image_license':'CC BY-SA 4.0','image_license_url':'https://creativecommons.org/licenses/by-sa/4.0/','image_distance_km':9.9}}
        missing={'json':{'stable_key':'osm_relation_2','image_found':False,'image_title':'','image_thumb_url':'','image_page_url':'','image_license':'','image_license_url':''}}
        incomplete={'json':{'stable_key':'osm_relation_3','image_found':True,'image_title':'Wald','image_thumb_url':'https://upload.wikimedia.org/c.jpg','image_page_url':'https://commons.wikimedia.org/wiki/File:c.jpg','image_license':'CC BY-SA 4.0','image_license_url':''}}
        accepted=run_code('require-images.js',[good,missing,incomplete],{})
        self.assertEqual([item['json']['stable_key'] for item in accepted],['osm_relation_1'])
        signal=run_code('require-images.js',[missing,incomplete],{})
        self.assertEqual(len(signal),1)
        self.assertEqual(signal[0]['json']['pipeline_signal'],'NO_ROUTE_WITH_REQUIRED_IMAGE')
        self.assertEqual(signal[0]['json']['image_rejected_count'],2)
        self.assertNotIn('stable_key',signal[0]['json'])
        too_far=copy.deepcopy(good); too_far['json']['image_distance_km']=10.1
        self.assertEqual(run_code('require-images.js',[too_far],{})[0]['json']['pipeline_signal'],'NO_ROUTE_WITH_REQUIRED_IMAGE')

    def test_review_fields_never_written_and_summary_has_quality_metrics(self):
        upsert=self.nodes['Upsert Machine Evidence V2']; self.assertEqual(upsert['parameters']['dataTableId']['value'],'ebike_route_evidence_v2')
        mapping=upsert['parameters']['columns']['value']
        self.assertNotIn('review_status',mapping); self.assertNotIn('first_seen',mapping)
        for field, expression in mapping.items():
            self.assertEqual(expression, f'={{{{ $json.{field} }}}}')
        self.assertEqual(upsert['parameters']['filters']['conditions'][0]['keyName'],'stable_key')
        summary=self.nodes['Final Quality Summary']['parameters']['jsCode']
        for metric in ('rejected_by_hard_gates','rejected_without_required_image','total_geometry_points','total_distance_km','average_evidence_score','partial_failure_rows'):
            self.assertIn(metric,summary)

if __name__=='__main__': unittest.main()
