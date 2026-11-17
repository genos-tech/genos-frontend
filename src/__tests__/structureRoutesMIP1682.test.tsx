/**
 * MIP-1682: a parent-child line never runs behind a card.
 *
 * A parent's children are laid out in rows. React Flow draws every line straight down from the
 * parent, across at the middle of the gap, down again; for a child in the second row or later the
 * middle of the gap is IN the row above, so the line ran behind its cards and siblings looked like a
 * chain. Those children now get a route through the gaps: down under the parent, to a spine in the
 * gutter left of the group, down the spine, along the gap above the child's row, into the child.
 *
 * The rule is geometric, so it is asserted as geometry on the real shape of three open milestones
 * (the ids and the dependencies, no titles) and on random graphs: no segment of a route enters any
 * card. The same count on the old path is asserted too, so the test fails on the bug it is about.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { render } from "@testing-library/react";
import type { Edge, EdgeProps, Node } from "@xyflow/react";
import { describe, expect, it, vi } from "vitest";

import { ParentChildEdge } from "../features/tasks/diagram/components/ParentChildEdge";
import {
    layoutDiagramNodes,
    layoutDiagramWithGroups,
    NODE_HEIGHT,
    NODE_WIDTH,
    type Position,
} from "../features/tasks/diagram/utils/layoutDiagram";
import { layoutDiagramGraph } from "../features/tasks/diagram/utils/layoutDiagramGraph";
import {
    computeStructureRoutes,
    roundedPolylinePath,
    routePoints,
    routeStructureEdges,
    SPINE_GAP,
    type RoutePoint,
    type StructureRoute,
} from "../features/tasks/diagram/utils/structureRoutes";

// The edge asks React Flow where the two cards are now (to know if one was dragged away).
const cards: { at: Record<string, { x: number; y: number }>; asked: number } = {
    at: {},
    asked: 0,
};
vi.mock("@xyflow/react", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@xyflow/react")>()),
    useInternalNode: (id: string) => {
        cards.asked++;
        return cards.at[id] ? { internals: { positionAbsolute: cards.at[id] } } : undefined;
    },
}));

type Shape = {
    root: number;
    parents: Array<[number, number]>;
    ghosts: number[];
    deps: Array<[number, number]>;
};

// The real structure of three open milestones of this workspace, read on 2026-11-17 with closed
// tasks hidden: ids and dependencies only. FINAL is one milestone with 17 loose tasks.
const FINAL: Shape = {
    root: 1474,
    parents: [
        [2681, 1474],
        [2594, 1474],
        [2677, 1474],
        [2676, 1474],
        [2262, 1474],
        [2668, 1474],
        [2659, 1474],
        [2657, 1474],
        [2652, 1474],
        [1919, 1474],
        [2584, 1474],
        [2447, 1474],
        [2198, 1474],
        [2171, 1474],
        [2011, 1474],
        [1979, 1474],
        [2321, 1474],
    ],
    ghosts: [],
    deps: [],
};

const LANDING: Shape = {
    root: 2231,
    parents: [
        [2233, 2231],
        [2248, 2231],
        [2242, 2231],
        [2240, 2231],
        [2239, 2231],
        [2238, 2231],
        [2237, 2231],
        [2236, 2231],
        [2251, 2231],
        [2250, 2231],
        [2249, 2231],
        [2247, 2231],
        [2246, 2231],
        [2245, 2231],
        [2244, 2231],
        [2243, 2231],
        [2241, 2231],
        [2235, 2231],
        [2234, 2231],
        [2232, 2231],
    ],
    ghosts: [2611, 2617, 2616],
    deps: [
        [2617, 2233],
        [2611, 2237],
        [2611, 2238],
        [2611, 2239],
        [2611, 2240],
        [2616, 2240],
        [2611, 2242],
        [2233, 2247],
        [2611, 2248],
    ],
};

const MARKETING: Shape = {
    root: 2363,
    parents: [
        [2371, 2363],
        [2619, 2371],
        [2648, 2371],
        [2620, 2371],
        [2618, 2371],
        [2520, 2371],
        [2622, 2363],
        [2612, 2363],
        [2617, 2363],
        [2610, 2363],
        [2613, 2363],
        [2611, 2363],
        [2616, 2363],
        [2615, 2363],
        [2614, 2363],
    ],
    ghosts: [2233, 2237, 2238, 2239, 2240, 2242, 2248],
    deps: [
        [2617, 2233],
        [2611, 2237],
        [2611, 2238],
        [2611, 2239],
        [2611, 2240],
        [2616, 2240],
        [2611, 2242],
        [2611, 2248],
        [2610, 2611],
        [2612, 2613],
        [2610, 2616],
    ],
};

const layout = (shape: Shape) => {
    const ids = new Set<number>([shape.root, ...shape.ghosts]);
    for (const [c, p] of shape.parents) {
        ids.add(c);
        ids.add(p);
    }
    const parentOf = new Map(shape.parents);
    const { positions, groups } = layoutDiagramWithGroups({
        nodeIds: [...ids],
        rootId: shape.root,
        parentOf,
        dependencies: shape.deps.map(([blocker, blocked]) => ({ blocker, blocked })),
        ghostIds: new Set(shape.ghosts),
    });
    return { positions, parentOf, groups };
};

/** card -> its children, for hand-made positions (the layout gives the real thing). */
const groupsOf = (parentOf: ReadonlyMap<number, number>) => {
    const groups = new Map<number, number[]>();
    for (const [child, parent] of parentOf)
        groups.set(parent, [...(groups.get(parent) ?? []), child]);
    return groups;
};

