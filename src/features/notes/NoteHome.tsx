import { Box, CssBaseline, IconButton } from "@mui/joy";
import { CssVarsProvider, useColorScheme } from "@mui/joy/styles";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Socket } from "socket.io-client";

import { ChatNoteMain } from "./components/ChatNoteMain";
import { MyNoteMain } from "./components/MyNoteMain";
import { NoteSidebar } from "./components/NoteSidebar";
import { TaskNoteMain } from "./components/TaskNoteMain";

import { Sidebar } from "../../components/layout/sidebar";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { NoteManagementState } from "../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { TaskPreview } from "../tasks/components/contents/TaskPreview";

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
                        <NoteSidebar NM={NM} />
                    </Panel>

                    <PanelResizeHandle
                        className="resize-handle"
                        style={{
                            width: "1px",
                            backgroundColor: mode === "dark" ? "grey" : "lightgrey",
                            transition: "all 0.3s ease-in-out",
                            cursor: "col-resize",
                        }}
                    />

                    {NM.currentNoteType === 0 && (
                        <Panel id={"2"} maxSize={85} minSize={35} order={2}>
                            <Box sx={{ paddingX: 1, height: "100dvh" }}>
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
                                        (TBD) Note Home
                                    </IconButton>
                                </Box>
                            </Box>
                        </Panel>
                    )}

                    {NM.currentNoteType !== 0 && (
                        <Panel id={"3"} maxSize={85} minSize={35} order={3}>
                            <Box sx={{ paddingX: 1, height: "100dvh" }}>
                                {/* My Note selected */}
                                {NM.currentNoteType === 1 && NM.currentMyNoteChain && (
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
                                )}

                                {/* Task Note selected */}
                                {NM.currentNoteType === 2 && NM.currentTaskNoteChain && (
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
                                                isThreadVisible={CM.isThreadVisible}
                                                moveToSpecificChat={CM.moveToSpecificChat}
                                                myself={myself}
                                                openingService={openingService}
                                                setCurrentMainChat={CM.setCurrentMainChat}
                                                setCurrentProject={PM.setCurrentProject}
                                                setCurrentTaskNote={NM.setCurrentTaskNote}
                                                setIsMainChatVisible={CM.setIsMainChatVisible}
                                                setIsTaskNoteVisible={NM.setIsTaskNoteVisible}
                                                setIsThreadVisible={CM.setIsThreadVisible}
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
                                                handleCreateNewTaskNote={
                                                    NM.handleCreateNewTaskNote
                                                }
                                            />
                                        )}
                                    </>
                                )}

                                {/* Chat Note selected */}
                                {NM.currentNoteType === 3 && NM.currentChatNoteChain && (
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
                                )}

                                {/* Shared Note selected */}
                                {NM.currentNoteType === 4 && (
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
                                            (TBD) Shared Notes
                                        </IconButton>
                                    </Box>
                                )}
                            </Box>
                        </Panel>
                    )}

                    {NM.currentTaskNoteChain &&
                        NM.isTaskVisibleInNote &&
                        TM.currentPreviewTask && (
                            <>
                                <PanelResizeHandle
                                    className="resize-handle"
                                    style={{
                                        width: "1px",
                                        backgroundColor: mode === "dark" ? "grey" : "lightgrey",
                                        transition: "all 0.3s ease-in-out",
                                        cursor: "col-resize",
                                    }}
                                />

                                <Panel id={"4"} maxSize={85} minSize={35} order={4}>
                                    <Box
                                        sx={{
                                            px: { xs: 1, md: 2 },
                                            pt: {
                                                xs: "calc(12px + var(--Header-height))",
                                                sm: "calc(12px + var(--Header-height))",
                                                md: 2,
                                            },
                                            pb: { xs: 2, sm: 2, md: 3 },
                                            flex: 1,
                                            display: "flex",
                                            flexDirection: "column",
                                            minWidth: 0,
                                            height: "100dvh",
                                            gap: 1,
                                            ml: "1px",
                                            boxShadow: "0 0 0 1px grey",
                                            borderColor: mode === "dark" ? "black" : "white",
                                        }}
                                    >
                                        <TaskPreview
                                            handleCreateNewTaskNote={NM.handleCreateNewTaskNote}
                                            isTaskNoteVisible={NM.isTaskNoteVisible}
                                            isThreadVisible={CM.isThreadVisible}
                                            moveToSpecificChat={CM.moveToSpecificChat}
                                            myself={myself}
                                            openingService={openingService}
                                            setCurrentMainChat={CM.setCurrentMainChat}
                                            setCurrentProject={PM.setCurrentProject}
                                            setCurrentTaskNote={NM.setCurrentTaskNote}
                                            setIsMainChatVisible={CM.setIsMainChatVisible}
                                            setIsTaskNoteVisible={NM.setIsTaskNoteVisible}
                                            setIsTaskVisibleInNote={NM.setIsTaskVisibleInNote}
                                            setIsThreadVisible={CM.setIsThreadVisible}
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
                                        />
                                    </Box>
                                </Panel>
                            </>
                        )}
                </PanelGroup>

                {/* Hover Animation with CSS */}
                <style>
                    {`
                .resize-handle {
                    transition: all 0.3s ease-in-out;
                }
                .resize-handle:hover {
                    background-color: lightgray !important;
                    width: 8px !important;
                }
                `}
                </style>
            </Box>
        </CssVarsProvider>
    );
};
