import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import PendingActionsRoundedIcon from "@mui/icons-material/PendingActionsRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import { Chip } from "@mui/joy";

import { useTranslation } from "../../../i18n";
import { taskMetaLabel } from "../utils/taskMeta";

// Soft status swatch shared by every dashboard status chip. Moved here from
// TaskHomeContent so the dashboard rows and the Assigned Milestones card
// render the exact same chip.
export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    Open: { bg: "rgba(59,130,246,0.12)", text: "#3b82f6" },
    WIP: { bg: "rgba(251,191,36,0.12)", text: "#fbbf24" },
    Blocked: { bg: "rgba(244,63,94,0.12)", text: "#f43f5e" },
    Pending: { bg: "rgba(251,146,60,0.12)", text: "#fb923c" },
    Closed: { bg: "rgba(34,197,94,0.12)", text: "#22c55e" },
};

export const getStatusIcon = (status: string, size = 14) => {
    const sx = { fontSize: size };
    switch (status) {
        case "Open":
            return <RadioButtonUncheckedRoundedIcon sx={sx} />;
        case "WIP":
            return <PlayCircleOutlineRoundedIcon sx={sx} />;
        case "Blocked":
            return <BlockRoundedIcon sx={sx} />;
        case "Pending":
            return <PendingActionsRoundedIcon sx={sx} />;
        case "Closed":
            return <CheckCircleOutlineRoundedIcon sx={sx} />;
        default:
            return <RadioButtonUncheckedRoundedIcon sx={sx} />;
    }
};

type TaskStatusChipProps = {
    status: string;
    iconSize?: number;
};

/**
 * The canonical dashboard status chip: soft-filled, status-colored, with the
 * matching status icon. Used by the "Up Next" / "Top by Weight" task rows and
 * the "Assigned Milestones" card so a status reads identically across them
 * (milestone statuses — Open/WIP/Pending/Closed — share the same vocabulary).
 */
export const TaskStatusChip = ({ status, iconSize = 12 }: TaskStatusChipProps) => {
    const { t } = useTranslation();
    const sc = STATUS_COLORS[status] || STATUS_COLORS.Open;
    return (
        <Chip
            size="sm"
            startDecorator={getStatusIcon(status, iconSize)}
            variant="soft"
            sx={{
                fontSize: "0.65rem",
                backgroundColor: sc.bg,
                color: sc.text,
                flexShrink: 0,
            }}
        >
            {taskMetaLabel(status, t.tasks.filters)}
        </Chip>
    );
};
