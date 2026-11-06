/**
 * The task graph's default layout (MIP-1094): where every card goes.
 *
 * The rules are what makes the picture read as a plan, so they are asserted as
 * rules, on small hand-made graphs and on the real shape of a large milestone:
 *  - a parent sits above its children, centred over them;
 *  - a blocker sits left of what it blocks, wherever they are in the tree;
 *  - cards never overlap;
 *  - width follows the longest chain of work, not the number of siblings;
 *  - tasks with no dependencies wrap instead of forming one long line;
 *  - an outside task is drawn beside the card it connects to;
 *  - the answer is the same every time, and a loop in the data can't hang it.
 */
import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import {
    COL_GAP,
    computeDiagramLayout,
    dependencyColumns,
    FREE_ROW_COLUMNS,
    layoutDiagramNodes,
    NODE_HEIGHT,
    NODE_WIDTH,
    RANK_GAP,
    type DiagramLayoutInput,
    type Position,
} from "../features/tasks/diagram/utils/layoutDiagram";

type Dep = [number, number];

const input = (
    parents: Array<[number, number]>,
    deps: Dep[] = [],
    over: Partial<DiagramLayoutInput> = {}
): DiagramLayoutInput => {
    const ids = new Set<number>();
    for (const [c, p] of parents) {
        ids.add(c);
        ids.add(p);
    }
    for (const [a, b] of deps) {
        ids.add(a);
        ids.add(b);
    }
    return {
        nodeIds: [...ids],
        rootId: parents.length > 0 ? parents[0][1] : null,
        parentOf: new Map(parents),
        dependencies: deps.map(([blocker, blocked]) => ({ blocker, blocked })),
        ghostIds: new Set(),
        ...over,
    };
};

const overlap = (a: Position, b: Position) =>
    a.x < b.x + NODE_WIDTH &&
    b.x < a.x + NODE_WIDTH &&
    a.y < b.y + NODE_HEIGHT &&
    b.y < a.y + NODE_HEIGHT;

/** The rules every layout must meet, whatever the graph. */
const expectSound = (spec: DiagramLayoutInput, result: Map<number, Position>) => {
    const ids = [...new Set(spec.nodeIds)];
    expect([...result.keys()].sort((a, b) => a - b)).toEqual(ids.sort((a, b) => a - b));
    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            expect(
                overlap(result.get(ids[i])!, result.get(ids[j])!),
                `${ids[i]} overlaps ${ids[j]}`
            ).toBe(false);
        }
    }
    for (const [child, parent] of spec.parentOf) {
        if (!result.has(child) || !result.has(parent)) continue;
        expect(
            result.get(child)!.y,
            `${child} must be below its parent ${parent}`
        ).toBeGreaterThanOrEqual(result.get(parent)!.y + NODE_HEIGHT + RANK_GAP);
    }
};

const widthOf = (result: Map<number, Position>) => {
    const xs = [...result.values()].map((p) => p.x);
    return Math.max(...xs) + NODE_WIDTH - Math.min(...xs);
};
const widestRow = (result: Map<number, Position>) => {
    const rows = new Map<number, number>();
    for (const p of result.values()) rows.set(p.y, (rows.get(p.y) ?? 0) + 1);
    return Math.max(...rows.values());
};

