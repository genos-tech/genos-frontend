import { ReactElement } from "react";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import { Box, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useTranslation, type Messages } from "../../../../i18n";

export type ThreadTabId = "activities" | "comments";

type ThreadTabStripProps = {
    value: ThreadTabId;
    onChange: (next: ThreadTabId) => void;
};

type ThreadTab = {
    id: ThreadTabId;
    labelKey: keyof Messages["chat"]["threadTabs"];
    icon: ReactElement;
};
const TABS: ThreadTab[] = [
    {
        id: "comments",
        labelKey: "comments",
        icon: <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 16 }} />,
    },
    {
        id: "activities",
        labelKey: "activities",
        icon: <HistoryRoundedIcon sx={{ fontSize: 16 }} />,
    },
];

/**
 * Two-tab pill strip wedged under `ThreadChatPaneHeader` for PM
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
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    return (
        <Stack
            direction="row"
            spacing={0.5}
            sx={{
                px: 2,
                py: 0.75,
                borderBottom: "1px solid",
                borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
            }}
        >
            {TABS.map((tab) => {
                const active = tab.id === value;
                return (
                    <Box
                        key={tab.id}
                        component="button"
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.75,
                            border: "none",
                            cursor: "pointer",
                            background: active
                                ? isDark
                                    ? "rgba(139,92,246,0.18)"
                                    : "rgba(124,58,237,0.12)"
                                : "transparent",
                            color: active
                                ? isDark
                                    ? "#a78bfa"
                                    : "#7c3aed"
                                : isDark
                                  ? "rgba(255,255,255,0.6)"
                                  : "rgba(0,0,0,0.6)",
                            borderRadius: "999px",
                            px: 1.5,
                            py: 0.5,
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            transition: "background 120ms ease, color 120ms ease",
                            "&:hover": {
                                background: active
                                    ? isDark
                                        ? "rgba(139,92,246,0.24)"
                                        : "rgba(124,58,237,0.18)"
                                    : isDark
                                      ? "rgba(255,255,255,0.06)"
                                      : "rgba(0,0,0,0.04)",
                            },
                        }}
                        onClick={() => onChange(tab.id)}
                    >
                        {tab.icon}
                        <Typography
                            level="body-sm"
                            sx={{
                                color: "inherit",
                                fontWeight: 600,
                                fontSize: "0.78rem",
                            }}
                        >
                            {t.chat.threadTabs[tab.labelKey]}
                        </Typography>
                    </Box>
                );
            })}
        </Stack>
    );
};
