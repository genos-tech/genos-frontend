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
    noteType: number;
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
    const { noteType, myself, setMyself, UIM, socket, TEM, PM, NM, CM, TM } = props;

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
    if (noteType === 0) {
        return renderPlaceholder("(TBD) Note Home");
    }

    // My Note
    if (noteType === 1 && NM.currentMyNoteChain) {
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
    if (noteType === 2 && NM.currentTaskNoteChain) {
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
                        handleCreateNewTaskNote={NM.handleCreateNewTaskNote}
                        isTaskNoteVisible={NM.isTaskNoteVisible}
                        myself={myself}
                        setCurrentProject={PM.setCurrentProject}
                        setCurrentTaskNote={NM.setCurrentTaskNote}
                        setIsTaskNoteVisible={NM.setIsTaskNoteVisible}
                        setMyself={setMyself}
                        setOpenCreateProject={PM.setOpenCreateProject}
                        setTeamProjects={PM.setTeamProjects}
                        socket={socket}
                        taskNoteMeta={NM.taskNoteMeta}
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
    if (noteType === 3 && NM.currentChatNoteChain) {
        return (
            <ChatNoteMain
                CM={CM}
                isInChatPage={false}
                myself={myself}
                NM={NM}
                setCurrentPreviewTaskId={TM.setCurrentPreviewTaskId}
                setCurrentProject={PM.setCurrentProject}
                setMyself={setMyself}
                socket={socket}
                TEM={TEM}
                UIM={UIM}
            />
        );
    }

    // Shared Note placeholder
    if (noteType === 4) {
        return renderPlaceholder("(TBD) Shared Notes");
    }

    return null;
};
