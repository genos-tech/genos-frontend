import { Box, IconButton } from "@mui/joy";
import { Panel } from "react-resizable-panels";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
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
    setOpeningService: (service: number) => void;
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
    setOpeningService,
}: MainChatPanelProps) => {
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
                    chat={CM.currentMainChat}
                    currentMainChat={CM.currentMainChat}
                    currentMainChatId={currentMainChatId}
                    currentThreadChat={CM.currentThreadChat}
                    currentWindowHeight={currentWindowHeight}
                    flaggedMessages={CM.flaggedMessages}
                    funcSetAllChats={CM.funcSetAllChats}
                    incompleteTodoCount={incompleteTodoCount}
                    isCreatingTask={TM.isCreatingTask}
                    isExistingTodaysTodo={isExistingTodaysTodo}
                    isSubChatVisible={CM.isSubChatVisible}
                    isThreadVisible={CM.isThreadVisible}
                    isToDoVisible={isToDoVisible}
                    myself={myself}
                    paneSizePCT={mainChatPanelSize}
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
                    setIsToDoVisible={setIsToDoVisible}
                    setMyself={setMyself}
                    setOpeningService={setOpeningService}
                    setTodos={setTodos}
                    socket={socket}
                    teamMemberProfiles={TEM.teamMemberProfiles}
                    teamMembers={TEM.teamMembers}
                    todos={todos}
                    subChat={CM.currentSubChat ? CM.currentSubChat : CM.currentMainChat}
                />
            )}
        </Panel>
    );
};
