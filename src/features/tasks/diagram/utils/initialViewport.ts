import { getViewportForBounds } from "@xyflow/react";

/**
 * Where the task graph's first view goes (MIP-1681).
 *
 * The graph always opened with `fitView`: the WHOLE graph, whatever its size. A milestone of 20
 * tasks is about 1,550 x 2,160 px, so on a 1440 x 900 screen that is a zoom of about 0.27 and a
 * card title is about 3 px high: the first screen showed that there is a graph and nothing else.
 *
 * The rule now:
 *  - the whole graph fits at a zoom people can read (`MIN_FIT_ZOOM` or more): fit it, as before;
 *  - otherwise open at `READABLE_ZOOM`, on the card the person came from (the "you are here"
 *    card) or, with none, the top of the graph (the milestone and its first row). The minimap and
 *    the Fit button still show the whole graph.
 *
 * Pure: plain numbers in, a viewport out, so it is cheap and testable without a browser. Returns
 * `null` for a pane that has no size yet or bounds that are not finite, so a caller never writes
 * a NaN viewport (the bug the deferred fit effect exists to avoid).
 */

/** Below this the whole graph is not drawn at a readable size, so it is not fitted. */
export const MIN_FIT_ZOOM = 0.55;
/** The zoom a big graph opens at: a card title is about 9 px, a card about 170 px wide. */
export const READABLE_ZOOM = 0.65;
/** The share of the pane left empty around a fitted graph (React Flow's `padding`). */
export const FIT_PADDING = 0.15;
/** Room above the focused card when it is anchored to the top, and around the graph's edges. */
const EDGE_GAP = 32;

export type Rect = { x: number; y: number; width: number; height: number };

export type ViewportPlan = {
    x: number;
    y: number;
    zoom: number;
    /** `fit`: the whole graph, as `fitView` does. `focus`: a readable zoom on one card. */
    kind: "fit" | "focus";
};

export type InitialViewportInput = {
    /** The box around every card. */
    bounds: Rect;
    /** The size of the canvas, in px. */
    pane: { width: number; height: number };
    /** The card to open on: the one the person came from, or the milestone's own. */
    focus: Rect | null;
    /** `top`: the card's top near the top of the pane (the milestone, with its rows below). `center`: the
     *  card in the middle (a card somewhere inside the graph). */
    focusAt: "top" | "center";
    minZoom: number;
    maxZoom: number;
};

const finite = (...values: number[]) => values.every((v) => Number.isFinite(v));

/** Keep `value` inside [low, high]; if the range is empty (the graph is smaller than the pane), centre it. */
const clampOrCentre = (value: number, low: number, high: number) =>
    low > high ? (low + high) / 2 : Math.min(Math.max(value, low), high);

export const planInitialViewport = ({
    bounds,
    pane,
    focus,
    focusAt,
    minZoom,
    maxZoom,
}: InitialViewportInput): ViewportPlan | null => {
    if (bounds.width <= 0 || bounds.height <= 0 || pane.width <= 0 || pane.height <= 0)
        return null;

    const fit = getViewportForBounds(
        bounds,
        pane.width,
        pane.height,
        minZoom,
        maxZoom,
        FIT_PADDING
    );
    if (finite(fit.x, fit.y, fit.zoom) && fit.zoom >= MIN_FIT_ZOOM) return { ...fit, kind: "fit" };

    const zoom = Math.min(Math.max(READABLE_ZOOM, minZoom), maxZoom);
    const card = focus ?? { x: bounds.x, y: bounds.y, width: 0, height: 0 };

    // Horizontally, the card's own centre goes to the middle of the pane (with no card, the
    // graph's left edge to the left of it), and the view never scrolls past the graph's edges.
    // A graph narrower than the pane at this zoom has no room to scroll: it is centred.
    const wantX = focus
        ? pane.width / 2 - (card.x + card.width / 2) * zoom
        : EDGE_GAP - bounds.x * zoom;
    const x = clampOrCentre(
        wantX,
        pane.width - EDGE_GAP - (bounds.x + bounds.width) * zoom,
        EDGE_GAP - bounds.x * zoom
    );

    // Vertically: the card's top near the top of the pane, or the card in the middle; a graph
    // shorter than the pane is centred, as above.
    const wantY =
        focusAt === "center"
            ? pane.height / 2 - (card.y + card.height / 2) * zoom
            : EDGE_GAP - card.y * zoom;
    const y = clampOrCentre(
        wantY,
        pane.height - EDGE_GAP - (bounds.y + bounds.height) * zoom,
        EDGE_GAP - bounds.y * zoom
    );

    return finite(x, y, zoom) ? { x, y, zoom, kind: "focus" } : null;
};
