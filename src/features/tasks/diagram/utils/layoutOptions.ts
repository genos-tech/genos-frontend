import { DIAGRAM_STATUS_ORDER } from "../../meta/taskStatuses";
import { READABLE_ZOOM } from "./initialViewport";
import { COL_GAP, FREE_ROW_COLUMNS, MARGIN, NODE_WIDTH } from "./layoutDiagram";

/**
 * What the canvas tells the layout about the person and the screen (MIP-1683). Pure, so the rules
 * are testable without a browser.
 */

const STATUS_ORDER = DIAGRAM_STATUS_ORDER;
const PRIORITY_ORDER = ["Critical", "High", "Normal", "Low", "Minimal"];

/**
 * How early a card should come among its siblings: active work first. WIP, then Blocked, Open and
 * Pending; closed, deleted and anything unknown last. Within a status, by priority (Critical to
 * Minimal, none last). Lower is earlier. The caller keeps the number it first computed for a
 * card, so a status edit while the graph is open does not move cards around.
 */
export const activeWorkRank = (
    status: string | null | undefined,
    priority: string | null | undefined
): number => {
    const s = STATUS_ORDER.indexOf(status ?? "");
    const p = PRIORITY_ORDER.indexOf(priority ?? "");
    return (s === -1 ? STATUS_ORDER.length : s) * 10 + (p === -1 ? PRIORITY_ORDER.length : p);
};

/** The columns of cards a row of unrelated tasks holds at the readable zoom: it fills the canvas. */
export const MIN_ROW_COLUMNS = 3;
export const MAX_ROW_COLUMNS = 8;

/**
 * How many columns a row of unrelated tasks wraps at, from the canvas width: as many as fit across
 * the pane at the zoom the graph opens at (`READABLE_ZOOM`), between `MIN_ROW_COLUMNS` and
 * `MAX_ROW_COLUMNS`. A pane with no width yet gets the layout's own default.
 */
export const rowColumnsFor = (paneWidth: number): number => {
    if (!Number.isFinite(paneWidth) || paneWidth <= 0) return FREE_ROW_COLUMNS;
    const flowWidth = paneWidth / READABLE_ZOOM - 2 * MARGIN;
    const columns = Math.floor((flowWidth + COL_GAP) / (NODE_WIDTH + COL_GAP));
    return Math.min(MAX_ROW_COLUMNS, Math.max(MIN_ROW_COLUMNS, columns));
};
