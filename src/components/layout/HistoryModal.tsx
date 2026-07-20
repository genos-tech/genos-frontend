import { useState } from "react";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import NoteAltRoundedIcon from "@mui/icons-material/NoteAltRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import WindowRoundedIcon from "@mui/icons-material/WindowRounded";
import {
    Avatar,
    Box,
    Button,
    Chip,
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
import { alpha } from "@mui/system";

import { derivePreviewMediaKind, MEDIA_LABEL_KEYS } from "../../features/chat/utils/common";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import {
    ChatHistoryEntry,
    HistoryEntry,
    MilestoneHistoryEntry,
    NoteHistoryEntry,
    TaskHistoryEntry,
    ThreadHistoryEntry,
    useHistory,
} from "../../hooks/common/useHistory";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { SprintMilestoneManagementState } from "../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../i18n";
import { AllChatProps } from "../../types/chat";
import { useAvatarContext } from "../ui/avatars/AvatarContext";
import { UserAvatar } from "../ui/avatars/UserAvatar";
import { EmojiText } from "../ui/emoji/EmojiText";

const MEDIA_URL = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type HistoryTabKey = "chats" | "tasks" | "notes";

type Props = {
    open: boolean;
    onClose: () => void;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    useSM: SprintMilestoneManagementState;
    usePM: ProjectManagementState;
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

// `UserAvatar`'s PulseDot baseline math is calibrated for size 26 and 32.
// At in-between values (28/30) the dot floats just outside the visible
// avatar circle. Use 32 so the status dot lands cleanly on the circle's
// bottom-right edge.
const AVATAR_SIZE = 32;
const AVATAR_FALLBACK_ICON_SIZE = 18;

// Build a media URL for an Avatar `src`. Mirrors the helper in
// UserAvatar so empty paths don't trigger broken-image requests.
const buildMediaSrc = (path: string | null | undefined): string | undefined => {
    if (!path) return undefined;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    if (!MEDIA_URL) return undefined;
    return `${MEDIA_URL}/${path}`;
};

// Visual-only group/project avatar. The full GMAvatar/ProjectAvatar
// components open profile modals on click — undesirable inside a row
// where the row itself is the click target.
const GroupOrProjectAvatar = ({
    src,
    fallback,
    isDark,
}: {
    src: string | undefined;
    fallback: React.ReactNode;
    isDark: boolean;
}) => (
    <Avatar
        size="sm"
        src={src}
        sx={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            bgcolor: isDark ? "rgba(124,58,237,0.18)" : "rgba(124,58,237,0.12)",
            color: isDark ? "#a78bfa" : "#7c3aed",
        }}
    >
        {fallback}
    </Avatar>
);

// Pick the right avatar for a chat-kind history row.
const renderChatAvatar = (
    chatType: number,
    chat: AllChatProps | undefined,
    isDark: boolean
): React.ReactNode => {
    // DM
    if (chatType === 1) {
        const partnerUserId = chat?.dmPartnerUser?.userId;
        return <UserAvatar clickable={false} size={AVATAR_SIZE} userId={partnerUserId} />;
    }
    // GM or MDM
    if (chatType === 2 || chatType === 4) {
        return (
            <GroupOrProjectAvatar
                fallback={<GroupsRoundedIcon sx={{ fontSize: AVATAR_FALLBACK_ICON_SIZE }} />}
                isDark={isDark}
                src={buildMediaSrc(chat?.profileImagePath)}
            />
        );
    }
    // PM
    if (chatType === 3) {
        return (
            <GroupOrProjectAvatar
                fallback={<AccountTreeRoundedIcon sx={{ fontSize: AVATAR_FALLBACK_ICON_SIZE }} />}
                isDark={isDark}
                src={buildMediaSrc(chat?.profileImagePath)}
            />
        );
    }
    return (
        <GroupOrProjectAvatar
            isDark={isDark}
            src={undefined}
            fallback={
                <ChatBubbleOutlineRoundedIcon sx={{ fontSize: AVATAR_FALLBACK_ICON_SIZE }} />
            }
        />
    );
};

// Tasks: prefer the project's PM-chat profile image (same image the
// project avatar shows elsewhere); fall back to a generic project icon.
const renderProjectAvatar = (
    chats: AllChatProps[],
    projectId: number | null | undefined,
    isDark: boolean
): React.ReactNode => {
    const pmChat =
        projectId != null
            ? chats.find((c) => c.chatType === 3 && c.project?.projectId === projectId)
            : undefined;
    return (
        <GroupOrProjectAvatar
            fallback={<AccountTreeRoundedIcon sx={{ fontSize: AVATAR_FALLBACK_ICON_SIZE }} />}
            isDark={isDark}
            src={buildMediaSrc(pmChat?.profileImagePath)}
        />
    );
};

// Per-note-type icon + color, matching RecentNoteItem.
const NOTE_TYPE_VISUAL: Record<
    number,
    { label: string; icon: React.ReactNode; light: string; dark: string }
> = {
    1: {
        label: "My note",
        icon: <WindowRoundedIcon sx={{ fontSize: 14 }} />,
        light: "#6366f1",
        dark: "#818cf8",
    },
    2: {
        label: "Task note",
        icon: <AssignmentRoundedIcon sx={{ fontSize: 14 }} />,
        light: "#22c55e",
        dark: "#4ade80",
    },
    3: {
        label: "Chat note",
        icon: <QuestionAnswerRoundedIcon sx={{ fontSize: 14 }} />,
        light: "#f97316",
        dark: "#fb923c",
    },
};

type RowProps = {
    avatar: React.ReactNode;
    label: string;
    subtitle?: string | null;
    chips?: React.ReactNode;
    // When true the chip(s) render BEFORE the label — used by notes
    // where the chip is the type identifier the eye should hit first.
    // Threads / milestones / task-status keep the default chip-after
    // since the chip is a tag on the row, not the row's category.
    chipsBeforeLabel?: boolean;
    timestamp: number;
    onClick: () => void;
    isDark: boolean;
};

const HistoryRow = ({
    avatar,
    label,
    subtitle,
    chips,
    chipsBeforeLabel,
    timestamp,
    onClick,
    isDark,
}: RowProps) => (
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
                width: AVATAR_SIZE,
                height: AVATAR_SIZE,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
            }}
        >
            {avatar}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack alignItems="center" direction="row" spacing={0.75}>
                {chipsBeforeLabel ? chips : null}
                <Typography
                    level="body-sm"
                    sx={{
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontWeight: 500,
                    }}
                >
                    {label}
                </Typography>
                {chipsBeforeLabel ? null : chips}
            </Stack>
            {subtitle ? (
                <Typography
                    level="body-xs"
                    sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
                    }}
                >
                    {/* Message-preview subtitles carry custom emoji as
                        their `:name:` shortcode (see `EmojiText`). Every
                        row kind funnels through here, so resolving at
                        this one site covers chat / thread rows without
                        touching the string-typed prop; subtitles that
                        are plain labels (project name, chat name) have
                        no shortcodes and take the component's fast
                        path. */}
                    <EmojiText text={subtitle} />
                </Typography>
            ) : null}
        </Box>
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

