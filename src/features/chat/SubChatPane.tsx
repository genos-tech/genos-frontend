import { useState, useEffect, useRef } from "react";
import { Box, Sheet, Stack, Chip } from "@mui/joy";
import { Socket } from "socket.io-client";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import { MessageBubble } from "./components/bubbles/MessageBubble";
import { SubChatPaneHeader } from "./components/headers/SubChatPaneHeader";
import { useScrollToBottomOnChatChange } from "./hooks/messageBubbleHooks";
import { handleFileDrop } from "./services/handleFileDrop";
import { handleAtTop } from "./services/handleBubblePositionAction";
import { calculateVirtuosoSubHight } from "./services/calculateVirtuosoHight";
import { BnChatEditor } from "../../components/blockNote/bnChatEditor";
import { BnUpdateEditor } from "../../components/blockNote/bnUpdateEditor";
import { UserProps } from "../../types/admin";
import { ChatProps, ThreadProps, MessageProps, ToDoFactProps } from "../../types/chat";
import { TaskProps, ProjectProps } from "../../types/tasks";
import { getTimeDiffSeconds, extractYYYYMMDD, extractMMDD } from "../../utils/dateUtils";
import { addChat } from "../../features/chat/services/addChat";
import { useAuth } from "../../context/AuthContext";
import UpdateReadStatusWorker from "../../workers/updateReadStatusWorker.ts?worker";
import { ToDoPane } from "./ToDoPane";

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
    currentThreadChat?: ThreadProps;
    setCurrentThreadChat: (chat: ThreadProps) => void;
    isThreadVisible: boolean;
    setIsMainChatVisible: (value: boolean) => void;
    setIsSubChatVisible: (value: boolean) => void;
    setIsThreadVisible: (value: boolean) => void;
    setIsTaskPreviewVisible: (value: boolean) => void;
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
    currentSubChatId: number;
    setCurrentPreviewTask: (value: TaskProps | undefined) => void;
    setOpeningService: (value: number) => void;
    funcSetAllChats: () => Promise<void>;
    setCurrentPreviewTaskId: (value: number) => void;
    setCurrentProject: (value: ProjectProps) => void;
    isToDoVisible: boolean;
    setIsToDoVisible: (value: boolean) => void;
    todos: ToDoFactProps[];
    setTodos: (value: ToDoFactProps[]) => void;
    isExistingTodaysTodo: boolean;
    setIsExistingTodaysTodo: (value: boolean) => void;
    incompleteTodoCount: number;
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
        currentThreadChat,
        setCurrentThreadChat,
        isThreadVisible,
        setIsMainChatVisible,
        setIsSubChatVisible,
        setIsThreadVisible,
        setIsTaskPreviewVisible,
        isCreatingTask,
        setIsCreatingTask,
        currentSubChatId,
        setCurrentPreviewTask,
        setOpeningService,
        funcSetAllChats,
        setCurrentPreviewTaskId,
        setCurrentProject,
        isToDoVisible,
        setIsToDoVisible,
        todos,
        setTodos,
        isExistingTodaysTodo,
        setIsExistingTodaysTodo,
        incompleteTodoCount,
    } = props;
    const { accessToken } = useAuth();
    const [chatMessages, setChatMessages] = useState(subChat.messages);
    const [isInEdit, setIsInEdit] = useState<boolean>(false);
    const [editTargetMessage, setEditTargetMessage] = useState<MessageProps>();
    const [numEditorLines, setNumEditorLines] = useState<number>(1);
    const [indexMap, setIndexMap] = useState<{ [k: string]: any }>();

    useEffect(() => {
        // For DM chat, remove the first message because it is the "has joined" message.
        if (subChat.chatType === 1) {
            setChatMessages(subChat.messages.slice(1));
        } else {
            setChatMessages(subChat.messages);
        }
    }, [subChat.messages]);

    const virtuosoRef = useRef<VirtuosoHandle | null>(null);
    const [visibleRange, setVisibleRange] = useState({
        startIndex: 0,
        endIndex: 0,
    });

    useScrollToBottomOnChatChange(
        virtuosoRef as React.RefObject<VirtuosoHandle>,
        currentSubChatId,
        visibleRange.endIndex,
        chatMessages.length - 1,
        indexMap,
        currentSubChat?.moveToSpecificIndex,
        currentSubChat?.notMove
    );

    const updateReadStatus = (indexForLastReadMessageId: number) => {
        if (accessToken && currentSubChat && currentSubChat.messages[indexForLastReadMessageId]) {
            const updateReadStatusWorker = new UpdateReadStatusWorker();
            const lastReadMessageId: number =
                currentSubChat.messages[indexForLastReadMessageId].messageId;
            updateReadStatusWorker.postMessage({
                accessToken: accessToken,
                myself: myself,
                chatType: currentSubChat.chatType,
                chatId: currentSubChat.chatId,
                isThread: false,
                threadId: 0,
                lastReadMessageId: lastReadMessageId,
            });
            updateReadStatusWorker.onmessage = (event) => {
                if (event.data === "done") {
                    if (chat.lastReadMessageId < lastReadMessageId) {
                        const updatedChat = { ...chat, lastReadMessageId: lastReadMessageId };
                        addChat(updatedChat, updatedChat.chatType);
                        funcSetAllChats();
                    } else {
                        // console.log("Nothing to update read status...");
                    }
                } else {
                    console.error("Failed to update read status");
                }
            };
            return () => {
                updateReadStatusWorker.terminate();
            };
        }
    };

    const [tsLastReadStatusUpdated, setTsLastReadStatusUpdated] = useState<number>(Date.now());
    const [indexLastReadStatusUpdated, setIndexLastReadStatusUpdated] = useState<number>(-1);
    useEffect(() => {
        setTimeout(() => {
            // Update read-sta
            // tus only when the main chat opens from the chat list,
            // not from the chat activity or other with "moveToSpecificIndex" value.
            let targetIndex: number;
            if (currentSubChat && currentSubChat.moveToSpecificIndex === undefined) {
                targetIndex = currentSubChat.messages.length - 1;
            } else if (
                currentSubChat &&
                currentSubChat.moveToSpecificIndex &&
                indexMap &&
                indexMap[currentSubChat.moveToSpecificIndex] &&
                currentSubChat.chatId === Number(currentSubChat.moveToSpecificIndex?.split("-")[0])
            ) {
                targetIndex = Number(indexMap[currentSubChat.moveToSpecificIndex]);
            } else {
                targetIndex = -1;
            }

            if (targetIndex !== -1) {
                updateReadStatus(targetIndex);
                setIndexLastReadStatusUpdated(targetIndex);

                const now = Date.now();
                setTsLastReadStatusUpdated(now);
            }
        }, 1000); // wait N ms
    }, [indexMap]);

    useEffect(() => {
        const intervalMs: number = 1000; // every X milliseconds
        const now = Date.now();
        if (
            now - tsLastReadStatusUpdated >= intervalMs &&
            visibleRange.endIndex > indexLastReadStatusUpdated
        ) {
            updateReadStatus(visibleRange.endIndex);
            // Update timestamp
            setTsLastReadStatusUpdated(now);
            setIndexLastReadStatusUpdated(visibleRange.endIndex);
        }
    }, [visibleRange]);

    useEffect(() => {
        if (currentSubChat) {
            setIndexMap(
                Object.fromEntries(
                    currentSubChat.messages.map((message, idx) => [
                        message.messageIdWithChatId,
                        idx,
                    ])
                )
            );
        }
    }, [currentSubChat]);

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
                    setIsCreatingTask={setIsCreatingTask}
                    setOpeningService={setOpeningService}
                    funcSetAllChats={funcSetAllChats}
                    isToDoVisible={isToDoVisible}
                    setIsToDoVisible={setIsToDoVisible}
                    incompleteTodoCount={incompleteTodoCount}
                />

                {/* To-Do Pane for only myself */}
                {isToDoVisible === true &&
                    currentSubChat &&
                    currentSubChat.chatType === 1 &&
                    currentSubChat.dmPartnerUser.userId === myself.userId && (
                        <>
                            <ToDoPane
                                myself={myself}
                                teamMemberProfiles={teamMemberProfiles}
                                teamMembers={teamMembers}
                                setMyself={setMyself}
                                socket={socket}
                                setOpeningService={setOpeningService}
                                setCurrentChat={setCurrentMainChat}
                                todos={todos}
                                setTodos={setTodos}
                                isExistingTodaysTodo={isExistingTodaysTodo}
                                setIsExistingTodaysTodo={setIsExistingTodaysTodo}
                                isSubChatVisible={true}
                            />
                        </>
                    )}

                {!(
                    isToDoVisible === true &&
                    currentSubChat &&
                    currentSubChat.chatType === 1 &&
                    currentSubChat.dmPartnerUser.userId === myself.userId
                ) && (
                    <>
                        {" "}
                        <Box sx={{ px: 0.3, my: 0.2 }}>
                            <Virtuoso
                                ref={virtuosoRef}
                                className="custom-scrollbar"
                                context={{ isScrolling }}
                                isScrolling={setIsScrolling}
                                rangeChanged={setVisibleRange}
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
                                    // Set True if the message is clicked from the Activity,
                                    // or, if the corresponding thread is opened.
                                    const isFocused =
                                        message.messageIdWithChatId ===
                                            currentSubChat?.moveToSpecificIndex ||
                                        (isThreadVisible &&
                                            currentThreadChat &&
                                            message.messageId === currentThreadChat.threadId) ||
                                        false;

                                    const dateSeparator =
                                        index === 0 ||
                                        extractYYYYMMDD(chatMessages[index - 1].tsSent) !==
                                            extractYYYYMMDD(chatMessages[index].tsSent) ? (
                                            <div style={{ padding: "0.5rem 0" }}>
                                                <div
                                                    style={{
                                                        textAlign: "center",
                                                        fontWeight: 300,
                                                    }}
                                                >
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
                                                            {extractMMDD(
                                                                chatMessages[index].tsSent
                                                            )}
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

                                    let numRepliesWithoutFirstMessage: number;
                                    if (chat.chatType !== 3) {
                                        numRepliesWithoutFirstMessage = message.numReplies - 1;
                                    } else {
                                        numRepliesWithoutFirstMessage = message.numReplies;
                                    }

                                    if (message.reactions) {
                                        if (message.reactions.length > 0) {
                                            paddingBottom = paddingBottom + 2.5;
                                        }
                                    } else if (numRepliesWithoutFirstMessage > 0) {
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
                                                    setIsTaskPreviewVisible={
                                                        setIsTaskPreviewVisible
                                                    }
                                                    isCreatingTask={isCreatingTask}
                                                    setIsCreatingTask={setIsCreatingTask}
                                                    setCurrentThreadChat={setCurrentThreadChat}
                                                    setCurrentPreviewTask={setCurrentPreviewTask}
                                                    setOpeningService={setOpeningService}
                                                    setCurrentMainChat={setCurrentMainChat}
                                                    setCurrentPreviewTaskId={
                                                        setCurrentPreviewTaskId
                                                    }
                                                    setCurrentProject={setCurrentProject}
                                                    setIsInEdit={setIsInEdit}
                                                    setEditTargetMessage={setEditTargetMessage}
                                                    currentMessageIndex={index}
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
                                    isSubChatVisible={true}
                                    setOpeningService={setOpeningService}
                                    numEditorLines={numEditorLines}
                                    setNumEditorLines={setNumEditorLines}
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
                    </>
                )}
            </Sheet>
        </div>
    );
};
