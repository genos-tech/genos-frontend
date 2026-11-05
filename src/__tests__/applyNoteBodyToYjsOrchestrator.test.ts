// The part of `applyNoteBodyToYjs` around the pure conversion: connect,
// wait for sync, apply, wait for the ack, report "applied" or "failed".
// The provider is faked (the real one is exercised in the browser check);
// what is pinned here is what the caller (`useNoteManagement`) acts on:
// MIP-949 — a body with a chip or an alert must come back "applied", not
// "failed" (a "failed" on the open note makes the editor replace its whole
// document, see `applyAgentNoteUpdate`).

import { yXmlFragmentToBlocks } from "@blocknote/core/yjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import {
    applyNoteBodyToYjs,
    getSchemaHolder,
} from "../features/notes/common/services/applyNoteBodyToYjs";

const fake = vi.hoisted(() => {
    // Read at module load by the service; without it nothing connects.
    vi.stubEnv("VITE_COLLAB_URL", "ws://collab.test");
    return { updates: [] as Uint8Array[], destroyed: 0 };
});

vi.mock("@hocuspocus/provider", () => ({
    HocuspocusProvider: class {
        unsyncedChanges = 0;
        constructor(options: { document: Y.Doc; onSynced: () => void }) {
            options.document.on("update", (update: Uint8Array) => fake.updates.push(update));
            queueMicrotask(() => options.onSynced());
        }
        destroy() {
            fake.destroyed += 1;
        }
    },
}));

const text = (value: string) => ({ type: "text", text: value, styles: {} });

const run = (blocks: unknown[]) =>
    applyNoteBodyToYjs({ documentName: "my-note:1", blocks, accessToken: "t" });

/** The document a collaborator would end up with from what was sent. */
const received = () => {
    const doc = new Y.Doc();
    for (const update of fake.updates) Y.applyUpdate(doc, update);
    return yXmlFragmentToBlocks(getSchemaHolder(), doc.getXmlFragment("document-store"));
};

afterEach(() => {
    fake.updates = [];
    fake.destroyed = 0;
    vi.restoreAllMocks();
});

describe("applyNoteBodyToYjs", () => {
    it("reports applied for a body with a mention, a reference chip and an alert", async () => {
        const status = await run([
            {
                id: "a",
                type: "paragraph",
                content: [
                    text("ping "),
                    { type: "mention", props: { userId: "u-7", userName: "Alice" } },
                    text(" about "),
                    { type: "hashTask", props: { taskId: "5", displayId: "GEN-5", title: "t" } },
                ],
            },
            { id: "b", type: "alert", props: { type: "info" }, content: [text("careful")] },
        ]);
        expect(status).toBe("applied");
        const blocks = received();
        expect(blocks.map((b) => b.type)).toEqual(["paragraph", "alert"]);
        expect((blocks[0].content as Array<{ type: string }>).map((c) => c.type)).toEqual([
            "text",
            "mention",
            "text",
            "hashTask",
        ]);
        expect(blocks[1].props).toMatchObject({ type: "info" });
        expect(fake.destroyed).toBe(1);
    });

    it("reports applied for a plain body, as before", async () => {
        expect(await run([{ id: "a", type: "paragraph", content: [text("hi")] }])).toBe("applied");
        expect(received().map((b) => b.type)).toEqual(["paragraph"]);
    });

    it("reports failed, writes nothing and says why when a type is unknown", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const status = await run([{ type: "paragraph", content: [{ type: "nope" }] }]);
        expect(status).toBe("failed");
        expect(fake.updates).toHaveLength(0);
        expect(warn).toHaveBeenCalledOnce();
        expect(String(warn.mock.calls[0])).toContain("my-note:1");
        expect(fake.destroyed).toBe(1);
    });

    it("reports failed without connecting when there is no access token", async () => {
        const status = await applyNoteBodyToYjs({
            documentName: "my-note:1",
            blocks: [],
            accessToken: "",
        });
        expect(status).toBe("failed");
        expect(fake.destroyed).toBe(0);
    });
});
