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
                myself={myself}
                NM={NM}
                setCurrentChat={CM.setCurrentMainChat}
                setMyself={setMyself}
                UIM={UIM}
                socket={socket}
                TEM={TEM}
            />
        );
    }

    // Task Note
    if (noteType === 2 && NM.currentTaskNoteChain) {
        return (
            <>
                <TaskNoteMain
                    TEM={TEM}
                    socket={socket}
                    myself={myself}
                    setMyself={setMyself}
                    UIM={UIM}
                    setCurrentChat={CM.setCurrentMainChat}
                    isInTaskPage={false}
                    setCurrentMainChat={CM.setCurrentMainChat}
                    allChats={CM.allChats}
                    funcSetAllChats={CM.funcSetAllChats}
                    NM={NM}
                    TM={TM}
                />

                {NM.isTaskVisibleInNote && TM.currentPreviewTask && (
                    <TaskPreview
                        handleCreateNewTaskNote={NM.handleCreateNewTaskNote}
                        isTaskNoteVisible={NM.isTaskNoteVisible}
                        moveToSpecificChat={CM.moveToSpecificChat}
                        myself={myself}
                        UIM={UIM}
                        setCurrentMainChat={CM.setCurrentMainChat}
                        setCurrentProject={PM.setCurrentProject}
                        setCurrentTaskNote={NM.setCurrentTaskNote}
                        setIsMainChatVisible={CM.setIsMainChatVisible}
                        setIsTaskNoteVisible={NM.setIsTaskNoteVisible}
                        setMyself={setMyself}
                        setOpenCreateProject={PM.setOpenCreateProject}
                        setTeamProjects={PM.setTeamProjects}
                        socket={socket}
                        taskNoteMeta={NM.taskNoteMeta}
                        TEM={TEM}
                        teamProjects={PM.teamProjects}
                        TM={TM}
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
                UIM={UIM}
                socket={socket}
                TEM={TEM}
            />
        );
    }

    // Shared Note placeholder
    if (noteType === 4) {
        return renderPlaceholder("(TBD) Shared Notes");
    }

    return null;
};
