import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Panel } from "react-resizable-panels";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ThreadPane } from "../../ThreadChatPane";

interface ThreadPanelProps {
    CM: ChatManagementState;
    TM: TaskManagementState;
    TEM: TeamManagementState;
    NM: NoteManagementState;
    myself: UserProps;
    currentThreadChatId: number;
    currentWindowHeight: number;
    socket: any;
    setMyself: (me: UserProps) => void;
    UIM: UIStateManagementState;
}

export const ThreadPanel = ({
    CM,
    TM,
    TEM,
    NM,
    myself,
    currentThreadChatId,
    currentWindowHeight,
    socket,
    setMyself,
    UIM,
}: ThreadPanelProps) => {
    const { mode } = useColorScheme();

    return (
        <Panel id={"5"} maxSize={70} minSize={25} order={5}>
            <Box
                sx={{
                    height: "100%",
                    backgroundColor: "black",
                    borderColor: mode === "dark" ? "black" : "white",
                    borderRight: mode === "dark" ? "2px black inset" : "2px lightgrey inset",
                }}
            >
                {CM.currentThreadChat && (
                    <ThreadPane
                        currentThreadChat={CM.currentThreadChat}
                        currentThreadChatId={currentThreadChatId}
                        currentWindowHeight={currentWindowHeight}
                        flaggedMessages={CM.flaggedMessages}
                        handleCreateNewChatNoteIfNotExist={NM.handleCreateNewChatNoteIfNotExist}
                        isChatNoteVisibleInChat={CM.isChatNoteVisibleInChat}
                        myself={myself}
                        setCurrentMainChat={CM.setCurrentMainChat}
                        setCurrentThreadChat={CM.setCurrentThreadChat}
                        setFlaggedMessages={CM.setFlaggedMessages}
                        setIsChatNoteVisibleInChat={CM.setIsChatNoteVisibleInChat}
                        setIsMainChatVisible={CM.setIsMainChatVisible}
                        setIsThreadVisible={CM.setIsThreadVisible}
                        setMyself={setMyself}
                        UIM={UIM}
                        socket={socket}
                        teamMemberProfiles={TEM.teamMemberProfiles}
                        teamMembers={TEM.teamMembers}
                        thread={CM.currentThreadChat}
                        TM={TM}
                    />
                )}
            </Box>
        </Panel>
    );
};