describe("dependencyColumns", () => {
    it("is the length of the longest chain of blockers before a card", () => {
        // 1 -> 2 -> 4 and 1 -> 3 -> 4, and 3 -> 5: the diamond's far side is 2 away.
        const cols = dependencyColumns(
            [1, 2, 3, 4, 5],
            [
                { blocker: 1, blocked: 2 },
                { blocker: 1, blocked: 3 },
                { blocker: 2, blocked: 4 },
                { blocker: 3, blocked: 4 },
                { blocker: 3, blocked: 5 },
            ]
        );
        expect([1, 2, 3, 4, 5].map((id) => cols.get(id))).toEqual([0, 1, 1, 2, 2]);
    });

    it("takes the longest of two routes to the same card", () => {
        const cols = dependencyColumns(
            [1, 2, 3, 4],
            [
                { blocker: 1, blocked: 4 },
                { blocker: 1, blocked: 2 },
                { blocker: 2, blocked: 3 },
                { blocker: 3, blocked: 4 },
            ]
        );
        expect(cols.get(4)).toBe(3);
    });

    it("puts cards with no dependency in column 0", () => {
        const cols = dependencyColumns([7, 8], []);
        expect([cols.get(7), cols.get(8)]).toEqual([0, 0]);
    });

    it("ignores a self-edge and edges to unknown cards", () => {
        const cols = dependencyColumns(
            [1, 2],
            [
                { blocker: 1, blocked: 1 },
                { blocker: 2, blocked: 99 },
                { blocker: 99, blocked: 1 },
            ]
        );
        expect([cols.get(1), cols.get(2)]).toEqual([0, 0]);
    });

    it("finishes on a loop, drops one edge of it, and drops the same one every time", () => {
        const loop = [
            { blocker: 1, blocked: 2 },
            { blocker: 2, blocked: 3 },
            { blocker: 3, blocked: 1 },
        ];
        const a = dependencyColumns([1, 2, 3], loop);
        const b = dependencyColumns([3, 2, 1], [...loop].reverse());
        expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
        // The edge that closes the loop (3 -> 1) goes: the chain 1 -> 2 -> 3 stays.
        expect([1, 2, 3].map((id) => a.get(id))).toEqual([0, 1, 2]);
    });
});

