/**
 * Hover "family focus" for the task table.
 *
 * With many root milestones / root tasks expanded, the flat row list makes it
 * hard to see which root owns which child. Depth colors help within a family
 * but say nothing about *which* family a row belongs to — two sibling subtrees
 * render the identical depth-1 blue.
 *
 * So: hovering any row dims every row outside that row's family (its root
 * chain's whole subtree), leaving the hovered family at full strength.
 *
 * WHY THIS IS A GENERATED STYLESHEET AND NOT REACT STATE
 *
 * The row deliberately keeps hover in CSS — see the note above
 * `getTableRowStyles` in DraggableTaskRow. Driving it from a
 * `useState(hoveredId)` re-rendered the row and every cell (the assignee
 * `<UserAvatar>` being the expensive one) on each mouse-enter / mouse-leave,
 * and a cross-row effect would be far worse: the hovered id would have to live
 * in the *table*, so every mouse-enter would re-render the whole row map.
 *
 * `:has()` moves the entire cross-row lookup into the browser's selector
 * engine. We emit one rule per family currently in view:
 *
 *     .task-table-body:has(.task-table-row[data-task-family="7"]:hover)
 *         .task-table-row:not([data-task-family="7"]) { ...dim... }
 *
 * The row only has to carry its family as an attribute. Mouse movement then
 * costs React exactly nothing — no state, no re-render, no handlers at all.
 * The stylesheet's text changes only when the visible tree does.
 *
 * Two rows that are in the same family produce the *same* highlight, so
 * sweeping the cursor down a subtree holds a steady picture instead of
 * re-computing on every row.
 */

/** Class on each real task row — the `:has()` probe and the dim target. */
export const TASK_ROW_CLASS = "task-table-row";

/** Class on the rows' common container, scoping `:has()` to this table. */
export const TASK_BODY_CLASS = "task-table-body";

/**
 * Attribute the body sets while a drag is in progress. Every rule below is
 * gated on its absence: during a reparent drag the dragged row travels under
 * the cursor, so `:hover` would resolve to it and dim every OTHER family —
 * precisely the rows you drag onto to reparent across families. The drop
 * target also has its own pulse/shimmer cue, which dimming would mute.
 */
export const DND_ACTIVE_ATTR = "data-dnd-active";

// These two must match the attributes DraggableTaskRow renders on its wrapper.
// `buildFamilyFocusCss`'s unit test pins the generated text so a rename here
// can't silently stop matching the DOM.
const FAMILY_ATTR = "data-task-family";
const SELECTED_ATTR = "data-task-selected";

// The row title's existing class (set in DraggableTaskRow, pre-dating this
// feature). A subtask title carries its own `opacity: 0.85`, which MULTIPLIES
// with the row-level dim below — we reset it to 1 while dimmed so only the
// row's own opacity applies.
const TASK_TITLE_CLASS = "task-row-title";

// Family keys are task ids (numeric today, UUIDs on v3 surfaces). Anything
// outside this charset is dropped rather than interpolated: these keys land
// inside a quoted attribute selector, so a stray quote or backslash would
// break out of the selector and corrupt every rule after it.
const SAFE_FAMILY_KEY = /^[A-Za-z0-9_-]+$/;

/**
 * Build the dim rules for the families currently on screen.
 *
 * @param familyKeys every visible row's family key (duplicates expected — one
 *   per row; they collapse to one rule per distinct family).
 * @returns stylesheet text, or `""` when dimming could have no effect.
 */
export const buildFamilyFocusCss = (familyKeys: Iterable<string>): string => {
    const keys = [...new Set(familyKeys)].filter((key) => SAFE_FAMILY_KEY.test(key));

    // Nothing to contrast against: with a single family in view every row is
    // "family", so every rule's `:not()` would match nothing. Returning "" also
    // keeps the <style> element out of the tree entirely for the common
    // single-root case (e.g. the milestone-scoped view).
    if (keys.length < 2) return "";

    return keys
        .map(
            (key) =>
                `.${TASK_BODY_CLASS}:not([${DND_ACTIVE_ATTR}])` +
                `:has(.${TASK_ROW_CLASS}[${FAMILY_ATTR}="${key}"]:hover) ` +
                // The selected row is exempt: dimming it would hide which task
                // the open preview pane belongs to.
                `.${TASK_ROW_CLASS}:not([${FAMILY_ATTR}="${key}"]):not([${SELECTED_ATTR}="true"])` +
                // De-emphasized, deliberately NOT as faint as a ghost row
                // (opacity 0.4). Two reasons this has to stay readable:
                //
                //  1. `opacity` MULTIPLIES down the tree, and a subtask title
                //     already carries `opacity: 0.85`. At 0.4 the product is
                //     ~0.34 — root rows stayed legible while every subtask
                //     read as missing, which looks like the rows were dropped
                //     rather than de-emphasized.
                //  2. A ghost row is genuinely inert; these rows are still
                //     fully clickable, so they must not look disabled to the
                //     point of being unreadable.
                //
                // Grayscale carries the "not this one" signal instead, which
                // desaturates the status/tag chips without touching contrast.
                //
                // Deliberately NO `pointer-events: none` — that would swallow
                // the mouse-enter of the row being approached, so the cursor
                // would cross a dimmed row without the highlight following it.
                ` { opacity: 0.72; filter: grayscale(0.85);` +
                // Delay only on the way IN, so brushing the cursor across the
                // table doesn't strobe. Un-dimming falls back to the row's own
                // (undelayed) transition, which keeps the exit instant.
                //
                // `!important` is load-bearing, not a specificity shortcut:
                // the row sets a `transition` SHORTHAND in its inline style
                // (getTableRowStyles), and a shorthand resets every longhand it
                // omits — so it pins `transition-delay` to 0s inline. A normal
                // declaration here loses to that; an important author one is
                // the only thing that outranks a normal inline declaration.
                ` transition-delay: 120ms !important; }` +
                // Neutralize the subtask title's own `opacity: 0.85` while the
                // row is dimmed, so the two don't multiply into illegibility.
                // `!important` because that value is an emotion class on the
                // title, at a higher specificity than this descendant rule.
                `\n.${TASK_BODY_CLASS}:not([${DND_ACTIVE_ATTR}])` +
                `:has(.${TASK_ROW_CLASS}[${FAMILY_ATTR}="${key}"]:hover) ` +
                `.${TASK_ROW_CLASS}:not([${FAMILY_ATTR}="${key}"]):not([${SELECTED_ATTR}="true"])` +
                ` .${TASK_TITLE_CLASS} { opacity: 1 !important; }`
        )
        .join("\n");
};
