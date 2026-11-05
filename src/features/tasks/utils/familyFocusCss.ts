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
 * WHY THIS IS NOT REACT STATE
 *
 * The row deliberately keeps hover out of React — see the note above
 * `getTableRowStyles` in DraggableTaskRow. Driving it from a
 * `useState(hoveredId)` re-rendered the row and every cell (the assignee
 * `<UserAvatar>` being the expensive one) on each mouse-enter / mouse-leave,
 * and a cross-row effect would be far worse: the hovered id would have to live
 * in the *table*, so every mouse-enter would re-render the whole row map.
 *
 * WHY IT IS NOT `:has()` ANY MORE (MIP-963)
 *
 * It used to be one generated rule pair per family on screen, built around
 * `.task-table-body:has(.task-table-row[data-task-family="7"]:hover) ...`. That
 * kept hover entirely in the selector engine, but 152 `:has()` rules made the
 * browser's style recalculation for a freshly mounted table cost about 1 s on a
 * 950-task project (measured with Chrome's own counters: ~950 ms of style
 * recalculation per switch to the project, ~25 ms with the stylesheet removed),
 * and about 85 ms more on every task click, because a `data-task-selected`
 * change re-evaluates every rule. Page load and every project switch paid it.
 *
 * Now: one delegated pointer handler on the table body works out the hovered
 * row's family and sets `data-dim` on the rows outside it, imperatively. React
 * state is still untouched, mouse movement still re-renders nothing, and the
 * stylesheet is two static rules, installed once, that never change.
 */

/** Class on each real task row — the hover probe and the dim target. */
export const TASK_ROW_CLASS = "task-table-row";

/** Class on the rows' common container, scoping the dim rules to this table. */
export const TASK_BODY_CLASS = "task-table-body";

/**
 * Attribute the body sets while a drag is in progress. Every rule below is
 * gated on its absence: during a reparent drag the dragged row travels under
 * the cursor, so the hovered family would be the dragged row's and every OTHER
 * family would dim — precisely the rows you drag onto to reparent across
 * families. The drop target also has its own pulse/shimmer cue, which dimming
 * would mute.
 */
export const DND_ACTIVE_ATTR = "data-dnd-active";

/** Set on a row while it is outside the hovered family. */
export const DIM_ATTR = "data-dim";

// These two must match the attributes DraggableTaskRow renders on its wrapper.
// The unit test pins the generated text so a rename here can't silently stop
// matching the DOM.
export const FAMILY_ATTR = "data-task-family";
const SELECTED_ATTR = "data-task-selected";

// The row title's existing class (set in DraggableTaskRow, pre-dating this
// feature). A subtask title carries its own `opacity: 0.85`, which MULTIPLIES
// with the row-level dim below — we reset it to 1 while dimmed so only the
// row's own opacity applies.
const TASK_TITLE_CLASS = "task-row-title";

const DIMMED_ROW =
    `.${TASK_BODY_CLASS}:not([${DND_ACTIVE_ATTR}]) ` +
    // The selected row is exempt: dimming it would hide which task the open
    // preview pane belongs to.
    `.${TASK_ROW_CLASS}[${DIM_ATTR}="true"]:not([${SELECTED_ATTR}="true"])`;

/**
 * The whole stylesheet: two rules, the same two the per-family version emitted.
 */
export const FAMILY_FOCUS_CSS =
    `${DIMMED_ROW}` +
    // De-emphasized, deliberately NOT as faint as a ghost row (opacity 0.4).
    // Two reasons this has to stay readable:
    //
    //  1. `opacity` MULTIPLIES down the tree, and a subtask title already
    //     carries `opacity: 0.85`. At 0.4 the product is ~0.34 — root rows
    //     stayed legible while every subtask read as missing, which looks like
    //     the rows were dropped rather than de-emphasized.
    //  2. A ghost row is genuinely inert; these rows are still fully clickable,
    //     so they must not look disabled to the point of being unreadable.
    //
    // Grayscale carries the "not this one" signal instead, which desaturates
    // the status/tag chips without touching contrast.
    //
    // Deliberately NO `pointer-events: none` — that would swallow the
    // mouse-enter of the row being approached, so the cursor would cross a
    // dimmed row without the highlight following it.
    ` { opacity: 0.72; filter: grayscale(0.85);` +
    // Delay only on the way IN, so brushing the cursor across the table doesn't
    // strobe. Un-dimming falls back to the row's own (undelayed) transition,
    // which keeps the exit instant.
    //
    // `!important` is load-bearing, not a specificity shortcut: the row sets a
    // `transition` SHORTHAND in its inline style (getTableRowStyles), and a
    // shorthand resets every longhand it omits — so it pins `transition-delay`
    // to 0s inline. A normal declaration here loses to that; an important
    // author one is the only thing that outranks a normal inline declaration.
    ` transition-delay: 120ms !important; }\n` +
    // Neutralize the subtask title's own `opacity: 0.85` while the row is
    // dimmed, so the two don't multiply into illegibility. `!important` because
    // that value is an emotion class on the title, at a higher specificity than
    // this descendant rule.
    `${DIMMED_ROW} .${TASK_TITLE_CLASS} { opacity: 1 !important; }`;

const STYLE_ELEMENT_ID = "genos-task-family-focus";

/** Adds the stylesheet once per document. Idempotent. */
export const installFamilyFocusStyles = (doc: Document = document): void => {
    if (doc.getElementById(STYLE_ELEMENT_ID)) return;
    const style = doc.createElement("style");
    style.id = STYLE_ELEMENT_ID;
    style.textContent = FAMILY_FOCUS_CSS;
    doc.head.appendChild(style);
};

// The family each table body is currently focused on, so a pointer moving
// between rows (or cells) of the same family costs one map lookup and nothing
// else. Weak, so a removed table leaves nothing behind.
const focused = new WeakMap<Element, string | null>();

/**
 * Focus `body` on `familyKey` (dim every row of another family), or clear the
 * focus with `null`. Writes only the attributes that change.
 */
export const applyFamilyFocus = (body: Element, familyKey: string | null): void => {
    if ((focused.get(body) ?? null) === familyKey) return;
    focused.set(body, familyKey);
    for (const row of body.querySelectorAll(`.${TASK_ROW_CLASS}`)) {
        const dim = familyKey !== null && row.getAttribute(FAMILY_ATTR) !== familyKey;
        if (dim) {
            if (row.getAttribute(DIM_ATTR) !== "true") row.setAttribute(DIM_ATTR, "true");
        } else if (row.hasAttribute(DIM_ATTR)) {
            row.removeAttribute(DIM_ATTR);
        }
    }
};

interface PointerLikeEvent {
    currentTarget: EventTarget | null;
    target: EventTarget | null;
    pointerType?: string;
}

/**
 * `onPointerOver` for the table body. A touch has no hover, and a tap would
 * leave the family dimmed until the next tap, so it is ignored.
 */
export const onFamilyFocusPointerOver = (event: PointerLikeEvent): void => {
    if (event.pointerType === "touch") return;
    const body = event.currentTarget as Element | null;
    if (!body) return;
    const target = event.target as Element | null;
    const row = target?.closest?.(`.${TASK_ROW_CLASS}`);
    // Over the gap between rows (or the empty area below them) is no family.
    applyFamilyFocus(body, row ? (row.getAttribute(FAMILY_ATTR) ?? null) : null);
};

/** `onPointerLeave` for the table body. */
export const onFamilyFocusPointerLeave = (event: PointerLikeEvent): void => {
    const body = event.currentTarget as Element | null;
    if (body) applyFamilyFocus(body, null);
};