describe("computeDiagramLayout", () => {
    it("puts a parent above its children and centres it over them", () => {
        const spec = input([
            [2, 1],
            [3, 1],
            [4, 1],
        ]);
        const result = computeDiagramLayout(spec);
        expectSound(spec, result);
        const kids = [2, 3, 4].map((id) => result.get(id)!);
        const lo = Math.min(...kids.map((k) => k.x));
        const hi = Math.max(...kids.map((k) => k.x)) + NODE_WIDTH;
        expect(result.get(1)!.x + NODE_WIDTH / 2).toBeCloseTo((lo + hi) / 2);
    });

    it("puts a blocker left of what it blocks, in a chain", () => {
        const spec = input(
            [
                [2, 1],
                [3, 1],
                [4, 1],
                [5, 1],
            ],
            [
                [2, 3],
                [3, 4],
                [4, 5],
            ]
        );
        const result = computeDiagramLayout(spec);
        expectSound(spec, result);
        for (const [a, b] of [
            [2, 3],
            [3, 4],
            [4, 5],
        ]) {
            expect(result.get(a)!.x + NODE_WIDTH + COL_GAP).toBeLessThanOrEqual(result.get(b)!.x);
        }
    });

    it("keeps a blocker left of what it blocks when they are in different branches", () => {
        // Task 3 is under 1, task 6 under 4; 3 blocks 6.
        const spec = input(
            [
                [1, 0],
                [4, 0],
                [2, 1],
                [3, 1],
                [5, 4],
                [6, 4],
            ],
            [
                [2, 3],
                [3, 6],
            ]
        );
        const result = computeDiagramLayout(spec);
        expectSound(spec, result);
        expect(result.get(3)!.x + NODE_WIDTH).toBeLessThan(result.get(6)!.x);
    });

    it("stacks tasks that can run in parallel in the same column", () => {
        const spec = input(
            [
                [2, 1],
                [3, 1],
                [4, 1],
            ],
            [
                [2, 4],
                [3, 4],
            ]
        );
        const result = computeDiagramLayout(spec);
        expectSound(spec, result);
        expect(result.get(2)!.x).toBe(result.get(3)!.x);
        expect(result.get(2)!.y).not.toBe(result.get(3)!.y);
    });

    it("sizes the width by the longest chain, not by the number of siblings", () => {
        // Four tasks in a chain, plus 26 more with nothing to do with it.
        const parents: Array<[number, number]> = [];
        for (let id = 2; id <= 31; id++) parents.push([id, 1]);
        const spec = input(parents, [
            [2, 3],
            [3, 4],
            [4, 5],
        ]);
        const result = computeDiagramLayout(spec);
        expectSound(spec, result);
        // 30 side by side would be 30 * 310 - 50 = 9,250 px.
        expect(widthOf(result)).toBeLessThanOrEqual(
            FREE_ROW_COLUMNS * (NODE_WIDTH + COL_GAP) + 4 * (NODE_WIDTH + COL_GAP)
        );
    });

    it("wraps thirty unrelated tasks into rows instead of one long line", () => {
        const parents: Array<[number, number]> = [];
        for (let id = 2; id <= 31; id++) parents.push([id, 1]);
        const spec = input(parents);
        const result = computeDiagramLayout(spec);
        expectSound(spec, result);
        expect(widestRow(result)).toBeLessThanOrEqual(FREE_ROW_COLUMNS);
        expect(widthOf(result)).toBeLessThanOrEqual(FREE_ROW_COLUMNS * (NODE_WIDTH + COL_GAP));
    });

    it("wraps whole unrelated branches too, not only single tasks", () => {
        // Twelve tasks, each with two subtasks, none with a dependency.
        const parents: Array<[number, number]> = [];
        for (let i = 0; i < 12; i++) {
            const task = 10 + i * 3;
            parents.push([task, 1], [task + 1, task], [task + 2, task]);
        }
        const spec = input(parents);
        const result = computeDiagramLayout(spec);
        expectSound(spec, result);
        expect(widthOf(result)).toBeLessThanOrEqual(FREE_ROW_COLUMNS * 2 * (NODE_WIDTH + COL_GAP));
    });

    it("lets branches whose columns don't overlap share a row", () => {
        // Branch A (tasks 10-12) runs in columns 0-1; branch B (20-22) in columns 4-5.
        const spec = input(
            [
                [10, 1],
                [20, 1],
                [11, 10],
                [12, 10],
                [21, 20],
                [22, 20],
                [30, 1],
                [31, 1],
                [32, 1],
                [33, 1],
                [34, 1],
            ],
            [
                [11, 12],
                [30, 31],
                [31, 32],
                [32, 33],
                [33, 34],
                [34, 21],
                [21, 22],
            ]
        );
        const result = computeDiagramLayout(spec);
        expectSound(spec, result);
        expect(result.get(10)!.y).toBe(result.get(20)!.y);
    });

    it("is the same whatever order the cards are given in", () => {
        const spec = input(
            [
                [2, 1],
                [3, 1],
                [4, 1],
                [5, 4],
                [6, 4],
            ],
            [
                [2, 3],
                [5, 6],
                [3, 5],
            ]
        );
        const a = computeDiagramLayout(spec);
        const b = computeDiagramLayout({
            ...spec,
            nodeIds: [...spec.nodeIds].reverse(),
            dependencies: [...spec.dependencies].reverse(),
        });
        expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
    });

    it("finishes on a loop of dependencies", () => {
        const spec = input(
            [
                [2, 1],
                [3, 1],
                [4, 1],
            ],
            [
                [2, 3],
                [3, 4],
                [4, 2],
            ]
        );
        expectSound(spec, computeDiagramLayout(spec));
    });

    it("finishes on a loop of parents, and still places every card", () => {
        const spec = input(
            [
                [2, 1],
                [20, 21],
                [21, 20],
            ],
            [],
            { rootId: 1 }
        );
        const result = computeDiagramLayout(spec);
        expect([...result.keys()].sort((a, b) => a - b)).toEqual([1, 2, 20, 21]);
        for (const [a, b] of [
            [1, 2],
            [1, 20],
            [1, 21],
            [2, 20],
            [2, 21],
            [20, 21],
        ]) {
            expect(overlap(result.get(a)!, result.get(b)!)).toBe(false);
        }
    });

    it("lays out nothing for nothing, and one card for one card", () => {
        expect(computeDiagramLayout(input([])).size).toBe(0);
        const one = computeDiagramLayout({ ...input([]), nodeIds: [5], rootId: 5 });
        expect([...one.keys()]).toEqual([5]);
    });

    it("keeps the root first: a card whose parent is hidden goes after it, whatever the ids", () => {
        // 9 and 0 have no parent in the graph (their parent is hidden). The root is
        // 5, a higher id than 0: it still comes first, in the top row.
        const spec = input(
            [
                [6, 5],
                [7, 5],
            ],
            [],
            { nodeIds: [0, 5, 6, 7, 9], rootId: 5 }
        );
        const result = computeDiagramLayout(spec);
        expectSound(spec, result);
        expect(result.get(5)!.y).toBe(24);
        expect(result.get(0)!.x).toBeGreaterThan(result.get(5)!.x);
        expect(result.get(9)!.x).toBeGreaterThan(result.get(0)!.x);
    });

    describe("outside tasks (ghosts)", () => {
        // 2 and 3 under 1; 4 under 5; an outside task 90 blocked by 3.
        const spec = (deps: Dep[]) =>
            input(
                [
                    [2, 1],
                    [3, 1],
                    [4, 5],
                    [5, 1],
                ],
                deps,
                { nodeIds: [1, 2, 3, 4, 5, 90], ghostIds: new Set([90]) }
            );

        it("is drawn in the group of the card it connects to, not beside the root", () => {
            const s = spec([[3, 90]]);
            const result = computeDiagramLayout(s);
            expectSound(s, result);
            // Below the root, in the row of 3's siblings.
            expect(result.get(90)!.y).toBeGreaterThanOrEqual(
                result.get(1)!.y + NODE_HEIGHT + RANK_GAP
            );
            expect(Math.abs(result.get(90)!.y - result.get(3)!.y)).toBeLessThan(
                NODE_HEIGHT * 3 + RANK_GAP * 2
            );
        });

        it("sits right of its blocker, and left of what it blocks", () => {
            const after = computeDiagramLayout(spec([[3, 90]]));
            expect(after.get(3)!.x + NODE_WIDTH).toBeLessThan(after.get(90)!.x);
            const before = computeDiagramLayout(spec([[90, 3]]));
            expect(before.get(90)!.x + NODE_WIDTH).toBeLessThan(before.get(3)!.x);
        });

        it("follows the lowest-id card when it connects to several", () => {
            const s = spec([
                [4, 90],
                [3, 90],
            ]);
            const result = computeDiagramLayout(s);
            expectSound(s, result);
            expect(Math.abs(result.get(90)!.y - result.get(3)!.y)).toBeLessThan(
                Math.abs(result.get(90)!.y - result.get(4)!.y) + 1
            );
        });

        it("still gets a place when nothing real connects to it", () => {
            const s = spec([]);
            const result = computeDiagramLayout(s);
            expectSound(s, result);
        });
    });
});

