import { useEffect, useState } from "react";
import { Stack, TabPanel, Tabs } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { useChatNoteEditor } from "../../../../hooks/notes/useChatNoteEditor";
import { useChatNoteTabs } from "../../../../hooks/notes/useChatNoteTabs";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ChatNoteProps } from "../../../../types/notes";
import { getLocalCurrentTimestamp } from "../../../../utils/dateUtils";
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
    const [tsBody, setTsBody] = useState<string>(getLocalCurrentTimestamp());

    // Custom hooks for note management
    const chatNoteEditor = useChatNoteEditor({
        currentChatNote: useNM.currentChatNote,
        myself,
        accessToken,
        onNoteUpdate: (updatedNote: ChatNoteProps) => {
            // Keep the shared current chat note in sync so that the latest title/body
            // survives across unmount/remount when switching between the chat and note
            // services (e.g. clicking the Notes tab in the sidebar).
            if (
                useNM.currentChatNote?.noteType === updatedNote.noteType &&
                useNM.currentChatNote?.noteId === updatedNote.noteId
            ) {
                useNM.setCurrentChatNote(updatedNote);
            }

            // Update tab items
            useNM.setTabItems(
                useNM.tabItems.map((item) =>
                    item.noteType === useNM.currentChatNote?.noteType &&
                    item.noteId === useNM.currentChatNote?.noteId
                        ? updatedNote
                        : item
                )
            );

            // Update note metadata
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

    const { handleCloseTab, handleTabChange } = useChatNoteTabs({ useNM });

    // Reset note body saved status when the selected tab index changes
    useEffect(() => {
        chatNoteEditor.setNoteBodySaved(false);
    }, [useNM.selectedTabIndex]);

    // Refresh the TabPanel key only when the user actually switches to a
    // different chat note. Reference-only updates (e.g. an in-place save that
    // produces a new currentChatNote object) must NOT remount the editor, or
    // the title input loses focus mid-typing.
    useEffect(() => {
        setTsBody(getLocalCurrentTimestamp());
    }, [useNM.currentChatNote?.noteType, useNM.currentChatNote?.noteId]);

    // Find the current chat
    const chat = useCM.allChats.find(
        (chat) =>
            chat.chatType === useNM.currentChatNote?.chatType &&
            useNM.currentChatNote &&
            chat.chatId === useNM.currentChatNote.chatId
    );

    // Event handlers
    const handleCreateChildNote = () => {
        if (useNM.currentChatNote) {
            useNM.handleCreateNewChatNote(
                useNM.currentChatNote.noteId,
                useNM.currentChatNote.chatType,
                useNM.currentChatNote.chatId,
                useNM.currentChatNote.isThread,
                useNM.currentChatNote.threadId
            );
        } else {
            console.error("Can't parent note ID to create a child note.");
        }
    };

    const handleDeleteNote = () => {
        setOpenDeleteNote(true);
    };

    // If tabs exist but currentChatNote is not loaded yet, return null
    if (useNM.currentChatNote === null) {
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
                                value={useNM.selectedTabIndex}
                                onChange={(_, val) => handleTabChange(Number(val))}
                            >
                                <ChatNoteTabList
                                    tabItems={useNM.tabItems}
                                    onCloseTab={handleCloseTab}
                                />

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
                                        {useNM.currentChatNote && chatNoteEditor.body && (
                                            <ChatNoteEditor
                                                body={chatNoteEditor.body}
                                                useCM={useCM}
                                                currentChatNote={useNM.currentChatNote}
                                                myself={myself}
                                                setMyself={setMyself}
                                                socket={socket}
                                                useTEM={useTEM}
                                                useUISM={useUISM}
                                                currentChatNoteTitle={
                                                    chatNoteEditor.currentChatNoteTitle
                                                }
                                                noteBodySaved={chatNoteEditor.noteBodySaved}
                                                setNoteBodyEdited={
                                                    chatNoteEditor.setNoteBodyEdited
                                                }
                                                setNoteBodySaved={chatNoteEditor.setNoteBodySaved}
                                                titleInputRef={chatNoteEditor.titleInputRef}
                                                onBodyChange={chatNoteEditor.handleBodyChange}
                                                onTitleBlur={chatNoteEditor.handleTitleBlur}
                                                onTitleChange={chatNoteEditor.handleTitleChange}
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
    );
};
