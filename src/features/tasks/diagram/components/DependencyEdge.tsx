import { memo, useState } from "react";
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from "@xyflow/react";

// Edge data carries the source/target titles so we can render a
// native browser tooltip (via `<title>` on the SVG path). Far cheaper
// than wiring a portal-based hover popover for every edge, and
// accessible by default.
type DependencyEdgeData = {
    sourceTitle?: string | null;
    targetTitle?: string | null;
};

// Dashed amber bezier with an arrow head pointing blocker → blocked.
// Always shows a small "blocks" label so users learn the grammar
// without needing the legend; the label brightens on hover/select.
export const DependencyEdge = memo(
    ({
        id,
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        selected,
        markerEnd,
        data,
    }: EdgeProps) => {
        const [hovered, setHovered] = useState(false);
        const [path, labelX, labelY] = getBezierPath({
            sourceX,
            sourceY,
            sourcePosition,
            targetX,
            targetY,
            targetPosition,
        });

        const active = selected || hovered;
        const stroke = active ? "#fbbf24" : "#f97316";

        const d = (data as DependencyEdgeData | undefined) ?? {};
        const tooltipText =
            d.sourceTitle && d.targetTitle
                ? `${d.sourceTitle} blocks ${d.targetTitle}`
                : "Blocker → Blocked";

        return (
            <>
                <g onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
                    {/* Native browser tooltip via <title>. Renders on
                        hover without any JS popper. */}
                    <title>{tooltipText}</title>
                    {/* Invisible wider hit target so it's easier to
                        hover/click the edge. */}
                    <path
                        d={path}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={14}
                        style={{ cursor: "pointer" }}
                    />
                    <BaseEdge
                        markerEnd={markerEnd}
                        path={path}
                        style={{
                            stroke,
                            strokeWidth: active ? 2.5 : 1.75,
                            strokeDasharray: "6 4",
                            opacity: 0.9,
                            transition: "stroke 0.15s ease, stroke-width 0.15s ease",
                            pointerEvents: "none",
                        }}
                    />
                </g>
                <EdgeLabelRenderer>
                    <div
                        className="nodrag nopan"
                        data-edge-id={id}
                        title={tooltipText}
                        style={{
                            position: "absolute",
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                            pointerEvents: "all",
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: active ? "rgba(249,115,22,0.18)" : "rgba(249,115,22,0.06)",
                            color: active ? "#f97316" : "rgba(249,115,22,0.65)",
                            border: `1px solid ${
                                active ? "rgba(249,115,22,0.45)" : "rgba(249,115,22,0.18)"
                            }`,
                            transition:
                                "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
                            userSelect: "none",
                        }}
                        onMouseEnter={() => setHovered(true)}
                        onMouseLeave={() => setHovered(false)}
                    >
                        blocks
                    </div>
                </EdgeLabelRenderer>
            </>
        );
    }
);

DependencyEdge.displayName = "DependencyEdge";
