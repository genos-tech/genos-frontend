import { Box, Sheet } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Panel, PanelGroup } from "react-resizable-panels";
import { Socket } from "socket.io-client";

import { ResizeHandle } from "../../components/ui/ResizeHandle";
import { LayoutStyles } from "../../components/ui/styles/commonStyle";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { InboxManagementState } from "../../hooks/inbox/useInboxManagement";
import { NoteManagementState } from "../../hooks/notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { NoteContentRenderer } from "./common/components/NoteContentRenderer";
import { NoteSidebar } from "./common/components/NoteSidebar";
import { useNoteRouting } from "./common/hooks/useNoteRouting";
import { MobileNoteHome } from "./MobileNoteHome";
import { TaskPreviewPanel } from "./task-notes/components/TaskPreviewPanel";

type NoteHomeProps = {
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useUISM: UIStateManagementState;
    useIM: InboxManagementState;
    usePM: ProjectManagementState;
    useNM: NoteManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    useSM: SprintMilestoneManagementState;
};
export const NoteHome = (props: NoteHomeProps) => {
    const { useTEM, socket, myself, setMyself, useUISM, useNM, useCM, usePM, useTM, useSM } =
        props;

    // URL-based routing for notes
    useNoteRouting({ useNM });

    const { mode } = useColorScheme();
    const isMobile = useIsMobile();

    const ls = mode === "dark" ? LayoutStyles.dark : LayoutStyles.light;

    const noteContentBox = {
        px: 1,
        height: "100dvh",
        borderRight: "1px solid",
        borderColor: ls.sidebarPanel.borderColor,
    };

    const renderMainContent = () => {
        if (useNM.currentNoteType === 0) {
            return (
                <Panel id={"2"} maxSize={85} minSize={35} order={2}>
                    <Box sx={noteContentBox}>
                        <NoteContentRenderer
                            useCM={useCM}
                            myself={myself}
                            useNM={useNM}
                            usePM={usePM}
                            setMyself={setMyself}
                            socket={socket}
                            useTEM={useTEM}
                            useTM={useTM}
                            useUISM={useUISM}
                        />
                    </Box>
                </Panel>
            );
        }

        return (
            <Panel id={"3"} maxSize={85} minSize={35} order={3}>
                <Box sx={noteContentBox}>
                    <NoteContentRenderer
                        useCM={useCM}
                        myself={myself}
                        useNM={useNM}
                        usePM={usePM}
                        setMyself={setMyself}
                        socket={socket}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                    />
                </Box>
            </Panel>
        );
    };

    return (
        <Box sx={LayoutStyles.outerWrapper}>
            <Sheet sx={ls.serviceSurface}>
                <Box sx={ls.decorTopRight} />
                <Box sx={ls.decorBottomLeft} />

                {isMobile ? (
                    <MobileNoteHome
                        useTEM={useTEM}
                        socket={socket}
                        myself={myself}
                        setMyself={setMyself}
                        useUISM={useUISM}
                        useNM={useNM}
                        useCM={useCM}
                        usePM={usePM}
                        useTM={useTM}
                        useSM={useSM}
                    />
                ) : (
                    <PanelGroup direction="horizontal" style={{ flex: 1 }}>
                        <Panel id={"1"} maxSize={25} minSize={10} order={1}>
                            <Box sx={ls.sidebarPanel}>
                                <NoteSidebar useNM={useNM} allChats={useCM.allChats} />
                            </Box>
                        </Panel>

                        <ResizeHandle className="note-resize-handle" />

                        {renderMainContent()}

                        <TaskPreviewPanel
                            useCM={useCM}
                            myself={myself}
                            useNM={useNM}
                            usePM={usePM}
                            setMyself={setMyself}
                            socket={socket}
                            useTEM={useTEM}
                            useTM={useTM}
                            useSM={useSM}
                            useUISM={useUISM}
                        />
                    </PanelGroup>
                )}
            </Sheet>

            {/* Hover Animation with CSS */}
            <style>
                {`
                .note-resize-handle {
                    transition: all 0.3s ease-in-out;
                }
                .note-resize-handle:hover {
                    background-color: grey !important;
                    width: 8px !important;
                }
                `}
            </style>
        </Box>
    );
};
