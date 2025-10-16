import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Panel } from "react-resizable-panels";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { NoteManagementState } from "../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../types/admin";
import { ChatNoteMain } from "../../notes/chat-notes/components/ChatNoteMain";

interface ChatNotePanelProps {
    CM: ChatManagementState;
    TM: TaskManagementState;
    PM: ProjectManagementState;
    TEM: TeamManagementState;
    NM: NoteManagementState;
    myself: UserProps;
    socket: any;
    setMyself: (me: UserProps) => void;
    setOpeningService: (service: number) => void;
}

export const ChatNotePanel = ({
    CM,
    TM,
    PM,
    TEM,
    NM,
    myself,
    socket,
    setMyself,
    setOpeningService,
}: ChatNotePanelProps) => {
    const { mode } = useColorScheme();

    return (
        <Panel id={"8"} maxSize={90} minSize={30} order={8}>
            <Box
                sx={{
                    px: { xs: 1, md: 2 },
                    pt: {
                        xs: "calc(12px + var(--Header-height))",
                        sm: "calc(12px + var(--Header-height))",
                        md: 2,
                    },
                    pb: { xs: 2, sm: 2, md: 3 },
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                    height: "100dvh",
                    gap: 1,
                    ml: "1px",
                    boxShadow: "0 0 0 1px grey",
                    borderColor: mode === "dark" ? "black" : "white",
                }}
            >
                <ChatNoteMain
                    CM={CM}
                    isInChatPage={true}
                    myself={myself}
                    NM={NM}
                    setCurrentPreviewTaskId={TM.setCurrentPreviewTaskId}
                    setCurrentProject={PM.setCurrentProject}
                    setMyself={setMyself}
                    setOpeningService={setOpeningService}
                    socket={socket}
                    teamMemberProfiles={TEM.teamMemberProfiles}
                    teamMembers={TEM.teamMembers}
                />
            </Box>
        </Panel>
    );
};