type Seg = [[number, number], [number, number]];
const segments = (points: readonly RoutePoint[]): Seg[] =>
    points.slice(0, -1).map((p, i) => [p, points[i + 1]] as Seg);

/** The line a route draws, with the connection points where the layout's own card slots put them
 *  (the bottom centre of the parent, the top centre of the child). */
const lineOf = (route: StructureRoute, extra = 0): RoutePoint[] =>
    routePoints(route, {
        sourceX: route.parent[0] + NODE_WIDTH / 2,
        sourceY: route.parent[1] + NODE_HEIGHT + extra,
        targetX: route.child[0] + NODE_WIDTH / 2,
        targetY: route.child[1],
    });
/** Does a straight horizontal or vertical segment enter the inside of a card? */
const enters = ([[x1, y1], [x2, y2]]: Seg, card: Position, taller = 0) =>
    Math.max(x1, x2) > card.x + 0.01 &&
    Math.min(x1, x2) < card.x + NODE_WIDTH - 0.01 &&
    Math.max(y1, y2) > card.y + 0.01 &&
    Math.min(y1, y2) < card.y + NODE_HEIGHT + taller - 0.01;

/** What React Flow draws without a route: down, across at the middle of the gap, down. */
const normalPath = (parent: Position, child: Position): RoutePoint[] => {
    const sx = parent.x + NODE_WIDTH / 2;
    const sy = parent.y + NODE_HEIGHT;
    const tx = child.x + NODE_WIDTH / 2;
    const mid = (sy + child.y) / 2;
    return [
        [sx, sy],
        [sx, mid],
        [tx, mid],
        [tx, child.y],
    ];
};

const cardsCrossedBy = (
    points: readonly RoutePoint[],
    positions: ReadonlyMap<number, Position>,
    taller = 0
) => {
    let crossed = 0;
    for (const seg of segments(points))
        for (const card of positions.values()) if (enters(seg, card, taller)) crossed++;
    return crossed;
};

describe.each([
    ["Final updates (17 loose tasks)", FINAL],
    ["Landing page content (20 tasks, 3 outside)", LANDING],
    ["Marketing Strategy V2 (a parent with 5 children, 7 outside)", MARKETING],
])("the real shape of %s", (_name, shape) => {
    const { positions, parentOf, groups } = layout(shape);
    const routes = computeStructureRoutes(positions, parentOf, groups);

    it("has lines that ran behind cards, and the old path is the proof", () => {
        const behind = [...parentOf].filter(
            ([child, parent]) =>
                cardsCrossedBy(
                    normalPath(positions.get(parent)!, positions.get(child)!),
                    positions
                ) >
                // the two cards the line is joining are touched at its ends, not crossed
                0
        );
        expect(behind.length).toBeGreaterThan(0);
        // …and every one of them got a route (a route can be given to a line that happened to be
        // clear too: it is never worse).
        for (const [child] of behind) expect(routes.has(child)).toBe(true);
    });

    it("no segment of any route enters a card", () => {
        expect(routes.size).toBeGreaterThan(0);
        for (const [, route] of routes) expect(cardsCrossedBy(lineOf(route), positions)).toBe(0);
    });

    it("nor when the cards are drawn taller than their slot, as they are (148 px, not 140)", () => {
        // The connection point of a task card is 12 px below the slot, and the card 8 px.
        for (const [, route] of routes) {
            expect(cardsCrossedBy(lineOf(route, 12), positions, 8)).toBe(0);
        }
    });
});

