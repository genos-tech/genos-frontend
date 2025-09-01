import { useState, useEffect, useRef } from "react";
import { Box, Sheet, Stack } from "@mui/joy";
import { Socket } from "socket.io-client";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import { MessageBubble } from "./components/bubbles/MessageBubble";
import { SubChatPaneHeader } from "./components/headers/SubChatPaneHeader";
import {
    useScrollToBottomOnNewMessage,
    useScrollToBottomOnChatChange,
} from "./hooks/messageBubbleHooks";
import { handleFileDrop } from "./services/handleFileDrop";
import { handleAtTop } from "./services/handleBubblePositionAction";
import { calculateVirtuosoSubHight } from "./services/calculateVirtuosoHight";
import { BnChatEditor } from "../../components/blockNote/bnChatEditor";
import { BnUpdateEditor } from "../../components/blockNote/bnUpdateEditor";
import { UserProps } from "../../types/admin";
import { ChatProps, ThreadProps, MessageProps } from "../../types/chat";
import { TaskProps, ProjectProps } from "../../types/tasks";
import { getTimeDiffSeconds } from "../../utils/dateUtils";

type MessagesPaneProps = {
    currentWindowHeight: number;
    paneSizePCT: number;
    myself: UserProps;
    teamMembers: UserProps[];
    chat: ChatProps;
    subChat: ChatProps;
    socket: Socket | null;
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentSubChat: (chat: ChatProps) => void;
    currentSubChat?: ChatProps;
    setCurrentThreadChat: (chat: ThreadProps) => void;
    setIsMainChatVisible: (value: boolean) => void;
    setIsSubChatVisible: (value: boolean) => void;
    setIsThreadVisible: (value: boolean) => void;
    setIsTaskPreviewVisible: (value: boolean) => void;
    setIsTaskCreationVisible: (value: boolean) => void;
    setIsOpeningTask: (value: boolean) => void;
    setIsCreatingTask: (value: boolean) => void;
    currentSubChatId: number;
    setCurrentPreviewTask: (value: TaskProps | undefined) => void;
    setOpeningService: (value: number) => void;
    funcSetAllChats: () => void;
    setCurrentPreviewTaskId: (value: number) => void;
    setCurrentProject: (value: ProjectProps) => void;
};

export const MessagesSubPane = (props: MessagesPaneProps) => {
    const {
        currentWindowHeight,
        paneSizePCT,
        myself,
        teamMembers,
        chat,
        subChat,
        socket,
        setCurrentMainChat,
        setCurrentSubChat,
        currentSubChat,
        setCurrentThreadChat,
        setIsMainChatVisible,
        setIsSubChatVisible,
        setIsThreadVisible,
        setIsTaskPreviewVisible,
        setIsTaskCreationVisible,
        setIsOpeningTask,
        setIsCreatingTask,
        currentSubChatId,
        setCurrentPreviewTask,
        setOpeningService,
        funcSetAllChats,
        setCurrentPreviewTaskId,
        setCurrentProject,
    } = props;
    const [chatMessages, setChatMessages] = useState(subChat.messages);
    const [isInEdit, setIsInEdit] = useState<boolean>(false);
    const [editTargetMessage, setEditTargetMessage] = useState<MessageProps>();
    const [targetMessageIndex, setTargetMessageIndex] = useState<number>(chatMessages.length - 1);
    const [numEditorLines, setNumEditorLines] = useState<number>(1);
    const [indexMap, setIndexMap] = useState<{ [k: string]: any }>();

    useEffect(() => {
        setChatMessages(subChat.messages);
    }, [subChat.messages]);

    const virtuosoRef = useRef<VirtuosoHandle | null>(null);

    useScrollToBottomOnNewMessage(
        virtuosoRef as React.RefObject<VirtuosoHandle>,
        subChat,
        targetMessageIndex
    );
    useScrollToBottomOnChatChange(
        virtuosoRef as React.RefObject<VirtuosoHandle>,
        currentSubChatId,
        indexMap,
        currentSubChat?.moveToSpecificIndex
    );

    useEffect(() => {
        setTargetMessageIndex(chatMessages.length - 1);
        setIndexMap(
            Object.fromEntries(
                chatMessages.map((message, idx) => [message.messageIdWithChatId, idx])
            )
        );
    }, [chatMessages]);

    useEffect(() => {
        setTimeout(() => {
            if (indexMap && currentSubChat && currentSubChat.moveToSpecificIndex) {
                virtuosoRef.current?.scrollToIndex({
                    index: indexMap[currentSubChat.moveToSpecificIndex],
                });
            }
        }, 300); // wait N ms
    }, [currentSubChat]);

    return (
        <div
            onDrop={handleFileDrop}
            onDragOver={(e) => e.preventDefault()}
            style={{
                width: "100%",
                height: "100%",
            }}
        >
            <Sheet sx={{ backgroundColor: "background.level1" }}>
                <SubChatPaneHeader
                    myself={myself}
                    chat={chat}
                    subChat={subChat}
                    setCurrentMainChat={setCurrentMainChat}
                    setCurrentSubChat={setCurrentSubChat}
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
                            height: calculateVirtuosoSubHight(
                                currentWindowHeight,
                                paneSizePCT,
                                numEditorLines
                            ),
                        }}
                        totalCount={chatMessages.length}
                        initialTopMostItemIndex={chatMessages.length - 1}
                        atTopThreshold={64}
                        atTopStateChange={handleAtTop}
                        atBottomThreshold={128}
                        itemContent={(index) => {
                            const message = chatMessages[index];
                            const isYou = myself.userId === message.sender.userId;
                            const isFocused =
                                message.messageIdWithChatId ===
                                currentSubChat?.moveToSpecificIndex;

                            let isSimpleBubble: boolean;
                            isSimpleBubble = false;
                            if (index > 0) {
                                const limitSeconds: number = 600;
                                if (
                                    chatMessages[index - 1].sender.userId ===
                                        message.sender.userId &&
                                    getTimeDiffSeconds(
                                        chatMessages[index - 1].tsSent,
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
                            } else if (message.numReplies > 0) {
                                paddingBottom = paddingBottom + 2.5;
                            }

                            if (index === chatMessages.length - 1) {
                                paddingBottom = paddingBottom + 3;
                            }

                            return (
                                <div>
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
                                        <MessageBubble
                                            myself={myself}
                                            variant={isYou ? "sent" : "received"}
                                            chat={subChat}
                                            message={message}
                                            isFocused={isFocused}
                                            isSimpleBubble={isSimpleBubble}
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
                            setCurrentChat={setCurrentSubChat}
                            setOpeningService={setOpeningService}
                        />
                    )}
                    {isInEdit === false && (
                        <BnChatEditor
                            myself={myself}
                            socket={socket}
                            teamMembers={teamMembers}
                            chat={chat}
                            setCurrentChat={setCurrentSubChat}
                            funcSetAllChats={funcSetAllChats}
                            isSubChatVisible={true}
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
