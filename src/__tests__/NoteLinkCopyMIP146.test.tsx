/**
 * MIP-146: copying a link to ONE block or ONE comment of a note.
 *
 * `useNoteLinkApi` builds the URL (the note's own page + one parameter) and copies it with a toast;
 * the comments sidebar offers "Copy link to comment" on each thread row, but only inside a note that
 * has a page to link to; and a note link that names a block, opened in the link modal, is captured
 * for the editor in the preview.
 */
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteLinkContext, useNoteLinkApi } from "../components/editors/sub/NoteLinkContext";
import { ToastHost } from "../components/ui/feedback/Toast";
import { __resetToasts } from "../components/ui/feedback/toastStore";
import { peekNoteTarget, resetNoteTarget } from "../features/notes/common/utils/noteTarget";
import { useUrlLinkModalState } from "../hooks/common/useUrlLinkModalState";

// ── the BlockNote hooks the sidebar reads, as in CommentsSidebar.test.tsx ───────────────────────
const selectThread = vi.fn();
let threads = new Map<string, ReturnType<typeof thread>>();
vi.mock("@blocknote/react", () => ({
    getReferenceText: () => "ref",
    useBlockNoteEditor: () => ({}),
    useExtension: () => ({ selectThread }),
    useExtensionState: () => ({ threadPositions: new Map(), selectedThreadId: undefined }),
    useThreads: () => threads,
}));
vi.mock("../components/editors/sub/useCommentAuthor", () => ({
    useCommentAuthor: () => ({ id: "u1", username: "Alice", avatarUrl: "" }),
}));
vi.mock("@blocknote/core/comments", () => ({ CommentsExtension: {} }));
const { CommentsSidebar } = await import("../components/editors/sub/CommentsSidebar");

const THREAD = "0e51b6f1-aaaa-4bbb-8ccc-ddddeeeeffff";
const BLOCK = "6c1c0a52-2a36-4a2f-93cb-0d1a1b6f8c11";
const thread = (id: string) => ({
    type: "thread",
    id,
    createdAt: new Date("2026-08-11T00:00:00Z"),
    updatedAt: new Date("2026-08-11T00:00:00Z"),
    resolved: false,
    metadata: {},
    comments: [
        {
            type: "comment",
            id: `${id}-c0`,
            userId: "u1",
            createdAt: new Date("2026-08-11T00:00:00Z"),
            updatedAt: new Date("2026-08-11T00:00:00Z"),
            reactions: [],
            metadata: {},
            body: [{ type: "paragraph", content: [{ type: "text", text: `body of ${id}` }] }],
        },
    ],
});

let written: string[] = [];
const setClipboard = (impl?: (text: string) => Promise<void>) => {
    Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
            writeText: vi.fn(async (text: string) => {
                if (impl) return impl(text);
                written.push(text);
            }),
        },
    });
};

beforeEach(() => {
    written = [];
    selectThread.mockClear();
    threads = new Map([[THREAD, thread(THREAD)]]);
    __resetToasts();
    resetNoteTarget();
    setClipboard();
    window.history.pushState({}, "", "/workspace/notes/shared/12");
});
afterEach(() => resetNoteTarget());

const NOTE = { noteType: 1 as const, noteId: 12, commentHost: {} };

