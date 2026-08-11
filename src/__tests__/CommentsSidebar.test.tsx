/**
 * The custom "show all comments" sidebar.
 *
 * This is a frontend-only lens over the editor's existing comment threads. The
 * behavior that matters — the whole point of the feature — is that clicking a
 * row does exactly what clicking the highlighted text does: it selects the
 * thread (opening its floating card via the always-mounted
 * `FloatingThreadController`) AND closes the sidebar. These tests pin that
 * contract, plus the ordering (by document position, like BlockNote's own
 * `sort="position"`) and the open/empty states.
 *
 * BlockNote's comment hooks need a live editor + context to run, which a unit
 * test has no cheap way to build, so we mock the four hooks the sidebar reads
 * and assert against the extension's `selectThread` seam directly.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock the BlockNote comment hooks the sidebar consumes. ──────────────────
const selectThread = vi.fn();
let threads = new Map<string, any>();
let threadPositions = new Map<string, { from: number; to: number }>();
let selectedThreadId: string | undefined;
const users = new Map<string, { id: string; username: string; avatarUrl: string }>();

const getReferenceText = vi.fn(
    // getReferenceText(editor, pos) — return a stable snippet keyed by `from`
    // so we can assert ordering without a real ProseMirror doc. The real one
    // returns a hardcoded English literal for a missing position, so the sidebar
    // must never call it without a position — we assert that below.
    (_editor: unknown, pos?: { from: number; to: number }) =>
        pos ? `ref@${pos.from}` : "Original content deleted"
);

vi.mock("@blocknote/react", () => ({
    getReferenceText: (editor: unknown, pos?: { from: number; to: number }) =>
        getReferenceText(editor, pos),
    useBlockNoteEditor: () => ({}),
    useExtension: () => ({ selectThread }),
    useExtensionState: () => ({ threadPositions, selectedThreadId }),
    useThreads: () => threads,
    useUser: (userId: string) => users.get(userId),
}));

// The sidebar imports the CommentsExtension token only to pass it to the mocked
// hooks; a bare stub is enough.
vi.mock("@blocknote/core/comments", () => ({ CommentsExtension: {} }));

const { CommentsSidebar } = await import("../components/editors/sub/CommentsSidebar");

const makeThread = (id: string, opts: Partial<any> = {}) => ({
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
    ...opts,
});

describe("CommentsSidebar", () => {
    beforeEach(() => {
        selectThread.mockClear();
        getReferenceText.mockClear();
        threads = new Map();
        threadPositions = new Map();
        selectedThreadId = undefined;
        users.clear();
        users.set("u1", { id: "u1", username: "Alice", avatarUrl: "" });
    });

    it("renders nothing when closed", () => {
        threads.set("t1", makeThread("t1"));
        const { container } = render(<CommentsSidebar open={false} onClose={() => {}} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("shows an empty state when there are no threads", () => {
        render(<CommentsSidebar open={true} onClose={() => {}} />);
        expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
    });

    it("lists one row per thread, ordered by document position", () => {
        // Insert out of position order; positions put t2 before t1.
        threads.set("t1", makeThread("t1"));
        threads.set("t2", makeThread("t2"));
        threadPositions.set("t1", { from: 100, to: 110 });
        threadPositions.set("t2", { from: 10, to: 20 });

        render(<CommentsSidebar open={true} onClose={() => {}} />);

        // The reference snippet encodes `from`, so reading them top-to-bottom
        // proves the sort ran (t2@10 before t1@100).
        const refs = screen.getAllByText(/^ref@/).map((el) => el.textContent);
        expect(refs).toEqual(["ref@10", "ref@100"]);
    });

    it("opens the thread's card AND closes the sidebar when a row is clicked", () => {
        threads.set("t1", makeThread("t1"));
        threadPositions.set("t1", { from: 5, to: 9 });
        const onClose = vi.fn();

        render(<CommentsSidebar open={true} onClose={onClose} />);

        fireEvent.click(screen.getByText("body of t1"));

        // Same effect as clicking the highlighted text: select + scroll (true)...
        expect(selectThread).toHaveBeenCalledWith("t1", true);
        // ...then the sidebar closes.
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("shows the author name and a resolved badge for resolved threads", () => {
        threads.set("t1", makeThread("t1", { resolved: true, resolvedBy: "u1" }));
        threadPositions.set("t1", { from: 1, to: 2 });

        render(<CommentsSidebar open={true} onClose={() => {}} />);

        const row = screen.getByText("body of t1").closest("button")!;
        expect(within(row).getByText("Alice")).toBeInTheDocument();
        expect(within(row).getByText(/resolved/i)).toBeInTheDocument();
    });

    it("renders no reference snippet for a position-less thread (no English leak)", () => {
        // A thread whose highlighted text was deleted has no entry in
        // threadPositions. The real getReferenceText returns a hardcoded English
        // literal for a missing position, so the sidebar must skip the call and
        // render no snippet rather than leak untranslated text into other locales.
        threads.set("t1", makeThread("t1"));
        // deliberately no threadPositions entry for t1

        render(<CommentsSidebar open={true} onClose={() => {}} />);

        expect(screen.getByText("body of t1")).toBeInTheDocument();
        expect(screen.queryByText(/original content deleted/i)).not.toBeInTheDocument();
        // It must never be called without a position.
        for (const call of getReferenceText.mock.calls) {
            expect(call[1]).toBeTruthy();
        }
    });

    it("does no per-thread reference work while closed", () => {
        // The sidebar stays mounted when closed; it must not call getReferenceText
        // (an editor.transact) for every thread on each keystroke-driven rerender.
        threads.set("t1", makeThread("t1"));
        threads.set("t2", makeThread("t2"));
        threadPositions.set("t1", { from: 1, to: 2 });
        threadPositions.set("t2", { from: 3, to: 4 });

        render(<CommentsSidebar open={false} onClose={() => {}} />);

        expect(getReferenceText).not.toHaveBeenCalled();
    });

    it("drops soft-deleted threads", () => {
        threads.set("t1", makeThread("t1"));
        threads.set("t2", makeThread("t2", { deletedAt: new Date("2026-08-11T01:00:00Z") }));
        threadPositions.set("t1", { from: 1, to: 2 });
        threadPositions.set("t2", { from: 3, to: 4 });

        render(<CommentsSidebar open={true} onClose={() => {}} />);

        expect(screen.getByText("body of t1")).toBeInTheDocument();
        expect(screen.queryByText("body of t2")).not.toBeInTheDocument();
    });
});
