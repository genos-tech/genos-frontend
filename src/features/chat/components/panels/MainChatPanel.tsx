import { Box } from "@mui/joy";
import { Panel } from "react-resizable-panels";
import { Socket } from "socket.io-client";

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
    socket: Socket | null;
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
    // PUNCH LIST (v3 chatId migration): `chatId` is `string` post-flip;
    // the legacy "no chat selected" sentinel was `-1`, now `""` (see
    // `defaultChat` in `utils/defaults.ts`). Used twice below.
    return (
        <Panel id={"4"} maxSize={80} minSize={30} order={4} onResize={setMainChatPanelSize}>
            {useCM.currentMainChat && useCM.currentMainChat.chatId !== "" && (
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
            {!(useCM.currentMainChat && useCM.currentMainChat.chatId !== "") && (
                <Box
                    sx={{
                        alignItems: "center",
                        display: "flex",
                        height: "100%",
                        justifyContent: "center",
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
