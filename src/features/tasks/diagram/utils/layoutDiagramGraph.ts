import type { Edge, Node } from "@xyflow/react";

import {
    BAND_LABEL_HEIGHT,
    diagramInputOf,
    layoutDiagramWithGroups,
    NODE_WIDTH,
    placeDiagramNodes,
    type DiagramLayoutInput,
} from "./layoutDiagram";
import { routeStructureEdges } from "./structureRoutes";

/** React Flow node type of the text above a band of outside tasks. */
export const BAND_LABEL_NODE_TYPE = "bandLabel";

export type BandLabelData = { side: "blockers" | "blocked" };

/**
 * The task graph's whole default layout for React Flow: every card placed, the outside tasks in
 * bands at the sides with a label over each (MIP-1683), and the parent-child lines that would run
 * behind a card given a route through the gaps (MIP-1682). Same contract as `layoutDiagramNodes`
 * for the cards; the edges come back too, as the same objects wherever no route is needed.
 */
export const layoutDiagramGraph = (
    nodes: Node[],
    edges: Edge[],
    options: Pick<DiagramLayoutInput, "order" | "freeRowColumns"> = {}
): { nodes: Node[]; edges: Edge[] } => {
    if (nodes.length === 0) return { nodes, edges };
    const { positions, groups, bands } = layoutDiagramWithGroups(
        diagramInputOf(nodes, edges, options)
    );
    const labels: Node[] = bands.map((band) => ({
        id: `band-${band.side}`,
        type: BAND_LABEL_NODE_TYPE,
        position: { x: band.x, y: band.labelY },
        width: NODE_WIDTH,
        height: BAND_LABEL_HEIGHT,
        data: { side: band.side } satisfies BandLabelData,
        // A caption, not a card: nothing to select, drag, focus, connect or delete.
        draggable: false,
        selectable: false,
        focusable: false,
        deletable: false,
        connectable: false,
        style: { pointerEvents: "none" },
    }));
    return {
        nodes: [...placeDiagramNodes(nodes, positions), ...labels],
        edges: routeStructureEdges(positions, groups, edges),
    };
};
