import PriorityHighRoundedIcon from "@mui/icons-material/PriorityHighRounded";
import SignalCellularAlt1BarRoundedIcon from "@mui/icons-material/SignalCellularAlt1BarRounded";
import SignalCellularAlt2BarRoundedIcon from "@mui/icons-material/SignalCellularAlt2BarRounded";
import SignalCellularAltRoundedIcon from "@mui/icons-material/SignalCellularAltRounded";

import { useTranslation } from "../../../../i18n";
import { PRIORITY_TONE, PriorityName, priorityTone, toneCss } from "../../meta/taskTone";
import { taskMetaLabel } from "../../utils/taskMeta";

const ICON: Record<PriorityName, typeof SignalCellularAltRoundedIcon> = {
    Minimal: SignalCellularAlt1BarRoundedIcon,
    Low: SignalCellularAlt1BarRoundedIcon,
    Normal: SignalCellularAlt2BarRoundedIcon,
    High: SignalCellularAltRoundedIcon,
    Critical: PriorityHighRoundedIcon,
};

type PriorityIconProps = {
    priority: string | null | undefined;
    /** Show the priority's name beside the icon. */
    showLabel?: boolean;
    size?: number;
};

/**
 * A task priority, drawn only when one is SET (MIP-1122): an unset or unknown
 * priority renders nothing, so a table is not a column of empty flags. Level is
 * carried by the shape (one, two or three bars, and "!" for Critical) as well
 * as the hue, so it is never color alone.
 */
export const PriorityIcon = ({ priority, showLabel = false, size = 16 }: PriorityIconProps) => {
    const { t } = useTranslation();
    const name = (priority ?? "").trim() as PriorityName;
    if (!name || !(name in PRIORITY_TONE)) return null;
    const label = taskMetaLabel(name, t.tasks.filters) || name;
    const Icon = ICON[name];
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: toneCss(priorityTone(name)).text,
                fontSize: "var(--g-type-body-sm-size, 0.8125rem)",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
            }}
            {...(showLabel ? {} : { role: "img", "aria-label": label })}
        >
            <Icon aria-hidden="true" sx={{ fontSize: size }} />
            {showLabel && <span>{label}</span>}
        </span>
    );
};
