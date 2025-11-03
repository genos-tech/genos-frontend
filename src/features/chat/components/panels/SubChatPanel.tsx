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
                    chat={CM.currentMainChat}
                    currentSubChat={CM.currentSubChat}
                    currentSubChatId={currentSubChatId}
                    currentThreadChat={CM.currentThreadChat}
                    currentWindowHeight={currentWindowHeight}
                    flaggedMessages={CM.flaggedMessages}
                    funcSetAllChats={CM.funcSetAllChats}
                    incompleteTodoCount={incompleteTodoCount}
                    isCreatingTask={TM.isCreatingTask}
                    isExistingTodaysTodo={isExistingTodaysTodo}
                    isThreadVisible={CM.isThreadVisible}
                    isToDoVisible={isToDoVisible}
                    myself={myself}
                    paneSizePCT={subChatPanelSize}
                    setCurrentMainChat={CM.setCurrentMainChat}
                    setCurrentPreviewTask={TM.setCurrentPreviewTask}
                    setCurrentPreviewTaskId={TM.setCurrentPreviewTaskId}
                    setCurrentProject={PM.setCurrentProject}
                    setCurrentSubChat={CM.setCurrentSubChat}
                    setCurrentThreadChat={CM.setCurrentThreadChat}
                    setFlaggedMessages={CM.setFlaggedMessages}
                    setIsCreatingTask={TM.setIsCreatingTask}
                    setIsExistingTodaysTodo={setIsExistingTodaysTodo}
                    setIsMainChatVisible={CM.setIsMainChatVisible}
                    setIsSubChatVisible={CM.setIsSubChatVisible}
                    setIsTaskPreviewVisible={TM.setIsTaskPreviewVisible}
                    setIsThreadVisible={CM.setIsThreadVisible}
                    setIsToDoVisible={() => {}}
                    setMyself={setMyself}
                    UIM={UIM}
                    setTodos={setTodos}
                    socket={socket}
                    subChat={CM.currentSubChat ? CM.currentSubChat : CM.currentMainChat}
                    TEM={TEM}
                    todos={todos}
                    showOnlyInCompleteTodos={CM.showOnlyInCompleteTodos}
                    setShowOnlyInCompleteTodos={CM.setShowOnlyInCompleteTodos}
                />
            </Box>
        </Panel>
    );
};
