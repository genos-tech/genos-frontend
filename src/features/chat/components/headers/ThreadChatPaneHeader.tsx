// `sort-keys` + `react/jsx-sort-props` are disabled file-wide: this
// 700+-line legacy chat thread header carries ~70 violations in Joy
// UI `sx` prop objects and prop lists whose visual grouping is
// intentional and not worth re-sorting given the header is part of the
// legacy chat surface slated for replacement by the v3 channel UI.
/* eslint-disable sort-keys, react/jsx-sort-props */
import AddTaskRoundedIcon from "@mui/icons-material/AddTaskRounded";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import NoteAltRoundedIcon from "@mui/icons-material/NoteAltRounded";
import ReplyRoundedIcon from "@mui/icons-material/ReplyRounded";
import {
    Box,
    Dropdown,
    IconButton,
    Menu,
    MenuButton,
    MenuItem,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";
import { useNavigate } from "react-router-dom";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { MDMAvatar } from "../../../../components/ui/avatars/MDMAvatar";
import { MoreMenu } from "../../../../components/ui/MoreMenu";
import { ThreadChatPaneHeaderStyles } from "../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { useIsMobile } from "../../../../hooks/common/useIsMobile";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { MuteToggleButton } from "../../../../services/notifications/MuteToggleButton";
import { UserProps } from "../../../../types/admin";
import { ThreadProps } from "../../../../types/chat";
import { CHAT_TYPE_CODE, SpotlightResult } from "../../../spotlight/types";
import { CopyableTaskIdText } from "../../../tasks/components/CopyableTaskId";
import { formatTaskDisplayId } from "../../../tasks/utils/taskDisplayId";
import { ThreadAskModal } from "../../../threadAsk/ThreadAskModal";
import { useThreadAsk } from "../../../threadAsk/useThreadAsk";
import { useChatContext } from "../../context/ChatContext";

type ThreadChatPaneHeaderProps = {
    myself: UserProps;
    useCM: ChatManagementState;
    useNM: NoteManagementState;
    useTM: TaskManagementState;
};

export const ThreadChatPaneHeader = (props: ThreadChatPaneHeaderProps) => {
    const { myself, useCM, useNM, useTM } = props;
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const styles = isDark ? ThreadChatPaneHeaderStyles.dark : ThreadChatPaneHeaderStyles.light;
    const { currentThreadTaskId, usePM } = useChatContext();
    const { accessToken } = useAuth();
    // Modal state for the "Ask about this thread" feature. Mounted at
    // this header so each thread gets a clean hook instance; switching
    // threads naturally tears down the in-progress Q&A.
    const threadAsk = useThreadAsk({ accessToken, teamId: myself.teamId });
    const openThreadAsk = () => {
        const chatType = useCM.currentThreadChat?.chatType;
        const chatId = useCM.currentThreadChat?.chatId;
        const threadId = useCM.currentThreadChat?.threadId;
        if (chatType === undefined || chatId === undefined || threadId === undefined) return;
        threadAsk.open({ chatType, chatId, threadId });
    };
    // Citation click handler for the thread-Ask modal. Mirrors
    // `handleSpotlightSelect` in App.tsx — same URL shapes / same
    // `moveToSpecificChat` call for chat citations so a click here
    // lands on the same surface as a Spotlight click would. Doesn't
    // close the modal: a user might want to inspect a citation, then
    // come back and ask a follow-up about the same thread.
    const onCitationSelect = (r: SpotlightResult) => {
        if (r.entity_type === "task" && r.task_id && r.project_id) {
            navigate(`/workspace/tasks/project/${r.project_id}/task/${r.task_id}`);
            return;
        }
        if (r.entity_type === "project" && r.project_id) {
            navigate(`/workspace/tasks/project/${r.project_id}`);
            return;
        }
        if (r.entity_type === "chat" && r.chat_type && r.chat_id) {
            const chatTypeCode = CHAT_TYPE_CODE[r.chat_type];
            // `chat_id` is the v3 channel UUID (string) — pass it through
            // unchanged. The old `Number(r.chat_id)` yielded NaN for a
            // UUID and produced `/workspace/chat/dm/NaN` (this "mirrors
            // handleSpotlightSelect" handler had copied the pre-fix
            // version). thread/message ids coalesce NaN -> 0/undefined so
            // a non-numeric id just skips focus instead of corrupting it.
            const numericChatId = r.chat_id as unknown as number;
            const numericThreadId = Number(r.thread_id) || 0;
            const numericMessageId = Number(r.message_id) || undefined;
            useCM.moveToSpecificChat(
                chatTypeCode,
                numericChatId,
                numericThreadId,
                false,
                numericThreadId !== 0,
                useTM.setCurrentPreviewTaskId,
                usePM.setCurrentProject,
                numericMessageId
            );
            return;
        }
        if (r.entity_type === "note" && r.note_id) {
            if (r.note_type === "personal") {
                navigate(`/workspace/notes/my/${r.note_id}`);
                return;
            }
            if (r.note_type === "task" && r.project_id && r.task_id) {
                navigate(
                    `/workspace/notes/task/project/${r.project_id}` +
                        `/task/${r.task_id}/note/${r.note_id}`
                );
                return;
            }
            if (r.note_type === "chat" && r.chat_type && r.chat_id && r.thread_id) {
                navigate(
                    `/workspace/notes/chat/${r.chat_type}` +
                        `/${r.chat_id}/thread/${r.thread_id}/note/${r.note_id}`
                );
                return;
            }
            navigate("/workspace/notes");
        }
    };

    const isYou: boolean =
        myself.userId === useCM.currentThreadChat?.dmPartnerUser.userId &&
        useCM.currentThreadChat?.chatType === 1;

    // Action button style
    const actionButtonStyle = {
        background: styles.buttonBg,
        border: `1px solid ${styles.buttonBorder}`,
        borderRadius: "10px",
        minWidth: 36,
        height: 36,
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {
            background: styles.buttonHover,
            transform: "translateY(-1px)",
            boxShadow: `0 4px 12px ${styles.glowColor}`,
        },
    };

    // Danger button style
    const dangerButtonStyle = {
        background: styles.dangerBg,
        border: `1px solid ${styles.dangerBorder}`,
        borderRadius: "10px",
        minWidth: 36,
        height: 36,
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {
            background: styles.dangerHover,
            transform: "translateY(-1px)",
            boxShadow: "0 4px 12px rgba(232,121,195,0.2)",
        },
    };

    const dummyThreadChat: ThreadProps = {
        chatId: useCM.currentThreadChat?.chatId as number,
        chatName: useCM.currentThreadChat?.chatName as string,
        threadId: useCM.currentThreadChat?.threadId as number,
        chatType: useCM.currentThreadChat?.chatType as number,
        dmPartnerUser: useCM.currentThreadChat?.dmPartnerUser as UserProps,
        taskId: useCM.currentThreadChat?.taskId as number | null,
        messages: [],
        TSLastMessage: useCM.currentThreadChat?.TSLastMessage as string,
    };

    // Mobile back: navigate up one URL segment from
    // `/workspace/chat/:type/:id/thread/:tid` to `/workspace/chat/:type/:id`.
    // useChatRouting picks up the missing thread segment and clears
    // isThreadVisible, so the main chat pane takes over.
    const handleMobileBack = () => {
        const CHAT_TYPE_TO_PATH: Record<number, string> = {
            1: "dm",
            2: "gm",
            3: "pm",
            4: "mdm",
            5: "activity",
            6: "flagged",
        };
        const chatType = useCM.currentThreadChat?.chatType;
        const chatId = useCM.currentThreadChat?.chatId;
        const typePath = chatType !== undefined ? CHAT_TYPE_TO_PATH[chatType] : undefined;
        if (typePath && chatId !== undefined) {
            navigate(`/workspace/chat/${typePath}/${chatId}`);
        }
        useCM.setIsMainChatVisible(true);
        useCM.setIsThreadVisible(false);
        useCM.setCurrentThreadChat(dummyThreadChat);
    };

    const openTaskHandler = () => {
        useCM.setIsMainChatVisible(false);
        useCM.setIsThreadVisible(true);
        useTM.setCurrentPreviewTaskId(currentThreadTaskId);
        useTM.setIsTaskPreviewVisible(true);
        useTM.setIsCreatingTask({
            flag: false,
            parentTaskId: null,
            rootTaskId: null,
            creationKind: "task",
            milestoneId: null,
        });
    };

    const createTaskHandler = () => {
        useCM.setIsMainChatVisible(true);
        useCM.setIsThreadVisible(true);
        useTM.setIsTaskPreviewVisible(false);
        useTM.setIsCreatingTask({
            flag: true,
            parentTaskId: null,
            rootTaskId: null,
            creationKind: "task",
            milestoneId: null,
        });
    };

    const openNoteHandler = () => {
        const chatType = useCM.currentThreadChat?.chatType;
        const chatId = useCM.currentThreadChat?.chatId;
        // PUNCH LIST (v3 chatId migration): `AllChatProps.chatId` is
        // `string` post-flip; `ThreadProps.chatId` is still `number`.
        // `String(chatId)` bridges, but undefined would yield the
        // literal "undefined" string — guard explicitly.
        const matchedChat =
            chatId != null
                ? useCM.allChats.find(
                      (c) => c.chatId === String(chatId) && c.chatType === chatType
                  )
                : undefined;
        let chatName =
            matchedChat?.chatName ||
            useCM.currentMainChat?.chatName ||
            useCM.currentThreadChat?.chatName;
        if (chatType === 4 && matchedChat?.mdmMembers && matchedChat.mdmMembers.length > 0) {
            const MAX_DISPLAY = 3;
            const names = matchedChat.mdmMembers.map((m) => m.userName);
            chatName =
                names.length <= MAX_DISPLAY
                    ? names.join(", ")
                    : `${names.slice(0, MAX_DISPLAY).join(", ")} +${names.length - MAX_DISPLAY}`;
        }
        useNM.chatPanelApi.openOrCreate(
            chatType as number,
            chatId as number,
            true,
            useCM.currentThreadChat?.threadId as number,
            chatName
        );
        useCM.setIsChatNoteVisibleInChat(true);
        useCM.setIsMainChatVisible(false);
        useCM.setIsThreadVisible(true);
        useTM.setIsTaskPreviewVisible(false);
        useTM.setIsCreatingTask((prev) => ({ ...prev, flag: false }));
    };

    if (isMobile) {
        const hasTask = currentThreadTaskId !== -1;
        const chatType = useCM.currentThreadChat?.chatType;
        return (
            <Stack
                direction="row"
                sx={{
                    justifyContent: "space-between",
                    alignItems: "center",
                    px: 1,
                    background: styles.containerBg,
                    backdropFilter: "blur(12px)",
                    borderBottom: `1px solid ${styles.containerBorder}`,
                    minHeight: "56px",
                    gap: 0.5,
                }}
            >
                <IconButton
                    size="sm"
                    variant="plain"
                    onClick={handleMobileBack}
                    aria-label="Back"
                    sx={{ flexShrink: 0 }}
                >
                    <ArrowBackIosNewRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>

                <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{ alignItems: "center", flex: 1, minWidth: 0, overflow: "hidden" }}
                >
                    <ReplyRoundedIcon
                        sx={{ fontSize: 16, color: styles.accentColor, flexShrink: 0 }}
                    />
                    <Typography
                        level="body-sm"
                        sx={{
                            fontWeight: 600,
                            color: styles.textColor,
                            letterSpacing: "-0.01em",
                        }}
                        noWrap
                    >
                        {useCM.currentThreadChat?.chatName || "Thread"}
                    </Typography>
                </Stack>

                <Dropdown>
                    <MenuButton
                        slots={{ root: IconButton }}
                        slotProps={{ root: { size: "sm", variant: "plain" } }}
                    >
                        <MoreVertRoundedIcon sx={{ fontSize: 20 }} />
                    </MenuButton>
                    <Menu size="sm" placement="bottom-end" sx={{ minWidth: 200 }}>
                        <MenuItem onClick={openThreadAsk}>
                            <AutoAwesomeRoundedIcon
                                sx={{ fontSize: 18, color: styles.accentColor }}
                            />
                            {t.threadAsk.headerButton.label}
                        </MenuItem>
                        {hasTask && (
                            <MenuItem onClick={openTaskHandler}>
                                <AssignmentRoundedIcon
                                    sx={{ fontSize: 18, color: styles.accentColor }}
                                />
                                {t.chat.headers.openTask}
                            </MenuItem>
                        )}
                        {!hasTask && chatType !== 3 && (
                            <MenuItem onClick={createTaskHandler}>
                                <AddTaskRoundedIcon sx={{ fontSize: 18, color: "#fff" }} />
                                {t.chat.headers.newTaskTooltip}
                            </MenuItem>
                        )}
                        {chatType !== 3 && (
                            <MenuItem onClick={openNoteHandler}>
                                <NoteAltRoundedIcon
                                    sx={{ fontSize: 18, color: styles.accentColor }}
                                />
                                {t.chat.headers.openNoteTooltip}
                            </MenuItem>
                        )}
                    </Menu>
                </Dropdown>
                <ThreadAskModal
                    state={threadAsk}
                    myself={myself}
                    accessToken={accessToken}
                    chatName={useCM.currentThreadChat?.chatName || ""}
                    onSelectSource={onCitationSelect}
                />
            </Stack>
        );
    }

    return (
        <Stack
            direction="row"
            sx={{
                justifyContent: "space-between",
                alignItems: "center",
                px: { xs: 1.5, md: 2 },
                background: styles.containerBg,
                backdropFilter: "blur(12px)",
                borderBottom: `1px solid ${styles.containerBorder}`,
                minHeight: "64px",
            }}
        >
            {/* Left section: Thread badge + Avatar + Name */}
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
                {/* Thread badge */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        px: 1.25,
                        py: 0.5,
                        borderRadius: "10px",
                        background: styles.threadBadgeBg,
                        boxShadow: `0 2px 8px ${styles.glowColor}`,
                        flexShrink: 0,
                    }}
                >
                    <ReplyRoundedIcon sx={{ fontSize: 16, color: "#fff" }} />
                    <Typography
                        level="body-sm"
                        sx={{ fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}
                    >
                        Thread
                    </Typography>
                </Box>

                {/* MDM Avatar */}
                {useCM.currentThreadChat?.chatType === 4 && (
                    <Box sx={{ flexShrink: 0 }}>
                        <MDMAvatar
                            members={
                                useCM.allChats.find(
                                    (c) =>
                                        // v3 string vs ThreadProps numeric — `String()` bridges.
                                        c.chatId === String(useCM.currentThreadChat?.chatId) &&
                                        c.chatType === 4
                                )?.mdmMembers
                            }
                            size="sm"
                        />
                    </Box>
                )}

                {/* Chat name */}
                {useCM.currentThreadChat?.chatType === 4 ? (
                    <AppTooltip
                        title={
                            useCM.allChats
                                .find(
                                    (c) =>
                                        // v3 string vs ThreadProps numeric — `String()` bridges.
                                        c.chatId === String(useCM.currentThreadChat?.chatId) &&
                                        c.chatType === 4
                                )
                                ?.mdmMembers?.map((m) => m.userName)
                                .join(", ") || useCM.currentThreadChat?.chatName
                        }
                        placement="bottom"
                        arrow
                    >
                        <Typography
                            level="title-md"
                            sx={{
                                fontWeight: 600,
                                color: styles.textColor,
                                letterSpacing: "-0.01em",
                                maxWidth: 200,
                                cursor: "default",
                            }}
                            noWrap
                        >
                            {useCM.currentThreadChat?.chatName}
                        </Typography>
                    </AppTooltip>
                ) : (
                    <Typography
                        level="title-md"
                        sx={{
                            fontWeight: 600,
                            color: styles.textColor,
                            letterSpacing: "-0.01em",
                        }}
                        noWrap
                    >
                        {isYou
                            ? `${useCM.currentThreadChat?.chatName} (you)`
                            : useCM.currentThreadChat?.chatName}
                    </Typography>
                )}
            </Stack>

            {/* Right section: Task info + Actions */}
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                {/* Per-chat mute toggle (mutes the parent chat, which also
                    silences thread replies and any task-comment activity
                    rooted in the same chat). */}
                {useCM.currentThreadChat && (
                    <MuteToggleButton
                        chatType={useCM.currentThreadChat.chatType}
                        chatId={useCM.currentThreadChat.chatId}
                        chatName={useCM.currentThreadChat.chatName}
                    />
                )}

                {/*
                    Task pill — read-only "Open Task #N" affordance with
                    optional status dot. Only renders when a task exists
                    for this thread. The Create Task action has moved
                    into the MoreMenu (below) — having it both inline AND
                    in the menu would re-introduce the "two ways to do
                    one thing" confusion the unified pill solved.
                */}
                {(() => {
                    const hasTask = currentThreadTaskId !== -1;
                    const chatType = useCM.currentThreadChat?.chatType;

                    if (hasTask) {
                        // Original chip-visibility rule: only show status
                        // info when we trust it — PM/MDM threads always
                        // have a real task; other types only after the
                        // preview is loaded with taskExist === true.
                        const showStatus =
                            chatType === 3 ||
                            chatType === 4 ||
                            (!!useTM.currentPreviewTask &&
                                useCM.currentThreadChat?.taskExist === true);
                        const status = useTM.currentPreviewTask?.status;
                        const statusColor = status?.color || styles.accentColor;

                        // `currentThreadChat.displayId` isn't reliably
                        // populated by every `setCurrentThreadChat` call
                        // site, so the chip would fall back to "#<id>"
                        // for fresh thread loads. Pick the freshest
                        // record we can find — the loaded preview task
                        // when it matches this thread's task, otherwise
                        // the row from `allTasks` (carries displayId via
                        // fetchProjectTasks). Falls back to the thread
                        // chat itself when no other source is loaded.
                        const taskForDisplay =
                            (useTM.currentPreviewTask &&
                            useTM.currentPreviewTask.id === currentThreadTaskId
                                ? useTM.currentPreviewTask
                                : null) ??
                            useTM.allTasks.find((row) => row.id === String(currentThreadTaskId)) ??
                            useCM.currentThreadChat;

                        return (
                            <Tooltip
                                size="sm"
                                title={t.chat.headers.openTask}
                                variant="outlined"
                                sx={{ borderRadius: "8px" }}
                            >
                                <Box
                                    component="button"
                                    type="button"
                                    aria-label={`Open Task ${formatTaskDisplayId(taskForDisplay) || "N/A"}`}
                                    onClick={() => {
                                        useCM.setIsMainChatVisible(false);
                                        useCM.setIsThreadVisible(true);
                                        useTM.setCurrentPreviewTaskId(currentThreadTaskId);
                                        useTM.setIsTaskPreviewVisible(true);
                                        useTM.setIsCreatingTask({
                                            flag: false,
                                            parentTaskId: null,
                                            rootTaskId: null,
                                            creationKind: "task",
                                            milestoneId: null,
                                        });
                                    }}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 0.75,
                                        height: 32,
                                        px: 1.25,
                                        borderRadius: "10px",
                                        border: `1px solid ${styles.chipBorder}`,
                                        background: styles.chipBg,
                                        cursor: "pointer",
                                        font: "inherit",
                                        color: styles.textColor,
                                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                        "&:hover": {
                                            background: styles.buttonHover,
                                            transform: "translateY(-1px)",
                                            boxShadow: `0 4px 12px ${styles.glowColor}`,
                                        },
                                        "&:focus-visible": {
                                            outline: `2px solid ${styles.accentColor}`,
                                            outlineOffset: 2,
                                        },
                                    }}
                                >
                                    <AssignmentRoundedIcon
                                        sx={{
                                            fontSize: 16,
                                            color: styles.accentColor,
                                        }}
                                    />
                                    <CopyableTaskIdText
                                        task={taskForDisplay}
                                        fallback="N/A"
                                        prefix="Task "
                                        level="body-xs"
                                        sx={{
                                            fontWeight: 700,
                                            color: styles.textColor,
                                            letterSpacing: "-0.01em",
                                        }}
                                    />

                                    {showStatus && status && (
                                        <>
                                            <Box
                                                sx={{
                                                    width: "1px",
                                                    height: 14,
                                                    bgcolor: styles.chipBorder,
                                                    mx: 0.25,
                                                }}
                                            />
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 0.5,
                                                    px: 0.75,
                                                    py: 0.125,
                                                    borderRadius: "6px",
                                                    background: status.color
                                                        ? alpha(status.color, isDark ? 0.4 : 0.6)
                                                        : "transparent",
                                                    color: status.textColor,
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        width: 6,
                                                        height: 6,
                                                        borderRadius: "50%",
                                                        background: statusColor,
                                                        boxShadow: `0 0 0 2px ${alpha(
                                                            statusColor,
                                                            isDark ? 0.25 : 0.18
                                                        )}`,
                                                    }}
                                                />
                                                <Typography
                                                    level="body-xs"
                                                    sx={{
                                                        fontWeight: 700,
                                                        color: "inherit",
                                                        fontSize: "11px",
                                                        textTransform: "uppercase",
                                                        letterSpacing: "0.04em",
                                                    }}
                                                >
                                                    {status.status || "N/A"}
                                                </Typography>
                                            </Box>
                                        </>
                                    )}
                                </Box>
                            </Tooltip>
                        );
                    }

                    // No task yet → no inline pill; the Create Task
                    // action lives in the MoreMenu below.
                    return null;
                })()}

                {/* Ask about this thread — opens the AI Q&A modal. Always
                    visible (no chatType guard) because the summary +
                    follow-up flow is useful regardless of whether the
                    thread is in DM / GM / PM / MDM. */}
                <Tooltip
                    size="sm"
                    title={t.threadAsk.headerButton.tooltip}
                    variant="outlined"
                    sx={{ borderRadius: "8px" }}
                >
                    <IconButton
                        size="sm"
                        variant="plain"
                        aria-label={t.threadAsk.headerButton.tooltip}
                        sx={actionButtonStyle}
                        onClick={openThreadAsk}
                    >
                        <AutoAwesomeRoundedIcon sx={{ fontSize: 18, color: styles.accentColor }} />
                    </IconButton>
                </Tooltip>

                {/* Secondary actions (Open Note + Create Task) live in
                    a MoreMenu so the header's right edge stays focused
                    on the primary controls (mute / task pill / ask /
                    close). The menu trigger auto-hides when no items
                    are visible (e.g. PM threads where Open Note is
                    suppressed AND the thread already has a task). */}
                {(() => {
                    const hasTask = currentThreadTaskId !== -1;
                    const chatType = useCM.currentThreadChat?.chatType;
                    const showOpenNote = chatType !== 3;
                    const showCreateTask = !hasTask && chatType !== 3;
                    if (!showOpenNote && !showCreateTask) return null;
                    return (
                        <MoreMenu
                            placement="bottom-end"
                            triggerSize={36}
                            triggerSx={{
                                borderRadius: "10px",
                                background: styles.buttonBg,
                                border: `1px solid ${styles.buttonBorder}`,
                            }}
                            items={[
                                {
                                    id: "open-note",
                                    label: t.chat.headers.openNoteTooltip,
                                    icon: (
                                        <NoteAltRoundedIcon
                                            sx={{ fontSize: 18, color: styles.accentColor }}
                                        />
                                    ),
                                    visible: showOpenNote,
                                    onClick: openNoteHandler,
                                },
                                {
                                    id: "create-task",
                                    label: t.chat.headers.newTaskTooltip,
                                    icon: (
                                        <AddTaskRoundedIcon
                                            sx={{ fontSize: 18, color: styles.accentColor }}
                                        />
                                    ),
                                    visible: showCreateTask,
                                    onClick: createTaskHandler,
                                },
                            ]}
                        />
                    );
                })()}

                {/* Close Button */}
                <Tooltip
                    size="sm"
                    title={t.chat.headers.close}
                    variant="outlined"
                    sx={{ borderRadius: "8px" }}
                >
                    <IconButton
                        size="sm"
                        variant="plain"
                        sx={dangerButtonStyle}
                        onClick={() => {
                            useCM.setIsMainChatVisible(true);
                            useCM.setIsThreadVisible(false);
                            useCM.setCurrentThreadChat(dummyThreadChat);
                        }}
                    >
                        <CloseRoundedIcon sx={{ fontSize: 18, color: "#c026a8" }} />
                    </IconButton>
                </Tooltip>
            </Stack>

            {/* Thread Q&A modal — mounted once per header instance so
                state lives for the lifetime of this thread view. */}
            <ThreadAskModal
                state={threadAsk}
                myself={myself}
                accessToken={accessToken}
                chatName={useCM.currentThreadChat?.chatName || ""}
                onSelectSource={onCitationSelect}
            />
        </Stack>
    );
};
