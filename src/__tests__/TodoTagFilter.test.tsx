/**
 * The To-do pane's tag filter (MIP-584).
 *
 * Held here: several picks mean "any of them"; "No tag" picks untagged items;
 * a sub-item follows its PARENT's tag (the server ignores one sent with a
 * child) so a parent and its children never part; and a saved selection loses
 * a tag that was deleted since, because the bar could no longer un-pick it.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TodoTagFilterBar } from "../features/chat/components/todo/TodoTagFilterBar";
import {
    filterGroupsByTags,
    itemTagKey,
    NO_TAG,
    pruneTagFilter,
    readTagFilter,
    TagFilterKey,
    writeTagFilter,
} from "../features/chat/utils/todoTagFilter";
import type { TodoCategoryProps, TodoGroupProps, TodoItemProps } from "../types/chat";

const item = (
    itemId: number,
    categoryId: number | null,
    parentItemId: number | null = null
): TodoItemProps => ({ itemId, categoryId, parentItemId }) as unknown as TodoItemProps;

const group = (groupId: number, items: TodoItemProps[]): TodoGroupProps =>
    ({ groupId, localDate: `2026-11-0${groupId}`, items }) as unknown as TodoGroupProps;

const category = (categoryId: number, name: string): TodoCategoryProps => ({
    categoryId,
    name,
    color: "#2563eb",
    textColor: "#fff",
    sortOrder: categoryId,
    tsCreatedAt: "",
    tsUpdatedAt: "",
});

const ids = (groups: readonly TodoGroupProps[]) => groups.map((g) => g.items.map((i) => i.itemId));
const picks = (...keys: TagFilterKey[]) => new Set<TagFilterKey>(keys);

describe("filterGroupsByTags", () => {
    const groups = [
        group(1, [item(1, 10), item(2, 20), item(3, null)]),
        group(2, [item(4, 10), item(5, null)]),
    ];

    it("is no filter when nothing is picked", () => {
        expect(filterGroupsByTags(groups, picks())).toBe(groups);
    });

    it("keeps the items with a picked tag, in every group", () => {
        expect(ids(filterGroupsByTags(groups, picks(10)))).toEqual([[1], [4]]);
    });

    it("means any of the picked tags", () => {
        expect(ids(filterGroupsByTags(groups, picks(10, 20)))).toEqual([[1, 2], [4]]);
    });

    it("picks the untagged items with No tag", () => {
        expect(ids(filterGroupsByTags(groups, picks(NO_TAG)))).toEqual([[3], [5]]);
    });

    it("keeps an empty group in the list for the caller to place", () => {
        expect(ids(filterGroupsByTags(groups, picks(20)))).toEqual([[2], []]);
    });

    it("does not modify what it is given", () => {
        const before = JSON.stringify(groups);
        filterGroupsByTags(groups, picks(10));
        expect(JSON.stringify(groups)).toBe(before);
    });

    it("keeps a sub-item with its parent, whatever tag the child row carries", () => {
        const g = [group(1, [item(1, 10), item(2, null, 1), item(3, 20), item(4, 10, 3)])];

        expect(ids(filterGroupsByTags(g, picks(10)))).toEqual([[1, 2]]);
        expect(ids(filterGroupsByTags(g, picks(20)))).toEqual([[3, 4]]);
        expect(ids(filterGroupsByTags(g, picks(NO_TAG)))).toEqual([[]]);
    });
});

describe("itemTagKey", () => {
    const groups = [group(1, [item(1, 10), item(2, null, 1), item(3, null)])];

    it("answers with the parent's tag for a sub-item, and No tag for none", () => {
        expect(itemTagKey(groups[0].items[1], groups)).toBe(10);
        expect(itemTagKey(groups[0].items[2], groups)).toBe(NO_TAG);
    });
});

describe("pruneTagFilter", () => {
    it("drops a tag that no longer exists and keeps No tag", () => {
        const pruned = pruneTagFilter(picks(10, 99, NO_TAG), [category(10, "Work")]);
        expect([...pruned].sort()).toEqual([10, NO_TAG].sort());
    });
});

describe("persistence", () => {
    beforeEach(() => window.localStorage.clear());

    it("round-trips a selection", () => {
        writeTagFilter(picks(10, NO_TAG));
        expect(readTagFilter()).toEqual(picks(10, NO_TAG));
    });

    it("starts empty with nothing saved, and survives junk", () => {
        expect(readTagFilter().size).toBe(0);
        window.localStorage.setItem("genos-todo-tag-filter:v1", "{nope");
        expect(readTagFilter().size).toBe(0);
        window.localStorage.setItem(
            "genos-todo-tag-filter:v1",
            JSON.stringify([10, "x", -3, 1.5])
        );
        expect(readTagFilter()).toEqual(picks(10));
    });
});

describe("TodoTagFilterBar", () => {
    const cats = [category(10, "Work"), category(20, "Home")];
    const renderBar = (selected: Set<TagFilterKey>) => {
        const onToggle = vi.fn();
        const onClear = vi.fn();
        render(
            <CssVarsProvider>
                <TodoTagFilterBar
                    categories={cats}
                    isDark={false}
                    selected={selected}
                    onClear={onClear}
                    onToggle={onToggle}
                />
            </CssVarsProvider>
        );
        return { onToggle, onClear };
    };

    it("shows a chip per tag and No tag, and reports a click", () => {
        const { onToggle } = renderBar(picks());

        fireEvent.click(screen.getByRole("button", { name: "Home" }));
        fireEvent.click(screen.getByRole("button", { name: "No tag" }));

        expect(onToggle.mock.calls.map((c) => c[0])).toEqual([20, NO_TAG]);
    });

    it("marks the picked chips as pressed and offers Clear only then", () => {
        const none = renderBar(picks());
        expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
        none.onClear.mockClear();
        document.body.innerHTML = "";

        const { onClear } = renderBar(picks(10));
        expect(screen.getByRole("button", { name: "Work" }).getAttribute("aria-pressed")).toBe(
            "true"
        );
        expect(screen.getByRole("button", { name: "Home" }).getAttribute("aria-pressed")).toBe(
            "false"
        );
        fireEvent.click(screen.getByRole("button", { name: "Clear" }));
        expect(onClear).toHaveBeenCalledTimes(1);
    });

    it("renders nothing when the user has no tags", () => {
        const { container } = render(
            <CssVarsProvider>
                <TodoTagFilterBar
                    categories={[]}
                    isDark={false}
                    selected={picks()}
                    onClear={() => {}}
                    onToggle={() => {}}
                />
            </CssVarsProvider>
        );
        expect(container.textContent).toBe("");
    });
});
