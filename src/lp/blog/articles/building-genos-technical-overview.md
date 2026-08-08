<!-- Generated from genos-docs/marketing/SHOW_HN.md. Run npm run blog:sync; do not edit this copy directly. -->

Solo developer here — I built this over the past year and would love honest
feedback.

The problem: every team I've worked on kept its discussions in Slack, docs in
Notion, and tasks in Jira. Answering "why are we doing this task?" meant
archaeology across all three. I tried connecting AI to the tools (MCP makes
that easy now), and it retrieved plenty but understood little — because the
relationships (this thread produced that task; this decision obsoleted that
doc) aren't stored anywhere. They only exist in people's heads. You can't
retrieve what was never written down.

So Genos inverts it: chat, tasks, and collaborative notes live in one
workspace and link to each other at creation time. The built-in AI answers
questions across them with links to its sources — it references the stored
relationships instead of inferring them from embeddings.

Stack: Django 5 + DRF, React 19 + Vite, Flask + Socket.IO for realtime,
Yjs/Hocuspocus for collaborative notes, OpenSearch hybrid search (BM25 +
vectors) with graph-based relational recall layered on top. The graph part
turned out to matter more than tuning the hybrid search — one or two hops of
explicit links beat similarity search for "why"-shaped questions.

Honest limitations: it's an MVP built by one person. The AI is decent but
still improving. Web-only. And it asks teams to move their chat/tasks/docs
into one tool, which is a big ask — that's the bet, and I understand the
skepticism.

The demo needs no signup: https://genosai.dev. Free plan, no credit card.

I'd especially value feedback on (1) whether the connected-context idea holds
up when you poke at the demo, and (2) what would realistically block a team
from adopting something like this. Happy to answer anything about the
architecture too.
