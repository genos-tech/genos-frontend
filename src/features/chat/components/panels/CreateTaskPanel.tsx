import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Panel } from "react-resizable-panels";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { CreateTaskForm } from "../../../tasks/components/contents/CreateTaskForm";

interface CreateTaskPanelProps {
    CM: ChatManagementState;
    TM: TaskManagementState;
    PM: ProjectManagementState;
    TEM: TeamManagementState;
    myself: UserProps;
    openingService: number;
    socket: any;
    setMyself: (me: UserProps) => void;
    setOpeningService: (service: number) => void;
}

export const CreateTaskPanel = ({
    CM,
    TM,
    PM,
    TEM,
    myself,
    openingService,
    socket,
    setMyself,
    setOpeningService,
}: CreateTaskPanelProps) => {
    const { mode } = useColorScheme();

    return (
        <Panel id={"6"} maxSize={70} minSize={30} order={6}>
            <Box
                sx={{
                    px: { xs: 1, md: 2 },
                    pt: {
                        xs: "calc(12px + var(--Header-height))",
                        sm: "calc(12px + var(--Header-height))",
                        md: 2,
                    },
                    pb: { xs: 2, sm: 2, md: 1 },
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
                <CreateTaskForm
                    chatType={CM.currentThreadChat?.chatType || -1}
                    currentMainChat={CM.currentMainChat}
                    currentThreadChat={CM.currentThreadChat}
                    isThreadVisible={CM.isThreadVisible}
                    moveToSpecificChat={CM.moveToSpecificChat}
                    myself={myself}
                    openingService={openingService}
                    parentTaskId={null}
                    PM={PM}
                    rootTaskId={null}
                    setCurrentMainChat={CM.setCurrentMainChat}
                    setIsMainChatVisible={CM.setIsMainChatVisible}
                    setMyself={setMyself}
                    setOpeningService={setOpeningService}
                    setTeamMembers={TEM.setTeamMembers}
                    socket={socket}
                    teamMemberProfiles={TEM.teamMemberProfiles}
                    teamMembers={TEM.teamMembers}
                    TM={TM}
                />
            </Box>
        </Panel>
    );
};