describe("the route's shape", () => {
    const { positions, parentOf, groups } = layout(FINAL);
    const routes = computeStructureRoutes(positions, parentOf, groups);
    const rows = [...new Set([...parentOf.keys()].map((c) => positions.get(c)!.y))].sort(
        (a, b) => a - b
    );

    it("only a child below the first row gets one: 17 loose tasks are 4 rows, 12 routes", () => {
        expect(rows.length).toBe(4);
        const inFirstRow = [...parentOf.keys()].filter((c) => positions.get(c)!.y === rows[0]);
        expect(inFirstRow.length).toBe(5);
        expect(routes.size).toBe(17 - 5);
        for (const c of inFirstRow) expect(routes.has(c)).toBe(false);
    });

    it("starts at the parent's bottom centre and ends at the child's top centre, axis-aligned", () => {
        for (const [child, route] of routes) {
            const parent = positions.get(parentOf.get(child)!)!;
            const card = positions.get(child)!;
            const line = lineOf(route);
            expect(line[0]).toEqual([parent.x + NODE_WIDTH / 2, parent.y + NODE_HEIGHT]);
            expect(line[line.length - 1]).toEqual([card.x + NODE_WIDTH / 2, card.y]);
            expect(route.parent).toEqual([parent.x, parent.y]);
            expect(route.child).toEqual([card.x, card.y]);
            for (const [[x1, y1], [x2, y2]] of segments(line))
                expect(x1 === x2 || y1 === y2).toBe(true);
        }
    });

    it("every later row hangs from ONE spine, left of every card of the group", () => {
        const spines = new Set([...routes.values()].map((r) => r.spineX));
        expect(spines.size).toBe(1);
        const [spine] = [...spines];
        const leftmost = Math.min(...[...parentOf.keys()].map((c) => positions.get(c)!.x));
        expect(spine).toBe(leftmost - SPINE_GAP);
    });

    it("runs along the gap above ITS row, not the row above's", () => {
        for (const [child, route] of routes) {
            const card = positions.get(child)!;
            expect(route.aboveRowY).toBeLessThan(card.y);
            expect(route.aboveRowY).toBeGreaterThan(card.y - 50);
        }
    });
});

describe("a spine clears whole subtrees, not just the children", () => {
    // 1 has children 2 and 3; 3 has five children of its own, wide enough that its subtree reaches
    // further left than 3 itself; more children of 1 wrap to a second row.
    const parents: Array<[number, number]> = [];
    for (const c of [2, 3, 4, 5, 6, 7, 8, 9]) parents.push([c, 1]);
    for (const g of [10, 11, 12, 13, 14, 15]) parents.push([g, 2]);
    const { positions, parentOf, groups } = layout({ root: 1, parents, ghosts: [], deps: [] });
    const routes = computeStructureRoutes(positions, parentOf, groups);

    it("the spine is left of every descendant of the parent", () => {
        expect(routes.size).toBeGreaterThan(0);
        const leftOfAll = Math.min(
            ...[...positions.entries()].filter(([id]) => id !== 1).map(([, p]) => p.x)
        );
        for (const route of routes.values()) expect(route.spineX).toBeLessThan(leftOfAll);
        for (const route of routes.values())
            expect(cardsCrossedBy(lineOf(route), positions)).toBe(0);
    });
});

