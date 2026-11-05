import { TodoCategoryProps, TodoGroupProps, TodoItemProps } from "../../../types/chat";

/**
 * The To-do pane's tag filter (MIP-584).
 *
 * A selection is a set of tag ids, plus `NO_TAG` for the items with no tag.
 * Several picks mean "any of these". An empty selection means no filter.
 *
 * A sub-item has no tag of its own: the server mirrors its parent's tag onto it
 * and ignores one sent with a child. So an item is judged by its PARENT's tag
 * when it has one, and the two always stay together on screen.
 */

export const NO_TAG = "none";
export type TagFilterKey = number | typeof NO_TAG;

const STORAGE_KEY = "genos-todo-tag-filter:v1";

/** The key an item answers to: its (root) tag id, or `NO_TAG`. */
const keyOf = (
    item: TodoItemProps,
    rootById: ReadonlyMap<number, TodoItemProps>
): TagFilterKey => {
    const root = item.parentItemId != null ? (rootById.get(item.parentItemId) ?? item) : item;
    return root.categoryId ?? NO_TAG;
};

export const itemTagKey = (
    item: TodoItemProps,
    groups: readonly TodoGroupProps[]
): TagFilterKey => {
    const byId = new Map<number, TodoItemProps>();
    for (const g of groups) for (const i of g.items) byId.set(i.itemId, i);
    return keyOf(item, byId);
};

/**
 * `groups` with only the items the filter admits. A group left with no items
 * stays in the list; the caller decides which empty days are worth showing.
 */
export const filterGroupsByTags = (
    groups: readonly TodoGroupProps[],
    selected: ReadonlySet<TagFilterKey>
): readonly TodoGroupProps[] => {
    if (selected.size === 0) return groups;
    return groups.map((group) => {
        const byId = new Map(group.items.map((i) => [i.itemId, i] as const));
        return {
            ...group,
            items: group.items.filter((item) => selected.has(keyOf(item, byId))),
        };
    });
};

/** A selection without the tags that no longer exist (deleted since it was saved). */
export const pruneTagFilter = (
    selected: ReadonlySet<TagFilterKey>,
    categories: readonly Pick<TodoCategoryProps, "categoryId">[]
): Set<TagFilterKey> => {
    const known = new Set<number>(categories.map((c) => c.categoryId));
    return new Set([...selected].filter((k) => k === NO_TAG || known.has(k)));
};

export const readTagFilter = (): Set<TagFilterKey> => {
    try {
        const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
        if (!Array.isArray(raw)) return new Set();
        return new Set(
            raw.filter((k): k is TagFilterKey => k === NO_TAG || (Number.isInteger(k) && k > 0))
        );
    } catch {
        return new Set();
    }
};

export const writeTagFilter = (selected: ReadonlySet<TagFilterKey>): void => {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
    } catch {
        // Private mode / quota: the filter still works until the page reloads.
    }
};
