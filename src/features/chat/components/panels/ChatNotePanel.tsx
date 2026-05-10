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
import { ChatNoteMain } from "../../../notes/chat-notes/components/ChatNoteMain";

interface ChatNotePanelProps {
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    useTEM: TeamManagementState;
    useNM: NoteManagementState;
    myself: UserProps;
    socket: any;
    setMyself: (me: UserProps) => void;
    useUISM: UIStateManagementState;
}

export const ChatNotePanel = ({
    useCM,
    useTM,
    usePM,
    useTEM,
    useNM,
    myself,
    socket,
    setMyself,
    useUISM,
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
                    boxShadow: "0 0 0 1px grey",
                    borderColor: mode === "dark" ? "black" : "white",
                    borderRight: mode === "dark" ? "1px black inset" : "1px lightgrey inset",
                }}
            >
                <ChatNoteMain
                    useCM={useCM}
                    isInChatPage={true}
                    isInTaskPage={false}
                    myself={myself}
                    useNM={useNM}
                    useTM={useTM}
                    usePM={usePM}
                    setMyself={setMyself}
                    socket={socket}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            </Box>
        </Panel>
    );
};