describe("it leaves alone what it cannot draw better", () => {
    const at = (x: number, y: number): Position => ({ x, y });

    it("one row of children: no routes", () => {
        const positions = new Map([
            [1, at(300, 0)],
            [2, at(0, 230)],
            [3, at(310, 230)],
            [4, at(620, 230)],
        ]);
        const parentOf = new Map([
            [2, 1],
            [3, 1],
            [4, 1],
        ]);
        expect(computeStructureRoutes(positions, parentOf, groupsOf(parentOf)).size).toBe(0);
    });

    it("a child above its parent (a loop in the data): the normal path", () => {
        const positions = new Map([
            [1, at(0, 500)],
            [2, at(0, 0)],
            [3, at(300, 0)],
            [4, at(0, 100)],
        ]);
        const parentOf = new Map([
            [2, 1],
            [3, 1],
            [4, 1],
        ]);
        expect(computeStructureRoutes(positions, parentOf, groupsOf(parentOf)).size).toBe(0);
    });

    it("a parent that is its own child, or an id with no position, does not throw", () => {
        const positions = new Map([
            [1, at(0, 0)],
            [2, at(0, 230)],
        ]);
        const parentOf = new Map([
            [1, 1],
            [2, 1],
            [9, 1],
            [2, 9],
        ]);
        expect(() =>
            computeStructureRoutes(positions, parentOf, groupsOf(parentOf))
        ).not.toThrow();
    });

    it("a parent loop cannot recurse forever", () => {
        const positions = new Map([
            [1, at(0, 0)],
            [2, at(0, 230)],
            [3, at(0, 460)],
        ]);
        const parentOf = new Map([
            [2, 1],
            [3, 2],
            [1, 3],
        ]);
        expect(() =>
            computeStructureRoutes(positions, parentOf, groupsOf(parentOf))
        ).not.toThrow();
    });
});

describe("a card in the group that has no line of its own", () => {
    // The router is given the layout's groups: the members of a group are not all children. If one
    // that is not (an outside task, were it ever drawn in the group) sits in a row above the first
    // child, a child's line must not take that row for the gap under the parent.
    const at = (x: number, y: number): Position => ({ x, y });
    const positions = new Map([
        [1, at(300, 24)],
        [100, at(24, 254)],
        [2, at(24, 484)],
        [3, at(334, 484)],
    ]);
    const parentOf = new Map([
        [2, 1],
        [3, 1],
    ]);
    const groups = new Map([[1, [100, 2, 3]]]);

    it("routes the children below it, whose normal path would cross it", () => {
        const routes = computeStructureRoutes(positions, parentOf, groups);
        expect([...routes.keys()].sort()).toEqual([2, 3]);
        // The normal path of 2: down from 1, across at the middle of the 24..484 span, down: through 100.
        expect(
            cardsCrossedBy(normalPath(positions.get(1)!, positions.get(2)!), positions)
        ).toBeGreaterThan(0);
        for (const route of routes.values()) {
            expect(cardsCrossedBy(lineOf(route), positions)).toBe(0);
        }
    });

    it("the first row it is in is the group's first row", () => {
        const routes = computeStructureRoutes(positions, parentOf, groups);
        for (const route of routes.values()) expect(route.firstRowY).toBe(254);
    });
});

describe("over random graphs", () => {
    it("no route enters a card (400 graphs, thousands of routes)", () => {
        let seed = 11;
        const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        let routed = 0;
        for (let t = 0; t < 400; t++) {
            const n = 3 + Math.floor(rnd() * 70);
            const ids = Array.from({ length: n }, (_, i) => i + 1);
            // Outside tasks have no parent and no child of their own, only dependencies.
            const ghosts = ids.filter((id) => id !== 1 && rnd() < 0.08);
            const real = ids.filter((id) => !ghosts.includes(id));
            const parents: Array<[number, number]> = [];
            for (let i = 1; i < real.length; i++) {
                if (rnd() < 0.92) parents.push([real[i], real[Math.floor(rnd() * i)]]);
            }
            const deps: Array<[number, number]> = [];
            for (let d = 0; d < Math.floor(rnd() * n * 0.6); d++) {
                const a = 1 + Math.floor(rnd() * n);
                const b = 1 + Math.floor(rnd() * n);
                if (a !== b) deps.push([a, b]);
            }
            const { positions, parentOf, groups } = layout({ root: 1, parents, ghosts, deps });
            for (const route of computeStructureRoutes(positions, parentOf, groups).values()) {
                routed++;
                expect(cardsCrossedBy(lineOf(route), positions)).toBe(0);
            }
        }
        expect(routed).toBeGreaterThan(1000);
    });
});

