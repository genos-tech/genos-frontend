import { Box, Chip, Stack, useColorScheme } from "@mui/joy";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../../../types/chat";
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

    const renderDateSeparator = (index: number) => {
        if (
            index === 0 ||
            extractYYYYMMDD(messages[index - 1].tsSent) !== extractYYYYMMDD(messages[index].tsSent)
        ) {
            return (
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
                                {extractMMDD(messages[index].tsSent)}
                            </span>
                        </Chip>
                    </div>
                </div>
            );
        }
        return null;
    };

    const calculateIsSimpleBubble = (
        index: number,
        message: MessageProps | ThreadMessageProps
    ) => {
        if (index > 0) {
            const limitSeconds: number = 600;
            const prevMessage = messages[index - 1];
            return (
                prevMessage.sender.userId === message.sender.userId &&
                getTimeDiffSeconds(prevMessage.tsSent, message.tsSent) < limitSeconds &&
                (isThread || chat.chatType !== 3)
            );
        }
        return false;
    };

    const calculatePadding = (index: number, message: MessageProps | ThreadMessageProps) => {
        const paddingTop = 0.3;
        let paddingBottom = 0.3;

        // Mirror BubbleUnderBar's chip-count rules so the reserved
        // bottom padding stays in sync with whether a chip will
        // actually render. PM bubbles surface task comments rather
        // than thread replies; thread bubbles still use numReplies
        // (the chip is gated off in-thread anyway).
        let numRepliesWithoutFirstMessage: number;

        if (isThread) {
            numRepliesWithoutFirstMessage = (message as MessageProps).numReplies;
        } else if (chat.chatType === 3) {
            numRepliesWithoutFirstMessage = (message as MessageProps).taskCommentCount ?? 0;
        } else {
            numRepliesWithoutFirstMessage = (message as MessageProps).numReplies - 1;
        }

        if (
            (message as MessageProps).reactions &&
            (message as MessageProps).reactions!.length > 0
        ) {
            paddingBottom = paddingBottom + 2.5;
        } else if (numRepliesWithoutFirstMessage > 0) {
            paddingBottom = paddingBottom + 2.5;
        }

        if (index === messages.length - 1) {
            paddingBottom = paddingBottom + 3;
        }

        return { paddingTop, paddingBottom };
    };

    const getFocusedState = (
        message: MessageProps | ThreadMessageProps
    ): "focused" | "threadActive" | false => {
        if (isThread) {
            if (
                (message as ThreadMessageProps).messageIdWithChatIdAndThreadId ===
                useCM.currentThreadChat?.moveToSpecificIndex
            ) {
                return "focused";
            }
            return false;
        }
        if (
            (message as MessageProps).messageIdWithChatId ===
            useCM.currentMainChat?.moveToSpecificIndex
        ) {
            return "focused";
        }
        if (
            useCM.isThreadVisible &&
            useCM.currentThreadChat &&
            message.messageId === useCM.currentThreadChat.threadId
        ) {
            return "threadActive";
        }
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
                    const isFocused = getFocusedState(message);
                    const dateSeparator = renderDateSeparator(index);
                    const isSimpleBubble = calculateIsSimpleBubble(index, message);
                    const { paddingTop, paddingBottom } = calculatePadding(index, message);

                    return (
                        <div>
                            {dateSeparator}
                            <Stack
                                direction="row"
                                spacing={2}
                                sx={{
                                    flexDirection: isYou ? "row-reverse" : "row",
                                    paddingTop: paddingTop,
                                    paddingBottom: paddingBottom,
                                    paddingX: 1,
                                }}
                            >
                                {isThread ? (
                                    <ThreadMessageBubble
                                        useCM={useCM}
                                        currentMessageIndex={index}
                                        isFocused={isFocused}
                                        isScrolling={isScrolling}
                                        isSimpleBubble={isSimpleBubble}
                                        message={message as ThreadMessageProps}
                                        myself={myself}
                                        setEditTargetMessage={setEditTargetMessage}
                                        setIsInEdit={setIsInEdit}
                                        setMyself={setMyself}
                                        setTargetMessageIndex={() => {}}
                                        socket={socket}
                                        useTEM={useTEM}
                                        thread={chat as ThreadProps}
                                        useUISM={useUISM}
                                        variant={isYou ? "sent" : "received"}
                                    />
                                ) : (
                                    <MessageBubble
                                        chat={chat as ChatProps}
                                        useCM={useCM}
                                        isFocused={isFocused}
                                        isScrolling={isScrolling}
                                        isSimpleBubble={isSimpleBubble}
                                        message={message as MessageProps}
                                        myself={myself}
                                        usePM={usePM}
                                        setEditTargetMessage={setEditTargetMessage}
                                        setIsInEdit={setIsInEdit}
                                        setMyself={setMyself}
                                        socket={socket}
                                        useTEM={useTEM}
                                        useUISM={useUISM}
                                        variant={isYou ? "sent" : "received"}
                                        useTM={useTM}
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
