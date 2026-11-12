import { memo, useEffect, useRef, useState } from "react";
import { Box, Stack } from "@mui/joy";
import { useNavigate } from "react-router-dom";
import { Socket } from "socket.io-client";

import { MessageBody } from "../../../../components/messageBody/MessageBody";
import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { Bubble } from "../../../../components/ui/bubble";
import { Clickable } from "../../../../components/ui/Clickable";
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
import { channelService } from "../../../../services/channel/channelService";
import { notifyActionError } from "../../../../services/requestErrorNotifier";
import { threadClickModifier } from "../../../../shortcuts";
import { UserProps } from "../../../../types/admin";
import { ChannelKind } from "../../../../types/channel";
import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../../../types/chat";
import { ReactionProps } from "../../../../types/common";
import { TaskCommentProps } from "../../../../types/tasks";
import { extractYYYYMMDDHHMM, getLocalCurrentTimestamp } from "../../../../utils/dateUtils";
import { isRealTaskId } from "../../../tasks/utils/taskPreviewPaneVisibility";
import { loadV3SpecificThreadMessages } from "../../services/loadV3SpecificThreadMessages";
import { BubbleAttachmentSheet } from "./BubbleAttachmentSheet";
import { BubbleMoreMenu } from "./BubbleMoreMenu";
import { BubbleUnderBar } from "./BubbleUnderBar";
import { BubbleUserName } from "./BubbleUserName";

// Chat type → URL path segment. Module constant so it isn't rebuilt on
// every bubble render.
const CHAT_TYPE_PATH: Record<number, string> = {
    1: "dm",
    2: "gm",
    3: "pm",
    4: "mdm",
};

