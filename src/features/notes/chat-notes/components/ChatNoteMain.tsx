import { useCallback, useEffect, useState } from "react";
import { Stack, TabPanel, Tabs } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { useChatNoteEditor } from "../../../../hooks/notes/useChatNoteEditor";
import { upsertNoteCache } from "../../../../hooks/notes/useNoteData";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ChatNoteProps } from "../../../../types/notes";
import { ChatNoteEditor } from "./ChatNoteEditor";
import { ChatNoteHeader } from "./ChatNoteHeader";
import { ChatNoteTabList } from "./ChatNoteTabList";

/**
 * Props for the ChatNoteMain component
 */
interface ChatNoteMainProps {
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
    /** Whether the component is in chat page mode */
    isInChatPage: boolean;
    /** Function to set the current preview task ID */
    useTM: TaskManagementState;
    /** Function to set the current project */
    usePM: ProjectManagementState;
    /** Note management state and actions */
    useNM: NoteManagementState;
    /** Chat management state and actions */
    useCM: ChatManagementState;
}

export const ChatNoteMain = (props: ChatNoteMainProps) => {
    const {
        useTEM,
        socket,
        myself,
        setMyself,
        useUISM,
        isInChatPage,
        useTM,
        usePM,
        useNM,
        useCM,
    } = props;

    const { accessToken } = useAuth();

    // Local state
    const [openDeleteNote, setOpenDeleteNote] = useState<boolean>(false);
    const [openSearchBox, setOpenSearchBox] = useState(false);

    // The chat-page panel uses isolated state (`chatPanelApi`) so the
    // notes-home tab strip is never touched by chat-page activity. The
    // notes-home rendering continues to read from `useNM.currentChatNote`
    // (which is now driven by `tabsApi.activeTab` via an effect in
    // `useNoteManagement`).
    const activeChatNote = isInChatPage ? useNM.chatPanelApi.note : useNM.currentChatNote;

    // Custom hooks for note management
    const chatNoteEditor = useChatNoteEditor({
        currentChatNote: activeChatNote,
        myself,
        accessToken,
        onNoteUpdate: (updatedNote: ChatNoteProps) => {
            // Cache write-through so the per-tab data hook sees the
            // freshest body on next mount. We deliberately no longer
            // call the legacy `setCurrentChatNote` from this path — that
            // (combined with the legacy tab effects) was the root cause
            // of the "snap-back" bug.
            upsertNoteCache(updatedNote);
            if (isInChatPage) {
                // Update the isolated chat-panel state.
                useNM.chatPanelApi.setNote(updatedNote);
            } else if (
                useNM.currentChatNote?.noteType === updatedNote.noteType &&
                useNM.currentChatNote?.noteId === updatedNote.noteId
            ) {
                // Notes-home: keep the legacy mirror in sync until full
                // migration removes it.
                useNM.setCurrentChatNote(updatedNote);
            }

            // Sync tab strip title via the new sync API (no tabItems
            // re-write, no selectedTabIndex reshuffle). Skip when in
            // chat-page mode — the panel doesn't use the notes-home tab
            // strip.
            if (!isInChatPage) {
                useNM.tabsApi.updateTabTitle(updatedNote.noteId, "chat", updatedNote.title);
            }

            useNM.setChatNoteMeta(
                useNM.chatNoteMeta.map((item) =>
                    item.noteType === updatedNote.noteType && item.noteId === updatedNote.noteId
                        ? {
                              noteType: updatedNote.noteType,
                              noteId: updatedNote.noteId,
                              parentNoteId: updatedNote.parentNoteId,
                              chatType: updatedNote.chatType,
                              chatId: updatedNote.chatId,
                              isThread: updatedNote.isThread,
                              threadId: updatedNote.threadId,
                              title: updatedNote.title,
                              tsUpdated: updatedNote.tsUpdated,
                          }
                        : item
                )
            );
        },
    });

    // The notes-home tab strip mixes all kinds (my/task/chat); resolve
    // the tab by index first, then fall back to noteId, so the close
    // button works on any tab regardless of which Main is hosting the
    // strip right now.
    const handleCloseTab = useCallback(
        async (tabIndex: number, closingNoteId: number) => {
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
        chatNoteEditor.setNoteBodySaved(false);
    }, [useNM.selectedTabIndex]);

    // In chat-page mode, mirror the chat panel's note into the legacy
    // `useNM.currentChatNote` so child components (`ChatNoteHeader`,
    // search) that still read it work without modification. Notes-home
    // mode is driven by `tabsApi.activeTab` via the effect in
    // `useNoteManagement`.
    useEffect(() => {
        if (!isInChatPage) return;
        const next = useNM.chatPanelApi.note;
        if (next) {
            useNM.setCurrentChatNote(next);
        }
    }, [isInChatPage, useNM.chatPanelApi.note]);

    // Find the current chat
    const chat = useCM.allChats.find(
        (c) =>
            c.chatType === activeChatNote?.chatType &&
            activeChatNote &&
            c.chatId === activeChatNote.chatId
    );

    // Event handlers
    const handleCreateChildNote = () => {
        if (activeChatNote) {
            useNM.handleCreateNewChatNote(
                activeChatNote.noteId,
                activeChatNote.chatType,
                activeChatNote.chatId,
                activeChatNote.isThread,
                activeChatNote.threadId
            );
        } else {
            console.error("Can't parent note ID to create a child note.");
        }
    };

    const handleDeleteNote = () => {
        setOpenDeleteNote(true);
    };

    // If the active note is not loaded yet, return null
    if (activeChatNote === null) {
        return null;
    }

    // If no chat note metadata, return null
    if (useNM.chatNoteMeta.length === 0) {
        return null;
    }

    return (
        <Stack direction={"column"} sx={{ width: "100%" }}>
            {chatNoteEditor.body && (
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
                                <ChatNoteHeader
                                    chat={chat}
                                    useCM={useCM}
                                    handleCloseTab={handleCloseTab}
                                    isInChatPage={isInChatPage}
                                    myself={myself}
                                    useNM={useNM}
                                    openDeleteNote={openDeleteNote}
                                    openSearchBox={openSearchBox}
                                    useTM={useTM}
                                    usePM={usePM}
                                    setMyself={setMyself}
                                    setOpenDeleteNote={setOpenDeleteNote}
                                    setOpenSearchBox={setOpenSearchBox}
                                    socket={socket}
                                    useTEM={useTEM}
                                    useUISM={useUISM}
                                    onCreateChildNote={handleCreateChildNote}
                                    onDeleteNote={handleDeleteNote}
                                />
                            </Stack>

                            <Tabs
                                sx={{ width: "100%" }}
                                value={isInChatPage ? 0 : useNM.selectedTabIndex}
                                onChange={(_, val) => {
                                    if (!isInChatPage) handleTabChange(Number(val));
                                }}
                            >
                                {/* The chat-page panel renders a single note,
                                 * so we hide the multi-tab strip there. The
                                 * notes-home rendering keeps the strip and
                                 * drives it off the new tabsApi. */}
                                {!isInChatPage && (
                                    <ChatNoteTabList
                                        tabItems={useNM.tabItems}
                                        onCloseTab={handleCloseTab}
                                    />
                                )}

                                {/* Render exactly one editor. Keying by
                                 * `noteType-noteId` remounts BlockNote +
                                 * Hocuspocus only when the user actually
                                 * switches notes. */}
                                {activeChatNote && chatNoteEditor.body && (
                                    <TabPanel
                                        key={`tab-note-body-${activeChatNote.noteType}-${activeChatNote.noteId}`}
                                        value={isInChatPage ? 0 : useNM.selectedTabIndex}
                                        sx={{
                                            paddingX: "5px",
                                            paddingTop: "0px",
                                            paddingBottom: "5px",
                                        }}
                                    >
                                        <ChatNoteEditor
                                            body={chatNoteEditor.body}
                                            useCM={useCM}
                                            currentChatNote={activeChatNote}
                                            myself={myself}
                                            setMyself={setMyself}
                                            socket={socket}
                                            useTEM={useTEM}
                                            useUISM={useUISM}
                                            currentChatNoteTitle={
                                                chatNoteEditor.currentChatNoteTitle
                                            }
                                            noteBodySaved={chatNoteEditor.noteBodySaved}
                                            setNoteBodyEdited={chatNoteEditor.setNoteBodyEdited}
                                            setNoteBodySaved={chatNoteEditor.setNoteBodySaved}
                                            titleInputRef={chatNoteEditor.titleInputRef}
                                            onBodyChange={chatNoteEditor.handleBodyChange}
                                            onTitleBlur={chatNoteEditor.handleTitleBlur}
                                            onTitleChange={chatNoteEditor.handleTitleChange}
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
