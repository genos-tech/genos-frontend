import { Box, CssBaseline } from "@mui/joy";
import { CssVarsProvider, useColorScheme } from "@mui/joy/styles";
import { Panel, PanelGroup } from "react-resizable-panels";
import { Socket } from "socket.io-client";

import { Sidebar } from "../../components/layout/sidebar";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { NoteManagementState } from "../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { NoteContentRenderer } from "./shared/components/NoteContentRenderer";
import { NoteSidebar } from "./shared/components/NoteSidebar";
import { ResizeHandle } from "./shared/components/ResizeHandle";
import { ResizeHandleStyles } from "./shared/components/ResizeHandleStyles";
import { TaskPreviewPanel } from "./task-notes/components/TaskPreviewPanel";

type NoteHomeProps = {
    TEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    openingService: number;
    setOpeningService: (service: number) => void;
    unReadInboxItemCount: number;
    PM: ProjectManagementState;
    NM: NoteManagementState;
    CM: ChatManagementState;
    TM: TaskManagementState;
};
export const NoteHome = (props: NoteHomeProps) => {
    const {
        TEM,
        socket,
        myself,
        setMyself,
        openingService,
        setOpeningService,
        unReadInboxItemCount,
        NM,
        CM,
        PM,
        TM,
    } = props;

    const { mode } = useColorScheme();

    const renderMainContent = () => {
        if (NM.currentNoteType === 0) {
            return (
                <Panel id={"2"} maxSize={85} minSize={35} order={2}>
                    <Box
                        sx={{
                            paddingX: 1,
                            height: "100dvh",
                            borderRight:
                                mode === "dark" ? "2px black inset" : "2px lightgrey inset",
                        }}
                    >
                        <NoteContentRenderer
                            noteType={NM.currentNoteType}
                            myself={myself}
                            setMyself={setMyself}
                            openingService={openingService}
                            setOpeningService={setOpeningService}
                            socket={socket}
                            TEM={TEM}
                            PM={PM}
                            NM={NM}
                            CM={CM}
                            TM={TM}
                        />
                    </Box>
                </Panel>
            );
        }

        return (
            <Panel id={"3"} maxSize={85} minSize={35} order={3}>
                <Box
                    sx={{
                        paddingX: 1,
                        height: "100dvh",
                        borderRight: mode === "dark" ? "2px black inset" : "2px lightgrey inset",
                    }}
                >
                    <NoteContentRenderer
                        noteType={NM.currentNoteType}
                        myself={myself}
                        setMyself={setMyself}
                        openingService={openingService}
                        setOpeningService={setOpeningService}
                        socket={socket}
                        TEM={TEM}
                        PM={PM}
                        NM={NM}
                        CM={CM}
                        TM={TM}
                    />
                </Box>
            </Panel>
        );
    };

    return (
        <CssVarsProvider disableTransitionOnChange>
            <CssBaseline />
            <Box sx={{ display: "flex", minHeight: "100dvh", width: "100vw" }}>
                <Sidebar
                    currentTeam={TEM.currentTeam}
                    myself={myself}
                    openingService={openingService}
                    setCurrentMainChat={CM.setCurrentMainChat}
                    setCurrentTeam={TEM.setCurrentTeam}
                    setMyself={setMyself}
                    setOpeningService={setOpeningService}
                    socket={socket}
                    teamMemberProfiles={TEM.teamMemberProfiles}
                    unReadChatAndActivityCounts={CM.unReadChatAndActivityCounts}
                    unReadInboxItemCount={unReadInboxItemCount}
                />

                <PanelGroup direction="horizontal">
                    <Panel id={"1"} maxSize={25} minSize={10} order={1}>
                        <Box
                            sx={{
                                height: "100%",
                                width: "100%",
                                borderColor: mode === "dark" ? "black" : "white",
                                borderRight:
                                    mode === "dark" ? "2px black inset" : "2px lightgrey inset",
                            }}
                        >
                            <NoteSidebar NM={NM} />
                        </Box>
                    </Panel>

                    <ResizeHandle />

                    {renderMainContent()}

                    <TaskPreviewPanel
                        myself={myself}
                        setMyself={setMyself}
                        openingService={openingService}
                        setOpeningService={setOpeningService}
                        socket={socket}
                        TEM={TEM}
                        PM={PM}
                        NM={NM}
                        CM={CM}
                        TM={TM}
                    />
                </PanelGroup>

                <ResizeHandleStyles />
            </Box>
        </CssVarsProvider>
    );
};
