import { Box, CssBaseline } from "@mui/joy";
import { CssVarsProvider, useColorScheme } from "@mui/joy/styles";
import { Panel, PanelGroup } from "react-resizable-panels";
import { Socket } from "socket.io-client";

import { Sidebar } from "../../components/layout/sidebar";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { InboxManagementState } from "../../hooks/inbox/useInboxManagement";
import { NoteManagementState } from "../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { NoteContentRenderer } from "./common/components/NoteContentRenderer";
import { NoteSidebar } from "./common/components/NoteSidebar";
import { ResizeHandle } from "./common/components/ResizeHandle";
import { ResizeHandleStyles } from "./common/components/ResizeHandleStyles";
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
};
export const NoteHome = (props: NoteHomeProps) => {
    const { useTEM, socket, myself, setMyself, useUISM, useIM, useNM, useCM, usePM, useTM } =
        props;

    const { mode } = useColorScheme();

    const renderMainContent = () => {
        if (useNM.currentNoteType === 0) {
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
                <Box
                    sx={{
                        paddingX: 1,
                        height: "100dvh",
                        borderRight: mode === "dark" ? "2px black inset" : "2px lightgrey inset",
                    }}
                >
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
        <CssVarsProvider disableTransitionOnChange>
            <CssBaseline />
            <Box sx={{ display: "flex", minHeight: "100dvh", width: "100vw" }}>
                <Sidebar
                    useCM={useCM}
                    useIM={useIM}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useTEM={useTEM}
                    useUISM={useUISM}
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
                            <NoteSidebar useNM={useNM} />
                        </Box>
                    </Panel>

                    <ResizeHandle />

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
                        useUISM={useUISM}
                    />
                </PanelGroup>

                <ResizeHandleStyles />
            </Box>
        </CssVarsProvider>
    );
};
