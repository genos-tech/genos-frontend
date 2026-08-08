<!-- Generated from genos-docs/marketing/REDDIT_WEBDEV_AI_YJS_APPROVAL.md. Run npm run blog:sync; do not edit this copy directly. -->

Disclosure: this comes from Genos, the web-only MVP I am building. The editor uses
BlockNote with Yjs/Hocuspocus; Django stores the application-side note data.

I added an AI action that proposes a replacement note body and waits for explicit
approval. The first write path looked reasonable:

1. Read the persisted note.
2. Generate a proposed body.
3. Show the complete body for review.
4. On approval, update the database.

The bug is that an open Yjs document is live state, not just another view of that
row. A database-only success can leave connected clients on the old document. A
later collaborative save can then win over the approved rewrite.

The implemented path now uses approval as the mutation boundary:

- generation is read-only;
- the full proposed body is visible before approval;
- approval updates the persisted representation and sends the body into the live
  collaborative document;
- connected clients receive the Yjs update;
- the rewrite gets a version-history entry.

This fixes the obvious split-brain case, but it does not make a database write and a
collaboration-service write one atomic transaction. It also treats a whole-note AI
rewrite as a replacement, which is a poor merge primitive if a person is editing
the same region concurrently.

Stack: React 19, BlockNote, Yjs/Hocuspocus, Django/DRF, and streamed agent events
over NDJSON.

For anyone running server-originated writes into a CRDT:

**Where is your authoritative commit point, and what exact failure behavior do you
choose when persistence succeeds but the collaboration service is unavailable?**

Would you reject before either write, compensate after a partial write, make the
Yjs document authoritative and derive the stored body, or model the AI proposal as
smaller CRDT operations? I would especially value examples where concurrent human
edits changed the answer.

If subreddit rules permit one project link, the no-login demo is
<https://genosai.dev>. The consistency design is what I am looking to have challenged.
