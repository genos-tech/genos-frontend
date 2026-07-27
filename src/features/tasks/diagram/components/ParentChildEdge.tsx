import { memo } from "react";
import { BaseEdge, EdgeProps, getSmoothStepPath } from "@xyflow/react";

type ParentChildEdgeData = {
    sourceTitle?: string | null;
    targetTitle?: string | null;
};

// Solid purple smooth-step with no arrow head. Parent-child has no
// implicit "direction" beyond the dagre vertical layout — drawing an
// arrow would imply meaning that doesn't exist. The label stays off
// these by design (the legend covers it; labeling every parent edge
// in a 30-node tree would clutter the canvas). Hover tooltip via
// native <title>.
export const ParentChildEdge = memo(
    ({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        selected,
        style,
        data,
    }: EdgeProps) => {
        const [path] = getSmoothStepPath({
            sourceX,
            sourceY,
            sourcePosition,
            targetX,
            targetY,
            targetPosition,
            borderRadius: 8,
        });

        const d = (data as ParentChildEdgeData | undefined) ?? {};
        const tooltipText =
            d.sourceTitle && d.targetTitle
                ? `${d.sourceTitle} → ${d.targetTitle}`
                : "Parent → Child";

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
                        stroke: selected ? "var(--gp-brandalt-400)" : "var(--gp-brand-700)",
                        strokeWidth: selected ? 2.5 : 1.75,
                        opacity: 0.85,
                        transition: "stroke 0.15s ease, stroke-width 0.15s ease",
                        pointerEvents: "none",
                        ...style,
                    }}
                />
            </g>
        );
    }
);

ParentChildEdge.displayName = "ParentChildEdge";
