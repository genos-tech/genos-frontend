// `sort-keys` + `react/jsx-sort-props` are disabled file-wide: this
// 700+-line legacy chat thread header carries ~70 violations in Joy
// UI `sx` prop objects and prop lists whose visual grouping is
// intentional and not worth re-sorting given the header is part of the
// legacy chat surface slated for replacement by the v3 channel UI.
/* eslint-disable react/jsx-sort-props */
import AddTaskRoundedIcon from "@mui/icons-material/AddTaskRounded";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
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
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { useResolvedUserName } from "../../../../components/ui/avatars/AvatarContext";
import { MDMAvatar } from "../../../../components/ui/avatars/MDMAvatar";
import { MoreMenu } from "../../../../components/ui/MoreMenu";
import { ThreadChatPaneHeaderStyles } from "../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { useIsMobile } from "../../../../hooks/common/useIsMobile";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { MuteTargetButton } from "../../../../services/notifications/MuteTargetButton";
import { UserProps } from "../../../../types/admin";
import { ThreadProps } from "../../../../types/chat";
import { TaskProps } from "../../../../types/tasks";
import { CHAT_TYPE_CODE, SpotlightResult } from "../../../spotlight/types";
import { TaskInfoPill } from "../../../tasks/components/TaskInfoPill";
import { ThreadAskModal } from "../../../threadAsk/ThreadAskModal";
import { useThreadAsk } from "../../../threadAsk/useThreadAsk";
import { useChatContext } from "../../context/ChatContext";
import { forgetThread } from "../../utils/threadMemory";
import { ExternalChatChip } from "../shared/ExternalChatChip";

// chatType → URL segment for building a thread deep-link
// (/workspace/chat/{path}/{chatId}/thread/{threadId}).
const THREAD_LINK_TYPE_PATH: Record<number, string> = { 1: "dm", 2: "gm", 3: "pm", 4: "mdm" };

type ThreadChatPaneHeaderProps = {
    myself: UserProps;
    useCM: ChatManagementState;
    useNM: NoteManagementState;
    useTM: TaskManagementState;
    /** Full task behind this thread, resolved by `useThreadTaskMeta` in
     *  ThreadPane. Renders the task-info pill; null while unresolved. */
    threadTaskMeta?: TaskProps | null;
    /** Set when this header renders inside the UrlLinkModal (the thread
     *  opened via "Check thread"). The MoreMenu portals to document.body
     *  at z 9999 and ThreadAskModal is a Joy Modal at the default modal
     *  layer (~1300) — both sit BEHIND the host modal (≥10020). Pass the
     *  host's z so their popups lift above it. Mirrors NoteHeaderActions /
     *  TaskTitleBlock. Undefined on the chat page → default layers. */
    hostZIndex?: number;
};

