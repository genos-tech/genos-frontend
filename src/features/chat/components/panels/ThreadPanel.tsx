import { Box } from "@mui/joy";
import { Panel } from "react-resizable-panels";
import type { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { MessageProps, ThreadMessageProps } from "../../../../types/chat";
import { TaskCommentProps } from "../../../../types/tasks";
import { ThreadPane } from "../../ThreadChatPane";

interface ThreadPanelProps {
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    useTEM: TeamManagementState;
    useNM: NoteManagementState;
    myself: UserProps;
    currentThreadChatId: number;
    currentWindowHeight: number;
    socket: Socket | null;
    setMyself: (me: UserProps) => void;
    useUISM: UIStateManagementState;
    usePM: ProjectManagementState;
    setTodoFromMessageBubble: (
        todoFromMessageBubble: MessageProps | ThreadMessageProps | TaskCommentProps
    ) => void;
}

export const ThreadPanel = ({
    useCM,
    useTM,
    usePM,
    useTEM,
    useNM,
    myself,
    currentThreadChatId,
    currentWindowHeight,
    socket,
    setMyself,
    useUISM,
    setTodoFromMessageBubble,
}: ThreadPanelProps) => {
    return (
        <Panel id={"5"} maxSize={70} minSize={25} order={5}>
            <Box
                sx={{
                    height: "100%",
                    backgroundColor: "black",
                }}
            >
                {useCM.currentThreadChat && (
                    <ThreadPane
                        currentThreadChatId={currentThreadChatId}
                        currentWindowHeight={currentWindowHeight}
                        myself={myself}
                        setMyself={setMyself}
                        setTodoFromMessageBubble={setTodoFromMessageBubble}
                        socket={socket}
                        useCM={useCM}
                        useNM={useNM}
                        usePM={usePM}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                    />
                )}
            </Box>
        </Panel>
    );
};
