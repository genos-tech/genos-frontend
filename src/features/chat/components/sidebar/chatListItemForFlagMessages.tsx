// `simple-import-sort` and the prettier import-sort plugin disagree on the
// order of `react` vs the alphabetically-earlier `@mui/...` block. Prettier
// wins (run-on-save reformats it), so disable `simple-import-sort` here.

import * as React from "react";
import { useState } from "react";
import AssignmentIcon from "@mui/icons-material/Assignment";
import FlagIcon from "@mui/icons-material/Flag";
import GroupsIcon from "@mui/icons-material/Groups";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import { Avatar, Box, Chip, IconButton, ListDivider, ListItem, Stack, Typography } from "@mui/joy";
import ListItemButton, { ListItemButtonProps } from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { GMAvatar } from "../../../../components/ui/avatars/GMAvatar";
import { MDMAvatar } from "../../../../components/ui/avatars/MDMAvatar";
import { ProjectAvatar } from "../../../../components/ui/avatars/ProjectAvatar";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { channelService } from "../../../../services/channel/channelService";
import { UserProps } from "../../../../types/admin";
import {
    AllChatProps,
    ChatProps,
    FlaggedMessageProps,
    MessageProps,
    ThreadMessageProps,
    ThreadProps,
} from "../../../../types/chat";
import { ProjectProps } from "../../../../types/tasks";
import { extractYYYYMMDDHHMM, getLocalCurrentTimestamp } from "../../../../utils/dateUtils";
import { toggleMessagesPane } from "../../../../utils/sidebarUtils";
import { formatTaskDisplayId } from "../../../tasks/utils/taskDisplayId";
import { loadV3SpecificMessages } from "../../services/loadV3SpecificMessages";
import { loadV3SpecificThreadMessages } from "../../services/loadV3SpecificThreadMessages";

// chat_type=4 carries two semantics in the wider codebase: legacy task
// comments (live in the PM store, chat_id = project_id) and the newer MDM
// chats (live in the MDM store, chat_id = mdm_id). The flag UI only exists
// inside chat bubbles (DM/GM/PM/MDM) — there is no "flag" affordance on a
// task comment — so every chat_type=4 flagged message we render here is an
// MDM message. The constant + label are named accordingly.
// Keys sorted alphabetically (case-insensitive) per `sort-keys`.
// Integer values are the canonical kind codes; declaration order
// is independent of runtime behavior.
const CHAT_TYPES = {
    DM: 1,
    GM: 2,
    MDM: 4,
    PM: 3,
} as const;

const CHAT_TYPE_LABELS = {
    [CHAT_TYPES.DM]: "DM",
    [CHAT_TYPES.GM]: "GM",
    [CHAT_TYPES.MDM]: "MDM",
    [CHAT_TYPES.PM]: "PM",
} as const;

// Flagged message color scheme for visual distinction
const FLAGGED_COLOR_SCHEME = {
    dark: "#f87171",
    light: "#ef4444",
} as const;

type ChatListItemForFlagMessagesProps = ListItemButtonProps & {
    flaggedMessage: FlaggedMessageProps;
    useCM: ChatManagementState;
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    useUISM: UIStateManagementState;
    selectedFlaggedMessageId: string;
    setSelectedFlaggedMessageId: (value: string) => void;
    setCurrentProject: (value: ProjectProps) => void;
    useTM: TaskManagementState;
};

// Helper functions
const findChatForFlag = (
    allChats: AllChatProps[],
    flaggedMessage: FlaggedMessageProps
): AllChatProps | undefined =>
    // PUNCH LIST (v3 chatId migration): `FlaggedMessageProps.chatId`
    // is still the legacy integer; `AllChatProps.chatId` is the
    // v3 string. `String(...)` bridges them at the comparison
    // boundary. Same idea applies at all the other comparison
    // and construction sites flagged below. Whole file is dead
    // code once the v3 flagged-message endpoint replaces this
    // legacy `/chat/flagged-update/` flow.
    allChats.find(
        (chat) =>
            chat.chatType === flaggedMessage.chatType &&
            chat.chatId === String(flaggedMessage.chatId)
    );

/**
 * Build the ChatProps that the chat pane consumes. Returns `null` when the
 * underlying chat has been deleted (no longer in `allChats`) or when the
 * loaded message slice is empty — the caller is expected to surface a
 * graceful "removed" state instead of trying to navigate.
 */
