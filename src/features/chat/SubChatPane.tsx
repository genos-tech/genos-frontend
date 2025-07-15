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
import { BnEditor } from "../../components/blockNote/bnEditor";
import { UserProps } from "../../types/admin";
import { ChatProps, ThreadProps } from "../../types/chat";
import { TaskProps } from "../../types/tasks";

type MessagesPaneProps = {
    currentWindowHeight: number;
    paneSizePCT: number;
    myself: UserProps;
    chat: ChatProps;
    subChat: ChatProps;
    socket: Socket | null;
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentSubChat: (chat: ChatProps) => void;
    setCurrentThreadChat: (chat: ThreadProps) => void;
    setIsSubChatVisible: (value: boolean) => void;
    setIsThreadVisible: (value: boolean) => void;
    currentSubChatId: number;
    setCurrentPreviewTask: (value: TaskProps | undefined) => void;
    setOpeningService: (value: number) => void;
    setAllChats: () => void;
};

export const MessagesSubPane = (props: MessagesPaneProps) => {
    const {
        currentWindowHeight,
        paneSizePCT,
        myself,
        chat,
        subChat,
        socket,
        setCurrentMainChat,
        setCurrentSubChat,
        setCurrentThreadChat,
        setIsSubChatVisible,
        setIsThreadVisible,
        currentSubChatId,
        setCurrentPreviewTask,
        setOpeningService,
        setAllChats,
    } = props;
    const [chatMessages, setChatMessages] = useState(subChat.messages);

    useEffect(() => {
        setChatMessages(subChat.messages);
    }, [subChat.messages]);

    const virtuosoRef = useRef<VirtuosoHandle | null>(null);

    useScrollToBottomOnNewMessage(virtuosoRef as React.RefObject<VirtuosoHandle>, subChat);
    useScrollToBottomOnChatChange(
        virtuosoRef as React.RefObject<VirtuosoHandle>,
        currentSubChatId
    );

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
                    setIsSubChatVisible={setIsSubChatVisible}
                />

                <Box sx={{ px: 0.3, my: 0.2 }}>
                    <Virtuoso
                        ref={virtuosoRef}
                        className="custom-scrollbar"
                        style={{ height: currentWindowHeight * paneSizePCT * 0.01 - 270 }}
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
                                            chat={subChat}
                                            socket={socket}
                                            {...message}
                                            setIsThreadVisible={setIsThreadVisible}
                                            setCurrentThreadChat={setCurrentThreadChat}
                                            setCurrentPreviewTask={setCurrentPreviewTask}
                                            setOpeningService={setOpeningService}
                                            setCurrentMainChat={setCurrentMainChat}
                                        />
                                    </Stack>
                                </div>
                            );
                        }}
                    />
                </Box>
                <Box sx={{ paddingBottom: 1, paddingLeft: 1, paddingRight: 1 }}>
                    <BnEditor
                        myself={myself}
                        socket={socket}
                        chat={subChat}
                        setCurrentChat={setCurrentSubChat}
                        setAllChats={setAllChats}
                    />
                </Box>
            </Sheet>
        </div>
    );
};
