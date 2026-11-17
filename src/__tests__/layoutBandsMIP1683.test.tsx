/**
 * MIP-1683: outside tasks in bands, active work first, rows that fit the screen.
 *
 *  - An outside task (a ghost) no longer sits among the milestone's own cards: those that block a card
 *    stand in a band on the left, those only blocked by one in a band on the right, each at the
 *    height of the card it connects to, with a caption over the band. The tree is laid out without
 *    them, so a dependency on an outside task does not push a real card a column to the right.
 *  - Among cards that could take the same place, active work comes first (WIP, Blocked, Open,
 *    Pending, then priority); the rank is fixed when the card is first laid out.
 *  - A row of unrelated tasks wraps at the number of columns the canvas can show.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import type { Edge, Node, NodeProps } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { BandLabelNode } from "../features/tasks/diagram/components/BandLabelNode";
import {
    COL_GAP,
    computeDiagramLayout,
    FREE_ROW_COLUMNS,
    layoutDiagramWithGroups,
    MARGIN,
    NODE_HEIGHT,
    NODE_WIDTH,
    type DiagramLayoutInput,
    type Position,
} from "../features/tasks/diagram/utils/layoutDiagram";
import {
    BAND_LABEL_NODE_TYPE,
    layoutDiagramGraph,
} from "../features/tasks/diagram/utils/layoutDiagramGraph";
import {
    activeWorkRank,
    MAX_ROW_COLUMNS,
    MIN_ROW_COLUMNS,
    rowColumnsFor,
} from "../features/tasks/diagram/utils/layoutOptions";
import { en } from "../i18n/locales/en";

const here = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => readFileSync(join(here, "..", rel), "utf8");

const spec = (
    parents: Array<[number, number]>,
    deps: Array<[number, number]> = [],
    over: Partial<DiagramLayoutInput> = {}
): DiagramLayoutInput => {
    const ids = new Set<number>([1]);
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
        rootId: 1,
        parentOf: new Map(parents),
        dependencies: deps.map(([blocker, blocked]) => ({ blocker, blocked })),
        ghostIds: new Set(),
        ...over,
    };
};
const kids = (from: number, to: number, parent = 1): Array<[number, number]> =>
    Array.from({ length: to - from + 1 }, (_, i) => [from + i, parent]);

const overlaps = (a: Position, b: Position) =>
    a.x < b.x + NODE_WIDTH &&
    b.x < a.x + NODE_WIDTH &&
    a.y < b.y + NODE_HEIGHT &&
    b.y < a.y + NODE_HEIGHT;
const noneOverlap = (positions: ReadonlyMap<number, Position>) => {
    const all = [...positions.entries()];
    for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
            if (overlaps(all[i][1], all[j][1])) return false;
        }
    }
    return true;
};

describe("activeWorkRank", () => {
    it("WIP, Blocked, Open, Pending, then everything else", () => {
        const ranks = [
            "WIP",
            "Blocked",
            "Open",
            "Pending",
            "Closed",
            "Deleted",
            null,
            "Whatever",
        ].map((s) => activeWorkRank(s, "Normal"));
        expect(ranks.slice(0, 5)).toEqual([...ranks.slice(0, 5)].sort((a, b) => a - b));
        expect(new Set(ranks.slice(0, 4)).size).toBe(4);
        // Closed, Deleted, none and unknown all come after the four active ones.
        for (const r of ranks.slice(4)) expect(r).toBeGreaterThan(ranks[3]);
    });

    it("within a status, Critical first and no priority last", () => {
        const byPriority = ["Critical", "High", "Normal", "Low", "Minimal", null].map((p) =>
            activeWorkRank("Open", p)
        );
        expect(byPriority).toEqual([...byPriority].sort((a, b) => a - b));
        expect(new Set(byPriority).size).toBe(6);
    });

    it("status outranks priority: a Low WIP task is before a Critical Open one", () => {
        expect(activeWorkRank("WIP", "Low")).toBeLessThan(activeWorkRank("Open", "Critical"));
    });
});

describe("siblings in active-work order", () => {
    // Twelve loose tasks under the root. Without a rank they go by id; with one, by rank.
    const parents = kids(2, 13);
    const sequence = (positions: ReadonlyMap<number, Position>, ids: number[]) =>
        [...ids].sort(
            (a, b) =>
                positions.get(a)!.y - positions.get(b)!.y ||
                positions.get(a)!.x - positions.get(b)!.x
        );

    it("goes by id when nothing is ranked", () => {
        const positions = computeDiagramLayout(spec(parents));
        expect(sequence(positions, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])).toEqual([
            2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
        ]);
    });

    it("puts the ranked-first tasks first", () => {
        const positions = computeDiagramLayout(
            spec(parents, [], {
                order: new Map([
                    [13, -3],
                    [12, -2],
                    [11, -1],
                ]),
            })
        );
        expect(sequence(positions, [2, 3, 4, 13, 12, 11]).slice(0, 3)).toEqual([13, 12, 11]);
    });

    it("breaks a tie by id", () => {
        const positions = computeDiagramLayout(
            spec(parents, [], { order: new Map(parents.map(([c]) => [c, 7])) })
        );
        expect(sequence(positions, [2, 3, 4])).toEqual([2, 3, 4]);
    });

    it("keeps the root first whatever its rank", () => {
        const positions = computeDiagramLayout(spec(parents, [], { order: new Map([[1, 99]]) }));
        expect(positions.get(1)!.y).toBe(MARGIN);
    });

    it("orders cards that share a column too (dependency-connected blocks)", () => {
        // 2 -> 3 and 4 -> 5 are two chains: 3 and 5 are both in column 1. The ranked one goes first.
        const parentsB: Array<[number, number]> = kids(2, 5);
        const deps: Array<[number, number]> = [
            [2, 3],
            [4, 5],
        ];
        const plain = computeDiagramLayout(spec(parentsB, deps));
        expect(plain.get(3)!.y).toBeLessThan(plain.get(5)!.y);
        const ranked = computeDiagramLayout(
            spec(parentsB, deps, {
                order: new Map([
                    [5, -1],
                    [4, -1],
                ]),
            })
        );
        expect(ranked.get(5)!.y).toBeLessThan(ranked.get(3)!.y);
    });
});

describe("rows that fit the screen", () => {
    const parents = kids(2, 21); // 20 loose tasks
    const perRow = (positions: ReadonlyMap<number, Position>) => {
        const rows = new Map<number, number>();
        for (const [id, p] of positions) if (id !== 1) rows.set(p.y, (rows.get(p.y) ?? 0) + 1);
        return Math.max(...rows.values());
    };

    it("wraps at FREE_ROW_COLUMNS by default", () => {
        expect(perRow(computeDiagramLayout(spec(parents)))).toBe(FREE_ROW_COLUMNS);
    });

    it("wraps at the number it is given", () => {
        expect(perRow(computeDiagramLayout(spec(parents, [], { freeRowColumns: 3 })))).toBe(3);
        expect(perRow(computeDiagramLayout(spec(parents, [], { freeRowColumns: 8 })))).toBe(8);
    });

    it("rowColumnsFor: as many columns as fit the pane at the readable zoom, between 3 and 8", () => {
        // 1352 px of pane at 0.65 is 2080 px of graph: six cards and gaps.
        expect(rowColumnsFor(1352)).toBe(6);
        expect(rowColumnsFor(402)).toBe(MIN_ROW_COLUMNS);
        expect(rowColumnsFor(2630)).toBe(MAX_ROW_COLUMNS);
        expect(rowColumnsFor(1000)).toBeLessThan(rowColumnsFor(1800));
    });

    it("rowColumnsFor: a pane with no width yet gets the layout's own default", () => {
        for (const w of [0, -5, NaN, Infinity]) expect(rowColumnsFor(w)).toBe(FREE_ROW_COLUMNS);
    });
});

describe("outside tasks in bands", () => {
    const parents: Array<[number, number]> = [...kids(2, 7), [8, 3]];
    const treeIds = [1, 2, 3, 4, 5, 6, 7, 8];
    const withGhosts = (deps: Array<[number, number]>, ghosts: number[]) =>
        layoutDiagramWithGroups(
            spec(parents, deps, {
                ghostIds: new Set(ghosts),
                nodeIds: [...treeIds, ...ghosts],
            })
        );
    const treeBounds = (positions: ReadonlyMap<number, Position>) => {
        const xs = treeIds.map((id) => positions.get(id)!.x);
        return { left: Math.min(...xs), right: Math.max(...xs) + NODE_WIDTH };
    };

    it("one that blocks a card is in a band LEFT of the whole tree", () => {
        const { positions, bands } = withGhosts([[90, 4]], [90]);
        expect(positions.get(90)!.x + NODE_WIDTH).toBeLessThanOrEqual(treeBounds(positions).left);
        expect(bands.map((b) => b.side)).toEqual(["blockers"]);
        expect(bands[0].ids).toEqual([90]);
    });

    it("one that a card blocks is in a band RIGHT of the whole tree", () => {
        const { positions, bands } = withGhosts([[4, 90]], [90]);
        expect(positions.get(90)!.x).toBeGreaterThanOrEqual(treeBounds(positions).right);
        expect(bands.map((b) => b.side)).toEqual(["blocked"]);
    });

    it("one that does both goes with the blockers", () => {
        const { bands } = withGhosts(
            [
                [90, 4],
                [5, 90],
            ],
            [90]
        );
        expect(bands.map((b) => b.side)).toEqual(["blockers"]);
    });

    it("stands at the height of the card it connects to", () => {
        const { positions } = withGhosts([[90, 8]], [90]);
        expect(positions.get(90)!.y).toBe(positions.get(8)!.y);
    });

    it("with several cards to connect to, the highest one", () => {
        const { positions } = withGhosts(
            [
                [90, 8],
                [90, 2],
            ],
            [90]
        );
        expect(positions.get(90)!.y).toBe(Math.min(positions.get(8)!.y, positions.get(2)!.y));
    });

    it("two at the same height do not overlap: the second goes below", () => {
        const { positions } = withGhosts(
            [
                [90, 4],
                [91, 4],
            ],
            [90, 91]
        );
        expect(positions.get(91)!.y).toBeGreaterThanOrEqual(positions.get(90)!.y + NODE_HEIGHT);
        expect(noneOverlap(positions)).toBe(true);
    });

    it("its caption sits above the first card of its band", () => {
        const { positions, bands } = withGhosts(
            [
                [90, 4],
                [4, 91],
            ],
            [90, 91]
        );
        expect(bands.map((b) => b.side).sort()).toEqual(["blocked", "blockers"]);
        for (const band of bands) {
            const first = Math.min(...band.ids.map((id) => positions.get(id)!.y));
            expect(band.labelY).toBeLessThan(first);
            expect(band.x).toBe(positions.get(band.ids[0])!.x);
        }
    });

    it("no band, no caption, when there are no outside tasks", () => {
        expect(withGhosts([], []).bands).toEqual([]);
    });

    it("one with nothing real to connect to still gets a place, below the others in its band", () => {
        const { positions, bands } = withGhosts([[4, 90]], [90, 91]);
        expect(bands[0].ids).toEqual([90, 91]);
        expect(positions.get(91)!.y).toBeGreaterThan(positions.get(90)!.y);
        expect(noneOverlap(positions)).toBe(true);
    });

    it("the tree is laid out without them: a dependency on an outside task moves nothing", () => {
        const alone = computeDiagramLayout(spec(parents, [], { nodeIds: treeIds }));
        const { positions } = withGhosts(
            [
                [90, 2],
                [90, 3],
                [4, 91],
            ],
            [90, 91]
        );
        // The left band makes room by moving the tree one column right; nothing else changes.
        const shiftX = positions.get(2)!.x - alone.get(2)!.x;
        expect(shiftX).toBeGreaterThan(0);
        for (const id of treeIds) {
            expect(positions.get(id)!.x - alone.get(id)!.x).toBe(shiftX);
            expect(positions.get(id)!.y).toBe(alone.get(id)!.y);
        }
    });

    it("a dependency from an outside task does not push a real card into a later column", () => {
        // 2 is blocked by the outside task 90: it used to stand one column right of it.
        const { positions } = withGhosts([[90, 2]], [90]);
        const alone = computeDiagramLayout(spec(parents, [], { nodeIds: treeIds }));
        expect(positions.get(2)!.x - alone.get(2)!.x).toBe(positions.get(3)!.x - alone.get(3)!.x);
    });

    it("never overlaps, whatever is connected to what (random)", () => {
        let seed = 3;
        const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        for (let t = 0; t < 200; t++) {
            const n = 4 + Math.floor(rnd() * 40);
            const ghosts = Array.from({ length: 1 + Math.floor(rnd() * 6) }, (_, i) => 100 + i);
            const real = Array.from({ length: n }, (_, i) => i + 1);
            const ps: Array<[number, number]> = [];
            for (let i = 1; i < real.length; i++) ps.push([real[i], real[Math.floor(rnd() * i)]]);
            const ds: Array<[number, number]> = [];
            for (const g of ghosts) {
                const other = real[Math.floor(rnd() * real.length)];
                if (rnd() < 0.8) ds.push(rnd() < 0.5 ? [g, other] : [other, g]);
            }
            const out = layoutDiagramWithGroups(
                spec(ps, ds, { ghostIds: new Set(ghosts), nodeIds: [...real, ...ghosts] })
            );
            expect(out.positions.size).toBe(n + ghosts.length);
            expect(noneOverlap(out.positions)).toBe(true);
        }
    });

    it("is the same every time", () => {
        const a = withGhosts(
            [
                [90, 4],
                [4, 91],
            ],
            [90, 91]
        );
        const b = withGhosts(
            [
                [90, 4],
                [4, 91],
            ],
            [90, 91]
        );
        expect([...a.positions]).toEqual([...b.positions]);
    });
});

describe("the graph adapter and the captions", () => {
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
    const dependency = (a: number, b: number): Edge => ({
        id: `d${a}-${b}`,
        source: String(a),
        target: String(b),
        data: { kind: "dependency" },
    });
    const nodes = [
        node(1, { isRoot: true }),
        node(2),
        node(3),
        node(90, { isExternal: true }),
        node(91, { isExternal: true }),
    ];
    const edges = [structure(1, 2), structure(1, 3), dependency(90, 2), dependency(3, 91)];

    it("adds a caption node per band, as a caption: nothing to select, drag, focus or delete", () => {
        const out = layoutDiagramGraph(nodes, edges).nodes;
        const labels = out.filter((n) => n.type === BAND_LABEL_NODE_TYPE);
        expect(labels.map((n) => n.id).sort()).toEqual(["band-blocked", "band-blockers"]);
        for (const l of labels) {
            expect(l.draggable).toBe(false);
            expect(l.selectable).toBe(false);
            expect(l.focusable).toBe(false);
            expect(l.deletable).toBe(false);
            expect(l.connectable).toBe(false);
            expect(l.style?.pointerEvents).toBe("none");
        }
    });

    it("adds none without outside tasks, and the cards come first", () => {
        const plain = layoutDiagramGraph([node(1, { isRoot: true }), node(2)], [structure(1, 2)]);
        expect(plain.nodes.map((n) => n.id)).toEqual(["1", "2"]);
        const out = layoutDiagramGraph(nodes, edges).nodes;
        expect(out.slice(0, nodes.length).map((n) => n.id)).toEqual(nodes.map((n) => n.id));
    });

    it("places the outside tasks and passes the order and the row width on", () => {
        const wide = Array.from({ length: 12 }, (_, i) => node(10 + i));
        const es = wide.map((n) => structure(1, Number(n.id)));
        const out = layoutDiagramGraph([node(1, { isRoot: true }), ...wide], es, {
            freeRowColumns: 3,
            order: new Map([[21, -1]]),
        }).nodes;
        const ys = new Set(out.filter((n) => n.id !== "1").map((n) => n.position.y));
        expect(ys.size).toBe(4); // 12 cards, 3 a row
        const first = out.find((n) => n.id === "21")!;
        expect(first.position.y).toBe(Math.min(...[...ys]));
    });

    it("the caption says what the band holds, in the viewer's words", () => {
        const props = (side: "blockers" | "blocked") =>
            ({ data: { side } }) as unknown as NodeProps;
        const { rerender } = render(
            <CssVarsProvider>
                <BandLabelNode {...props("blockers")} />
            </CssVarsProvider>
        );
        expect(screen.getByText(en.tasks.diagram.bands.blockers)).toBeTruthy();
        rerender(
            <CssVarsProvider>
                <BandLabelNode {...props("blocked")} />
            </CssVarsProvider>
        );
        expect(screen.getByText(en.tasks.diagram.bands.blocked)).toBeTruthy();
        expect(en.tasks.diagram.bands.blockers).not.toBe(en.tasks.diagram.bands.blocked);
    });
});

describe("the canvas", () => {
    const canvas = src("features/tasks/diagram/components/TaskFlowCanvas.tsx");

    it("draws the caption node and keeps it off the minimap", () => {
        expect(canvas).toContain("[BAND_LABEL_NODE_TYPE]: BandLabelNode");
        expect(canvas).toContain('if (n.type === BAND_LABEL_NODE_TYPE) return "transparent";');
    });

    it("ranks a card the first time it sees it and never again (a status edit moves nothing)", () => {
        expect(canvas).toContain("if (!rank.has(id) && task) {");
        expect(canvas).toContain("rank.set(id, activeWorkRank(task.status, task.priority));");
    });

    it("sizes the rows to the pane, or to the window before the pane has a size", () => {
        expect(canvas).toContain("freeRowColumns: rowColumnsFor(");
        // …and the ranks are what the layout is given.
        expect(canvas).toContain("order: rank,");
        expect(canvas).toContain("flowStore.getState().width || window.innerWidth * 0.9");
        expect(COL_GAP).toBe(50);
    });
});