const createChatFromMessages = (
    messages: MessageProps[],
    moveToSpecificIndex: string,
    flaggedMessage: FlaggedMessageProps,
    allChats: AllChatProps[],
    v3ChannelUuid?: string
): ChatProps | null => {
    const currentChat = findChatForFlag(allChats, flaggedMessage);
    if (!currentChat || messages.length === 0) return null;

    // v3: cursor is the v3 read-cursor UUID (or empty when not synced).
    // Don't try to compute a "later" cursor here — clicking a flag
    // doesn't advance the read cursor; the chat-open path does that.
    // Pass the existing cursor through unchanged so the unread-pip /
    // banner state isn't perturbed by navigation.
    return {
        chatId: v3ChannelUuid ?? String(flaggedMessage.chatId),
        chatName: flaggedMessage.chatName || currentChat.chatName,
        chatType: flaggedMessage.chatType,
        dmPartnerUser: flaggedMessage.dmPartnerUser,
        isPrivate: currentChat.isPrivate,
        lastReadMessageId: currentChat.lastReadMessageId,
        latestMessage: messages[messages.length - 1],
        latestMessageText: messages[messages.length - 1].contentText,
        mdmMembers: currentChat.mdmMembers,
        messages: messages,
        moveToSpecificIndex: moveToSpecificIndex,
        profileImagePath: currentChat.profileImagePath,
        TSLastMessage: flaggedMessage.tsSent,
    };
};

const isCurrentChat = (
    currentSubChat: ChatProps | undefined,
    flaggedMessage: FlaggedMessageProps
): boolean => {
    return (
        currentSubChat?.chatId === String(flaggedMessage.chatId) &&
        currentSubChat?.chatName === flaggedMessage.chatName
    );
};

const shouldHideThread = (isCreatingTask: boolean, isTaskPreviewVisible: boolean): boolean => {
    return isCreatingTask || isTaskPreviewVisible;
};

