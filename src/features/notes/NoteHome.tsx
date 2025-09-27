import { Socket } from "socket.io-client";
import { useState, useEffect } from "react";
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
import { getData } from "../../db/crud";
import { STORES } from "../../db/conf";
import { ChatNoteMain } from "./components/ChatNoteMain";
import { TaskNoteMain } from "./components/TaskNoteMain";

type NoteHomeProps = {
    currentTeam: Team;
    setCurrentTeam: (value: Team) => void;
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    teamMembers: UserProps[];
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    openingService: number;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (value: ChatProps) => void;
    currentNoteType: number;
    setCurrentNoteType: (value: number) => void;
    currentMyNoteTitle: string;
    setCurrentMyNoteTitle: (value: string) => void;
    currentTaskNoteTitle: string;
    setCurrentTaskNoteTitle: (value: string) => void;
    currentChatNoteTitle: string;
    setCurrentChatNoteTitle: (value: string) => void;
    myNoteMeta: MyNoteMetaProps[];
    setMyNoteMeta: (value: MyNoteMetaProps[]) => void;
    taskNoteMeta: TaskNoteMetaProps[];
    setTaskNoteMeta: (value: TaskNoteMetaProps[]) => void;
    chatNoteMeta: ChatNoteMetaProps[];
    setChatNoteMeta: (value: ChatNoteMetaProps[]) => void;
    tabItems: any[];
    setTabItems: (value: any[]) => void;
    selectedTabIndex: number;
    setSelectedTabIndex: (value: number) => void;
    currentMyNote: MyNoteProps | null;
    setCurrentMyNote: (value: MyNoteProps) => void;
    handleCreateNewMyNote: (parentNoteId: number | null) => Promise<void>;
    currentTaskNote: TaskNoteProps | null;
    setCurrentTaskNote: (value: TaskNoteProps) => void;
    handleCreateNewTaskNote: (
        parentNoteId: number | null,
        projectId: number,
        taskId: number
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
};
export const NoteHome = (props: NoteHomeProps) => {
    const {
        currentTeam,
        setCurrentTeam,
        teamMemberProfiles,
        socket,
        teamMembers,
        myself,
        setMyself,
        openingService,
        setOpeningService,
        setCurrentMainChat,
        currentNoteType,
        setCurrentNoteType,
        currentMyNoteTitle,
        setCurrentMyNoteTitle,
        currentTaskNoteTitle,
        setCurrentTaskNoteTitle,
        currentChatNoteTitle,
        setCurrentChatNoteTitle,
        myNoteMeta,
        setMyNoteMeta,
        taskNoteMeta,
        setTaskNoteMeta,
        chatNoteMeta,
        setChatNoteMeta,
        tabItems,
        setTabItems,
        selectedTabIndex,
        setSelectedTabIndex,
        currentMyNote,
        setCurrentMyNote,
        handleCreateNewMyNote,
        currentTaskNote,
        setCurrentTaskNote,
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
    } = props;

    const { mode } = useColorScheme();

    const popInitialNote = async () => {
        const noteType: string | null = localStorage.getItem("lastOpenNoteType");
        const myNoteId: string | null = localStorage.getItem("lastOpenMyNoteId");
        const taskNoteId: string | null = localStorage.getItem("lastOpenTaskNoteId");
        const chatNoteId: string | null = localStorage.getItem("lastOpenChatNoteId");
        if (noteType) {
            if (Number(noteType) === 1 && myNoteId) {
                const note: MyNoteProps = await getData({
                    storeName: STORES.PERSONAL_NOTES,
                    key: Number(myNoteId),
                });
                if (note) {
                    setCurrentMyNote(note);
                }
            } else if (Number(noteType) === 2 && taskNoteId) {
                const note: TaskNoteProps = await getData({
                    storeName: STORES.TASK_NOTES,
                    key: Number(taskNoteId),
                });
                if (note) {
                    setCurrentTaskNote(note);
                }
            } else if (Number(noteType) === 3 && chatNoteId) {
                const note: ChatNoteProps = await getData({
                    storeName: STORES.CHAT_NOTES,
                    key: Number(chatNoteId),
                });
                if (note) {
                    setCurrentChatNote(note);
                }
            }
        }
    };

    useEffect(() => {
        popInitialNote();
    }, []);

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
                    <Panel id={"1"} order={1} minSize={15} maxSize={25}>
                        <NoteSidebar
                            myself={myself}
                            currentNoteType={currentNoteType}
                            setCurrentNoteType={setCurrentNoteType}
                            myNoteMetaTree={myNoteMetaTree}
                            currentMyNote={currentMyNote}
                            setCurrentMyNote={setCurrentMyNote}
                            currentTaskNote={currentTaskNote}
                            setCurrentTaskNote={setCurrentTaskNote}
                            currentChatNote={currentChatNote}
                            setCurrentChatNote={setCurrentChatNote}
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
                            setSelectedTabIndex={setSelectedTabIndex}
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
                        <Panel id={"2"} order={2} minSize={50} maxSize={85}>
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
                        <Panel id={"2"} order={2} minSize={50} maxSize={85}>
                            <Box sx={{ paddingX: 1, height: "100dvh" }}>
                                {currentNoteType === 1 && currentMyNoteChain && (
                                    <MyNoteMain
                                        teamMemberProfiles={teamMemberProfiles}
                                        socket={socket}
                                        teamMembers={teamMembers}
                                        myself={myself}
                                        setMyself={setMyself}
                                        currentNoteType={currentNoteType}
                                        currentMyNote={currentMyNote}
                                        setCurrentMyNote={setCurrentMyNote}
                                        currentMyNoteTitle={currentMyNoteTitle}
                                        setCurrentMyNoteTitle={setCurrentMyNoteTitle}
                                        setOpeningService={setOpeningService}
                                        setCurrentChat={setCurrentMainChat}
                                        myNoteMeta={myNoteMeta} // TODO: Use the correct note based on noteType
                                        setMyNoteMeta={setMyNoteMeta}
                                        tabItems={tabItems}
                                        setTabItems={setTabItems}
                                        selectedTabIndex={selectedTabIndex}
                                        setSelectedTabIndex={setSelectedTabIndex}
                                        handleCreateNewMyNote={handleCreateNewMyNote}
                                        currentMyNoteChain={currentMyNoteChain}
                                        setCurrentNoteType={setCurrentNoteType}
                                    />
                                )}
                                {currentNoteType === 2 && currentTaskNoteChain && (
                                    <TaskNoteMain
                                        teamMemberProfiles={teamMemberProfiles}
                                        socket={socket}
                                        teamMembers={teamMembers}
                                        myself={myself}
                                        setMyself={setMyself}
                                        currentNoteType={currentNoteType}
                                        currentTaskNote={currentTaskNote}
                                        setCurrentTaskNote={setCurrentTaskNote}
                                        currentTaskNoteTitle={currentTaskNoteTitle}
                                        setCurrentTaskNoteTitle={setCurrentTaskNoteTitle}
                                        setOpeningService={setOpeningService}
                                        setCurrentChat={setCurrentMainChat}
                                        taskNoteMeta={taskNoteMeta}
                                        setTaskNoteMeta={setTaskNoteMeta}
                                        tabItems={tabItems}
                                        setTabItems={setTabItems}
                                        selectedTabIndex={selectedTabIndex}
                                        setSelectedTabIndex={setSelectedTabIndex}
                                        handleCreateNewTaskNote={handleCreateNewTaskNote}
                                        currentTaskNoteChain={currentTaskNoteChain}
                                        setCurrentNoteType={setCurrentNoteType}
                                        isInTaskPage={false}
                                        isCreatingTask={isCreatingTask}
                                        setIsTaskNoteVisible={setIsTaskNoteVisible}
                                    />
                                )}
                                {currentNoteType === 3 && currentChatNoteChain && (
                                    <ChatNoteMain
                                        teamMemberProfiles={teamMemberProfiles}
                                        socket={socket}
                                        teamMembers={teamMembers}
                                        myself={myself}
                                        setMyself={setMyself}
                                        currentChatNote={currentChatNote}
                                        setCurrentChatNote={setCurrentChatNote}
                                        currentChatNoteTitle={currentChatNoteTitle}
                                        setCurrentChatNoteTitle={setCurrentChatNoteTitle}
                                        setOpeningService={setOpeningService}
                                        setCurrentChat={setCurrentMainChat}
                                        currentNoteType={currentNoteType}
                                        chatNoteMeta={chatNoteMeta}
                                        setChatNoteMeta={setChatNoteMeta}
                                        tabItems={tabItems}
                                        setTabItems={setTabItems}
                                        selectedTabIndex={selectedTabIndex}
                                        setSelectedTabIndex={setSelectedTabIndex}
                                        handleCreateNewChatNote={handleCreateNewChatNote}
                                        currentChatNoteChain={currentChatNoteChain}
                                        isInChatPage={false}
                                        setCurrentNoteType={setCurrentNoteType}
                                        setIsMainChatVisible={setIsMainChatVisible}
                                        setIsChatNoteVisible={setIsChatNoteVisible}
                                    />
                                )}
                            </Box>
                        </Panel>
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
