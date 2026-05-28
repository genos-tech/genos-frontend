import { Box } from "@mui/joy";
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
import { ResizeHandle } from "../../../notes/common/components/ResizeHandle";
import { MessagesPane } from "../../MainChatPane";
import { SelectChatPanel } from "./SelectChatPanel";

interface MainChatPanelProps {
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    todoFromMessageBubble: MessageProps | ThreadMessageProps | TaskCommentProps | null;
    setTodoFromMessageBubble: (
        todoFromMessageBubble: MessageProps | ThreadMessageProps | TaskCommentProps
    ) => void;
    useTEM: TeamManagementState;
    myself: UserProps;
    currentMainChatId: number;
    currentWindowHeight: number;
    mainChatPanelSize: number;
    setMainChatPanelSize: (size: number) => void;
    incompleteTodoCount: number;
    isToDoVisible: boolean;
    setIsToDoVisible: (value: boolean) => void;
    useTG: UseTodoGroupsState;
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
    isToDoVisible,
    setIsToDoVisible,
    useTG,
    setTodoFromMessageBubble,
    socket,
    setMyself,
    useUISM,
}: MainChatPanelProps) => {
    return (
        <Panel id={"4"} maxSize={80} minSize={30} order={4} onResize={setMainChatPanelSize}>
            {useCM.currentMainChat && useCM.currentMainChat.chatId !== -1 && (
                <MessagesPane
                    currentMainChatId={currentMainChatId}
                    currentWindowHeight={currentWindowHeight}
                    incompleteTodoCount={incompleteTodoCount}
                    isToDoVisible={isToDoVisible}
                    myself={myself}
                    paneSizePCT={mainChatPanelSize}
                    setIsToDoVisible={setIsToDoVisible}
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
            )}
            {!(useCM.currentMainChat && useCM.currentMainChat.chatId !== -1) && (
                <Box
                    sx={{
                        height: "100%",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        width: "100%",
                    }}
                >
                    <ResizeHandle key="select-chat-resize-handle" />
                    <SelectChatPanel setMainChatPanelSize={setMainChatPanelSize} />
                </Box>
            )}
        </Panel>
    );
};
