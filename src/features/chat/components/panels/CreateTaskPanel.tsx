import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Panel } from "react-resizable-panels";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { CreateTaskForm } from "../../../tasks/components/contents/CreateTaskForm";

interface CreateTaskPanelProps {
    CM: ChatManagementState;
    TM: TaskManagementState;
    PM: ProjectManagementState;
    TEM: TeamManagementState;
    myself: UserProps;
    socket: any;
    setMyself: (me: UserProps) => void;
    UIM: UIStateManagementState;
}

export const CreateTaskPanel = ({
    CM,
    TM,
    PM,
    TEM,
    myself,
    socket,
    setMyself,
    UIM,
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
                    boxShadow: "0 0 0 1px grey",
                    borderColor: mode === "dark" ? "black" : "white",
                    borderRight: mode === "dark" ? "2px black inset" : "2px lightgrey inset",
                }}
            >
                <CreateTaskForm
                    chatType={CM.currentThreadChat?.chatType || -1}
                    CM={CM}
                    myself={myself}
                    parentTaskId={null}
                    PM={PM}
                    rootTaskId={null}
                    setMyself={setMyself}
                    socket={socket}
                    TEM={TEM}
                    TM={TM}
                    UIM={UIM}
                />
            </Box>
        </Panel>
    );
};
