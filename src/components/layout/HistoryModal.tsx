import { useState } from "react";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import NoteAltRoundedIcon from "@mui/icons-material/NoteAltRounded";
import {
    Box,
    Button,
    Divider,
    IconButton,
    Modal,
    ModalDialog,
    Stack,
    Tab,
    TabList,
    TabPanel,
    Tabs,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import {
    ChatHistoryEntry,
    HistoryEntry,
    MilestoneHistoryEntry,
    NoteHistoryEntry,
    TaskHistoryEntry,
    ThreadHistoryEntry,
    useHistory,
} from "../../hooks/common/useHistory";
import { useTranslation } from "../../i18n";

type HistoryTabKey = "chats" | "tasks" | "notes";

type Props = {
    open: boolean;
    onClose: () => void;
    onOpenChat: (entry: ChatHistoryEntry) => void;
    onOpenThread: (entry: ThreadHistoryEntry) => void;
    onOpenTask: (entry: TaskHistoryEntry) => void;
    onOpenMilestone: (entry: MilestoneHistoryEntry) => void;
    onOpenNote: (entry: NoteHistoryEntry) => void;
};

// Small relative-time formatter. Avoids pulling in dayjs's relativeTime
// plugin just for this surface; values render once per modal open so a
// passive helper is fine.
const formatRelative = (ts: number): string => {
    const diffMs = Date.now() - ts;
    if (diffMs < 0) return "just now";
    const sec = Math.floor(diffMs / 1000);
    if (sec < 60) return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(days / 365);
    return `${years}y ago`;
};

// Pill-style active state replacing Joy's default left-bar indicator
// on the modal's horizontal tab bar. Lifted from SettingsModal.
const TAB_SX = {
    justifyContent: "center",
    gap: 1,
    borderRadius: "md",
    px: 1.5,
    py: 0.85,
    minHeight: 36,
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "text.secondary",
    transition: "background-color 0.12s ease, color 0.12s ease",
    "&::after": { display: "none" },
    "&:hover:not([aria-selected='true'])": {
        bgcolor: "background.level1",
        color: "text.primary",
    },
    "&[aria-selected='true']": {
        bgcolor: "primary.softBg",
        color: "primary.softColor",
        fontWeight: 600,
    },
} as const;

const TAB_ICON_SX = { fontSize: 18, flexShrink: 0 } as const;

type RowProps = {
    icon: React.ReactNode;
    label: string;
    timestamp: number;
    onClick: () => void;
    isDark: boolean;
};

const HistoryRow = ({ icon, label, timestamp, onClick, isDark }: RowProps) => (
    <Box
        sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            px: 1.25,
            py: 1,
            borderRadius: "8px",
            cursor: "pointer",
            transition: "background-color 0.12s ease",
            "&:hover": {
                backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
            },
        }}
        onClick={onClick}
    >
        <Box
            sx={{
                width: 28,
                height: 28,
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                backgroundColor: isDark ? "rgba(124,58,237,0.12)" : "rgba(124,58,237,0.08)",
                color: isDark ? "#a78bfa" : "#7c3aed",
            }}
        >
            {icon}
        </Box>
        <Typography
            level="body-sm"
            sx={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontWeight: 500,
            }}
        >
            {label}
        </Typography>
        <Typography
            level="body-xs"
            sx={{
                flexShrink: 0,
                color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)",
            }}
        >
            {formatRelative(timestamp)}
        </Typography>
    </Box>
);

const EmptyState = ({ message }: { message: string }) => (
    <Box
        sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            py: 6,
            gap: 1,
            color: "text.tertiary",
        }}
    >
        <HistoryRoundedIcon sx={{ fontSize: 36, opacity: 0.5 }} />
        <Typography level="body-sm" sx={{ color: "inherit" }}>
            {message}
        </Typography>
    </Box>
);

