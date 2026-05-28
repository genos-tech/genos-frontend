import { useMemo } from "react";
import { Box, Chip, Stack, useColorScheme } from "@mui/joy";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { useBubbleStylePreference } from "../../../../hooks/common/useBubbleStylePreference";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../../../types/chat";
import { TaskCommentProps } from "../../../../types/tasks";
import { extractMMDD, extractYYYYMMDD, getTimeDiffSeconds } from "../../../../utils/dateUtils";
import { useScrollToBottomOnChatChange } from "../../hooks/messageBubbleHooks";
import { handleAtTop } from "../../services/handleBubblePositionAction";
import { MessageBubble } from "../bubbles/MessageBubble";
import { ThreadMessageBubble } from "../bubbles/ThreadMessageBubble";

interface MessageListRendererProps {
    chat: ChatProps | ThreadProps;
    currentChatId: number;
    height: number;
    indexMap?: { [k: string]: any };
    isScrolling: boolean;
    isThread: boolean;
    messages: MessageProps[] | ThreadMessageProps[];
    myself: UserProps;
    usePM: ProjectManagementState;
    setEditTargetMessage: (message: MessageProps | ThreadMessageProps) => void;
    setErrorMessage: (error: string) => void;
    setErrorOpen: (open: boolean) => void;
    setIsInEdit: (value: boolean) => void;
    setIsScrolling: (value: boolean) => void;
    setMyself: (value: UserProps) => void;
    useUISM: UIStateManagementState;
    setVisibleRange: (range: { startIndex: number; endIndex: number }) => void;
    socket: Socket | null;
    useTEM: TeamManagementState;
    visibleRange: { startIndex: number; endIndex: number };
    virtuosoRef: React.RefObject<VirtuosoHandle>;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    /** When true, ignore `height` and let Virtuoso fill the parent flex
     * column instead. Used by editor-less surfaces (e.g. PM thread's
     * "Activities" tab) where there's no bottom panel to subtract from
     * the calculated height — the parent's `flex: 1, minHeight: 0`
     * already does that work. */
    fillContainer?: boolean;
    setTodoFromMessageBubble: (
        todoFromMessageBubble: MessageProps | ThreadMessageProps | TaskCommentProps
    ) => void;
}

