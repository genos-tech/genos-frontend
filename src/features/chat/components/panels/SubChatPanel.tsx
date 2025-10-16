import { Panel } from "react-resizable-panels";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
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
    setOpeningService: (service: number) => void;
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
    setOpeningService,
}: SubChatPanelProps) => {
    return (
        <Panel id={"3"} maxSize={80} minSize={30} order={3} onResize={setSubChatPanelSize}>
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
                setCurrentProject={PM.setCurrentProject}
                setCurrentSubChat={CM.setCurrentSubChat}
                setCurrentThreadChat={CM.setCurrentThreadChat}
                setFlaggedMessages={CM.setFlaggedMessages}
                setIsCreatingTask={TM.setIsCreatingTask}
                setIsExistingTodaysTodo={setIsExistingTodaysTodo}
                setIsMainChatVisible={CM.setIsMainChatVisible}
                setIsSubChatVisible={CM.setIsSubChatVisible}
                setIsThreadVisible={CM.setIsThreadVisible}
                setIsToDoVisible={() => {}}
                setMyself={setMyself}
                setOpeningService={setOpeningService}
                setTodos={setTodos}
                socket={socket}
                teamMemberProfiles={TEM.teamMemberProfiles}
                teamMembers={TEM.teamMembers}
                todos={todos}
                setCurrentPreviewTaskId={TM.setCurrentPreviewTaskId}
                setIsTaskPreviewVisible={TM.setIsTaskPreviewVisible}
                subChat={CM.currentSubChat ? CM.currentSubChat : CM.currentMainChat}
            />
        </Panel>
    );
};
