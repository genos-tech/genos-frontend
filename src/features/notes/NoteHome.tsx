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
    NoteMetaProps,
    MyNoteProps,
    MyNoteMetaTreeNode,
    TaskNoteProps,
    ChatNoteProps,
    TaskNoteMetaTreeNode,
    ChatNoteMetaTreeNode,
} from "../../types/notes";
import { loadMyNoteMeta } from "./services/loadMyNoteMeta";
import { useAuth } from "../../context/AuthContext";
import { getData } from "../../db/crud";
import { STORES } from "../../db/conf";
import { ChatNoteMain } from "./components/ChatNoteMain";
import { loadTaskNoteMeta } from "./services/loadTaskNoteMeta";
import { loadChatNoteMeta } from "./services/loadChatNoteMeta";
import { TaskNoteMain } from "./components/TaskNoteMain";

// Build a tree structure
function buildMyNoteTree(items: NoteMetaProps[]): MyNoteMetaTreeNode[] {
    const map: Record<number, MyNoteMetaTreeNode> = {};
    const roots: MyNoteMetaTreeNode[] = [];

    // Initialize each item with children: []
    items.forEach((item) => {
        map[item.noteId] = { ...item, children: [] };
    });

    items.forEach((item) => {
        if (item.parentNoteId && map[item.parentNoteId]) {
            map[item.parentNoteId].children.push(map[item.noteId]);
        } else {
            roots.push(map[item.noteId]);
        }
    });

    return roots;
}

function buildTaskNoteTree(items: NoteMetaProps[]): TaskNoteMetaTreeNode[] {
    const map: Record<number, TaskNoteMetaTreeNode> = {};
    const roots: TaskNoteMetaTreeNode[] = [];

    // Initialize each item with children: []
    items.forEach((item) => {
        map[item.noteId] = { ...item, children: [] };
    });

    items.forEach((item) => {
        if (item.parentNoteId && map[item.parentNoteId]) {
            map[item.parentNoteId].children.push(map[item.noteId]);
        } else {
            roots.push(map[item.noteId]);
        }
    });

    return roots;
}

