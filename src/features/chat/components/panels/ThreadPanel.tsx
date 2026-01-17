import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Panel } from "react-resizable-panels";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ThreadPane } from "../../ThreadChatPane";

interface ThreadPanelProps {
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    useTEM: TeamManagementState;
    useNM: NoteManagementState;
    myself: UserProps;
    currentThreadChatId: number;
    currentWindowHeight: number;
    socket: any;
    setMyself: (me: UserProps) => void;
    useUISM: UIStateManagementState;
    usePM: ProjectManagementState;
}

export const ThreadPanel = ({
    useCM,
    useTM,
    usePM,
    useTEM,
    useNM,
    myself,
    currentThreadChatId,
    currentWindowHeight,
    socket,
    setMyself,
    useUISM,
}: ThreadPanelProps) => {
    const { mode } = useColorScheme();

    return (
        <Panel id={"5"} maxSize={70} minSize={25} order={5}>
            <Box
                sx={{
                    height: "100%",
                    backgroundColor: "black",
                    borderColor: mode === "dark" ? "black" : "white",
                    borderRight: mode === "dark" ? "1px black inset" : "1px lightgrey inset",
                }}
            >
                {useCM.currentThreadChat && (
                    <ThreadPane
                        useCM={useCM}
                        usePM={usePM}
                        currentThreadChatId={currentThreadChatId}
                        currentWindowHeight={currentWindowHeight}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                        useNM={useNM}
                    />
                )}
            </Box>
        </Panel>
    );
};
