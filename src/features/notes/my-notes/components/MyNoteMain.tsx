import { Box, Stack, Tab, TabPanel, Tabs } from "@mui/joy";
import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { useNoteEditor } from "../../../../hooks/notes/useNoteEditor";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useNoteTabs } from "../../../../hooks/notes/useNoteTabs";
import { UserProps } from "../../../../types/admin";
import { ChatProps } from "../../../../types/chat";
import { MyNoteProps } from "../../../../types/notes";
import { getLocalCurrentTimestamp } from "../../../../utils/dateUtils";
import { EmptyState } from "../../shared/components/EmptyState";
import { NoteEditor } from "../../shared/components/NoteEditor";
import { NoteHeaderActions } from "../../shared/components/NoteHeaderActions";
import { NoteTabList } from "../../shared/components/NoteTabList";
import { MyNoteHeader } from "../components/MyNoteHeader";

/**
 * Props for the MyNoteMain component
 */
interface MyNoteMainProps {
    /** Team member profiles indexed by user ID */
    teamMemberProfiles: Record<string, UserProps>;
    /** Socket connection for real-time updates */
    socket: Socket | null;
    /** List of team members */
    teamMembers: UserProps[];
    /** Current user information */
    myself: UserProps;
    /** Function to update current user */
    setMyself: (me: UserProps) => void;
    /** Function to set the opening service */
    setOpeningService: (service: number) => void;
    /** Function to set the current chat */
    setCurrentChat: (chat: ChatProps) => void;
    /** Note management state and actions */
    NM: NoteManagementState;
}

export const MyNoteMain = (props: MyNoteMainProps) => {
    const {
        teamMemberProfiles,
        socket,
        teamMembers,
        myself,
        setMyself,
        setOpeningService,
        setCurrentChat,
        NM,
    } = props;

    const { accessToken } = useAuth();
    const [openDeleteNote, setOpenDeleteNote] = useState<boolean>(false);
    const [tsBody, setTsBody] = useState<string>(getLocalCurrentTimestamp());

    // Custom hooks for note management
    const noteEditor = useNoteEditor({
        currentMyNote: NM.currentMyNote,
        myself,
        accessToken,
        onNoteUpdate: (updatedNote: MyNoteProps) => {
            // Update tab items
            NM.setTabItems(
                NM.tabItems.map((item) =>
                    item.noteType === NM.currentMyNote?.noteType &&
                    item.noteId === NM.currentMyNote?.noteId
                        ? updatedNote
                        : item
                )
            );

            // Update note metadata
            NM.setMyNoteMeta(
                NM.myNoteMeta.map((item) =>
                    item.noteType === updatedNote.noteType && item.noteId === updatedNote.noteId
                        ? {
                              noteType: updatedNote.noteType,
                              noteId: updatedNote.noteId,
                              parentNoteId: updatedNote.parentNoteId,
                              title: updatedNote.title,
                              tsUpdated: updatedNote.tsUpdated,
                          }
                        : item
                )
            );
        },
    });

    const { handleCloseTab, handleTabChange } = useNoteTabs({ NM });

    // Reset note body saved status when the selected tab index changes
    useEffect(() => {
        noteEditor.setNoteBodySaved(false);
    }, [NM.selectedTabIndex]);

    // Update timestamp when current note changes
    useEffect(() => {
        if (NM.currentMyNote) {
            setTsBody(getLocalCurrentTimestamp());
        }
    }, [NM.currentMyNote]);

    // Event handlers
    const handleCreateNewNote = () => {
        NM.handleCreateNewMyNote(null);
    };

    const handleCreateChildNote = () => {
        if (NM.currentMyNote) {
            NM.handleCreateNewMyNote(NM.currentMyNote.noteId);
        } else {
            console.error("Can't parent note ID to create a child note.");
        }
    };

    const handleDeleteNote = () => {
        setOpenDeleteNote(true);
    };

    return (
        <>
            {(NM.tabItems.length === 0 || NM.currentMyNote === null) && (
                <EmptyState onCreateNewNote={handleCreateNewNote} />
            )}

            {!(NM.tabItems.length === 0 || NM.currentMyNote === null) && (
                <Stack direction={"column"} sx={{ width: "100%" }}>
                    {noteEditor.body && (
                        <>
                            {NM.currentNoteType !== 0 && (
                                <Stack direction={"column"} sx={{ width: "100%" }}>
                                    <Stack
                                        alignItems="center"
                                        direction="row"
                                        justifyContent="space-between"
                                        sx={{
                                            width: "100%",
                                            height: "30px",
                                            mt: "10px",
                                            mb: "5px",
                                        }}
                                    >
                                        <MyNoteHeader
                                            currentMyNoteChain={NM.currentMyNoteChain || null}
                                            onLoadNote={NM.loadNote}
                                        />

                                        <NoteHeaderActions
                                            currentTask={undefined}
                                            funcSetAllChats={() => Promise.resolve()}
                                            isInTaskPage={false}
                                            myself={myself}
                                            noteType={1}
                                            pmChat={undefined}
                                            setCurrentMainChat={() => {}}
                                            setMyself={setMyself}
                                            setOpeningService={setOpeningService}
                                            socket={socket}
                                            teamMemberProfiles={teamMemberProfiles}
                                            onCloseNotes={() => {}}
                                            onCreateChildNote={handleCreateChildNote}
                                            onCreateNewNote={handleCreateNewNote}
                                            onDeleteNote={handleDeleteNote}
                                            onOpenTask={() => {}}
                                        />
                                    </Stack>

                                    <Tabs
                                        sx={{ width: "100%" }}
                                        value={NM.selectedTabIndex}
                                        onChange={(_, val) => {
                                            handleTabChange(Number(val));
                                        }}
                                    >
                                        <NoteTabList
                                            selectedTabIndex={NM.selectedTabIndex}
                                            tabItems={NM.tabItems}
                                            onCloseTab={handleCloseTab}
                                            onTabChange={handleTabChange}
                                        />

                                        {NM.tabItems.map((tabNote, index) => (
                                            <TabPanel
                                                key={`tab-note-body-${tabNote.noteType}-${tabNote.noteId}-${tsBody}`}
                                                value={index}
                                                sx={{
                                                    paddingX: "5px",
                                                    paddingTop: "0px",
                                                    paddingBottom: "5px",
                                                }}
                                            >
                                                {NM.currentMyNote && (
                                                    <NoteEditor
                                                        body={noteEditor.body}
                                                        currentMyNote={NM.currentMyNote}
                                                        myself={myself}
                                                        noteBodySaved={noteEditor.noteBodySaved}
                                                        setCurrentChat={setCurrentChat}
                                                        setMyself={setMyself}
                                                        setOpeningService={setOpeningService}
                                                        socket={socket}
                                                        teamMemberProfiles={teamMemberProfiles}
                                                        teamMembers={teamMembers}
                                                        titleInputRef={noteEditor.titleInputRef}
                                                        currentMyNoteTitle={
                                                            noteEditor.currentMyNoteTitle
                                                        }
                                                        onBodyChange={noteEditor.handleBodyChange}
                                                        onTitleBlur={noteEditor.handleTitleBlur}
                                                        onTitleChange={
                                                            noteEditor.handleTitleChange
                                                        }
                                                    />
                                                )}
                                            </TabPanel>
                                        ))}
                                    </Tabs>
                                </Stack>
                            )}
                        </>
                    )}
                </Stack>
            )}
        </>
    );
};