function buildChatNoteTree(items: NoteMetaProps[]): ChatNoteMetaTreeNode[] {
    const map: Record<number, ChatNoteMetaTreeNode> = {};
    const roots: ChatNoteMetaTreeNode[] = [];

    // Initialize each item with children: []
    items.forEach((item) => {
        map[item.noteId] = { ...item, children: [] };
    });

    items.forEach((item) => {
        if (item.parentNoteId && map[item.parentNoteId]) {
            map[item.parentNoteId].children.push(map[item.noteId]);
        } else {
            roots.push(map[item.noteId]);
        }
    });

    return roots;
}

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
    myNoteMeta: NoteMetaProps[];
    setMyNoteMeta: (value: NoteMetaProps[]) => void;
    taskNoteMeta: NoteMetaProps[];
    setTaskNoteMeta: (value: NoteMetaProps[]) => void;
    chatNoteMeta: NoteMetaProps[];
    setChatNoteMeta: (value: NoteMetaProps[]) => void;
    tabNotes: any[];
    setTabNotes: (value: any[]) => void;
    selectedTabIndex: number;
    setSelectedTabIndex: (value: number) => void;
    newlyCreatedMyNotes: MyNoteProps[];
    setNewlyCreatedMyNotes: (value: MyNoteProps[]) => void;
    currentMyNote: MyNoteProps | null;
    setCurrentMyNote: (value: MyNoteProps) => void;
    handleCreateNewMyNote: (parentNoteId: number | null) => Promise<void>;
    currentTaskNote: TaskNoteProps | null;
    setCurrentTaskNote: (value: TaskNoteProps) => void;
    handleCreateNewTaskNote: (parentNoteId: number | null, taskId: number) => Promise<void>;
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
    setCurrentMyNoteChain: (value: MyNoteMetaTreeNode[]) => void;
    currentTaskNoteChain?: TaskNoteMetaTreeNode[];
    setCurrentTaskNoteChain: (value: TaskNoteMetaTreeNode[]) => void;
    currentChatNoteChain?: ChatNoteMetaTreeNode[];
    setCurrentChatNoteChain: (value: ChatNoteMetaTreeNode[]) => void;
    unReadInboxItemCount: number;
    unReadChatAndActivityCounts: number;
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
        tabNotes,
        setTabNotes,
        selectedTabIndex,
        setSelectedTabIndex,
        newlyCreatedMyNotes,
        setNewlyCreatedMyNotes,
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
        setCurrentMyNoteChain,
        currentTaskNoteChain,
        setCurrentTaskNoteChain,
        currentChatNoteChain,
        setCurrentChatNoteChain,
        unReadInboxItemCount,
        unReadChatAndActivityCounts,
    } = props;

    const { mode } = useColorScheme();
    const { accessToken } = useAuth();

    const getMyNoteMeta = async () => {
        const loadedNotes: NoteMetaProps[] = await loadMyNoteMeta(myself, accessToken);
        if (loadedNotes.length > 0) {
            setMyNoteMeta(loadedNotes);
        }
    };
    const getTaskNoteMeta = async () => {
        const loadedNotes: NoteMetaProps[] = await loadTaskNoteMeta(myself, accessToken);
        if (loadedNotes.length > 0) {
            setTaskNoteMeta(loadedNotes);
        }
    };
    const getChatNoteMeta = async () => {
        const loadedNotes: NoteMetaProps[] = await loadChatNoteMeta(myself, accessToken);
        if (loadedNotes.length > 0) {
            setChatNoteMeta(loadedNotes);
        }
    };

    const popInitialNote = async () => {
        const noteType: string | null = localStorage.getItem("currentNoteType");
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
        getMyNoteMeta();
        getTaskNoteMeta();
        getChatNoteMeta();
        popInitialNote();
    }, []);

    useEffect(() => {
        if (currentMyNote) {
            localStorage.setItem("lastOpenMyNoteId", String(currentMyNote.noteId));
        }
    }, [currentMyNote]);

    useEffect(() => {
        if (currentTaskNote) {
            localStorage.setItem("lastOpenTaskNoteId", String(currentTaskNote.noteId));
        }
    }, [currentTaskNote]);

    useEffect(() => {
        if (currentChatNote) {
            localStorage.setItem("lastOpenChatNoteId", String(currentChatNote.noteId));
        }
    }, [currentChatNote]);

    // Update note title in the sidebar
    useEffect(() => {
        setMyNoteMeta(
            myNoteMeta.map((u) =>
                u.noteId === currentMyNote?.noteId ? { ...u, title: currentMyNoteTitle } : u
            )
        );
    }, [currentMyNoteTitle]);
    const myNoteMetaTree = buildMyNoteTree(myNoteMeta);

    // Update note title in the sidebar
    useEffect(() => {
        setTaskNoteMeta(
            taskNoteMeta.map((u) =>
                u.noteId === currentTaskNote?.noteId ? { ...u, title: currentTaskNoteTitle } : u
            )
        );
    }, [currentTaskNoteTitle]);
    const taskNoteMetaTree = buildTaskNoteTree(taskNoteMeta);

    // Update note title in the sidebar
    useEffect(() => {
        setChatNoteMeta(
            chatNoteMeta.map((u) =>
                u.noteId === currentChatNote?.noteId ? { ...u, title: currentChatNoteTitle } : u
            )
        );
    }, [currentChatNoteTitle]);
    const chatNoteMetaTree = buildChatNoteTree(chatNoteMeta);

    // Get Note chain used for the header
    function findMyNoteChain(
        roots: MyNoteMetaTreeNode[],
        targetNoteId: number
    ): MyNoteMetaTreeNode[] | null {
        for (const root of roots) {
            const path = dfsForMyNote(root, targetNoteId);
            if (path) return path;
        }
        return null; // not found
    }

    // Get Note chain used for the header
    function findTaskNoteChain(
        roots: TaskNoteMetaTreeNode[],
        targetNoteId: number
    ): TaskNoteMetaTreeNode[] | null {
        for (const root of roots) {
            const path = dfsForTaskNote(root, targetNoteId);
            if (path) return path;
        }
        return null; // not found
    }

    // Get Note chain used for the header
    function findChatNoteChain(
        roots: ChatNoteMetaTreeNode[],
        targetNoteId: number
    ): ChatNoteMetaTreeNode[] | null {
        for (const root of roots) {
            const path = dfsForChatNote(root, targetNoteId);
            if (path) return path;
        }
        return null; // not found
    }

    function dfsForMyNote(
        node: MyNoteMetaTreeNode,
        targetNoteId: number
    ): MyNoteMetaTreeNode[] | null {
        if (node.noteId === targetNoteId) {
            return [node];
        }
        for (const child of node.children) {
            const path = dfsForMyNote(child, targetNoteId);
            if (path) {
                return [node, ...path]; // prepend current node to the chain
            }
        }
        return null;
    }

    function dfsForTaskNote(
        node: TaskNoteMetaTreeNode,
        targetNoteId: number
    ): TaskNoteMetaTreeNode[] | null {
        if (node.noteId === targetNoteId) {
            return [node];
        }
        for (const child of node.children) {
            const path = dfsForTaskNote(child, targetNoteId);
            if (path) {
                return [node, ...path]; // prepend current node to the chain
            }
        }
        return null;
    }

    function dfsForChatNote(
        node: ChatNoteMetaTreeNode,
        targetNoteId: number
    ): ChatNoteMetaTreeNode[] | null {
        if (node.noteId === targetNoteId) {
            return [node];
        }
        for (const child of node.children) {
            const path = dfsForChatNote(child, targetNoteId);
            if (path) {
                return [node, ...path]; // prepend current node to the chain
            }
        }
        return null;
    }

    // Make a map of noteId -> chained-noteIds
    const [allNoteIdChains, setAllNoteIdChains] = useState<Record<number, number[]>>({});
    const addChain = (noteId: number, chain: number[]) => {
        setAllNoteIdChains((prev) => ({
            ...prev,
            [noteId]: chain, // overwrite or add
        }));
    };

    useEffect(() => {
        if (currentMyNote) {
            const chain = findMyNoteChain(myNoteMetaTree, currentMyNote.noteId);
            setCurrentMyNoteChain(chain || []);

            if (chain) {
                addChain(
                    currentMyNote.noteId,
                    chain.map((item) => item.noteId)
                );
            }

            if (tabNotes.length === 0)
                setTabNotes([
                    ...tabNotes.filter((t) => t.noteId !== currentMyNote.noteId),
                    currentMyNote,
                ]);
        } else {
            setCurrentMyNoteChain([]);
        }
    }, [currentMyNote]);

    useEffect(() => {
        if (currentTaskNote) {
            const chain = findTaskNoteChain(taskNoteMetaTree, currentTaskNote.noteId);
            setCurrentTaskNoteChain(chain || []);

            if (chain) {
                addChain(
                    currentTaskNote.noteId,
                    chain.map((item) => item.noteId)
                );
            }

            if (tabNotes.length === 0)
                setTabNotes([
                    ...tabNotes.filter((t) => t.noteId !== currentTaskNote.noteId),
                    currentTaskNote,
                ]);
        } else {
            setCurrentTaskNoteChain([]);
        }
    }, [currentTaskNote]);

    useEffect(() => {
        if (currentChatNote) {
            const chain = findChatNoteChain(chatNoteMetaTree, currentChatNote.noteId);
            setCurrentChatNoteChain(chain || []);

            if (chain) {
                addChain(
                    currentChatNote.noteId,
                    chain.map((item) => item.noteId)
                );
            }

            if (tabNotes.length === 0)
                setTabNotes([
                    ...tabNotes.filter((t) => t.noteId !== currentChatNote.noteId),
                    currentChatNote,
                ]);
        } else {
            setCurrentChatNoteChain([]);
        }
    }, [currentChatNote]);

    // This needs if no notes stored in the indexedDB.
    useEffect(() => {
        if (currentMyNoteChain === undefined && myNoteMeta.length === 0) {
            setCurrentMyNoteChain([]);
        }
        if (currentTaskNoteChain === undefined && taskNoteMeta.length === 0) {
            setCurrentTaskNoteChain([]);
        }
        if (currentChatNoteChain === undefined && chatNoteMeta.length === 0) {
            setCurrentChatNoteChain([]);
        }
    }, [myNoteMeta, taskNoteMeta, chatNoteMeta]);

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
                            handleCreateNewMyNote={handleCreateNewMyNote}
                            currentMyNoteChain={currentMyNoteChain}
                            taskNoteMetaTree={taskNoteMetaTree}
                            currentTaskNote={currentTaskNote}
                            setCurrentTaskNote={setCurrentTaskNote}
                            currentTaskNoteChain={currentTaskNoteChain}
                            chatNoteMetaTree={chatNoteMetaTree}
                            currentChatNote={currentChatNote}
                            setCurrentChatNote={setCurrentChatNote}
                            tabNotes={tabNotes}
                            currentChatNoteChain={currentChatNoteChain}
                            allNoteIdChains={allNoteIdChains}
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
                                        tabNotes={tabNotes}
                                        setTabNotes={setTabNotes}
                                        selectedTabIndex={selectedTabIndex}
                                        setSelectedTabIndex={setSelectedTabIndex}
                                        handleCreateNewMyNote={handleCreateNewMyNote}
                                        currentMyNoteChain={currentMyNoteChain}
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
                                        tabNotes={tabNotes}
                                        setTabNotes={setTabNotes}
                                        selectedTabIndex={selectedTabIndex}
                                        setSelectedTabIndex={setSelectedTabIndex}
                                        handleCreateNewTaskNote={handleCreateNewTaskNote}
                                        currentTaskNoteChain={currentTaskNoteChain}
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
                                        tabNotes={tabNotes}
                                        setTabNotes={setTabNotes}
                                        selectedTabIndex={selectedTabIndex}
                                        setSelectedTabIndex={setSelectedTabIndex}
                                        handleCreateNewChatNote={handleCreateNewChatNote}
                                        currentChatNoteChain={currentChatNoteChain}
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
