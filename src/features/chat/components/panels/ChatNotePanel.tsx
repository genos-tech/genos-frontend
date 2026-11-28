import { Box } from "@mui/joy";
import { Panel } from "react-resizable-panels";
import type { Socket } from "socket.io-client";

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
    socket: Socket | null;
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
                    height: "var(--app-vh)",
                    gap: 1,
                }}
            >
                <ChatNoteMain
                    isInChatPage={true}
                    isInTaskPage={false}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useNM={useNM}
                    usePM={usePM}
                    useTEM={useTEM}
                    useTM={useTM}
                    useUISM={useUISM}
                />
            </Box>
        </Panel>
    );
};
