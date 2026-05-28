import { Box, useColorScheme } from "@mui/joy";
import { Panel } from "react-resizable-panels";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UseTodoGroupsState } from "../../../../hooks/useTodoGroups";
import { UserProps } from "../../../../types/admin";
import { MessageProps, ThreadMessageProps } from "../../../../types/chat";
import { TaskCommentProps } from "../../../../types/tasks";
import { MessagesSubPane } from "../../SubChatPane";

interface SubChatPanelProps {
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    useTEM: TeamManagementState;
    myself: UserProps;
    currentSubChatId: number;
    currentWindowHeight: number;
    subChatPanelSize: number;
    setSubChatPanelSize: (size: number) => void;
    incompleteTodoCount: number;
    isToDoVisible: boolean;
    useTG: UseTodoGroupsState;
    socket: any;
    setMyself: (me: UserProps) => void;
    useUISM: UIStateManagementState;
    todoFromMessageBubble: MessageProps | ThreadMessageProps | TaskCommentProps | null;
    setTodoFromMessageBubble: (
        todoFromMessageBubble: MessageProps | ThreadMessageProps | TaskCommentProps
    ) => void;
}

export const SubChatPanel = ({
    useCM,
    useTM,
    usePM,
    useTEM,
    myself,
    currentSubChatId,
    currentWindowHeight,
    subChatPanelSize,
    setSubChatPanelSize,
    incompleteTodoCount,
    isToDoVisible,
    useTG,
    socket,
    setMyself,
    useUISM,
    setTodoFromMessageBubble,
}: SubChatPanelProps) => {
    const { mode } = useColorScheme();

    return (
        <Panel id={"3"} maxSize={80} minSize={30} order={3} onResize={setSubChatPanelSize}>
            <Box
                sx={{
                    height: "100%",
                    width: "100%",
                    borderColor: mode === "dark" ? "black" : "white",
                    borderRight: mode === "dark" ? "1px black inset" : "1px lightgrey inset",
                }}
            >
                <MessagesSubPane
                    currentSubChatId={currentSubChatId}
                    currentWindowHeight={currentWindowHeight}
                    incompleteTodoCount={incompleteTodoCount}
                    isToDoVisible={isToDoVisible}
                    myself={myself}
                    paneSizePCT={subChatPanelSize}
                    setIsToDoVisible={() => {}}
                    setMyself={setMyself}
                    setTodoFromMessageBubble={setTodoFromMessageBubble}
                    socket={socket}
                    useCM={useCM}
                    usePM={usePM}
                    useTEM={useTEM}
                    useTG={useTG}
                    useTM={useTM}
                    useUISM={useUISM}
                />
            </Box>
        </Panel>
    );
};
