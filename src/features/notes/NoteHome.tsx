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
    UIM: UIStateManagementState;
    IM: InboxManagementState;
    PM: ProjectManagementState;
    NM: NoteManagementState;
    CM: ChatManagementState;
    TM: TaskManagementState;
};
export const NoteHome = (props: NoteHomeProps) => {
    const { TEM, socket, myself, setMyself, UIM, IM, NM, CM, PM, TM } = props;

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
                            CM={CM}
                            myself={myself}
                            NM={NM}
                            PM={PM}
                            setMyself={setMyself}
                            socket={socket}
                            TEM={TEM}
                            TM={TM}
                            UIM={UIM}
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
                        CM={CM}
                        myself={myself}
                        NM={NM}
                        PM={PM}
                        setMyself={setMyself}
                        socket={socket}
                        TEM={TEM}
                        TM={TM}
                        UIM={UIM}
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
                    CM={CM}
                    IM={IM}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    TEM={TEM}
                    UIM={UIM}
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
                        CM={CM}
                        myself={myself}
                        NM={NM}
                        PM={PM}
                        setMyself={setMyself}
                        socket={socket}
                        TEM={TEM}
                        TM={TM}
                        UIM={UIM}
                    />
                </PanelGroup>

                <ResizeHandleStyles />
            </Box>
        </CssVarsProvider>
    );
};
