import type { CSSProperties } from "react";
import PriorityHighRoundedIcon from "@mui/icons-material/PriorityHighRounded";

import { useTranslation } from "../../../../i18n";
import { isPriorityName, PriorityName, priorityTone, toneCss } from "../../meta/taskTone";
import { taskMetaLabel } from "../../utils/taskMeta";

/** Filled bars out of four. MUI's own one-bar signal icon is a single short
 *  stroke that reads as a comma at 16px, so the glyph is drawn here. */
const BARS: Record<Exclude<PriorityName, "Critical">, number> = {
    Minimal: 1,
    Low: 2,
    Normal: 3,
    High: 4,
};

const PriorityBars = ({ filled, size }: { filled: number; size: number }) => (
    <svg
        aria-hidden="true"
        data-testid={`PriorityBars${filled}`}
        fill="currentColor"
        focusable="false"
        height={size}
        viewBox="0 0 16 16"
        width={size}
    >
        {[0, 1, 2, 3].map((i) => (
            <rect
                key={i}
                height={(i + 1) * 3}
                opacity={i < filled ? 1 : 0.25}
                rx="0.75"
                width="3"
                x={1 + i * 4}
                y={14 - (i + 1) * 3}
            />
        ))}
    </svg>
);

type PriorityIconProps = {
    priority: string | null | undefined;
    /** Show the priority's name beside the icon. */
    showLabel?: boolean;
    size?: number;
};

/**
 * A task priority, drawn only when one is SET (MIP-1122): an unset or unknown
 * priority renders nothing, so a table is not a column of empty flags. Level is
 * carried by the shape (one to four filled bars, and "!" for Critical) as well
 * as the hue, so it is never color alone.
 */
export const PriorityIcon = ({ priority, showLabel = false, size = 16 }: PriorityIconProps) => {
    const { t } = useTranslation();
    if (!isPriorityName(priority)) return null;
    const name = priority.trim() as PriorityName;
    const label = taskMetaLabel(name, t.tasks.filters) || name;
    return (
        <span
            style={
                {
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    color: toneCss(priorityTone(name)).text,
                    // The "!" is a Joy SvgIcon: it takes --Icon-color, not the inherited color.
                    "--Icon-color": toneCss(priorityTone(name)).text,
                    fontSize: "var(--g-type-body-sm-size, 0.8125rem)",
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                } as CSSProperties
            }
            {...(showLabel ? {} : { role: "img", "aria-label": label })}
        >
            {name === "Critical" ? (
                <PriorityHighRoundedIcon aria-hidden="true" sx={{ fontSize: size }} />
            ) : (
                <PriorityBars filled={BARS[name]} size={size} />
            )}
            {showLabel && <span>{label}</span>}
        </span>
    );
};
