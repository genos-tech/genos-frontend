import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { ChatProvider } from "../../../features/chat/context/ChatContext";
import { MessagesPane } from "../../../features/chat/MainChatPane";
import { loadV3SpecificMessages } from "../../../features/chat/services/loadV3SpecificMessages";
import { loadV3SpecificThreadMessages } from "../../../features/chat/services/loadV3SpecificThreadMessages";
import { ThreadPane } from "../../../features/chat/ThreadChatPane";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../i18n";
import { UserProps } from "../../../types/admin";
import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../../types/chat";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { ChatMainTarget, ChatThreadTarget } from "../../../utils/parseInternalUrl";
import { useModalLocalTaskComments } from "./useModalLocalTaskComments";

type ModalChatViewProps = {
    target: ChatMainTarget | ChatThreadTarget;
    accessToken: string | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    useNM: NoteManagementState;
};

// The modal never renders ToDoPane, so we pass placeholder/no-op
// values for the todo-related props that MessagesPane still requires.
const NOOP_TODOS_PROPS = {
    incompleteTodoCount: 0,
    isToDoVisible: false,
    setIsToDoVisible: () => {},
    setTodoFromMessageBubble: () => {},
    useTG: null as null,
};

// Renders MessagesPane / ThreadPane against modal-local chat + thread
// state, so the user's existing main-page selection (the real
// useCM.currentMainChat / useCM.currentThreadChat) is left untouched.
//
// Writes (reactions, edits, replies, read-status emit, etc.) still pass
// through to the real hooks because every setter we don't override is
// inherited from the spread.
//
// Known limitation: the modal is a snapshot at load time. Messages that
// arrive over the WebSocket while the modal is open update
// `useCM.currentMainChat.messages` on the underlying page, but the
// modal's `modalChat.messages` stays frozen. Closing + reopening the
// modal refreshes it. Accepted for Phase 1 per the planning session.
export const ModalChatView = (props: ModalChatViewProps) => {
    const {
        target,
        accessToken,
        myself,
        setMyself,
        socket,
        useTEM,
        useUISM,
        useCM,
        useTM,
        usePM,
        useNM,
    } = props;

    const { t } = useTranslation();
    const [modalChat, setModalChat] = useState<ChatProps | null>(null);
    const [modalThread, setModalThread] = useState<ThreadProps | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Local stand-in for ChatProvider's currentThreadTaskId slot. The
    // ThreadPane subtree (ThreadChatPaneHeader, etc.) reads/writes this
    // via useChatContext(); we keep it scoped to the modal so we don't
    // collide with the host page's own ChatProvider value.
    const [modalThreadTaskId, setModalThreadTaskId] = useState<number>(-1);

    // Modal-local comment slots — see the hook's doc comment. The
    // thread branch renders ThreadCommentsView (via ThreadPane), whose
    // comment load writes `setTaskComments`; without this override a PM
    // task-thread link opened while a task preview is visible on the
    // host page would overwrite that preview's Comments tab.
    const localTaskComments = useModalLocalTaskComments();
    const useTMOverride: TaskManagementState = { ...useTM, ...localTaskComments };

    // Pulled out of the deps array so eslint can statically check them.
    // `targetThreadId` is undefined for `chatMain` targets; tracking
    // `targetMessageId` here lets the modal re-scroll when the same chat
    // is reopened with a different /message/:id deep-link.
    const targetThreadId = target.kind === "chatThread" ? target.threadId : undefined;
    const targetMessageId = target.messageId;

    // Load chat (and thread, when applicable) whenever the target changes.
    // A `cancelled` flag protects against the user flicking through a
    // sequence of links faster than the network can respond — late
    // resolutions would otherwise paint stale data.
    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setErrorMessage(null);
        setModalChat(null);
        setModalThread(null);

        // PUNCH LIST (v3 chatId migration): `AllChatProps.chatId` is
        // `string` post-flip; `target.chatId` (history target) is still
        // `number`. Stringify at the comparison.
        const summary = useCM.allChats.find(
            (c) => c.chatId === String(target.chatId) && c.chatType === target.chatType
        );
        if (!summary) {
            setErrorMessage(t.common.modalView.chatUnavailable);
            setIsLoading(false);
            return () => {
                cancelled = true;
            };
        }

        (async () => {
            try {
                // v3 source. `target.chatId` carries the channel UUID
                // via the legacy `number` slot (modal entries flow
                // through `useCM.allChats` which is v3-sourced).
                // `loadV3SpecificMessages` triggers `syncChannel`
                // (REST + cache) and returns legacy-shape rows.
                const messages: MessageProps[] = await loadV3SpecificMessages(
                    target.chatId as unknown as string,
                    target.chatType
                );
                if (cancelled) return;

                if (messages.length === 0) {
                    setErrorMessage(t.common.modalView.noMessagesYet);
                    setIsLoading(false);
                    return;
                }

                const lastMessage = messages[messages.length - 1];
                const moveToSpecificIndex =
                    target.kind === "chatMain" && target.messageId
                        ? `${target.chatId}-${target.messageId}`
                        : target.kind === "chatThread"
                          ? `${target.chatId}-${target.threadId}`
                          : undefined;

                const newChat: ChatProps = {
                    chatId: summary.chatId,
                    chatName: summary.chatName,
                    chatType: summary.chatType,
                    dmPartnerUser: summary.dmPartnerUser,
                    isPrivate: summary.isPrivate,
                    // `ChatProps.lastReadMessageId` is `string` post-flip.
                    lastReadMessageId: String(lastMessage.messageId),
                    latestMessage: summary.latestMessage,
                    latestMessageText: summary.latestMessageText,
                    messages,
                    moveToSpecificIndex,
                    profileImagePath: summary.profileImagePath,
                    project: summary.project,
                    systemUserId: summary.systemUserId,
                    TSLastMessage: summary.TSLastMessage,
                };
                setModalChat(newChat);

                // Step 2: thread load, only when target is a thread URL.
                if (target.kind === "chatThread") {
                    // v3 source. `target.chatId` and `target.threadId`
                    // carry v3 UUIDs through their legacy `number`
                    // slots. PM vs non-PM no longer matters at this
                    // layer — `loadV3SpecificThreadMessages` resolves
                    // both via the snapshot.
                    const threadMessages: ThreadMessageProps[] =
                        await loadV3SpecificThreadMessages(
                            target.chatId as unknown as string,
                            target.threadId as unknown as string,
                            target.chatType
                        );
                    if (cancelled) return;

                    if (!threadMessages || threadMessages.length === 0) {
                        setErrorMessage(t.common.modalView.threadEmpty);
                        setIsLoading(false);
                        return;
                    }

                    const firstMessage = threadMessages[0];
                    const useTaskIdAsThreadId = target.chatType === 3;
                    const threadMoveIndex = target.messageId
                        ? `${target.chatId}-${target.threadId}-${target.messageId}`
                        : `${target.chatId}-${target.threadId}-1`;

                    const newThread: ThreadProps = {
                        chatId: target.chatId,
                        chatName: summary.chatName,
                        chatType: target.chatType,
                        dmPartnerUser: myself,
                        messages: threadMessages,
                        moveToSpecificIndex: threadMoveIndex,
                        project: firstMessage.project,
                        systemUserId: summary.systemUserId,
                        taskExist: firstMessage.taskExist,
                        taskId: firstMessage.taskId || null,
                        threadId: useTaskIdAsThreadId ? firstMessage.threadId : target.threadId,
                        TSLastMessage: getLocalCurrentTimestamp(),
                    };
                    setModalThread(newThread);
                }
                setIsLoading(false);
            } catch (e) {
                if (!cancelled) {
                    console.error("ModalChatView load failed:", e);
                    setErrorMessage(t.common.modalView.chatLoadFailed);
                    setIsLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        target.kind,
        target.chatId,
        target.chatType,
        targetThreadId,
        targetMessageId,
        accessToken,
    ]);

    if (errorMessage) {
        return (
            <Box
                sx={{
                    alignItems: "center",
                    display: "flex",
                    height: "100%",
                    justifyContent: "center",
                    p: 4,
                    width: "100%",
                }}
            >
                <Typography level="body-md" sx={{ color: "neutral.500" }}>
                    {errorMessage}
                </Typography>
            </Box>
        );
    }

    if (isLoading || !modalChat) {
        return (
            <Box
                sx={{
                    alignItems: "center",
                    display: "flex",
                    height: "100%",
                    justifyContent: "center",
                    p: 4,
                    width: "100%",
                }}
            >
                <Typography level="body-md" sx={{ color: "neutral.500" }}>
                    {t.common.modalView.loadingChat}
                </Typography>
            </Box>
        );
    }

    // `currentWindowHeight` is still required by the MessagesPane /
    // ThreadPane prop types (ToDoPane consumes it on the chat page),
    // but since both panes are now flex-driven inside the modal, the
    // value isn't used for layout. Pass 0 so we don't fake a viewport
    // height that could mislead consumers.
    const modalWindowHeight = 0;

    if (target.kind === "chatThread") {
        if (!modalThread) {
            return (
                <Box
                    sx={{
                        alignItems: "center",
                        display: "flex",
                        height: "100%",
                        justifyContent: "center",
                        p: 4,
                        width: "100%",
                    }}
                >
                    <Typography level="body-md" sx={{ color: "neutral.500" }}>
                        {t.common.modalView.loadingThread}
                    </Typography>
                </Box>
            );
        }
        const useCMOverride = {
            ...useCM,
            currentMainChat: modalChat,
            currentThreadChat: modalThread,
        };
        // ThreadPane (and its header) read state via `useChatContext()`,
        // which throws when no provider is above. Our modal is portaled to
        // document.body, outside ChatHome's ChatProvider, so we mount our
        // own with modal-scoped thread-task state.
        return (
            <ChatProvider
                currentThreadTaskId={modalThreadTaskId}
                myself={myself}
                setCurrentThreadTaskId={setModalThreadTaskId}
                setMyself={setMyself}
                socket={socket}
                useCM={useCMOverride}
                useNM={useNM}
                usePM={usePM}
                useTEM={useTEM}
                useTM={useTMOverride}
                useUISM={useUISM}
            >
                <Box sx={{ height: "100%", width: "100%" }}>
                    <ThreadPane
                        currentThreadChatId={target.threadId}
                        currentWindowHeight={modalWindowHeight}
                        myself={myself}
                        setMyself={setMyself}
                        setTodoFromMessageBubble={NOOP_TODOS_PROPS.setTodoFromMessageBubble}
                        socket={socket}
                        useCM={useCMOverride}
                        useNM={useNM}
                        usePM={usePM}
                        useTEM={useTEM}
                        useTM={useTMOverride}
                        useUISM={useUISM}
                    />
                </Box>
            </ChatProvider>
        );
    }

    const useCMOverride = {
        ...useCM,
        currentMainChat: modalChat,
    };
    return (
        <Box sx={{ height: "100%", width: "100%" }}>
            <MessagesPane
                currentMainChatId={target.chatId}
                currentWindowHeight={modalWindowHeight}
                myself={myself}
                paneSizePCT={100}
                setMyself={setMyself}
                socket={socket}
                useCM={useCMOverride}
                usePM={usePM}
                useTEM={useTEM}
                useTM={useTMOverride}
                useUISM={useUISM}
                {...NOOP_TODOS_PROPS}
            />
        </Box>
    );
};
