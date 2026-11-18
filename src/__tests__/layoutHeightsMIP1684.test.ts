/**
 * MIP-1684: the layout's card slot is the height the card is drawn at.
 *
 * The slot was 140 px for every card, but a task card is drawn 148 px tall and a milestone card
 * 198 px (measured in a browser: the title is clamped to two lines, so a task card is 148 whatever
 * it holds). So a card overflowed its slot, the gap under a milestone card was 32 px instead of
 * 90, and the lines started below where the layout thought the card ended. jsdom cannot draw a
 * card, so the heights are pinned as numbers here and were measured in the browser (see the PR).
 */
import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import {
    computeDiagramLayout,
    LANE_GAP,
    layoutDiagramNodes,
    MARGIN,
    MILESTONE_NODE_HEIGHT,
    NODE_HEIGHT,
    NODE_WIDTH,
    RANK_GAP,
    type DiagramLayoutInput,
} from "../features/tasks/diagram/utils/layoutDiagram";

const spec = (over: Partial<DiagramLayoutInput> = {}): DiagramLayoutInput => ({
    nodeIds: [1, 2, 3],
    rootId: 1,
    parentOf: new Map([
        [2, 1],
        [3, 1],
    ]),
    dependencies: [],
    ghostIds: new Set(),
    ...over,
});

describe("the card slot", () => {
    it("is the height the cards are drawn at: 148 for a task, 198 for a milestone", () => {
        expect(NODE_HEIGHT).toBe(148);
        expect(MILESTONE_NODE_HEIGHT).toBe(198);
    });

    it("keeps the gap under a task card at RANK_GAP", () => {
        const at = computeDiagramLayout(spec());
        expect(at.get(2)!.y - (at.get(1)!.y + NODE_HEIGHT)).toBe(RANK_GAP);
    });

    it("keeps the gap under a TALLER card (a milestone) at RANK_GAP too", () => {
        const at = computeDiagramLayout(spec({ heights: new Map([[1, MILESTONE_NODE_HEIGHT]]) }));
        expect(at.get(2)!.y - (at.get(1)!.y + MILESTONE_NODE_HEIGHT)).toBe(RANK_GAP);
        // The old slot would have left 90 - 58 = 32 px of gap under the drawn card.
        expect(at.get(2)!.y - (at.get(1)!.y + MILESTONE_NODE_HEIGHT)).toBeGreaterThan(32);
    });

    it("stacks rows by the height of their cards, with LANE_GAP between them", () => {
        // 12 loose tasks: rows of 5. The second row starts one slot and one gap below the first.
        const parents = Array.from({ length: 12 }, (_, i) => [i + 2, 1] as [number, number]);
        const at = computeDiagramLayout(
            spec({ nodeIds: [1, ...parents.map(([c]) => c)], parentOf: new Map(parents) })
        );
        const ys = [...new Set(parents.map(([c]) => at.get(c)!.y))].sort((a, b) => a - b);
        expect(ys.length).toBe(3);
        expect(ys[1] - ys[0]).toBe(NODE_HEIGHT + 50);
    });

    it("a row is as tall as its tallest card: a milestone among loose tasks", () => {
        // 12 loose tasks under 1, 2 of them a milestone: rows of 5; the first row holds 2.
        const parents = Array.from({ length: 12 }, (_, i) => [i + 2, 1] as [number, number]);
        const at = computeDiagramLayout(
            spec({
                nodeIds: [1, ...parents.map(([c]) => c)],
                parentOf: new Map(parents),
                heights: new Map([[2, MILESTONE_NODE_HEIGHT]]),
            })
        );
        const rows = [...new Set(parents.map(([c]) => at.get(c)!.y))].sort((a, b) => a - b);
        expect(rows[1] - rows[0]).toBe(MILESTONE_NODE_HEIGHT + LANE_GAP);
    });

    it("a row is as tall as its tallest BLOCK: a milestone with a child among loose tasks", () => {
        // 2 (a milestone) has a child 20; with 1..6 loose siblings the first row holds 2 and 5 more.
        const parents: Array<[number, number]> = [
            ...[2, 3, 4, 5, 6, 7].map((c) => [c, 1] as [number, number]),
            [20, 2],
        ];
        const at = computeDiagramLayout(
            spec({
                nodeIds: [1, 2, 3, 4, 5, 6, 7, 20],
                parentOf: new Map(parents),
                heights: new Map([[2, MILESTONE_NODE_HEIGHT]]),
            })
        );
        const blockHeight = MILESTONE_NODE_HEIGHT + RANK_GAP + NODE_HEIGHT;
        const rows = [...new Set([2, 3, 4, 5, 6, 7].map((c) => at.get(c)!.y))].sort(
            (a, b) => a - b
        );
        expect(rows.length).toBe(2);
        expect(rows[1] - rows[0]).toBe(blockHeight + LANE_GAP);
    });

    it("a milestone child in a lower group pushes its own children down by ITS height", () => {
        // 1 -> 2 (a milestone) -> 3
        const at = computeDiagramLayout(
            spec({
                nodeIds: [1, 2, 3],
                parentOf: new Map([
                    [2, 1],
                    [3, 2],
                ]),
                heights: new Map([[2, MILESTONE_NODE_HEIGHT]]),
            })
        );
        expect(at.get(3)!.y - at.get(2)!.y).toBe(MILESTONE_NODE_HEIGHT + RANK_GAP);
        expect(at.get(2)!.y - at.get(1)!.y).toBe(NODE_HEIGHT + RANK_GAP);
    });
});

describe("the React Flow adapter", () => {
    const node = (id: number, data: Record<string, unknown> = {}): Node => ({
        id: String(id),
        type: "task",
        position: { x: 0, y: 0 },
        data,
    });
    const structure = (p: number, c: number): Edge => ({
        id: `s${p}-${c}`,
        source: String(p),
        target: String(c),
        data: { kind: "structure" },
    });

    it("sets each node to its own height: milestone 198, task 148", () => {
        const out = layoutDiagramNodes(
            [node(1, { isRoot: true, isMilestone: true }), node(2), node(3)],
            [structure(1, 2), structure(1, 3)]
        );
        const byId = (id: string) => out.find((n) => n.id === id)!;
        expect(byId("1").height).toBe(MILESTONE_NODE_HEIGHT);
        expect(byId("2").height).toBe(NODE_HEIGHT);
        expect(byId("1").width).toBe(NODE_WIDTH);
    });

    it("lays the children out below the milestone's drawn bottom", () => {
        const out = layoutDiagramNodes(
            [node(1, { isRoot: true, isMilestone: true }), node(2)],
            [structure(1, 2)]
        );
        const byId = (id: string) => out.find((n) => n.id === id)!;
        expect(byId("1").position.y).toBe(MARGIN);
        expect(byId("2").position.y).toBe(MARGIN + MILESTONE_NODE_HEIGHT + RANK_GAP);
    });
});
