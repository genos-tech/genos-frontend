import { memo, useEffect, useRef, useState } from "react";
import { Box, Sheet, Stack, Tooltip } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";
import { Socket } from "socket.io-client";

import { BnChatPreview } from "../../../../components/editors/bnChatPreview";
import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { EmojiPicker } from "../../../../components/ui/emoji/EmojiPicker";
import { EmojiReaction } from "../../../../components/ui/emoji/EmojiReaction";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { useBubbleStylePreference } from "../../../../hooks/common/useBubbleStylePreference";
import { useDoubleClickTodoPreference } from "../../../../hooks/common/useDoubleClickTodoPreference";
import { useIsMobile } from "../../../../hooks/common/useIsMobile";
import { useLongPress } from "../../../../hooks/common/useLongPress";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../../../types/chat";
import { ReactionProps } from "../../../../types/common";
import { TaskCommentProps, TaskProps } from "../../../../types/tasks";
import { extractYYYYMMDDHHMM, getLocalCurrentTimestamp } from "../../../../utils/dateUtils";
import { isMac } from "../../../../utils/platform";
import { loadSpecificTaskByThreadId } from "../../../tasks/services/loadSpecificTaskByThreadId";
import { loadSpecificThreadMessages } from "../../services/loadSpecificThreadMessages";
import { BubbleAttachmentSheet } from "./BubbleAttachmentSheet";
import { BubbleMoreMenu } from "./BubbleMoreMenu";
import {
    BUBBLE_COLORS,
    COMPACT_BODY_INDENT,
    COMPACT_FOCUSED_BG,
    COMPACT_TOOLBAR_OFFSET,
} from "./bubbleStyleTokens";
import { BubbleUnderBar } from "./BubbleUnderBar";
import { BubbleUserName } from "./BubbleUserName";

type MessageBubbleProps = {
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    variant: "sent" | "received";
    chat: ChatProps;
    message: MessageProps;
    isScrolling: boolean;
    isFocused: "focused" | "threadActive" | false;
    isSimpleBubble: boolean;
    socket: Socket | null;
    useUISM: UIStateManagementState;
    usePM: ProjectManagementState;
    setIsInEdit: (value: boolean) => void;
    setEditTargetMessage: (value: MessageProps) => void;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    setTodoFromMessageBubble: (
        todoFromMessageBubble: MessageProps | ThreadMessageProps | TaskCommentProps
    ) => void;
};

