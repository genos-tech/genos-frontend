import { useState, useEffect, useRef } from "react";
import { Box, Sheet, Stack, Chip } from "@mui/joy";
import { Socket } from "socket.io-client";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import { ThreadMessageBubble } from "./components/bubbles/ThreadMessageBubble";
import { ThreadChatPaneHeader } from "./components/headers/ThreadChatPaneHeader";
import {
    useScrollToBottomOnNewMessage,
    useScrollToBottomOnChatChange,
} from "./hooks/messageBubbleHooks";
import { handleFileDrop } from "./services/handleFileDrop";
import { handleAtTop } from "./services/handleBubblePositionAction";
import { calculateVirtuosoHight } from "./services/calculateVirtuosoHight";
import { BnThreadEditor } from "../../components/blockNote/bnThreadEditor";
import { BnUpdateThreadEditor } from "../../components/blockNote/bnUpdateThreadEditor";
import { UserProps } from "../../types/admin";
import { ThreadProps, ChatProps, ThreadMessageProps } from "../../types/chat";
import { TaskProps } from "../../types/tasks";
import { getTimeDiffSeconds, extractYYYYMMDD, extractMMDD } from "../../utils/dateUtils";

type MessagesPaneProps = {
    teamMemberProfiles: Record<string, UserProps>;
    currentWindowHeight: number;
    thread: ThreadProps;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    teamMembers: UserProps[];
    socket: Socket | null;
    currentThreadChat: ThreadProps;
    setCurrentThreadChat: (chat: ThreadProps) => void;
    setIsThreadVisible: (value: boolean) => void;
    currentThreadChatId: number;
    setIsMainChatVisible: (value: boolean) => void;
    setIsTaskPreviewVisible: (value: boolean) => void;
    setIsTaskCreationVisible: (value: boolean) => void;
    isTaskPreviewVisible: boolean;
    setIsOpeningTask: (value: boolean) => void;
    setIsCreatingTask: (value: boolean) => void;
    currentPreviewTask?: TaskProps;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    currentPreviewTaskId: number;
};

