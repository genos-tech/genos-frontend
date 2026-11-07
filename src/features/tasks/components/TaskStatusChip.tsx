import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import PendingActionsRoundedIcon from "@mui/icons-material/PendingActionsRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import { Chip } from "@mui/joy";

import { useTranslation } from "../../../i18n";
import { STATUS_TONE, toneBase, toneSoftBg } from "../meta/taskTone";
import { taskMetaLabel } from "../utils/taskMeta";

// Soft status swatch for the dashboard (stat tiles read `.bg`, and rewrite its
// alpha by string, so it keeps the `rgba(r, g, b, 0.12)` shape). Derived from
// the one tone source (MIP-1122): Pending used to be orange here and purple in
// the table.
const softSwatch = (status: "Open" | "WIP" | "Blocked" | "Pending" | "Closed") => {
    const tone = STATUS_TONE[status];
    return { bg: toneSoftBg(tone, 0.12), text: toneBase(tone) };
};

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    Open: softSwatch("Open"),
    WIP: softSwatch("WIP"),
    Blocked: softSwatch("Blocked"),
    Pending: softSwatch("Pending"),
    Closed: softSwatch("Closed"),
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
