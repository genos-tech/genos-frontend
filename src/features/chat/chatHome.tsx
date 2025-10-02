import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { Box, Sheet, IconButton } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";

import { ThreadPane } from "./ThreadChatPane";
import { ChatSidebar } from "./components/ChatSidebar";
import { MessagesPane } from "./MainChatPane";
import { MessagesSubPane } from "./SubChatPane";
import { Team, UserProps } from "../../types/admin";
import { ActivityMessageProps, AllChatProps, ChatProps, ThreadProps } from "../../types/chat";
import { TaskProps, ProjectProps } from "../../types/tasks";
import { ModalCreateTag } from "../tasks/components/modals/ModalCreateTag";
import { ModalCreateProject } from "../tasks/components/modals/ModalCreateProject";
import { loadSpecificTask } from "../tasks/services/loadSpecificTask";
import { CreateTaskForm } from "../tasks/components/contents/CreateTaskForm";
import { TaskPreview } from "../tasks/components/contents/TaskPreview";
import { Sidebar } from "../../components/layout/sidebar";
import { useAuth } from "../../context/AuthContext";
import {
    ChatNoteProps,
    ChatNoteMetaTreeNode,
    ChatNoteMetaProps,
    TaskNoteProps,
    TaskNoteMetaProps,
} from "../../types/notes";
import { ChatNoteMain } from "../notes/components/ChatNoteMain";

type ChatHomeProps = {
    currentTeam: Team;
    setCurrentTeam: (value: Team) => void;
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    teamMembers: UserProps[];
    currentChatPaneType: number;
    setCurrentChatPaneType: (value: number) => void;
    activityMessages: ActivityMessageProps[];
    setActivityMessages: (value: ActivityMessageProps[]) => void;
    currentMainChat: ChatProps;
    setCurrentMainChat: (chat: ChatProps) => void;
    currentSubChat: ChatProps | undefined;
    setCurrentSubChat: (chat: ChatProps) => void;
    currentThreadChat: ThreadProps | undefined;
    setCurrentThreadChat: (value: ThreadProps) => void;
    openingService: number;
    setOpeningService: (service: number) => void;
    allChats: AllChatProps[];
    setAllChats: (chat: AllChatProps[]) => void;
    funcSetAllChats: () => Promise<void>;
    isCommentUpdated: { isUpdate: boolean; scrollToBottom: boolean };
    setIsCommentUpdated: (value: { isUpdate: boolean; scrollToBottom: boolean }) => void;
    unReadInboxItemCount: number;
    unReadChatCounts: Record<string, number>;
    unReadActivityMessageCounts: number;
    unReadChatAndActivityCounts: number;
    currentNoteType: number;
    currentChatNote: ChatNoteProps | null;
    setCurrentChatNote: (value: ChatNoteProps) => void;
    chatNoteMeta: ChatNoteMetaProps[];
    setChatNoteMeta: (value: ChatNoteMetaProps[]) => void;
    tabItems: any[];
    setTabItems: (value: any[]) => void;
    selectedTabIndex: number;
    handleCreateNewChatNote: (
        parentNoteId: number | null,
        chatType: number,
        chatId: number,
        isThread: boolean,
        threadId: number
    ) => Promise<void>;
    handleCreateNewChatNoteIfNotExist: (
        chatType: number,
        chatId: number,
        isThread: boolean,
        threadId: number
    ) => Promise<void>;
    currentChatNoteChain?: ChatNoteMetaTreeNode[];
    handleCreateNewTaskNote: (
        parentNoteId: number | null,
        projectId: number,
        taskId: number
    ) => Promise<void>;
    setCurrentTaskNote: (value: TaskNoteProps) => void;
    isTaskPreviewVisible: boolean;
    setIsTaskPreviewVisible: (value: boolean) => void;
    isCreatingTask: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    };
    setIsCreatingTask: (value: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    }) => void;
    isChatNoteVisible: boolean;
    setIsChatNoteVisible: (value: boolean) => void;
    isTaskNoteVisible: boolean;
    setIsTaskNoteVisible: (value: boolean) => void;
    currentProject: ProjectProps | null;
    setCurrentProject: (value: ProjectProps | null) => void;
    currentPreviewTaskId: number;
    setCurrentPreviewTaskId: (value: number) => void;
    currentPreviewTask: TaskProps | undefined;
    setCurrentPreviewTask: (value: TaskProps | undefined) => void;
    setOpenCreateProject: (value: boolean) => void;
    setOpenCreateTag: (value: boolean) => void;
    isNewTagCreated: boolean;
    setIsNewTagCreated: (value: boolean) => void;
    openCreateProject: boolean;
    openCreateTag: boolean;
    isMainChatVisible: boolean;
    setIsMainChatVisible: (value: boolean) => void;
    isSubChatVisible: boolean;
    setIsSubChatVisible: (value: boolean) => void;
    isThreadVisible: boolean;
    setIsThreadVisible: (value: boolean) => void;
    teamProjects: ProjectProps[];
    setTeamProjects: (value: ProjectProps[]) => void;
    taskNoteMeta: TaskNoteMetaProps[];
    loadNote: (noteType: number, noteId: number, nextTabIndex: number) => Promise<void>;
};

