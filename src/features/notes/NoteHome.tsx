import { Socket } from "socket.io-client";
import { useState, useEffect } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { Box, CssBaseline } from "@mui/joy";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { useColorScheme } from "@mui/joy/styles";

import { Team, UserProps } from "../../types/admin";
import { Sidebar } from "../../components/layout/sidebar";
import { NoteSidebar } from "./components/NoteSidebar";
import { ChatProps } from "../../types/chat";
import { NoteMain } from "./components/NoteMain";
import { NoteMetaProps, NoteProps, NoteMetaTreeNode } from "../../types/notes";
import { loadNoteMeta } from "./services/loadNoteMeta";
import { useAuth } from "../../context/AuthContext";
import { getData } from "../../db/crud";
import { STORES } from "../../db/conf";
import { createEmptyNote } from "./services/createEmptyNote";
import { addNote } from "./services/addNote";

// Build a tree structure
function buildTree(items: NoteMetaProps[]): NoteMetaTreeNode[] {
    const map: Record<number, NoteMetaTreeNode> = {};
    const roots: NoteMetaTreeNode[] = [];

    // Initialize each item with children: []
    items.forEach((item) => {
        map[item.noteId] = { ...item, children: [] };
    });

    items.forEach((item) => {
        if (item.parentNoteId) {
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
    currentNote: NoteProps | null;
    setCurrentNote: (value: NoteProps | null) => void;
    currentNoteTitle: string;
    setCurrentNoteTitle: (value: string) => void;
    myNoteMeta: NoteMetaProps[];
    setMyNoteMeta: (value: NoteMetaProps[]) => void;
    myTaskNoteMeta: NoteMetaProps[];
    setTaskNoteMeta: (value: NoteMetaProps[]) => void;
    myChatNoteMeta: NoteMetaProps[];
    setChatNoteMeta: (value: NoteMetaProps[]) => void;
    tabContents: NoteProps[];
    setTabContents: (value: NoteProps[]) => void;
    selectedTabIndex: number;
    setSelectedTabIndex: (value: number) => void;
    newlyCreatedNotes: NoteProps[];
    setNewlyCreatedNotes: (value: NoteProps[]) => void;
    handleCreateNewNote: (parentNoteId: number | null) => Promise<void>;
    currentNoteChain?: NoteMetaTreeNode[];
    setCurrentNoteChain: (value: NoteMetaTreeNode[]) => void;
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
        currentNote,
        setCurrentNote,
        currentNoteTitle,
        setCurrentNoteTitle,
        myNoteMeta,
        setMyNoteMeta,
        myTaskNoteMeta,
        setTaskNoteMeta,
        myChatNoteMeta,
        setChatNoteMeta,
        tabContents,
        setTabContents,
        selectedTabIndex,
        setSelectedTabIndex,
        newlyCreatedNotes,
        setNewlyCreatedNotes,
        handleCreateNewNote,
        currentNoteChain,
        setCurrentNoteChain,
        unReadInboxItemCount,
        unReadChatAndActivityCounts,
    } = props;

    const { mode } = useColorScheme();
    const { accessToken } = useAuth();

    const loadMyNoteMeta = async () => {
        // Load the latest project as initial process
        const loadedNotes: NoteMetaProps[] = await loadNoteMeta(myself, accessToken);
        if (loadedNotes.length > 0) {
            // for (let i = 0; i < loadedNotes.length; i++) {
            // }
            setMyNoteMeta(loadedNotes);
        }
    };
    const loadTaskNoteMeta = async () => {};
    const loadChatNoteMeta = async () => {};

    const popInitialNote = async () => {
        const noteId: string | null = localStorage.getItem("lastOpenNoteId");
        if (noteId) {
            const note: NoteProps = await getData({
                storeName: STORES.NOTES,
                key: Number(noteId),
            });
            if (note) {
                setCurrentNote(note);
            }
        }
    };

    useEffect(() => {
        loadMyNoteMeta();
        loadTaskNoteMeta();
        loadChatNoteMeta();
        popInitialNote();
    }, []);

    useEffect(() => {
        if (currentNote) {
            localStorage.setItem("lastOpenNoteId", String(currentNote.noteId));
        }
    }, [currentNote]);

    // Update note title in the sidebar
    useEffect(() => {
        setMyNoteMeta(
            myNoteMeta.map((u) =>
                u.noteId === currentNote?.noteId ? { ...u, title: currentNoteTitle } : u
            )
        );
    }, [currentNoteTitle]);

    const noteMetaTree = buildTree(myNoteMeta);

    // Get Note chain used for the header
    function findNoteChain(
        roots: NoteMetaTreeNode[],
        targetNoteId: number
    ): NoteMetaTreeNode[] | null {
        for (const root of roots) {
            const path = dfs(root, targetNoteId);
            if (path) return path;
        }
        return null; // not found
    }

    function dfs(node: NoteMetaTreeNode, targetNoteId: number): NoteMetaTreeNode[] | null {
        if (node.noteId === targetNoteId) {
            return [node];
        }
        for (const child of node.children) {
            const path = dfs(child, targetNoteId);
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
        if (currentNote) {
            const chain = findNoteChain(noteMetaTree, currentNote.noteId);
            setCurrentNoteChain(chain || []);

            if (chain) {
                addChain(
                    currentNote.noteId,
                    chain.map((item) => item.noteId)
                );
            }

            if (tabContents.length === 0)
                setTabContents([
                    ...tabContents.filter((t) => t.noteId !== currentNote.noteId),
                    currentNote,
                ]);
        }
    }, [currentNote]);

    // This needs if no notes stored in the indexedDB.
    useEffect(() => {
        if (currentNoteChain === undefined && myNoteMeta.length === 0) {
            setCurrentNoteChain([]);
        }
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
                        {currentNoteChain && (
                            <NoteSidebar
                                myself={myself}
                                noteMetaTree={noteMetaTree}
                                currentNoteType={currentNoteType}
                                setCurrentNoteType={setCurrentNoteType}
                                setCurrentNote={setCurrentNote}
                                currentNote={currentNote}
                                tabContents={tabContents}
                                handleCreateNewNote={handleCreateNewNote}
                                currentNoteChain={currentNoteChain}
                                allNoteIdChains={allNoteIdChains}
                            />
                        )}
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

                    <Panel id={"2"} order={2} minSize={50} maxSize={85}>
                        <Box sx={{ paddingX: 1, height: "100dvh" }}>
                            {currentNoteChain && (
                                <NoteMain
                                    teamMemberProfiles={teamMemberProfiles}
                                    socket={socket}
                                    teamMembers={teamMembers}
                                    myself={myself}
                                    setMyself={setMyself}
                                    currentNoteType={currentNoteType}
                                    currentNote={currentNote}
                                    setCurrentNote={setCurrentNote}
                                    currentNoteTitle={currentNoteTitle}
                                    setCurrentNoteTitle={setCurrentNoteTitle}
                                    setOpeningService={setOpeningService}
                                    setCurrentChat={setCurrentMainChat}
                                    myNoteMeta={myNoteMeta}
                                    setMyNoteMeta={setMyNoteMeta}
                                    tabContents={tabContents}
                                    setTabContents={setTabContents}
                                    selectedTabIndex={selectedTabIndex}
                                    setSelectedTabIndex={setSelectedTabIndex}
                                    handleCreateNewNote={handleCreateNewNote}
                                    currentNoteChain={currentNoteChain}
                                />
                            )}
                        </Box>
                    </Panel>
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
