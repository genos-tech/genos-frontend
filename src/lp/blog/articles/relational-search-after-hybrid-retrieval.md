<!-- Generated from genos-docs/marketing/HN_GRAPHRAG_TECHNICAL_SUBMISSION.md. Run npm run blog:sync; do not edit this copy directly. -->

Scope first: this is a two-hop walk over explicit task-dependency rows after
hybrid search. It is not an LLM-generated knowledge graph, and the evaluation
below is one seeded relational case, not a benchmark.

The failure was simple:

The workspace contained three tasks:

```
framer-motion spike
    blocks → Build Hero
        blocks → Accessibility audit
```

The user asked:

> What is downstream of the framer-motion spike?

BM25 found the spike. Dense retrieval found the spike. Neither had a textual
reason to return the Accessibility audit.

The target task did not mention framer-motion, animation, or the spike. The fact
that made it relevant existed only in a `TaskDependency` row.

The retrieval index had flattened the workspace into chunks and embeddings. The
relationship had disappeared.

## Baseline: hybrid search was doing its job

The existing pipeline used:

1. BM25 over title/body fields;
2. dense kNN retrieval;
3. reciprocal-rank fusion;
4. chunk-to-entity grouping;
5. optional reranking and score adjustments.

This worked for topical questions. If a task or chat discussed a performance
budget, lexical and semantic retrieval could surface it.

But relational questions have a different shape:

- What does this task block?
- What is downstream of this decision?
- Which work depends on the spike?

The answer may be connected without being textually similar. Changing the
embedding model does not expose a relation the retrieval document does not
contain.

## The small GraphRAG layer

I added graph expansion as the last ranking stage:

```
BM25 + kNN
  → reciprocal-rank fusion
  → group chunks into entities
  → rerank / score adjustments
  → bounded dependency-graph walk
  → final result limit
```

The name “GraphRAG” overstates this implementation if read broadly. There is no
global community detection and no LLM-extracted graph. The graph is the
application's existing task-dependency table.

For each search:

1. Take a small number of top task results as graph seeds.
2. Walk `TaskDependency` edges in both directions for at most two hops.
3. Decay score by hop distance.
4. Fetch reachable tasks through an ACL-scoped path.
5. Inject unseen neighbors into the ranked result set with graph provenance.

With source score `s`, per-hop weight `w`, and hop number `h`, a neighbor receives:

```
graph_score = s × w^h
```

The current default weight is `0.9`: a direct neighbor gets `0.9s`; a two-hop
neighbor gets `0.81s`. If multiple paths reach the same task, the implementation
keeps the best score. This is a ranking heuristic, not a calibrated probability.

## Why the walk starts from lexical anchors

The dangerous version is “take the top vector hit and expand its neighborhood.”

Dense search always returns something. For a vague or nonsense query, its top hit
may be weak noise. Graph expansion can turn that one accidental match into five
confident-looking, mutually related results.

So a task currently seeds traversal only when it appeared in the BM25 lane. This
is a noise guard: `framer-motion spike` has a lexical anchor; arbitrary text does
not.

This has a known cost. A strong cross-lingual or purely semantic match cannot seed
the graph. I added a vector-score threshold as an experiment, but reciprocal-rank
fusion had flattened the score scale: rank-one noise and a genuine rank-one
cross-lingual hit looked identical after fusion. The threshold remains off until
raw vector similarity is carried through the pipeline.

The vector-only entry path remains disabled rather than turning every dense
nearest neighbor into a graph seed.

## Bounded cost and failure behavior

The walk is a frontier traversal with hard caps:

- maximum source tasks: 5;
- maximum hops: 2;
- maximum injected neighbors: 5;
- one dependency query per hop;
- one OpenSearch fetch for all selected neighbors.

The caps bound expansion work independently of total graph size. They do not prove
that the added queries are latency-free. Expansion is best-effort: if graph access
fails, search returns the hybrid results rather than failing the request.

It is also skipped for typeahead. A per-keystroke UI has a tighter latency budget
than an agent answering a relational question, so graph expansion runs only on the
AI-search path.

## ACLs need to survive the graph

A graph edge can leak existence.

If the user can see task A but not task B, returning “A blocks [private task]” is
already information. The graph walker may traverse live dependency rows, but every
neighbor is fetched through the same team and per-entity visibility filter used by
normal retrieval. An inaccessible target is never injected.

The agent also has a direct “get blockers” tool for explicit dependency questions,
and that tool applies permission checks per edge. Retrieval fusion and structured
lookup share the same rule: graph adjacency does not grant visibility.

## What the eval actually showed

I added separate cases for one-hop and two-hop relational recall.

The one-hop case required the task directly blocked by the spike. The two-hop case
required the downstream Accessibility audit.

At a one-hop maximum, the two-hop target had recall `0.0`. With two hops, it reached
`1.0` in that case, with no regressions among the cases in that comparison and one
additional bounded dependency query. This says that the configured traversal
reached that target. It does not estimate production answer quality or establish
that two hops is generally optimal.

There is also a deliberately failing cross-lingual graph-entry case. Keeping the
unsolved case visible is more useful than weakening it until the dashboard turns
green.

## Current limits

The implementation is intentionally incomplete:

- only task-to-task dependency edges participate;
- graph-injected neighbors bypass the optional reranker;
- two hops will miss longer chains;
- a newly created edge is visible immediately, but the target task's text is only
  as fresh as its search index;
- lexical seed gating blocks some valid semantic and cross-lingual entry points.

The next valuable step is not “more graph.” It is preserving raw dense similarity
through fusion so a vector-only seed can be admitted without also admitting noise.

## The broader lesson

Some apparent ranking failures are representation failures.

If the answer depends on `A blocks B`, `document X supersedes document Y`, or
`discussion Z created task A`, flattening everything to text discards the exact
fact the user is asking about.

Before tuning another embedding model, ask:

> Does the relationship exist anywhere the retriever can see?

If not, the fix may be to retrieve the relation—not to make text similarity work
harder.

This work is part of Genos, a workspace I built around connected chat, tasks, and
notes. The product demo is at https://genosai.dev, but the graph implementation and
its limitations are the point of this article.
