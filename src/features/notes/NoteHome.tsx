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
        unReadInboxItemCount,
        unReadChatAndActivityCounts,
    } = props;

    const { mode } = useColorScheme();
    const { accessToken } = useAuth();

    // 0: Home, 1: personal note, 2: task note, 3: chat note
    const [noteType, setNoteType] = useState<number>(1);

    const [currentNote, setCurrentNote] = useState<NoteProps | null>(null);
    const [currentNoteTitle, setCurrentNoteTitle] = useState<string>("");

    const [newlyCreatedNotes, setNewlyCreatedNotes] = useState<NoteProps[]>([]);

    const [myNoteMeta, setMyNoteMeta] = useState<NoteMetaProps[]>([]);
    const [myTaskNoteMeta, setTaskNoteMeta] = useState<NoteMetaProps[]>([]);
    const [myChatNoteMeta, setChatNoteMeta] = useState<NoteMetaProps[]>([]);
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

    const [tabContents, setTabContents] = useState<NoteProps[]>(currentNote ? [currentNote] : []);
    const [selectedTabIndex, setSelectedTabIndex] = useState(0);
    const handleCreateNewNote = async (parentNoteId: number | null) => {
        const title = `${parentNoteId ? "Child" : "New"} Note (${newlyCreatedNotes.length + 1})`;
        const newNote: NoteProps = await createEmptyNote(myself, parentNoteId, title, accessToken);
        if (tabContents.length === 0 || tabContents[0] === undefined) {
            setSelectedTabIndex(0);
            setTabContents([newNote]);
        } else {
            setSelectedTabIndex(tabContents.length);
            setTabContents([...tabContents, newNote]);
        }
        setNewlyCreatedNotes([...newlyCreatedNotes, newNote]);
        setCurrentNote(newNote);
        setCurrentNoteTitle(title);
        addNote(newNote);
        setMyNoteMeta([
            {
                noteId: newNote.noteId,
                parentNoteId: newNote.parentNoteId,
                title: newNote.title,
                tsCreated: newNote.tsCreated,
                tsUpdated: newNote.tsUpdated,
            },
            ...myNoteMeta,
        ]);
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
    const [currentNoteChain, setCurrentNoteChain] = useState<NoteMetaTreeNode[]>();
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
                                noteType={noteType}
                                setNoteType={setNoteType}
                                noteMeta={myNoteMeta}
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
                                    noteType={noteType}
                                    setNoteType={setNoteType}
                                    noteMetaTree={noteMetaTree}
                                    currentNote={currentNote}
                                    setCurrentNote={setCurrentNote}
                                    currentNoteTitle={currentNoteTitle}
                                    setCurrentNoteTitle={setCurrentNoteTitle}
                                    setOpeningService={setOpeningService}
                                    setCurrentChat={setCurrentMainChat}
                                    newlyCreatedNotes={newlyCreatedNotes}
                                    setNewlyCreatedNotes={setNewlyCreatedNotes}
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
