import { useEffect, useRef, useState } from "react";
import { Alert, Box, Chip, Sheet, Snackbar, Stack } from "@mui/joy";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { MessageBubble } from "./components/bubbles/MessageBubble";
import { MainChatPaneHeader } from "./components/headers/MainChatPaneHeader";
import { useScrollToBottomOnChatChange } from "./hooks/messageBubbleHooks";
import {
    calculateVirtuosoHight,
    calculateVirtuosoSubHight,
} from "./services/calculateVirtuosoHight";
import { handleAtTop } from "./services/handleBubblePositionAction";
import { handleFileDrop } from "./services/handleFileDrop";

import { BnChatEditor } from "../../components/blockNote/bnChatEditor";
import { BnUpdateEditor } from "../../components/blockNote/bnUpdateEditor";
import { useAuth } from "../../context/AuthContext";
import { addChat } from "../../features/chat/services/addChat";
import { UserProps } from "../../types/admin";
import {
    ChatProps,
    FlaggedMessageProps,
    MessageProps,
    ThreadProps,
    ToDoFactProps,
} from "../../types/chat";
import { ProjectProps, TaskProps } from "../../types/tasks";
import { extractMMDD, extractYYYYMMDD, getTimeDiffSeconds } from "../../utils/dateUtils";
import UpdateReadStatusWorker from "../../workers/updateReadStatusWorker.ts?worker";
import { ToDoPane } from "./ToDoPane";

type MessagesPaneProps = {
    teamMemberProfiles: Record<string, UserProps>;
    currentWindowHeight: number;
    paneSizePCT: number;
    chat: ChatProps;
    subChat: ChatProps;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    teamMembers: UserProps[];
    socket: Socket | null;
    currentMainChat: ChatProps;
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentSubChat: (chat: ChatProps) => void;
    currentThreadChat?: ThreadProps;
    setCurrentThreadChat: (chat: ThreadProps) => void;
    isThreadVisible: boolean;
    setIsMainChatVisible: (value: boolean) => void;
    setIsThreadVisible: (value: boolean) => void;
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
    setIsTaskPreviewVisible: (value: boolean) => void;
    isSubChatVisible: boolean;
    setIsSubChatVisible: (value: boolean) => void;
    currentMainChatId: number;
    setCurrentPreviewTask: (value: TaskProps | undefined) => void;
    setOpeningService: (value: number) => void;
    funcSetAllChats: () => Promise<void>;
    setCurrentPreviewTaskId: (value: number) => void;
    setCurrentProject: (value: ProjectProps) => void;
    setIsToDoVisible: (value: boolean) => void;
    isToDoVisible: boolean;
    todos: ToDoFactProps[];
    setTodos: (value: ToDoFactProps[]) => void;
    isExistingTodaysTodo: boolean;
    setIsExistingTodaysTodo: (value: boolean) => void;
    incompleteTodoCount: number;
    flaggedMessages: FlaggedMessageProps[];
    setFlaggedMessages: (value: FlaggedMessageProps[]) => void;
};

