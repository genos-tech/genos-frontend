import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";

import type { QuickAction } from "../../utils/quickActions";

/** The glyph and tone of a button, by where it takes the item. Start and Complete keep the
 *  orange and green they had before the actions were per project (MIP-2603). */
export const quickActionLook = ({ category, action }: QuickAction) => {
    if (category === "WIP") return { Icon: PlayArrowRoundedIcon, color: "warning" } as const;
    if (category === "Closed") return { Icon: TaskAltRoundedIcon, color: "success" } as const;
    if (action.defaultKey === "reopen")
        return { Icon: ReplayRoundedIcon, color: "neutral" } as const;
    return { Icon: ArrowForwardRoundedIcon, color: "neutral" } as const;
};
