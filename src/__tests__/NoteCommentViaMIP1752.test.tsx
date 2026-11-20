/**
 * MIP-1752: a note comment written through a connected AI app (MCP) carries the app chip
 * in the app's own comments sidebar, next to the author, as on a task comment card.
 *
 * What must hold: with no `via` nothing changes; the chip shows only what the stored
 * (already reduced) `metadata.via` says, never a name; a hand edit in the editor clears
 * the `via` (the person's comment now, the task-comment rule); the in-app agent sees
 * nothing new (this file only touches rendering).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { viaSourceOfNoteComment } from "../features/tasks/utils/viaSource";

// ── The same hook mocks as CommentsSidebar.test.tsx ───────────────────────────
let threads = new Map<string, any>();
const users = new Map<string, { id: string; username: string; avatarUrl: string }>();

vi.mock("@blocknote/react", () => ({
    getReferenceText: () => "",
    useBlockNoteEditor: () => ({}),
    useExtension: () => ({ selectThread: vi.fn() }),
    useExtensionState: () => ({ threadPositions: new Map(), selectedThreadId: undefined }),
    useThreads: () => threads,
}));
vi.mock("../components/editors/sub/useCommentAuthor", () => ({
    useCommentAuthor: (userId: string) => users.get(userId),
}));
vi.mock("@blocknote/core/comments", () => ({ CommentsExtension: {} }));

const { CommentsSidebar } = await import("../components/editors/sub/CommentsSidebar");

const makeThread = (id: string, metadata?: unknown, replyMetadata?: unknown) => {
    const at = new Date("2026-11-20T00:00:00Z");
    const comment = (cid: string, md: unknown) => ({
        type: "comment",
        id: cid,
        userId: "u1",
        createdAt: at,
        updatedAt: at,
        reactions: [],
        metadata: md,
        body: [{ type: "paragraph", content: [{ type: "text", text: `body of ${cid}` }] }],
    });
    const comments = [comment(`${id}-c0`, metadata)];
    if (replyMetadata !== undefined) comments.push(comment(`${id}-c1`, replyMetadata));
    return {
        type: "thread",
        id,
        createdAt: at,
        updatedAt: at,
        resolved: false,
        metadata: {},
        comments,
    };
};

const row = (text: string) => screen.getByText(text).closest("button") as HTMLElement;

const renderSidebar = () =>
    render(
        <CssVarsProvider>
            <CommentsSidebar open={true} />
        </CssVarsProvider>
    );

describe("CommentsSidebar via chip (MIP-1752)", () => {
    beforeEach(() => {
        threads = new Map();
        users.clear();
        users.set("u1", { id: "u1", username: "Alice", avatarUrl: "" });
    });
    afterEach(cleanup);

    it("shows no chip on a comment with no via (nothing changes)", () => {
        threads.set("t1", makeThread("t1", {}));
        threads.set("t2", makeThread("t2", undefined));
        renderSidebar();
        expect(document.querySelector("[data-via]")).toBeNull();
        expect(screen.queryByRole("img", { name: /via/i })).toBeNull();
    });

    it("shows the generic MCP chip next to the author for a connected app", () => {
        threads.set("t1", makeThread("t1", { via: { kind: "oauth" } }));
        renderSidebar();
        const chip = within(row("body of t1-c0")).getByText("via MCP");
        expect(chip.closest("[data-via]")?.getAttribute("data-via")).toBe("mcp");
        // The person's name stays: the chip removes nothing.
        expect(within(row("body of t1-c0")).getByText("Alice")).toBeInTheDocument();
    });

    it("shows the official app's own mark for the Claude family", () => {
        threads.set("t1", makeThread("t1", { via: { kind: "oauth", app: "claude" } }));
        renderSidebar();
        expect(
            within(row("body of t1-c0")).getByRole("img", { name: "via Claude" })
        ).toBeVisible();
    });

    it("shows the API key chip for an API key", () => {
        threads.set("t1", makeThread("t1", { via: { kind: "api_key" } }));
        renderSidebar();
        const chip = within(row("body of t1-c0")).getByText("via API key");
        expect(chip.closest("[data-via]")?.getAttribute("data-via")).toBe("apiKey");
    });

    it("never shows a name, even one planted in the metadata", () => {
        threads.set(
            "t1",
            makeThread("t1", {
                via: { kind: "oauth", client_name: "Ken's secret app", app: "claude-evil" },
            })
        );
        const { container } = renderSidebar();
        expect(container.textContent).not.toContain("secret app");
        // An unknown family falls back to the generic chip.
        expect(within(row("body of t1-c0")).getByText("via MCP")).toBeInTheDocument();
    });

    it("earns no chip for the web app's own kinds or a malformed via", () => {
        threads.set("t1", makeThread("t1", { via: { kind: "app" } }));
        threads.set("t2", makeThread("t2", { via: { kind: "agent" } }));
        threads.set("t3", makeThread("t3", { via: "oauth" }));
        threads.set("t4", makeThread("t4", "not an object"));
        threads.set("t5", makeThread("t5", { via: null }));
        renderSidebar();
        expect(document.querySelector("[data-via]")).toBeNull();
    });

    it("marks the comment whose author the row shows: a reply's via does not mark the row", () => {
        threads.set("t1", makeThread("t1", {}, { via: { kind: "oauth" } }));
        threads.set("t2", makeThread("t2", { via: { kind: "oauth" } }, {}));
        renderSidebar();
        expect(within(row("body of t1-c0")).queryByText("via MCP")).toBeNull();
        expect(within(row("body of t2-c0")).getByText("via MCP")).toBeInTheDocument();
    });

    it("renders in both color schemes without losing the chip", () => {
        for (const mode of ["light", "dark"] as const) {
            document.documentElement.setAttribute("data-joy-color-scheme", mode);
            threads = new Map([["t1", makeThread("t1", { via: { kind: "oauth" } })]]);
            const { unmount } = renderSidebar();
            expect(screen.getByText("via MCP")).toBeInTheDocument();
            unmount();
        }
        document.documentElement.removeAttribute("data-joy-color-scheme");
    });
});

describe("viaSourceOfNoteComment (MIP-1752)", () => {
    it("reads the reduced kind and official family and never a name", () => {
        expect(
            viaSourceOfNoteComment({ metadata: { via: { kind: "oauth", app: "chatgpt" } } })
        ).toEqual({
            kind: "mcp",
            name: null,
            app: "chatgpt",
        });
        expect(
            viaSourceOfNoteComment({ metadata: { via: { kind: "api_key", key_name: "mine" } } })
        ).toEqual({ kind: "apiKey", name: null, app: null });
    });

    it("returns null with no metadata or no via", () => {
        expect(viaSourceOfNoteComment({})).toBeNull();
        expect(viaSourceOfNoteComment({ metadata: null })).toBeNull();
        expect(viaSourceOfNoteComment({ metadata: {} })).toBeNull();
    });
});