describe("routeStructureEdges", () => {
    const { positions, parentOf, groups } = layout(FINAL);
    const structure = (parent: number, child: number): Edge => ({
        id: `s${parent}-${child}`,
        source: String(parent),
        target: String(child),
        type: "structure",
        data: { kind: "structure", parentTaskId: parent },
    });
    const dependency = (blocker: number, blocked: number): Edge => ({
        id: `d${blocker}-${blocked}`,
        source: String(blocker),
        target: String(blocked),
        type: "dependency",
        data: { kind: "dependency" },
    });
    const edges = [...parentOf].map(([c, p]) => structure(p, c));
    const routed = computeStructureRoutes(positions, parentOf, groups);

    it("sets the route on the structure edge of a later-row child, and only there", () => {
        const out = routeStructureEdges(positions, groups, edges);
        for (const edge of out) {
            const route = (edge.data as { route?: StructureRoute }).route;
            expect(route !== undefined).toBe(routed.has(Number(edge.target)));
        }
        expect(out.filter((e) => (e.data as { route?: StructureRoute }).route).length).toBe(
            routed.size
        );
    });

    it("hands back the very same edge object when it needs no route (nothing re-renders)", () => {
        const out = routeStructureEdges(positions, groups, edges);
        for (let i = 0; i < edges.length; i++) {
            if (!routed.has(Number(edges[i].target))) expect(out[i]).toBe(edges[i]);
        }
    });

    it("never touches a dependency edge, even into a child that has a route", () => {
        const [lateChild] = [...routed.keys()];
        const dep = dependency(2, lateChild);
        const out = routeStructureEdges(positions, groups, [...edges, dep]);
        expect(out[out.length - 1]).toBe(dep);
    });

    it("returns the same array when there is nothing to route", () => {
        const two = new Map([
            [1, { x: 0, y: 0 }],
            [2, { x: 0, y: 230 }],
        ]);
        const only = [structure(1, 2)];
        expect(routeStructureEdges(two, new Map([[1, [2]]]), only)).toBe(only);
    });
});

describe("roundedPolylinePath", () => {
    it("starts at the first point and ends at the last", () => {
        const d = roundedPolylinePath(
            [
                [0, 0],
                [0, 100],
                [200, 100],
                [200, 200],
            ],
            8
        );
        expect(d.startsWith("M 0,0")).toBe(true);
        expect(d.endsWith("L 200,200")).toBe(true);
    });

    it("rounds each inner corner with a curve through the corner point", () => {
        const d = roundedPolylinePath(
            [
                [0, 0],
                [0, 100],
                [200, 100],
            ],
            8
        );
        expect(d).toBe("M 0,0 L 0,92 Q 0,100 8,100 L 200,100");
    });

    it("cuts a corner back by at most half of the shorter side next to it", () => {
        const d = roundedPolylinePath(
            [
                [0, 0],
                [0, 10],
                [200, 10],
            ],
            8
        );
        // the 10 px side is cut by 5, not 8
        expect(d).toBe("M 0,0 L 0,5 Q 0,10 5,10 L 200,10");
    });

    it("ignores repeated points and handles one and two points", () => {
        expect(
            roundedPolylinePath(
                [
                    [0, 0],
                    [0, 0],
                    [0, 50],
                ],
                8
            )
        ).toBe("M 0,0 L 0,50");
        expect(roundedPolylinePath([[3, 4]], 8)).toBe("M 3,4");
        expect(roundedPolylinePath([], 8)).toBe("");
    });
});

const edgeProps = (over: Partial<EdgeProps>, data: Record<string, unknown>): EdgeProps =>
    ({
        id: "e",
        sourceX: 100,
        sourceY: 0,
        targetX: 300,
        targetY: 290,
        sourcePosition: "bottom",
        targetPosition: "top",
        selected: false,
        data,
        ...over,
    }) as unknown as EdgeProps;