/**
 * The real shape of a large milestone (MIP-1068, "hide closed" on): a milestone,
 * six phases, 28 tasks under them, two outside tasks and 24 dependencies, most of
 * them chaining across phases. Titles and statuses don't matter to positions.
 */
describe("a real milestone", () => {
    const PARENTS: Array<[number, number]> = [
        // phases and MIP-625 under the milestone (2050)
        ...[2051, 2057, 2063, 2068, 2071, 1334].map((id) => [id, 2050] as [number, number]),
        // phase 1 (MIP-1070 is closed and hidden)
        ...[2053, 2054, 2055, 2056].map((id) => [id, 2051] as [number, number]),
        // phase 2
        ...[2058, 2059, 2060, 2061, 2062].map((id) => [id, 2057] as [number, number]),
        // phase 3
        ...[2064, 2065, 2066, 2067].map((id) => [id, 2063] as [number, number]),
        // phase 4
        ...[1472, 2069, 2070].map((id) => [id, 2068] as [number, number]),
        // phase 5
        ...[2072, 2073, 2074].map((id) => [id, 2071] as [number, number]),
        // MIP-625's own tasks
        ...[1675, 2049, 2048, 2047, 2023, 1631, 1255, 2075].map(
            (id) => [id, 1334] as [number, number]
        ),
    ];
    const DEPS: Dep[] = [
        [1255, 1337],
        [2055, 1472],
        [2054, 1675],
        [1255, 1853],
        [2053, 2055],
        [2054, 2055],
        [2055, 2056],
        [2058, 2059],
        [2059, 2061],
        [2060, 2061],
        [2061, 2062],
        [2056, 2064],
        [2064, 2065],
        [2065, 2066],
        [2064, 2067],
        [2066, 2069],
        [1472, 2070],
        [2069, 2070],
        [1472, 2072],
        [2069, 2072],
        [2053, 2073],
        [2072, 2073],
        [2072, 2074],
        [1472, 2075],
    ];
    const GHOSTS = new Set([1337, 1853]);
    const spec = input(PARENTS, DEPS, {
        rootId: 2050,
        ghostIds: GHOSTS,
        nodeIds: [2050, ...PARENTS.map(([c]) => c), ...GHOSTS],
    });
    const result = computeDiagramLayout(spec);

    it("places all 36 cards without overlap, parents above children", () => {
        expect(result.size).toBe(36);
        expectSound(spec, result);
    });

    it("runs every one of the 24 dependencies left to right", () => {
        for (const [a, b] of DEPS) {
            expect(result.get(a)!.x + NODE_WIDTH, `${a} -> ${b}`).toBeLessThan(result.get(b)!.x);
        }
    });

    it("is about 9 columns wide, where one row of tasks was 27 cards (8,300 px)", () => {
        expect(widthOf(result)).toBeLessThanOrEqual(10 * (NODE_WIDTH + COL_GAP));
        expect(widestRow(result)).toBeLessThanOrEqual(6);
    });

    it("draws the two outside tasks beside the task that blocks them (MIP-598)", () => {
        const blocker = result.get(1255)!;
        for (const ghost of GHOSTS) {
            const at = result.get(ghost)!;
            expect(at.x).toBeGreaterThan(blocker.x);
            expect(Math.abs(at.y - blocker.y)).toBeLessThanOrEqual(NODE_HEIGHT * 2 + 100);
        }
    });
});

