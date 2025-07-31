import { useState, useEffect, useRef } from "react";
import { Box, Sheet, Stack } from "@mui/joy";
import { Socket } from "socket.io-client";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import { MessageBubble } from "./components/bubbles/MessageBubble";
import { MainChatPaneHeader } from "./components/headers/MainChatPaneHeader";
import {
    useScrollToBottomOnNewMessage,
    useScrollToBottomOnChatChange,
} from "./hooks/messageBubbleHooks";
import { handleFileDrop } from "./services/handleFileDrop";
import { handleAtTop } from "./services/handleBubblePositionAction";
import {
    calculateVirtuosoHight,
    calculateVirtuosoSubHight,
} from "./services/calculateVirtuosoHight";
import { BnChatEditor } from "../../components/blockNote/bnChatEditor";
import { BnUpdateEditor } from "../../components/blockNote/bnUpdateEditor";
import { UserProps } from "../../types/admin";
import { ChatProps, ThreadProps, MessageProps } from "../../types/chat";
import { TaskProps, ProjectProps } from "../../types/tasks";

type MessagesPaneProps = {
    currentWindowHeight: number;
    paneSizePCT: number;
    chat: ChatProps;
    subChat: ChatProps;
    myself: UserProps;
    teamMembers: UserProps[];
    socket: Socket | null;
    currentMainChat: ChatProps;
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentSubChat: (chat: ChatProps) => void;
    setCurrentThreadChat: (chat: ThreadProps) => void;
    setIsMainChatVisible: (value: boolean) => void;
    setIsThreadVisible: (value: boolean) => void;
    setIsTaskCreationVisible: (value: boolean) => void;
    setIsTaskPreviewVisible: (value: boolean) => void;
    setIsOpeningTask: (value: boolean) => void;
    setIsCreatingTask: (value: boolean) => void;
    isSubChatVisible: boolean;
    setIsSubChatVisible: (value: boolean) => void;
    currentMainChatId: number;
    setCurrentPreviewTask: (value: TaskProps | undefined) => void;
    setOpeningService: (value: number) => void;
    funcSetAllChats: () => void;
    setCurrentPreviewTaskId: (value: number) => void;
    setCurrentProject: (value: ProjectProps) => void;
};

export const MessagesPane = (props: MessagesPaneProps) => {
    const {
        currentWindowHeight,
        paneSizePCT,
        chat,
        subChat,
        myself,
        teamMembers,
        socket,
        currentMainChat,
        setCurrentMainChat,
        setCurrentSubChat,
        setCurrentThreadChat,
        setIsMainChatVisible,
        setIsTaskCreationVisible,
        setIsTaskPreviewVisible,
        setIsOpeningTask,
        setIsCreatingTask,
        setIsThreadVisible,
        isSubChatVisible,
        setIsSubChatVisible,
        currentMainChatId,
        setCurrentPreviewTask,
        setOpeningService,
        funcSetAllChats,
        setCurrentPreviewTaskId,
        setCurrentProject,
    } = props;
    const [chatMessages, setChatMessages] = useState(chat.messages);
    const [isInEdit, setIsInEdit] = useState<boolean>(false);
    const [editTargetMessage, setEditTargetMessage] = useState<MessageProps>();
    const [targetMessageIndex, setTargetMessageIndex] = useState<number>(chatMessages.length - 1);
    const [numEditorLines, setNumEditorLines] = useState<number>(1);

    useEffect(() => {
        setChatMessages(chat.messages);
    }, [chat.messages]);

    const virtuosoRef = useRef<VirtuosoHandle | null>(null);

    useScrollToBottomOnNewMessage(
        virtuosoRef as React.RefObject<VirtuosoHandle>,
        chat,
        targetMessageIndex
    );
    useScrollToBottomOnChatChange(
        virtuosoRef as React.RefObject<VirtuosoHandle>,
        currentMainChatId
    );

    useEffect(() => {
        setTargetMessageIndex(chatMessages.length - 1);
    }, [chatMessages]);

    return (
        <div
            onDrop={handleFileDrop}
            onDragOver={(e) => e.preventDefault()}
            style={{
                width: "100%",
                height: "100%",
            }}
        >
            <Sheet sx={{ backgroundColor: "background.surface" }}>
                <MainChatPaneHeader
                    myself={myself}
                    chat={chat}
                    subChat={subChat}
                    setCurrentMainChat={setCurrentMainChat}
                    setCurrentSubChat={setCurrentSubChat}
                    isSubChatVisible={isSubChatVisible}
                    setIsMainChatVisible={setIsMainChatVisible}
                    setIsSubChatVisible={setIsSubChatVisible}
                    setIsThreadVisible={setIsThreadVisible}
                    setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                    setIsTaskCreationVisible={setIsTaskCreationVisible}
                    setIsCreatingTask={setIsCreatingTask}
                />
                <Box sx={{ px: 0.3, my: 0.2 }}>
                    <Virtuoso
                        ref={virtuosoRef}
                        className="custom-scrollbar"
                        style={{
                            height: isSubChatVisible
                                ? calculateVirtuosoSubHight(
                                      currentWindowHeight,
                                      paneSizePCT,
                                      numEditorLines
                                  )
                                : calculateVirtuosoHight(currentWindowHeight, numEditorLines),
                        }}
                        totalCount={chatMessages.length}
                        initialTopMostItemIndex={chatMessages.length - 1}
                        atTopThreshold={64}
                        atTopStateChange={handleAtTop}
                        atBottomThreshold={128}
                        itemContent={(index) => {
                            const message = chatMessages[index];
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
                                        <MessageBubble
                                            myself={myself}
                                            variant={isYou ? "sent" : "received"}
                                            chat={chat}
                                            message={message}
                                            socket={socket}
                                            setIsMainChatVisible={setIsMainChatVisible}
                                            setIsThreadVisible={setIsThreadVisible}
                                            setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                            setIsTaskCreationVisible={setIsTaskCreationVisible}
                                            setCurrentThreadChat={setCurrentThreadChat}
                                            setCurrentPreviewTask={setCurrentPreviewTask}
                                            setOpeningService={setOpeningService}
                                            setCurrentMainChat={setCurrentMainChat}
                                            setIsOpeningTask={setIsOpeningTask}
                                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                            setCurrentProject={setCurrentProject}
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
                        <BnUpdateEditor
                            myself={myself}
                            socket={socket}
                            teamMembers={teamMembers}
                            chat={chat}
                            message={editTargetMessage}
                            isInEdit={isInEdit}
                            setIsInEdit={setIsInEdit}
                            setCurrentChat={setCurrentMainChat}
                            setOpeningService={setOpeningService}
                        />
                    )}
                    {isInEdit === false && (
                        <BnChatEditor
                            myself={myself}
                            socket={socket}
                            teamMembers={teamMembers}
                            chat={chat}
                            setCurrentChat={setCurrentMainChat}
                            funcSetAllChats={funcSetAllChats}
                            isSubChatVisible={isSubChatVisible}
                            setOpeningService={setOpeningService}
                            numEditorLines={numEditorLines}
                            setNumEditorLines={setNumEditorLines}
                        />
                    )}
                </Box>
            </Sheet>
        </div>
    );
};
