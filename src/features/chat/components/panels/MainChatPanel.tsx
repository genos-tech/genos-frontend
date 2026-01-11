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
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    useTEM: TeamManagementState;
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
    useUISM: UIStateManagementState;
}

export const MainChatPanel = ({
    useCM,
    useTM,
    usePM,
    useTEM,
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
    useUISM,
}: MainChatPanelProps) => {
    const { mode } = useColorScheme();

    return (
        <Panel id={"4"} maxSize={80} minSize={30} order={4} onResize={setMainChatPanelSize}>
            {useCM.currentMainChat && useCM.currentMainChat.chatId !== -1 && (
                <MessagesPane
                    useCM={useCM}
                    currentMainChatId={currentMainChatId}
                    currentWindowHeight={currentWindowHeight}
                    incompleteTodoCount={incompleteTodoCount}
                    isExistingTodaysTodo={isExistingTodaysTodo}
                    isToDoVisible={isToDoVisible}
                    myself={myself}
                    paneSizePCT={mainChatPanelSize}
                    setIsExistingTodaysTodo={setIsExistingTodaysTodo}
                    setIsToDoVisible={setIsToDoVisible}
                    setMyself={setMyself}
                    setTodos={setTodos}
                    socket={socket}
                    useTEM={useTEM}
                    todos={todos}
                    useUISM={useUISM}
                    useTM={useTM}
                    usePM={usePM}
                />
            )}
        </Panel>
    );
};
