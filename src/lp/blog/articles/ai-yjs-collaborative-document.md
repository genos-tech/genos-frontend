<!-- Generated from genos-docs/marketing/REDDIT_WEBDEV_AI_YJS_APPROVAL.md. Run npm run blog:sync; do not edit this copy directly. -->

I'm building a solo project with collaborative notes (BlockNote +
Yjs/Hocuspocus) and recently added an AI action that can refine an existing note.
The obvious implementation was wrong in a way that is easy to miss.

The simplified flow looked like this:

1. Agent fetches the saved note.
2. Agent proposes a rewritten body.
3. User reviews it and clicks Approve.
4. Backend updates the note row.

That works perfectly if nobody has the note open.

If a collaborator has the Yjs document open, though, the live collaborative state
is another source of truth. Updating only the REST/database representation can show
success while the open Yjs document still contains the old body. A later
collaborative update can then overwrite the AI change, or different clients can
temporarily see different documents.

So the write path now treats approval as a coordinated update:

- The AI is read-only while preparing the rewrite.
- The UI renders the entire proposed note body in an approval card.
- Nothing changes until the user approves.
- On approval, the saved representation is updated **and** the new body is pushed
  into the live collaborative document.
- Open clients receive the Yjs update, so two tabs converge without reload.
- A version-history entry is created so the rewrite can be restored.

The part I like is that the safety model and synchronization model meet at the same
boundary. The approval step isn't just UX. It's the point where an AI proposal
becomes a real collaborative mutation.

Stack, for context:

- React 19 + BlockNote on the client
- Yjs/Hocuspocus collaboration service
- Django/DRF for persisted app data and the agent endpoint
- streamed agent events over NDJSON

Current compromise: if the collaboration service is unavailable, the REST body can
still be saved, but an already-open editor won't receive the live update until it
reloads. I'm still deciding whether the safer behavior is to fail the whole action
instead. Atomicity across the database and the collaboration service would require
more machinery than the MVP currently has.

For people who have combined server-side AI writes with CRDT editors:

- Do you reject the write when the collaboration service is down?
- Do you model the CRDT as the only source of truth and derive the stored body?
- How do you represent an AI rewrite so it merges predictably with concurrent human
  edits rather than looking like one giant replacement?

Disclosure: this is from my product Genos, a web-only MVP that combines chat,
tasks, notes, and an approval-gated work agent. The no-signup demo is at
https://genosai.dev, but I'm mainly posting because I'd like criticism of the
consistency trade-off.