export const ChatHome = (props: ChatHomeProps) => {
    const {
        currentTeam,
        setCurrentTeam,
        teamMemberProfiles,
        socket,
        myself,
        setMyself,
        teamMembers,
        currentChatPaneType,
        setCurrentChatPaneType,
        activityMessages,
        setActivityMessages,
        currentMainChat,
        setCurrentMainChat,
        currentSubChat,
        setCurrentSubChat,
        currentThreadChat,
        setCurrentThreadChat,
        openingService,
        setOpeningService,
        allChats,
        setAllChats,
        funcSetAllChats,
        isCommentUpdated,
        setIsCommentUpdated,
        unReadInboxItemCount,
        unReadChatCounts,
        unReadActivityMessageCounts,
        unReadChatAndActivityCounts,
        currentNoteType,
        currentChatNote,
        setCurrentChatNote,
        chatNoteMeta,
        setChatNoteMeta,
        tabItems,
        setTabItems,
        selectedTabIndex,
        handleCreateNewChatNote,
        handleCreateNewChatNoteIfNotExist,
        currentChatNoteChain,
        handleCreateNewTaskNote,
        setCurrentTaskNote,
        isTaskPreviewVisible,
        setIsTaskPreviewVisible,
        isCreatingTask,
        setIsCreatingTask,
        isChatNoteVisible,
        setIsChatNoteVisible,
        isTaskNoteVisible,
        setIsTaskNoteVisible,
        currentProject,
        setCurrentProject,
        currentPreviewTaskId,
        setCurrentPreviewTaskId,
        currentPreviewTask,
        setCurrentPreviewTask,
        setOpenCreateProject,
        setOpenCreateTag,
        isNewTagCreated,
        setIsNewTagCreated,
        openCreateProject,
        openCreateTag,
        isMainChatVisible,
        setIsMainChatVisible,
        isSubChatVisible,
        setIsSubChatVisible,
        isThreadVisible,
        setIsThreadVisible,
        teamProjects,
        setTeamProjects,
        taskNoteMeta,
        loadNote,
    } = props;

    // Common
    const { mode } = useColorScheme();
    const { accessToken } = useAuth();

    // Chat Related
    const [currentMainChatId, setCurrentMainChatId] = useState<number>(-1);
    const [currentSubChatId, setCurrentSubChatId] = useState<number>(-1);
    const [currentThreadChatId, setCurrentThreadChatId] = useState<number>(-1);

    useEffect(() => {
        if (currentMainChatId !== currentMainChat.chatId) {
            setCurrentMainChatId(currentMainChat.chatId);
        }
        if (currentMainChat.project) {
            setCurrentProject(currentMainChat.project);
        }
    }, [currentMainChat]);

    useEffect(() => {
        if (currentSubChat !== undefined && currentSubChatId !== currentSubChat.chatId) {
            setCurrentSubChatId(currentSubChat.chatId);
        }
        if (currentSubChat?.project) {
            setCurrentProject(currentSubChat.project);
        }
    }, [currentSubChat]);

    useEffect(() => {
        if (currentThreadChatId !== -1) {
            setCurrentThreadChatId(currentThreadChatId);
        }
    }, [currentThreadChat]);

    useEffect(() => {
        if (currentProject && currentProject.projectId && currentPreviewTaskId !== -1) {
            (async () => {
                const loadedTask: TaskProps[] = await loadSpecificTask(
                    myself,
                    currentProject.projectId,
                    currentPreviewTaskId,
                    accessToken
                );
                if (loadedTask.length > 0) {
                    if (currentThreadChat) {
                        setCurrentThreadChat({ ...currentThreadChat, taskExist: true });
                    }
                    setCurrentPreviewTask(loadedTask[0]);
                    if (isTaskPreviewVisible) {
                        setIsTaskPreviewVisible(true);
                    }
                }
            })();
        }
    }, [isThreadVisible, currentPreviewTaskId, isTaskPreviewVisible, currentProject]);

    useEffect(() => {
        if (currentPreviewTask) {
            setCurrentThreadChatId(Number(currentPreviewTask.id));
        }
    }, [currentPreviewTask]);

    /////////////////// NEED FOR MAIN/SUB Chat Pane height ////////////////////
    const [mainChatPanelSize, setMainChatPanelSize] = useState(50);
    const [subChatPanelSize, setSubChatPanelSize] = useState(50);
    const useWindowSize = () => {
        const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

        useEffect(() => {
            const handleResize = () => {
                setSize({ width: window.innerWidth, height: window.innerHeight });
            };

            window.addEventListener("resize", handleResize);

            // Cleanup event listener on unmount
            return () => window.removeEventListener("resize", handleResize);
        }, []);

        return size;
    };
    const { width, height } = useWindowSize();
    ////////////////////////////////////////////////////////////////////////////

    return (
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

            <PanelGroup autoSaveId="conditional" direction="horizontal">
                {/* Chat Sidebar pane which is always visible */}
                <Panel id={"1"} order={1} minSize={20} maxSize={30}>
                    <Box
                        sx={{
                            height: "100%",
                            width: "100%",
                            borderColor: mode === "dark" ? "black" : "white",
                            borderRight: mode === "dark" ? "2px black groove" : "2px white groove",
                        }}
                    >
                        <Sheet
                            sx={{
                                position: { xs: "fixed", sm: "sticky" },
                                transform: {
                                    xs: "translateX(calc(100% * (var(--MessagesPane-slideIn, 0) - 1)))",
                                    sm: "none",
                                },
                                transition: "transform 0.4s, width 0.4s",
                                zIndex: 100,
                                top: 10,
                            }}
                        >
                            <ChatSidebar
                                teamMemberProfiles={teamMemberProfiles}
                                myself={myself}
                                setMyself={setMyself}
                                currentChatPaneType={currentChatPaneType}
                                setCurrentChatPaneType={setCurrentChatPaneType}
                                activityMessages={activityMessages}
                                setActivityMessages={setActivityMessages}
                                allChats={allChats}
                                setAllChats={setAllChats}
                                setCurrentMainChat={setCurrentMainChat}
                                setCurrentSubChat={setCurrentSubChat}
                                setCurrentThreadChat={setCurrentThreadChat}
                                currentMainChat={currentMainChat}
                                currentSubChat={currentSubChat ? currentSubChat : currentMainChat}
                                socket={socket}
                                setIsMainChatVisible={setIsMainChatVisible}
                                isSubChatVisible={isSubChatVisible}
                                setIsSubChatVisible={setIsSubChatVisible}
                                setIsThreadVisible={setIsThreadVisible}
                                isThreadVisible={isThreadVisible}
                                setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                isTaskPreviewVisible={isTaskPreviewVisible}
                                isCreatingTask={isCreatingTask}
                                setIsCreatingTask={setIsCreatingTask}
                                setOpeningService={setOpeningService}
                                setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                setCurrentProject={setCurrentProject}
                                unReadChatCounts={unReadChatCounts}
                                unReadActivityMessageCounts={unReadActivityMessageCounts}
                                funcSetAllChats={funcSetAllChats}
                            />
                        </Sheet>
                    </Box>
                </Panel>

                {/* Main Chat and Sub Chat Pane */}
                {isMainChatVisible === true && (
                    <>
                        <PanelResizeHandle
                            key="main-chat-resize-handle"
                            style={{
                                width: "1px",
                                backgroundColor: mode === "dark" ? "black" : "white",
                                transition: "all 0.3s ease-in-out",
                                cursor: "col-resize",
                            }}
                            className="chat-resize-handle"
                        />
                        <Panel id={"2"} order={2} minSize={25} maxSize={90}>
                            <PanelGroup autoSaveId="conditional" direction="vertical">
                                {/* Sub Chat Pane */}
                                {isSubChatVisible === true && (
                                    <>
                                        <Panel
                                            id={"3"}
                                            order={3}
                                            minSize={30}
                                            maxSize={80}
                                            onResize={setSubChatPanelSize}
                                        >
                                            <MessagesSubPane
                                                teamMemberProfiles={teamMemberProfiles}
                                                currentWindowHeight={height}
                                                paneSizePCT={subChatPanelSize}
                                                myself={myself}
                                                setMyself={setMyself}
                                                teamMembers={teamMembers}
                                                chat={currentMainChat}
                                                subChat={
                                                    currentSubChat
                                                        ? currentSubChat
                                                        : currentMainChat
                                                }
                                                socket={socket}
                                                setCurrentMainChat={setCurrentMainChat}
                                                setCurrentSubChat={setCurrentSubChat}
                                                currentSubChat={currentSubChat}
                                                currentThreadChat={currentThreadChat}
                                                setCurrentThreadChat={setCurrentThreadChat}
                                                isThreadVisible={isThreadVisible}
                                                setIsMainChatVisible={setIsMainChatVisible}
                                                setIsSubChatVisible={setIsSubChatVisible}
                                                setIsThreadVisible={setIsThreadVisible}
                                                setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                                isCreatingTask={isCreatingTask}
                                                setIsCreatingTask={setIsCreatingTask}
                                                currentSubChatId={currentSubChatId}
                                                setCurrentPreviewTask={setCurrentPreviewTask}
                                                setOpeningService={setOpeningService}
                                                funcSetAllChats={funcSetAllChats}
                                                setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                                setCurrentProject={setCurrentProject}
                                            />
                                        </Panel>

                                        <PanelResizeHandle
                                            key="sub-chat-resize-handle"
                                            style={{
                                                width: "1px",
                                                backgroundColor:
                                                    mode === "dark" ? "black" : "white",
                                                transition: "all 0.3s ease-in-out",
                                                cursor: "col-resize",
                                            }}
                                            className="chat-resize-handle-ver"
                                        />
                                    </>
                                )}

                                {/* Main Chat Pane */}
                                <Panel
                                    id={"4"}
                                    order={4}
                                    minSize={30}
                                    maxSize={80}
                                    onResize={setMainChatPanelSize}
                                >
                                    {/* No chat selected */}
                                    {currentMainChat.chatId === -1 && (
                                        <>
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
                                                    Choose a Chat from Sidebar
                                                </IconButton>
                                            </Box>
                                        </>
                                    )}

                                    {/* Chat selected */}
                                    {currentMainChat.chatId !== -1 && (
                                        <MessagesPane
                                            teamMemberProfiles={teamMemberProfiles}
                                            currentWindowHeight={height}
                                            paneSizePCT={mainChatPanelSize}
                                            chat={currentMainChat}
                                            subChat={
                                                currentSubChat ? currentSubChat : currentMainChat
                                            }
                                            myself={myself}
                                            setMyself={setMyself}
                                            teamMembers={teamMembers}
                                            socket={socket}
                                            currentMainChat={currentMainChat}
                                            setCurrentMainChat={setCurrentMainChat}
                                            setCurrentSubChat={setCurrentSubChat}
                                            currentThreadChat={currentThreadChat}
                                            setCurrentThreadChat={setCurrentThreadChat}
                                            isThreadVisible={isThreadVisible}
                                            setIsMainChatVisible={setIsMainChatVisible}
                                            setIsThreadVisible={setIsThreadVisible}
                                            isCreatingTask={isCreatingTask}
                                            setIsCreatingTask={setIsCreatingTask}
                                            setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                            isSubChatVisible={isSubChatVisible}
                                            setIsSubChatVisible={setIsSubChatVisible}
                                            currentMainChatId={currentMainChatId}
                                            setCurrentPreviewTask={setCurrentPreviewTask}
                                            setOpeningService={setOpeningService}
                                            funcSetAllChats={funcSetAllChats}
                                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                            setCurrentProject={setCurrentProject}
                                        />
                                    )}
                                </Panel>
                            </PanelGroup>
                        </Panel>
                    </>
                )}

                {/* Thread Chat Pane */}
                {isThreadVisible === true && currentThreadChat && (
                    <>
                        <PanelResizeHandle
                            key="thread-chat-resize-handle"
                            style={{
                                width: "1px",
                                backgroundColor: mode === "dark" ? "black" : "white",
                                transition: "all 0.3s ease-in-out",
                                cursor: "col-resize",
                            }}
                            className="chat-resize-handle"
                        />
                        <Panel id={"5"} order={5} minSize={25} maxSize={70}>
                            <Box
                                sx={{
                                    height: "100%",
                                    backgroundColor: "black",
                                    borderColor: mode === "dark" ? "black" : "white",
                                    borderLeft:
                                        mode === "dark" ? "2px black groove" : "2px white groove",
                                }}
                            >
                                <ThreadPane
                                    teamMemberProfiles={teamMemberProfiles}
                                    currentWindowHeight={height}
                                    thread={currentThreadChat}
                                    myself={myself}
                                    setMyself={setMyself}
                                    socket={socket}
                                    teamMembers={teamMembers}
                                    currentThreadChat={currentThreadChat}
                                    setCurrentThreadChat={setCurrentThreadChat}
                                    setIsThreadVisible={setIsThreadVisible}
                                    currentThreadChatId={currentThreadChatId}
                                    setIsMainChatVisible={setIsMainChatVisible}
                                    setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                    isTaskPreviewVisible={isTaskPreviewVisible}
                                    isCreatingTask={isCreatingTask}
                                    setIsCreatingTask={setIsCreatingTask}
                                    currentPreviewTask={currentPreviewTask}
                                    setOpeningService={setOpeningService}
                                    setCurrentMainChat={setCurrentMainChat}
                                    currentPreviewTaskId={currentPreviewTaskId}
                                    isChatNoteVisible={isChatNoteVisible}
                                    setIsChatNoteVisible={setIsChatNoteVisible}
                                    handleCreateNewChatNoteIfNotExist={
                                        handleCreateNewChatNoteIfNotExist
                                    }
                                />
                            </Box>
                        </Panel>
                    </>
                )}

                {/* Create Task Pane */}
                {isCreatingTask.flag === true && (
                    <>
                        <PanelResizeHandle
                            key="create-task-resize-handle"
                            style={{
                                width: "1px",
                                backgroundColor: mode === "dark" ? "black" : "white",
                                transition: "all 0.3s ease-in-out",
                                cursor: "col-resize",
                            }}
                            className="chat-resize-handle"
                        />

                        <Panel id={"6"} order={6} minSize={30} maxSize={70}>
                            <Box
                                sx={{
                                    px: { xs: 1, md: 2 },
                                    pt: {
                                        xs: "calc(12px + var(--Header-height))",
                                        sm: "calc(12px + var(--Header-height))",
                                        md: 2,
                                    },
                                    pb: { xs: 2, sm: 2, md: 1 },
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
                                <CreateTaskForm
                                    teamMemberProfiles={teamMemberProfiles}
                                    socket={socket}
                                    myself={myself}
                                    setMyself={setMyself}
                                    currentMainChat={currentMainChat}
                                    currentThreadChat={currentThreadChat}
                                    chatType={currentThreadChat?.chatType || -1}
                                    setIsMainChatVisible={setIsMainChatVisible}
                                    isThreadVisible={isThreadVisible}
                                    setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                    isCreatingTask={isCreatingTask}
                                    setIsCreatingTask={setIsCreatingTask}
                                    setOpenCreateProject={setOpenCreateProject}
                                    setOpenCreateTag={setOpenCreateTag}
                                    currentProject={currentProject}
                                    setCurrentProject={setCurrentProject}
                                    setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                    isNewTagCreated={isNewTagCreated}
                                    setCurrentMainChat={setCurrentMainChat}
                                    setOpeningService={setOpeningService}
                                    parentTaskId={null}
                                    rootTaskId={null}
                                    teamProjects={teamProjects}
                                    setTeamProjects={setTeamProjects}
                                />
                            </Box>
                        </Panel>
                    </>
                )}

                {/* Task Preview Pane */}
                {isTaskPreviewVisible === true && currentPreviewTask && (
                    <>
                        <PanelResizeHandle
                            key="task-preview-resize-handle"
                            style={{
                                width: "1px",
                                backgroundColor: mode === "dark" ? "black" : "white",
                                transition: "all 0.3s ease-in-out",
                                cursor: "col-resize",
                            }}
                            className="chat-resize-handle"
                        />

                        <Panel id={"7"} order={7} minSize={30} maxSize={70}>
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
                            </Box>
                        </Panel>
                    </>
                )}

                {/* Chat Note Pane */}
                {isChatNoteVisible === true && (
                    <>
                        <PanelResizeHandle
                            key="chat-note-resize-handle"
                            style={{
                                width: "1px",
                                backgroundColor: mode === "dark" ? "black" : "white",
                                transition: "all 0.3s ease-in-out",
                                cursor: "col-resize",
                            }}
                            className="chat-resize-handle"
                        />

                        <Panel id={"8"} order={8} minSize={30} maxSize={90}>
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
                                <ChatNoteMain
                                    teamMemberProfiles={teamMemberProfiles}
                                    socket={socket}
                                    teamMembers={teamMembers}
                                    myself={myself}
                                    setMyself={setMyself}
                                    currentChatNote={currentChatNote}
                                    setCurrentChatNote={setCurrentChatNote}
                                    setOpeningService={setOpeningService}
                                    setCurrentChat={setCurrentMainChat}
                                    currentNoteType={currentNoteType}
                                    chatNoteMeta={chatNoteMeta}
                                    setChatNoteMeta={setChatNoteMeta}
                                    tabItems={tabItems}
                                    setTabItems={setTabItems}
                                    selectedTabIndex={selectedTabIndex}
                                    handleCreateNewChatNote={handleCreateNewChatNote}
                                    currentChatNoteChain={currentChatNoteChain}
                                    isInChatPage={true}
                                    setIsMainChatVisible={setIsMainChatVisible}
                                    setIsChatNoteVisible={setIsChatNoteVisible}
                                    loadNote={loadNote}
                                />
                            </Box>
                        </Panel>
                    </>
                )}

                {/* Select Chat Pane if no pane is visible */}
                {isMainChatVisible === false &&
                    isThreadVisible === false &&
                    isCreatingTask.flag === false &&
                    isTaskPreviewVisible === false &&
                    isChatNoteVisible === false && (
                        <>
                            <PanelResizeHandle
                                key="select-chat-resize-handle"
                                style={{
                                    width: "1px",
                                    backgroundColor: mode === "dark" ? "black" : "white",
                                    transition: "all 0.3s ease-in-out",
                                    cursor: "col-resize",
                                }}
                                className="chat-resize-handle"
                            />
                            <Panel
                                id={"9"}
                                order={9}
                                defaultSize={70}
                                minSize={30}
                                maxSize={80}
                                onResize={setMainChatPanelSize}
                            >
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
                                        Choose a Chat from Sidebar
                                    </IconButton>
                                </Box>
                            </Panel>
                        </>
                    )}

                {/* Modal for creating a new project */}
                <ModalCreateProject
                    myself={myself}
                    openCreateProject={openCreateProject}
                    setOpenCreateProject={setOpenCreateProject}
                    setCurrentProject={setCurrentProject}
                />

                {/* Modal for creating a new tag */}
                <ModalCreateTag
                    myself={myself}
                    currentProject={currentProject}
                    openCreateTag={openCreateTag}
                    setOpenCreateTag={setOpenCreateTag}
                    setIsNewTagCreated={setIsNewTagCreated}
                />
            </PanelGroup>

            {/* Hover Animation with CSS */}
            <style>
                {`
                .chat-resize-handle {
                    transition: all 0.3s ease-in-out;
                }
                .chat-resize-handle:hover {
                    background-color: lightgray !important;
                    width: 8px !important;
                }
                `}
            </style>
        </Box>
    );
};
