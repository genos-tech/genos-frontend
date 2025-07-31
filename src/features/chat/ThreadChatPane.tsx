import { useState, useEffect, useRef } from "react";
import { Box, Sheet, Stack } from "@mui/joy";
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

type MessagesPaneProps = {
    currentWindowHeight: number;
    thread: ThreadProps;
    myself: UserProps;
    teamMembers: UserProps[];
    socket: Socket | null;
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
        currentWindowHeight,
        thread,
        myself,
        teamMembers,
        socket,
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

    useEffect(() => {
        setThreadMessages(thread.messages || []);
    }, [thread]);

    const virtuosoRef = useRef<VirtuosoHandle | null>(null);

    useScrollToBottomOnNewMessage(
        virtuosoRef as React.RefObject<VirtuosoHandle>,
        thread,
        targetMessageIndex
    );
    useScrollToBottomOnChatChange(
        virtuosoRef as React.RefObject<VirtuosoHandle>,
        currentThreadChatId
    );

    useEffect(() => {
        setTargetMessageIndex(threadMessages.length - 1);
    }, [threadMessages]);

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
                            itemContent={(index) => {
                                const message = threadMessages[index];
                                const isYou = myself.userId === message.sender.userId;
                                return (
                                    <div>
                                        <Stack
                                            direction="row"
                                            spacing={2}
                                            sx={{
                                                flexDirection: isYou ? "row-reverse" : "row",
                                                paddingY: 1.8,
                                                paddingX: 1,
                                            }}
                                        >
                                            <ThreadMessageBubble
                                                myself={myself}
                                                socket={socket}
                                                thread={thread}
                                                variant={isYou ? "sent" : "received"}
                                                message={message}
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
                                myself={myself}
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
                                myself={myself}
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
