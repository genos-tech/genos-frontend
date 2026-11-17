import { memo } from "react";
import { BaseEdge, EdgeProps, getSmoothStepPath, useInternalNode } from "@xyflow/react";

import { fmt, useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { DIMMED_OPACITY } from "../utils/lineage";
import { roundedPolylinePath, routePoints, type StructureRoute } from "../utils/structureRoutes";

type ParentChildEdgeData = {
    sourceTitle?: string | null;
    targetTitle?: string | null;
    /** While a card is hovered (MIP-1278): "active" = on its lineage, "dim" = not. */
    lineage?: "active" | "dim";
    /** A path through the gaps between rows (MIP-1682), set by `routeStructureEdges` for a child
     *  that is not in the first row under its parent. Valid only where the cards were laid out. */
    route?: StructureRoute;
};

/** How far a card can have moved from where the route was computed before the route is dropped. */
const ROUTE_TOLERANCE = 1.5;

const near = (a: { x: number; y: number } | undefined, b: [number, number]) =>
    a !== undefined &&
    Math.abs(a.x - b[0]) <= ROUTE_TOLERANCE &&
    Math.abs(a.y - b[1]) <= ROUTE_TOLERANCE;

const normalPath = ({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
}: EdgeProps) =>
    getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 8,
    })[0];

// Solid purple smooth-step with no arrow head. Parent-child has no
// implicit "direction" beyond the layout's top-to-bottom tree — drawing an
// arrow would imply meaning that doesn't exist. The label stays off
// these by design (the legend covers it; labeling every parent edge
// in a 30-node tree would clutter the canvas). Hover tooltip via
// native <title>.
const ParentChildLine = ({
    path,
    selected,
    style,
    data,
}: Pick<EdgeProps, "selected" | "style" | "data"> & { path: string }) => {
    const { t } = useTranslation();
    const d = (data as ParentChildEdgeData | undefined) ?? {};
    const active = selected || d.lineage === "active";
    const tooltipText =
        d.sourceTitle && d.targetTitle
            ? fmt(t.tasks.diagram.tooltips.parentChild, {
                  parent: d.sourceTitle,
                  child: d.targetTitle,
              })
            : t.tasks.diagram.legend.parentChild;

    return (
        <g>
            <title>{tooltipText}</title>
            {/* Wider hit target for easier hovering / clicking. */}
            <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth={14}
                style={{ cursor: "pointer" }}
            />
            <BaseEdge
                path={path}
                style={{
                    stroke: selected
                        ? "var(--gp-brandalt-400)"
                        : d.lineage === "active"
                          ? g.accent.solid
                          : "var(--gp-brand-700)",
                    strokeWidth: active ? 2.5 : 1.75,
                    opacity:
                        d.lineage === "dim" ? DIMMED_OPACITY : d.lineage === "active" ? 1 : 0.85,
                    transition: "stroke 0.15s ease, stroke-width 0.15s ease, opacity 0.15s ease",
                    pointerEvents: "none",
                    ...style,
                }}
            />
        </g>
    );
};

/**
 * A line that has a route (MIP-1682): the child is not in the first row under its parent, so the
 * normal path would run behind the cards of the row above. It asks React Flow where the two cards
 * are now, so only the lines that have a route pay for the subscription.
 */
const RoutedParentChildEdge = (props: EdgeProps & { route: StructureRoute }) => {
    const { route, source, target, sourceX, sourceY, targetX, targetY } = props;
    const parentCard = useInternalNode(source);
    const childCard = useInternalNode(target);
    // The route was computed for the two cards where the layout put them. If either has been
    // dragged since, it would join nothing: draw the normal path instead.
    const holds =
        near(parentCard?.internals.positionAbsolute, route.parent) &&
        near(childCard?.internals.positionAbsolute, route.child);
    const path = holds
        ? roundedPolylinePath(routePoints(route, { sourceX, sourceY, targetX, targetY }), 8)
        : normalPath(props);
    return (
        <ParentChildLine
            data={props.data}
            path={path}
            selected={props.selected}
            style={props.style}
        />
    );
};

export const ParentChildEdge = memo((props: EdgeProps) => {
    const route = (props.data as ParentChildEdgeData | undefined)?.route;
    return route ? (
        <RoutedParentChildEdge {...props} route={route} />
    ) : (
        <ParentChildLine
            data={props.data}
            path={normalPath(props)}
            selected={props.selected}
            style={props.style}
        />
    );
});

ParentChildEdge.displayName = "ParentChildEdge";
