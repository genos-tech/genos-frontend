import { useCallback, useEffect, useState } from "react";
import { Stack, TabPanel, Tabs } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { useNoteEditor } from "../../../../hooks/notes/useNoteEditor";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { UserProps } from "../../../../types/admin";
import { MyNoteProps } from "../../../../types/notes";
import { EmptyState } from "../../common/components/EmptyState";
import { NoteEditor } from "../../common/components/NoteEditor";
import { NoteHeaderActions } from "../../common/components/NoteHeaderActions";
import { NoteTabList } from "../../common/components/NoteTabList";
import { MyNoteHeader } from "../components/MyNoteHeader";
import { ModalDeleteMyNote } from "../modals/ModalDeleteMyNote";

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

    // Custom hooks for note management
    const noteEditor = useNoteEditor({
        currentMyNote: useNM.currentMyNote,
        myself,
        accessToken,
        onNoteUpdate: (updatedNote: MyNoteProps) => {
            // Push the latest title into the new tabs API so the strip
            // re-renders without going through the legacy
            // `setTabItems`/`setCurrent*Note` round-trip (which is what
            // caused the "snap-back" bug).
            useNM.tabsApi.updateTabTitle(updatedNote.noteId, "my", updatedNote.title);

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

    // The notes-home tab strip mixes all kinds (my/task/chat) into a
    // single bar, so the close handler must derive the kind from the
    // tab being clicked rather than assuming "my". The strip passes
    // both the index and the noteId; we look up the tab by index in
    // `tabsApi.tabs` and use its own id, falling back to a noteId-based
    // search if the index drifted (e.g. another tab was closed in the
    // same render cycle).
    const handleCloseTab = useCallback(
        (tabIndex: number, closingNoteId: number) => {
            const all = useNM.tabsApi.tabs;
            const target = all[tabIndex] ?? all.find((t) => t.noteId === closingNoteId) ?? null;
            if (target) useNM.tabsApi.closeTab(target.id);
        },
        [useNM.tabsApi]
    );

    const handleTabChange = useCallback(
        (newValue: number) => {
            const next = useNM.tabsApi.tabs[newValue];
            if (next) useNM.tabsApi.switchTab(next.id);
        },
        [useNM.tabsApi]
    );

    // Reset note body saved status when the selected tab index changes
    useEffect(() => {
        noteEditor.setNoteBodySaved(false);
    }, [useNM.selectedTabIndex]);

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

    const handleCopyNoteLink = async () => {
        if (useNM.currentMyNote) {
            const noteUrl = `${window.location.origin}/workspace/notes/my/${useNM.currentMyNote.noteId}`;
            try {
                await navigator.clipboard.writeText(noteUrl);
            } catch (err) {
                console.error("Failed to copy link:", err);
            }
        }
    };

    // If no tabs at all, show empty state with create button
    if (useNM.tabItems.length === 0) {
        return <EmptyState onCreateNewNote={handleCreateNewNote} />;
    }

    // If tabs exist but currentMyNote is not loaded yet, return null
    if (useNM.currentMyNote === null) {
        return null;
    }

    return (
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
                                    useNM={useNM}
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
                                    onCopyNoteLink={handleCopyNoteLink}
                                    onCreateChildNote={handleCreateChildNote}
                                    onCreateNewNote={handleCreateNewNote}
                                    onDeleteNote={handleDeleteNote}
                                    onOpenTask={() => {}}
                                />

                                {useNM.currentMyNote && (
                                    <ModalDeleteMyNote
                                        handleCloseTab={handleCloseTab}
                                        myself={myself}
                                        openDeleteNote={openDeleteNote}
                                        setOpenDeleteNote={setOpenDeleteNote}
                                        myNoteMeta={useNM.myNoteMeta}
                                        setMyNoteMeta={useNM.setMyNoteMeta}
                                        currentMyNote={useNM.currentMyNote}
                                        currentTabIndex={useNM.selectedTabIndex}
                                    />
                                )}
                            </Stack>

                            <Tabs
                                sx={{ width: "100%" }}
                                value={useNM.selectedTabIndex}
                                onChange={(_, val) => {
                                    handleTabChange(Number(val));
                                }}
                            >
                                <NoteTabList useNM={useNM} onCloseTab={handleCloseTab} />

                                {/* Render exactly one editor (not one per tab). The tab
                                 * strip lives in <NoteTabList> above; the body content
                                 * is a singleton because `useNM.currentMyNote` is too.
                                 * Keying by `noteType-noteId` remounts the BlockNote
                                 * editor + Hocuspocus provider only when the user
                                 * actually switches notes — which is what kills the
                                 * old N-editor remount storm that caused the lag. */}
                                {useNM.currentMyNote && (
                                    <TabPanel
                                        key={`tab-note-body-${useNM.currentMyNote.noteType}-${useNM.currentMyNote.noteId}`}
                                        value={useNM.selectedTabIndex}
                                        sx={{
                                            paddingX: "5px",
                                            paddingTop: "0px",
                                            paddingBottom: "5px",
                                        }}
                                    >
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
                                            currentMyNoteTitle={noteEditor.currentMyNoteTitle}
                                            onBodyChange={noteEditor.handleBodyChange}
                                            onTitleBlur={noteEditor.handleTitleBlur}
                                            onTitleChange={noteEditor.handleTitleChange}
                                        />
                                    </TabPanel>
                                )}
                            </Tabs>
                        </Stack>
                    )}
                </>
            )}
        </Stack>
    );
};