type MessageBubbleProps = {
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    variant: "sent" | "received";
    chat: ChatProps;
    message: MessageProps;
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

    const { t } = useTranslation();
    const isSent = variant === "sent";
    const dtSent = extractYYYYMMDDHHMM(message.tsSent);
    const { accessToken } = useAuth();
    const navigate = useNavigate();
    const { style } = useBubbleStylePreference();
    const isCompact = style === "compact";
    const { enabled: doubleClickTodoEnabled } = useDoubleClickTodoPreference();
    const isSystemUser = message.sender.isSystemUser === true;
    // The sender's CURRENT name is live-resolved inside `BubbleUserName`
    // (via the `<ResolvedUserName>` leaf) so its AvatarContext
    // subscription is isolated there — this memoized bubble no longer
    // re-renders on the periodic `teamMemberProfiles` churn.
    // PM bubbles are task cards — they should NEVER show a user
    // avatar regardless of `sender.userId`. The legacy task-creation
    // path stamped `sender_id` to whoever created the task (not the
    // project's system user), so checking `isSystemUser` alone would
    // render those bubbles with the creator's avatar + "(You)" badge
    // instead of as a task card. Hide unconditionally for PM.
    //
    // MDM still keys on `isSystemUser` — MDM channels mix real-user
    // messages with system "X has joined" notices, and only the
    // latter should hide the slot.
    const hideAvatarSlot = chat.chatType === 3 || (chat.chatType === 4 && isSystemUser);

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

    const replayHandler = (e?: React.MouseEvent) => {
        // Stop propagation to prevent handleMessageClick from being called
        e?.stopPropagation();

        // (The legacy `loadSpecificTaskByThreadId(message.messageId)`
        // pre-load is gone: it queried with the parent's SEQ where the
        // task rows store the v3 root UUID, so it never matched — the
        // thread pane's `useThreadTaskMeta` hook now resolves the
        // thread's task against the server once the thread opens.)

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

        // v3 cutover: the legacy `socket.emit("thread_message",
        // {methodType: "POST", isInit: true, ...})` synthesized a
        // "first thread message" mirror of the parent. The v3 unified
        // Message model treats the parent itself as the thread root;
        // thread replies are just rows with `parentId === parent.id`.
        // No emit needed to open a thread — just load existing replies
        // and navigate to the URL.
        //
        // `message.messageIdWithChatId` is the parent's v3 UUID (set
        // by the v3 → legacy adapter). That's the thread root.
        const threadRootUuid = message.messageIdWithChatId;
        if (!threadRootUuid) {
            return;
        }
        const v3ChannelId = chat.chatId;
        (async () => {
            const threadMessages = await loadV3SpecificThreadMessages(
                v3ChannelId,
                threadRootUuid,
                chat.chatType
            );
            // A thread's task linkage rides on whichever message carries
            // the task metadata — for DM/GM/MDM that's the task-created
            // CARD REPLY, not the root. Reading only the root (the old
            // `threadMessages[0].taskExist`) made every reopened task
            // thread look task-less: the header re-offered "Create task"
            // on threads that already had one. Same scan
            // `moveToSpecificThreadChat` uses.
            const taskMsg = threadMessages.find((m) => m.taskExist && m.taskId != null);
            const threadTaskId = taskMsg?.taskId ?? message.taskId ?? null;
            const newThread: ThreadProps = {
                chatId: v3ChannelId as unknown as number,
                chatName: chat.chatName,
                // ThreadProps.threadId is `number`; carry the v3 UUID
                // through via the same cast as the rest of the
                // migration. Downstream consumers compare it as a
                // string against URL segments and stored values.
                threadId: threadRootUuid as unknown as number,
                chatType: chat.chatType,
                dmPartnerUser: chat.dmPartnerUser,
                taskId: threadTaskId,
                messages: threadMessages,
                project: taskMsg?.project ?? message.project,
                TSLastMessage: getLocalCurrentTimestamp(),
                taskExist: threadTaskId != null,
            };
            if (message.project && message.project.projectId) {
                usePM.setCurrentProject(message.project);
            }
            useCM.setCurrentThreadChat(newThread);
            if (newThread.taskExist === true && threadTaskId) {
                useTM.setCurrentPreviewTaskId(threadTaskId);
            }

            // Navigate to thread URL for consistency with URL routing.
            // For PM (chatType 3), use taskId as thread identifier so
            // the URL roundtrips through `useChatRouting`'s
            // `resolveV3ThreadRootUuid(isPm=true)` lookup. Other kinds
            // use the parent's per-channel seq.
            const typePath = CHAT_TYPE_PATH[chat.chatType];
            if (typePath) {
                const threadIdentifier =
                    chat.chatType === 3 && message.taskId ? message.taskId : message.messageId;
                navigate(`/workspace/chat/${typePath}/${chat.chatId}/thread/${threadIdentifier}`);
            }
        })();
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
    // While the More menu is open we (a) keep the toolbar mounted even
    // after the cursor leaves the bubble — otherwise `showUnderBarOption`
    // flips false and unmounts the menu out from under the user — and
    // (b) force the bubble tooltip closed so it can't overlap the menu.
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
    const showUnderBarOption =
        (isMobile ? mobileToolbarOpen : showUnderBarHovered) || isMoreMenuOpen;
    const longPress = useLongPress(() => setMobileToolbarOpen(true), { threshold: 500 });
    const [reactions, setReactions] = useState<ReactionProps[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
    const [selectedEmoji, setSelectedEmoji] = useState<any>(null);
    const [uniqueReactionEmojiCount, setUniqueReactionEmojiCount] = useState<number>(0);
    // Per-bubble wrap toggles. Toggling from the More menu adds
    // `bn-unwrap-all` / `bn-unwrap-code` to the preview wrapper Box
    // below, which the existing App.css rules pick up to either
    // unwrap everything (editor-wide scroll) or unwrap just code
    // blocks. State is local — never persisted.
    const [unwrapAll, setUnwrapAll] = useState<boolean>(false);
    const [unwrapCode, setUnwrapCode] = useState<boolean>(false);
    const previewWrapClassName = [unwrapAll && "bn-unwrap-all", unwrapCode && "bn-unwrap-code"]
        .filter(Boolean)
        .join(" ");

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
        if (selectedEmoji === null) return;
        // v3 channelService.react / .unreact replaces the legacy
        // multi-emit reaction path. The legacy code fired up to THREE
        // `socket.emit("message_reaction", ...)` calls per click — one
        // for the message itself, one for the synthetic "first thread
        // message" mirror (when messageId === 1), and one for the
        // thread-reply count broadcast (when numReplies > 0). The v3
        // unified Message model treats top-level rows and thread
        // replies as the same Message — the server broadcasts
        // `reaction.added` / `reaction.removed` to the channel room
        // exactly once and the open chat's live-update subscription
        // patches every visible surface (main pane, thread panel,
        // bubble counts) from one event.
        //
        // The legacy `messageSnapshot` payload (sender / receiver /
        // dmPartnerUser / taskId / displayId / tsSent / tsUpdated /
        // content) was the backend's hint to skip its 8-way Django
        // refetch — the v3 backend's `reaction.add` / `.remove`
        // handlers do a single targeted query so the hint isn't
        // needed.
        const v3MessageId = message.messageIdWithChatId;
        if (!v3MessageId) {
            setSelectedEmoji(null);
            return;
        }
        const channelKind = chat.chatType as ChannelKind;
        const v3ChannelId = chat.chatId;
        const existingIndex = reactions.findIndex(
            (r) => r.emoji === selectedEmoji && r.sender.userId === myself.userId
        );
        if (existingIndex !== -1) {
            // Optimistic remove — live-update subscription will
            // converge with the server's `reaction.removed` broadcast.
            setReactions(reactions.filter((_, idx) => idx !== existingIndex));
            void channelService
                .unreact(v3MessageId, v3ChannelId, channelKind, selectedEmoji)
                .catch((e) => {
                    console.error("[MessageBubble] unreact failed:", e);
                    notifyActionError(e);
                });
        } else {
            // Optimistic add. The fabricated `id: -1` is a transient
            // placeholder until the server-broadcast row replaces it.
            setReactions([
                ...reactions,
                {
                    id: -1,
                    emoji: selectedEmoji,
                    sender: myself,
                    tsSent: getLocalCurrentTimestamp(),
                },
            ]);
            void channelService
                .react(v3MessageId, v3ChannelId, channelKind, selectedEmoji)
                .catch((e) => {
                    console.error("[MessageBubble] react failed:", e);
                    notifyActionError(e);
                });
        }
        setSelectedEmoji(null);
    }, [selectedEmoji]);

    // Same chip-count rules as `BubbleUnderBar` — kept in sync because
    // this drives the bubble's `minWidth` calc (so an empty bubble
    // doesn't reserve space for a chip that never renders, and a
    // chip-bearing bubble has enough room for "X comments").
    // For PM task headers the chip shows the task's LIVE comment count
    // (`taskCommentCount`), not `reply_count` — `reply_count` counts
    // every thread reply and so over-/under-counts vs the Comments tab.
    // Fall back to `numReplies` only for pre-change cached rows.
    let numRepliesWithoutFirstMessage: number;
    if (chat.chatType === 3) {
        numRepliesWithoutFirstMessage = message.taskCommentCount ?? message.numReplies ?? 0;
    } else {
        numRepliesWithoutFirstMessage = message.numReplies;
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
            {/* Quick emoji reaction - kept visible for fast access.
                (The old `isScrolling !== true` gate is gone: the list
                suppresses pointer events on rows while scrolling, so
                the hover that summons this toolbar can't fire then.) */}
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
                setUnwrapAll={setUnwrapAll}
                setUnwrapCode={setUnwrapCode}
                socket={socket}
                unwrapAll={unwrapAll}
                unwrapCode={unwrapCode}
                useCM={useCM}
                usePM={usePM}
                useTM={useTM}
                onMenuOpenChange={setIsMoreMenuOpen}
            />
        </Stack>
    );

    // A balloon with an attachment has no frame or hover of its own (as before).
    if (!isCompact && message.attachment) {
        return (
            <Box
                sx={balloonWrapperSx(
                    chat.chatType,
                    isSimpleBubble,
                    numRepliesWithoutFirstMessage,
                    uniqueReactionEmojiCount
                )}
            >
                <BubbleAttachmentSheet
                    fileName={message.attachment.fileName}
                    fileSize={message.attachment.size}
                    isSent={isSent}
                />
            </Box>
        );
    }

    const userName = (simple: boolean) => (
        <BubbleUserName
            chatType={chat.chatType}
            displayId={message.displayId}
            dtSent={dtSent}
            isSent={isSent}
            isSimpleBubble={simple}
            isThread={false}
            sender={message.sender}
            taskId={message.taskId}
            taskStatus={message.taskStatus}
            tsSent={message.tsSent}
            tsUpdated={message.tsUpdated}
        />
    );

    // The hint wraps the BODY in both looks (it used to wrap the whole balloon
    // in the bubble look, so it also showed over the padding and the name).
    // In the bubble look a click on the body of a task card also opens the
    // task, before the balloon's own click handling, as before.
    const body = message.attachment ? (
        <BubbleAttachmentSheet
            fileName={message.attachment.fileName}
            fileSize={message.attachment.size}
            isSent={isSent}
        />
    ) : message.content && message.content.length > 0 ? (
        <AppTooltip
            enterDelay={1000}
            placement="right"
            suppressed={isMoreMenuOpen}
            title={
                <>
                    {chat.chatType === 3 ? t.chat.bubble.clickToOpenTask : null}
                    {chat.chatType === 3 ? <br /> : null}
                    {fmt(t.chat.bubble.clickToOpenThread, { modKey: threadClickModifier() })}
                </>
            }
        >
            <Clickable
                className={previewWrapClassName || undefined}
                sx={isCompact ? undefined : { cursor: message.taskId ? "pointer" : "default" }}
                onActivate={
                    isCompact
                        ? undefined
                        : () => {
                              // A click on a task card's body is "open this task"
                              // (MIP-1422): it ASKS for the pane, not just selects
                              // the task, because on the chat page a selection
                              // alone never opens it. A real task only.
                              if (isRealTaskId(message.taskId)) {
                                  useCM.setIsMainChatVisible(true);
                                  useCM.setIsThreadVisible(false);
                                  useTM.setIsCreatingTask((prev) => ({
                                      ...prev,
                                      flag: false,
                                  }));
                                  useTM.setCurrentPreviewTaskId(message.taskId);
                                  useTM.setIsTaskPreviewVisible(true);
                              }
                          }
                }
            >
                <MessageBody
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
            </Clickable>
        </AppTooltip>
    ) : null;

    // Compact: a grouped follow-up has no author line, only an empty avatar
    // column. Bubble: it shows the author line only while hovered.
    const header = isCompact
        ? isSimpleBubble
            ? undefined
            : userName(false)
        : isSimpleBubble
          ? showUnderBarOption
              ? userName(true)
              : undefined
          : userName(false);
    const avatar = hideAvatarSlot ? undefined : isSimpleBubble ? (
        isCompact ? (
            "reserve"
        ) : undefined
    ) : (
        <UserAvatar
            fallbackName={isSent ? myself.userName : message.sender.userName}
            userId={isSent ? myself.userId : message.sender.userId}
        />
    );

    return (
        <Bubble
            actions={showUnderBarOption ? BubbleActions() : undefined}
            actionsOpen={showUnderBarOption}
            avatar={avatar}
            bodyOffset={isCompact ? 0.25 : 0.5}
            emphasis={isFocused}
            footerOffset={0}
            grouped={isSimpleBubble}
            header={header}
            layout={isCompact ? "compact" : "bubble"}
            narrowBody="beside"
            rootRef={bubbleRef}
            side={isSent ? "sent" : "received"}
            toolbarRef={toolbarRef}
            footer={
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
            }
            overlay={
                emojiPickerPositionCalculated === true && (
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
                )
            }
            wrapperSx={balloonWrapperSx(
                chat.chatType,
                isSimpleBubble,
                numRepliesWithoutFirstMessage,
                uniqueReactionEmojiCount
            )}
            interactive
            suppressTouchCallout
            onClick={handleMessageClick}
            onDoubleClick={doubleClickTodoEnabled ? handleAddMessageToToDo : undefined}
            onMouseEnter={() => setShowUnderBarOption(true)}
            onMouseLeave={() => setShowUnderBarOption(false)}
            onTouchCancel={longPress.onTouchCancel}
            onTouchEnd={longPress.onTouchEnd}
            onTouchMove={longPress.onTouchMove}
            onTouchStart={longPress.onTouchStart}
        >
            {body}
        </Bubble>
    );
};

