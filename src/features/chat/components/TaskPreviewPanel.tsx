import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Panel } from "react-resizable-panels";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { NoteManagementState } from "../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../types/admin";
import { TaskPreview } from "../../tasks/components/contents/TaskPreview";

interface TaskPreviewPanelProps {
    CM: ChatManagementState;
    TM: TaskManagementState;
    PM: ProjectManagementState;
    TEM: TeamManagementState;
    NM: NoteManagementState;
    myself: UserProps;
    openingService: number;
    socket: any;
    setMyself: (me: UserProps) => void;
    setOpeningService: (service: number) => void;
}

export const TaskPreviewPanel = ({
    CM,
    TM,
    PM,
    TEM,
    NM,
    myself,
    openingService,
    socket,
    setMyself,
    setOpeningService,
}: TaskPreviewPanelProps) => {
    const { mode } = useColorScheme();

    return (
        <Panel id={"7"} maxSize={70} minSize={30} order={7}>
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
                <TaskPreview
                    handleCreateNewTaskNote={NM.handleCreateNewTaskNote}
                    isTaskNoteVisible={NM.isTaskNoteVisible}
                    isThreadVisible={CM.isThreadVisible}
                    moveToSpecificChat={CM.moveToSpecificChat}
                    myself={myself}
                    openingService={openingService}
                    setCurrentMainChat={CM.setCurrentMainChat}
                    setCurrentProject={PM.setCurrentProject}
                    setCurrentTaskNote={NM.setCurrentTaskNote}
                    setIsMainChatVisible={CM.setIsMainChatVisible}
                    setIsTaskNoteVisible={NM.setIsTaskNoteVisible}
                    setIsThreadVisible={CM.setIsThreadVisible}
                    setMyself={setMyself}
                    setOpenCreateProject={PM.setOpenCreateProject}
                    setOpeningService={setOpeningService}
                    setTeamMembers={TEM.setTeamMembers}
                    setTeamProjects={PM.setTeamProjects}
                    socket={socket}
                    taskNoteMeta={NM.taskNoteMeta}
                    teamMemberProfiles={TEM.teamMemberProfiles}
                    teamMembers={TEM.teamMembers}
                    teamProjects={PM.teamProjects}
                    TM={TM}
                />
            </Box>
        </Panel>
    );
};
