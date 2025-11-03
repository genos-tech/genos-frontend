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
    CM: ChatManagementState;
    TM: TaskManagementState;
    PM: ProjectManagementState;
    TEM: TeamManagementState;
    myself: UserProps;
    currentSubChatId: number;
    currentWindowHeight: number;
    subChatPanelSize: number;
    setSubChatPanelSize: (size: number) => void;
    incompleteTodoCount: number;
    isExistingTodaysTodo: boolean;
    isToDoVisible: boolean;
    todos: ToDoFactProps[];
    setTodos: (todos: ToDoFactProps[]) => void;
    setIsExistingTodaysTodo: (value: boolean) => void;
    socket: any;
    setMyself: (me: UserProps) => void;
    UIM: UIStateManagementState;
}

export const SubChatPanel = ({
    CM,
    TM,
    PM,
    TEM,
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
    UIM,
}: SubChatPanelProps) => {
    const { mode } = useColorScheme();

    return (
        <Panel id={"3"} maxSize={80} minSize={30} order={3} onResize={setSubChatPanelSize}>
            <Box
                sx={{
                    height: "100%",
                    width: "100%",
                    borderColor: mode === "dark" ? "black" : "white",
                    borderRight: mode === "dark" ? "2px black inset" : "2px lightgrey inset",
                }}
            >
                <MessagesSubPane
                    CM={CM}
                    currentSubChatId={currentSubChatId}
                    currentWindowHeight={currentWindowHeight}
                    incompleteTodoCount={incompleteTodoCount}
                    isExistingTodaysTodo={isExistingTodaysTodo}
                    isToDoVisible={isToDoVisible}
                    myself={myself}
                    paneSizePCT={subChatPanelSize}
                    setCurrentProject={PM.setCurrentProject}
                    setIsExistingTodaysTodo={setIsExistingTodaysTodo}
                    setIsToDoVisible={() => {}}
                    setMyself={setMyself}
                    setTodos={setTodos}
                    socket={socket}
                    TEM={TEM}
                    todos={todos}
                    UIM={UIM}
                    TM={TM}
                />
            </Box>
        </Panel>
    );
};
