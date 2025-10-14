import { Socket } from "socket.io-client";
import { CssVarsProvider } from "@mui/joy/styles";
import { Box, CssBaseline, IconButton } from "@mui/joy";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { useColorScheme } from "@mui/joy/styles";

import { Team, UserProps } from "../../types/admin";
import { Sidebar } from "../../components/layout/sidebar";
import { NoteSidebar } from "./components/NoteSidebar";
import { AllChatProps, ChatProps } from "../../types/chat";
import { MyNoteMain } from "./components/MyNoteMain";
import { ChatNoteMain } from "./components/ChatNoteMain";
import { TaskNoteMain } from "./components/TaskNoteMain";
import { TaskPreview } from "../tasks/components/contents/TaskPreview";
import { ProjectProps, TaskProps } from "../../types/tasks";
import { NoteManagementState } from "../../hooks/useNoteManagement";

type NoteHomeProps = {
    currentTeam: Team;
    setCurrentTeam: (value: Team) => void;
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    teamMembers: UserProps[];
    setTeamMembers: (value: UserProps[]) => void;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    openingService: number;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (value: ChatProps) => void;

    unReadInboxItemCount: number;
    unReadChatAndActivityCounts: number;
    isCreatingTask: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    };
    setIsMainChatVisible: (value: boolean) => void;
    setIsChatNoteVisible: (value: boolean) => void;
    currentPreviewTask?: TaskProps;
    setIsThreadVisible: (value: boolean) => void;
    isThreadVisible: boolean;
    setIsTaskPreviewVisible: (value: boolean) => void;
    setIsCreatingTask: (value: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    }) => void;
    setCurrentPreviewTask: (value: TaskProps) => void;
    setOpenCreateProject: (value: boolean) => void;
    setOpenCreateTag: (value: boolean) => void;
    currentPreviewTaskId: number;
    setCurrentPreviewTaskId: (value: number) => void;
    isCommentUpdated: { isUpdate: boolean; scrollToBottom: boolean };
    setIsCommentUpdated: (value: { isUpdate: boolean; scrollToBottom: boolean }) => void;
    teamProjects: ProjectProps[];
    setTeamProjects: (value: ProjectProps[]) => void;
    setCurrentProject: (value: ProjectProps) => void;
    moveToSpecificChat: (
        chatType: number,
        chatId: number,
        threadId: number,
        openTaskNoteInChat: boolean,
        openThreadTaskPreview: boolean,
        setOpeningService: (service: number) => void,
        setCurrentPreviewTaskId: (id: number) => void,
        setCurrentProject: (project: any) => void
    ) => void;
    currentProject: ProjectProps | null;
    allChats: AllChatProps[];
    funcSetAllChats: () => Promise<void>;
    NM: NoteManagementState;
};
export const NoteHome = (props: NoteHomeProps) => {
    const {
        currentTeam,
        setCurrentTeam,
        teamMemberProfiles,
        socket,
        teamMembers,
        setTeamMembers,
        myself,
        setMyself,
        openingService,
        setOpeningService,
        setCurrentMainChat,
        unReadInboxItemCount,
        unReadChatAndActivityCounts,
        isCreatingTask,
        setIsMainChatVisible,
        setIsChatNoteVisible,
        setCurrentProject,
        currentProject,
        allChats,
        currentPreviewTask,
        setIsThreadVisible,
        isThreadVisible,
        setIsTaskPreviewVisible,
        setIsCreatingTask,
        setCurrentPreviewTask,
        setOpenCreateProject,
        setOpenCreateTag,
        currentPreviewTaskId,
        setCurrentPreviewTaskId,
        isCommentUpdated,
        setIsCommentUpdated,
        teamProjects,
        setTeamProjects,
        moveToSpecificChat,
        funcSetAllChats,
        NM,
    } = props;
    const { mode } = useColorScheme();

    return (
        <CssVarsProvider disableTransitionOnChange>
            <CssBaseline />
            <Box sx={{ display: "flex", minHeight: "100dvh", width: "100vw" }}>
                <Sidebar
                    currentTeam={currentTeam}
                    setCurrentTeam={setCurrentTeam}
                    teamMemberProfiles={teamMemberProfiles}
                    socket={socket}
                    myself={myself}
                    setMyself={setMyself}
                    openingService={openingService}
                    setOpeningService={setOpeningService}
                    setCurrentMainChat={setCurrentMainChat}
                    unReadInboxItemCount={unReadInboxItemCount}
                    unReadChatAndActivityCounts={unReadChatAndActivityCounts}
                />
                <PanelGroup direction="horizontal">
                    <Panel id={"1"} order={1} minSize={10} maxSize={25}>
                        <NoteSidebar NM={NM} />
                    </Panel>

                    <PanelResizeHandle
                        style={{
                            width: "1px",
                            backgroundColor: mode === "dark" ? "grey" : "lightgrey",
                            transition: "all 0.3s ease-in-out",
                            cursor: "col-resize",
                        }}
                        className="resize-handle"
                    />

                    {NM.currentNoteType === 0 && (
                        <Panel id={"2"} order={2} minSize={35} maxSize={85}>
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
                                        component="button"
                                        variant="soft"
                                        color="neutral"
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
                        <Panel id={"3"} order={3} minSize={35} maxSize={85}>
                            <Box sx={{ paddingX: 1, height: "100dvh" }}>
                                {/* My Note selected */}
                                {NM.currentNoteType === 1 && NM.currentMyNoteChain && (
                                    <MyNoteMain
                                        teamMemberProfiles={teamMemberProfiles}
                                        socket={socket}
                                        teamMembers={teamMembers}
                                        myself={myself}
                                        setMyself={setMyself}
                                        setOpeningService={setOpeningService}
                                        setCurrentChat={setCurrentMainChat}
                                        NM={NM}
                                    />
                                )}

                                {/* Task Note selected */}
                                {NM.currentNoteType === 2 && NM.currentTaskNoteChain && (
                                    <>
                                        <TaskNoteMain
                                            teamMemberProfiles={teamMemberProfiles}
                                            socket={socket}
                                            teamMembers={teamMembers}
                                            myself={myself}
                                            setMyself={setMyself}
                                            setOpeningService={setOpeningService}
                                            setCurrentChat={setCurrentMainChat}
                                            isInTaskPage={false}
                                            isCreatingTask={isCreatingTask}
                                            setCurrentPreviewTask={setCurrentPreviewTask}
                                            allChats={allChats}
                                            setCurrentMainChat={setCurrentMainChat}
                                            funcSetAllChats={funcSetAllChats}
                                            NM={NM}
                                        />

                                        {NM.isTaskVisibleInNote && currentPreviewTask && (
                                            <TaskPreview
                                                teamMembers={teamMembers}
                                                setTeamMembers={setTeamMembers}
                                                teamMemberProfiles={teamMemberProfiles}
                                                socket={socket}
                                                myself={myself}
                                                setMyself={setMyself}
                                                setCurrentProject={setCurrentProject}
                                                currentPreviewTask={currentPreviewTask}
                                                setIsMainChatVisible={setIsMainChatVisible}
                                                setIsThreadVisible={setIsThreadVisible}
                                                isThreadVisible={isThreadVisible}
                                                setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                                isCreatingTask={isCreatingTask}
                                                setIsCreatingTask={setIsCreatingTask}
                                                setCurrentPreviewTask={setCurrentPreviewTask}
                                                setOpenCreateProject={setOpenCreateProject}
                                                setOpenCreateTag={setOpenCreateTag}
                                                setCurrentMainChat={setCurrentMainChat}
                                                setOpeningService={setOpeningService}
                                                currentPreviewTaskId={currentPreviewTaskId}
                                                setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                                isCommentUpdated={isCommentUpdated}
                                                setIsCommentUpdated={setIsCommentUpdated}
                                                setIsTaskNoteVisible={NM.setIsTaskNoteVisible}
                                                handleCreateNewTaskNote={
                                                    NM.handleCreateNewTaskNote
                                                }
                                                setCurrentTaskNote={NM.setCurrentTaskNote}
                                                isTaskNoteVisible={NM.isTaskNoteVisible}
                                                teamProjects={teamProjects}
                                                setTeamProjects={setTeamProjects}
                                                taskNoteMeta={NM.taskNoteMeta}
                                                moveToSpecificChat={moveToSpecificChat}
                                                openingService={openingService}
                                            />
                                        )}
                                    </>
                                )}

                                {/* Chat Note selected */}
                                {NM.currentNoteType === 3 && NM.currentChatNoteChain && (
                                    <ChatNoteMain
                                        teamMemberProfiles={teamMemberProfiles}
                                        socket={socket}
                                        teamMembers={teamMembers}
                                        myself={myself}
                                        setMyself={setMyself}
                                        setOpeningService={setOpeningService}
                                        setCurrentChat={setCurrentMainChat}
                                        isInChatPage={false}
                                        setIsMainChatVisible={setIsMainChatVisible}
                                        setIsChatNoteVisible={setIsChatNoteVisible}
                                        moveToSpecificChat={moveToSpecificChat}
                                        allChats={allChats}
                                        setCurrentMainChat={setCurrentMainChat}
                                        funcSetAllChats={funcSetAllChats}
                                        setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                        setCurrentProject={setCurrentProject}
                                        NM={NM}
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
                                            component="button"
                                            variant="soft"
                                            color="neutral"
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

                    {NM.currentTaskNoteChain && NM.isTaskVisibleInNote && currentPreviewTask && (
                        <>
                            <PanelResizeHandle
                                style={{
                                    width: "1px",
                                    backgroundColor: mode === "dark" ? "grey" : "lightgrey",
                                    transition: "all 0.3s ease-in-out",
                                    cursor: "col-resize",
                                }}
                                className="resize-handle"
                            />

                            <Panel id={"4"} order={4} minSize={35} maxSize={85}>
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
                                        teamMembers={teamMembers}
                                        setTeamMembers={setTeamMembers}
                                        teamMemberProfiles={teamMemberProfiles}
                                        socket={socket}
                                        myself={myself}
                                        setMyself={setMyself}
                                        setCurrentProject={setCurrentProject}
                                        currentPreviewTask={currentPreviewTask}
                                        setIsMainChatVisible={setIsMainChatVisible}
                                        setIsThreadVisible={setIsThreadVisible}
                                        isThreadVisible={isThreadVisible}
                                        setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                        isCreatingTask={isCreatingTask}
                                        setIsCreatingTask={setIsCreatingTask}
                                        setCurrentPreviewTask={setCurrentPreviewTask}
                                        setOpenCreateProject={setOpenCreateProject}
                                        setOpenCreateTag={setOpenCreateTag}
                                        setCurrentMainChat={setCurrentMainChat}
                                        setOpeningService={setOpeningService}
                                        currentPreviewTaskId={currentPreviewTaskId}
                                        setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                        isCommentUpdated={isCommentUpdated}
                                        setIsCommentUpdated={setIsCommentUpdated}
                                        setIsTaskNoteVisible={NM.setIsTaskNoteVisible}
                                        handleCreateNewTaskNote={NM.handleCreateNewTaskNote}
                                        setCurrentTaskNote={NM.setCurrentTaskNote}
                                        isTaskNoteVisible={NM.isTaskNoteVisible}
                                        teamProjects={teamProjects}
                                        setTeamProjects={setTeamProjects}
                                        taskNoteMeta={NM.taskNoteMeta}
                                        setIsTaskVisibleInNote={NM.setIsTaskVisibleInNote}
                                        moveToSpecificChat={moveToSpecificChat}
                                        openingService={openingService}
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
