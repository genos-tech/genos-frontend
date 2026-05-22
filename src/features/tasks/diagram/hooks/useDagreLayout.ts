import { useCallback } from "react";
import dagre from "@dagrejs/dagre";
import { Edge, Node } from "@xyflow/react";

const NODE_WIDTH = 260;
const NODE_HEIGHT = 140;

/**
 * Run dagre over the supplied nodes + edges and return the same nodes
 * with positions updated. Pure transformation — no state of its own —
 * exposed via `useCallback` so the canvas can memoize handlers that
 * depend on it.
 *
 * Only structure (parent-child) edges should drive the hierarchy.
 * Dependency edges are ignored by the layout so they don't pull
 * unrelated branches together; they show up as overlay edges instead.
 */
export const useDagreLayout = () => {
    return useCallback(
        (
            nodes: Node[],
            edges: Edge[],
            direction: "TB" | "LR" = "TB"
        ): Node[] => {
            if (nodes.length === 0) return nodes;

            const g = new dagre.graphlib.Graph();
            g.setDefaultEdgeLabel(() => ({}));
            g.setGraph({
                rankdir: direction,
                nodesep: 50,
                ranksep: 90,
                marginx: 24,
                marginy: 24,
            });

            for (const node of nodes) {
                g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
            }
            for (const edge of edges) {
                if ((edge.data as { kind?: string } | undefined)?.kind === "structure") {
                    g.setEdge(edge.source, edge.target);
                }
            }

            dagre.layout(g);

            return nodes.map((node) => {
                const { x, y } = g.node(node.id);
                return {
                    ...node,
                    // dagre returns the center of the node; React Flow
                    // anchors at the top-left, so shift by half-extent.
                    position: {
                        x: x - NODE_WIDTH / 2,
                        y: y - NODE_HEIGHT / 2,
                    },
                    // Set width/height so React Flow doesn't have to
                    // measure on first render (avoids a layout flash).
                    width: NODE_WIDTH,
                    height: NODE_HEIGHT,
                } as Node;
            });
        },
        []
    );
};
