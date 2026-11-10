/**
 * MIP-1278: hovering a card in the task graph lights up its parents and children
 * and dims the rest.
 *
 * The rule is pure (`connectedTaskIds` / `applyLineage`), so it is asserted on small
 * hand-made trees; the wiring on the real canvas is in
 * TaskGraphLineageCanvasMIP1278.test.tsx. jsdom can't see computed colours, so how the
 * lit and dimmed cards LOOK was checked in a browser; here the looks are pinned as the
 * data attributes and styles that produce them.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render } from "@testing-library/react";
import type { Edge, EdgeProps, Node } from "@xyflow/react";
import { describe, expect, it, vi } from "vitest";

import { DependencyEdge } from "../features/tasks/diagram/components/DependencyEdge";
import { MilestoneNodeView } from "../features/tasks/diagram/components/MilestoneNodeCard";
import { ParentChildEdge } from "../features/tasks/diagram/components/ParentChildEdge";
import { TaskNodeView } from "../features/tasks/diagram/components/TaskNodeCard";
import type { TaskNodeData } from "../features/tasks/diagram/types";
import {
    applyLineage,
    connectedTaskIds,
    DIMMED_OPACITY,
    parentMapOf,
} from "../features/tasks/diagram/utils/lineage";
import type { TaskTableProps } from "../types/tasks";

vi.mock("@xyflow/react", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@xyflow/react")>()),
    // The label is portalled into React Flow's renderer, which a bare edge has none of.
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// A tree, with the ids spelled out so each test can say who is whose:
//
//   1 (milestone)
//   ├─ 2 ─┬─ 4 ── 6
//   │     └─ 5
//   └─ 3
//   9 (stands alone)
const PARENT: Array<[number, number]> = [
    [2, 1],
    [3, 1],
    [4, 2],
    [5, 2],
    [6, 4],
];
const parents = () => new Map(PARENT);
const sorted = (s: Set<number>) => [...s].sort((a, b) => a - b);

describe("connectedTaskIds", () => {
    it("is the card, every ancestor up to the root, and every descendant", () => {
        expect(sorted(connectedTaskIds(4, parents()))).toEqual([1, 2, 4, 6]);
    });

    it("leaves out siblings and cousins", () => {
        const set = connectedTaskIds(4, parents());
        expect(set.has(5)).toBe(false); // sibling
        expect(set.has(3)).toBe(false); // uncle
    });

    it("lights the whole tree under a milestone", () => {
        expect(sorted(connectedTaskIds(1, parents()))).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it("lights a leaf's whole chain up to the root", () => {
        expect(sorted(connectedTaskIds(6, parents()))).toEqual([1, 2, 4, 6]);
    });

    it("is empty for a card with no parent and no child, so nothing dims", () => {
        expect(connectedTaskIds(9, parents()).size).toBe(0);
        expect(connectedTaskIds(42, parents()).size).toBe(0);
    });

    it("can't hang on a parent loop", () => {
        const loop = new Map([
            [1, 2],
            [2, 3],
            [3, 1],
        ]);
        expect(sorted(connectedTaskIds(1, loop))).toEqual([1, 2, 3]);
    });
});

const node = (id: number): Node => ({
    id: String(id),
    type: "task",
    position: { x: 0, y: 0 },
    data: { task: { id } },
});
const structure = (parent: number, child: number): Edge => ({
    id: `s-${parent}-${child}`,
    source: String(parent),
    target: String(child),
    type: "structure",
    data: { kind: "structure", sourceTitle: "p" },
});
const dependency = (blocker: number, blocked: number): Edge => ({
    id: `d-${blocker}-${blocked}`,
    source: String(blocker),
    target: String(blocked),
    type: "dependency",
    data: { kind: "dependency" },
});

const IDS = [1, 2, 3, 4, 5, 6, 9];
const nodes = () => IDS.map(node);
const structureEdges = () => PARENT.map(([child, parent]) => structure(parent, child));

describe("parentMapOf", () => {
    it("reads child -> parent from the parent-child edges only", () => {
        const map = parentMapOf([...structureEdges(), dependency(3, 5)]);
        expect(map.get(4)).toBe(2);
        expect(map.get(5)).toBe(2);
        expect(map.size).toBe(PARENT.length);
    });
});

describe("applyLineage", () => {
    const run = (hovered: number | null, deps: Edge[] = []) => {
        const edges = [...structureEdges(), ...deps];
        return { edges, ...applyLineage(nodes(), edges, hovered) };
    };
    const byId = <T extends { id: string }>(list: T[], id: string) =>
        list.find((x) => x.id === id) as T;

    it("marks the lineage cards and dims every other card", () => {
        const out = run(4);
        for (const id of [1, 2, 4, 6]) {
            const n = byId(out.nodes, String(id));
            expect((n.data as { isInLineage?: boolean }).isInLineage).toBe(true);
            expect(n.style?.opacity).toBeUndefined();
        }
        for (const id of [3, 5, 9]) {
            const n = byId(out.nodes, String(id));
            expect((n.data as { isInLineage?: boolean }).isInLineage).toBeUndefined();
            expect(n.style?.opacity).toBe(DIMMED_OPACITY);
        }
    });

    it("dims to 40%", () => {
        expect(DIMMED_OPACITY).toBe(0.4);
    });

    it("lights the parent-child lines on the chain and dims the others", () => {
        const out = run(4);
        const lineageOf = (id: string) =>
            (byId(out.edges, id).data as { lineage?: string }).lineage;
        expect(lineageOf("s-1-2")).toBe("active");
        expect(lineageOf("s-2-4")).toBe("active");
        expect(lineageOf("s-4-6")).toBe("active");
        expect(lineageOf("s-2-5")).toBe("dim");
        expect(lineageOf("s-1-3")).toBe("dim");
    });

    it("draws the lit lines above the dimmed ones", () => {
        const out = run(4);
        expect(byId(out.edges, "s-2-4").zIndex).toBeGreaterThan(0);
        expect(byId(out.edges, "s-2-5").zIndex).toBeUndefined();
    });

    it("keeps a dependency line only when both ends are lit, and dims it otherwise", () => {
        const out = run(4, [dependency(1, 6), dependency(6, 5), dependency(3, 5)]);
        const lineageOf = (id: string) =>
            (byId(out.edges, id).data as { lineage?: string }).lineage;
        expect(lineageOf("d-1-6")).toBeUndefined(); // lit to lit: as it was
        expect(lineageOf("d-6-5")).toBe("dim"); // lit to dimmed
        expect(lineageOf("d-3-5")).toBe("dim");
    });

    it("never lights a dependency line, and a dependency is not lineage", () => {
        // 9 is blocked by 4, but they aren't parent and child.
        const out = run(4, [dependency(4, 9)]);
        expect(byId(out.nodes, "9").style?.opacity).toBe(DIMMED_OPACITY);
        expect((byId(out.edges, "d-4-9").data as { lineage?: string }).lineage).toBe("dim");
    });

    it("hands back the same arrays when nothing is hovered", () => {
        const n = nodes();
        const e = structureEdges();
        const out = applyLineage(n, e, null);
        expect(out.nodes).toBe(n);
        expect(out.edges).toBe(e);
    });

    it("hands back the same arrays for a card with no parent and no child", () => {
        const n = nodes();
        const e = structureEdges();
        const out = applyLineage(n, e, 9);
        expect(out.nodes).toBe(n);
        expect(out.edges).toBe(e);
    });

    it("does not change the nodes and edges it was given", () => {
        const n = nodes();
        const e = structureEdges();
        const before = JSON.stringify([n, e]);
        applyLineage(n, e, 4);
        expect(JSON.stringify([n, e])).toBe(before);
    });
});

// --- how the cards and lines look -------------------------------------------------

const cardData = (over: Partial<TaskNodeData>): TaskNodeData =>
    ({
        task: {
            id: 7,
            displayId: "MIP-7",
            title: "t",
            status: "Open",
            isMilestone: false,
        } as unknown as TaskTableProps,
        isRoot: false,
        isCurrentPreview: false,
        isMilestone: false,
        isExternal: false,
        closedDescendantCount: 0,
        totalDescendantCount: 0,
        openBlockerCount: 0,
        projectName: null,
        onChange: vi.fn(),
        onAddSubtask: vi.fn(),
        onDelete: vi.fn(),
        onOpenPreview: vi.fn(),
        ...over,
    }) as TaskNodeData;

const emphasisOf = (ui: React.ReactNode) => {
    const { container, unmount } = render(<CssVarsProvider>{ui}</CssVarsProvider>);
    const out = container
        .querySelector('[data-testid="task-card"]')
        ?.getAttribute("data-emphasis");
    unmount();
    return out;
};

describe("the lineage look", () => {
    it("is on a task card in the lineage", () => {
        expect(emphasisOf(<TaskNodeView data={cardData({ isInLineage: true })} />)).toBe(
            "lineage"
        );
        expect(emphasisOf(<TaskNodeView data={cardData({})} />)).toBeNull();
    });

    it("is on a milestone card in the lineage", () => {
        expect(emphasisOf(<MilestoneNodeView data={cardData({ isInLineage: true })} />)).toBe(
            "lineage"
        );
    });

    it("wins over the other highlights while hovering, and gives way after", () => {
        const others = { isCurrentPreview: true, isNewlyCreated: true, isAssignedToViewer: true };
        expect(
            emphasisOf(<TaskNodeView data={cardData({ ...others, isInLineage: true })} />)
        ).toBe("lineage");
        expect(emphasisOf(<TaskNodeView data={cardData(others)} />)).toBe("current");
    });
});

const edgeProps = (data: Record<string, unknown>): EdgeProps =>
    ({
        id: "e",
        sourceX: 0,
        sourceY: 0,
        targetX: 100,
        targetY: 100,
        sourcePosition: "bottom",
        targetPosition: "top",
        selected: false,
        data,
    }) as unknown as EdgeProps;

const lineOf = (container: HTMLElement) =>
    container.querySelector("path.react-flow__edge-path") as SVGPathElement;

describe("the lineage look of a line", () => {
    const parentChild = (data: Record<string, unknown>) => {
        const { container } = render(
            <svg>
                <ParentChildEdge {...edgeProps(data)} />
            </svg>
        );
        return lineOf(container).style;
    };

    it("a parent-child line on the chain is the accent, thicker and fully opaque", () => {
        const plain = parentChild({});
        const lit = parentChild({ lineage: "active" });
        expect(lit.stroke).not.toBe(plain.stroke);
        expect(lit.strokeWidth).toBe("2.5");
        expect(plain.strokeWidth).toBe("1.75");
        expect(lit.opacity).toBe("1");
    });

    it("a parent-child line off the chain dims to 40% and keeps its colour", () => {
        const plain = parentChild({});
        const dim = parentChild({ lineage: "dim" });
        expect(dim.opacity).toBe(String(DIMMED_OPACITY));
        expect(dim.stroke).toBe(plain.stroke);
        expect(plain.opacity).toBe("0.85");
    });

    it("a dependency line dims, line and label, only when told to", () => {
        const dependencyLine = (data: Record<string, unknown>) => {
            const { container } = render(
                <svg>
                    <DependencyEdge {...edgeProps(data)} />
                </svg>
            );
            return {
                line: lineOf(container).style.opacity,
                label: (container.querySelector("[data-edge-id]") as HTMLElement).style.opacity,
            };
        };
        expect(dependencyLine({ lineage: "dim" })).toEqual({
            line: String(DIMMED_OPACITY),
            label: String(DIMMED_OPACITY),
        });
        expect(dependencyLine({})).toEqual({ line: "0.9", label: "" });
    });
});
