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
import { CreateTaskForm } from "../../../tasks/components/contents/CreateTaskForm";

interface CreateTaskPanelProps {
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    useTEM: TeamManagementState;
    myself: UserProps;
    socket: any;
    setMyself: (me: UserProps) => void;
    useUISM: UIStateManagementState;
    useNM: NoteManagementState;
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
                    chatType={useCM.currentThreadChat?.chatType || -1}
                    useCM={useCM}
                    myself={myself}
                    usePM={usePM}
                    setMyself={setMyself}
                    socket={socket}
                    useTEM={useTEM}
                    useTM={useTM}
                    useUISM={useUISM}
                    useNM={useNM}
                />
            </Box>
        </Panel>
    );
};