// Small colored chip used by Thread / Milestone / Note-type indicators.
const SmallChip = ({
    icon,
    label,
    color,
    isDark,
}: {
    icon?: React.ReactNode;
    label: string;
    color: { light: string; dark: string };
    isDark: boolean;
}) => {
    const c = isDark ? color.dark : color.light;
    return (
        <Chip
            size="sm"
            startDecorator={icon}
            variant="soft"
            sx={{
                "--Chip-paddingInline": "6px",
                "--Chip-minHeight": "18px",
                fontSize: "0.65rem",
                fontWeight: 600,
                color: c,
                bgcolor: isDark ? `${c}22` : `${c}1a`,
                border: `1px solid ${isDark ? `${c}33` : `${c}26`}`,
            }}
        >
            {label}
        </Chip>
    );
};

const CHIP_COLORS = {
    thread: { light: "#0ea5e9", dark: "#38bdf8" },
    milestone: { light: "#7c3aed", dark: "#a78bfa" },
} as const;

// Canonical task-status palette used everywhere else in the app
// (TaskPreview, SprintMilestonesSection, SprintManagerDialog). Keep
// these in sync — the user reads the same color in the row as on the
// task page itself.
const STATUS_COLOR: Record<string, string> = {
    Open: "#0044c2",
    WIP: "#ff8c00",
    Pending: "#b900ff",
    Closed: "#1dc200",
    Deleted: "#94a3b8",
};

