import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { Box, Sheet } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";

import { ThreadPane } from "./ThreadChatPane";
import { ChatSidebar } from "./components/ChatSidebar";
import { MessagesPane } from "./MainChatPane";
import { MessagesSubPane } from "./SubChatPane";
import { UserProps } from "../../types/admin";
import { AllChatProps, ChatProps, ThreadProps } from "../../types/chat";
import { TaskProps, ProjectProps } from "../../types/tasks";
import { ModalCreateTag } from "../tasks/components/modals/ModalCreateTag";
import { ModalCreateProject } from "../tasks/components/modals/ModalCreateProject";
import { loadSpecificTask } from "../tasks/services/loadSpecificTask";
import { CreateTaskForm } from "../tasks/components/contents/CreateTaskForm";
import { TaskPreview } from "../tasks/components/contents/TaskPreview";
import { Sidebar } from "../../components/layout/sidebar";
import { useAuth } from "../../context/AuthContext";

type ChatHomeProps = {
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    currentMainChat: ChatProps;
    setCurrentMainChat: (chat: ChatProps) => void;
    currentSubChat: ChatProps | undefined;
    setCurrentSubChat: (chat: ChatProps) => void;
    currentThreadChat: ThreadProps | undefined;
    setCurrentThreadChat: (value: ThreadProps) => void;
    setOpeningService: (service: number) => void;
    allChats: AllChatProps[];
    setAllChats: () => void;
    isCommentUpdated: boolean;
    setIsCommentUpdated: (value: boolean) => void;
};