export const MessagesPane = (props: MessagesPaneProps) => {
    const {
        teamMemberProfiles,
        currentWindowHeight,
        paneSizePCT,
        chat,
        subChat,
        myself,
        setMyself,
        teamMembers,
        socket,
        currentMainChat,
        setCurrentMainChat,
        setCurrentSubChat,
        currentThreadChat,
        setCurrentThreadChat,
        isThreadVisible,
        setIsMainChatVisible,
        setIsTaskPreviewVisible,
        isCreatingTask,
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
        setIsToDoVisible,
        isToDoVisible,
        todos,
        setTodos,
        isExistingTodaysTodo,
        setIsExistingTodaysTodo,
        incompleteTodoCount,
        flaggedMessages,
        setFlaggedMessages,
    } = props;
    const { accessToken } = useAuth();
    const [chatMessages, setChatMessages] = useState(chat.messages);
    const [isInEdit, setIsInEdit] = useState<boolean>(false);
    const [editTargetMessage, setEditTargetMessage] = useState<MessageProps>();
    const [numEditorLines, setNumEditorLines] = useState<number>(1);
    const [indexMap, setIndexMap] = useState<{ [k: string]: any }>();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [errorOpen, setErrorOpen] = useState(false);

    useEffect(() => {
        // For DM chat, remove the first message because it is the "has joined" message.
        if (chat.chatType === 1) {
            setChatMessages(chat.messages.slice(1));
        } else {
            setChatMessages(chat.messages);
        }
    }, [chat.messages]);

    const virtuosoRef = useRef<VirtuosoHandle | null>(null);
    const [visibleRange, setVisibleRange] = useState({
        startIndex: 0,
        endIndex: 0,
    });

    useScrollToBottomOnChatChange(
        virtuosoRef as React.RefObject<VirtuosoHandle>,
        currentMainChatId,
        visibleRange.endIndex,
        chatMessages.length - 1,
        indexMap,
        currentMainChat.moveToSpecificIndex,
        currentMainChat.notMove,
        setErrorMessage,
        setErrorOpen
    );

    const updateReadStatus = (indexForLastReadMessageId: number) => {
        if (accessToken && currentMainChat.messages[indexForLastReadMessageId]) {
            const updateReadStatusWorker = new UpdateReadStatusWorker();
            const lastReadMessageId: number =
                currentMainChat.messages[indexForLastReadMessageId].messageId;

            updateReadStatusWorker.postMessage({
                accessToken: accessToken,
                myself: myself,
                chatType: currentMainChat.chatType,
                chatId: currentMainChat.chatId,
                isThread: false,
                threadId: 0,
                lastReadMessageId: lastReadMessageId,
            });
            updateReadStatusWorker.onmessage = (event) => {
                if (event.data === "done") {
                    if (chat.lastReadMessageId < lastReadMessageId) {
                        const updatedChat = {
                            ...chat,
                            lastReadMessageId: lastReadMessageId,
                        };
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
            if (currentMainChat.moveToSpecificIndex === undefined) {
                targetIndex = currentMainChat.messages.length - 1;
            } else if (
                indexMap &&
                indexMap[currentMainChat.moveToSpecificIndex] &&
                currentMainChat.chatId ===
                    Number(currentMainChat.moveToSpecificIndex?.split("-")[0])
            ) {
                targetIndex = Number(indexMap[currentMainChat.moveToSpecificIndex]);
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
        const intervalMs: number = 500; // every X milliseconds
        const now = Date.now();
        if (
            now - tsLastReadStatusUpdated >= intervalMs &&
            visibleRange.endIndex + 1 > indexLastReadStatusUpdated
        ) {
            updateReadStatus(visibleRange.endIndex);
            // Update timestamp
            setTsLastReadStatusUpdated(now);
            setIndexLastReadStatusUpdated(visibleRange.endIndex);
        }
    }, [visibleRange]);

    useEffect(() => {
        setIndexMap(
            Object.fromEntries(
                currentMainChat.messages.map((message, idx) => [message.messageIdWithChatId, idx])
            )
        );
    }, [currentMainChat]);

    useEffect(() => {
        setTimeout(() => {
            if (indexMap && currentMainChat.moveToSpecificIndex) {
                virtuosoRef.current?.scrollToIndex({
                    index: indexMap[currentMainChat.moveToSpecificIndex],
                });
            } else if (currentMainChat.notMove !== true) {
                virtuosoRef.current?.scrollToIndex({
                    index: "LAST",
                });
                if (currentMainChat.latestMessage) {
                    updateReadStatus(currentMainChat.latestMessage.messageId);
                }
            }
        }, 300); // wait N ms
    }, [currentMainChat]);

    const [isScrolling, setIsScrolling] = useState(false);

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
        >
            <Sheet sx={{ backgroundColor: "background.surface" }}>
                {errorMessage && errorMessage !== "" && (
                    <Snackbar
                        anchorOrigin={{ vertical: "top", horizontal: "right" }}
                        autoHideDuration={5000}
                        color="danger"
                        open={errorOpen}
                        variant="soft"
                        onClose={(event, reason) => {
                            if (reason === "clickaway") {
                                return;
                            }
                            setErrorOpen(false);
                        }}
                    >
                        {errorMessage}
                    </Snackbar>
                )}
                <MainChatPaneHeader
                    chat={chat}
                    funcSetAllChats={funcSetAllChats}
                    incompleteTodoCount={incompleteTodoCount}
                    isSubChatVisible={isSubChatVisible}
                    isToDoVisible={isToDoVisible}
                    myself={myself}
                    setCurrentMainChat={setCurrentMainChat}
                    setCurrentSubChat={setCurrentSubChat}
                    setIsCreatingTask={setIsCreatingTask}
                    setIsMainChatVisible={setIsMainChatVisible}
                    setIsSubChatVisible={setIsSubChatVisible}
                    setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                    setIsThreadVisible={setIsThreadVisible}
                    setIsToDoVisible={setIsToDoVisible}
                    setMyself={setMyself}
                    setOpeningService={setOpeningService}
                    socket={socket}
                    subChat={subChat}
                    teamMemberProfiles={teamMemberProfiles}
                />

                {/* To-Do Pane for only myself */}
                {isToDoVisible === true &&
                    currentMainChat.chatType === 1 &&
                    currentMainChat.dmPartnerUser.userId === myself.userId && (
                        <>
                            <ToDoPane
                                currentWindowHeight={currentWindowHeight}
                                isExistingTodaysTodo={isExistingTodaysTodo}
                                isSubChatVisible={isSubChatVisible}
                                myself={myself}
                                setCurrentChat={setCurrentMainChat}
                                setIsExistingTodaysTodo={setIsExistingTodaysTodo}
                                setMyself={setMyself}
                                setOpeningService={setOpeningService}
                                setTodos={setTodos}
                                socket={socket}
                                teamMemberProfiles={teamMemberProfiles}
                                teamMembers={teamMembers}
                                todos={todos}
                            />
                        </>
                    )}
                {!(
                    isToDoVisible === true &&
                    currentMainChat.chatType === 1 &&
                    currentMainChat.dmPartnerUser.userId === myself.userId
                ) && (
                    <>
                        <Box sx={{ px: 0.3, my: 0.2 }}>
                            <Virtuoso
                                ref={virtuosoRef}
                                atBottomThreshold={128}
                                atTopStateChange={handleAtTop}
                                atTopThreshold={64}
                                className="custom-scrollbar"
                                context={{ isScrolling }}
                                initialTopMostItemIndex={chatMessages.length - 1}
                                isScrolling={setIsScrolling}
                                rangeChanged={setVisibleRange}
                                totalCount={chatMessages.length}
                                itemContent={(index, _, { isScrolling }) => {
                                    const message = chatMessages[index];
                                    const isYou = myself.userId === message.sender.userId;
                                    // Set True if the message is clicked from the Activity,
                                    // or, if the corresponding thread is opened.
                                    const isFocused =
                                        message.messageIdWithChatId ===
                                            currentMainChat.moveToSpecificIndex ||
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
                                            ) < limitSeconds &&
                                            currentMainChat.chatType !== 3 &&
                                            currentMainChat.chatType !== 4
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

                                    if (message.reactions && message.reactions.length > 0) {
                                        paddingBottom = paddingBottom + 2.5;
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
                                                    chat={chat}
                                                    currentMessageIndex={index}
                                                    flaggedMessages={flaggedMessages}
                                                    isCreatingTask={isCreatingTask}
                                                    isFocused={isFocused}
                                                    isScrolling={isScrolling}
                                                    isSimpleBubble={isSimpleBubble}
                                                    message={message}
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
                                                    socket={socket}
                                                    teamMemberProfiles={teamMemberProfiles}
                                                    variant={isYou ? "sent" : "received"}
                                                    setCurrentPreviewTaskId={
                                                        setCurrentPreviewTaskId
                                                    }
                                                    setIsTaskPreviewVisible={
                                                        setIsTaskPreviewVisible
                                                    }
                                                />
                                            </Stack>
                                        </div>
                                    );
                                }}
                                style={{
                                    height:
                                        currentMainChat.chatType === 3 ||
                                        currentMainChat.chatType === 4
                                            ? "95vh"
                                            : isSubChatVisible
                                              ? calculateVirtuosoSubHight(
                                                    currentWindowHeight,
                                                    paneSizePCT,
                                                    numEditorLines
                                                )
                                              : calculateVirtuosoHight(
                                                    currentWindowHeight,
                                                    numEditorLines
                                                ),
                                }}
                            />
                        </Box>

                        {currentMainChat.chatType !== 3 && currentMainChat.chatType !== 4 && (
                            <Box sx={{ paddingLeft: 1, paddingRight: 1 }}>
                                {isInEdit === true && editTargetMessage && (
                                    <BnUpdateEditor
                                        chat={chat}
                                        isInEdit={isInEdit}
                                        isSubChatVisible={isSubChatVisible}
                                        message={editTargetMessage}
                                        myself={myself}
                                        numEditorLines={numEditorLines}
                                        setCurrentChat={setCurrentMainChat}
                                        setIsInEdit={setIsInEdit}
                                        setMyself={setMyself}
                                        setNumEditorLines={setNumEditorLines}
                                        setOpeningService={setOpeningService}
                                        socket={socket}
                                        teamMemberProfiles={teamMemberProfiles}
                                        teamMembers={teamMembers}
                                    />
                                )}
                                {isInEdit === false && (
                                    <BnChatEditor
                                        chat={chat}
                                        funcSetAllChats={funcSetAllChats}
                                        isSubChatVisible={isSubChatVisible}
                                        myself={myself}
                                        numEditorLines={numEditorLines}
                                        setCurrentChat={setCurrentMainChat}
                                        setMyself={setMyself}
                                        setNumEditorLines={setNumEditorLines}
                                        setOpeningService={setOpeningService}
                                        socket={socket}
                                        teamMemberProfiles={teamMemberProfiles}
                                        teamMembers={teamMembers}
                                    />
                                )}
                            </Box>
                        )}
                    </>
                )}
            </Sheet>
        </div>
    );
};
