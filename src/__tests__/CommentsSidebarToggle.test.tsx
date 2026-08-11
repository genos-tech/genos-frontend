/**
 * The comment-sidebar toggle button.
 *
 * It lives OUTSIDE `<BlockNoteView>` (in the editor's absolute-positioned
 * affordance cluster), so it can't use the comment React hooks — it subscribes
 * to the `ThreadStore` directly for its open-thread count badge. These tests
 * pin that the badge counts only open (non-resolved, non-deleted) threads, that
 * it hides while the sidebar is open, and that the click fires the toggle.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CommentsSidebarToggle } from "../components/editors/sub/CommentsSidebarToggle";

// A minimal ThreadStore stand-in: a fixed set of threads and a no-op subscribe
// (the count is read synchronously on render via getSnapshot).
const makeStore = (threads: any[]) =>
    ({
        getThreads: () => new Map(threads.map((t) => [t.id, t])),
        subscribe: () => () => {},
    }) as any;

const thread = (id: string, opts: Partial<any> = {}) => ({
    id,
    resolved: false,
    deletedAt: undefined,
    ...opts,
});

describe("CommentsSidebarToggle", () => {
    it("badges the count of open threads only", () => {
        const store = makeStore([
            thread("a"),
            thread("b"),
            thread("c", { resolved: true }), // resolved → not counted
            thread("d", { deletedAt: new Date("2026-08-11T00:00:00Z") }), // deleted → not counted
        ]);
        render(<CommentsSidebarToggle open={false} threadStore={store} onToggle={() => {}} />);
        expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("hides the count while the sidebar is open", () => {
        const store = makeStore([thread("a"), thread("b")]);
        render(<CommentsSidebarToggle open={true} threadStore={store} onToggle={() => {}} />);
        // Joy renders a `0` badge as invisible; the count text is absent.
        expect(screen.queryByText("2")).not.toBeInTheDocument();
    });

    it("fires onToggle when clicked", () => {
        const store = makeStore([thread("a")]);
        const onToggle = vi.fn();
        render(<CommentsSidebarToggle open={false} threadStore={store} onToggle={onToggle} />);
        fireEvent.click(screen.getByRole("button"));
        expect(onToggle).toHaveBeenCalledTimes(1);
    });
});
