import { useMemo } from "react";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import { Box } from "@mui/joy";

import { TabStrip, type TabItem } from "../../../../components/ui/feedback/TabStrip";
import { useTranslation } from "../../../../i18n";

export type ThreadTabId = "activities" | "comments";

type ThreadTabStripProps = {
    value: ThreadTabId;
    onChange: (next: ThreadTabId) => void;
};

/**
 * Two-tab strip (the shared `TabStrip`) wedged under `ThreadChatPaneHeader` for PM
 * threads tied to a task / milestone.
 *
 * "Activities" shows the task's structured audit log (the same
 * `TaskActivityFeed` as the task preview's Activity tab); "Comments"
 * swaps it for the dedicated task-comment list + BlockNote editor so
 * users can reply with task comments without leaving the thread.
 *
 * Activities used to render the PM message feed — auto-generated
 * "task created / updated by …" bubbles. Those producers are gone; the
 * audit log is the real record of what happened to the task.
 *
 * Kept stateless on purpose so consumers (currently `ThreadChatPane`)
 * own the active tab state and can persist it across mounts if we
 * ever decide to.
 */
export const ThreadTabStrip = ({ value, onChange }: ThreadTabStripProps) => {
    const { t } = useTranslation();
    const tabs = useMemo<TabItem[]>(
        () => [
            {
                id: "comments",
                label: t.chat.threadTabs.comments,
                icon: <ChatBubbleOutlineRoundedIcon />,
            },
            {
                id: "activities",
                label: t.chat.threadTabs.activities,
                icon: <HistoryRoundedIcon />,
            },
        ],
        [t]
    );

    return (
        <Box sx={{ px: 2, pt: 0.5, minWidth: 0 }}>
            <TabStrip
                ariaLabel={t.chat.threadTabs.ariaLabel}
                size="sm"
                tabs={tabs}
                value={value}
                onChange={(id) => onChange(id as ThreadTabId)}
            />
        </Box>
    );
};
