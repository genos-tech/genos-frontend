// The "Ask Genos about this task / milestone" entry of a task's "..." menu.
// One definition for the task menu and the milestone menu, so both gate and
// behave the same. The click opens THAT object's own conversation (MIP-1057: see
// `features/taskAsk`), not the Cmd-K one: nothing is put in Spotlight's draft.

import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";

import type { MoreMenuItem } from "../../components/ui/MoreMenu";
import { requestAskGenosAboutTask, type TaskAskRequest } from "../taskAsk/taskAskLink";

export const askGenosMenuItem = ({
    ask,
    label,
    visible,
}: {
    /** The task or milestone (`askGenosTaskRequest`), or null when it cannot be named (no id,
     *  or nothing to call it by): the item is then hidden. */
    ask: TaskAskRequest | null;
    label: string;
    /** The caller's own gate (saved, not inside the link-preview modal). */
    visible: boolean;
}): MoreMenuItem => ({
    id: "askGenos",
    kind: "askGenos",
    label,
    icon: <AutoAwesomeRoundedIcon sx={{ fontSize: 18 }} />,
    visible: visible && ask != null,
    onClick: () => {
        if (ask) requestAskGenosAboutTask(ask);
    },
});
