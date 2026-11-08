// The keyboard model of the task table (MIP-1230): where an arrow key goes.
//
// The table is an ARIA treegrid with ONE tab stop (a roving tabindex): the active
// cell is in the Tab order, every other cell is reached with the arrow keys. This
// file is the pure part, with no DOM: given the rows and columns that exist right
// now, a key and the reading direction, it says which cell is next. `useGridNav`
// reads the DOM into a `GridModel` and applies the answer.
//
// Cells are identified by (row id, column key), never by a DOM node, so the active
// cell survives a re-render, a re-sort and a row that unmounts (`resolvePosition`
// falls back to the nearest row).

export type GridPos = { rowId: string; col: string };

/** Logical directions: `prevCell` / `nextCell` already account for RTL. */
export type GridIntent =
    | "prevCell"
    | "nextCell"
    | "prevRow"
    | "nextRow"
    | "rowStart"
    | "rowEnd"
    | "gridStart"
    | "gridEnd"
    | "pageUp"
    | "pageDown";

export type GridModel = {
    /** Every column key in reading order (the leading gutter, then the columns). */
    colOrder: readonly string[];
    /** Row ids top to bottom; the header row (if it is part of the grid) comes first. */
    rowIds: readonly string[];
    /** The column keys a row has a navigable cell for. Rows differ: a leaf row has
     *  no expand cell, a nested leaf no graph button. Any order; sorted here. */
    colsOf: (rowId: string) => readonly string[];
};

type KeyLike = {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
};

/** The grid move a key asks for, or null when the key is not the grid's. */
export const intentForKey = (event: KeyLike, rtl: boolean): GridIntent | null => {
    if (event.altKey || event.metaKey || event.shiftKey) return null;
    if (event.ctrlKey) {
        if (event.key === "Home") return "gridStart";
        if (event.key === "End") return "gridEnd";
        return null;
    }
    switch (event.key) {
        case "ArrowLeft":
            return rtl ? "nextCell" : "prevCell";
        case "ArrowRight":
            return rtl ? "prevCell" : "nextCell";
        case "ArrowUp":
            return "prevRow";
        case "ArrowDown":
            return "nextRow";
        case "Home":
            return "rowStart";
        case "End":
            return "rowEnd";
        case "PageUp":
            return "pageUp";
        case "PageDown":
            return "pageDown";
        default:
            return null;
    }
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** A row's columns in reading order (unknown keys last, in the order given). */
const orderedCols = (model: GridModel, rowId: string): string[] => {
    const rank = (col: string) => {
        const i = model.colOrder.indexOf(col);
        return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...model.colsOf(rowId)]
        .map((col, i) => ({ col, i }))
        .sort((a, b) => rank(a.col) - rank(b.col) || a.i - b.i)
        .map((x) => x.col);
};

/**
 * The column of `rowId` closest to `col`: the same one when the row has it,
 * otherwise the nearest in reading order (the earlier one on a tie). Moving
 * down from the title of a row onto a header, or from the graph button onto a
 * row that has none, keeps you in the same place on screen.
 */
export const closestCol = (model: GridModel, rowId: string, col: string): string | null => {
    const cols = orderedCols(model, rowId);
    if (cols.length === 0) return null;
    if (cols.includes(col)) return col;
    const at = model.colOrder.indexOf(col);
    if (at === -1) return cols[0];
    let best = cols[0];
    let bestDistance = Number.MAX_SAFE_INTEGER;
    for (const candidate of cols) {
        const distance = Math.abs(model.colOrder.indexOf(candidate) - at);
        if (distance < bestDistance) {
            best = candidate;
            bestDistance = distance;
        }
    }
    return best;
};

const at = (model: GridModel, rowIndex: number, col: string): GridPos | null => {
    const rowId = model.rowIds[rowIndex];
    if (rowId === undefined) return null;
    const target = closestCol(model, rowId, col);
    return target === null ? null : { rowId, col: target };
};

/**
 * The cell a move lands on. Never wraps: at an edge the position is unchanged
 * (the caller still swallows the key so the page does not scroll). Returns null
 * only when `from` is not in the model.
 */
export const nextPosition = (
    model: GridModel,
    from: GridPos,
    intent: GridIntent,
    pageSize = 10
): GridPos | null => {
    const rowIndex = model.rowIds.indexOf(from.rowId);
    if (rowIndex === -1) return null;
    const cols = orderedCols(model, from.rowId);
    const colIndex = cols.indexOf(from.col);
    const last = model.rowIds.length - 1;
    const page = Math.max(1, Math.floor(pageSize));

    switch (intent) {
        case "prevCell":
        case "nextCell": {
            if (colIndex === -1) return null;
            const next = clamp(colIndex + (intent === "nextCell" ? 1 : -1), 0, cols.length - 1);
            return { rowId: from.rowId, col: cols[next] };
        }
        case "rowStart":
            return cols.length ? { rowId: from.rowId, col: cols[0] } : null;
        case "rowEnd":
            return cols.length ? { rowId: from.rowId, col: cols[cols.length - 1] } : null;
        case "prevRow":
            return at(model, clamp(rowIndex - 1, 0, last), from.col) ?? from;
        case "nextRow":
            return at(model, clamp(rowIndex + 1, 0, last), from.col) ?? from;
        case "pageUp":
            return at(model, clamp(rowIndex - page, 0, last), from.col) ?? from;
        case "pageDown":
            return at(model, clamp(rowIndex + page, 0, last), from.col) ?? from;
        case "gridStart": {
            const first = model.rowIds[0];
            const cells = first === undefined ? [] : orderedCols(model, first);
            return first !== undefined && cells.length ? { rowId: first, col: cells[0] } : null;
        }
        case "gridEnd": {
            const final = model.rowIds[last];
            const cells = final === undefined ? [] : orderedCols(model, final);
            return final !== undefined && cells.length
                ? { rowId: final, col: cells[cells.length - 1] }
                : null;
        }
    }
};

/**
 * Where the active cell is now. The remembered cell when it still exists; when
 * its row is gone (filtered out, collapsed, deleted) the row now at the same
 * index, i.e. the nearest one, in the nearest column; null for an empty grid.
 * `lastRowIndex` is the index the row had when it was last active.
 */
export const resolvePosition = (
    model: GridModel,
    pos: GridPos,
    lastRowIndex: number
): GridPos | null => {
    if (model.rowIds.includes(pos.rowId)) {
        const col = closestCol(model, pos.rowId, pos.col);
        return col === null ? null : { rowId: pos.rowId, col };
    }
    if (model.rowIds.length === 0) return null;
    return at(model, clamp(lastRowIndex, 0, model.rowIds.length - 1), pos.col);
};

/** Where a Tab into the table lands when nothing was active yet: the first body
 *  row's title (or its first cell), else the first header cell. */
export const defaultPosition = (model: GridModel, preferredCol = "title"): GridPos | null => {
    const rowId = model.rowIds[1] ?? model.rowIds[0];
    if (rowId === undefined) return null;
    const col = closestCol(model, rowId, preferredCol);
    if (col !== null) return { rowId, col };
    return model.rowIds[0] !== undefined && rowId !== model.rowIds[0]
        ? defaultPositionIn(model, model.rowIds[0])
        : null;
};

const defaultPositionIn = (model: GridModel, rowId: string): GridPos | null => {
    const cols = orderedCols(model, rowId);
    return cols.length ? { rowId, col: cols[0] } : null;
};
