import { Box, IconButton } from "@mui/joy";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ChatNoteMain } from "../../chat-notes/components/ChatNoteMain";
import { MyNoteMain } from "../../my-notes/components/MyNoteMain";
import { TaskNoteMain } from "../../task-notes/components/TaskNoteMain";
import { TaskPreview } from "../../../tasks/components/contents/TaskPreview";

type NoteContentRendererProps = {
    noteType: number;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    openingService: number;
    setOpeningService: (service: number) => void;
    socket: Socket | null;
    TEM: TeamManagementState;
    PM: ProjectManagementState;
    NM: NoteManagementState;
    CM: ChatManagementState;
    TM: TaskManagementState;
};

export const NoteContentRenderer = (props: NoteContentRendererProps) => {
    const {
        noteType,
        myself,
        setMyself,
        openingService,
        setOpeningService,
        socket,
        TEM,
        PM,
        NM,
        CM,
        TM,
    } = props;

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
                setOpeningService={setOpeningService}
                socket={socket}
                teamMemberProfiles={TEM.teamMemberProfiles}
                teamMembers={TEM.teamMembers}
            />
        );
    }

    // Task Note
    if (noteType === 2 && NM.currentTaskNoteChain) {
        return (
            <>
                <TaskNoteMain
                    allChats={CM.allChats}
                    funcSetAllChats={CM.funcSetAllChats}
                    isInTaskPage={false}
                    myself={myself}
                    NM={NM}
                    setCurrentChat={CM.setCurrentMainChat}
                    setCurrentMainChat={CM.setCurrentMainChat}
                    setMyself={setMyself}
                    setOpeningService={setOpeningService}
                    socket={socket}
                    teamMemberProfiles={TEM.teamMemberProfiles}
                    teamMembers={TEM.teamMembers}
                    TM={TM}
                />

                {NM.isTaskVisibleInNote && TM.currentPreviewTask && (
                    <TaskPreview
                        isTaskNoteVisible={NM.isTaskNoteVisible}
                        moveToSpecificChat={CM.moveToSpecificChat}
                        myself={myself}
                        openingService={openingService}
                        setCurrentMainChat={CM.setCurrentMainChat}
                        setCurrentProject={PM.setCurrentProject}
                        setCurrentTaskNote={NM.setCurrentTaskNote}
                        setIsMainChatVisible={CM.setIsMainChatVisible}
                        setIsTaskNoteVisible={NM.setIsTaskNoteVisible}
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
                        handleCreateNewTaskNote={NM.handleCreateNewTaskNote}
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
                setOpeningService={setOpeningService}
                socket={socket}
                teamMemberProfiles={TEM.teamMemberProfiles}
                teamMembers={TEM.teamMembers}
            />
        );
    }

    // Shared Note placeholder
    if (noteType === 4) {
        return renderPlaceholder("(TBD) Shared Notes");
    }

    return null;
};
