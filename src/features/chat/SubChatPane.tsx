// `simple-import-sort/imports` disabled file-wide: prettier and
// simple-import-sort disagree on the placement of `./ToDoPane`
// (auto-fix loops between the two). Prettier wins per project
// convention.

import { useCallback, useMemo, useState } from "react";
import { Sheet } from "@mui/joy";
import { VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { SubChatPaneHeader } from "./components/headers/SubChatPaneHeader";
import { ChatEditorSection } from "./components/shared/ChatEditorSection";
import { ErrorSnackbar } from "./components/shared/ErrorSnackbar";
import { MessageListRenderer } from "./components/shared/MessageListRenderer";
import { RetentionBanner } from "./components/shared/RetentionBanner";
import { useFirstUnreadIndex } from "./hooks/useFirstUnreadIndex";
import { useMessageManagement } from "./hooks/useMessageManagement";
import { useReadStatusManagement } from "./hooks/useReadStatusManagement";
import { useScrollManagement } from "./hooks/useScrollManagement";
import { createFileDropHandler } from "./services/handleFileDrop";

import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UseTodoGroupsState } from "../../hooks/useTodoGroups";
import { UserProps } from "../../types/admin";
import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../types/chat";
import { TaskCommentProps } from "../../types/tasks";
import { ToDoPane } from "./ToDoPane";

// PUNCH LIST (v3 chatId migration): `chatId` and `lastReadMessageId`
// are `string` post-flip. The empty-string sentinel replaces the
// legacy `-1` / `0`. This placeholder is never rendered — it exists
// so `useMessageManagement` etc. can be called unconditionally above
// the `if (!useCM.currentSubChat) return null` guard.
// Keys sorted alphabetically per `sort-keys` (case-insensitive).
const EMPTY_CHAT: ChatProps = {
    chatId: "",
    chatName: "",
    chatType: 0,
    dmPartnerUser: {
        avatarImgPath: "",
        teamId: "",
        teamName: "",
        tsJoined: "",
        tsLastSeen: "",
        userEmail: "",
        userId: "",
        userName: "",
    },
    isPrivate: false,
    lastReadMessageId: "",
    latestMessage: undefined as unknown as MessageProps,
    latestMessageText: "",
    messages: [],
    profileImagePath: "",
    TSLastMessage: "",
};

type MessagesPaneProps = {
    useTEM: TeamManagementState;
    currentWindowHeight: number;
    paneSizePCT: number;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    currentSubChatId: number;
    usePM: ProjectManagementState;
    isToDoVisible: boolean;
    setIsToDoVisible: (value: boolean) => void;
    useTG?: UseTodoGroupsState | null;
    incompleteTodoCount: number;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    setTodoFromMessageBubble: (
        todoFromMessageBubble: MessageProps | ThreadMessageProps | TaskCommentProps
    ) => void;
};

