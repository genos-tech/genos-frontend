// The roving tabindex of the task table (MIP-1230), applied to the DOM.
//
// MIP-1129 made every click-to-edit cell a real button, which is right for the
// keyboard, but it left ~650 tab stops in a table (a status, a priority, a title, a
// due date, an avatar ... in every row). The standard grid pattern fixes it: the
// table has ONE tab stop, the active cell; arrow keys move between cells; Enter /
// Space press the cell's own button; Tab leaves the table. `gridNav.ts` is the
// pure keyboard model; this file reads the DOM into it and keeps the tabindex.
//
// How a cell is declared (the markup contract, enforced by a source scan):
//   - a row element carries `data-grid-row="<id>"` (the header row: "__header");
//   - a cell carries `data-grid-col="<column key>"`. Either it is a WRAPPER
//     (`role="gridcell"` / `"columnheader"`): its focus target is the first
//     focusable element inside it (the cell's button), or the wrapper itself when
//     the cell only shows a value; or it IS the control (an `IconButton`, the drag
//     handle): then it is its own target.
//   - every other focusable element inside a cell is taken out of the Tab order.
//
// No React state is involved. The active cell is a (row id, column key) pair held
// in this object, the tabindex values are written straight to the DOM, and a
// MutationObserver (child list only) re-applies them to a cell whose content was
// swapped (a button becoming an editor and back) or that was just mounted. The
// table is a render-storm hot spot (memory perf-render-storm-mip904): a key press
// or a focus move re-renders nothing.

import { createContext, useCallback, useContext, useMemo, useRef } from "react";

import {
    defaultPosition,
    intentForKey,
    nextPosition,
    resolvePosition,
    type GridModel,
    type GridPos,
} from "./gridNav";

export const GRID_ROW_ATTR = "data-grid-row";
export const GRID_COL_ATTR = "data-grid-col";
export const GRID_HEADER_ROW = "__header";
/** The cells that sit before the data columns and have no header cell: the leading
 *  gutter (drag handle, open graph, quick add) and the expand chevron. */
export const GRID_LEADING_COLS = ["__drag", "__graph", "__add", "__expand"] as const;

const ROW = `[${GRID_ROW_ATTR}]`;
const CELL = `[${GRID_COL_ATTR}]`;
const FOCUSABLE =
    'button:not([disabled]), [role="button"], a[href], input:not([disabled]):not([type="hidden"]),' +
    ' select:not([disabled]), textarea:not([disabled]), [role="combobox"]';
const TEXT_ENTRY = 'input, textarea, select, [contenteditable="true"], [role="combobox"]';

const isWrapper = (cell: Element) => {
    const role = cell.getAttribute("role");
    return role === "gridcell" || role === "columnheader";
};

/** The element of a cell that takes focus. */
const targetOf = (cell: HTMLElement): HTMLElement => {
    if (!isWrapper(cell)) return cell;
    return cell.querySelector<HTMLElement>(FOCUSABLE) ?? cell;
};

const rowIdOf = (cell: Element) => cell.closest(ROW)?.getAttribute(GRID_ROW_ATTR) ?? null;
const posOf = (cell: Element): GridPos | null => {
    const rowId = rowIdOf(cell);
    const col = cell.getAttribute(GRID_COL_ATTR);
    return rowId !== null && col !== null ? { rowId, col } : null;
};
const samePos = (a: GridPos | null, b: GridPos | null) =>
    a !== null && b !== null && a.rowId === b.rowId && a.col === b.col;

export class GridNav {
    private container: HTMLElement | null = null;
    private active: GridPos | null = null;
    private activeRowIndex = 1;
    /** The active cell was picked by the model, not by the user: while only the
     *  header existed it is a header cell, and it moves to the first row when rows arrive. */
    private activeIsDefault = false;
    private modality: "keyboard" | "pointer" = "pointer";

    /** Start managing `container`; returns the cleanup. */
    attach(container: HTMLElement): () => void {
        this.container = container;
        const onKeyDown = (event: KeyboardEvent) => this.onKeyDown(event);
        const onFocusIn = (event: FocusEvent) => this.activateFrom(event.target);
        const onPointerDown = (event: Event) => this.activateFrom(event.target);
        const onWindowKey = () => {
            this.modality = "keyboard";
        };
        const onWindowPointer = () => {
            this.modality = "pointer";
        };
        container.addEventListener("keydown", onKeyDown);
        container.addEventListener("focusin", onFocusIn);
        container.addEventListener("pointerdown", onPointerDown, true);
        // Observers only: they record how the user last interacted, nothing else.
        window.addEventListener("keydown", onWindowKey, true);
        window.addEventListener("pointerdown", onWindowPointer, true);

        const observer = new MutationObserver((records) => this.onMutations(records));
        observer.observe(container, { childList: true, subtree: true });
        this.syncAll();

        return () => {
            observer.disconnect();
            container.removeEventListener("keydown", onKeyDown);
            container.removeEventListener("focusin", onFocusIn);
            container.removeEventListener("pointerdown", onPointerDown, true);
            window.removeEventListener("keydown", onWindowKey, true);
            window.removeEventListener("pointerdown", onWindowPointer, true);
            if (this.container === container) this.container = null;
        };
    }

