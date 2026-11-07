import { memo, useEffect, useRef, useState } from "react";
import { Box, Stack } from "@mui/joy";
import { useNavigate } from "react-router-dom";
import { Socket } from "socket.io-client";

import { MessageBody } from "../../../../components/messageBody/MessageBody";
import { UserAvatar } from "../../../../components/ui/avatars/UserAvatar";
import { Bubble } from "../../../../components/ui/bubble";
import { EmojiPicker } from "../../../../components/ui/emoji/EmojiPicker";
import { EmojiReaction } from "../../../../components/ui/emoji/EmojiReaction";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { useBubbleStylePreference } from "../../../../hooks/common/useBubbleStylePreference";
import { useDoubleClickTodoPreference } from "../../../../hooks/common/useDoubleClickTodoPreference";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { channelService } from "../../../../services/channel/channelService";
import { notifyActionError } from "../../../../services/requestErrorNotifier";
import { UserProps } from "../../../../types/admin";
import { ChannelKind } from "../../../../types/channel";
import { MessageProps, ThreadMessageProps, ThreadProps } from "../../../../types/chat";
import { ReactionProps } from "../../../../types/common";
import { TaskCommentProps } from "../../../../types/tasks";
import { extractYYYYMMDDHHMM, getLocalCurrentTimestamp } from "../../../../utils/dateUtils";
import { BubbleAttachmentSheet } from "./BubbleAttachmentSheet";
import { BubbleThreadMoreMenu } from "./BubbleThreadMoreMenu";
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

type threadMessageBubbleProps = {
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    thread: ThreadProps;
    variant: "sent" | "received";
    message: ThreadMessageProps;
    isFocused: "focused" | "threadActive" | false;
    isSimpleBubble: boolean;
    useUISM: UIStateManagementState;
    setIsInEdit: (value: boolean) => void;
    setEditTargetMessage: (value: ThreadMessageProps) => void;
    currentMessageIndex: number;
    setTargetMessageIndex: (value: number) => void;
    useCM: ChatManagementState;
    setTodoFromMessageBubble: (
        todoFromMessageBubble: MessageProps | ThreadMessageProps | TaskCommentProps
    ) => void;
};

