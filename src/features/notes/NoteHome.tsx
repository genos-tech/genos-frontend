import { Socket } from "socket.io-client";
import { useState, useEffect } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { Box, CssBaseline, Typography } from "@mui/joy";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { useColorScheme } from "@mui/joy/styles";

import { Team, UserProps } from "../../types/admin";
import { Sidebar } from "../../components/layout/sidebar";
import { NoteSidebar } from "./components/NoteSidebar";
import { ChatProps } from "../../types/chat";
import { NoteMain } from "./components/NoteMain";
import { NoteProps } from "../../types/notes";
import { loadNotes } from "./services/loadNotes";
import { useAuth } from "../../context/AuthContext";

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

    const [myNotes, setMyNotes] = useState<NoteProps[]>([]);
    const [myTaskNotes, setTaskNotes] = useState<NoteProps[]>([]);
    const [myChatNotes, setChatNotes] = useState<NoteProps[]>([]);
    const loadMyNotes = async () => {
        // Load the latest project as initial process
        const loadedNotes: NoteProps[] = await loadNotes(myself, accessToken);
        if (loadedNotes.length > 0) {
            // for (let i = 0; i < loadedNotes.length; i++) {
            // }
            setMyNotes(loadedNotes);
            setCurrentNote(loadedNotes[0]);
        }
    };
    const loadTaskNotes = async () => {};
    const loadChatNotes = async () => {};

    useEffect(() => {
        loadMyNotes();
        loadTaskNotes();
        loadChatNotes();
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
                    <Panel id={"1"} order={1} minSize={5} maxSize={20}>
                        <NoteSidebar
                            myself={myself}
                            noteType={noteType}
                            setNoteType={setNoteType}
                            notes={myNotes}
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

                    <Panel id={"2"} order={2} minSize={5} maxSize={95}>
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
                                setOpeningService={setOpeningService}
                                setCurrentChat={setCurrentMainChat}
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