export const ThreadPane = (props: MessagesPaneProps) => {
    const {
        teamMemberProfiles,
        currentWindowHeight,
        thread,
        myself,
        setMyself,
        teamMembers,
        socket,
        currentThreadChat,
        setCurrentThreadChat,
        setIsThreadVisible,
        currentThreadChatId,
        setIsMainChatVisible,
        setIsTaskPreviewVisible,
        isTaskPreviewVisible,
        setIsTaskCreationVisible,
        setIsOpeningTask,
        setIsCreatingTask,
        currentPreviewTask,
        setOpeningService,
        setCurrentMainChat,
        currentPreviewTaskId,
    } = props;

    const [threadMessages, setThreadMessages] = useState(thread.messages || []);
    const [isInEdit, setIsInEdit] = useState<boolean>(false);
    const [editTargetMessage, setEditTargetMessage] = useState<ThreadMessageProps>();
    const [targetMessageIndex, setTargetMessageIndex] = useState<number>(
        threadMessages.length - 1
    );
    const [numEditorLines, setNumEditorLines] = useState<number>(1);
    const [indexMap, setIndexMap] = useState<{ [k: string]: any }>();

    useEffect(() => {
        setThreadMessages(thread.messages || []);
    }, [thread]);

    const virtuosoRef = useRef<VirtuosoHandle | null>(null);
    const [visibleRange, setVisibleRange] = useState({
        startIndex: 0,
        endIndex: 0,
    });

    useScrollToBottomOnNewMessage(
        virtuosoRef as React.RefObject<VirtuosoHandle>,
        thread,
        targetMessageIndex
    );
    useScrollToBottomOnChatChange(
        virtuosoRef as React.RefObject<VirtuosoHandle>,
        currentThreadChatId,
        visibleRange.endIndex,
        threadMessages.length - 1,
        indexMap,
        currentThreadChat.moveToSpecificIndex,
        currentThreadChat.notMove
    );

    useEffect(() => {
        setTargetMessageIndex(threadMessages.length - 1);
        setIndexMap(
            Object.fromEntries(
                threadMessages.map((message, idx) => [message.messageIdWithChatIdAndThreadId, idx])
            )
        );
    }, [threadMessages]);

    useEffect(() => {
        setTimeout(() => {
            if (indexMap && currentThreadChat.moveToSpecificIndex) {
                virtuosoRef.current?.scrollToIndex({
                    index: indexMap[currentThreadChat.moveToSpecificIndex],
                });
            }
        }, 300); // wait N ms
    }, [currentThreadChat]);

    const [isScrolling, setIsScrolling] = useState(false);

    return (
        <>
            <div
                onDrop={handleFileDrop}
                onDragOver={(e) => e.preventDefault()}
                style={{
                    width: "100%",
                    height: "100%",
                }}
            >
                <Sheet
                    sx={{
                        height: { xs: "calc(100dvh - var(--Header-height))", md: "100dvh" },
                        display: "flex",
                        flexDirection: "column",
                        backgroundColor: "background.body",
                    }}
                >
                    <ThreadChatPaneHeader
                        myself={myself}
                        thread={thread}
                        setCurrentThreadChat={setCurrentThreadChat}
                        setIsMainChatVisible={setIsMainChatVisible}
                        setIsThreadVisible={setIsThreadVisible}
                        setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                        isTaskPreviewVisible={isTaskPreviewVisible}
                        setIsTaskCreationVisible={setIsTaskCreationVisible}
                        setIsOpeningTask={setIsOpeningTask}
                        setIsCreatingTask={setIsCreatingTask}
                        currentPreviewTask={currentPreviewTask}
                        currentPreviewTaskId={currentPreviewTaskId}
                    />

                    <Box sx={{ px: 0.3, my: 0.2 }}>
                        <Virtuoso
                            ref={virtuosoRef}
                            className="custom-scrollbar"
                            context={{ isScrolling }}
                            isScrolling={setIsScrolling}
                            rangeChanged={setVisibleRange}
                            style={{
                                height: calculateVirtuosoHight(
                                    currentWindowHeight,
                                    numEditorLines
                                ),
                            }}
                            totalCount={threadMessages.length}
                            initialTopMostItemIndex={threadMessages.length - 1}
                            atTopThreshold={64}
                            atTopStateChange={handleAtTop}
                            atBottomThreshold={128}
                            itemContent={(index, _, { isScrolling }) => {
                                const message = threadMessages[index];
                                const isYou = myself.userId === message.sender.userId;
                                const isFocused =
                                    message.messageIdWithChatIdAndThreadId ===
                                    currentThreadChat.moveToSpecificIndex;

                                const dateSeparator =
                                    index === 0 ||
                                    extractYYYYMMDD(threadMessages[index - 1].tsSent) !==
                                        extractYYYYMMDD(threadMessages[index].tsSent) ? (
                                        <div style={{ padding: "0.5rem 0" }}>
                                            <div style={{ textAlign: "center", fontWeight: 300 }}>
                                                <Chip variant="soft">
                                                    <span
                                                        style={{
                                                            backgroundColor:
                                                                "var(--alt-background)",
                                                            border: "1px solid var(--border)",
                                                            padding: "0.1rem 2rem",
                                                            borderRadius: "0.5rem",
                                                        }}
                                                    >
                                                        {extractMMDD(threadMessages[index].tsSent)}
                                                    </span>
                                                </Chip>
                                            </div>
                                        </div>
                                    ) : null;

                                let isSimpleBubble: boolean;
                                isSimpleBubble = false;
                                if (index > 0) {
                                    const limitSeconds: number = 600;
                                    if (
                                        threadMessages[index - 1].sender.userId ===
                                            message.sender.userId &&
                                        getTimeDiffSeconds(
                                            threadMessages[index - 1].tsSent,
                                            message.tsSent
                                        ) < limitSeconds
                                    ) {
                                        isSimpleBubble = true;
                                    }
                                }

                                let paddingTop: number;
                                let paddingBottom: number;
                                paddingTop = 0.3;
                                paddingBottom = 0.3;

                                if (message.reactions) {
                                    if (message.reactions.allReactions.length > 0) {
                                        paddingBottom = paddingBottom + 2.5;
                                    }
                                }

                                if (index === threadMessages.length - 1) {
                                    paddingBottom = paddingBottom + 3;
                                }

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
                                            <ThreadMessageBubble
                                                teamMemberProfiles={teamMemberProfiles}
                                                myself={myself}
                                                setMyself={setMyself}
                                                socket={socket}
                                                thread={thread}
                                                variant={isYou ? "sent" : "received"}
                                                message={message}
                                                isScrolling={isScrolling}
                                                isFocused={isFocused}
                                                isSimpleBubble={isSimpleBubble}
                                                setOpeningService={setOpeningService}
                                                setCurrentMainChat={setCurrentMainChat}
                                                setIsInEdit={setIsInEdit}
                                                setEditTargetMessage={setEditTargetMessage}
                                                currentMessageIndex={index}
                                                setTargetMessageIndex={setTargetMessageIndex}
                                            />
                                        </Stack>
                                    </div>
                                );
                            }}
                        />
                    </Box>

                    <Box sx={{ paddingLeft: 1, paddingRight: 1 }}>
                        {isInEdit === true && editTargetMessage && (
                            <BnUpdateThreadEditor
                                teamMemberProfiles={teamMemberProfiles}
                                myself={myself}
                                setMyself={setMyself}
                                socket={socket}
                                teamMembers={teamMembers}
                                thread={thread}
                                message={editTargetMessage}
                                isInEdit={isInEdit}
                                setIsInEdit={setIsInEdit}
                                setCurrentChat={setCurrentMainChat}
                                setOpeningService={setOpeningService}
                            />
                        )}
                        {isInEdit === false && (
                            <BnThreadEditor
                                teamMemberProfiles={teamMemberProfiles}
                                myself={myself}
                                setMyself={setMyself}
                                socket={socket}
                                teamMembers={teamMembers}
                                thread={thread}
                                setCurrentChat={setCurrentMainChat}
                                setCurrentThreadChat={setCurrentThreadChat}
                                setOpeningService={setOpeningService}
                                numEditorLines={numEditorLines}
                                setNumEditorLines={setNumEditorLines}
                            />
                        )}
                    </Box>
                </Sheet>
            </div>
        </>
    );
};