const MessageBubbleImpl = (props: MessageBubbleProps) => {
    const {
        chat,
        isFocused,
        isScrolling,
        isSimpleBubble,
        message,
        myself,
        usePM,
        setEditTargetMessage,
        setIsInEdit,
        setMyself,
        useUISM,
        socket,
        useTEM,
        variant,
        useCM,
        useTM,
        setTodoFromMessageBubble,
    } = props;

    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const isSent = variant === "sent";
    const dtSent = extractYYYYMMDDHHMM(message.tsSent);
    const { accessToken } = useAuth();
    const navigate = useNavigate();
    const { style } = useBubbleStylePreference();
    const isCompact = style === "compact";
    const { enabled: doubleClickTodoEnabled } = useDoubleClickTodoPreference();
    const isSystemUser = message.sender.isSystemUser === true;
    const hideAvatarSlot = (chat.chatType === 3 || chat.chatType === 4) && isSystemUser;

    // Get bubble colors based on variant and theme
    const bubbleColors = isSent ? BUBBLE_COLORS.sent : BUBBLE_COLORS.received;
    const colors = isDark ? bubbleColors.dark : bubbleColors.light;
    const focusedColors = isDark ? BUBBLE_COLORS.focused.dark : BUBBLE_COLORS.focused.light;
    const threadActiveColors = isDark
        ? BUBBLE_COLORS.threadActive.dark
        : BUBBLE_COLORS.threadActive.light;
    const highlightColors = isFocused === "threadActive" ? threadActiveColors : focusedColors;

    // Chat type to URL path mapping
    const CHAT_TYPE_PATH: Record<number, string> = {
        1: "dm",
        2: "gm",
        3: "pm",
        4: "mdm",
    };

    const handleOpenTaskClick = () => {
        if (message.taskId !== null) {
            useCM.setIsMainChatVisible(true);
            useCM.setIsThreadVisible(false);
            useTM.setIsTaskPreviewVisible(true);
            useTM.setIsCreatingTask((prev) => ({ ...prev, flag: false }));
            useTM.setCurrentPreviewTaskId(message.taskId);

            if (message.project && message.project.projectId) {
                usePM.setCurrentProject(message.project);
            }
        }
    };

    // Handle message click to update URL.
    //
    // Cmd-click (mac) / Alt-click (other) is a power-user shortcut that
    // opens the message's thread without navigating to the message URL —
    // it short-circuits to `replayHandler`, which is the same code path
    // the bubble's "reply" button uses (loads thread messages, opens the
    // thread pane, navigates to the `/thread/...` URL).
    const handleMessageClick = (e: React.MouseEvent) => {
        // A long-press on mobile fires a synthetic click on touchend.
        // Swallow it so the bubble doesn't ALSO navigate to the
        // message URL — the long-press only meant "show the toolbar".
        if (longPress.consumedTap()) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        if (e.metaKey || e.altKey) {
            replayHandler(e);
            return;
        }

        const typePath = CHAT_TYPE_PATH[chat.chatType];
        if (typePath) {
            // For PM (chatType 3), use taskId instead of messageId to match the indexMap key format
            // The indexMap for PM uses messageIdWithChatId = `${chatId}-${taskId}`
            const messageIdentifier =
                chat.chatType === 3 && message.taskId ? message.taskId : message.messageId;
            navigate(`/workspace/chat/${typePath}/${chat.chatId}/message/${messageIdentifier}`);
        }

        if (chat.chatType === 3) {
            handleOpenTaskClick();
        }
    };

    // Handle message double click to add message to to-do
    const handleAddMessageToToDo = () => {
        setTodoFromMessageBubble(message);
    };

    // Load the thread task if exists
    const loadTask = (threadId: number) => {
        (async () => {
            const loadedTask: TaskProps[] = await loadSpecificTaskByThreadId(
                myself,
                chat.chatType,
                chat.chatId,
                threadId,
                accessToken
            );
            if (loadedTask.length > 0) {
                useTM.setCurrentPreviewTask(loadedTask[0]);
            }
        })();
    };

    const replayHandler = (e?: React.MouseEvent) => {
        // Stop propagation to prevent handleMessageClick from being called
        e?.stopPropagation();

        loadTask(message.messageId);

        // Show thread pane on the right side.
        useCM.setIsMainChatVisible(true);
        useCM.setIsThreadVisible(true);
        // useTM.setIsTaskPreviewVisible(false);
        useTM.setIsCreatingTask((prev) => ({ ...prev, flag: false }));

        if (message.taskId) {
            useTM.setCurrentPreviewTaskId(message.taskId);
        } else {
            useTM.setCurrentPreviewTaskId(-1);
        }

        if (socket !== null) {
            socket.emit(
                "thread_message",
                {
                    methodType: "POST",
                    isInit: true,
                    rootMessageTSSent: message.tsSent,
                    rootMessageSenderId: message.sender.userId,
                    rootMessageReceiverId:
                        myself.userId === message.sender.userId
                            ? chat.dmPartnerUser.userId === ""
                                ? null
                                : chat.dmPartnerUser.userId
                            : myself.userId,
                    threadId: message.messageId,
                    threadMessage: message.content,
                    chatType: chat.chatType,
                    dmPartnerUserId:
                        chat.dmPartnerUser.userId === "" ? null : chat.dmPartnerUser.userId,
                    senderId: myself.userId,
                    senderName: myself.userName,
                    destCGName: chat.chatName,
                    destCGId: chat.chatId,
                    systemUserId: null,
                    taskId: message.taskId || null,
                    messageIdForPut: null,
                    sendActivity: false,
                },
                async (ack: any) => {
                    const newThreadMessage: ThreadMessageProps = {
                        chatType: chat.chatType,
                        messageIdWithChatIdAndThreadId: `${chat.chatId}-${message.messageId}-1`,
                        chatId: chat.chatId,
                        threadId: message.messageId,
                        messageId: 1,
                        content: message.content,
                        contentText: t.chat.system.needToAdd,
                        sender:
                            chat.chatType === 1
                                ? myself.userId === message.sender.userId
                                    ? myself
                                    : chat.dmPartnerUser
                                : message.sender,
                        reactions: message.reactions,
                        taskId: message.taskId || null,
                        tsSent: message.tsSent,
                        tsUpdated: message.tsSent,
                    };

                    if (newThreadMessage) {
                        const threadMessages: ThreadMessageProps[] =
                            await loadSpecificThreadMessages(
                                myself,
                                chat.chatType,
                                newThreadMessage.chatId,
                                newThreadMessage.threadId,
                                accessToken
                            );
                        if (threadMessages && threadMessages.length > 0) {
                            const newThread: ThreadProps = {
                                chatId: newThreadMessage.chatId,
                                chatName: chat.chatName,
                                threadId: newThreadMessage.threadId,
                                chatType: chat.chatType,
                                dmPartnerUser: chat.dmPartnerUser,
                                taskId: message.taskId || null,
                                messages: threadMessages,
                                project: message.project,
                                TSLastMessage: getLocalCurrentTimestamp(),
                                taskExist: threadMessages[0].taskExist,
                            };
                            if (message.project && message.project.projectId) {
                                usePM.setCurrentProject(message.project);
                            }
                            if (newThread) {
                                useCM.setCurrentThreadChat(newThread);
                                if (newThread.taskExist === true && threadMessages[0].taskId) {
                                    useTM.setCurrentPreviewTaskId(threadMessages[0].taskId);
                                }

                                // Navigate to thread URL for consistency with URL routing
                                const typePath = CHAT_TYPE_PATH[chat.chatType];
                                if (typePath) {
                                    // For PM (chatType 3), use taskId as thread identifier to match indexMap key format
                                    const threadIdentifier =
                                        chat.chatType === 3 && message.taskId
                                            ? message.taskId
                                            : message.messageId;
                                    navigate(
                                        `/workspace/chat/${typePath}/${chat.chatId}/thread/${threadIdentifier}`
                                    );
                                }
                            }
                        }
                    }
                }
            );
        }
    };

    // Reaction handling
    // On mobile the toolbar is summoned by a long-press (~500ms hold)
    // on the bubble — there's no hover signal on touch, but always-on
    // is visually noisy. Long-press → toolbar appears for that bubble;
    // tapping anywhere outside (or sending one of its actions)
    // dismisses it. Desktop keeps the existing hover-driven behavior.
    const isMobile = useIsMobile();
    const [showUnderBarHovered, setShowUnderBarOption] = useState(false);
    const [mobileToolbarOpen, setMobileToolbarOpen] = useState(false);
    const showUnderBarOption = isMobile ? mobileToolbarOpen : showUnderBarHovered;
    const longPress = useLongPress(() => setMobileToolbarOpen(true), { threshold: 500 });
    const [reactions, setReactions] = useState<ReactionProps[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
    const [selectedEmoji, setSelectedEmoji] = useState<any>(null);
    const [uniqueReactionEmojiCount, setUniqueReactionEmojiCount] = useState<number>(0);

    // Dynamic positioning for emoji picker
    const bubbleRef = useRef<HTMLDivElement>(null);
    const toolbarRef = useRef<HTMLDivElement>(null);
    const [pickerBottomPosition, setPickerBottomPosition] = useState<number>(40);
    const [pickerTopPosition, setPickerTopPosition] = useState<number | string>("auto");
    const [pickerRightPosition, setPickerRightPosition] = useState<number | string>(
        isSent ? 0 : "auto"
    );
    const [pickerLeftPosition, setPickerLeftPosition] = useState<number | string>(
        isSent ? "auto" : 0
    );
    const [emojiPickerPositionCalculated, setEmojiPickerPositionCalculated] =
        useState<boolean>(false);

    useEffect(() => {
        if (!showEmojiPicker) {
            setEmojiPickerPositionCalculated(false);
            return;
        }

        // Viewport-clamped fixed positioning, used in both bubble and
        // compact modes. Anchors to the floating toolbar when present
        // (compact mode), otherwise to the bubble container (bubble
        // mode). The picker's right edge aligns with the anchor's right
        // edge, then clamps to viewport so it never falls off-screen.
        const anchor = toolbarRef.current ?? bubbleRef.current;
        if (!anchor) return;
        const rect = anchor.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const pickerHeight = 435;
        const pickerWidth = 352;

        if (viewportHeight - rect.bottom > pickerHeight + 20) {
            setPickerTopPosition(rect.bottom + 10);
        } else if (rect.top > pickerHeight + 20) {
            setPickerTopPosition(rect.top - pickerHeight - 10);
        } else {
            setPickerTopPosition(20);
        }
        setPickerBottomPosition(0);

        const desiredLeft = rect.right - pickerWidth;
        const leftPos = Math.max(20, Math.min(desiredLeft, viewportWidth - pickerWidth - 20));
        setPickerLeftPosition(leftPos);
        setPickerRightPosition("auto");
        setEmojiPickerPositionCalculated(true);
    }, [showEmojiPicker]);

    useEffect(() => {
        setReactions(message.reactions || []);
    }, [message]);

    // Dismiss the mobile long-press toolbar when the user taps anywhere
    // that isn't the bubble itself. Without this the toolbar would stay
    // sticky forever (no hover-out signal on touch).
    useEffect(() => {
        if (!mobileToolbarOpen) return;
        const handler = (e: TouchEvent | MouseEvent) => {
            const target = e.target as Node | null;
            if (!target) return;
            if (bubbleRef.current && bubbleRef.current.contains(target)) return;
            setMobileToolbarOpen(false);
        };
        document.addEventListener("touchstart", handler, { passive: true });
        document.addEventListener("mousedown", handler);
        return () => {
            document.removeEventListener("touchstart", handler);
            document.removeEventListener("mousedown", handler);
        };
    }, [mobileToolbarOpen]);

    useEffect(() => {
        if (selectedEmoji !== null) {
            // Backend's reaction handler skips its 8-way Django refetch when this
            // is present (see backend/socketio_events/message_reaction_handlers.py).
            const emptyUser = {
                userName: "",
                userId: "",
                avatarImgPath: "",
                tsLastSeen: "",
                tsJoined: "",
                customStatus: "",
            };
            const messageSnapshot = {
                sender: message.sender,
                receiver:
                    chat.chatType === 1
                        ? message.sender.userId === myself.userId
                            ? chat.dmPartnerUser
                            : myself
                        : emptyUser,
                dmPartnerUser: chat.chatType === 1 ? chat.dmPartnerUser : emptyUser,
                taskId: message.taskId,
                taskStatus: message.taskStatus,
                content: message.content,
                tsSent: message.tsSent,
                tsUpdated: message.tsUpdated,
            };

            const existingIndex = reactions.findIndex(
                (r) => r.emoji === selectedEmoji && r.sender.userId === myself.userId
            );
            if (existingIndex !== -1) {
                const updatedReactions = reactions.filter((_, idx) => idx !== existingIndex);
                setReactions(updatedReactions);
                if (socket) {
                    socket.emit("message_reaction", {
                        method_type: "DELETE",
                        team_id: myself.teamId,
                        chat_type: chat.chatType,
                        chat_name: chat.chatName,
                        chat_id: message.chatId,
                        thread_id: 0,
                        message_id: message.messageId,
                        message_body: message.content,
                        message_sender: message.sender,
                        dm_partner_user_id:
                            message.sender.userId === myself.userId
                                ? chat.dmPartnerUser.userId
                                : myself.userId,
                        is_thread_binary: 0,
                        reaction_emoji: selectedEmoji,
                        current_emojis: reactions,
                        messageSnapshot,
                    });

                    if (message.messageId === 1 && chat.chatType !== 3) {
                        socket.emit("message_reaction", {
                            method_type: "DELETE",
                            team_id: myself.teamId,
                            chat_type: chat.chatType,
                            chat_name: chat.chatName,
                            chat_id: message.chatId,
                            thread_id: 0,
                            message_id: message.threadId,
                            message_body: message.content,
                            message_sender: message.sender,
                            dm_partner_user_id:
                                message.sender.userId === myself.userId
                                    ? chat.dmPartnerUser.userId
                                    : myself.userId,
                            is_thread_binary: 0,
                            reaction_emoji: selectedEmoji,
                            current_emojis: reactions,
                            messageSnapshot,
                        });
                    }

                    if (message.numReplies > 0 && chat.chatType !== 3) {
                        socket.emit("message_reaction", {
                            method_type: "DELETE",
                            team_id: myself.teamId,
                            chat_type: chat.chatType,
                            chat_name: chat.chatName,
                            chat_id: message.chatId,
                            thread_id: message.messageId,
                            message_id: 1,
                            message_body: message.content,
                            message_sender: message.sender,
                            dm_partner_user_id:
                                message.sender.userId === myself.userId
                                    ? chat.dmPartnerUser.userId
                                    : myself.userId,
                            is_thread_binary: 1,
                            reaction_emoji: selectedEmoji,
                            current_emojis: reactions,
                            messageSnapshot,
                        });
                    }
                }
            } else {
                setReactions([
                    ...reactions,
                    {
                        id: -1,
                        emoji: selectedEmoji,
                        sender: myself,
                        tsSent: getLocalCurrentTimestamp(),
                    },
                ]);
                if (socket) {
                    socket.emit("message_reaction", {
                        method_type: "POST",
                        team_id: myself.teamId,
                        chat_type: chat.chatType,
                        chat_name: chat.chatName,
                        chat_id: message.chatId,
                        thread_id: 0,
                        message_id: message.messageId,
                        message_body: message.content,
                        message_sender: message.sender,
                        dm_partner_user_id:
                            message.sender.userId === myself.userId
                                ? chat.dmPartnerUser.userId
                                : myself.userId,
                        is_thread_binary: 0,
                        reaction_emoji: selectedEmoji,
                        current_emojis: reactions,
                        messageSnapshot,
                    });

                    if (message.messageId === 1 && chat.chatType !== 3) {
                        socket.emit("message_reaction", {
                            method_type: "POST",
                            team_id: myself.teamId,
                            chat_type: chat.chatType,
                            chat_name: chat.chatName,
                            chat_id: message.chatId,
                            thread_id: 0,
                            message_id: message.threadId,
                            message_body: message.content,
                            message_sender: message.sender,
                            dm_partner_user_id:
                                message.sender.userId === myself.userId
                                    ? chat.dmPartnerUser.userId
                                    : myself.userId,
                            is_thread_binary: 0,
                            reaction_emoji: selectedEmoji,
                            current_emojis: reactions,
                            messageSnapshot,
                            send_activity: false,
                        });
                    }

                    if (chat.chatType !== 3 && message.numReplies > 0) {
                        socket.emit("message_reaction", {
                            method_type: "POST",
                            team_id: myself.teamId,
                            chat_type: chat.chatType,
                            chat_name: chat.chatName,
                            chat_id: message.chatId,
                            thread_id: message.messageId,
                            message_id: 1,
                            message_body: message.content,
                            message_sender: message.sender,
                            dm_partner_user_id:
                                message.sender.userId === myself.userId
                                    ? chat.dmPartnerUser.userId
                                    : myself.userId,
                            is_thread_binary: 1,
                            reaction_emoji: selectedEmoji,
                            current_emojis: reactions,
                            messageSnapshot,
                            send_activity: false,
                        });
                    }
                }
            }
            setSelectedEmoji(null);
        }
    }, [selectedEmoji]);

    // Same chip-count rules as `BubbleUnderBar` — kept in sync because
    // this drives the bubble's `minWidth` calc (so an empty bubble
    // doesn't reserve space for a chip that never renders, and a
    // chip-bearing bubble has enough room for "X comments").
    let numRepliesWithoutFirstMessage: number;
    if (chat.chatType === 3) {
        numRepliesWithoutFirstMessage = message.taskCommentCount ?? 0;
    } else {
        numRepliesWithoutFirstMessage = message.numReplies - 1;
    }

    // Bubble action buttons component - consolidated into a single "More" menu
    const BubbleActions = () => (
        <Stack
            alignItems="center"
            direction="row"
            spacing={0.5}
            sx={{
                opacity: showUnderBarOption ? 1 : 0,
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                transform: showUnderBarOption ? "translateX(0)" : "translateX(-4px)",
                pl: 1,
            }}
        >
            {/* Quick emoji reaction - kept visible for fast access */}
            {isScrolling !== true && (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                    }}
                >
                    <EmojiReaction
                        chatName={chat.chatName}
                        chatType={chat.chatType}
                        dmPartnerUser={chat.dmPartnerUser}
                        isThread={false}
                        message={message}
                        myself={myself}
                        numReplies={message.numReplies}
                        reactions={reactions}
                        setReactions={setReactions}
                        setShowEmojiPicker={setShowEmojiPicker}
                        setUniqueReactionEmojiCount={setUniqueReactionEmojiCount}
                        showUnderBarOption={showUnderBarOption}
                        socket={socket}
                    />
                </Box>
            )}

            {/* Consolidated "More" menu with all other actions */}
            <BubbleMoreMenu
                accessToken={accessToken}
                chat={chat}
                flaggedMessages={useCM.flaggedMessages}
                isSent={isSent}
                message={message}
                myself={myself}
                replyHandler={replayHandler}
                setCurrentChat={useCM.setCurrentMainChat}
                setEditTargetMessage={setEditTargetMessage}
                setFlaggedMessages={useCM.setFlaggedMessages}
                setIsInEdit={setIsInEdit}
                socket={socket}
                useCM={useCM}
                usePM={usePM}
                useTM={useTM}
            />
        </Stack>
    );

    if (isCompact) {
        const focusAccent =
            isFocused === "focused"
                ? BUBBLE_COLORS.focused[isDark ? "dark" : "light"].border
                : isFocused === "threadActive"
                  ? BUBBLE_COLORS.threadActive[isDark ? "dark" : "light"].border
                  : "transparent";

        const messageBody = message.content && message.content.length > 0 && (
            <Tooltip
                placement="right"
                variant="outlined"
                enterDelay={1000}
                title={
                    <>
                        {chat.chatType === 3 ? t.chat.bubble.clickToOpenTask : null}
                        {chat.chatType === 3 ? <br /> : null}
                        {fmt(t.chat.bubble.clickToOpenThread, { modKey: isMac() ? "⌘" : "Alt" })}
                    </>
                }
            >
                <Box
                    sx={{
                        mt: isSimpleBubble ? 0 : 0.25,
                    }}
                >
                    <BnChatPreview
                        key={`${chat.chatId}-${message.messageId}-${chat.chatType}-${message.tsUpdated}`}
                        content={message.content}
                        isSent={isSent}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useCM={useCM}
                        useTEM={useTEM}
                        useUISM={useUISM}
                    />
                </Box>
            </Tooltip>
        );

        return (
            <Box
                ref={bubbleRef}
                sx={{
                    width: "100%",
                    position: "relative",
                    py: 0.5,
                    pl: 2,
                    pr: 2,
                    cursor: "pointer",
                    borderLeft: "3px solid",
                    borderLeftColor: focusAccent,
                    borderTop: isSimpleBubble ? "none" : "1px solid",
                    borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                    backgroundColor:
                        isFocused === "focused"
                            ? COMPACT_FOCUSED_BG.focused[isDark ? "dark" : "light"]
                            : isFocused === "threadActive"
                              ? COMPACT_FOCUSED_BG.threadActive[isDark ? "dark" : "light"]
                              : showUnderBarOption
                                ? isDark
                                    ? "rgba(255,255,255,0.03)"
                                    : "rgba(0,0,0,0.025)"
                                : "transparent",
                    transition: "background-color 0.15s ease",
                }}
                onClick={handleMessageClick}
                onDoubleClick={doubleClickTodoEnabled ? handleAddMessageToToDo : undefined}
                onMouseEnter={() => setShowUnderBarOption(true)}
                onMouseLeave={() => setShowUnderBarOption(false)}
                onTouchStart={longPress.onTouchStart}
                onTouchEnd={longPress.onTouchEnd}
                onTouchMove={longPress.onTouchMove}
                onTouchCancel={longPress.onTouchCancel}
            >
                {emojiPickerPositionCalculated === true && (
                    <EmojiPicker
                        pickerBottomPosition={pickerBottomPosition}
                        pickerLeftPosition={pickerLeftPosition}
                        pickerRightPosition={pickerRightPosition}
                        pickerTopPosition={pickerTopPosition}
                        setSelectedEmoji={setSelectedEmoji}
                        setShowEmojiPicker={setShowEmojiPicker}
                        showEmojiPicker={showEmojiPicker}
                        useFixedPosition={true}
                    />
                )}

                {showUnderBarOption === true && (
                    <Box
                        ref={toolbarRef}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                        sx={{
                            position: "absolute",
                            top: COMPACT_TOOLBAR_OFFSET.top,
                            right: COMPACT_TOOLBAR_OFFSET.right,
                            zIndex: 2,
                            backgroundColor: isDark ? "#1f2937" : "#ffffff",
                            border: "1px solid",
                            borderColor: isDark ? "#374151" : "#e5e7eb",
                            borderRadius: "8px",
                            px: 0.5,
                            boxShadow: isDark
                                ? "0 2px 8px rgba(0,0,0,0.4)"
                                : "0 2px 8px rgba(0,0,0,0.1)",
                        }}
                    >
                        <BubbleActions />
                    </Box>
                )}

                <Stack alignItems="flex-start" direction="row" spacing={1.5}>
                    {!hideAvatarSlot &&
                        (isSimpleBubble ? (
                            <Box sx={{ flexShrink: 0, width: COMPACT_BODY_INDENT - 12 }} />
                        ) : (
                            <Box sx={{ flexShrink: 0 }}>
                                <UserAvatar
                                    userId={isSent ? myself.userId : message.sender.userId}
                                />
                            </Box>
                        ))}

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        {!isSimpleBubble && (
                            <BubbleUserName
                                chatType={chat.chatType}
                                dtSent={dtSent}
                                isSent={isSent}
                                isSimpleBubble={false}
                                isThread={false}
                                sender={message.sender}
                                taskId={message.taskId}
                                displayId={message.displayId}
                                taskStatus={message.taskStatus}
                                tsSent={message.tsSent}
                                tsUpdated={message.tsUpdated}
                                userName={message.sender.userName}
                            />
                        )}

                        {message.attachment ? (
                            <Box sx={{ mt: isSimpleBubble ? 0 : 0.5 }}>
                                <BubbleAttachmentSheet
                                    fileName={message.attachment.fileName}
                                    fileSize={message.attachment.size}
                                    isSent={isSent}
                                />
                            </Box>
                        ) : (
                            messageBody
                        )}

                        <BubbleUnderBar
                            chatName={chat.chatName}
                            chatType={chat.chatType}
                            dmPartnerUser={chat.dmPartnerUser}
                            isThread={false}
                            message={message}
                            myself={myself}
                            numReplies={message.numReplies}
                            reactions={reactions}
                            replayHandler={replayHandler}
                            setReactions={setReactions}
                            setShowEmojiPicker={setShowEmojiPicker}
                            setUniqueReactionEmojiCount={setUniqueReactionEmojiCount}
                            showUnderBarOption={showUnderBarOption}
                            socket={socket}
                            taskCommentCount={message.taskCommentCount}
                        />
                    </Box>
                </Stack>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                maxWidth: "90%",
                minWidth:
                    chat.chatType === 3
                        ? 500
                        : (isSimpleBubble
                              ? numRepliesWithoutFirstMessage > 0
                                  ? 150
                                  : 100
                              : 200) +
                          (uniqueReactionEmojiCount < 10 ? uniqueReactionEmojiCount * 20 : 310),
                whiteSpace: "normal",
                wordBreak: "break-word",
            }}
        >
            {message.attachment ? (
                <BubbleAttachmentSheet
                    fileName={message.attachment.fileName}
                    fileSize={message.attachment.size}
                    isSent={isSent}
                />
            ) : (
                <Box ref={bubbleRef} sx={{ position: "relative" }}>
                    {emojiPickerPositionCalculated === true && (
                        <EmojiPicker
                            pickerBottomPosition={pickerBottomPosition}
                            pickerLeftPosition={pickerLeftPosition}
                            pickerRightPosition={pickerRightPosition}
                            pickerTopPosition={pickerTopPosition}
                            setSelectedEmoji={setSelectedEmoji}
                            setShowEmojiPicker={setShowEmojiPicker}
                            showEmojiPicker={showEmojiPicker}
                            useFixedPosition={true}
                        />
                    )}
                    <Tooltip
                        placement="right"
                        variant="outlined"
                        enterDelay={1000}
                        title={
                            <>
                                {chat.chatType === 3 ? t.chat.bubble.clickToOpenTask : null}
                                {chat.chatType === 3 ? <br /> : null}
                                {fmt(t.chat.bubble.clickToOpenThread, {
                                    modKey: isMac() ? "\u2318" : "Alt",
                                })}
                            </>
                        }
                    >
                        <Sheet
                            sx={{
                                p: 1.25,
                                borderRadius: "16px",
                                position: "relative",
                                overflow: "hidden",
                                cursor: "pointer",
                                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                // Variant-specific border radius
                                ...(isSent
                                    ? { borderTopRightRadius: "4px", borderTopLeftRadius: "16px" }
                                    : {
                                          borderTopRightRadius: "16px",
                                          borderTopLeftRadius: "4px",
                                      }),
                                // Background styling - solid colors for better text contrast
                                background: isFocused ? highlightColors.bg : colors.bg,
                                // Text color for proper contrast
                                color: isFocused ? highlightColors.text : colors.text,
                                // Border styling
                                border: "1px solid",
                                borderColor: isFocused ? highlightColors.border : colors.border,
                                // Shadow for depth
                                boxShadow: isFocused
                                    ? isFocused === "focused"
                                        ? isDark
                                            ? `0 4px 20px rgba(34,197,94,0.2), inset 0 1px 0 rgba(255,255,255,0.05)`
                                            : `0 4px 20px rgba(22,163,74,0.15)`
                                        : isDark
                                          ? `0 4px 20px rgba(124,58,237,0.2), inset 0 1px 0 rgba(255,255,255,0.05)`
                                          : `0 4px 20px rgba(124,58,237,0.15)`
                                    : isDark
                                      ? "0 2px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)"
                                      : "0 2px 8px rgba(0,0,0,0.06)",
                                // Hover effect
                                "&:hover": {
                                    boxShadow: isDark
                                        ? "0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)"
                                        : "0 4px 16px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
                                },
                            }}
                            onClick={handleMessageClick}
                            onDoubleClick={
                                doubleClickTodoEnabled ? handleAddMessageToToDo : undefined
                            }
                            onMouseEnter={() => setShowUnderBarOption(true)}
                            onMouseLeave={() => setShowUnderBarOption(false)}
                            onTouchStart={longPress.onTouchStart}
                            onTouchEnd={longPress.onTouchEnd}
                            onTouchMove={longPress.onTouchMove}
                            onTouchCancel={longPress.onTouchCancel}
                        >
                            {/* Subtle highlight for sent messages */}
                            {isSent && !isFocused && (
                                <Box
                                    sx={{
                                        position: "absolute",
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        height: "1px",
                                        background: isDark
                                            ? "rgba(255,255,255,0.08)"
                                            : "rgba(255,255,255,0.5)",
                                        pointerEvents: "none",
                                    }}
                                />
                            )}

                            <Stack direction="column" sx={{ position: "relative", zIndex: 1 }}>
                                {showUnderBarOption === true && isSimpleBubble === true && (
                                    <Stack
                                        alignItems="center"
                                        direction="row"
                                        spacing={0}
                                        sx={{ mb: 0.5 }}
                                    >
                                        <BubbleUserName
                                            chatType={chat.chatType}
                                            dtSent={dtSent}
                                            isSent={isSent}
                                            isSimpleBubble={isSimpleBubble}
                                            isThread={false}
                                            sender={message.sender}
                                            taskId={message.taskId}
                                            displayId={message.displayId}
                                            taskStatus={message.taskStatus}
                                            tsSent={message.tsSent}
                                            tsUpdated={message.tsUpdated}
                                            userName={message.sender.userName}
                                        />
                                        <BubbleActions />
                                    </Stack>
                                )}

                                {isSimpleBubble === false && (
                                    <Stack alignItems="flex-start" direction="row" spacing={1.5}>
                                        {!(
                                            (chat.chatType === 3 || chat.chatType === 4) &&
                                            message.sender.isSystemUser === true
                                        ) && (
                                            <Box sx={{ flexShrink: 0 }}>
                                                <UserAvatar
                                                    userId={
                                                        isSent
                                                            ? myself.userId
                                                            : message.sender.userId
                                                    }
                                                />
                                            </Box>
                                        )}
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Stack alignItems="center" direction="row" spacing={0}>
                                                <BubbleUserName
                                                    chatType={chat.chatType}
                                                    dtSent={dtSent}
                                                    isSent={isSent}
                                                    isSimpleBubble={isSimpleBubble}
                                                    isThread={false}
                                                    sender={message.sender}
                                                    taskId={message.taskId}
                                                    displayId={message.displayId}
                                                    taskStatus={message.taskStatus}
                                                    tsSent={message.tsSent}
                                                    tsUpdated={message.tsUpdated}
                                                    userName={message.sender.userName}
                                                />
                                                {showUnderBarOption === true && <BubbleActions />}
                                            </Stack>
                                        </Box>
                                    </Stack>
                                )}

                                {message.content && message.content.length > 0 && (
                                    <Box
                                        sx={{
                                            mt: isSimpleBubble ? 0 : 0.5,
                                            cursor: message.taskId ? "pointer" : "default",
                                        }}
                                        onClick={() => {
                                            if (message.taskId !== null) {
                                                useCM.setIsMainChatVisible(true);
                                                useCM.setIsThreadVisible(false);
                                                // useTM.setIsTaskPreviewVisible(true);
                                                useTM.setIsCreatingTask((prev) => ({
                                                    ...prev,
                                                    flag: false,
                                                }));
                                                useTM.setCurrentPreviewTaskId(message.taskId);
                                            }
                                        }}
                                    >
                                        <BnChatPreview
                                            key={`${chat.chatId}-${message.messageId}-${chat.chatType}-${message.tsUpdated}`}
                                            content={message.content}
                                            isSent={isSent}
                                            myself={myself}
                                            setMyself={setMyself}
                                            socket={socket}
                                            useCM={useCM}
                                            useTEM={useTEM}
                                            useUISM={useUISM}
                                        />
                                    </Box>
                                )}
                            </Stack>

                            <BubbleUnderBar
                                chatName={chat.chatName}
                                chatType={chat.chatType}
                                dmPartnerUser={chat.dmPartnerUser}
                                isThread={false}
                                message={message}
                                myself={myself}
                                numReplies={message.numReplies}
                                reactions={reactions}
                                replayHandler={replayHandler}
                                setReactions={setReactions}
                                setShowEmojiPicker={setShowEmojiPicker}
                                setUniqueReactionEmojiCount={setUniqueReactionEmojiCount}
                                showUnderBarOption={showUnderBarOption}
                                socket={socket}
                                taskCommentCount={message.taskCommentCount}
                            />
                        </Sheet>
                    </Tooltip>
                </Box>
            )}
        </Box>
    );
};