export const ThreadChatPaneHeader = (props: ThreadChatPaneHeaderProps) => {
    const { myself, useCM, useNM, useTM, threadTaskMeta, hostZIndex } = props;
    // Layer for popups spawned by this header when it's modal-hosted.
    const popupZIndex = hostZIndex != null ? hostZIndex + 1 : undefined;
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
            // chat_id (channel), thread_id (thread-root Message.id) and
            // message_id are all v3 UUID strings — pass them through so the
            // citation chip opens the exact thread / message bubble.
            // `moveToSpecificChat` treats ""/undefined as "no focus" and
            // resolves UUID ids directly (the old `Number(...)` coerced them
            // to NaN and silently dropped the thread/message focus).
            const chatId = r.chat_id;
            const threadId = r.thread_id ?? "";
            const messageId = r.message_id ?? undefined;
            useCM.moveToSpecificChat(
                chatTypeCode,
                chatId,
                threadId,
                false,
                Boolean(r.thread_id),
                useTM.setCurrentPreviewTaskId,
                usePM.setCurrentProject,
                messageId
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

    // A DM thread's title is the partner's name. Resolve it live rather than
    // printing the `chatName` copied off the channel row, which was
    // denormalized at write time and so still holds the old name after a
    // rename. Same treatment `HeaderUserName` gives the main pane, so the
    // two headers can't disagree about who you're talking to. GM/PM/MDM
    // threads keep their group name (`userId` undefined → fallback).
    const dmDisplayName = useResolvedUserName(
        useCM.currentThreadChat?.chatType === 1
            ? useCM.currentThreadChat?.dmPartnerUser?.userId
            : undefined,
        useCM.currentThreadChat?.chatName ?? ""
    );

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
            boxShadow: "0 4px 12px rgba(var(--gp-tint-danger-rgb), 0.2)",
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

    const CHAT_TYPE_TO_PATH: Record<number, string> = {
        1: "dm",
        2: "gm",
        3: "pm",
        4: "mdm",
        5: "activity",
        6: "flagged",
    };

    /**
     * Close the thread pane at the user's explicit request (the back
     * arrow and the X — NOT the "open task preview" / "create task"
     * buttons elsewhere, which merely swap panes).
     *
     * `forgetThread` is the difference that makes "reopen the thread when
     * I come back to this chat, unless I closed it myself" work: the
     * per-chat memory in `threadMemory` is what `useChatRouting` replays
     * on chat switch, and only a deliberate close clears it.
     *
     * Dropping the `/thread/:tid` URL segment keeps the URL honest about
     * what's on screen; without it a refresh would resurrect the thread
     * the user just dismissed.
     */
    const closeThreadByUser = () => {
        const chatType = useCM.currentThreadChat?.chatType;
        const chatId = useCM.currentThreadChat?.chatId;
        if (chatType !== undefined && chatId !== undefined) {
            forgetThread(chatType, chatId);
            const typePath = CHAT_TYPE_TO_PATH[chatType];
            if (typePath) {
                navigate(`/workspace/chat/${typePath}/${chatId}`);
            }
        }
        useCM.setIsMainChatVisible(true);
        useCM.setIsThreadVisible(false);
        useCM.setCurrentThreadChat(dummyThreadChat);
    };

    // Mobile back: navigate up one URL segment from
    // `/workspace/chat/:type/:id/thread/:tid` to `/workspace/chat/:type/:id`.
    // useChatRouting picks up the missing thread segment and clears
    // isThreadVisible, so the main chat pane takes over.
    const handleMobileBack = closeThreadByUser;

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

    // Open the thread's task from the breadcrumb tail. Same panel flips
    // as the legacy pill, but the project seed comes from the resolved
    // meta — which carries the task's REAL project even when the thread
    // lives outside the currently-loaded one (DM/GM cross-project
    // threads, where neither the host channel nor `allTasks` can help).
    const openTaskFromMeta = () => {
        const meta = threadTaskMeta;
        useCM.setIsMainChatVisible(false);
        useCM.setIsThreadVisible(true);
        if (
            meta?.project?.projectId != null &&
            usePM.currentProject?.projectId !== meta.project.projectId
        ) {
            // Only when it actually CHANGES — re-setting the current
            // project with a tag-less copy would strip its tags
            // app-wide. The API's task payload omits projectTags at
            // runtime despite the type, hence the default.
            usePM.setCurrentProject({
                ...meta.project,
                projectTags: meta.project.projectTags ?? [],
            });
        }
        const targetId = Number(meta?.id ?? currentThreadTaskId);
        useTM.setCurrentPreviewTaskId(
            Number.isFinite(targetId) && targetId > 0 ? targetId : currentThreadTaskId
        );
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
        // Capture the thread origin AT CLICK TIME. This is the only
        // entry point allowed to set `fromThread` — the create submit
        // links the task to exactly these ids instead of re-reading
        // useCM at submit time (which may point at a different — or
        // long-closed — thread by then).
        const chatType = useCM.currentThreadChat?.chatType;
        const chatId = useCM.currentThreadChat?.chatId;
        const threadId = useCM.currentThreadChat?.threadId;
        const fromThread =
            chatType !== undefined && chatType !== 3 && chatId != null && threadId != null
                ? { chatType, chatId: String(chatId), threadId: String(threadId) }
                : null;
        useTM.setIsCreatingTask({
            flag: true,
            parentTaskId: null,
            rootTaskId: null,
            creationKind: "task",
            milestoneId: null,
            fromThread,
        });
    };

    // Copy the thread's deep-link to the clipboard. Same URL shape the
    // app navigates to (and "Check thread" opens): the v3 chatId /
    // threadId ride their `number`-typed slots as UUID strings, so the
    // template renders them verbatim. Silent on success, matching the
    // copy-task-link / copy-note-link convention elsewhere.
    const copyThreadLink = async () => {
        const chatType = useCM.currentThreadChat?.chatType;
        const chatId = useCM.currentThreadChat?.chatId;
        const threadId = useCM.currentThreadChat?.threadId;
        if (chatType === undefined || chatId == null || threadId == null) return;
        const typePath = THREAD_LINK_TYPE_PATH[chatType];
        if (!typePath) return;
        const url = `${window.location.origin}/workspace/chat/${typePath}/${chatId}/thread/${threadId}`;
        try {
            await navigator.clipboard.writeText(url);
        } catch (err) {
            console.error("Failed to copy thread link:", err);
        }
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
                    aria-label={t.chat.headers.backToChat}
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
                        {dmDisplayName || t.chat.headers.thread}
                    </Typography>
                    <ExternalChatChip
                        allChats={useCM.allChats}
                        chatId={useCM.currentThreadChat?.chatId}
                        chatType={useCM.currentThreadChat?.chatType}
                    />
                </Stack>

                <Dropdown>
                    <MenuButton
                        slots={{ root: IconButton }}
                        slotProps={{ root: { size: "sm", variant: "plain" } }}
                    >
                        <MoreVertRoundedIcon sx={{ fontSize: 20 }} />
                    </MenuButton>
                    <Menu
                        size="sm"
                        placement="bottom-end"
                        sx={{ minWidth: 200, zIndex: popupZIndex }}
                    >
                        <MenuItem onClick={openThreadAsk}>
                            <AutoAwesomeRoundedIcon
                                sx={{ fontSize: 18, color: styles.accentColor }}
                            />
                            {t.threadAsk.headerButton.label}
                        </MenuItem>
                        {chatType !== 3 && (
                            <MenuItem onClick={copyThreadLink}>
                                <ContentCopyRoundedIcon
                                    sx={{ fontSize: 18, color: styles.accentColor }}
                                />
                                {t.chat.headers.copyThreadLink}
                            </MenuItem>
                        )}
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
                                {t.chat.headers.threadTaskMenuItem}
                            </MenuItem>
                        )}
                        {chatType !== 3 && (
                            <MenuItem onClick={openNoteHandler}>
                                <NoteAltRoundedIcon
                                    sx={{ fontSize: 18, color: styles.accentColor }}
                                />
                                {t.chat.headers.threadNoteMenuItem}
                            </MenuItem>
                        )}
                    </Menu>
                </Dropdown>
                <ThreadAskModal
                    state={threadAsk}
                    myself={myself}
                    accessToken={accessToken}
                    chatName={useCM.currentThreadChat?.chatName || ""}
                    zIndex={popupZIndex}
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
                        {isYou ? `${dmDisplayName} (you)` : dmDisplayName}
                    </Typography>
                )}

                {/* A thread inherits its parent chat's audience, so the
                    same warning belongs here — a reply is as visible to
                    the other team as the message it hangs off. */}
                <ExternalChatChip
                    allChats={useCM.allChats}
                    chatId={useCM.currentThreadChat?.chatId}
                    chatType={useCM.currentThreadChat?.chatType}
                />
            </Stack>

            {/* Right section: Task info + Actions */}
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                {/* Thread-scoped mute: silences replies/mentions for THIS
                    thread only (the whole-chat mute lives on the main chat
                    header). Keyed on the thread id; matches notification
                    intents whose `source.threadId` equals it. */}
                {useCM.currentThreadChat && (
                    <MuteTargetButton
                        targetType="thread"
                        targetId={useCM.currentThreadChat.threadId}
                        chatType={useCM.currentThreadChat.chatType}
                        label={useCM.currentThreadChat.chatName}
                    />
                )}

                {/* Task info — the thread's task rendered with the SAME
                    unified pill (Task #<id> │ Title │ Status) the
                    task-note header uses. Right-aligned in the actions
                    cluster. Shown for every thread flavor that carries a
                    task: DM/GM/MDM once a task was created from the
                    thread, PM always (a PM thread IS a task thread).
                    Clicking opens the task preview. */}
                {threadTaskMeta && currentThreadTaskId !== -1 && (
                    <TaskInfoPill
                        isDark={isDark}
                        styles={styles}
                        task={threadTaskMeta}
                        onOpen={openTaskFromMeta}
                    />
                )}

                {/* Ask about this thread — opens the AI Q&A modal. Always
                    visible (no chatType guard) because the summary +
                    follow-up flow is useful regardless of whether the
                    thread is in DM / GM / PM / MDM. */}
                <AppTooltip size="sm" title={t.threadAsk.headerButton.tooltip}>
                    <IconButton
                        size="sm"
                        variant="plain"
                        aria-label={t.threadAsk.headerButton.tooltip}
                        sx={actionButtonStyle}
                        onClick={openThreadAsk}
                    >
                        <AutoAwesomeRoundedIcon sx={{ fontSize: 18, color: styles.accentColor }} />
                    </IconButton>
                </AppTooltip>

                {/* Secondary actions (Open Note + Create Task) live in
                    a MoreMenu so the header's right edge stays focused
                    on the primary controls (mute / task pill / ask /
                    close). The menu trigger auto-hides when no items
                    are visible (e.g. PM threads where Open Note is
                    suppressed AND the thread already has a task).
                    Agent actions (plan tasks, organize, …) deliberately
                    have NO menu entry — users ask for them in the
                    thread-Ask modal or Spotlight conversationally. */}
                {(() => {
                    const hasTask = currentThreadTaskId !== -1;
                    const chatType = useCM.currentThreadChat?.chatType;
                    const showOpenNote = chatType !== 3;
                    const showCreateTask = !hasTask && chatType !== 3;
                    // Copy-link is offered on DM/GM/MDM threads (PM threads
                    // are addressed by task and carry their own copy-task-
                    // link on the preview).
                    const showCopyLink = chatType !== 3;
                    if (!showOpenNote && !showCreateTask && !showCopyLink) return null;
                    return (
                        <MoreMenu
                            placement="bottom-end"
                            triggerSize={36}
                            // Modal-hosted: lift the dropdown above the
                            // UrlLinkModal (default 9999 renders behind it).
                            zIndex={popupZIndex}
                            triggerSx={{
                                borderRadius: "10px",
                                background: styles.buttonBg,
                                border: `1px solid ${styles.buttonBorder}`,
                            }}
                            items={[
                                {
                                    id: "copy-thread-link",
                                    label: t.chat.headers.copyThreadLink,
                                    icon: (
                                        <ContentCopyRoundedIcon
                                            sx={{ fontSize: 18, color: styles.accentColor }}
                                        />
                                    ),
                                    visible: showCopyLink,
                                    onClick: copyThreadLink,
                                },
                                {
                                    id: "create-task",
                                    label: t.chat.headers.threadTaskMenuItem,
                                    icon: (
                                        <AddTaskRoundedIcon
                                            sx={{ fontSize: 18, color: styles.accentColor }}
                                        />
                                    ),
                                    visible: showCreateTask,
                                    onClick: createTaskHandler,
                                },
                                {
                                    id: "open-note",
                                    label: t.chat.headers.threadNoteMenuItem,
                                    icon: (
                                        <NoteAltRoundedIcon
                                            sx={{ fontSize: 18, color: styles.accentColor }}
                                        />
                                    ),
                                    visible: showOpenNote,
                                    onClick: openNoteHandler,
                                },
                            ]}
                        />
                    );
                })()}

                {/* Close Button */}
                <AppTooltip size="sm" title={t.chat.headers.close}>
                    <IconButton
                        size="sm"
                        variant="plain"
                        sx={dangerButtonStyle}
                        onClick={closeThreadByUser}
                    >
                        <CloseRoundedIcon
                            sx={{ fontSize: 18, color: "var(--gp-tint-danger-alt)" }}
                        />
                    </IconButton>
                </AppTooltip>
            </Stack>

            {/* Thread Q&A modal — mounted once per header instance so
                state lives for the lifetime of this thread view. */}
            <ThreadAskModal
                state={threadAsk}
                myself={myself}
                accessToken={accessToken}
                chatName={useCM.currentThreadChat?.chatName || ""}
                zIndex={popupZIndex}
                onSelectSource={onCitationSelect}
            />
        </Stack>
    );
};
