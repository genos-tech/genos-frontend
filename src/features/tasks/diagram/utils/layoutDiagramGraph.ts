import type { Edge, Node } from "@xyflow/react";

import { diagramInputOf, layoutDiagramWithGroups, placeDiagramNodes } from "./layoutDiagram";
import { routeStructureEdges } from "./structureRoutes";

/**
 * The task graph's whole default layout for React Flow: every card placed, and the parent-child
 * lines that would run behind a card given a route through the gaps (MIP-1682). Same contract as
 * `layoutDiagramNodes` for the nodes; the edges come back too, as the same objects wherever no
 * route is needed.
 */
export const layoutDiagramGraph = (
    nodes: Node[],
    edges: Edge[]
): { nodes: Node[]; edges: Edge[] } => {
    if (nodes.length === 0) return { nodes, edges };
    const { positions, groups } = layoutDiagramWithGroups(diagramInputOf(nodes, edges));
    return {
        nodes: placeDiagramNodes(nodes, positions),
        edges: routeStructureEdges(positions, groups, edges),
    };
};