    /** The active cell (row id, column key), for tests and the row's focus return. */
    getActive(): GridPos | null {
        return this.active;
    }

    /**
     * An editor in `pos` just closed. If the user was on the keyboard (Escape,
     * Enter, a pick) and the editor's unmount left focus on `<body>`, put it back
     * on the cell. A blur by mouse or Tab keeps wherever the user went.
     */
    restoreFocus(pos: GridPos): void {
        if (!this.container || this.modality !== "keyboard") return;
        const current = document.activeElement;
        if (current && current !== document.body && document.contains(current)) return;
        const cell = this.cellEl(pos);
        if (!cell) return;
        this.focusCell(pos, cell);
    }

    // ── model ────────────────────────────────────────────────────────────────

    private rowEls(): HTMLElement[] {
        return this.container ? Array.from(this.container.querySelectorAll<HTMLElement>(ROW)) : [];
    }

    private cellEl(pos: GridPos): HTMLElement | null {
        const row = this.rowEls().find((r) => r.getAttribute(GRID_ROW_ATTR) === pos.rowId);
        if (!row) return null;
        return (
            Array.from(row.querySelectorAll<HTMLElement>(CELL)).find(
                (c) => c.getAttribute(GRID_COL_ATTR) === pos.col
            ) ?? null
        );
    }

    private buildModel(): GridModel {
        const rows = this.rowEls();
        const byId = new Map<string, HTMLElement>();
        for (const row of rows) byId.set(row.getAttribute(GRID_ROW_ATTR) ?? "", row);
        const cache = new Map<string, string[]>();
        const colsOf = (rowId: string) => {
            let cols = cache.get(rowId);
            if (!cols) {
                const row = byId.get(rowId);
                cols = row
                    ? Array.from(row.querySelectorAll(CELL)).map(
                          (c) => c.getAttribute(GRID_COL_ATTR) ?? ""
                      )
                    : [];
                cache.set(rowId, cols);
            }
            return cols;
        };
        return {
            colOrder: [...GRID_LEADING_COLS, ...colsOf(GRID_HEADER_ROW)],
            rowIds: Array.from(byId.keys()),
            colsOf,
        };
    }

    // ── the tab stop ─────────────────────────────────────────────────────────

    /** Give a cell its tabindex: 0 for the active cell, -1 for the rest. */
    private applyStop(cell: HTMLElement, isActive: boolean) {
        const target = targetOf(cell);
        if (isWrapper(cell)) {
            // The wrapper only takes focus when it has nothing of its own inside.
            if (target !== cell) cell.removeAttribute("tabindex");
            // A second control in one cell is not a second stop.
            for (const extra of cell.querySelectorAll<HTMLElement>(FOCUSABLE)) {
                if (extra !== target) extra.setAttribute("tabindex", "-1");
            }
        }
        target.setAttribute("tabindex", isActive ? "0" : "-1");
    }

    private isActiveCell(cell: HTMLElement) {
        return samePos(posOf(cell), this.active);
    }

    private syncAll() {
        if (!this.container) return;
        for (const cell of this.container.querySelectorAll<HTMLElement>(CELL)) {
            this.applyStop(cell, false);
        }
        this.active = this.active && this.cellEl(this.active) ? this.active : null;
        this.ensureActive();
    }

    private onMutations(records: MutationRecord[]) {
        const container = this.container;
        if (!container) return;
        const touched = new Set<HTMLElement>();
        const owner = (node: Node | null) => {
            if (!(node instanceof HTMLElement) || !container.contains(node)) return;
            const own = node.closest<HTMLElement>(CELL);
            if (own) touched.add(own);
        };
        const added = (node: Node) => {
            if (!(node instanceof HTMLElement)) return;
            owner(node);
            for (const inner of node.querySelectorAll<HTMLElement>(CELL)) touched.add(inner);
        };
        for (const record of records) {
            // Content swapped inside a cell, or whole cells / rows mounted.
            owner(record.target);
            record.addedNodes.forEach(added);
        }
        for (const cell of touched) this.applyStop(cell, this.isActiveCell(cell));
        this.ensureActive();
    }

