import type { Edge, Node } from "@xyflow/react";

/**
 * Hover lineage for the task graph (MIP-1278).
 *
 * The graph can hold hundreds of cards and lines, so it is hard to see which task
 * is whose parent. Hovering a card lights up its lineage and dims the rest:
 *
 *  - lineage = the card, every ancestor up to the root task or milestone, and every
 *    descendant below it. Siblings and cousins are NOT lineage: only parent-child
 *    links count, never a dependency;
 *  - a card in the lineage gets the `lineage` look, and so does each parent-child
 *    line between two lineage cards;
 *  - everything else dims. A dependency line stays as it is only when both of its
 *    ends are in the lineage, since then it joins two cards that are still lit.
 *
 * Pure: it only reads the edges that are drawn, so a task hidden by "hide closed"
 * or an outside task (a ghost, which has no parent edge) can't be reached.
 */

/** Opacity of a card or line that is not part of the lineage. */
export const DIMMED_OPACITY = 0.4;

/** child -> parent, from the parent-child edges that are drawn. */
export const parentMapOf = (edges: readonly Edge[]): Map<number, number> => {
    const parentOf = new Map<number, number>();
    for (const edge of edges) {
        const kind = (edge.data as { kind?: string } | undefined)?.kind;
        if (kind === "structure") parentOf.set(Number(edge.target), Number(edge.source));
    }
    return parentOf;
};

/**
 * The hovered task, its ancestors and all its descendants. Empty when the task has
 * neither a parent nor a child: there is nothing to tell apart, so nothing should
 * dim. A parent loop (should the data hold one) can't hang it.
 */
export const connectedTaskIds = (
    hoveredId: number,
    parentOf: ReadonlyMap<number, number>
): Set<number> => {
    const childrenOf = new Map<number, number[]>();
    for (const [child, parent] of parentOf) {
        if (child === parent) continue;
        childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), child]);
    }

    const out = new Set<number>([hoveredId]);
    let up = parentOf.get(hoveredId);
    while (up !== undefined && !out.has(up)) {
        out.add(up);
        up = parentOf.get(up);
    }
    const stack = [hoveredId];
    while (stack.length > 0) {
        const id = stack.pop() as number;
        for (const child of childrenOf.get(id) ?? []) {
            if (out.has(child)) continue;
            out.add(child);
            stack.push(child);
        }
    }
    return out.size > 1 ? out : new Set();
};

const DIM_TRANSITION = "opacity 0.15s ease";

const withData = <T extends Node | Edge>(item: T, patch: Record<string, unknown>): T => ({
    ...item,
    data: { ...(item.data as Record<string, unknown>), ...patch },
});

/**
 * The nodes and edges to draw while `hoveredId` is hovered. Returns the SAME array
 * and the same objects when nothing is hovered or the lineage is empty, and a new
 * object only for a card or line whose look changes, so React Flow re-renders just
 * those.
 */
export const applyLineage = (
    nodes: Node[],
    edges: Edge[],
    hoveredId: number | null
): { nodes: Node[]; edges: Edge[] } => {
    if (hoveredId == null) return { nodes, edges };
    const lineage = connectedTaskIds(hoveredId, parentMapOf(edges));
    if (lineage.size === 0) return { nodes, edges };

    const lit = (id: string | number) => lineage.has(Number(id));

    return {
        nodes: nodes.map((node) =>
            lit(node.id)
                ? withData(node, { isInLineage: true })
                : {
                      ...node,
                      style: {
                          ...node.style,
                          opacity: DIMMED_OPACITY,
                          transition: DIM_TRANSITION,
                      },
                  }
        ),
        edges: edges.map((edge) => {
            const kind = (edge.data as { kind?: string } | undefined)?.kind;
            const both = lit(edge.source) && lit(edge.target);
            if (kind === "structure") {
                // The lineage is one path up plus a subtree down, so two lit cards
                // joined by a parent-child line are always on the chain.
                return both
                    ? { ...withData(edge, { lineage: "active" }), zIndex: 1000 }
                    : withData(edge, { lineage: "dim" });
            }
            return both ? edge : withData(edge, { lineage: "dim" });
        }),
    };
};