export const MessageListRenderer = ({
    chat,
    currentChatId,
    height,
    indexMap,
    isScrolling,
    isThread,
    messages,
    myself,
    usePM,
    setEditTargetMessage,
    setErrorMessage,
    setErrorOpen,
    setIsInEdit,
    setIsScrolling,
    setMyself,
    useUISM,
    setVisibleRange,
    socket,
    useTEM,
    visibleRange,
    virtuosoRef,
    useCM,
    useTM,
    fillContainer = false,
    setTodoFromMessageBubble,
}: MessageListRendererProps) => {
    useScrollToBottomOnChatChange(
        virtuosoRef,
        currentChatId,
        visibleRange.startIndex,
        visibleRange.endIndex,
        messages.length - 1,
        indexMap,
        useCM.currentMainChat?.moveToSpecificIndex,
        useCM.currentMainChat?.notMove,
        setErrorMessage,
        setErrorOpen
    );

    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { style: bubbleStyle } = useBubbleStylePreference();
    const isCompact = bubbleStyle === "compact";

    // Pre-compute every per-row datum in a single O(N) pass instead of doing
    // it per-bubble inside `itemContent`. Virtuoso re-invokes `itemContent`
    // for every visible cell on each scroll tick / context change — repeating
    // these computations there meant 20–30× redundant string parsing and
    // array lookups per frame on a 1k-message chat.
    type ItemMeta = {
        showDateSeparator: boolean;
        dateLabel: string;
        isSimpleBubble: boolean;
        paddingTop: number;
        paddingBottom: number;
    };
    const itemMetas = useMemo<ItemMeta[]>(() => {
        const out = new Array<ItemMeta>(messages.length);
        const simpleBubbleWindowSecs = 600;
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const prev = i > 0 ? messages[i - 1] : null;

            const currentDate = extractYYYYMMDD(msg.tsSent);
            const showDateSeparator =
                prev === null || extractYYYYMMDD(prev.tsSent) !== currentDate;
            const dateLabel = showDateSeparator ? extractMMDD(msg.tsSent) : "";

            const isSimpleBubble =
                prev !== null &&
                prev.sender.userId === msg.sender.userId &&
                getTimeDiffSeconds(prev.tsSent, msg.tsSent) < simpleBubbleWindowSecs &&
                (isThread || chat.chatType !== 3);

            let paddingBottom = 0.3;
            if (i === messages.length - 1) paddingBottom += 3;

            out[i] = {
                dateLabel,
                isSimpleBubble,
                paddingBottom,
                paddingTop: 0.3,
                showDateSeparator,
            };
        }
        return out;
    }, [messages, isThread, chat.chatType, isCompact]);

    // Focus-state inputs change when the user clicks a thread or follows a
    // jump-to-message link, but they're independent of `messages`. Compute
    // the two keys once per context change, then resolve per-row in O(1).
    const focusKey: string | null = useMemo(
        () =>
            isThread
                ? (useCM.currentThreadChat?.moveToSpecificIndex ?? null)
                : (useCM.currentMainChat?.moveToSpecificIndex ?? null),
        [
            isThread,
            useCM.currentThreadChat?.moveToSpecificIndex,
            useCM.currentMainChat?.moveToSpecificIndex,
        ]
    );
    const threadActiveTarget = useMemo<{
        threadId: number | null | undefined;
        taskId: number | null | undefined;
    } | null>(() => {
        if (isThread) return null;
        if (!useCM.isThreadVisible || !useCM.currentThreadChat) return null;
        return {
            taskId: useCM.currentThreadChat.taskId,
            threadId: useCM.currentThreadChat.threadId,
        };
    }, [isThread, useCM.isThreadVisible, useCM.currentThreadChat]);

    const resolveFocusedState = (
        message: MessageProps | ThreadMessageProps
    ): "focused" | "threadActive" | false => {
        const messageKey = isThread
            ? (message as ThreadMessageProps).messageIdWithChatIdAndThreadId
            : (message as MessageProps).messageIdWithChatId;
        if (messageKey === focusKey) return "focused";
        if (!threadActiveTarget) return false;
        if (chat.chatType === 3) {
            const taskId = (message as MessageProps).taskId;
            if (taskId && threadActiveTarget.taskId && taskId === threadActiveTarget.taskId) {
                return "threadActive";
            }
            return false;
        }
        if (message.messageId === threadActiveTarget.threadId) return "threadActive";
        return false;
    };

    // When `fillContainer` is set, the surrounding Sheet uses
    // `flex: 1` so we let Virtuoso flex into the available height
    // instead of relying on the magic-number `height` prop. Both modes
    // need to coexist because the same renderer is used for the main
    // chat (fixed-height calc, header + editor below) and for the
    // editor-less PM activities thread (full flex).
    const wrapperSx = fillContainer
        ? ({
              px: 0.3,
              my: 0.2,
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
          } as const)
        : ({ px: 0.3, my: 0.2 } as const);
    const virtuosoStyle: React.CSSProperties = fillContainer
        ? { flex: 1, minHeight: 0 }
        : { height };

    return (
        <Box sx={wrapperSx}>
            <Virtuoso
                key={bubbleStyle}
                ref={virtuosoRef}
                atBottomThreshold={128}
                atTopStateChange={handleAtTop}
                atTopThreshold={64}
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                context={{ isScrolling }}
                initialTopMostItemIndex={messages.length - 1}
                isScrolling={setIsScrolling}
                rangeChanged={setVisibleRange}
                style={virtuosoStyle}
                totalCount={messages.length}
                itemContent={(index, _, { isScrolling }) => {
                    const message = messages[index];
                    const isYou = myself.userId === message.sender.userId;
                    const isFocused = resolveFocusedState(message);
                    const meta = itemMetas[index];
                    const dateSeparator = meta.showDateSeparator ? (
                        <div style={{ padding: "0.5rem 0" }}>
                            <div style={{ textAlign: "center", fontWeight: 300 }}>
                                <Chip variant="soft">
                                    <span
                                        style={{
                                            backgroundColor: "var(--alt-background)",
                                            border: "1px solid var(--border)",
                                            padding: "0.1rem 2rem",
                                            borderRadius: "0.5rem",
                                        }}
                                    >
                                        {meta.dateLabel}
                                    </span>
                                </Chip>
                            </div>
                        </div>
                    ) : null;

                    return (
                        <div>
                            {dateSeparator}
                            <Stack
                                direction="row"
                                spacing={isCompact ? 0 : 2}
                                sx={{
                                    flexDirection: isCompact
                                        ? "row"
                                        : isYou
                                          ? "row-reverse"
                                          : "row",
                                    paddingTop: meta.paddingTop,
                                    paddingBottom: meta.paddingBottom,
                                    paddingX: isCompact ? 0 : 1,
                                }}
                            >
                                {isThread ? (
                                    <ThreadMessageBubble
                                        currentMessageIndex={index}
                                        isFocused={isFocused}
                                        isScrolling={isScrolling}
                                        isSimpleBubble={meta.isSimpleBubble}
                                        message={message as ThreadMessageProps}
                                        myself={myself}
                                        setEditTargetMessage={setEditTargetMessage}
                                        setIsInEdit={setIsInEdit}
                                        setMyself={setMyself}
                                        setTargetMessageIndex={() => {}}
                                        setTodoFromMessageBubble={setTodoFromMessageBubble}
                                        socket={socket}
                                        thread={chat as ThreadProps}
                                        useCM={useCM}
                                        useTEM={useTEM}
                                        useUISM={useUISM}
                                        variant={isYou ? "sent" : "received"}
                                    />
                                ) : (
                                    <MessageBubble
                                        chat={chat as ChatProps}
                                        isFocused={isFocused}
                                        isScrolling={isScrolling}
                                        isSimpleBubble={meta.isSimpleBubble}
                                        message={message as MessageProps}
                                        myself={myself}
                                        setEditTargetMessage={setEditTargetMessage}
                                        setIsInEdit={setIsInEdit}
                                        setMyself={setMyself}
                                        setTodoFromMessageBubble={setTodoFromMessageBubble}
                                        socket={socket}
                                        useCM={useCM}
                                        usePM={usePM}
                                        useTEM={useTEM}
                                        useTM={useTM}
                                        useUISM={useUISM}
                                        variant={isYou ? "sent" : "received"}
                                    />
                                )}
                            </Stack>
                        </div>
                    );
                }}
            />
        </Box>
    );
};
