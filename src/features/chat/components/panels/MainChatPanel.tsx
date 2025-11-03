import { Box, IconButton, useColorScheme } from "@mui/joy";
import { Panel } from "react-resizable-panels";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ToDoFactProps } from "../../../../types/chat";
import { MessagesPane } from "../../MainChatPane";

interface MainChatPanelProps {
    CM: ChatManagementState;
    TM: TaskManagementState;
    PM: ProjectManagementState;
    TEM: TeamManagementState;
    myself: UserProps;
    currentMainChatId: number;
    currentWindowHeight: number;
    mainChatPanelSize: number;
    setMainChatPanelSize: (size: number) => void;
    incompleteTodoCount: number;
    isExistingTodaysTodo: boolean;
    isToDoVisible: boolean;
    setIsToDoVisible: (value: boolean) => void;
    todos: ToDoFactProps[];
    setTodos: (todos: ToDoFactProps[]) => void;
    setIsExistingTodaysTodo: (value: boolean) => void;
    socket: any;
    setMyself: (me: UserProps) => void;
    UIM: UIStateManagementState;
}

export const MainChatPanel = ({
    CM,
    TM,
    PM,
    TEM,
    myself,
    currentMainChatId,
    currentWindowHeight,
    mainChatPanelSize,
    setMainChatPanelSize,
    incompleteTodoCount,
    isExistingTodaysTodo,
    isToDoVisible,
    setIsToDoVisible,
    todos,
    setTodos,
    setIsExistingTodaysTodo,
    socket,
    setMyself,
    UIM,
}: MainChatPanelProps) => {
    const { mode } = useColorScheme();

    return (
        <Panel id={"4"} maxSize={80} minSize={30} order={4} onResize={setMainChatPanelSize}>
            {/* No chat selected */}
            {CM.currentMainChat && CM.currentMainChat.chatId === -1 && (
                <Box
                    sx={{
                        height: "100%",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        width: "100%",
                        borderRight: mode === "dark" ? "2px black inset" : "2px lightgrey inset",
                    }}
                >
                    <IconButton
                        color="neutral"
                        component="button"
                        variant="soft"
                        sx={{
                            fontSize: "15px",
                            padding: "10px",
                        }}
                    >
                        No Chat Selected
                    </IconButton>
                </Box>
            )}

            {/* Chat selected */}
            {CM.currentMainChat && CM.currentMainChat.chatId !== -1 && (
                <MessagesPane
                    CM={CM}
                    currentMainChatId={currentMainChatId}
                    currentWindowHeight={currentWindowHeight}
                    incompleteTodoCount={incompleteTodoCount}
                    isCreatingTask={TM.isCreatingTask}
                    isExistingTodaysTodo={isExistingTodaysTodo}
                    isToDoVisible={isToDoVisible}
                    myself={myself}
                    paneSizePCT={mainChatPanelSize}
                    setCurrentPreviewTask={TM.setCurrentPreviewTask}
                    setCurrentPreviewTaskId={TM.setCurrentPreviewTaskId}
                    setCurrentProject={PM.setCurrentProject}
                    setIsCreatingTask={TM.setIsCreatingTask}
                    setIsExistingTodaysTodo={setIsExistingTodaysTodo}
                    setIsTaskPreviewVisible={TM.setIsTaskPreviewVisible}
                    setIsToDoVisible={setIsToDoVisible}
                    setMyself={setMyself}
                    setTodos={setTodos}
                    socket={socket}
                    TEM={TEM}
                    todos={todos}
                    UIM={UIM}
                />
            )}
        </Panel>
    );
};
