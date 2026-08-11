/**
 * The custom "show all comments" sidebar.
 *
 * This is a frontend-only lens over the editor's existing comment threads. The
 * interaction that matters — the point of the feature — is that hovering a row
 * previews that thread's floating card (via the always-mounted
 * `FloatingThreadController`), clicking PINS it so the card survives the mouse
 * leaving, and the sidebar itself never closes on interaction. These tests pin
 * that contract, plus the ordering (by document position, like BlockNote's own
 * `sort="position"`), the last-activity timestamp, and the open/empty states.
 *
 * BlockNote's comment hooks need a live editor + context to run, which a unit
 * test has no cheap way to build, so we mock the hooks the sidebar reads and
 * assert against the extension's `selectThread` seam directly.
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

const makeComment = (id: string, text: string, createdAt: Date) => ({
    type: "comment",
    id,
    userId: "u1",
    createdAt,
    updatedAt: createdAt,
    reactions: [],
    metadata: {},
    body: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const makeThread = (id: string, opts: Partial<any> = {}) => ({
    type: "thread",
    id,
    createdAt: new Date("2026-08-11T00:00:00Z"),
    updatedAt: new Date("2026-08-11T00:00:00Z"),
    resolved: false,
    metadata: {},
    comments: [makeComment(`${id}-c0`, `body of ${id}`, new Date("2026-08-11T00:00:00Z"))],
    ...opts,
});

// The rows live in a flex container that owns the `onMouseLeave` (leaving the
// list, not a single row, drops the hover preview). Reach it from a row.
const rowsContainer = (rowText: string) =>
    screen.getByText(rowText).closest("button")!.parentElement!;

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
        const { container } = render(<CommentsSidebar open={false} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("shows an empty state when there are no threads", () => {
        render(<CommentsSidebar open={true} />);
        expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
    });

    it("lists one row per thread, ordered by document position", () => {
        // Insert out of position order; positions put t2 before t1.
        threads.set("t1", makeThread("t1"));
        threads.set("t2", makeThread("t2"));
        threadPositions.set("t1", { from: 100, to: 110 });
        threadPositions.set("t2", { from: 10, to: 20 });

        render(<CommentsSidebar open={true} />);

        // The reference snippet encodes `from`, so reading them top-to-bottom
        // proves the sort ran (t2@10 before t1@100).
        const refs = screen.getAllByText(/^ref@/).map((el) => el.textContent);
        expect(refs).toEqual(["ref@10", "ref@100"]);
    });

    it("previews a thread's card on hover (select + scroll)", () => {
        threads.set("t1", makeThread("t1"));
        threadPositions.set("t1", { from: 5, to: 9 });

        render(<CommentsSidebar open={true} />);
        // Nothing is selected until the user interacts.
        expect(selectThread).not.toHaveBeenCalled();

        fireEvent.mouseEnter(screen.getByText("body of t1").closest("button")!);

        // Same effect as clicking the highlighted text: select + scroll (true).
        expect(selectThread).toHaveBeenCalledWith("t1", true);
    });

    it("closes the preview when the pointer leaves the list and nothing is pinned", () => {
        threads.set("t1", makeThread("t1"));
        threadPositions.set("t1", { from: 5, to: 9 });

        render(<CommentsSidebar open={true} />);
        fireEvent.mouseEnter(screen.getByText("body of t1").closest("button")!);
        expect(selectThread).toHaveBeenLastCalledWith("t1", true);

        fireEvent.mouseLeave(rowsContainer("body of t1"));

        // No pin → the preview is dismissed.
        expect(selectThread).toHaveBeenLastCalledWith(undefined);
    });

    it("pins a thread on click so its card survives the pointer leaving; sidebar stays open", () => {
        threads.set("t1", makeThread("t1"));
        threadPositions.set("t1", { from: 5, to: 9 });

        render(<CommentsSidebar open={true} />);
        const row = screen.getByText("body of t1").closest("button")!;

        fireEvent.mouseEnter(row);
        fireEvent.click(row);
        expect(selectThread).toHaveBeenCalledWith("t1", true);

        // Leaving the list must NOT close the pinned card...
        fireEvent.mouseLeave(rowsContainer("body of t1"));
        expect(selectThread).not.toHaveBeenCalledWith(undefined);

        // ...and the sidebar is still mounted (never closes on interaction).
        expect(screen.getByText("body of t1")).toBeInTheDocument();
    });

    it("re-opens the card on click even after an out-of-band dismiss", () => {
        // Regression: BlockNote's FloatingThreadController closes the card
        // itself on any dismiss — and a click on a row counts as a click-outside,
        // so `selectedThreadId` drops to undefined mid-interaction. A local
        // "what's showing" shadow would go stale here and block the re-open (the
        // odd/even-click desync the user hit). We reconcile against the live
        // selection instead, so the click must still re-open the card.
        threads.set("t1", makeThread("t1"));
        threadPositions.set("t1", { from: 5, to: 9 });

        const { rerender } = render(<CommentsSidebar open={true} />);
        const row = screen.getByText("body of t1").closest("button")!;

        // Hover opens the card; BlockNote reflects it in selectedThreadId.
        fireEvent.mouseEnter(row);
        expect(selectThread).toHaveBeenLastCalledWith("t1", true);
        selectedThreadId = "t1";
        rerender(<CommentsSidebar open={true} />);

        // The card dismisses itself out-of-band (floating-ui outside-press).
        selectedThreadId = undefined;
        rerender(<CommentsSidebar open={true} />);

        // Now a click must re-open it — not no-op against a stale shadow.
        selectThread.mockClear();
        fireEvent.click(row);
        expect(selectThread).toHaveBeenCalledWith("t1", true);
    });

    it("stops pointerdown from bubbling (so the card isn't dismissed by the click)", () => {
        // The row swallows pointerdown so floating-ui's document-level
        // outside-press listener never fires for a click on a row — otherwise
        // the click that pins a card would first tear it down.
        threads.set("t1", makeThread("t1"));
        threadPositions.set("t1", { from: 5, to: 9 });

        const onOutsidePress = vi.fn();
        document.addEventListener("pointerdown", onOutsidePress);
        try {
            render(<CommentsSidebar open={true} />);
            fireEvent.pointerDown(screen.getByText("body of t1").closest("button")!);
            expect(onOutsidePress).not.toHaveBeenCalled();
        } finally {
            document.removeEventListener("pointerdown", onOutsidePress);
        }
    });

    it("unpins on a second click, closing the card once the pointer leaves", () => {
        threads.set("t1", makeThread("t1"));
        threadPositions.set("t1", { from: 5, to: 9 });

        render(<CommentsSidebar open={true} />);
        const row = screen.getByText("body of t1").closest("button")!;

        fireEvent.mouseEnter(row);
        fireEvent.click(row); // pin
        fireEvent.click(row); // unpin
        fireEvent.mouseLeave(rowsContainer("body of t1"));

        expect(selectThread).toHaveBeenLastCalledWith(undefined);
    });

    it("unpins when the card is dismissed from outside the sidebar", () => {
        // Clicking outside the card (or escape) dismisses it in BlockNote —
        // selectedThreadId drops to undefined. The sidebar must adopt that and
        // drop the pin, so the card does NOT revive on the next hover. We prove
        // the pin is gone by showing a fresh hover+leave now CLOSES the card (a
        // still-pinned thread would survive the leave).
        threads.set("t1", makeThread("t1"));
        threadPositions.set("t1", { from: 5, to: 9 });

        const { rerender } = render(<CommentsSidebar open={true} />);
        const row = screen.getByText("body of t1").closest("button")!;

        // Pin it, then move the mouse off the sidebar — the pin keeps it up.
        fireEvent.mouseEnter(row);
        fireEvent.click(row);
        selectedThreadId = "t1";
        rerender(<CommentsSidebar open={true} />);
        fireEvent.mouseLeave(rowsContainer("body of t1"));

        // User clicks outside → BlockNote dismisses the card out-of-band.
        selectedThreadId = undefined;
        rerender(<CommentsSidebar open={true} />);

        // Pin is dropped: hover previews, but leaving now closes it.
        selectThread.mockClear();
        fireEvent.mouseEnter(row);
        fireEvent.mouseLeave(rowsContainer("body of t1"));
        expect(selectThread).toHaveBeenLastCalledWith(undefined);
    });

    it("adopts an out-of-band selection of a different thread as the new pin", () => {
        // The user clicks a different highlight in the doc while a thread is
        // pinned: BlockNote selects the new thread. The sidebar adopts it as the
        // pin (so the panel reflects it and doesn't close the card the user just
        // opened). We prove t2 became the pin by showing that a later hover of t1
        // reverts, on leave, to t2 — not to t1 and not to closed.
        //
        // (The mocked hooks don't echo selectThread() back into selectedThreadId,
        // so we drive selectedThreadId via rerender to mimic BlockNote reflecting
        // each selection — exactly what happens in the app.)
        threads.set("t1", makeThread("t1"));
        threads.set("t2", makeThread("t2"));
        threadPositions.set("t1", { from: 5, to: 9 });
        threadPositions.set("t2", { from: 50, to: 60 });

        const { rerender } = render(<CommentsSidebar open={true} />);
        const row1 = screen.getByText("body of t1").closest("button")!;

        // Pin t1, mouse away — the pin keeps it up.
        fireEvent.mouseEnter(row1);
        fireEvent.click(row1);
        selectedThreadId = "t1";
        rerender(<CommentsSidebar open={true} />);
        fireEvent.mouseLeave(rowsContainer("body of t1"));

        // User clicks t2's highlight in the doc → BlockNote selects t2.
        selectedThreadId = "t2";
        rerender(<CommentsSidebar open={true} />);

        // Now hover t1 (previewing it, which moves the live selection to t1)...
        fireEvent.mouseEnter(row1);
        selectedThreadId = "t1";
        rerender(<CommentsSidebar open={true} />);

        // ...then leave: the preview must revert to the adopted pin t2.
        selectThread.mockClear();
        fireEvent.mouseLeave(rowsContainer("body of t1"));
        expect(selectThread).toHaveBeenLastCalledWith("t2", true);
    });

    it("shows the author name and a resolved badge for resolved threads", () => {
        threads.set("t1", makeThread("t1", { resolved: true, resolvedBy: "u1" }));
        threadPositions.set("t1", { from: 1, to: 2 });

        render(<CommentsSidebar open={true} />);

        const row = screen.getByText("body of t1").closest("button")!;
        expect(within(row).getByText("Alice")).toBeInTheDocument();
        expect(within(row).getByText(/resolved/i)).toBeInTheDocument();
    });

    it("shows the LAST comment's time, not the first", () => {
        // now = 2026-08-11T12:00:00Z; first comment 10 days ago, last 5 min ago.
        const nowSpy = vi
            .spyOn(Date, "now")
            .mockReturnValue(new Date("2026-08-11T12:00:00Z").getTime());
        try {
            threads.set(
                "t1",
                makeThread("t1", {
                    createdAt: new Date("2026-08-01T12:00:00Z"),
                    comments: [
                        makeComment("t1-c0", "body of t1", new Date("2026-08-01T12:00:00Z")),
                        makeComment("t1-c1", "a reply", new Date("2026-08-11T11:55:00Z")),
                    ],
                })
            );
            threadPositions.set("t1", { from: 1, to: 2 });

            render(<CommentsSidebar open={true} />);

            const row = screen.getByText("body of t1").closest("button")!;
            // Last activity (5 min ago) wins over the thread/first-comment age.
            expect(within(row).getByText("5 minutes ago")).toBeInTheDocument();
            expect(within(row).queryByText(/day.? ago/)).not.toBeInTheDocument();
        } finally {
            nowSpy.mockRestore();
        }
    });

    it("renders no reference snippet for a position-less thread (no English leak)", () => {
        // A thread whose highlighted text was deleted has no entry in
        // threadPositions. The real getReferenceText returns a hardcoded English
        // literal for a missing position, so the sidebar must skip the call and
        // render no snippet rather than leak untranslated text into other locales.
        threads.set("t1", makeThread("t1"));
        // deliberately no threadPositions entry for t1

        render(<CommentsSidebar open={true} />);

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

        render(<CommentsSidebar open={false} />);

        expect(getReferenceText).not.toHaveBeenCalled();
    });

    it("drops soft-deleted threads", () => {
        threads.set("t1", makeThread("t1"));
        threads.set("t2", makeThread("t2", { deletedAt: new Date("2026-08-11T01:00:00Z") }));
        threadPositions.set("t1", { from: 1, to: 2 });
        threadPositions.set("t2", { from: 3, to: 4 });

        render(<CommentsSidebar open={true} />);

        expect(screen.getByText("body of t1")).toBeInTheDocument();
        expect(screen.queryByText("body of t2")).not.toBeInTheDocument();
    });
});
