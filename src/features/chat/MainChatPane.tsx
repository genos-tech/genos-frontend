import { useEffect } from "react";
import { Box, Sheet, useColorScheme } from "@mui/joy";
import { VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { MainChatPaneHeader } from "./components/headers/MainChatPaneHeader";
import { ChatEditorSection } from "./components/shared/ChatEditorSection";
import { ErrorSnackbar } from "./components/shared/ErrorSnackbar";
import { MessageListRenderer } from "./components/shared/MessageListRenderer";
import { useMessageManagement } from "./hooks/useMessageManagement";
import { useReadStatusManagement } from "./hooks/useReadStatusManagement";
import { useScrollManagement } from "./hooks/useScrollManagement";
import {
    calculateVirtuosoHight,
    calculateVirtuosoSubHight,
} from "./services/calculateVirtuosoHight";
import { handleFileDrop } from "./services/handleFileDrop";

import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { ChatProps, ThreadProps, ToDoFactProps } from "../../types/chat";
import { ProjectProps, TaskProps } from "../../types/tasks";
import { ToDoPane } from "./ToDoPane";

type MessagesPaneProps = {
    TEM: TeamManagementState;
    currentWindowHeight: number;
    paneSizePCT: number;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    CM: ChatManagementState;
    currentMainChatId: number;
    setCurrentProject: (value: ProjectProps) => void;
    setIsToDoVisible: (value: boolean) => void;
    isToDoVisible: boolean;
    todos: ToDoFactProps[];
    setTodos: (value: ToDoFactProps[]) => void;
    isExistingTodaysTodo: boolean;
    setIsExistingTodaysTodo: (value: boolean) => void;
    incompleteTodoCount: number;
    UIM: UIStateManagementState;
    TM: TaskManagementState;
};

export const MessagesPane = (props: MessagesPaneProps) => {
    const {
        currentMainChatId,
        currentWindowHeight,
        incompleteTodoCount,
        isExistingTodaysTodo,
        isToDoVisible,
        myself,
        paneSizePCT,
        setCurrentProject,
        setIsExistingTodaysTodo,
        setIsToDoVisible,
        setMyself,
        UIM,
        setTodos,
        socket,
        TEM,
        todos,
        CM,
        TM,
    } = props;

    const { mode } = useColorScheme();

    // Use shared hooks
    const messageManagement = useMessageManagement({
        chat: CM.currentMainChat as ChatProps | ThreadProps,
    });
    const readStatusManagement = useReadStatusManagement({
        currentChat: CM.currentMainChat as ChatProps | ThreadProps,
        myself,
        CM,
        isThread: false,
    });
    const scrollManagement = useScrollManagement({
        currentChat: CM.currentMainChat as ChatProps | ThreadProps,
        indexMap: messageManagement.indexMap,
        isThread: false,
    });

    // Handle read status updates
    useEffect(() => {
        setTimeout(() => {
            let targetIndex: number;
            if (CM.currentMainChat?.moveToSpecificIndex === undefined) {
                targetIndex = CM.currentMainChat?.messages?.length
                    ? CM.currentMainChat?.messages?.length - 1
                    : 0;
            } else if (
                messageManagement.indexMap &&
                messageManagement.indexMap[CM.currentMainChat?.moveToSpecificIndex] &&
                CM.currentMainChat?.chatId ===
                    Number(CM.currentMainChat?.moveToSpecificIndex?.split("-")[0])
            ) {
                targetIndex = Number(
                    messageManagement.indexMap[CM.currentMainChat?.moveToSpecificIndex]
                );
            } else {
                targetIndex = -1;
            }

            readStatusManagement.handleReadStatusUpdate(targetIndex);
        }, 1000);
    }, [messageManagement.indexMap]);

    useEffect(() => {
        readStatusManagement.handlePeriodicReadStatusUpdate(
            scrollManagement.visibleRange.endIndex
        );
    }, [scrollManagement.visibleRange]);

    useEffect(() => {
        setTimeout(() => {
            if (CM.currentMainChat?.latestMessage) {
                readStatusManagement.updateReadStatus(CM.currentMainChat?.latestMessage.messageId);
            }
        }, 300);
    }, [CM.currentMainChat]);

    const virtuosoHeight =
        CM.currentMainChat?.chatType === 3 || CM.currentMainChat?.chatType === 4
            ? 0.95 * window.innerHeight
            : CM.isSubChatVisible
              ? calculateVirtuosoSubHight(
                    currentWindowHeight,
                    paneSizePCT,
                    messageManagement.numEditorLines
                )
              : calculateVirtuosoHight(currentWindowHeight, messageManagement.numEditorLines);

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
                <Box
                    sx={{
                        height: "100%",
                        width: "100%",
                        borderColor: mode === "dark" ? "black" : "white",
                        borderRight: mode === "dark" ? "2px black inset" : "2px lightgrey inset",
                    }}
                >
                    <ErrorSnackbar
                        errorMessage={messageManagement.errorMessage}
                        errorOpen={messageManagement.errorOpen}
                        setErrorOpen={messageManagement.setErrorOpen}
                    />

                    {CM.currentMainChat && (
                        <MainChatPaneHeader
                            chat={CM.currentMainChat}
                            CM={CM}
                            incompleteTodoCount={incompleteTodoCount}
                            isToDoVisible={isToDoVisible}
                            myself={myself}
                            setIsToDoVisible={setIsToDoVisible}
                            setMyself={setMyself}
                            socket={socket}
                            TEM={TEM}
                            UIM={UIM}
                            TM={TM}
                        />
                    )}

                    {/* To-Do Pane for only myself */}
                    {isToDoVisible === true &&
                        CM.currentMainChat?.chatType === 1 &&
                        CM.currentMainChat?.dmPartnerUser.userId === myself.userId && (
                            <ToDoPane
                                CM={CM}
                                currentWindowHeight={currentWindowHeight}
                                isExistingTodaysTodo={isExistingTodaysTodo}
                                myself={myself}
                                setIsExistingTodaysTodo={setIsExistingTodaysTodo}
                                setMyself={setMyself}
                                setTodos={setTodos}
                                socket={socket}
                                TEM={TEM}
                                todos={todos}
                                UIM={UIM}
                            />
                        )}

                    {!(
                        isToDoVisible === true &&
                        CM.currentMainChat?.chatType === 1 &&
                        CM.currentMainChat?.dmPartnerUser.userId === myself.userId
                    ) && (
                        <>
                            <MessageListRenderer
                                chat={CM.currentMainChat as ChatProps | ThreadProps}
                                CM={CM}
                                currentChatId={currentMainChatId}
                                height={virtuosoHeight}
                                indexMap={messageManagement.indexMap}
                                isScrolling={scrollManagement.isScrolling}
                                isThread={false}
                                messages={messageManagement.messages}
                                myself={myself}
                                setCurrentProject={setCurrentProject}
                                setEditTargetMessage={messageManagement.setEditTargetMessage}
                                setErrorMessage={messageManagement.setErrorMessage}
                                setErrorOpen={messageManagement.setErrorOpen}
                                setIsInEdit={messageManagement.setIsInEdit}
                                setIsScrolling={scrollManagement.setIsScrolling}
                                setMyself={setMyself}
                                setVisibleRange={scrollManagement.setVisibleRange}
                                socket={socket}
                                TEM={TEM}
                                UIM={UIM}
                                visibleRange={scrollManagement.visibleRange}
                                virtuosoRef={
                                    scrollManagement.virtuosoRef as React.RefObject<VirtuosoHandle>
                                }
                                TM={TM}
                            />

                            {CM.currentMainChat?.chatType !== 3 &&
                                CM.currentMainChat?.chatType !== 4 && (
                                    <ChatEditorSection
                                        chat={CM.currentMainChat as ChatProps | ThreadProps}
                                        CM={CM}
                                        editTargetMessage={messageManagement.editTargetMessage}
                                        isInEdit={messageManagement.isInEdit}
                                        isThread={false}
                                        myself={myself}
                                        numEditorLines={messageManagement.numEditorLines}
                                        setCurrentThreadChat={undefined}
                                        setIsInEdit={messageManagement.setIsInEdit}
                                        setMyself={setMyself}
                                        setNumEditorLines={messageManagement.setNumEditorLines}
                                        socket={socket}
                                        TEM={TEM}
                                        thread={undefined}
                                        UIM={UIM}
                                        setCurrentChat={
                                            CM.setCurrentMainChat as (
                                                chat: ChatProps | ThreadProps
                                            ) => void
                                        }
                                    />
                                )}
                        </>
                    )}
                </Box>
            </Sheet>
        </div>
    );
};
