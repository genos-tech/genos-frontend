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
    loadNote: (noteType: number, noteId: number, nextTabIndex: number) => Promise<void>;
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
                    <Panel id={"1"} order={1} minSize={15} maxSize={25}>
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
                                    />
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
