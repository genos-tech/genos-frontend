import type { Edge } from "@xyflow/react";

import { LANE_GAP, NODE_HEIGHT, RANK_GAP, type Position } from "./layoutDiagram";

/**
 * Parent-child lines that never run behind a card (MIP-1682).
 *
 * React Flow draws a parent-child line as a smooth-step from the parent's bottom to the child's
 * top: straight down, across at the MIDDLE of the vertical gap, straight down again. That is right
 * for the first row under a parent. A parent with many children lays them out in rows, and for a
 * child in the second row or later the middle of the gap is in the row above: the line ran
 * behind the cards of that row, and siblings looked like a chain (in a milestone of 17 tasks,
 * 12 of the 17 lines did).
 *
 * The route for such a child is instead: down to the gap under the parent, left to a SPINE in the
 * gutter left of the whole group, down the spine to the gap above the child's own row, right into
 * the child's column, down into it. Every segment is in a gap between rows or in the gutter, so no
 * line crosses a card, and the rows hang from the spine like a file tree.
 *
 * Pure: positions and the group map in, routes out (flow coordinates). A route holds the heights
 * and the spine the LAYOUT decides; the line itself is drawn by `routePoints` from the connection
 * points React Flow reports, not from a card height assumed here, because the cards are drawn
 * taller than the layout's slot (a task 148 px, a milestone 198, against 140). The first row
 * keeps the normal path: it has no route.
 */

/** How far left of the leftmost card of the group the spine runs. */
export const SPINE_GAP = 25;

export type RoutePoint = [number, number];

/** What the layout decides for one child; `routePoints` turns it into a line. Flow coordinates. */
export type StructureRoute = {
    /** The laid-out top-left of the parent and of the child: the route holds only while both are there. */
    parent: RoutePoint;
    child: RoutePoint;
    /** x of the spine, left of every card of the group. */
    spineX: number;
    /** y of the top of the first row of the group: the line under the parent runs half way
     *  between the parent's connection point and this. */
    firstRowY: number;
    /** y of the line along the gap above the child's own row. */
    aboveRowY: number;
};

/**
 * The corners of the line for a route, from the connection points React Flow reports: down to the
 * middle of the gap under the parent (wherever the parent's bottom really is), left to the spine,
 * down it, along the gap above the child's row, down into the child.
 */
export const routePoints = (
    route: StructureRoute,
    anchors: { sourceX: number; sourceY: number; targetX: number; targetY: number }
): RoutePoint[] => {
    const underParentY = (anchors.sourceY + route.firstRowY) / 2;
    return [
        [anchors.sourceX, anchors.sourceY],
        [anchors.sourceX, underParentY],
        [route.spineX, underParentY],
        [route.spineX, route.aboveRowY],
        [anchors.targetX, route.aboveRowY],
        [anchors.targetX, anchors.targetY],
    ];
};

export const computeStructureRoutes = (
    positions: ReadonlyMap<number, Position>,
    parentOf: ReadonlyMap<number, number>,
    /** card -> the cards laid out in its group (`DiagramLayout.groups`): its children AND the outside
     *  tasks placed there. A line has to clear all of them, so rows and the spine are the group's. */
    groups: ReadonlyMap<number, readonly number[]>
): Map<number, StructureRoute> => {
    const childrenOf = new Map<number, number[]>();
    for (const [parent, members] of groups) {
        if (!positions.has(parent)) continue;
        const placed = members.filter((m) => m !== parent && positions.has(m));
        if (placed.length > 0) childrenOf.set(parent, placed);
    }

    // x of the leftmost card in a subtree: a child's own descendants can reach further left than
    // the child, and the spine has to clear them too. Memoised; a parent loop cannot recurse.
    const leftmost = new Map<number, number>();
    const visiting = new Set<number>();
    const subtreeLeft = (id: number): number => {
        const known = leftmost.get(id);
        if (known !== undefined) return known;
        const own = positions.get(id)!.x;
        if (visiting.has(id)) return own;
        visiting.add(id);
        let left = own;
        for (const child of childrenOf.get(id) ?? []) left = Math.min(left, subtreeLeft(child));
        visiting.delete(id);
        leftmost.set(id, left);
        return left;
    };

    const routes = new Map<number, StructureRoute>();
    for (const [parentId, kids] of childrenOf) {
        const parent = positions.get(parentId)!;
        const firstRow = Math.min(...kids.map((k) => positions.get(k)!.y));
        // A group drawn above or beside its parent (a loop in the data) keeps the normal path.
        if (firstRow < parent.y + NODE_HEIGHT) continue;
        // Only a CHILD gets a line, but the first row is the group's: an outside task that sits
        // above the first child is a row the line must not cross either.
        const later = kids.filter(
            (k) => parentOf.get(k) === parentId && positions.get(k)!.y > firstRow + 0.5
        );
        if (later.length === 0) continue;

        const spineX = Math.min(...kids.map(subtreeLeft)) - SPINE_GAP;
        const rowGap = Math.min(LANE_GAP, RANK_GAP) / 2;
        for (const kid of later) {
            const card = positions.get(kid)!;
            routes.set(kid, {
                parent: [parent.x, parent.y],
                child: [card.x, card.y],
                spineX,
                firstRowY: firstRow,
                aboveRowY: card.y - rowGap,
            });
        }
    }
    return routes;
};

/**
 * `edges` with `data.route` set on the parent-child edges that have one. Edges that need none
 * (first rows, dependencies) are returned as the same objects, so nothing re-renders for them.
 * `positions` and `groups` are the layout's (`layoutDiagramWithGroups`).
 */
export const routeStructureEdges = (
    positions: ReadonlyMap<number, Position>,
    groups: ReadonlyMap<number, readonly number[]>,
    edges: Edge[]
): Edge[] => {
    const parentOf = new Map<number, number>();
    for (const edge of edges) {
        if ((edge.data as { kind?: string } | undefined)?.kind !== "structure") continue;
        parentOf.set(Number(edge.target), Number(edge.source));
    }
    const routes = computeStructureRoutes(positions, parentOf, groups);
    if (routes.size === 0) return edges;
    return edges.map((edge) => {
        const route = routes.get(Number(edge.target));
        const isStructure = (edge.data as { kind?: string } | undefined)?.kind === "structure";
        return route && isStructure ? { ...edge, data: { ...edge.data, route } } : edge;
    });
};

/**
 * An SVG path through `points` with rounded corners (the look of React Flow's smooth step).
 * Each corner is cut back by `radius`, or half of the shorter side next to it if that is less.
 */
export const roundedPolylinePath = (points: readonly RoutePoint[], radius: number): string => {
    // Drop repeated points: a zero-length side has no direction to round against.
    const pts = points.filter(
        (p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1]
    );
    if (pts.length === 0) return "";
    let d = `M ${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
        const [px, py] = pts[i - 1];
        const [cx, cy] = pts[i];
        const [nx, ny] = pts[i + 1];
        const before = Math.hypot(cx - px, cy - py);
        const after = Math.hypot(nx - cx, ny - cy);
        const r = Math.min(radius, before / 2, after / 2);
        const inX = cx + ((px - cx) / before) * r;
        const inY = cy + ((py - cy) / before) * r;
        const outX = cx + ((nx - cx) / after) * r;
        const outY = cy + ((ny - cy) / after) * r;
        d += ` L ${inX},${inY} Q ${cx},${cy} ${outX},${outY}`;
    }
    const last = pts[pts.length - 1];
    if (pts.length > 1) d += ` L ${last[0]},${last[1]}`;
    return d;
};
