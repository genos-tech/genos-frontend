/**
 * LoadMoreList (MIP-2024): the shared "short list, then Load more" used by Recent charges and the
 * Security log. A real button, focus to the first new row, a polite live count, and the empty,
 * failed and end states.
 */

import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LoadMoreList } from "../components/ui/misc/LoadMoreList";

const Harness = ({
    initial,
    more,
    failed = false,
    onLoadMore = () => {},
}: {
    initial: number[];
    more: number[];
    failed?: boolean;
    onLoadMore?: () => void;
}) => {
    const [items, setItems] = useState(initial);
    const [hasMore, setHasMore] = useState(more.length > 0);
    return (
        <LoadMoreList
            ariaLabel="Rows"
            emptyLabel="Nothing here"
            endLabel="That is all"
            failed={failed}
            failedLabel="Could not load"
            getKey={(n) => n}
            hasMore={hasMore}
            items={items}
            loading={false}
            loadMoreLabel="Load more"
            renderItem={(n) => <span>row {n}</span>}
            retryLabel="Try again"
            shownLabel={(n) => `Showing ${n}`}
            onLoadMore={() => {
                onLoadMore();
                if (failed) return;
                setItems((prev) => [...prev, ...more]);
                setHasMore(false);
            }}
        />
    );
};

describe("LoadMoreList", () => {
    it("shows the empty state and no button when there are no rows", () => {
        render(<Harness initial={[]} more={[]} />);
        expect(screen.getByText("Nothing here")).toBeTruthy();
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("does not announce anything before the person asks for more", () => {
        render(<Harness initial={[1, 2]} more={[3]} />);
        expect(screen.getByRole("status").textContent).toBe("");
        expect(screen.getByRole("button", { name: "Load more" })).toBeTruthy();
    });

    it("moves focus to the first new row and announces the end", () => {
        render(<Harness initial={[1, 2]} more={[3, 4]} />);
        fireEvent.click(screen.getByRole("button", { name: "Load more" }));
        const rows = screen.getByRole("list", { name: "Rows" }).children;
        expect(rows.length).toBe(4);
        expect(document.activeElement).toBe(rows[2]);
        expect(screen.getByRole("status").textContent).toBe("That is all");
        expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
        expect(screen.getAllByText("That is all").length).toBeGreaterThan(0);
    });

    it("keeps the rows and turns the button into retry when a page failed", () => {
        const spy = vi.fn();
        render(<Harness initial={[1, 2]} more={[3]} failed onLoadMore={spy} />);
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(spy).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
        expect(screen.getByRole("alert").textContent).toBe("Could not load");
        expect(screen.getByRole("list", { name: "Rows" }).children.length).toBe(2);
    });

    it("says how many rows are shown while there is still more", () => {
        const Two = () => {
            const [items, setItems] = useState([1, 2]);
            const [more, setMore] = useState(true);
            return (
                <LoadMoreList
                    ariaLabel="Rows"
                    emptyLabel="none"
                    getKey={(n) => n}
                    hasMore={more}
                    items={items}
                    loading={false}
                    loadMoreLabel="Load more"
                    renderItem={(n) => <span>row {n}</span>}
                    shownLabel={(n) => `Showing ${n}`}
                    onLoadMore={() => {
                        setItems((p) => [...p, p.length + 1, p.length + 2]);
                        setMore(items.length < 4);
                    }}
                />
            );
        };
        render(<Two />);
        fireEvent.click(screen.getByRole("button", { name: "Load more" }));
        expect(screen.getByRole("status").textContent).toBe("Showing 4");
    });
});