const ThreadMessageBubbleImpl = (props: threadMessageBubbleProps) => {
    const {
        useTEM,
        myself,
        setMyself,
        socket,
        thread,
        variant,
        message,
        isFocused,
        isSimpleBubble,
        useUISM,
        setIsInEdit,
        setEditTargetMessage,
        currentMessageIndex,
        setTargetMessageIndex,
        useCM,
        setTodoFromMessageBubble,
    } = props;

    const { accessToken } = useAuth();
    const navigate = useNavigate();
    const isSent = variant === "sent";
    const dtSent = extractYYYYMMDDHHMM(message.tsSent);
    const { style } = useBubbleStylePreference();
    const isCompact = style === "compact";
    const { enabled: doubleClickTodoEnabled } = useDoubleClickTodoPreference();
    const isSystemUser = message.sender.isSystemUser === true;

    // Handle thread message click to update URL and focus
    const handleMessageClick = () => {
        const typePath = CHAT_TYPE_PATH[thread.chatType];
        if (typePath) {
            // Update URL
            const threadId =
                thread.chatType === 3 && thread.taskId ? thread.taskId : thread.threadId;
            navigate(
                `/workspace/chat/${typePath}/${thread.chatId}/thread/${threadId}/message/${message.messageId}`
            );

            // v3 `moveToSpecificIndex` is the thread reply's v3 UUID
            // — matches `messageIdWithChatIdAndThreadId` on the bubble
            // so `MessageListRenderer.resolveFocusedState` returns
            // "focused" for the clicked row. The legacy
            // `{chatId}-{threadId}-{messageId}` composite is gone.
            //
            // Uses the functional updater so the latest
            // `currentThreadChat` is read at call time — required for
            // downstream React.memo on this bubble to be safe.
            const newMoveIndex = message.messageIdWithChatIdAndThreadId;
            if (!newMoveIndex) return;
            useCM.setCurrentThreadChat((prev) => {
                if (!prev || prev.moveToSpecificIndex === newMoveIndex) return prev;
                return { ...prev, moveToSpecificIndex: newMoveIndex };
            });
        }
    };

    // Reaction handling
    const [isHovered, setIsHovered] = useState(false);
    // While the More menu — or a dialog it opened — is on screen, keep the
    // toolbar mounted after the cursor leaves the bubble. Same lock as
    // `MessageBubble.isMoreMenuOpen`, and for the same reason: without it
    // the hover state flips false and unmounts the menu (or its dialog)
    // out from under the user.
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
    const showUnderBarOption = isHovered || isMoreMenuOpen;
    const [reactions, setReactions] = useState<ReactionProps[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
    const [selectedEmoji, setSelectedEmoji] = useState<any>(null);
    const [uniqueReactionEmojiCount, setUniqueReactionEmojiCount] = useState<number>(0);
    // Per-bubble wrap toggles. Same pattern as `MessageBubble`.
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

    useEffect(() => {
        if (selectedEmoji === null) return;
        // v3 cutover. The legacy multi-emit `message_reaction` path
        // (one for the reply itself + a synthetic mirror at
        // messageId === 1 → the parent thread root, scoped per non-PM
        // kind) collapses to one `channelService.react / .unreact`
        // call against the reply's v3 UUID. The v3 backend's
        // `reaction.added` / `.removed` broadcast covers the visible
        // reply chip + the parent's reply-count chip off a single
        // Message row.
        //
        // `messageIdWithChatIdAndThreadId` is the v3 message UUID,
        // set by `v3ThreadMessageToLegacy`.
        const v3MessageId = message.messageIdWithChatIdAndThreadId;
        if (!v3MessageId) {
            setSelectedEmoji(null);
            return;
        }
        const v3ChannelId = message.chatId as unknown as string;
        const channelKind = thread.chatType as ChannelKind;
        const existingIndex = reactions.findIndex(
            (r) => r.emoji === selectedEmoji && r.sender.userId === myself.userId
        );
        if (existingIndex !== -1) {
            setReactions(reactions.filter((_, idx) => idx !== existingIndex));
            void channelService
                .unreact(v3MessageId, v3ChannelId, channelKind, selectedEmoji)
                .catch((e) => {
                    console.error("[ThreadMessageBubble] unreact failed:", e);
                    notifyActionError(e);
                });
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
            void channelService
                .react(v3MessageId, v3ChannelId, channelKind, selectedEmoji)
                .catch((e) => {
                    console.error("[ThreadMessageBubble] react failed:", e);
                    notifyActionError(e);
                });
        }
        setSelectedEmoji(null);
    }, [selectedEmoji]);

    // Thread bubble action buttons - consolidated into a single "More" menu.
    //
    // CALLED as `BubbleActions()` below, never rendered as a JSX element:
    // an inline component is a NEW type on every render, so React would
    // unmount and rebuild this subtree — menu, open dialog and all — each
    // time the bubble re-rendered. Calling it inlines the elements into this
    // component's tree instead, which is what lets a dialog opened from the
    // menu survive the hover state change that follows the cursor leaving.
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
                    chatName={thread.chatName}
                    chatType={thread.chatType}
                    dmPartnerUser={thread.dmPartnerUser}
                    isThread={true}
                    message={message}
                    myself={myself}
                    numReplies={0}
                    reactions={reactions}
                    setReactions={setReactions}
                    setShowEmojiPicker={setShowEmojiPicker}
                    setUniqueReactionEmojiCount={setUniqueReactionEmojiCount}
                    showUnderBarOption={showUnderBarOption}
                    socket={socket}
                />
            </Box>

            {/* Consolidated "More" menu with all other actions */}
            <BubbleThreadMoreMenu
                accessToken={accessToken}
                currentMessageIndex={currentMessageIndex}
                flaggedMessages={useCM.flaggedMessages}
                isSent={isSent}
                message={message}
                myself={myself}
                setCurrentThreadChat={useCM.setCurrentThreadChat}
                setEditTargetMessage={setEditTargetMessage}
                setFlaggedMessages={useCM.setFlaggedMessages}
                setIsInEdit={setIsInEdit}
                setTargetMessageIndex={setTargetMessageIndex}
                setUnwrapAll={setUnwrapAll}
                setUnwrapCode={setUnwrapCode}
                socket={socket}
                thread={thread}
                unwrapAll={unwrapAll}
                unwrapCode={unwrapCode}
                useCM={useCM}
                onMenuOpenChange={setIsMoreMenuOpen}
            />
        </Stack>
    );

    // A balloon with an attachment has no frame or hover of its own (as before).
    if (!isCompact && message.attachment) {
        return (
            <Box sx={balloonWrapperSx(isSimpleBubble, uniqueReactionEmojiCount)}>
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
            chatType={thread.chatType}
            displayId={thread.displayId}
            dtSent={dtSent}
            isSent={isSent}
            isSimpleBubble={simple}
            isThread={true}
            sender={message.sender}
            taskId={thread.taskId}
            taskStatus={null}
            tsSent={message.tsSent}
            tsUpdated={message.tsUpdated}
        />
    );

    const attachment = message.attachment ? (
        <BubbleAttachmentSheet
            fileName={message.attachment.fileName}
            fileSize={message.attachment.size}
            isSent={isSent}
        />
    ) : null;

    const body =
        attachment ??
        (message.content.length > 0 ? (
            <Box className={previewWrapClassName || undefined}>
                <MessageBody
                    key={`${thread.chatId}-${thread.threadId}-${message.messageId}-${thread.chatType}-${message.tsUpdated}`}
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
        ) : null);

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
    const avatar = isSystemUser ? undefined : isSimpleBubble ? (
        isCompact ? (
            "reserve"
        ) : undefined
    ) : (
        <UserAvatar userId={isSent ? myself.userId : message.sender.userId} />
    );

    return (
        <Bubble
            actions={BubbleActions()}
            actionsOpen={showUnderBarOption}
            avatar={avatar}
            bodyOffset={isCompact ? 0.25 : 0.5}
            emphasis={isFocused}
            footerOffset={0}
            grouped={isSimpleBubble}
            header={header}
            layout={isCompact ? "compact" : "bubble"}
            rootRef={bubbleRef}
            side={isSent ? "sent" : "received"}
            toolbarRef={toolbarRef}
            wrapperSx={balloonWrapperSx(isSimpleBubble, uniqueReactionEmojiCount)}
            footer={
                <BubbleUnderBar
                    chatName={thread.chatName}
                    chatType={thread.chatType}
                    dmPartnerUser={thread.dmPartnerUser}
                    isThread={true}
                    message={message}
                    myself={myself}
                    numReplies={0}
                    reactions={reactions}
                    setReactions={setReactions}
                    setShowEmojiPicker={setShowEmojiPicker}
                    setUniqueReactionEmojiCount={setUniqueReactionEmojiCount}
                    showUnderBarOption={showUnderBarOption}
                    socket={socket}
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
            interactive
            onClick={handleMessageClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onDoubleClick={
                doubleClickTodoEnabled
                    ? () => {
                          setTodoFromMessageBubble(message);
                      }
                    : undefined
            }
        >
            {body}
        </Bubble>
    );
};

// The balloon's width limits. A module function so the object is built once per
// distinct input, not on every render of a hot row.
const balloonWrapperSx = (isSimpleBubble: boolean, uniqueReactionEmojiCount: number) =>
    ({
        maxWidth: "90%",
        minWidth:
            (isSimpleBubble ? 100 : 200) +
            (uniqueReactionEmojiCount < 10 ? uniqueReactionEmojiCount * 20 : 310),
        whiteSpace: "normal",
        wordBreak: "break-word",
    }) as const;

// Memoized export. See MessageBubble.tsx for the rationale on which props
// the comparator considers — same reasoning applies here. `thread` plays
// the role of `chat` for thread context and, like `chat` there, is
// compared by its render-affecting fields (this component reads only
// chatId / threadId / chatType / chatName / dmPartnerUser / taskId /
// displayId off it, never `thread.messages`) — the live-update bridge
// gives the thread object a new identity on every reply arrival, so a
// reference compare re-rendered every visible reply bubble per event.
const areEqual = (prev: threadMessageBubbleProps, next: threadMessageBubbleProps): boolean =>
    prev.message === next.message &&
    prev.thread.chatId === next.thread.chatId &&
    prev.thread.threadId === next.thread.threadId &&
    prev.thread.chatType === next.thread.chatType &&
    prev.thread.chatName === next.thread.chatName &&
    prev.thread.dmPartnerUser === next.thread.dmPartnerUser &&
    prev.thread.taskId === next.thread.taskId &&
    prev.thread.displayId === next.thread.displayId &&
    prev.variant === next.variant &&
    prev.isFocused === next.isFocused &&
    prev.isSimpleBubble === next.isSimpleBubble &&
    prev.currentMessageIndex === next.currentMessageIndex &&
    prev.myself.userId === next.myself.userId;

export const ThreadMessageBubble = memo(ThreadMessageBubbleImpl, areEqual);
