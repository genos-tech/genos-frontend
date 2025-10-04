import { Socket } from "socket.io-client";
import { CssVarsProvider } from "@mui/joy/styles";
import { Box, CssBaseline, IconButton, Tooltip, Typography, Stack } from "@mui/joy";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { useColorScheme } from "@mui/joy/styles";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";

import { Team, UserProps } from "../../types/admin";
import { Sidebar } from "../../components/layout/sidebar";
import { NoteSidebar } from "./components/NoteSidebar";
import { ChatProps } from "../../types/chat";
import { MyNoteMain } from "./components/MyNoteMain";
import {
    MyNoteMetaProps,
    TaskNoteMetaProps,
    ChatNoteMetaProps,
    MyNoteProps,
    MyNoteMetaTreeNode,
    TaskNoteProps,
    ChatNoteProps,
    TaskNoteMetaTreeNode,
    ChatNoteMetaTreeNode,
} from "../../types/notes";
import { ChatNoteMain } from "./components/ChatNoteMain";
import { TaskNoteMain } from "./components/TaskNoteMain";
import { TaskPreview } from "../tasks/components/contents/TaskPreview";
import { ProjectProps, TaskProps } from "../../types/tasks";

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
    currentNoteType: number;
    setCurrentNoteType: (value: number) => void;
    myNoteMeta: MyNoteMetaProps[];
    setMyNoteMeta: (value: MyNoteMetaProps[]) => void;
    taskNoteMeta: TaskNoteMetaProps[];
    setTaskNoteMeta: (value: TaskNoteMetaProps[]) => void;
    chatNoteMeta: ChatNoteMetaProps[];
    setChatNoteMeta: (value: ChatNoteMetaProps[]) => void;
    tabItems: any[];
    setTabItems: (value: any[]) => void;
    selectedTabIndex: number;
    currentMyNote: MyNoteProps | null;
    handleCreateNewMyNote: (parentNoteId: number | null) => Promise<void>;
    currentTaskNote: TaskNoteProps | null;
    handleCreateNewTaskNote: (
        parentNoteId: number | null,
        projectId: number,
        taskId: number,
        title?: string
    ) => Promise<void>;
    currentChatNote: ChatNoteProps | null;
    setCurrentChatNote: (value: ChatNoteProps) => void;
    handleCreateNewChatNote: (
        parentNoteId: number | null,
        chatType: number,
        chatId: number,
        isThread: boolean,
        threadId: number
    ) => Promise<void>;
    currentMyNoteChain?: MyNoteMetaTreeNode[];
    currentTaskNoteChain?: TaskNoteMetaTreeNode[];
    currentChatNoteChain?: ChatNoteMetaTreeNode[];
    unReadInboxItemCount: number;
    unReadChatAndActivityCounts: number;
    myNoteMetaTree: MyNoteMetaTreeNode[];
    taskNoteMetaTree: TaskNoteMetaTreeNode[];
    chatNoteMetaTree: ChatNoteMetaTreeNode[];
    allNoteIdChains: Record<string, number[]>;
    isCreatingTask: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    };
    setIsMainChatVisible: (value: boolean) => void;
    setIsTaskNoteVisible: (value: boolean) => void;
    setIsChatNoteVisible: (value: boolean) => void;
    loadNote: (noteType: number, noteId: number, nextTabIndex: number) => Promise<void>;
    isTaskVisibleInNote: boolean;
    setIsTaskVisibleInNote: (value: boolean) => void;
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
    setCurrentTaskNote: (value: TaskNoteProps) => void;
    isTaskNoteVisible: boolean;
    teamProjects: ProjectProps[];
    setTeamProjects: (value: ProjectProps[]) => void;
    setCurrentProject: (value: ProjectProps) => void;
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
        currentNoteType,
        setCurrentNoteType,
        myNoteMeta,
        setMyNoteMeta,
        taskNoteMeta,
        setTaskNoteMeta,
        chatNoteMeta,
        setChatNoteMeta,
        tabItems,
        setTabItems,
        selectedTabIndex,
        currentMyNote,
        handleCreateNewMyNote,
        currentTaskNote,
        handleCreateNewTaskNote,
        currentChatNote,
        setCurrentChatNote,
        handleCreateNewChatNote,
        currentMyNoteChain,
        currentTaskNoteChain,
        currentChatNoteChain,
        unReadInboxItemCount,
        unReadChatAndActivityCounts,
        myNoteMetaTree,
        taskNoteMetaTree,
        chatNoteMetaTree,
        allNoteIdChains,
        isCreatingTask,
        setIsMainChatVisible,
        setIsTaskNoteVisible,
        setIsChatNoteVisible,
        loadNote,
        setIsTaskVisibleInNote,
        isTaskVisibleInNote,
        setCurrentProject,
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
        setCurrentTaskNote,
        isTaskNoteVisible,
        teamProjects,
        setTeamProjects,
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
                        <NoteSidebar
                            loadNote={loadNote}
                            currentNoteType={currentNoteType}
                            setCurrentNoteType={setCurrentNoteType}
                            myNoteMetaTree={myNoteMetaTree}
                            currentMyNote={currentMyNote}
                            currentTaskNote={currentTaskNote}
                            currentChatNote={currentChatNote}
                            handleCreateNewMyNote={handleCreateNewMyNote}
                            handleCreateNewTaskNote={handleCreateNewTaskNote}
                            handleCreateNewChatNote={handleCreateNewChatNote}
                            currentMyNoteChain={currentMyNoteChain}
                            taskNoteMetaTree={taskNoteMetaTree}
                            currentTaskNoteChain={currentTaskNoteChain}
                            chatNoteMetaTree={chatNoteMetaTree}
                            tabItems={tabItems}
                            currentChatNoteChain={currentChatNoteChain}
                            allNoteIdChains={allNoteIdChains}
                            selectedTabIndex={selectedTabIndex}
                        />
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

                    {currentNoteType === 0 && (
                        <Panel id={"2"} order={2} minSize={35} maxSize={85}>
                            <Box sx={{ paddingX: 1, height: "100dvh" }}>
                                <Stack
                                    direction="row"
                                    alignItems="center"
                                    justifyContent="space-between"
                                    sx={{ width: "100%" }}
                                >
                                    <Typography fontSize="20px">Note Home</Typography>

                                    <Tooltip title="Create a New Note" size="sm">
                                        <IconButton
                                            component="button"
                                            size="sm"
                                            variant="outlined"
                                            color="neutral"
                                            onClick={() => {}}
                                            sx={{ px: "10px" }}
                                        >
                                            <PlaylistAddIcon />
                                            New Note
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                            </Box>
                        </Panel>
                    )}

                    {currentNoteType !== 0 && (
                        <Panel id={"3"} order={3} minSize={35} maxSize={85}>
                            <Box sx={{ paddingX: 1, height: "100dvh" }}>
                                {/* My Note selected */}
                                {currentNoteType === 1 && currentMyNoteChain && (
                                    <MyNoteMain
                                        teamMemberProfiles={teamMemberProfiles}
                                        socket={socket}
                                        teamMembers={teamMembers}
                                        myself={myself}
                                        setMyself={setMyself}
                                        currentNoteType={currentNoteType}
                                        currentMyNote={currentMyNote}
                                        setOpeningService={setOpeningService}
                                        setCurrentChat={setCurrentMainChat}
                                        myNoteMeta={myNoteMeta} // TODO: Use the correct note based on noteType
                                        setMyNoteMeta={setMyNoteMeta}
                                        tabItems={tabItems}
                                        setTabItems={setTabItems}
                                        selectedTabIndex={selectedTabIndex}
                                        handleCreateNewMyNote={handleCreateNewMyNote}
                                        currentMyNoteChain={currentMyNoteChain}
                                        loadNote={loadNote}
                                    />
                                )}

                                {/* Task Note selected */}
                                {currentNoteType === 2 && currentTaskNoteChain && (
                                    <Box>
                                        <TaskNoteMain
                                            teamMemberProfiles={teamMemberProfiles}
                                            socket={socket}
                                            teamMembers={teamMembers}
                                            myself={myself}
                                            setMyself={setMyself}
                                            currentNoteType={currentNoteType}
                                            currentTaskNote={currentTaskNote}
                                            setOpeningService={setOpeningService}
                                            setCurrentChat={setCurrentMainChat}
                                            taskNoteMeta={taskNoteMeta}
                                            setTaskNoteMeta={setTaskNoteMeta}
                                            tabItems={tabItems}
                                            setTabItems={setTabItems}
                                            selectedTabIndex={selectedTabIndex}
                                            handleCreateNewTaskNote={handleCreateNewTaskNote}
                                            currentTaskNoteChain={currentTaskNoteChain}
                                            isInTaskPage={false}
                                            isCreatingTask={isCreatingTask}
                                            setIsTaskNoteVisible={setIsTaskNoteVisible}
                                            loadNote={loadNote}
                                            setIsTaskVisibleInNote={setIsTaskVisibleInNote}
                                            setCurrentPreviewTask={setCurrentPreviewTask}
                                        />

                                        {isTaskVisibleInNote && currentPreviewTask && (
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
                                                setIsTaskNoteVisible={setIsTaskNoteVisible}
                                                handleCreateNewTaskNote={handleCreateNewTaskNote}
                                                setCurrentTaskNote={setCurrentTaskNote}
                                                isTaskNoteVisible={isTaskNoteVisible}
                                                teamProjects={teamProjects}
                                                setTeamProjects={setTeamProjects}
                                                taskNoteMeta={taskNoteMeta}
                                            />
                                        )}
                                    </Box>
                                )}

                                {/* Chat Note selected */}
                                {currentNoteType === 3 && currentChatNoteChain && (
                                    <ChatNoteMain
                                        teamMemberProfiles={teamMemberProfiles}
                                        socket={socket}
                                        teamMembers={teamMembers}
                                        myself={myself}
                                        setMyself={setMyself}
                                        currentChatNote={currentChatNote}
                                        setOpeningService={setOpeningService}
                                        setCurrentChatNote={setCurrentChatNote}
                                        setCurrentChat={setCurrentMainChat}
                                        currentNoteType={currentNoteType}
                                        chatNoteMeta={chatNoteMeta}
                                        setChatNoteMeta={setChatNoteMeta}
                                        tabItems={tabItems}
                                        setTabItems={setTabItems}
                                        selectedTabIndex={selectedTabIndex}
                                        handleCreateNewChatNote={handleCreateNewChatNote}
                                        currentChatNoteChain={currentChatNoteChain}
                                        isInChatPage={false}
                                        setIsMainChatVisible={setIsMainChatVisible}
                                        setIsChatNoteVisible={setIsChatNoteVisible}
                                        loadNote={loadNote}
                                    />
                                )}
                            </Box>
                        </Panel>
                    )}

                    {currentTaskNoteChain && isTaskVisibleInNote && currentPreviewTask && (
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
                                    setIsTaskNoteVisible={setIsTaskNoteVisible}
                                    handleCreateNewTaskNote={handleCreateNewTaskNote}
                                    setCurrentTaskNote={setCurrentTaskNote}
                                    isTaskNoteVisible={isTaskNoteVisible}
                                    teamProjects={teamProjects}
                                    setTeamProjects={setTeamProjects}
                                    taskNoteMeta={taskNoteMeta}
                                    setIsTaskVisibleInNote={setIsTaskVisibleInNote}
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
