import { Box, useColorScheme } from "@mui/joy";
import { Panel } from "react-resizable-panels";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ToDoFactProps } from "../../../../types/chat";
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
    isExistingTodaysTodo: boolean;
    isToDoVisible: boolean;
    todos: ToDoFactProps[];
    setTodos: React.Dispatch<React.SetStateAction<ToDoFactProps[]>>;
    setIsExistingTodaysTodo: (value: boolean) => void;
    socket: any;
    setMyself: (me: UserProps) => void;
    useUISM: UIStateManagementState;
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
    isExistingTodaysTodo,
    isToDoVisible,
    todos,
    setTodos,
    setIsExistingTodaysTodo,
    socket,
    setMyself,
    useUISM,
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
                    useCM={useCM}
                    currentSubChatId={currentSubChatId}
                    currentWindowHeight={currentWindowHeight}
                    incompleteTodoCount={incompleteTodoCount}
                    isExistingTodaysTodo={isExistingTodaysTodo}
                    isToDoVisible={isToDoVisible}
                    myself={myself}
                    paneSizePCT={subChatPanelSize}
                    setIsExistingTodaysTodo={setIsExistingTodaysTodo}
                    setIsToDoVisible={() => {}}
                    setMyself={setMyself}
                    setTodos={setTodos}
                    socket={socket}
                    useTEM={useTEM}
                    todos={todos}
                    useUISM={useUISM}
                    useTM={useTM}
                    usePM={usePM}
                />
            </Box>
        </Panel>
    );
};