    /** Make sure the grid has an active cell that exists (the nearest if it vanished). */
    private ensureActive() {
        if (!this.container) return;
        const exists = this.active !== null && this.cellEl(this.active) !== null;
        // A default is re-picked as the grid fills in (rows arrive after the header,
        // columns after the rows) until the user chooses a cell themselves.
        if (exists && !this.activeIsDefault) return;
        const model = this.buildModel();
        const next =
            this.active && !this.activeIsDefault
                ? resolvePosition(model, this.active, this.activeRowIndex)
                : defaultPosition(model);
        if (exists && samePos(next, this.active)) return;
        if (this.active === null || this.activeIsDefault) this.activeIsDefault = next !== null;
        const previous = this.active ? this.cellEl(this.active) : null;
        this.active = next;
        if (previous) this.applyStop(previous, false);
        if (!next) return;
        this.activeRowIndex = Math.max(0, model.rowIds.indexOf(next.rowId));
        const cell = this.cellEl(next);
        if (cell) this.applyStop(cell, true);
    }

    private setActive(pos: GridPos) {
        if (samePos(pos, this.active)) {
            this.activeIsDefault = false;
            return;
        }
        this.activeIsDefault = false;
        const previous = this.active ? this.cellEl(this.active) : null;
        this.active = pos;
        this.activeRowIndex = Math.max(
            0,
            this.rowEls().findIndex((r) => r.getAttribute(GRID_ROW_ATTR) === pos.rowId)
        );
        if (previous) this.applyStop(previous, false);
        const cell = this.cellEl(pos);
        if (cell) this.applyStop(cell, true);
    }

    private activateFrom(node: EventTarget | null) {
        if (!(node instanceof Element) || !this.container) return;
        const cell = node.closest<HTMLElement>(CELL);
        if (!cell || !this.container.contains(cell)) return;
        const pos = posOf(cell);
        if (pos) this.setActive(pos);
    }

    private focusCell(pos: GridPos, cell: HTMLElement | null = this.cellEl(pos)) {
        if (!cell) return;
        this.setActive(pos);
        targetOf(cell).focus();
    }

    // ── keys ─────────────────────────────────────────────────────────────────

    private onKeyDown(event: KeyboardEvent) {
        const container = this.container;
        // A key somebody already handled (the drag library while a row is lifted,
        // an editor) is not ours.
        if (!container || event.defaultPrevented) return;
        const node = event.target;
        if (!(node instanceof HTMLElement)) return;
        const cell = node.closest<HTMLElement>(CELL);
        if (!cell || !container.contains(cell)) return;
        // Only a key pressed ON the cell's focus target: inside an editor (an input,
        // an open select) the arrows belong to the editor.
        if (node !== targetOf(cell) || node.matches(TEXT_ENTRY)) return;

        const intent = intentForKey(event, getComputedStyle(container).direction === "rtl");
        const from = posOf(cell);
        if (!intent || !from) return;

        const model = this.buildModel();
        const next = nextPosition(model, from, intent, this.pageSize());
        event.preventDefault();
        if (next && !samePos(next, from)) this.focusCell(next);
    }

    /** Rows in a screenful, less one so the last row stays in view for context. */
    private pageSize(): number {
        const container = this.container;
        if (!container) return 10;
        const bodyRow = container.querySelector<HTMLElement>(
            `${ROW}:not([${GRID_ROW_ATTR}="${GRID_HEADER_ROW}"])`
        );
        const rowHeight = bodyRow?.offsetHeight || 36;
        const header = container.querySelector<HTMLElement>(
            `[${GRID_ROW_ATTR}="${GRID_HEADER_ROW}"]`
        );
        const room = container.clientHeight - (header?.offsetHeight ?? 0);
        return Math.max(1, Math.floor(room / rowHeight) - 1);
    }
}

// ── React side ───────────────────────────────────────────────────────────────

/** The grid's controller for the rows inside it. The value never changes, so a
 *  memoized row that reads it is never re-rendered by it. */
export const GridNavContext = createContext<GridNav | null>(null);

export const useGridNav = (): GridNav | null => useContext(GridNavContext);

/** Create the controller and the ref callback that attaches it to the grid element. */
export const useGridNavController = () => {
    const nav = useMemo(() => new GridNav(), []);
    const cleanup = useRef<(() => void) | null>(null);
    const gridRef = useCallback(
        (element: HTMLElement | null) => {
            cleanup.current?.();
            cleanup.current = element ? nav.attach(element) : null;
        },
        [nav]
    );
    return { nav, gridRef };
};
