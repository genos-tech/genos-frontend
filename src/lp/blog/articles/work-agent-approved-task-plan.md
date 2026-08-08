<!-- Generated from genos-docs/marketing/SHOW_HN_WORK_AGENT_UPDATE.md. Run npm run blog:sync; do not edit this copy directly. -->

I previously built Genos as a connected workspace for chat, tasks, and
collaborative notes. This update is the part I wanted that structure for: an agent
that can organize the work, not just answer questions about it.

Three concrete flows:

1. Give it a chat thread and ask for a plan. It reads the discussion and proposes a
   milestone, tasks, subtasks, assignees, dates, and dependency edges.
2. Ask it to reorganize an existing milestone. It reads the tasks + dependency
   graph and proposes a bulk priority/date update with an old→new diff and a reason
   per row.
3. Ask it to create or refine a note. It previews the full document, then updates
   both the persisted note and the live Yjs document so collaborators with the note
   open converge without reloading.

The safety rule is intentionally simple: reads execute; writes pause.

The agent can search, fetch threads/tasks/notes, and inspect project state
immediately. A mutating tool persists a pending action and ends the response stream.
The client renders a tool-specific approval card. Approve/reject is a separate
request with a one-shot token; approval resumes the agent loop from the persisted
steps.

For a multi-item plan, this is one approval for the transaction rather than one
dialog per task. The preview is an actual task tree, not JSON. For bulk changes it
is a diff table. The goal is human control without confirmation fatigue.

Stack: Django 5 + DRF, React 19, Flask/Socket.IO for messaging, Yjs/Hocuspocus for
notes, OpenSearch for hybrid retrieval, and a tool-calling LLM loop streamed as
NDJSON. Workspace reads are ACL-scoped; every answer and proposal can link back to
the chat/task/note it used.

Current limitations:

- solo-built MVP, web-only;
- the quality of a proposed plan still depends on how explicit the discussion was;
- no general undo transaction across every entity yet (version history covers
  notes, but task-plan rollback needs more work);
- collaboration-service failure can prevent an already-open note from seeing an AI
  rewrite live even if the stored copy was updated;
- moving a team into one workspace is still the biggest adoption cost.

The demo requires no signup: https://genosai.dev. Free plan, no card.

I would especially value criticism of the approval boundary. Is a complete
structured preview + one approval enough for a batch operation, or would you want a
dry-run/partial-selection/undo mechanism before trusting it?

---

## Likely questions — concise honest answers

### Why not use MCP across Slack, Notion, and Jira?

That can provide access, but the causal links between a discussion, resulting task,
and superseded note often were never stored. Genos's bet is to capture those links
when work is created. This costs migration/adoption effort; it is not a drop-in
integration.

### Is “one approval” just hiding many dangerous writes?

It can be. That is why the pending action is rendered as the complete task tree or
diff. Today approval is all-or-nothing. Partial acceptance and transaction-level
undo are reasonable next steps.

### How do permissions work?

Search filters by team and entity visibility; tools recheck authorization against
the requesting user. The approval token is one-shot and tied to the persisted run
and its owner. This is still an application-level permission system, not a formal
capability-security design.

### What happens if the model hallucinates an ID?

Write tools validate referenced projects/tasks and their permissions. The preview
also exposes friendly titles so the user is not approving opaque IDs. Invalid
references fail rather than creating against an arbitrary object.