// The balloon's width limits (task cards are wide, a bare message is narrow,
// reactions widen it). A module function so a hot row does not rebuild the
// calculation inline.
const balloonWrapperSx = (
    chatType: number,
    isSimpleBubble: boolean,
    numReplies: number,
    uniqueReactionEmojiCount: number
) =>
    ({
        maxWidth: "90%",
        minWidth:
            chatType === 3
                ? 500
                : (isSimpleBubble ? (numReplies > 0 ? 150 : 100) : 200) +
                  (uniqueReactionEmojiCount < 10 ? uniqueReactionEmojiCount * 20 : 310),
        whiteSpace: "normal",
        wordBreak: "break-word",
    }) as const;

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
// `message` is compared by reference — the identity-caching adapter
// (`createCachedMessagesAdapter`) reuses the same object for a row until
// its content or flag bit actually changes, so a real change produces a
// new reference and an untouched row keeps its old one.
//
// `chat` is compared by its render-affecting FIELDS, not by reference:
// the live-update bridge patches `currentMainChat` with `{...prev,
// messages}` on every arrival, so the chat object's identity changes
// whenever ANY message in the channel changes — a reference compare
// here re-rendered every visible bubble (each mounting a BlockNote
// view) per incoming event. The bubble reads only chatId / chatType /
// chatName / dmPartnerUser off `chat` (never `chat.messages`), and all
// four are carried over by the patch spread, so field equality is
// exact. Primitives (`variant`, `isFocused`, `isSimpleBubble`) and
// `myself.userId` cover the remaining render-affecting state.
// `isScrolling` is deliberately NOT a prop anymore: it flipped on every
// scroll start/stop and re-rendered every visible bubble twice per
// gesture — scroll-time hover suppression now lives on the row wrapper
// in `MessageListRenderer`.
const areEqual = (prev: MessageBubbleProps, next: MessageBubbleProps): boolean =>
    prev.message === next.message &&
    prev.chat.chatId === next.chat.chatId &&
    prev.chat.chatType === next.chat.chatType &&
    prev.chat.chatName === next.chat.chatName &&
    prev.chat.dmPartnerUser === next.chat.dmPartnerUser &&
    prev.variant === next.variant &&
    prev.isFocused === next.isFocused &&
    prev.isSimpleBubble === next.isSimpleBubble &&
    prev.myself.userId === next.myself.userId;

export const MessageBubble = memo(MessageBubbleImpl, areEqual);
