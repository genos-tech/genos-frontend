// Push a server-persisted note body into the note's collaborative Yjs
// doc — the missing half of a server-side note write.
//
// A note body lives in TWO stores: the Django `body` JSON (what the
// REST API and the agent's update_note tool write) and the binary Yjs
// doc genos-collab persists. The only bridge is client-side, and the
// editor seeds from the REST body ONLY while the Yjs doc is empty
// (useCollaborativeBlockNote), so a REST-only body update to a note
// that has ever been collaboratively edited would be silently ignored
// — stale Yjs wins on the next open and the next autosave overwrites
// the REST row with the old content.
//
// This utility closes the gap with a short-lived headless collab
// session: connect a bare Y.Doc to the note's Hocuspocus room, wait
// for sync, apply the new blocks as a DIFFED in-place fragment update
// (`blocksToYXmlFragment` → y-prosemirror's `updateYFragment`, the
// same routine a mounted editor's binding uses for local edits — NOT
// a doc rehydration), wait for the server ack, disconnect. One path
// covers every state: note open locally (the server echoes the update
// to the open editor's own connection), open by someone else
// (broadcast), closed (the persisted doc is updated for the next
// open), never opened (the fragment gets its initial content and the
// REST seed is skipped as already-populated).
//
// Deliberately NO IndexeddbPersistence here — open clients' IDB
// replicas update through their own doc's update events, and stale
// replicas reconcile additively via state-vector sync on next open.
//
// The conversion needs a BlockNoteEditor only as a schema holder
// (`editor.pmSchema` exists from construction; no mount, no React).
// The DEFAULT schema suffices: agent-written bodies come from the
// backend's markdown_to_blocks (paragraphs / headings ≤3 / lists /
// bold / italic / links only). Diff-deleting old nodes of custom types
// (mentions, alerts) is a pure Yjs op that needs no schema knowledge.

import { BlockNoteEditor, type Block } from "@blocknote/core";
import { blocksToYXmlFragment } from "@blocknote/core/yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";

const COLLAB_URL = import.meta.env.VITE_COLLAB_URL;

// Same fragment name every collaborative editor binds
// (useCollaborativeBlockNote.ts).
const FRAGMENT_NAME = "document-store";

const SYNC_TIMEOUT_MS = 8000;
const FLUSH_TIMEOUT_MS = 5000;
const FLUSH_POLL_MS = 100;

// Schema holder for blocksToYXmlFragment — headless by design (never
// mounted), created once and reused across applies.
let schemaHolder: BlockNoteEditor | null = null;
const getSchemaHolder = (): BlockNoteEditor => {
    if (!schemaHolder) {
        schemaHolder = BlockNoteEditor.create({
            // No collaboration option: an unmounted editor never binds a
            // fragment, so a collab-configured one would silently not
            // write. The fragment conversion below is editor-independent.
            initialContent: [{ type: "paragraph" }],
        });
    }
    return schemaHolder;
};

/** Pure core (unit-testable without any network): apply `blocks` to a
 * Y.XmlFragment as one diffed transaction. An empty body becomes a
 * single empty paragraph — the ProseMirror doc requires at least one
 * block (mirrors the editors' restore effect). */
export const applyBlocksToFragment = (blocks: unknown[], fragment: Y.XmlFragment): void => {
    const replacement =
        Array.isArray(blocks) && blocks.length > 0 ? blocks : [{ type: "paragraph" }];
    blocksToYXmlFragment(getSchemaHolder(), replacement as Block[], fragment);
};

export const noteDocumentName = (
    noteType: "personal" | "task",
    noteId: number | string
): string => (noteType === "task" ? `task-note:${noteId}` : `my-note:${noteId}`);

export interface ApplyNoteBodyOptions {
    documentName: string;
    blocks: unknown[];
    accessToken: string;
}

/** Connect → sync → apply → flush → disconnect. Resolves "applied"
 * once the server has acked the update (persistence is then the
 * collab server's Database extension's job), "failed" on auth/timeout
 * — in which case the REST body is still durably saved and the caller
 * decides how to recover (resync nonce for an open editor). */
export const applyNoteBodyToYjs = async ({
    documentName,
    blocks,
    accessToken,
}: ApplyNoteBodyOptions): Promise<"applied" | "failed"> => {
    if (!COLLAB_URL || !accessToken) return "failed";

    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment(FRAGMENT_NAME);
    let provider: HocuspocusProvider | null = null;

    try {
        const synced = await new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => resolve(false), SYNC_TIMEOUT_MS);
            provider = new HocuspocusProvider({
                url: COLLAB_URL,
                name: documentName,
                document: doc,
                token: accessToken,
                // No ghost presence entry in open editors' avatar stacks.
                awareness: null,
                onSynced: () => {
                    clearTimeout(timer);
                    resolve(true);
                },
                onAuthenticationFailed: () => {
                    clearTimeout(timer);
                    resolve(false);
                },
                onClose: () => {
                    // Closed before ever syncing (collab down) → fail;
                    // resolve is a no-op after the sync already won.
                    clearTimeout(timer);
                    resolve(false);
                },
            });
        });
        if (!synced) return "failed";

        applyBlocksToFragment(blocks, fragment);

        // The provider counts every local update out and decrements on
        // the server's SyncStatus ack; 0 = nothing in flight (a no-op
        // diff never increments it). Poll — cheap, and immune to event
        // -name drift across provider versions.
        const flushed = await new Promise<boolean>((resolve) => {
            const startedAt = Date.now();
            const poll = () => {
                if ((provider?.unsyncedChanges ?? 0) === 0) return resolve(true);
                if (Date.now() - startedAt > FLUSH_TIMEOUT_MS) return resolve(false);
                setTimeout(poll, FLUSH_POLL_MS);
            };
            poll();
        });
        return flushed ? "applied" : "failed";
    } catch {
        return "failed";
    } finally {
        try {
            (provider as HocuspocusProvider | null)?.destroy();
        } catch {
            // best-effort teardown
        }
        doc.destroy();
    }
};
