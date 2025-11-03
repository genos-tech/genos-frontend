import { Box, IconButton } from "@mui/joy";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { TaskPreview } from "../../../tasks/components/contents/TaskPreview";
import { ChatNoteMain } from "../../chat-notes/components/ChatNoteMain";
import { MyNoteMain } from "../../my-notes/components/MyNoteMain";
import { TaskNoteMain } from "../../task-notes/components/TaskNoteMain";

type NoteContentRendererProps = {
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    UIM: UIStateManagementState;
    socket: Socket | null;
    TEM: TeamManagementState;
    PM: ProjectManagementState;
    NM: NoteManagementState;
    CM: ChatManagementState;
    TM: TaskManagementState;
};

export const NoteContentRenderer = (props: NoteContentRendererProps) => {
    const { myself, setMyself, UIM, socket, TEM, PM, NM, CM, TM } = props;

    const renderPlaceholder = (message: string) => (
        <Box
            sx={{
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
            }}
        >
            <IconButton
                color="neutral"
                component="button"
                variant="soft"
                sx={{
                    fontSize: "15px",
                    padding: "10px",
                }}
            >
                {message}
            </IconButton>
        </Box>
    );

    // Note Home placeholder
    if (NM.currentNoteType === 0) {
        return renderPlaceholder("(TBD) Note Home");
    }

    // My Note
    if (NM.currentNoteType === 1 && NM.currentMyNoteChain) {
        return (
            <MyNoteMain
                CM={CM}
                myself={myself}
                NM={NM}
                setMyself={setMyself}
                socket={socket}
                TEM={TEM}
                UIM={UIM}
            />
        );
    }

    // Task Note
    if (NM.currentNoteType === 2 && NM.currentTaskNoteChain) {
        return (
            <>
                <TaskNoteMain
                    CM={CM}
                    isInTaskPage={false}
                    myself={myself}
                    NM={NM}
                    setMyself={setMyself}
                    socket={socket}
                    TEM={TEM}
                    TM={TM}
                    UIM={UIM}
                />

                {NM.isTaskVisibleInNote && TM.currentPreviewTask && (
                    <TaskPreview
                        CM={CM}
                        NM={NM}
                        myself={myself}
                        setCurrentProject={PM.setCurrentProject}
                        setMyself={setMyself}
                        setOpenCreateProject={PM.setOpenCreateProject}
                        setTeamProjects={PM.setTeamProjects}
                        socket={socket}
                        teamProjects={PM.teamProjects}
                        TEM={TEM}
                        TM={TM}
                        UIM={UIM}
                    />
                )}
            </>
        );
    }

    // Chat Note
    if (NM.currentNoteType === 3 && NM.currentChatNoteChain) {
        return (
            <ChatNoteMain
                CM={CM}
                isInChatPage={false}
                myself={myself}
                NM={NM}
                setCurrentProject={PM.setCurrentProject}
                setMyself={setMyself}
                socket={socket}
                TEM={TEM}
                TM={TM}
                UIM={UIM}
            />
        );
    }

    // Shared Note placeholder
    if (NM.currentNoteType === 4) {
        return renderPlaceholder("(TBD) Shared Notes");
    }

    return null;
};
