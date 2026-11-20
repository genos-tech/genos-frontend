/**
 * MIP-1752: editing an MCP-written note comment in the editor clears its `via` (intended).
 * Its own file because `NoteCommentViaMIP1752.test.tsx` mocks `@blocknote/core/comments`
 * and this one needs the real thread store.
 */
import { DefaultThreadStoreAuth } from "@blocknote/core/comments";
import { YjsThreadStore } from "@blocknote/core/yjs";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import { viaSourceOfNoteComment } from "../features/tasks/utils/viaSource";

describe("editing an MCP-written comment clears its via (MIP-1752, intended)", () => {
    // BlockNote's comment editor saves an edit with
    //   threadStore.updateComment({ commentId, comment: { body }, threadId })
    // (node_modules/@blocknote/react, `Comment`'s onSubmit): no metadata. The real
    // YjsThreadStore then SETS the comment's metadata to that undefined. A person who fixes
    // an app's comment by hand owns it now, the same rule as a task comment (api #760).
    // If a BlockNote upgrade starts keeping metadata on edit, this fails on purpose: decide
    // again whether an edited comment keeps its chip.
    it("a hand edit through the real YjsThreadStore drops the via", async () => {
        const doc = new Y.Doc();
        const store = new YjsThreadStore(
            "u1",
            doc.getMap("threads"),
            new DefaultThreadStoreAuth("u1", "editor")
        );
        const body = [{ type: "paragraph", content: "written by the app" }] as never;
        const thread = await store.createThread({
            initialComment: { body, metadata: { via: { kind: "oauth", app: "claude" } } },
        });
        const commentId = thread.comments[0].id;

        const before = store.getThread(thread.id).comments[0];
        expect(viaSourceOfNoteComment(before)).toEqual({ kind: "mcp", name: null, app: "claude" });

        await store.updateComment({
            threadId: thread.id,
            commentId,
            comment: { body: [{ type: "paragraph", content: "fixed by hand" }] as never },
        });

        const after = store.getThread(thread.id).comments[0];
        expect(after.metadata).toBeUndefined();
        expect(viaSourceOfNoteComment(after)).toBeNull();
    });
});
