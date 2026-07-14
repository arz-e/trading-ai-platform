[graphify] MultiDiGraph edge-collapse diagnostic
input: <in-memory>
input_stage: provided JSON (normal graph.json is post-build)
effective_directed: <direct-call>
nodes: 489
raw_edges: 958
valid_candidate_edges: 899
missing_endpoint_edges: 0
dangling_endpoint_edges: 59
self_loop_edges: 0
exact_duplicate_edges: 0
directed_unique_endpoint_pairs: 898
directed_same_endpoint_collapsed_edges: 1
undirected_unique_endpoint_pairs: 898
undirected_same_endpoint_collapsed_edges: 1
same_endpoint_group_count: 1
relation_variant_groups: 1
source_file_variant_groups: 0
source_location_variant_groups: 0
context_variant_groups: 0
post_build_graph_type: Graph
post_build_edges: 898
producer_suppression_sites: 0
examples:
  - backend_services_watchlistservice -> backend_services_dbservice edges=2 relations=['imports_from', 're_exports'] locations=['L17', 'L4'] contexts=['export', 'import']
note: normal graph.json is post-build; raw producer loss must be measured earlier.