describe("the edge", () => {
    // Where the layout put the two cards, and the connection points React Flow reports for them: the
    // parent's is lower than its slot (the card is drawn taller than 140), so the line is built from
    // the points, not from the slot.
    const route: StructureRoute = {
        parent: [0, 0],
        child: [200, 460],
        spineX: -25,
        firstRowY: 230,
        aboveRowY: 435,
    };
    const props = (over: Partial<EdgeProps> = {}, data: Record<string, unknown> = { route }) =>
        edgeProps(
            {
                source: "1",
                target: "2",
                sourceX: 130,
                sourceY: 152,
                targetX: 330,
                targetY: 456,
                ...over,
            },
            data
        );
    const drawn = (p: EdgeProps) => {
        const { container } = render(
            <CssVarsProvider>
                <svg>
                    <ParentChildEdge {...p} />
                </svg>
            </CssVarsProvider>
        );
        return (
            container.querySelector("path.react-flow__edge-path") as SVGPathElement
        ).getAttribute("d")!;
    };
    const home = () => {
        cards.at = { "1": { x: 0, y: 0 }, "2": { x: 200, y: 460 } };
    };

    it("draws the route when both cards are where it was computed", () => {
        home();
        const d = drawn(props());
        // From the parent's connection point, along the spine at x=-25 and the line above the child's row
        expect(d.startsWith("M 130,152")).toBe(true);
        expect(d).toContain("-25,");
        expect(d).toContain(",435");
        expect(d.endsWith("L 330,456")).toBe(true);
    });

    it("runs between the parent's real connection point and the first row, not its slot", () => {
        home();
        // sourceY 152 and the first row at 230: the line under the parent is at their middle, 191.
        expect(drawn(props())).toContain(",191");
        // A taller parent (a milestone card, 198 px): its point is at 226 and the line moves with it.
        expect(drawn(props({ sourceY: 226 }))).toContain(",228");
    });

    it("draws the normal path when there is no route, and does not ask React Flow anything", () => {
        home();
        cards.asked = 0;
        expect(drawn(props({}, {}))).not.toContain("-25,");
        // Most lines have no route: they must not each subscribe to the cards.
        expect(cards.asked).toBe(0);
    });

    it("draws the normal path once either card has been dragged away from the route", () => {
        cards.at = { "1": { x: 0, y: 0 }, "2": { x: 240, y: 460 } };
        expect(drawn(props())).not.toContain("-25,");
        cards.at = { "1": { x: 0, y: 40 }, "2": { x: 200, y: 460 } };
        expect(drawn(props())).not.toContain("-25,");
    });

    it("does not draw the route before React Flow knows the cards", () => {
        cards.at = {};
        expect(drawn(props())).not.toContain("-25,");
    });

    it("keeps the route through a pixel of rounding", () => {
        cards.at = { "1": { x: 0.9, y: -1 }, "2": { x: 200.8, y: 460.4 } };
        expect(drawn(props())).toContain("-25,");
    });
});

describe("routePoints", () => {
    it("goes under the parent, to the spine, down it, along above the child's row, into the child", () => {
        const route: StructureRoute = {
            parent: [0, 0],
            child: [200, 460],
            spineX: -25,
            firstRowY: 230,
            aboveRowY: 435,
        };
        expect(
            routePoints(route, { sourceX: 130, sourceY: 152, targetX: 330, targetY: 456 })
        ).toEqual([
            [130, 152],
            [130, 191],
            [-25, 191],
            [-25, 435],
            [330, 435],
            [330, 456],
        ]);
    });
});

describe("the graph adapter the canvas calls", () => {
    // React Flow nodes and edges as the canvas builds them.
    const nodes: Node[] = [{ id: "1", position: { x: 0, y: 0 }, data: { isRoot: true } }];
    const edges: Edge[] = [];
    for (let c = 2; c <= 14; c++) {
        nodes.push({ id: String(c), position: { x: 0, y: 0 }, data: {} });
        edges.push({
            id: `s1-${c}`,
            source: "1",
            target: String(c),
            type: "structure",
            data: { kind: "structure" },
        });
    }

    it("places the cards exactly as layoutDiagramNodes does", () => {
        expect(layoutDiagramGraph(nodes, edges).nodes).toEqual(layoutDiagramNodes(nodes, edges));
    });

    it("routes the lines of the later rows (13 children in rows of 5: 8 routes)", () => {
        const routed = layoutDiagramGraph(nodes, edges).edges.filter(
            (e) => (e.data as { route?: StructureRoute }).route
        );
        expect(routed.length).toBe(13 - 5);
    });

    it("gives back an empty graph untouched", () => {
        expect(layoutDiagramGraph([], [])).toEqual({ nodes: [], edges: [] });
    });

    it("is what the canvas uses to set its nodes and its edges", () => {
        const here = dirname(fileURLToPath(import.meta.url));
        const src = readFileSync(
            join(here, "../features/tasks/diagram/components/TaskFlowCanvas.tsx"),
            "utf8"
        );
        expect(src).toContain("const laid = layoutDiagramGraph(rawNodes, rawEdges, {");
        expect(src).toContain("setNodes(laid.nodes);");
        expect(src).toContain("setEdges(laid.edges);");
    });
});