export const HistoryModal = ({
    open,
    onClose,
    onOpenChat,
    onOpenThread,
    onOpenTask,
    onOpenMilestone,
    onOpenNote,
}: Props) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const { chatsEntries, tasksEntries, notesEntries, clear } = useHistory();
    const [tab, setTab] = useState<HistoryTabKey>("chats");

    const renderEntry = (entry: HistoryEntry) => {
        switch (entry.kind) {
            case "chat":
                return (
                    <HistoryRow
                        key={`chat-${entry.chatType}-${entry.chatId}-${entry.openedAt}`}
                        icon={<ChatBubbleOutlineRoundedIcon sx={{ fontSize: 16 }} />}
                        isDark={isDark}
                        label={entry.label}
                        timestamp={entry.openedAt}
                        onClick={() => onOpenChat(entry)}
                    />
                );
            case "thread":
                return (
                    <HistoryRow
                        key={`thread-${entry.chatType}-${entry.chatId}-${entry.threadId}-${entry.openedAt}`}
                        icon={<ForumRoundedIcon sx={{ fontSize: 16 }} />}
                        isDark={isDark}
                        label={entry.label}
                        timestamp={entry.openedAt}
                        onClick={() => onOpenThread(entry)}
                    />
                );
            case "task":
                return (
                    <HistoryRow
                        key={`task-${entry.taskId}-${entry.openedAt}`}
                        icon={<AssignmentRoundedIcon sx={{ fontSize: 16 }} />}
                        isDark={isDark}
                        label={entry.label}
                        timestamp={entry.openedAt}
                        onClick={() => onOpenTask(entry)}
                    />
                );
            case "milestone":
                return (
                    <HistoryRow
                        key={`milestone-${entry.milestoneId}-${entry.openedAt}`}
                        icon={<FlagRoundedIcon sx={{ fontSize: 16 }} />}
                        isDark={isDark}
                        label={entry.label}
                        timestamp={entry.openedAt}
                        onClick={() => onOpenMilestone(entry)}
                    />
                );
            case "note":
                return (
                    <HistoryRow
                        key={`note-${entry.noteType}-${entry.noteId}-${entry.openedAt}`}
                        icon={<NoteAltRoundedIcon sx={{ fontSize: 16 }} />}
                        isDark={isDark}
                        label={entry.label}
                        timestamp={entry.openedAt}
                        onClick={() => onOpenNote(entry)}
                    />
                );
        }
    };

    return (
        <Modal open={open} onClose={onClose}>
            <ModalDialog
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                size="lg"
                sx={{
                    width: { xs: "92vw", sm: 500, md: 580 },
                    maxHeight: "85vh",
                    overflowY: "auto",
                    overflowX: "hidden",
                    borderRadius: "xl",
                    p: 2.5,
                }}
            >
                <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 1 }}>
                    <HistoryRoundedIcon />
                    <Typography level="title-lg">{t.history.title}</Typography>
                    <Box sx={{ flex: 1 }} />
                    <IconButton variant="plain" onClick={onClose}>
                        <CloseRoundedIcon />
                    </IconButton>
                </Stack>
                <Divider sx={{ mb: 2 }} />
                <Tabs
                    sx={{ bgcolor: "transparent" }}
                    value={tab}
                    onChange={(_e, v) => {
                        if (typeof v === "string") setTab(v as HistoryTabKey);
                    }}
                >
                    <TabList sx={{ gap: 0.5, mb: 1.5 }}>
                        <Tab sx={TAB_SX} value="chats">
                            <ChatBubbleOutlineRoundedIcon sx={TAB_ICON_SX} />
                            {t.history.tabs.chats}
                        </Tab>
                        <Tab sx={TAB_SX} value="tasks">
                            <AssignmentRoundedIcon sx={TAB_ICON_SX} />
                            {t.history.tabs.tasks}
                        </Tab>
                        <Tab sx={TAB_SX} value="notes">
                            <NoteAltRoundedIcon sx={TAB_ICON_SX} />
                            {t.history.tabs.notes}
                        </Tab>
                    </TabList>

                    <TabPanel sx={{ px: 0, py: 0.5 }} value="chats">
                        <Stack spacing={0.25}>
                            {chatsEntries.length === 0 ? (
                                <EmptyState message={t.history.empty} />
                            ) : (
                                chatsEntries.map(renderEntry)
                            )}
                        </Stack>
                    </TabPanel>
                    <TabPanel sx={{ px: 0, py: 0.5 }} value="tasks">
                        <Stack spacing={0.25}>
                            {tasksEntries.length === 0 ? (
                                <EmptyState message={t.history.empty} />
                            ) : (
                                tasksEntries.map(renderEntry)
                            )}
                        </Stack>
                    </TabPanel>
                    <TabPanel sx={{ px: 0, py: 0.5 }} value="notes">
                        <Stack spacing={0.25}>
                            {notesEntries.length === 0 ? (
                                <EmptyState message={t.history.empty} />
                            ) : (
                                notesEntries.map(renderEntry)
                            )}
                        </Stack>
                    </TabPanel>
                </Tabs>

                <Divider sx={{ mt: 2, mb: 1.5 }} />
                <Stack alignItems="center" direction="row" justifyContent="flex-end">
                    <Button color="neutral" size="sm" variant="plain" onClick={clear}>
                        {t.history.clear}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
