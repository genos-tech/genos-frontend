/**
 * The comments sidebar on a phone (MIP-1763).
 *
 * Docked beside the note it was a 340px column in a 390px screen: the note shrank to a sliver.
 * On a phone the panel is a sheet over the editor, with its own Close, Escape to leave, focus
 * handed to the Close on open, and a tapped row closes the sheet and opens the thread's card
 * over the note. jsdom has no layout, so WHERE the sheet sits is a screenshot's job (see the
 * PR); what is pinned here is what the component decides: which layout it asks for, the way
 * back, and that the desktop dock is the layout it always was.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const selectThread = vi.fn();
let threads = new Map<string, Record<string, unknown>>();
let selectedThreadId: string | undefined;

vi.mock("@blocknote/react", () => ({
    getReferenceText: () => "",
    useBlockNoteEditor: () => ({}),
    useExtension: () => ({ selectThread }),
    useExtensionState: () => ({ threadPositions: new Map(), selectedThreadId }),
    useThreads: () => threads,
}));
vi.mock("../components/editors/sub/useCommentAuthor", () => ({
    useCommentAuthor: () => ({ id: "u1", username: "Alice", avatarUrl: "" }),
}));
vi.mock("@blocknote/core/comments", () => ({ CommentsExtension: {} }));

const { CommentsSidebar, COMMENTS_SIDEBAR_WIDTH } = await import(
    "../components/editors/sub/CommentsSidebar"
);

const makeThread = (id: string) => {
    const at = new Date("2026-08-11T00:00:00Z");
    return {
        type: "thread",
        id,
        createdAt: at,
        updatedAt: at,
        resolved: false,
        metadata: {},
        comments: [
            {
                type: "comment",
                id: `${id}-c0`,
                userId: "u1",
                createdAt: at,
                updatedAt: at,
                reactions: [],
                metadata: {},
                body: [{ type: "paragraph", content: [{ type: "text", text: `body of ${id}` }] }],
            },
        ],
    };
};

const sheet = () => screen.getByRole("complementary");

describe("CommentsSidebar on a phone (overlay)", () => {
    beforeEach(() => {
        selectThread.mockClear();
        threads = new Map([["t1", makeThread("t1")]]);
        selectedThreadId = undefined;
    });

    it("lies over the editor, edge to edge, instead of taking a 340px column", () => {
        render(<CommentsSidebar open overlay onClose={() => {}} />);
        const style = getComputedStyle(sheet());
        expect(sheet()).toHaveAttribute("data-layout", "overlay");
        expect(style.position).toBe("absolute");
        expect(style.width).not.toBe(`${COMMENTS_SIDEBAR_WIDTH}px`);
        // Above the title row (100) it covers.
        expect(Number(style.zIndex)).toBeGreaterThan(100);
    });

    it("has a Close, named like the toggle's open state, that leaves the sheet", () => {
        const onClose = vi.fn();
        render(<CommentsSidebar open overlay onClose={onClose} />);
        const close = screen.getByRole("button", { name: /hide comments/i });
        fireEvent.click(close);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("hands focus to the Close when it opens", () => {
        render(<CommentsSidebar open overlay onClose={() => {}} />);
        expect(screen.getByRole("button", { name: /hide comments/i })).toHaveFocus();
    });

    it("leaves on Escape", () => {
        const onClose = vi.fn();
        render(<CommentsSidebar open overlay onClose={onClose} />);
        fireEvent.keyDown(screen.getByRole("button", { name: /hide comments/i }), {
            key: "Escape",
        });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("lets an open card take the first Escape", () => {
        selectedThreadId = "t1";
        const onClose = vi.fn();
        render(<CommentsSidebar open overlay onClose={onClose} />);
        fireEvent.keyDown(screen.getByRole("button", { name: /hide comments/i }), {
            key: "Escape",
        });
        expect(onClose).not.toHaveBeenCalled();
    });

    it("a tapped row opens that thread's card and closes the sheet", () => {
        const onClose = vi.fn();
        render(<CommentsSidebar open overlay onClose={onClose} />);
        fireEvent.click(screen.getByText("body of t1"));
        expect(selectThread).toHaveBeenCalledWith("t1", true);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("a touch screen's mouseenter before the tap opens no card behind the sheet", () => {
        render(<CommentsSidebar open overlay onClose={() => {}} />);
        fireEvent.mouseEnter(screen.getByText("body of t1").closest("button")!);
        expect(selectThread).not.toHaveBeenCalled();
    });

    it("renders nothing when closed", () => {
        const { container } = render(<CommentsSidebar open={false} overlay onClose={() => {}} />);
        expect(container).toBeEmptyDOMElement();
    });
});

describe("CommentsSidebar on a desktop (dock): unchanged", () => {
    beforeEach(() => {
        selectThread.mockClear();
        threads = new Map([["t1", makeThread("t1")]]);
        selectedThreadId = undefined;
    });

    it("is the 340px column beside the editor, with no Close of its own", () => {
        render(<CommentsSidebar open />);
        const style = getComputedStyle(sheet());
        expect(sheet()).toHaveAttribute("data-layout", "dock");
        expect(style.width).toBe(`${COMMENTS_SIDEBAR_WIDTH}px`);
        expect(style.position).not.toBe("absolute");
        expect(screen.queryByRole("button", { name: /hide comments/i })).toBeNull();
    });

    it("takes no focus and ignores Escape", () => {
        const onClose = vi.fn();
        render(<CommentsSidebar open onClose={onClose} />);
        expect(sheet().contains(document.activeElement)).toBe(false);
        fireEvent.keyDown(sheet(), { key: "Escape" });
        expect(onClose).not.toHaveBeenCalled();
    });

    it("still previews on hover and pins on click (the row stays; the panel stays)", () => {
        const onClose = vi.fn();
        render(<CommentsSidebar open onClose={onClose} />);
        const row = screen.getByText("body of t1").closest("button")!;
        fireEvent.mouseEnter(row);
        expect(selectThread).toHaveBeenCalledWith("t1", true);
        fireEvent.click(row);
        expect(onClose).not.toHaveBeenCalled();
    });
});

describe("GenosNoteEditor wiring", () => {
    const src = readFileSync(
        join(__dirname, "../components/editors/genos/GenosNoteEditor.tsx"),
        "utf8"
    );

    it("asks for the overlay at the app's phone breakpoint (useIsMobile), not one of its own", () => {
        expect(src).toContain('from "../../../hooks/common/useIsMobile"');
        expect(src).toMatch(/<CommentsSidebar[^>]*overlay=\{isMobile\}/s);
        expect(src).not.toMatch(/max-width:\s*\d+px/);
    });

    it("the title row only clears the panel's edge when the panel is docked", () => {
        expect(src).toContain("const commentsDocked = showComments && !isMobile;");
        expect(src.match(/right: commentsDocked \? COMMENTS_SIDEBAR_WIDTH \+ 12/g)?.length).toBe(
            2
        );
        expect(src).not.toMatch(/right: showComments/);
    });

    it("focus goes back to the Show comments button when the sheet closes", () => {
        expect(src).toContain('commentsToggleRef.current?.querySelector("button")?.focus()');
    });
});
