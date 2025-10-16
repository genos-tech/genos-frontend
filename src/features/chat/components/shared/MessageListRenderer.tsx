import { Box, Chip, Stack } from "@mui/joy";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { UserProps } from "../../../../types/admin";
import {
    ChatProps,
    FlaggedMessageProps,
    MessageProps,
    ThreadMessageProps,
    ThreadProps,
} from "../../../../types/chat";
import { ProjectProps, TaskProps } from "../../../../types/tasks";
import { extractMMDD, extractYYYYMMDD, getTimeDiffSeconds } from "../../../../utils/dateUtils";
import { useScrollToBottomOnChatChange } from "../../hooks/messageBubbleHooks";
import { handleAtTop } from "../../services/handleBubblePositionAction";
import { MessageBubble } from "../bubbles/MessageBubble";
import { ThreadMessageBubble } from "../bubbles/ThreadMessageBubble";

interface MessageListRendererProps {
    virtuosoRef: React.RefObject<VirtuosoHandle>;
    messages: (MessageProps | ThreadMessageProps)[];
    chat: ChatProps | ThreadProps;
    myself: UserProps;
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    currentChatId: number;
    visibleRange: { startIndex: number; endIndex: number };
    setVisibleRange: (range: { startIndex: number; endIndex: number }) => void;
    isScrolling: boolean;
    setIsScrolling: (scrolling: boolean) => void;
    indexMap?: { [k: string]: any };
    moveToSpecificIndex?: string;
    notMove?: boolean;
    setErrorMessage: (message: string) => void;
    setErrorOpen: (open: boolean) => void;
    flaggedMessages: FlaggedMessageProps[];
    setFlaggedMessages: (messages: FlaggedMessageProps[]) => void;
    isCreatingTask: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    };
    setIsCreatingTask: (value: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    }) => void;
    setCurrentPreviewTask: (task: TaskProps | undefined) => void;
    setCurrentPreviewTaskId: (id: number) => void;
    setIsTaskPreviewVisible: (visible: boolean) => void;
    setCurrentProject: (project: ProjectProps) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentThreadChat: (chat: ThreadProps) => void;
    setIsMainChatVisible: (visible: boolean) => void;
    setIsThreadVisible: (visible: boolean) => void;
    setMyself: (user: UserProps) => void;
    setOpeningService: (service: number) => void;
    setEditTargetMessage: (message: MessageProps | ThreadMessageProps) => void;
    setIsInEdit: (edit: boolean) => void;
    currentThreadChat?: ThreadProps;
    isThreadVisible?: boolean;
    isThread?: boolean;
    height: number;
}

export const MessageListRenderer = ({
    virtuosoRef,
    messages,
    chat,
    myself,
    teamMemberProfiles,
    socket,
    currentChatId,
    visibleRange,
    setVisibleRange,
    isScrolling,
    setIsScrolling,
    indexMap,
    moveToSpecificIndex,
    notMove,
    setErrorMessage,
    setErrorOpen,
    flaggedMessages,
    setFlaggedMessages,
    isCreatingTask,
    setIsCreatingTask,
    setCurrentPreviewTask,
    setCurrentPreviewTaskId,
    setIsTaskPreviewVisible,
    setCurrentProject,
    setCurrentMainChat,
    setCurrentThreadChat,
    setIsMainChatVisible,
    setIsThreadVisible,
    setMyself,
    setOpeningService,
    setEditTargetMessage,
    setIsInEdit,
    currentThreadChat,
    isThreadVisible,
    isThread = false,
    height,
}: MessageListRendererProps) => {
    useScrollToBottomOnChatChange(
        virtuosoRef,
        currentChatId,
        visibleRange.endIndex,
        messages.length - 1,
        indexMap,
        moveToSpecificIndex,
        notMove,
        setErrorMessage,
        setErrorOpen
    );

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
                (isThread || (chat.chatType !== 3 && chat.chatType !== 4))
            );
        }
        return false;
    };

    const calculatePadding = (index: number, message: MessageProps | ThreadMessageProps) => {
        let paddingTop = 0.3;
        let paddingBottom = 0.3;

        let numRepliesWithoutFirstMessage: number;
        if (chat.chatType !== 3) {
            numRepliesWithoutFirstMessage = (message as MessageProps).numReplies - 1;
        } else if (isThread) {
            numRepliesWithoutFirstMessage = (message as MessageProps).numReplies;
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
            return (
                (message as ThreadMessageProps).messageIdWithChatIdAndThreadId ===
                moveToSpecificIndex
            );
        }
        return (
            (message as MessageProps).messageIdWithChatId === moveToSpecificIndex ||
            (isThreadVisible &&
                currentThreadChat &&
                message.messageId === currentThreadChat.threadId) ||
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
                className="custom-scrollbar"
                context={{ isScrolling }}
                initialTopMostItemIndex={messages.length - 1}
                isScrolling={setIsScrolling}
                rangeChanged={setVisibleRange}
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
                                        currentMessageIndex={index}
                                        flaggedMessages={flaggedMessages}
                                        isFocused={isFocused}
                                        isScrolling={isScrolling}
                                        isSimpleBubble={isSimpleBubble}
                                        message={message as ThreadMessageProps}
                                        myself={myself}
                                        setCurrentMainChat={setCurrentMainChat}
                                        setCurrentThreadChat={setCurrentThreadChat}
                                        setEditTargetMessage={setEditTargetMessage}
                                        setFlaggedMessages={setFlaggedMessages}
                                        setIsInEdit={setIsInEdit}
                                        setMyself={setMyself}
                                        setOpeningService={setOpeningService}
                                        setTargetMessageIndex={() => {}}
                                        socket={socket}
                                        teamMemberProfiles={teamMemberProfiles}
                                        thread={chat as ThreadProps}
                                        variant={isYou ? "sent" : "received"}
                                    />
                                ) : (
                                    <MessageBubble
                                        teamMemberProfiles={teamMemberProfiles}
                                        socket={socket}
                                        chat={chat as ChatProps}
                                        currentMessageIndex={index}
                                        flaggedMessages={flaggedMessages}
                                        isCreatingTask={isCreatingTask}
                                        isFocused={isFocused}
                                        isScrolling={isScrolling}
                                        isSimpleBubble={isSimpleBubble}
                                        message={message as MessageProps}
                                        myself={myself}
                                        setCurrentMainChat={setCurrentMainChat}
                                        setCurrentPreviewTask={setCurrentPreviewTask}
                                        setCurrentProject={setCurrentProject}
                                        setCurrentThreadChat={setCurrentThreadChat}
                                        setEditTargetMessage={setEditTargetMessage}
                                        setFlaggedMessages={setFlaggedMessages}
                                        setIsCreatingTask={setIsCreatingTask}
                                        setIsInEdit={setIsInEdit}
                                        setIsMainChatVisible={setIsMainChatVisible}
                                        setIsThreadVisible={setIsThreadVisible}
                                        setMyself={setMyself}
                                        setOpeningService={setOpeningService}
                                        variant={isYou ? "sent" : "received"}
                                        setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                        setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                    />
                                )}
                            </Stack>
                        </div>
                    );
                }}
                style={{ height }}
            />
        </Box>
    );
};
