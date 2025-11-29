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
    useUISM: UIStateManagementState;
    socket: Socket | null;
    useTEM: TeamManagementState;
    usePM: ProjectManagementState;
    useNM: NoteManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
};

export const NoteContentRenderer = (props: NoteContentRendererProps) => {
    const { myself, setMyself, useUISM, socket, useTEM, usePM, useNM, useCM, useTM } = props;

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
    if (useNM.currentNoteType === 0) {
        return renderPlaceholder("(TBD) Note Home");
    }

    // My Note
    if (useNM.currentNoteType === 1 && useNM.currentMyNoteChain) {
        return (
            <MyNoteMain
                useCM={useCM}
                myself={myself}
                useNM={useNM}
                setMyself={setMyself}
                socket={socket}
                useTEM={useTEM}
                useUISM={useUISM}
            />
        );
    }

    // Task Note
    if (useNM.currentNoteType === 2 && useNM.currentTaskNoteChain) {
        return (
            <>
                <TaskNoteMain
                    useCM={useCM}
                    isInTaskPage={false}
                    myself={myself}
                    useNM={useNM}
                    setMyself={setMyself}
                    socket={socket}
                    useTEM={useTEM}
                    useTM={useTM}
                    useUISM={useUISM}
                />

                {useNM.isTaskVisibleInNote && useTM.currentPreviewTask && (
                    <TaskPreview
                        useCM={useCM}
                        useNM={useNM}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                        usePM={usePM}
                    />
                )}
            </>
        );
    }

    // Chat Note
    if (useNM.currentNoteType === 3 && useNM.currentChatNoteChain) {
        return (
            <ChatNoteMain
                useCM={useCM}
                isInChatPage={false}
                myself={myself}
                useNM={useNM}
                usePM={usePM}
                setMyself={setMyself}
                socket={socket}
                useTEM={useTEM}
                useTM={useTM}
                useUISM={useUISM}
            />
        );
    }

    // Shared Note placeholder
    if (useNM.currentNoteType === 4) {
        return renderPlaceholder("(TBD) Shared Notes");
    }

    return null;
};