describe("useNoteLinkApi", () => {
    it("builds a block link from the page the member is on, keeping its bucket", () => {
        const { result } = renderHook(() => useNoteLinkApi(NOTE));
        expect(result.current.blockLink(BLOCK)).toBe(
            `${window.location.origin}/workspace/notes/shared/12?block=${BLOCK}`
        );
    });

    it("builds a comment link the same way", () => {
        const { result } = renderHook(() => useNoteLinkApi(NOTE));
        expect(result.current.commentLink(THREAD)).toBe(
            `${window.location.origin}/workspace/notes/shared/12?comment=${THREAD}`
        );
    });

    it("reads the page when the link is built, not when the editor mounted", () => {
        const { result } = renderHook(() => useNoteLinkApi(NOTE));
        window.history.pushState({}, "", "/workspace/notes/team/12");
        expect(result.current.blockLink(BLOCK)).toContain("/workspace/notes/team/12?block=");
    });

    it("gives no link for a note it cannot name, instead of one that lands nowhere", () => {
        const { result } = renderHook(() =>
            useNoteLinkApi({ noteType: 2, noteId: 12, commentHost: {} })
        );
        window.history.pushState({}, "", "/workspace/tasks");
        expect(result.current.blockLink(BLOCK)).toBeNull();
        expect(result.current.commentLink(THREAD)).toBeNull();
    });

    it("copies to the clipboard and says so", async () => {
        const { result } = renderHook(() => useNoteLinkApi(NOTE));
        render(<ToastHost />);
        let ok = false;
        await act(async () => {
            ok = await result.current.copy("https://x.example/a");
        });
        expect(ok).toBe(true);
        expect(written).toEqual(["https://x.example/a"]);
        expect(await screen.findByText("Link copied")).toBeTruthy();
    });

    it("says so when the clipboard refuses, and reports failure", async () => {
        setClipboard(() => Promise.reject(new Error("denied")));
        vi.spyOn(console, "error").mockImplementation(() => {});
        const { result } = renderHook(() => useNoteLinkApi(NOTE));
        render(<ToastHost />);
        let ok = true;
        await act(async () => {
            ok = await result.current.copy("https://x.example/a");
        });
        expect(ok).toBe(false);
        expect(await screen.findByText("Couldn't copy the link.")).toBeTruthy();
    });
});

describe("the comments sidebar row", () => {
    const withLink = () => {
        const Host = () => {
            const api = useNoteLinkApi(NOTE);
            return (
                <NoteLinkContext.Provider value={api}>
                    <CommentsSidebar open />
                    <ToastHost />
                </NoteLinkContext.Provider>
            );
        };
        return render(<Host />);
    };

    it("offers 'Copy link to comment' on a row, and copies that thread's link", async () => {
        withLink();
        fireEvent.click(screen.getByRole("button", { name: "Copy link to comment" }));
        await waitFor(() =>
            expect(written).toEqual([
                `${window.location.origin}/workspace/notes/shared/12?comment=${THREAD}`,
            ])
        );
    });

    it("does not select or pin the thread when its link is copied", async () => {
        withLink();
        fireEvent.click(screen.getByRole("button", { name: "Copy link to comment" }));
        await waitFor(() => expect(written).toHaveLength(1));
        expect(selectThread).not.toHaveBeenCalled();
    });

    it("is not nested in the row's own button", () => {
        withLink();
        const copy = screen.getByRole("button", { name: "Copy link to comment" });
        expect(copy.closest("button")).toBe(copy);
        expect(copy.parentElement?.querySelectorAll("button").length).toBe(2);
    });

    it("offers nothing where the note has no page of its own (no provider)", () => {
        render(<CommentsSidebar open />);
        expect(screen.queryByRole("button", { name: "Copy link to comment" })).toBeNull();
    });
});

describe("a note link opened in the link modal", () => {
    const open = (href: string) => {
        const { result } = renderHook(() => useUrlLinkModalState({ navigate: vi.fn() }));
        act(() => {
            result.current.openModalByHref(href);
        });
        return result.current;
    };

    it("captures the block for the editor in the preview", () => {
        const state = open(`/workspace/notes/my/12?block=${BLOCK}`);
        expect(state.target?.kind).toBe("myNote");
        expect(peekNoteTarget()).toMatchObject({ noteType: 1, noteId: 12, blockId: BLOCK });
    });

    it("captures a comment on a task note", () => {
        open(`/workspace/notes/task/project/3/task/4/note/12?comment=${THREAD}`);
        expect(peekNoteTarget()).toMatchObject({ noteType: 2, noteId: 12, threadId: THREAD });
    });

    it("captures nothing for a plain note link", () => {
        open("/workspace/notes/my/12");
        expect(peekNoteTarget()).toBeNull();
    });
});