// Matches the chip styling in TaskTitleBlock.tsx: solid-feel saturated
// soft background (alpha 0.65 light / 0.25 dark), white text, soft 8px
// radius border that picks up the same status color. Sized to match
// `SmallChip` (size="sm" + 6px inline padding + 18px min-height +
// 0.65rem text) so the row's chip stack reads as one consistent set;
// only the saturated bg / white text distinguishes the status chip
// as the row's primary signal.
const TaskStatusChip = ({ status, isDark }: { status: string; isDark: boolean }) => {
    const color = STATUS_COLOR[status.trim()] ?? "#94a3b8";
    return (
        <Chip
            size="sm"
            variant="soft"
            sx={{
                "--Chip-paddingInline": "6px",
                "--Chip-minHeight": "18px",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "0.65rem",
                backgroundColor: alpha(color, isDark ? 0.25 : 0.65),
                color: "#ffffff",
                border: "1px solid",
                borderColor: alpha(color, isDark ? 0.3 : 0.25),
            }}
        >
            {status}
        </Chip>
    );
};

export const HistoryModal = ({
    open,
    onClose,
    useCM,
    useTM,
    onOpenChat,
    onOpenThread,
    onOpenTask,
    onOpenMilestone,
    onOpenNote,
}: Props) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const { myself } = useAvatarContext();
    const { chatsEntries, tasksEntries, notesEntries, clear } = useHistory();
    const [tab, setTab] = useState<HistoryTabKey>("chats");

    // PUNCH LIST (v3 chatId migration): `AllChatProps.chatId` is `string`
    // post-flip; `HistoryEntry.chatId` is still `number` (legacy IDB
    // history shape). Stringify at the comparison.
    const findChat = (chatType: number, chatId: number): AllChatProps | undefined =>
        useCM.allChats.find((c) => c.chatType === chatType && c.chatId === String(chatId));

    // "GIF" / "Image" / … for a chat whose latest message is media-only
    // and so has no preview text at all. `undefined` (not "") so the
    // subtitle line stays absent when there's nothing to say.
    const chatMediaLabel = (chat: AllChatProps | undefined): string | undefined => {
        const kind = derivePreviewMediaKind(chat?.latestMessage?.content);
        return kind ? t.chat.sidebar[MEDIA_LABEL_KEYS[kind]] : undefined;
    };

    const renderEntry = (entry: HistoryEntry) => {
        switch (entry.kind) {
            case "chat": {
                const chat = findChat(entry.chatType, entry.chatId);
                // Per-message rows (recorded from `/message/:id` URLs)
                // show that message's text — that's the whole point of
                // having a separate row per message. If the lookup
                // didn't find the bubble (offline IDB miss), fall back
                // to a "Message #id" stub so the row still reads as
                // distinct from neighboring rows in the same chat.
                // Plain chat rows mirror the sidebar's
                // `ChatListItemMessage` and show `latestMessageText` —
                // including its media fallback, so a chat whose latest
                // message is a GIF gets the same label there and here
                // instead of losing its subtitle line. (Per-message rows
                // can't do this: a `HistoryEntry` persists only text, no
                // blocks — they fall back to the "Message #id" stub.)
                const subtitle =
                    entry.messageId != null
                        ? entry.messageText || `Message #${entry.messageId}`
                        : chat?.latestMessageText || chatMediaLabel(chat);
                return (
                    <HistoryRow
                        key={`chat-${entry.chatType}-${entry.chatId}-${entry.messageId ?? 0}-${entry.openedAt}`}
                        avatar={renderChatAvatar(entry.chatType, chat, isDark)}
                        isDark={isDark}
                        label={entry.label}
                        subtitle={subtitle}
                        timestamp={entry.openedAt}
                        onClick={() => onOpenChat(entry)}
                    />
                );
            }
            case "thread": {
                const chat = findChat(entry.chatType, entry.chatId);
                // Prefer the deep-linked in-thread message text; fall
                // back to the parent-message text (the bubble the
                // thread hangs off of) for thread rows without a
                // specific message focus.
                const subtitle =
                    entry.messageId != null
                        ? entry.messageText || `Message #${entry.messageId}`
                        : entry.parentMessageText || undefined;
                return (
                    <HistoryRow
                        key={`thread-${entry.chatType}-${entry.chatId}-${entry.threadId}-${entry.messageId ?? 0}-${entry.openedAt}`}
                        avatar={renderChatAvatar(entry.chatType, chat, isDark)}
                        isDark={isDark}
                        label={entry.label}
                        subtitle={subtitle}
                        timestamp={entry.openedAt}
                        chips={
                            <SmallChip
                                color={CHIP_COLORS.thread}
                                icon={<ForumRoundedIcon sx={{ fontSize: 12 }} />}
                                isDark={isDark}
                                label="Thread"
                            />
                        }
                        chipsBeforeLabel
                        onClick={() => onOpenThread(entry)}
                    />
                );
            }
            case "task": {
                const liveTask = useTM.allTasks.find((t) => Number(t.id) === Number(entry.taskId));
                const status = liveTask?.status ?? null;
                return (
                    <HistoryRow
                        key={`task-${entry.taskId}-${entry.openedAt}`}
                        avatar={renderProjectAvatar(useCM.allChats, entry.projectId, isDark)}
                        chips={status ? <TaskStatusChip isDark={isDark} status={status} /> : null}
                        isDark={isDark}
                        label={entry.label}
                        subtitle={entry.projectName || undefined}
                        timestamp={entry.openedAt}
                        chipsBeforeLabel
                        onClick={() => onOpenTask(entry)}
                    />
                );
            }
            case "milestone": {
                return (
                    <HistoryRow
                        key={`milestone-${entry.milestoneId}-${entry.openedAt}`}
                        avatar={renderProjectAvatar(useCM.allChats, entry.projectId, isDark)}
                        isDark={isDark}
                        label={entry.label}
                        subtitle={entry.projectName || undefined}
                        timestamp={entry.openedAt}
                        chips={
                            <SmallChip
                                color={CHIP_COLORS.milestone}
                                icon={<FlagRoundedIcon sx={{ fontSize: 12 }} />}
                                isDark={isDark}
                                label="Milestone"
                            />
                        }
                        chipsBeforeLabel
                        onClick={() => onOpenMilestone(entry)}
                    />
                );
            }
            case "note": {
                const visual = NOTE_TYPE_VISUAL[entry.noteType];
                const subtitle =
                    entry.noteType === 2
                        ? [entry.projectName, entry.taskTitle].filter(Boolean).join(" · ") || null
                        : entry.noteType === 3
                          ? entry.chatName || null
                          : null;
                // Mirror the avatar a user sees in the originating
                // surface: personal notes -> their own avatar; task
                // notes -> the task's project image; chat notes ->
                // the chat's avatar (DM partner / GM-MDM-PM image).
                let noteAvatar: React.ReactNode;
                if (entry.noteType === 1) {
                    noteAvatar = (
                        <UserAvatar clickable={false} size={AVATAR_SIZE} userId={myself.userId} />
                    );
                } else if (entry.noteType === 2) {
                    noteAvatar = renderProjectAvatar(useCM.allChats, entry.projectId, isDark);
                } else if (
                    entry.noteType === 3 &&
                    entry.chatType != null &&
                    entry.chatId != null
                ) {
                    const chat = findChat(entry.chatType, entry.chatId);
                    noteAvatar = renderChatAvatar(entry.chatType, chat, isDark);
                } else {
                    noteAvatar = (
                        <GroupOrProjectAvatar
                            isDark={isDark}
                            src={undefined}
                            fallback={
                                <NoteAltRoundedIcon sx={{ fontSize: AVATAR_FALLBACK_ICON_SIZE }} />
                            }
                        />
                    );
                }
                return (
                    <HistoryRow
                        key={`note-${entry.noteType}-${entry.noteId}-${entry.openedAt}`}
                        avatar={noteAvatar}
                        isDark={isDark}
                        label={entry.label}
                        subtitle={subtitle || undefined}
                        timestamp={entry.openedAt}
                        chips={
                            visual ? (
                                <SmallChip
                                    color={{ light: visual.light, dark: visual.dark }}
                                    icon={visual.icon}
                                    isDark={isDark}
                                    label={visual.label}
                                />
                            ) : null
                        }
                        chipsBeforeLabel
                        onClick={() => onOpenNote(entry)}
                    />
                );
            }
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
