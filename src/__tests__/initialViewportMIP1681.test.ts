/**
 * MIP-1681: the task graph's first view.
 *
 * It always opened with `fitView`, the whole graph, so a milestone of 20 tasks (about
 * 1,550 x 2,160 px) opened at a zoom of about 0.27: card titles about 3 px high. Now the whole graph
 * is fitted only if it stays readable; otherwise the view opens at a readable zoom on the card the
 * person came from. These pin the rule on plain numbers; the wiring into the canvas (an instant
 * first placement, no init fit) is pinned in the source below, and the real zoom was measured in a
 * browser.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getViewportForBounds } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import {
    FIT_PADDING,
    MIN_FIT_ZOOM,
    planInitialViewport,
    READABLE_ZOOM,
    type InitialViewportInput,
} from "../features/tasks/diagram/utils/initialViewport";

const PANE = { width: 1352, height: 729 };
const base = (over: Partial<InitialViewportInput> = {}): InitialViewportInput => ({
    bounds: { x: 24, y: 24, width: 1550, height: 2160 },
    pane: PANE,
    focus: { x: 650, y: 24, width: 260, height: 140 },
    focusAt: "top",
    minZoom: 0.25,
    maxZoom: 2,
    ...over,
});

describe("a graph that stays readable is fitted, as before", () => {
    it("fits a small graph exactly as React Flow's own fit would", () => {
        const bounds = { x: 24, y: 24, width: 900, height: 500 };
        const plan = planInitialViewport(base({ bounds }));
        const fit = getViewportForBounds(bounds, PANE.width, PANE.height, 0.25, 2, FIT_PADDING);
        expect(plan).toEqual({ ...fit, kind: "fit" });
        expect(plan!.zoom).toBeGreaterThanOrEqual(MIN_FIT_ZOOM);
    });

    it("the line is MIN_FIT_ZOOM: just readable fits, just below does not", () => {
        // React Flow's fit zoom is pane / (graph * 1.15): in a 1000 px pane, 1550 px of graph gives
        // 0.561 and 1700 px gives 0.512.
        const pane = { width: 1000, height: 1000 };
        const fits = planInitialViewport(
            base({ pane, bounds: { x: 0, y: 0, width: 1550, height: 100 } })
        );
        const not = planInitialViewport(
            base({ pane, bounds: { x: 0, y: 0, width: 1700, height: 100 } })
        );
        expect(fits?.kind).toBe("fit");
        expect(fits!.zoom).toBeCloseTo(0.561, 2);
        expect(not?.kind).toBe("focus");
    });
});

describe("a big graph opens at a readable zoom, not at a thumbnail", () => {
    it("the real shape of a 20-task milestone on a 1440 x 900 screen", () => {
        const plan = planInitialViewport(base());
        // The whole graph would have been fitted at about 0.27.
        const fit = getViewportForBounds(
            base().bounds,
            PANE.width,
            PANE.height,
            0.25,
            2,
            FIT_PADDING
        );
        expect(fit.zoom).toBeLessThan(0.3);
        expect(plan).toMatchObject({ kind: "focus", zoom: READABLE_ZOOM });
    });

    it("anchored to the top: the milestone's card starts near the top edge, its first row below", () => {
        const plan = planInitialViewport(base())!;
        // card top (24) * zoom + y = the 32 px gap
        expect(plan.y + 24 * plan.zoom).toBeCloseTo(32, 5);
    });

    it("anchored to the centre: a card inside the graph lands in the middle of the pane", () => {
        // Wide and tall enough that neither side fits, so the card decides both.
        const bounds = { x: 24, y: 24, width: 4000, height: 3000 };
        const focus = { x: 2000, y: 1200, width: 260, height: 140 };
        const plan = planInitialViewport(base({ bounds, focus, focusAt: "center" }))!;
        expect(plan.y + (1200 + 70) * plan.zoom).toBeCloseTo(PANE.height / 2, 5);
        expect(plan.x + (2000 + 130) * plan.zoom).toBeCloseTo(PANE.width / 2, 5);
    });

    it("centres the graph when its whole width fits at that zoom", () => {
        const bounds = { x: 24, y: 24, width: 1000, height: 3000 };
        const plan = planInitialViewport(base({ bounds, focus: null }))!;
        const graphW = bounds.width * READABLE_ZOOM;
        expect(plan.x).toBeCloseTo((PANE.width - graphW) / 2 - bounds.x * READABLE_ZOOM, 5);
        // Whatever card it opens on: a graph with no room to scroll does not follow it.
        const onRight = { x: 900, y: 24, width: 260, height: 140 };
        expect(planInitialViewport(base({ bounds, focus: onRight }))!.x).toBeCloseTo(plan.x, 5);
    });

    it("centres the graph when its whole height fits at that zoom (a wide, shallow graph)", () => {
        const bounds = { x: 24, y: 24, width: 6000, height: 400 };
        const plan = planInitialViewport(base({ bounds, focus: null }))!;
        const graphH = bounds.height * READABLE_ZOOM;
        expect(plan.y).toBeCloseTo((PANE.height - graphH) / 2 - bounds.y * READABLE_ZOOM, 5);
    });

    it("never scrolls past the graph's edges: a card at the far left or bottom is clamped", () => {
        const bounds = { x: 24, y: 24, width: 4000, height: 3000 };
        const left = { x: 24, y: 2000, width: 260, height: 140 };
        const a = planInitialViewport(base({ bounds, focus: left, focusAt: "center" }))!;
        // the graph's left edge is not pushed in from the pane's edge by more than the gap
        expect(a.x + 24 * a.zoom).toBeLessThanOrEqual(32 + 1e-9);
        const bottom = { x: 800, y: 2884, width: 260, height: 100 };
        const b = planInitialViewport(base({ bounds, focus: bottom, focusAt: "center" }))!;
        // its bottom edge is not above the pane's bottom edge by more than the gap
        expect(b.y + (24 + 3000) * b.zoom).toBeGreaterThanOrEqual(PANE.height - 32 - 1e-9);
    });

    it("with no card to open on, it opens at the top left of the graph", () => {
        const bounds = { x: 24, y: 24, width: 3000, height: 3000 };
        const plan = planInitialViewport(base({ bounds, focus: null }))!;
        expect(plan.x + 24 * plan.zoom).toBeCloseTo(32, 5);
        expect(plan.y + 24 * plan.zoom).toBeCloseTo(32, 5);
    });

    it("keeps the zoom inside the canvas's own limits", () => {
        expect(planInitialViewport(base({ minZoom: 0.8 }))!.zoom).toBe(0.8);
        expect(planInitialViewport(base({ maxZoom: 0.6, minZoom: 0.25 }))!.zoom).toBe(0.6);
    });
});

describe("it never writes a viewport that is not a number", () => {
    it.each([
        [
            "a pane with no width yet (the dialog is still opening)",
            { pane: { width: 0, height: 700 } },
        ],
        ["a pane with no height", { pane: { width: 900, height: 0 } }],
        ["bounds that are NaN", { bounds: { x: NaN, y: 0, width: 100, height: 100 } }],
        ["bounds with no size (no nodes)", { bounds: { x: 0, y: 0, width: 0, height: 0 } }],
        ["an infinite pane", { pane: { width: Infinity, height: 700 } }],
    ])("%s gives no plan, so the caller falls back to fitView", (_name, over) => {
        expect(planInitialViewport(base(over as Partial<InitialViewportInput>))).toBeNull();
    });

    it("over many random graphs and panes, every plan is finite and inside the zoom limits", () => {
        let seed = 7;
        const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        for (let i = 0; i < 500; i++) {
            const bounds = {
                x: rnd() * 100,
                y: rnd() * 100,
                width: 200 + rnd() * 6000,
                height: 200 + rnd() * 6000,
            };
            const plan = planInitialViewport(
                base({
                    bounds,
                    pane: { width: 300 + rnd() * 2000, height: 300 + rnd() * 1200 },
                    focus:
                        rnd() > 0.2
                            ? {
                                  x: bounds.x + rnd() * bounds.width,
                                  y: bounds.y + rnd() * bounds.height,
                                  width: 260,
                                  height: 140,
                              }
                            : null,
                    focusAt: rnd() > 0.5 ? "top" : "center",
                })
            );
            expect(plan).not.toBeNull();
            expect([plan!.x, plan!.y, plan!.zoom].every(Number.isFinite)).toBe(true);
            expect(plan!.zoom).toBeGreaterThanOrEqual(0.25);
            expect(plan!.zoom).toBeLessThanOrEqual(2);
        }
    });
});

describe("the canvas uses it", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
        join(here, "../features/tasks/diagram/components/TaskFlowCanvas.tsx"),
        "utf8"
    );

    it("plans the view from the nodes, the pane and the card the person came from", () => {
        expect(src).toContain("planInitialViewport({");
        expect(src).toContain("getNodesBounds(current)");
        // The "you are here" card first, the milestone's own card otherwise.
        expect(src).toMatch(/lit\("isCurrentPreview"\) \?\? lit\("isRoot"\)/);
        expect(src).toMatch(/focusAt: lit\("isCurrentPreview"\) \? "center" : "top"/);
    });

    it("does not also fit on its own: React Flow's init fit showed a thumbnail first", () => {
        // `<ReactFlow … fitView …>` re-fitted the whole graph on the first measure, and the readable
        // zoom then animated in from it. The one placement is the effect's.
        expect(src).not.toMatch(/\n\s+fitView\n/);
        expect(src).not.toContain("fitViewOptions");
    });

    it("places the first view at once, and animates only the later ones", () => {
        expect(src).toContain("const viewPlacedRef = useRef(false)");
        expect(src).toContain("const duration = viewPlacedRef.current ? 300 : 0;");
        expect(src).toContain("viewPlacedRef.current = true;");
    });
});
