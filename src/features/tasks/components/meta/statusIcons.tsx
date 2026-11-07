import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import HorizontalRuleRoundedIcon from "@mui/icons-material/HorizontalRuleRounded";
import PendingActionsRoundedIcon from "@mui/icons-material/PendingActionsRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";

/** The icon of a task status. They carry the status in SHAPE as well as hue,
 *  so a status is never told apart by color alone. */
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
        case "Deleted":
            return <DeleteOutlineRoundedIcon sx={sx} />;
        default:
            // An unknown or empty status is NOT an Open task: a neutral dash.
            return <HorizontalRuleRoundedIcon sx={sx} />;
    }
};
