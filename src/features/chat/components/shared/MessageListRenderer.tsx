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

        let numRepliesWithoutFirstMessage: number;

        if (chat.chatType === 3 || isThread) {
            numRepliesWithoutFirstMessage = (message as MessageProps).numReplies;
        } else if (chat.chatType !== 3) {
            numRepliesWithoutFirstMessage = (message as MessageProps).numReplies - 1;
        } else {
            numRepliesWithoutFirstMessage = 0;
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

    const getFocusedState = (message: MessageProps | ThreadMessageProps) => {
        if (isThread) {
            // For thread messages, check against currentThreadChat's moveToSpecificIndex
            return (
                (message as ThreadMessageProps).messageIdWithChatIdAndThreadId ===
                useCM.currentThreadChat?.moveToSpecificIndex
            );
        }
        return (
            (message as MessageProps).messageIdWithChatId ===
                useCM.currentMainChat?.moveToSpecificIndex ||
            (useCM.isThreadVisible &&
                useCM.currentThreadChat &&
                message.messageId === useCM.currentThreadChat.threadId) ||
            false
        );
    };

    return (
        <Box sx={{ px: 0.3, my: 0.2 }}>
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
                style={{ height }}
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