describe("layoutDiagramNodes (the React Flow adapter)", () => {
    const node = (id: number, data: Record<string, unknown> = {}): Node => ({
        id: String(id),
        type: "task",
        position: { x: 0, y: 0 },
        data,
    });
    const structure = (parent: number, child: number): Edge => ({
        id: `s-${parent}-${child}`,
        source: String(parent),
        target: String(child),
        data: { kind: "structure" },
    });
    const dependency = (blocker: number, blocked: number): Edge => ({
        id: `d-${blocker}-${blocked}`,
        source: String(blocker),
        target: String(blocked),
        data: { kind: "dependency" },
    });

    it("returns nothing for nothing", () => {
        const none: Node[] = [];
        expect(layoutDiagramNodes(none, [])).toBe(none);
    });

    it("gives every node a position and its size, and keeps the rest of the node", () => {
        const nodes = [node(1, { isRoot: true, label: "root" }), node(2), node(3)];
        const out = layoutDiagramNodes(nodes, [
            structure(1, 2),
            structure(1, 3),
            dependency(2, 3),
        ]);
        expect(out.map((n) => n.id)).toEqual(["1", "2", "3"]);
        for (const n of out) {
            expect(n.width).toBe(NODE_WIDTH);
            expect(n.height).toBe(NODE_HEIGHT);
            expect(Number.isFinite(n.position.x) && Number.isFinite(n.position.y)).toBe(true);
        }
        expect(out[0].data).toEqual({ isRoot: true, label: "root" });
        expect(out[0].type).toBe("task");
    });

    it("reads structure edges as parent -> child and dependency edges as blocker -> blocked", () => {
        const out = layoutDiagramNodes(
            [node(1, { isRoot: true }), node(2), node(3)],
            [structure(1, 2), structure(1, 3), dependency(3, 2)]
        );
        const at = (id: string) => out.find((n) => n.id === id)!.position;
        expect(at("2").y).toBeGreaterThan(at("1").y);
        expect(at("3").x + NODE_WIDTH).toBeLessThan(at("2").x);
    });

    it("treats an external node as a ghost and the isRoot node as the root", () => {
        const out = layoutDiagramNodes(
            [node(1, { isRoot: true }), node(2), node(90, { isExternal: true })],
            [structure(1, 2), dependency(2, 90)]
        );
        const at = (id: string) => out.find((n) => n.id === id)!.position;
        // The ghost is in 2's group, below the root, not in the root's row.
        expect(at("90").y).toBeGreaterThan(at("1").y);
        expect(at("90").x).toBeGreaterThan(at("2").x);
    });

    it("puts the isRoot node first even when a stray card has a lower id", () => {
        // Card 0 has no edges at all (its parent is hidden); the root is 5.
        const out = layoutDiagramNodes(
            [node(0), node(5, { isRoot: true }), node(6)],
            [structure(5, 6)]
        );
        const at = (id: string) => out.find((n) => n.id === id)!.position;
        expect(at("5").y).toBe(24);
        expect(at("0").x).toBeGreaterThan(at("5").x);
    });
});
