import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Panel } from "react-resizable-panels";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { NoteManagementState } from "../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../types/admin";
import { ThreadPane } from "../ThreadChatPane";

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
    setOpeningService: (service: number) => void;
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
    setOpeningService,
}: ThreadPanelProps) => {
    const { mode } = useColorScheme();

    return (
        <Panel id={"5"} maxSize={70} minSize={25} order={5}>
            <Box
                sx={{
                    height: "100%",
                    backgroundColor: "black",
                    borderColor: mode === "dark" ? "black" : "white",
                    borderLeft: mode === "dark" ? "2px black groove" : "2px white groove",
                }}
            >
                {CM.currentThreadChat && (
                    <ThreadPane
                        currentThreadChat={CM.currentThreadChat}
                        currentThreadChatId={currentThreadChatId}
                        currentWindowHeight={currentWindowHeight}
                        flaggedMessages={CM.flaggedMessages}
                        isChatNoteVisibleInChat={CM.isChatNoteVisibleInChat}
                        myself={myself}
                        setCurrentMainChat={CM.setCurrentMainChat}
                        setCurrentThreadChat={CM.setCurrentThreadChat}
                        setFlaggedMessages={CM.setFlaggedMessages}
                        setIsChatNoteVisibleInChat={CM.setIsChatNoteVisibleInChat}
                        setIsMainChatVisible={CM.setIsMainChatVisible}
                        setIsThreadVisible={CM.setIsThreadVisible}
                        setMyself={setMyself}
                        setOpeningService={setOpeningService}
                        socket={socket}
                        teamMemberProfiles={TEM.teamMemberProfiles}
                        teamMembers={TEM.teamMembers}
                        thread={CM.currentThreadChat}
                        TM={TM}
                        handleCreateNewChatNoteIfNotExist={NM.handleCreateNewChatNoteIfNotExist}
                    />
                )}
            </Box>
        </Panel>
    );
};
