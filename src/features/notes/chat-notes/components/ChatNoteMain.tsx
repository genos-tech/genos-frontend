import { Stack, TabPanel, Tabs } from "@mui/joy";
import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { useChatNoteEditor } from "../../../../hooks/notes/useChatNoteEditor";
import { useChatNoteTabs } from "../../../../hooks/notes/useChatNoteTabs";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { UserProps } from "../../../../types/admin";
import { ChatNoteProps } from "../../../../types/notes";
import { getLocalCurrentTimestamp } from "../../../../utils/dateUtils";
import { ChatNoteEditor } from "./ChatNoteEditor";
import { ChatNoteEmptyState } from "./ChatNoteEmptyState";
import { ChatNoteHeader } from "./ChatNoteHeader";
import { ChatNoteTabList } from "./ChatNoteTabList";

/**
 * Props for the ChatNoteMain component
 */
interface ChatNoteMainProps {
    /** Team member profiles indexed by user ID */
    TEM: TeamManagementState;
    /** Socket connection for real-time updates */
    socket: Socket | null;
    /** Current user information */
    myself: UserProps;
    /** Function to update current user */
    setMyself: (me: UserProps) => void;
    /** Function to set the opening service */
    UIM: UIStateManagementState;
    /** Whether the component is in chat page mode */
    isInChatPage: boolean;
    /** Function to set the current preview task ID */
    setCurrentPreviewTaskId: (id: number) => void;
    /** Function to set the current project */
    setCurrentProject: (project: any) => void;
    /** Note management state and actions */
    NM: NoteManagementState;
    /** Chat management state and actions */
    CM: ChatManagementState;
}

export const ChatNoteMain = (props: ChatNoteMainProps) => {
    const {
        TEM,
        socket,
        myself,
        setMyself,
        UIM,
        isInChatPage,
        setCurrentPreviewTaskId,
        setCurrentProject,
        NM,
        CM,
    } = props;

    const { accessToken } = useAuth();

    // Local state
    const [openDeleteNote, setOpenDeleteNote] = useState<boolean>(false);
    const [openSearchBox, setOpenSearchBox] = useState(false);
    const [tsBody, setTsBody] = useState<string>(getLocalCurrentTimestamp());

    // Custom hooks for note management
    const chatNoteEditor = useChatNoteEditor({
        currentChatNote: NM.currentChatNote,
        myself,
        accessToken,
        onNoteUpdate: (updatedNote: ChatNoteProps) => {
            // Update tab items
            NM.setTabItems(
                NM.tabItems.map((item) =>
                    item.noteType === NM.currentChatNote?.noteType &&
                    item.noteId === NM.currentChatNote?.noteId
                        ? updatedNote
                        : item
                )
            );

            // Update note metadata
            NM.setChatNoteMeta(
                NM.chatNoteMeta.map((item) =>
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

    const { handleCloseTab, handleTabChange } = useChatNoteTabs({ NM });

    // Reset note body saved status when the selected tab index changes
    useEffect(() => {
        chatNoteEditor.setNoteBodySaved(false);
    }, [NM.selectedTabIndex]);

    // Update timestamp when current note changes
    useEffect(() => {
        if (NM.currentChatNote) {
            setTsBody(getLocalCurrentTimestamp());
        }
    }, [NM.currentChatNote]);

    // Find the current chat
    const chat = CM.allChats.find(
        (chat) =>
            chat.chatType === NM.currentChatNote?.chatType &&
            NM.currentChatNote &&
            chat.chatId === NM.currentChatNote.chatId
    );

    // Event handlers
    const handleCreateChildNote = () => {
        if (NM.currentChatNote) {
            NM.handleCreateNewChatNote(
                NM.currentChatNote.noteId,
                NM.currentChatNote.chatType,
                NM.currentChatNote.chatId,
                NM.currentChatNote.isThread,
                NM.currentChatNote.threadId
            );
        } else {
            console.error("Can't parent note ID to create a child note.");
        }
    };

    const handleDeleteNote = () => {
        setOpenDeleteNote(true);
    };

    return (
        <>
            {(NM.tabItems.length === 0 || NM.currentChatNote === null) && <ChatNoteEmptyState />}

            {!(NM.tabItems.length === 0 || NM.currentChatNote === null) &&
                NM.chatNoteMeta.length > 0 && (
                    <Stack direction={"column"} sx={{ width: "100%" }}>
                        {chatNoteEditor.body && (
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
                                            <ChatNoteHeader
                                                chat={chat}
                                                CM={CM}
                                                currentChatNote={NM.currentChatNote}
                                                currentChatNoteChain={NM.currentChatNoteChain}
                                                handleCloseTab={handleCloseTab}
                                                isInChatPage={isInChatPage}
                                                myself={myself}
                                                NM={NM}
                                                openDeleteNote={openDeleteNote}
                                                openSearchBox={openSearchBox}
                                                setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                                setCurrentProject={setCurrentProject}
                                                setMyself={setMyself}
                                                setOpenDeleteNote={setOpenDeleteNote}
                                                setOpenSearchBox={setOpenSearchBox}
                                                socket={socket}
                                                TEM={TEM}
                                                UIM={UIM}
                                                onCreateChildNote={handleCreateChildNote}
                                                onDeleteNote={handleDeleteNote}
                                            />
                                        </Stack>

                                        <Tabs
                                            sx={{ width: "100%" }}
                                            value={NM.selectedTabIndex}
                                            onChange={(_, val) => handleTabChange(Number(val))}
                                        >
                                            <ChatNoteTabList
                                                tabItems={NM.tabItems}
                                                onCloseTab={handleCloseTab}
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
                                                    {NM.currentChatNote && chatNoteEditor.body && (
                                                        <ChatNoteEditor
                                                            body={chatNoteEditor.body}
                                                            CM={CM}
                                                            currentChatNote={NM.currentChatNote}
                                                            myself={myself}
                                                            setMyself={setMyself}
                                                            socket={socket}
                                                            TEM={TEM}
                                                            UIM={UIM}
                                                            currentChatNoteTitle={
                                                                chatNoteEditor.currentChatNoteTitle
                                                            }
                                                            noteBodySaved={
                                                                chatNoteEditor.noteBodySaved
                                                            }
                                                            setNoteBodyEdited={
                                                                chatNoteEditor.setNoteBodyEdited
                                                            }
                                                            setNoteBodySaved={
                                                                chatNoteEditor.setNoteBodySaved
                                                            }
                                                            titleInputRef={
                                                                chatNoteEditor.titleInputRef
                                                            }
                                                            onBodyChange={
                                                                chatNoteEditor.handleBodyChange
                                                            }
                                                            onTitleBlur={
                                                                chatNoteEditor.handleTitleBlur
                                                            }
                                                            onTitleChange={
                                                                chatNoteEditor.handleTitleChange
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
