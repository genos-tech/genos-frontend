<!-- Generated from genos-docs/marketing/SHOW_HN.md. Run npm run blog:sync; do not edit this copy directly. -->

I built Genos, a web workspace that keeps chat, tasks, and collaborative notes
together and stores links between them.

Constraints first: it is a solo-built MVP, web-only, and adopting it means moving
work into another system. It does not reconstruct a complete project graph from
Slack, Notion, and Jira. The demo is useful for testing the interaction model,
not evidence that it has been validated across large organizations.

The retrieval problem I wanted to test was this: embeddings can find text about a
task, but not necessarily the discussion that created it or the task two
dependency edges downstream. Those facts may exist only as application
relationships.

In Genos, a thread can be linked to a task, tasks carry explicit dependency
edges, and notes live beside the work they describe. Genos AI searches across
those objects and streams an answer with clickable citations. The current
graph-expansion layer is deliberately narrow: it walks task-to-task dependency
edges, at most two hops by default. It does not yet traverse a general graph of
chats, notes, projects, and decisions.

The other boundary is writes. Read tools run immediately. A write pauses the
agent and renders the proposed task tree, bulk diff, or note body; approve or
reject happens in a separate request. Approval is currently all-or-nothing, and
there is no general transaction-level undo across every entity.

Stack: Django 5 + DRF, React 19 + Vite, Flask + Socket.IO, Yjs/Hocuspocus, and
OpenSearch hybrid retrieval (BM25 + vectors) with bounded dependency expansion.

No-login demo: https://genosai.dev. There is a free plan and no card is required.

I would value criticism on two points: is storing relationships at write time
worth the migration cost, and is a complete preview plus one approval an
adequate boundary for batch writes?
