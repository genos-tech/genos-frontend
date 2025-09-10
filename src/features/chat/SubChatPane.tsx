import { useState, useEffect, useRef } from "react";
import { Box, Sheet, Stack, Chip } from "@mui/joy";
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
import { getTimeDiffSeconds, extractYYYYMMDD, extractMMDD } from "../../utils/dateUtils";

type MessagesPaneProps = {
    teamMemberProfiles: Record<string, UserProps>;
    currentWindowHeight: number;
    paneSizePCT: number;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
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
        teamMemberProfiles,
        currentWindowHeight,
        paneSizePCT,
        myself,
        setMyself,
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
        currentSubChat?.moveToSpecificIndex,
        currentSubChat?.notMove
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

    const [isScrolling, setIsScrolling] = useState(false);

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
                    teamMemberProfiles={teamMemberProfiles}
                    socket={socket}
                    myself={myself}
                    setMyself={setMyself}
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
                    setOpeningService={setOpeningService}
                />

                <Box sx={{ px: 0.3, my: 0.2 }}>
                    <Virtuoso
                        ref={virtuosoRef}
                        className="custom-scrollbar"
                        context={{ isScrolling }}
                        isScrolling={setIsScrolling}
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
                        itemContent={(index, _, { isScrolling }) => {
                            const message = chatMessages[index];
                            const isYou = myself.userId === message.sender.userId;
                            const isFocused =
                                message.messageIdWithChatId ===
                                currentSubChat?.moveToSpecificIndex;

                            const dateSeparator =
                                index === 0 ||
                                extractYYYYMMDD(chatMessages[index - 1].tsSent) !==
                                    extractYYYYMMDD(chatMessages[index].tsSent) ? (
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
                                                    {extractMMDD(chatMessages[index].tsSent)}
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
                                        <MessageBubble
                                            teamMemberProfiles={teamMemberProfiles}
                                            myself={myself}
                                            setMyself={setMyself}
                                            variant={isYou ? "sent" : "received"}
                                            chat={subChat}
                                            message={message}
                                            isScrolling={isScrolling}
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
                            teamMemberProfiles={teamMemberProfiles}
                            myself={myself}
                            setMyself={setMyself}
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
                            teamMemberProfiles={teamMemberProfiles}
                            myself={myself}
                            setMyself={setMyself}
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
