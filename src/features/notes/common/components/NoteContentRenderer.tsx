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

    // Get the currently selected tab's note type
    // This ensures we render the correct component based on the OPEN note,
    // not the sidebar category the user clicked on
    const selectedTab = useNM.tabItems[useNM.selectedTabIndex];
    const activeNoteType = selectedTab?.noteType ?? useNM.currentNoteType;

    // Note Home placeholder (only show if no notes are open)
    if (useNM.currentNoteType === 0 && useNM.tabItems.length === 0) {
        return renderPlaceholder("(TBD) Note Home");
    }

    // No notes open at all
    if (useNM.tabItems.length === 0) {
        return renderPlaceholder("No Note Selected");
    }

    // My Note (noteType === 1)
    if (activeNoteType === 1 && useNM.currentMyNote) {
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

    // Task Note (noteType === 2)
    if (activeNoteType === 2 && useNM.currentTaskNote) {
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

    // Chat Note (noteType === 3)
    if (activeNoteType === 3 && useNM.currentChatNote) {
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

    // Fallback: if tabs exist but current note is still loading
    if (useNM.tabItems.length > 0) {
        return null; // Let the component load
    }

    return null;
};
