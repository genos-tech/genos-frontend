import { Box } from "@mui/joy";
import { Panel } from "react-resizable-panels";
import type { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { CreateTaskForm } from "../../../tasks/components/contents/CreateTaskForm";

interface CreateTaskPanelProps {
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    useTEM: TeamManagementState;
    myself: UserProps;
    socket: Socket | null;
    setMyself: (me: UserProps) => void;
    useUISM: UIStateManagementState;
    useNM: NoteManagementState;
    useSM: SprintMilestoneManagementState;
}

export const CreateTaskPanel = ({
    useCM,
    useTM,
    usePM,
    useTEM,
    myself,
    socket,
    setMyself,
    useUISM,
    useNM,
    useSM,
}: CreateTaskPanelProps) => {
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
                    height: "var(--app-vh)",
                    gap: 1,
                }}
            >
                <CreateTaskForm
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useNM={useNM}
                    usePM={usePM}
                    useSM={useSM}
                    useTEM={useTEM}
                    useTM={useTM}
                    useUISM={useUISM}
                />
            </Box>
        </Panel>
    );
};
