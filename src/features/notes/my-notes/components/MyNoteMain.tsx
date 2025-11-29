import { useEffect, useState } from "react";
import { Stack, TabPanel, Tabs } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { useNoteEditor } from "../../../../hooks/notes/useNoteEditor";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useNoteTabs } from "../../../../hooks/notes/useNoteTabs";
import { UserProps } from "../../../../types/admin";
import { MyNoteProps } from "../../../../types/notes";
import { getLocalCurrentTimestamp } from "../../../../utils/dateUtils";
import { EmptyState } from "../../shared-notes/components/EmptyState";
import { NoteEditor } from "../../shared-notes/components/NoteEditor";
import { NoteHeaderActions } from "../../shared-notes/components/NoteHeaderActions";
import { NoteTabList } from "../../shared-notes/components/NoteTabList";
import { MyNoteHeader } from "../components/MyNoteHeader";

/**
 * Props for the MyNoteMain component
 */
interface MyNoteMainProps {
    /** Team member profiles indexed by user ID */
    useTEM: TeamManagementState;
    /** Socket connection for real-time updates */
    socket: Socket | null;
    /** Current user information */
    myself: UserProps;
    /** Function to update current user */
    setMyself: (me: UserProps) => void;
    /** Function to set the opening service */
    useUISM: UIStateManagementState;
    /** Note management state and actions */
    useNM: NoteManagementState;
    /** Chat management state and actions */
    useCM: ChatManagementState;
}

export const MyNoteMain = (props: MyNoteMainProps) => {
    const { useTEM, socket, myself, setMyself, useUISM, useNM, useCM } = props;

    const { accessToken } = useAuth();
    const [openDeleteNote, setOpenDeleteNote] = useState<boolean>(false);
    const [tsBody, setTsBody] = useState<string>(getLocalCurrentTimestamp());

    // Custom hooks for note management
    const noteEditor = useNoteEditor({
        currentMyNote: useNM.currentMyNote,
        myself,
        accessToken,
        onNoteUpdate: (updatedNote: MyNoteProps) => {
            // Update tab items
            useNM.setTabItems(
                useNM.tabItems.map((item) =>
                    item.noteType === useNM.currentMyNote?.noteType &&
                    item.noteId === useNM.currentMyNote?.noteId
                        ? updatedNote
                        : item
                )
            );

            // Update note metadata
            useNM.setMyNoteMeta(
                useNM.myNoteMeta.map((item) =>
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

    const { handleCloseTab, handleTabChange } = useNoteTabs({ useNM });

    // Reset note body saved status when the selected tab index changes
    useEffect(() => {
        noteEditor.setNoteBodySaved(false);
    }, [useNM.selectedTabIndex]);

    // Update timestamp when current note changes
    useEffect(() => {
        if (useNM.currentMyNote) {
            setTsBody(getLocalCurrentTimestamp());
        }
    }, [useNM.currentMyNote]);

    // Event handlers
    const handleCreateNewNote = () => {
        useNM.handleCreateNewMyNote(null);
    };

    const handleCreateChildNote = () => {
        if (useNM.currentMyNote) {
            useNM.handleCreateNewMyNote(useNM.currentMyNote.noteId);
        } else {
            console.error("Can't parent note ID to create a child note.");
        }
    };

    const handleDeleteNote = () => {
        setOpenDeleteNote(true);
    };

    return (
        <>
            {(useNM.tabItems.length === 0 || useNM.currentMyNote === null) && (
                <EmptyState onCreateNewNote={handleCreateNewNote} />
            )}

            {!(useNM.tabItems.length === 0 || useNM.currentMyNote === null) && (
                <Stack direction={"column"} sx={{ width: "100%" }}>
                    {noteEditor.body && (
                        <>
                            {useNM.currentNoteType !== 0 && (
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
                                        <MyNoteHeader useNM={useNM} />

                                        <NoteHeaderActions
                                            useCM={useCM}
                                            currentTask={undefined}
                                            isInTaskPage={false}
                                            myself={myself}
                                            noteType={1}
                                            pmChat={undefined}
                                            setMyself={setMyself}
                                            socket={socket}
                                            useTEM={useTEM}
                                            useUISM={useUISM}
                                            onCloseNotes={() => {}}
                                            onCreateChildNote={handleCreateChildNote}
                                            onCreateNewNote={handleCreateNewNote}
                                            onDeleteNote={handleDeleteNote}
                                            onOpenTask={() => {}}
                                        />
                                    </Stack>

                                    <Tabs
                                        sx={{ width: "100%" }}
                                        value={useNM.selectedTabIndex}
                                        onChange={(_, val) => {
                                            handleTabChange(Number(val));
                                        }}
                                    >
                                        <NoteTabList useNM={useNM} onCloseTab={handleCloseTab} />

                                        {useNM.tabItems.map((tabNote, index) => (
                                            <TabPanel
                                                key={`tab-note-body-${tabNote.noteType}-${tabNote.noteId}-${tsBody}`}
                                                value={index}
                                                sx={{
                                                    paddingX: "5px",
                                                    paddingTop: "0px",
                                                    paddingBottom: "5px",
                                                }}
                                            >
                                                {useNM.currentMyNote && (
                                                    <NoteEditor
                                                        body={noteEditor.body}
                                                        useCM={useCM}
                                                        useNM={useNM}
                                                        myself={myself}
                                                        noteBodySaved={noteEditor.noteBodySaved}
                                                        setMyself={setMyself}
                                                        socket={socket}
                                                        useTEM={useTEM}
                                                        titleInputRef={noteEditor.titleInputRef}
                                                        useUISM={useUISM}
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
