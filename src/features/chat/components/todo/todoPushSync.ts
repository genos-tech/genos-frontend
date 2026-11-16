/**
 * What the To-do page does with a live `todo.changed` push (MIP-1626).
 *
 * Once every write announces itself, the page's OWN saves come back to it as well (the same
 * person's tab hears the push for what it just sent). Three things keep that echo from costing the
 * person anything:
 *
 *  - It is coalesced: one re-read for a burst (`PUSH_REFRESH_DELAY_MS`, trailing).
 *  - It never replaces what is being typed: while focus is in an editor inside the pane
 *    (`isTypingInTodoPane`) the re-read waits, and runs once they have left it. A re-read hands
 *    every row new object identities, and the row resets its draft title and notes editor whenever
 *    its `item.title` / `item.notes` identity changes.
 *  - Rows that did not change keep their identity (`mergeFreshGroups`), so the echo of a save the
 *    page already shows changes nothing on screen at all: no re-render, no editor reset.
 */

import { TodoGroupProps } from "../../../../types/chat";
import { keepIfEqual } from "../../../../utils/keepIfEqual";

/** Quiet time after the last push before the list is re-read. */
export const PUSH_REFRESH_DELAY_MS = 300;

/** True while focus is inside an editable element of the To-do pane (a title field, the notes
 *  editor, the sub-item input): text there is not yet on the server and must not be replaced. */
export function isTypingInTodoPane(doc: Document = document): boolean {
    const el = doc.activeElement;
    if (!(el instanceof HTMLElement)) return false;
    if (!el.closest("[data-todo-pane]")) return false;
    return el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA";
}

/**
 * `fresh` with every group and row that equals the one in `prev` replaced by `prev`'s object.
 * Returns `prev` itself when nothing changed, so the state write is a no-op for React.
 *
 * Equality is `keepIfEqual`'s (JSON): it only ever errs toward "changed", which costs one extra
 * render and never a stale row.
 */
export function mergeFreshGroups(
    prev: TodoGroupProps[],
    fresh: TodoGroupProps[]
): TodoGroupProps[] {
    const prevGroups = new Map(prev.map((g) => [g.groupId, g]));
    const merged = fresh.map((group) => {
        const before = prevGroups.get(group.groupId);
        if (!before) return group;
        const prevItems = new Map((before.items ?? []).map((i) => [i.itemId, i]));
        const items = (group.items ?? []).map((item) => {
            const old = prevItems.get(item.itemId);
            return old ? keepIfEqual(old, item) : item;
        });
        const sameItems =
            items.length === (before.items ?? []).length &&
            items.every((item, index) => item === before.items[index]);
        const next = sameItems ? { ...group, items: before.items } : { ...group, items };
        return keepIfEqual(before, next);
    });
    const unchanged = merged.length === prev.length && merged.every((g, i) => g === prev[i]);
    return unchanged ? prev : merged;
}