export const MessagesSubPane = (props: MessagesPaneProps) => {
    const {
        useCM,
        currentSubChatId,
        currentWindowHeight,
        incompleteTodoCount,
        isToDoVisible,
        myself,
        usePM,
        setIsToDoVisible,
        setMyself,
        useUISM,
        socket,
        useTEM,
        useTG,
        useTM,
        setTodoFromMessageBubble,
    } = props;

    // File drag-and-drop state
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const clearPendingFiles = useCallback(() => setPendingFiles([]), []);
    // `createFileDropHandler(setPendingFiles)` returns a stable handler; the
    // factory itself isn't a stable reference but `setPendingFiles` is the
    // only meaningful dependency and never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleDrop = useCallback(createFileDropHandler(setPendingFiles), []);

    // Use a stable placeholder when currentSubChat is null so hooks are always called
    const chatForHooks = useMemo(() => useCM.currentSubChat ?? EMPTY_CHAT, [useCM.currentSubChat]);

    // Use shared hooks (must be called unconditionally)
    const messageManagement = useMessageManagement({ chat: chatForHooks });
    const readStatusManagement = useReadStatusManagement({
        currentChat: chatForHooks,
        isThread: false,
        myself,
        useCM,
    });
    // First-unread landing for the open sub-chat, frozen per chat. Safe on the
    // EMPTY_CHAT placeholder (chatId ""): no cursor for it → null → bottom.
    const firstUnreadIndex = useFirstUnreadIndex({
        chat: chatForHooks,
        isThread: false,
    });
    const scrollManagement = useScrollManagement({
        currentChat: chatForHooks,
        indexMap: messageManagement.indexMap,
        isThread: false,
        firstUnreadIndex,
        // Only tracks the visible range now; it no longer advances the read
        // cursor (the rendered range includes the overscan below the fold —
        // see the note in `useReadStatusManagement`). The cursor advances from
        // genuinely-seen bubbles via `onMessageSeenIndex` → `handleSeenIndex`.
        onRangeChange: undefined,
    });

    if (!useCM.currentSubChat) {
        return null;
    }

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                width: "100%",
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
        >
            <Sheet
                sx={{
                    backgroundColor: "background.level1",
                    display: "flex",
                    flex: 1,
                    flexDirection: "column",
                    minHeight: 0,
                }}
            >
                <ErrorSnackbar
                    errorMessage={messageManagement.errorMessage}
                    errorOpen={messageManagement.errorOpen}
                    setErrorOpen={messageManagement.setErrorOpen}
                />

                <SubChatPaneHeader
                    incompleteTodoCount={incompleteTodoCount}
                    isToDoVisible={isToDoVisible}
                    myself={myself}
                    setIsToDoVisible={setIsToDoVisible}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useTEM={useTEM}
                    useTM={useTM}
                    useUISM={useUISM}
                />

                {/* Tier retention: "history limited" strip (see
                    RetentionBanner). */}
                <RetentionBanner channelId={useCM.currentSubChat?.chatId} />

                {/* To-Do Pane for only myself */}
                {isToDoVisible === true &&
                    useCM.currentSubChat.chatType === 1 &&
                    useCM.currentSubChat.dmPartnerUser.userId === myself.userId &&
                    useTG && (
                        <ToDoPane
                            currentWindowHeight={currentWindowHeight}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
                            useTEM={useTEM}
                            useTG={useTG}
                            useUISM={useUISM}
                        />
                    )}

                {!(
                    isToDoVisible === true &&
                    useCM.currentSubChat.chatType === 1 &&
                    useCM.currentSubChat.dmPartnerUser.userId === myself.userId
                ) &&
                    useCM.currentSubChat &&
                    messageManagement.messages && (
                        <>
                            <MessageListRenderer
                                chat={useCM.currentSubChat}
                                currentChatId={currentSubChatId}
                                firstUnreadIndex={firstUnreadIndex}
                                height={0}
                                indexMap={messageManagement.indexMap}
                                isThread={false}
                                messages={messageManagement.messages}
                                myself={myself}
                                setEditTargetMessage={messageManagement.setEditTargetMessage}
                                setIsInEdit={messageManagement.setIsInEdit}
                                setMyself={setMyself}
                                setTodoFromMessageBubble={setTodoFromMessageBubble}
                                socket={socket}
                                useCM={useCM}
                                usePM={usePM}
                                useTEM={useTEM}
                                useTM={useTM}
                                useUISM={useUISM}
                                visibleRangeRef={scrollManagement.visibleRangeRef}
                                virtuosoRef={
                                    scrollManagement.virtuosoRef as React.RefObject<VirtuosoHandle>
                                }
                                fillContainer
                                onMessageSeenIndex={readStatusManagement.handleSeenIndex}
                                onRangeChanged={scrollManagement.handleRangeChanged}
                            />
                            <ChatEditorSection
                                chat={useCM.currentSubChat as ChatProps | ThreadProps}
                                clearPendingFiles={clearPendingFiles}
                                editTargetMessage={messageManagement.editTargetMessage}
                                isInEdit={messageManagement.isInEdit}
                                isThread={false}
                                myself={myself}
                                numEditorLines={messageManagement.numEditorLines}
                                pendingFiles={pendingFiles}
                                setIsInEdit={messageManagement.setIsInEdit}
                                setMyself={setMyself}
                                setNumEditorLines={messageManagement.setNumEditorLines}
                                socket={socket}
                                useCM={useCM}
                                useTEM={useTEM}
                                useUISM={useUISM}
                                setCurrentChat={
                                    useCM.setCurrentSubChat as (
                                        chat: ChatProps | ThreadProps
                                    ) => void
                                }
                            />
                        </>
                    )}
            </Sheet>
        </div>
    );
};