// Memoized export. The custom comparator compares only the props that
// actually affect the rendered output of this bubble. Excluded on purpose:
//
//   - State-manager objects (`useUISM`, `useCM`, `useTM`, `usePM`, `useTEM`):
//     they're recreated on every parent render, but only their setter
//     methods are read inside this component, and those setters are
//     stable (useState setters). All previous read-then-capture sites
//     (e.g. `...useTM.isCreatingTask`, `useCM.currentThreadChat`) have
//     been converted to functional updates in the relevant handlers, so
//     skipping a render no longer risks a stale-closure trap.
//
//   - `socket`: stable for the lifetime of the connection (managed by
//     SocketProvider, now in useState).
//
//   - Callbacks (`setMyself`, `setIsInEdit`, `setEditTargetMessage`,
//     `setTodoFromMessageBubble`): all useState setters from chatHome,
//     stable across renders.
//
// `message` and `chat` are compared by reference — they're cloned via
// `{...prev, ...next}` everywhere they're mutated in chat state, so any
// real content change produces a new reference. Primitives (`variant`,
// `isFocused`, `isScrolling`, `isSimpleBubble`) and `myself.userId` cover
// the remaining render-affecting state.
const areEqual = (prev: MessageBubbleProps, next: MessageBubbleProps): boolean =>
    prev.message === next.message &&
    prev.chat === next.chat &&
    prev.variant === next.variant &&
    prev.isFocused === next.isFocused &&
    prev.isScrolling === next.isScrolling &&
    prev.isSimpleBubble === next.isSimpleBubble &&
    prev.myself.userId === next.myself.userId;

export const MessageBubble = memo(MessageBubbleImpl, areEqual);
