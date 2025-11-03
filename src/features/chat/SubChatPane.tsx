import { useEffect } from "react";
import { Box, Sheet } from "@mui/joy";
import { VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { SubChatPaneHeader } from "./components/headers/SubChatPaneHeader";
import { ChatEditorSection } from "./components/shared/ChatEditorSection";
import { ErrorSnackbar } from "./components/shared/ErrorSnackbar";
import { MessageListRenderer } from "./components/shared/MessageListRenderer";
import { useMessageManagement } from "./hooks/useMessageManagement";
import { useReadStatusManagement } from "./hooks/useReadStatusManagement";
import { useScrollManagement } from "./hooks/useScrollManagement";
import { calculateVirtuosoSubHight } from "./services/calculateVirtuosoHight";
import { handleFileDrop } from "./services/handleFileDrop";

import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { ChatProps, ThreadProps, ToDoFactProps } from "../../types/chat";
import { ToDoPane } from "./ToDoPane";

type MessagesPaneProps = {
    TEM: TeamManagementState;
    currentWindowHeight: number;
    paneSizePCT: number;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    currentSubChatId: number;
    PM: ProjectManagementState;
    isToDoVisible: boolean;
    setIsToDoVisible: (value: boolean) => void;
    todos: ToDoFactProps[];
    setTodos: (value: ToDoFactProps[]) => void;
    isExistingTodaysTodo: boolean;
    setIsExistingTodaysTodo: (value: boolean) => void;
    incompleteTodoCount: number;
    UIM: UIStateManagementState;
    CM: ChatManagementState;
    TM: TaskManagementState;
};

export const MessagesSubPane = (props: MessagesPaneProps) => {
    const {
        CM,
        currentSubChatId,
        currentWindowHeight,
        incompleteTodoCount,
        isExistingTodaysTodo,
        isToDoVisible,
        myself,
        paneSizePCT,
        PM,
        setIsExistingTodaysTodo,
        setIsToDoVisible,
        setMyself,
        UIM,
        setTodos,
        socket,
        TEM,
        todos,
        TM,
    } = props;

    if (!CM.currentSubChat) {
        return null;
    }

    // Use shared hooks
    const messageManagement = useMessageManagement({ chat: CM.currentSubChat });
    const readStatusManagement = useReadStatusManagement({
        currentChat: CM.currentSubChat,
        myself,
        CM,
        isThread: false,
    });
    const scrollManagement = useScrollManagement({
        currentChat: CM.currentSubChat,
        indexMap: messageManagement.indexMap,
        isThread: false,
    });

    // Handle read status updates
    useEffect(() => {
        setTimeout(() => {
            if (CM.currentSubChat) {
                let targetIndex: number;
                if (CM.currentSubChat.moveToSpecificIndex === undefined) {
                    targetIndex = CM.currentSubChat.messages.length - 1;
                } else if (
                    CM.currentSubChat.moveToSpecificIndex &&
                    messageManagement.indexMap &&
                    messageManagement.indexMap[CM.currentSubChat.moveToSpecificIndex] &&
                    CM.currentSubChat.chatId ===
                        Number(CM.currentSubChat.moveToSpecificIndex?.split("-")[0])
                ) {
                    targetIndex = Number(
                        messageManagement.indexMap[CM.currentSubChat.moveToSpecificIndex]
                    );
                } else {
                    targetIndex = -1;
                }

                readStatusManagement.handleReadStatusUpdate(targetIndex);
            }
        }, 1000);
    }, [messageManagement.indexMap]);

    useEffect(() => {
        readStatusManagement.handlePeriodicReadStatusUpdate(
            scrollManagement.visibleRange.endIndex
        );
    }, [scrollManagement.visibleRange]);

    const virtuosoHeight = calculateVirtuosoSubHight(
        currentWindowHeight,
        paneSizePCT,
        messageManagement.numEditorLines
    );

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
        >
            <Sheet sx={{ backgroundColor: "background.level1" }}>
                <ErrorSnackbar
                    errorMessage={messageManagement.errorMessage}
                    errorOpen={messageManagement.errorOpen}
                    setErrorOpen={messageManagement.setErrorOpen}
                />

                <SubChatPaneHeader
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

                {/* To-Do Pane for only myself */}
                {isToDoVisible === true &&
                    CM.currentSubChat.chatType === 1 &&
                    CM.currentSubChat.dmPartnerUser.userId === myself.userId && (
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
                    CM.currentSubChat.chatType === 1 &&
                    CM.currentSubChat.dmPartnerUser.userId === myself.userId
                ) &&
                    CM.currentSubChat &&
                    messageManagement.messages && (
                        <>
                            <MessageListRenderer
                                chat={CM.currentSubChat}
                                CM={CM}
                                currentChatId={currentSubChatId}
                                height={virtuosoHeight}
                                indexMap={messageManagement.indexMap}
                                isScrolling={scrollManagement.isScrolling}
                                isThread={false}
                                messages={messageManagement.messages}
                                myself={myself}
                                PM={PM}
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
                            <ChatEditorSection
                                chat={CM.currentSubChat as ChatProps | ThreadProps}
                                CM={CM}
                                editTargetMessage={messageManagement.editTargetMessage}
                                isInEdit={messageManagement.isInEdit}
                                isThread={false}
                                myself={myself}
                                numEditorLines={messageManagement.numEditorLines}
                                setIsInEdit={messageManagement.setIsInEdit}
                                setMyself={setMyself}
                                setNumEditorLines={messageManagement.setNumEditorLines}
                                socket={socket}
                                TEM={TEM}
                                UIM={UIM}
                                setCurrentChat={
                                    CM.setCurrentSubChat as (chat: ChatProps | ThreadProps) => void
                                }
                            />
                        </>
                    )}
            </Sheet>
        </div>
    );
};
