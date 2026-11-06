// The "Ask Genos about this task / milestone" entry of a task's "..." menu.
// One definition for the task menu and the milestone menu, so both gate and
// behave the same (see `askGenosAbout.ts` for what the click does).

import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";

import type { MoreMenuItem } from "../../components/ui/MoreMenu";
import { requestAskGenosAbout, type AskGenosTaskRef } from "./askGenosAbout";

export const askGenosMenuItem = ({
    askRef,
    label,
    visible,
}: {
    /** The task or milestone as a mention, or null when it has none (no id, or
     *  nothing to call it by): the item is then hidden. */
    askRef: AskGenosTaskRef | null;
    label: string;
    /** The caller's own gate (saved, not inside the link-preview modal). */
    visible: boolean;
}): MoreMenuItem => ({
    id: "askGenos",
    kind: "askGenos",
    label,
    icon: <AutoAwesomeRoundedIcon sx={{ fontSize: 18 }} />,
    visible: visible && askRef != null,
    onClick: () => {
        if (askRef) requestAskGenosAbout(askRef);
    },
});
