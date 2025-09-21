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
import { NoteMetaProps, NoteProps } from "../../types/notes";
import { loadNoteMeta } from "./services/loadNoteMeta";
import { useAuth } from "../../context/AuthContext";
import { getData } from "../../db/crud";
import { STORES } from "../../db/conf";

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
                            noteType={noteType}
                            setNoteType={setNoteType}
                            noteMeta={myNoteMeta}
                            setCurrentNote={setCurrentNote}
                            currentNote={currentNote}
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

                    <Panel id={"2"} order={2} minSize={50} maxSize={85}>
                        <Box sx={{ paddingX: 1, height: "100dvh" }}>
                            <NoteMain
                                teamMemberProfiles={teamMemberProfiles}
                                socket={socket}
                                teamMembers={teamMembers}
                                myself={myself}
                                setMyself={setMyself}
                                noteType={noteType}
                                setNoteType={setNoteType}
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
                            />
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