export const ChatHome = (props: ChatHomeProps) => {
    const {
        socket,
        myself,
        setMyself,
        currentMainChat,
        setCurrentMainChat,
        currentSubChat,
        setCurrentSubChat,
        currentThreadChat,
        setCurrentThreadChat,
        setOpeningService,
        allChats,
        setAllChats,
        isCommentUpdated,
        setIsCommentUpdated,
    } = props;

    const { mode } = useColorScheme();
    const { accessToken } = useAuth();
    const [isMainChatVisible, setIsMainChatVisible] = useState(true); // Main chat pane is visible or not
    const [isSubChatVisible, setIsSubChatVisible] = useState(false); // Sub chat in the main chat pane is visible or not
    const [isThreadVisible, setIsThreadVisible] = useState(false); // Thread pane is visible or not
    const [isTaskPreviewVisible, setIsTaskPreviewVisible] = useState(false);
    const [isTaskCreationVisible, setIsTaskCreationVisible] = useState(false);

    const [isOpeningTask, setIsOpeningTask] = useState(false);
    const [isCreatingTask, setIsCreatingTask] = useState(false);
    const [openCreateProject, setOpenCreateProject] = useState(false);
    const [openCreateTag, setOpenCreateTag] = useState(false);
    const [isNewProjectCreated, setIsNewProjectCreated] = useState(false);
    const [isNewTagCreated, setIsNewTagCreated] = useState(false);
    const [currentPreviewTaskId, setCurrentPreviewTaskId] = useState<number>(-1);
    const [currentPreviewTask, setCurrentPreviewTask] = useState<TaskProps>();
    const [currentProject, setCurrentProject] = useState<ProjectProps | null>(null);

    const [currentMainChatId, setCurrentMainChatId] = useState<number>(-1);
    const [currentSubChatId, setCurrentSubChatId] = useState<number>(-1);
    const [currentThreadChatId, setCurrentThreadChatId] = useState<number>(-1);

    useEffect(() => {
        if (currentMainChatId !== currentMainChat.chatId) {
            setCurrentMainChatId(currentMainChat.chatId);
        }
    }, [currentMainChat]);

    useEffect(() => {
        if (currentSubChat !== undefined && currentSubChatId !== currentSubChat.chatId) {
            setCurrentSubChatId(currentSubChat.chatId);
        }
    }, [currentSubChat]);

    useEffect(() => {
        if (currentThreadChatId !== -1) {
            setCurrentThreadChatId(currentThreadChatId);
        }
    }, [currentThreadChat]);

    useEffect(() => {
        if (currentProject && currentPreviewTaskId !== -1) {
            (async () => {
                const loadedTask: TaskProps[] = await loadSpecificTask(
                    myself,
                    currentProject.projectId,
                    currentPreviewTaskId,
                    accessToken
                );
                setCurrentPreviewTask(loadedTask[0]);
                setIsTaskPreviewVisible(true);
                setIsCreatingTask(false);
            })();
        }
    }, [currentPreviewTaskId]);

    useEffect(() => {
        if (currentPreviewTask) {
            setCurrentThreadChatId(Number(currentPreviewTask.id));
        }
    }, [currentPreviewTask]);

    ////////////////////////////////////////////////////////////////////
    // useEffect(() => {
    //     console.log("currentMainChat Updated:", currentMainChat);
    // }, [currentMainChat]);

    // useEffect(() => {
    //     console.log("initLoad Updated:", initLoad);
    // }, [initLoad]);

    // useEffect(() => {
    //     console.log("isSubChatVisible Updated:", isSubChatVisible);
    // }, [isSubChatVisible]);

    // useEffect(() => {
    //     console.log("isThreadVisible Updated:", isThreadVisible);
    // }, [isThreadVisible]);

    // useEffect(() => {
    //     console.log("currentThreadChat is updated:", currentThreadChat)
    // }, [currentThreadChat]);

    // useEffect(() => {
    //     console.log("currentThreadChat Updated:", currentThreadChat);
    // }, [currentThreadChat]);

    // useEffect(() => {
    //     console.log("currentProject Updated:", currentProject);
    // }, [currentProject]);
    ////////////////////////////////////////////////////////////////////

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
                socket={socket}
                myself={myself}
                setMyself={setMyself}
                setOpeningService={setOpeningService}
                setCurrentMainChat={setCurrentMainChat}
            />

            <PanelGroup autoSaveId="conditional" direction="horizontal">
                <Panel id={"1"} order={1} minSize={10} maxSize={30}>
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
                                myself={myself}
                                allChats={allChats}
                                setAllChats={setAllChats}
                                setCurrentMainChat={setCurrentMainChat}
                                setCurrentSubChat={setCurrentSubChat}
                                currentMainChat={currentMainChat}
                                currentSubChat={currentSubChat ? currentSubChat : currentMainChat}
                                socket={socket}
                                setIsMainChatVisible={setIsMainChatVisible}
                                isSubChatVisible={isSubChatVisible}
                                setIsSubChatVisible={setIsSubChatVisible}
                                setIsThreadVisible={setIsThreadVisible}
                                setOpeningService={setOpeningService}
                            />
                        </Sheet>
                    </Box>
                </Panel>

                {isTaskPreviewVisible && currentThreadChat !== undefined && (
                    <>
                        <PanelResizeHandle
                            style={{
                                width: "1px",
                                backgroundColor: mode === "dark" ? "black" : "white",
                                transition: "all 0.3s ease-in-out",
                                cursor: "col-resize",
                            }}
                            className="chat-resize-handle"
                        />

                        <Panel id={"2"} order={2} minSize={25} maxSize={70}>
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
                                    thread={currentThreadChat}
                                    myself={myself}
                                    socket={socket}
                                    setCurrentThreadChat={setCurrentThreadChat}
                                    setIsThreadVisible={setIsThreadVisible}
                                    currentThreadChatId={currentThreadChatId}
                                    setIsMainChatVisible={setIsMainChatVisible}
                                    setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                    setIsTaskCreationVisible={setIsTaskCreationVisible}
                                    setIsOpeningTask={setIsOpeningTask}
                                    setIsCreatingTask={setIsCreatingTask}
                                    currentPreviewTask={currentPreviewTask}
                                    setOpeningService={setOpeningService}
                                    setCurrentMainChat={setCurrentMainChat}
                                />
                            </Box>
                        </Panel>

                        {isOpeningTask && currentPreviewTask && (
                            <>
                                <PanelResizeHandle
                                    style={{
                                        width: "1px",
                                        backgroundColor: mode === "dark" ? "black" : "white",
                                        transition: "all 0.3s ease-in-out",
                                        cursor: "col-resize",
                                    }}
                                    className="chat-resize-handle"
                                />

                                <Panel id={"3"} order={3} minSize={30} maxSize={70}>
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
                                            socket={socket}
                                            myself={myself}
                                            setCurrentProject={setCurrentProject}
                                            currentPreviewTask={currentPreviewTask}
                                            setIsMainChatVisible={setIsMainChatVisible}
                                            setIsThreadVisible={setIsThreadVisible}
                                            setIsCreatingTask={setIsCreatingTask}
                                            setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                            setIsTaskCreationVisible={setIsTaskCreationVisible}
                                            setCurrentPreviewTask={setCurrentPreviewTask}
                                            setOpenCreateProject={setOpenCreateProject}
                                            setOpenCreateTag={setOpenCreateTag}
                                            setCurrentMainChat={setCurrentMainChat}
                                            setOpeningService={setOpeningService}
                                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                            isCommentUpdated={isCommentUpdated}
                                            setIsCommentUpdated={setIsCommentUpdated}
                                        />
                                    </Box>
                                </Panel>
                            </>
                        )}

                        {isCreatingTask && (
                            <>
                                <PanelResizeHandle
                                    style={{
                                        width: "1px",
                                        backgroundColor: mode === "dark" ? "black" : "white",
                                        transition: "all 0.3s ease-in-out",
                                        cursor: "col-resize",
                                    }}
                                    className="chat-resize-handle"
                                />

                                <Panel id={"4"} order={4} minSize={30} maxSize={70}>
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
                                        <CreateTaskForm
                                            socket={socket}
                                            myself={myself}
                                            isDm={currentThreadChat.isDm}
                                            chatType={currentThreadChat.chatType}
                                            chatId={currentThreadChat.chatId}
                                            threadId={currentThreadChat.threadId}
                                            setIsMainChatVisible={setIsMainChatVisible}
                                            setIsThreadVisible={setIsThreadVisible}
                                            setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                            setIsTaskCreationVisible={setIsTaskCreationVisible}
                                            setIsOpeningTask={setIsOpeningTask}
                                            setOpenCreateProject={setOpenCreateProject}
                                            setOpenCreateTag={setOpenCreateTag}
                                            currentProject={currentProject}
                                            setCurrentProject={setCurrentProject}
                                            setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                            isNewProjectCreated={isNewProjectCreated}
                                            isNewTagCreated={isNewTagCreated}
                                            setCurrentMainChat={setCurrentMainChat}
                                            setOpeningService={setOpeningService}
                                            parentTaskId={null}
                                            rootTaskId={null}
                                        />
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
                            setIsNewProjectCreated={setIsNewProjectCreated}
                        />

                        {/* Modal for creating a new tag */}
                        <ModalCreateTag
                            myself={myself}
                            currentProject={currentProject}
                            openCreateTag={openCreateTag}
                            setOpenCreateTag={setOpenCreateTag}
                            setIsNewTagCreated={setIsNewTagCreated}
                        />
                    </>
                )}

                {(!isTaskPreviewVisible || currentThreadChat === undefined) && (
                    <>
                        <PanelResizeHandle
                            style={{
                                width: "1px",
                                backgroundColor: mode === "dark" ? "black" : "white",
                                transition: "all 0.3s ease-in-out",
                                cursor: "col-resize",
                            }}
                            className="chat-resize-handle"
                        />

                        <Panel id={"5"} order={5} minSize={25} maxSize={90}>
                            <PanelGroup autoSaveId="conditional" direction="vertical">
                                {isSubChatVisible && (
                                    <>
                                        <Panel
                                            id={"6"}
                                            order={6}
                                            minSize={30}
                                            maxSize={80}
                                            onResize={setSubChatPanelSize}
                                        >
                                            <MessagesSubPane
                                                currentWindowHeight={height}
                                                paneSizePCT={subChatPanelSize}
                                                myself={myself}
                                                chat={currentMainChat}
                                                subChat={
                                                    currentSubChat
                                                        ? currentSubChat
                                                        : currentMainChat
                                                }
                                                socket={socket}
                                                setCurrentMainChat={setCurrentMainChat}
                                                setCurrentSubChat={setCurrentSubChat}
                                                setCurrentThreadChat={setCurrentThreadChat}
                                                setIsSubChatVisible={setIsSubChatVisible}
                                                setIsThreadVisible={setIsThreadVisible}
                                                setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                                setIsTaskCreationVisible={setIsTaskCreationVisible}
                                                setIsOpeningTask={setIsOpeningTask}
                                                currentSubChatId={currentSubChatId}
                                                setCurrentPreviewTask={setCurrentPreviewTask}
                                                setOpeningService={setOpeningService}
                                                setAllChats={setAllChats}
                                            />
                                        </Panel>

                                        <PanelResizeHandle
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
                                <Panel
                                    id={"7"}
                                    order={7}
                                    minSize={30}
                                    maxSize={80}
                                    onResize={setMainChatPanelSize}
                                >
                                    <MessagesPane
                                        currentWindowHeight={height}
                                        paneSizePCT={mainChatPanelSize}
                                        chat={currentMainChat}
                                        subChat={currentSubChat ? currentSubChat : currentMainChat}
                                        myself={myself}
                                        socket={socket}
                                        setCurrentMainChat={setCurrentMainChat}
                                        setCurrentSubChat={setCurrentSubChat}
                                        setCurrentThreadChat={setCurrentThreadChat}
                                        setIsMainChatVisible={setIsMainChatVisible}
                                        setIsThreadVisible={setIsThreadVisible}
                                        setIsTaskCreationVisible={setIsTaskCreationVisible}
                                        setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                        setIsOpeningTask={setIsOpeningTask}
                                        isSubChatVisible={isSubChatVisible}
                                        setIsSubChatVisible={setIsSubChatVisible}
                                        currentMainChatId={currentMainChatId}
                                        setCurrentPreviewTask={setCurrentPreviewTask}
                                        setOpeningService={setOpeningService}
                                        setAllChats={setAllChats}
                                    />
                                </Panel>
                            </PanelGroup>
                        </Panel>

                        {isThreadVisible && currentThreadChat !== undefined && (
                            <>
                                <PanelResizeHandle
                                    style={{
                                        width: "1px",
                                        backgroundColor: mode === "dark" ? "black" : "white",
                                        transition: "all 0.3s ease-in-out",
                                        cursor: "col-resize",
                                    }}
                                    className="chat-resize-handle"
                                />

                                <Panel id={"8"} order={8} minSize={25} maxSize={70}>
                                    <Box
                                        sx={{
                                            height: "100%",
                                            borderColor: mode === "dark" ? "black" : "white",
                                            borderLeft:
                                                mode === "dark"
                                                    ? "2px black groove"
                                                    : "2px white groove",
                                        }}
                                    >
                                        <ThreadPane
                                            thread={currentThreadChat}
                                            myself={myself}
                                            socket={socket}
                                            setCurrentThreadChat={setCurrentThreadChat}
                                            setIsThreadVisible={setIsThreadVisible}
                                            currentThreadChatId={currentThreadChatId}
                                            setIsMainChatVisible={setIsMainChatVisible}
                                            setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                            setIsTaskCreationVisible={setIsTaskCreationVisible}
                                            setIsOpeningTask={setIsOpeningTask}
                                            setIsCreatingTask={setIsCreatingTask}
                                            currentPreviewTask={currentPreviewTask}
                                            setOpeningService={setOpeningService}
                                            setCurrentMainChat={setCurrentMainChat}
                                        />
                                    </Box>
                                </Panel>
                            </>
                        )}
                    </>
                )}
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