export const ChatListItemForFlagMessages = (props: ChatListItemForFlagMessagesProps) => {
    const {
        flaggedMessage,
        myself,
        selectedFlaggedMessageId,
        setCurrentProject,
        setMyself,
        useUISM,
        setSelectedFlaggedMessageId,
        socket,
        useTEM,
        useCM,
        useTM,
    } = props;
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    const isYou = myself.userId === flaggedMessage.dmPartnerUser.userId;
    const [tmpIsFlagged, setTmpIsFlagged] = useState(true);
    // Set when click-time message lookup discovers the source message has
    // since been deleted (or was scrubbed from IDB). The flagged-message
    // snapshot still has its content, so we keep rendering the row but mark
    // it visually and refuse to navigate.
    const [sourceDeleted, setSourceDeleted] = useState(false);
    const flagColor = FLAGGED_COLOR_SCHEME;

    // The flag entry can outlive the underlying chat (delete a GM, leave an
    // MDM, drop a project, etc.). When that happens the chat is gone from
    // `useCM.allChats`, so navigation would crash with "Chat not found".
    // Detect at render-time and degrade gracefully.
    const chatRecord = findChatForFlag(useCM.allChats, flaggedMessage);
    const chatRemoved = chatRecord === undefined;
    const navigationDisabled = chatRemoved || sourceDeleted;

    // v3 unflag. `channelService.unflagMessage` does the optimistic
    // local removal, emits `flag.remove`, and rolls back if the server
    // rejects. The sidebar row disappears automatically because
    // `useChatManagement.flaggedMessages` is a v3 subscription derived
    // from `snapshot.flags` — the optimistic remove fires a notify and
    // the subscription drops this row on the next pass.
    const updateFlagStatus = async () => {
        const v3MessageUuid = flaggedMessage.messageId as unknown as string;
        if (!v3MessageUuid) return;
        setTmpIsFlagged(false);
        try {
            await channelService.unflagMessage(v3MessageUuid);
        } catch (error) {
            // `unflagMessage` already rolled the snapshot back; un-set
            // the local toggle so the icon matches state.
            setTmpIsFlagged(true);
            console.error("Error updating flag status:", error);
        }
    };

    /**
     * Look up the source message in IDB (via popSpecificMessages) and
     * return both the unflipped message slice and the target message's
     * current state. Chat messages are purged from IDB on delete (see
     * `handleMessageDeletion` in message-handlers.ts) so the only signal
     * we get is "not present in the result" — that's what `deleted` means
     * here. `MessageProps` itself has no `isDeleted` field.
     */
    const loadMessagesAndTarget = async (): Promise<{
        deleted: boolean;
        messages: MessageProps[];
        target: MessageProps | undefined;
        v3ChannelUuid: string | null;
    }> => {
        // `FlaggedMessageProps.chatId` / `.messageId` slots are typed
        // `number` for legacy compatibility, but `v3FlagsToLegacy`
        // packs v3 UUIDs through them. Pull both out via the same
        // structural cast the adapter uses on the way in.
        const v3ChannelUuid = flaggedMessage.chatId as unknown as string;
        const v3MessageUuid = flaggedMessage.messageId as unknown as string;
        if (!v3ChannelUuid || !v3MessageUuid) {
            return { deleted: true, messages: [], target: undefined, v3ChannelUuid: null };
        }
        const messages = await loadV3SpecificMessages(v3ChannelUuid, flaggedMessage.chatType);
        // `messageIdWithChatId` carries the v3 UUID. The legacy
        // `messageId` field on v3-adapted messages is the per-channel
        // `seq` integer, which won't match the UUID we're looking for.
        const target = messages.find((m) => m.messageIdWithChatId === v3MessageUuid);
        return { deleted: !target, messages, target, v3ChannelUuid };
    };

    // `updateMessagesAndChat` was an alternative flag-toggle entry point
    // that has been superseded by `updateFlagStatus` + the direct chat
    // navigation. Removed — was flagged unused by ESLint.

    /**
     * Navigate to the source chat for a non-thread flagged message.
     * Treats DM / GM / PM / MDM uniformly — there's no separate
     * "task comment" path because flagging is only ever done from a chat
     * bubble, never from a task comment view.
     */
    const handleNonThreadMessage = async () => {
        const isCurrentChatVisible = isCurrentChat(useCM.currentSubChat, flaggedMessage);

        try {
            const { messages, deleted, v3ChannelUuid } = await loadMessagesAndTarget();
            if (deleted || !v3ChannelUuid) {
                setSourceDeleted(true);
                return;
            }

            // v3: `moveToSpecificIndex` is the bare message UUID
            // (matches `indexMap` key, which is `messageIdWithChatId`).
            const newChat = createChatFromMessages(
                messages,
                flaggedMessage.messageId as unknown as string,
                flaggedMessage,
                useCM.allChats,
                v3ChannelUuid
            );
            if (!newChat) return; // chat was removed between render and click

            toggleMessagesPane();

            if (useCM.isSubChatVisible && isCurrentChatVisible) {
                useCM.setCurrentSubChat(newChat);
            } else {
                useCM.setCurrentMainChat(newChat);
            }

            useCM.setIsMainChatVisible(true);

            if (shouldHideThread(useTM.isCreatingTask.flag, useTM.isTaskPreviewVisible)) {
                useCM.setIsThreadVisible(false);
            }
        } catch (error) {
            console.error("Error handling non-thread flagged message:", error);
        }
    };

    const handleThreadMessage = async () => {
        try {
            // v3 thread loader: takes channel + thread-root UUIDs.
            // `FlaggedMessageProps.chatId` and `.threadId` slots are
            // typed `number`, but `v3FlagsToLegacy` packs the channel
            // UUID through `chatId` and the parent's UUID through
            // `threadId`. Cast through the same shim.
            const v3ChannelUuid = flaggedMessage.chatId as unknown as string;
            const v3ThreadRootUuid = flaggedMessage.threadId as unknown as string;
            const v3MessageUuid = flaggedMessage.messageId as unknown as string;
            const threadMessages = await loadV3SpecificThreadMessages(
                v3ChannelUuid,
                v3ThreadRootUuid,
                flaggedMessage.chatType
            );

            // Empty / missing thread response = thread was deleted upstream.
            if (!threadMessages || threadMessages.length === 0) {
                setSourceDeleted(true);
                return;
            }

            // v3: match on the message UUID (carried on
            // `messageIdWithChatIdAndThreadId` by the v3 adapter), not
            // the per-channel `seq` integer in `messageId`.
            const targetThreadMsg = threadMessages.find(
                (m: ThreadMessageProps) => m.messageIdWithChatIdAndThreadId === v3MessageUuid
            );
            // The v3 thread adapter (v3ThreadMessagesToLegacy) filters out
            // soft-deleted rows (deletedAt) and returns [] when the root is
            // deleted, so a deleted source message is simply absent here —
            // absence is the deletion signal (the legacy `isDeleted` flag no
            // longer exists on ThreadMessageProps).
            if (!targetThreadMsg) {
                setSourceDeleted(true);
                return;
            }

            const newThread = createThreadFromMessages(threadMessages);

            // Set thread visible BEFORE setting main chat to prevent
            // the main chat URL effect from stripping thread info
            useCM.setIsThreadVisible(true);
            useCM.setCurrentThreadChat(newThread);

            if (flaggedMessage.project?.projectId) {
                setCurrentProject(flaggedMessage.project);
            }

            if (newThread.taskExist && threadMessages[0].taskId) {
                useTM.setCurrentPreviewTaskId(threadMessages[0].taskId);
            }

            await handleThreadNavigation();
        } catch (error) {
            console.error("Error handling thread message:", error);
        }
    };

    // Keys sorted alphabetically per `sort-keys`.
    const createThreadFromMessages = (threadMessages: ThreadMessageProps[]): ThreadProps => {
        return {
            chatId: flaggedMessage.chatId,
            chatName: flaggedMessage.chatName,
            chatType: flaggedMessage.chatType,
            dmPartnerUser: {
                avatarImgPath: "",
                teamId: myself.teamId,
                teamName: myself.teamName,
                tsJoined: "",
                tsLastSeen: "",
                userEmail: flaggedMessage.dmPartnerUser.userEmail,
                userId: flaggedMessage.dmPartnerUser.userId,
                userName: flaggedMessage.dmPartnerUser.userName,
            },
            messages: threadMessages,
            // v3 `moveToSpecificIndex` is the bare message UUID;
            // `indexMap` in the thread pane is keyed by
            // `messageIdWithChatIdAndThreadId`, which the v3 adapter
            // sets to the message's v3 UUID.
            moveToSpecificIndex: flaggedMessage.messageId as unknown as string,
            project: flaggedMessage.project,
            taskExist: threadMessages[0].taskExist,
            taskId: flaggedMessage.taskId,
            threadId: flaggedMessage.threadId,
            TSLastMessage: getLocalCurrentTimestamp(),
        };
    };

    const handleThreadNavigation = async () => {
        const isCurrentChatVisible = isCurrentChat(useCM.currentSubChat, flaggedMessage);

        try {
            // v3: `flaggedMessage.chatId` is the channel UUID (packed
            // through the legacy `number` slot by `v3FlagsToLegacy`).
            const v3ChannelUuid = flaggedMessage.chatId as unknown as string;
            const v3ThreadRootUuid = flaggedMessage.threadId as unknown as string;
            if (!v3ChannelUuid) return;
            const messages = await loadV3SpecificMessages(v3ChannelUuid, flaggedMessage.chatType);
            // Background nav lands on the main chat (the thread pane
            // is what the user actually clicked into); the scroll
            // target is the thread root, so its UUID drives the
            // `indexMap` lookup in MainChatPane.
            const newChat = createChatFromMessages(
                messages,
                v3ThreadRootUuid,
                flaggedMessage,
                useCM.allChats,
                v3ChannelUuid
            );
            if (!newChat) return;

            toggleMessagesPane();

            if (useCM.isSubChatVisible && isCurrentChatVisible) {
                useCM.setCurrentSubChat(newChat);
            } else {
                useCM.setCurrentMainChat(newChat);
            }

            useCM.setIsMainChatVisible(true);
        } catch (error) {
            console.error("Error handling thread navigation:", error);
        }
    };

    const onClickHandler = async () => {
        // The chat (or the source message itself) has been removed since
        // this flag entry was created — short-circuit and let the user
        // unflag via the right-side icon. Selecting still gives the row a
        // visual "active" state so the click isn't perceived as broken.
        if (navigationDisabled) {
            setSelectedFlaggedMessageId(flaggedMessage.flaggedMessageId);
            return;
        }

        // set to true to not move chat pane type
        useCM.setNotMoveChatPaneType(true);

        setSelectedFlaggedMessageId(flaggedMessage.flaggedMessageId);

        if (flaggedMessage.threadId === 0) {
            await handleNonThreadMessage();
        } else {
            await handleThreadMessage();
        }
    };

    // Avatar rendering components
    const renderDMAvatar = () => {
        if (flaggedMessage.dmPartnerUser.userId !== "") {
            return (
                <AvatarWithStatus
                    avatarUser={useTEM.teamMemberProfiles[flaggedMessage.dmPartnerUser.userId]}
                    isYou={isYou}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useUISM={useUISM}
                />
            );
        }
        return <Avatar size="sm">{(resolvedChatName || "?")[0].toUpperCase()}</Avatar>;
    };

    const renderGMAvatar = () => {
        const chat = useCM.allChats.find(
            (chat) =>
                chat.chatType === flaggedMessage.chatType &&
                chat.chatId === String(flaggedMessage.chatId)
        );

        if (chat) {
            return (
                <GMAvatar
                    gmChat={chat}
                    isYou={isYou}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            );
        }
        return (
            <Avatar size="sm">
                <GroupsIcon />
            </Avatar>
        );
    };

    const renderProjectAvatar = () => {
        if (chatRecord) {
            return (
                <ProjectAvatar
                    myself={myself}
                    pmChat={chatRecord}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            );
        }
        return (
            <Avatar size="sm">
                <AssignmentIcon />
            </Avatar>
        );
    };

    const renderMDMAvatar = () => (
        <MDMAvatar
            members={chatRecord?.mdmMembers}
            teamMemberProfiles={useTEM.teamMemberProfiles}
        />
    );

    // Fallback for any chat that has been removed entirely — we still need
    // *something* in the avatar slot so the row layout stays consistent.
    const renderRemovedAvatar = () => (
        <Avatar size="sm" sx={{ opacity: 0.55, filter: "grayscale(0.6)" }}>
            <PeopleRoundedIcon />
        </Avatar>
    );

    const renderAvatar = () => {
        if (chatRemoved) return renderRemovedAvatar();
        switch (flaggedMessage.chatType) {
            case CHAT_TYPES.DM:
                return renderDMAvatar();
            case CHAT_TYPES.GM:
                return renderGMAvatar();
            case CHAT_TYPES.PM:
                return renderProjectAvatar();
            case CHAT_TYPES.MDM:
                return renderMDMAvatar();
            default:
                return null;
        }
    };

    // Chip rendering components
    const resolvedChatName = (() => {
        if (flaggedMessage.chatName) return flaggedMessage.chatName;
        const chat = useCM.allChats.find(
            (c) =>
                c.chatId === String(flaggedMessage.chatId) &&
                c.chatType === flaggedMessage.chatType
        );
        return chat?.chatName || "";
    })();

    const renderChatNameChip = () => {
        // DM / GM / MDM all show the (potentially auto-generated) chat name
        // prominently at the start of the row. PM hides the title here
        // because the project name is rendered as a coloured chip below.
        if (
            flaggedMessage.chatType === CHAT_TYPES.DM ||
            flaggedMessage.chatType === CHAT_TYPES.GM ||
            flaggedMessage.chatType === CHAT_TYPES.MDM
        ) {
            return (
                <Typography
                    level="title-sm"
                    sx={{
                        fontWeight: 600,
                        lineHeight: 1.3,
                    }}
                    noWrap
                >
                    {isYou ? `${resolvedChatName} (you)` : resolvedChatName}
                </Typography>
            );
        }
        return null;
    };

    const renderProjectChips = () => {
        // PM messages live inside a project, so we show the project chip
        // and (when applicable) the task ID. MDM intentionally skips this
        // block — it has no project context.
        if (flaggedMessage.chatType !== CHAT_TYPES.PM) return null;
        return (
            <>
                <Chip
                    color="primary"
                    size="sm"
                    variant="soft"
                    sx={{
                        borderRadius: "6px",
                        fontSize: "10px",
                        fontWeight: 600,
                        height: "20px",
                        px: 0.75,
                    }}
                >
                    {resolvedChatName}
                </Chip>
                {!!flaggedMessage.taskId && (
                    <Chip
                        size="sm"
                        variant="soft"
                        sx={{
                            borderRadius: "6px",
                            fontSize: "10px",
                            fontWeight: 600,
                            height: "20px",
                            px: 0.75,
                        }}
                    >
                        {formatTaskDisplayId(flaggedMessage)}
                    </Chip>
                )}
            </>
        );
    };

    const renderRemovedChip = (label: string) => (
        <Chip
            color="neutral"
            size="sm"
            variant="outlined"
            sx={{
                borderRadius: "6px",
                fontSize: "10px",
                fontWeight: 600,
                height: "20px",
                opacity: 0.85,
                px: 0.75,
            }}
        >
            {label}
        </Chip>
    );

    const renderChatTypeChip = () => (
        <Chip
            color="neutral"
            size="sm"
            variant="soft"
            sx={{
                borderRadius: "6px",
                fontSize: "10px",
                fontWeight: 600,
                height: "20px",
                opacity: 0.8,
                px: 0.75,
            }}
        >
            {CHAT_TYPE_LABELS[flaggedMessage.chatType as keyof typeof CHAT_TYPE_LABELS] ||
                t.chat.listItem.unknown}
        </Chip>
    );

    const renderThreadChip = () => {
        if (flaggedMessage.threadId !== 0) {
            return (
                <Chip
                    color="warning"
                    size="sm"
                    variant="soft"
                    sx={{
                        borderRadius: "6px",
                        fontSize: "10px",
                        fontWeight: 600,
                        height: "20px",
                        px: 0.75,
                    }}
                >
                    {t.chat.listItem.threadChip}
                </Chip>
            );
        }
        return null;
    };

    const isSelected = selectedFlaggedMessageId === flaggedMessage.flaggedMessageId;

    return (
        <React.Fragment>
            <ListItem
                sx={{
                    overflowX: "hidden",
                    p: 0.5,
                    width: "100%",
                }}
            >
                <ListItemButton
                    data-chat-list-key={`flagged-${flaggedMessage.flaggedMessageId}`}
                    sx={{
                        "&:active": {
                            transform: "translateY(0)",
                        },
                        "&:hover": {
                            background: isSelected
                                ? isDark
                                    ? `linear-gradient(135deg, ${flagColor.dark}20 0%, ${flagColor.dark}12 100%)`
                                    : `linear-gradient(135deg, ${flagColor.light}15 0%, ${flagColor.light}08 100%)`
                                : isDark
                                  ? "rgba(255,255,255,0.05)"
                                  : "rgba(0,0,0,0.03)",
                            borderColor: isSelected
                                ? isDark
                                    ? `${flagColor.dark}40`
                                    : `${flagColor.light}35`
                                : isDark
                                  ? "rgba(255,255,255,0.08)"
                                  : "rgba(0,0,0,0.08)",
                            boxShadow: isSelected
                                ? isDark
                                    ? `0 6px 20px ${flagColor.dark}20`
                                    : `0 6px 20px ${flagColor.light}15`
                                : isDark
                                  ? "0 4px 12px rgba(0,0,0,0.3)"
                                  : "0 4px 12px rgba(0,0,0,0.08)",
                            transform: "translateY(-1px)",
                        },
                        alignItems: "initial",
                        background: isSelected
                            ? isDark
                                ? `linear-gradient(135deg, ${flagColor.dark}15 0%, ${flagColor.dark}08 100%)`
                                : `linear-gradient(135deg, ${flagColor.light}12 0%, ${flagColor.light}05 100%)`
                            : isDark
                              ? "rgba(255,255,255,0.02)"
                              : "rgba(0,0,0,0.01)",
                        border: "1px solid",
                        borderColor: isSelected
                            ? isDark
                                ? `${flagColor.dark}30`
                                : `${flagColor.light}25`
                            : isDark
                              ? "rgba(255,255,255,0.04)"
                              : "rgba(0,0,0,0.04)",
                        borderRadius: "12px",
                        boxShadow: isSelected
                            ? isDark
                                ? `0 4px 16px ${flagColor.dark}15, inset 0 1px 0 ${flagColor.dark}10`
                                : `0 4px 16px ${flagColor.light}12, inset 0 1px 0 ${flagColor.light}08`
                            : "none",
                        cursor: navigationDisabled ? "default" : undefined,
                        flexDirection: "column",
                        gap: 0.75,
                        opacity: navigationDisabled ? 0.65 : 1,
                        overflow: "hidden",
                        position: "relative",
                        px: 1.5,
                        py: 1.25,
                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                    onClick={onClickHandler}
                >
                    {/* Flagged indicator line */}
                    {tmpIsFlagged && (
                        <Box
                            sx={{
                                background: isDark
                                    ? `linear-gradient(180deg, ${flagColor.dark} 0%, ${flagColor.dark}80 100%)`
                                    : `linear-gradient(180deg, ${flagColor.light} 0%, ${flagColor.light}80 100%)`,
                                borderRadius: "0 4px 4px 0",
                                boxShadow: isDark
                                    ? `0 0 8px ${flagColor.dark}60`
                                    : `0 0 8px ${flagColor.light}50`,
                                height: "60%",
                                left: 0,
                                position: "absolute",
                                top: "50%",
                                transform: "translateY(-50%)",
                                width: 3,
                            }}
                        />
                    )}

                    {/* Subtle gradient overlay for selected state */}
                    {isSelected && (
                        <Box
                            sx={{
                                background: isDark
                                    ? `radial-gradient(ellipse at top right, ${flagColor.dark}08 0%, transparent 70%)`
                                    : `radial-gradient(ellipse at top right, ${flagColor.light}06 0%, transparent 70%)`,
                                height: "100%",
                                pointerEvents: "none",
                                position: "absolute",
                                right: 0,
                                top: 0,
                                width: "50%",
                            }}
                        />
                    )}

                    <Stack
                        direction="column"
                        spacing={0.5}
                        sx={{ position: "relative", zIndex: 1 }}
                    >
                        {/* Header with avatar, name, and actions */}
                        <Stack
                            alignItems="center"
                            direction="row"
                            justifyContent="space-between"
                            spacing={1.5}
                        >
                            <Stack alignItems="center" direction="row" spacing={1}>
                                <div>{renderAvatar()}</div>

                                <Stack
                                    alignItems="center"
                                    direction="row"
                                    flexWrap="wrap"
                                    spacing={0.5}
                                >
                                    {renderChatNameChip()}
                                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                                        {renderProjectChips()}
                                        {renderChatTypeChip()}
                                        {renderThreadChip()}
                                        {chatRemoved &&
                                            renderRemovedChip(t.chat.listItem.chatRemoved)}
                                        {!chatRemoved &&
                                            sourceDeleted &&
                                            renderRemovedChip(t.chat.listItem.messageDeleted)}
                                    </Box>
                                </Stack>
                            </Stack>

                            {/* Right-aligned content */}
                            <Stack alignItems="center" direction="row" spacing={1}>
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        display: { xs: "none", md: "block" },
                                        opacity: 0.7,
                                    }}
                                    noWrap
                                >
                                    {extractYYYYMMDDHHMM(flaggedMessage.tsSent)}
                                </Typography>
                                <AppTooltip size="sm" title={t.chat.listItem.unflag}>
                                    <IconButton
                                        color={tmpIsFlagged ? "danger" : "neutral"}
                                        size="sm"
                                        variant="plain"
                                        sx={{
                                            transition: "all 0.2s ease",
                                            "&:hover": {
                                                transform: "scale(1.1)",
                                            },
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            updateFlagStatus();
                                        }}
                                    >
                                        <FlagIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </AppTooltip>
                            </Stack>
                        </Stack>

                        {/* Message content */}
                        <Box sx={{ pl: "44px" }}>
                            <Typography
                                level="body-sm"
                                sx={{
                                    display: "-webkit-box",
                                    fontStyle: navigationDisabled ? "italic" : "normal",
                                    fontWeight: 500,
                                    lineHeight: 1.5,
                                    opacity: navigationDisabled ? 0.55 : 0.85,
                                    overflow: "hidden",
                                    textDecoration: navigationDisabled ? "line-through" : "none",
                                    textOverflow: "ellipsis",
                                    WebkitBoxOrient: "vertical",
                                    WebkitLineClamp: 2,
                                }}
                            >
                                {flaggedMessage.contentText}
                            </Typography>
                        </Box>
                    </Stack>
                </ListItemButton>
            </ListItem>
            <ListDivider
                sx={{
                    margin: 0,
                    opacity: isDark ? 0.04 : 0.06,
                }}
            />
        </React.Fragment>
    );
};
