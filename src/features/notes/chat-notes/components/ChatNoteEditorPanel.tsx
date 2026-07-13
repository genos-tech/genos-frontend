import { useEffect } from "react";
import { Box } from "@mui/joy";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { useChatNoteEditor } from "../../../../hooks/notes/useChatNoteEditor";
import { upsertNoteCache, useNoteData } from "../../../../hooks/notes/useNoteData";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import type { NoteTab } from "../../../../hooks/notes/useNoteTabs";
import { UserProps } from "../../../../types/admin";
import { ChatNoteProps } from "../../../../types/notes";
import { NoteAccessRequestPanel } from "../../common/components/NoteAccessRequestPanel";
import { ChatNoteEditor } from "./ChatNoteEditor";

interface ChatNoteEditorPanelProps {
    tab: NoteTab & { kind: "chat" };
    isActive: boolean;
    accessToken: string | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    useNM: NoteManagementState;
}

// Per-tab editor panel for a Chat note. Each instance owns its own
// BlockNote editor + Hocuspocus provider. Inactive panels stay mounted
// (display:none) so cross-tab switching is instant.
export const ChatNoteEditorPanel = ({
    tab,
    isActive,
    accessToken,
    myself,
    setMyself,
    socket,
    useTEM,
    useUISM,
    useCM,
    useNM,
}: ChatNoteEditorPanelProps) => {
    const { note, accessDenied } = useNoteData<ChatNoteProps>(tab, { myself, accessToken });

    const chatNoteEditor = useChatNoteEditor({
        currentChatNote: note,
        myself,
        accessToken,
        socket,
        resyncSignal: useNM.noteResyncNonce,
        onNoteUpdate: (updatedNote: ChatNoteProps) => {
            upsertNoteCache(updatedNote);
            // Only sync the legacy `currentChatNote` mirror when the
            // updated note is the active one — guards against a hidden
            // panel's socket-driven update clobbering the active state.
            if (
                useNM.currentChatNote?.noteType === updatedNote.noteType &&
                useNM.currentChatNote?.noteId === updatedNote.noteId
            ) {
                useNM.setCurrentChatNote(updatedNote);
            }

            useNM.tabsApi.updateTabTitle(updatedNote.noteId, "chat", updatedNote.title);

            // MERGE into the existing meta row — never rebuild it.
            // `updatedNote` spreads this panel's note snapshot, which
            // `useNoteData` resolved once at mount; rebuilding from it
            // would resurrect stale structural fields (parentNoteId /
            // chat anchoring) after a sidebar move. Structural fields
            // stay authoritative from the meta list. (Same pattern as
            // TaskNoteEditorPanel.)
            useNM.setChatNoteMeta(
                useNM.chatNoteMeta.map((item) =>
                    item.noteType === updatedNote.noteType && item.noteId === updatedNote.noteId
                        ? {
                              ...item,
                              title: updatedNote.title,
                              tsUpdated: updatedNote.tsUpdated,
                          }
                        : item
                )
            );

            useNM.bumpNoteVersionsHead(updatedNote.noteType, updatedNote.noteId);
        },
    });

    useEffect(() => {
        if (isActive) chatNoteEditor.setNoteBodySaved(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive]);

    if (accessDenied) {
        // The note exists but this user has no role on it (shared-URL
        // case) — offer the access-request flow instead of a blank pane.
        return (
            <Box sx={{ display: isActive ? "block" : "none", width: "100%", height: "100%" }}>
                <NoteAccessRequestPanel noteId={tab.noteId} noteType={3} socket={socket} />
            </Box>
        );
    }

    if (!note || !chatNoteEditor.body) {
        return null;
    }

    return (
        <Box
            sx={{
                display: isActive ? "block" : "none",
                paddingX: "5px",
                paddingTop: "0px",
                paddingBottom: "5px",
                width: "100%",
            }}
        >
            <ChatNoteEditor
                body={chatNoteEditor.body}
                currentChatNote={note}
                currentChatNoteTitle={chatNoteEditor.currentChatNoteTitle}
                currentNoteMembers={useNM.currentNoteMembers}
                myself={myself}
                noteBodySaved={chatNoteEditor.noteBodySaved}
                resyncSignal={useNM.noteResyncNonce}
                setMyself={setMyself}
                setNoteBodyEdited={chatNoteEditor.setNoteBodyEdited}
                setNoteBodySaved={chatNoteEditor.setNoteBodySaved}
                socket={socket}
                titleInputRef={chatNoteEditor.titleInputRef}
                useCM={useCM}
                useTEM={useTEM}
                useUISM={useUISM}
                onBodyChange={chatNoteEditor.handleBodyChange}
                onTitleBlur={chatNoteEditor.handleTitleBlur}
                onTitleChange={chatNoteEditor.handleTitleChange}
            />
        </Box>
    );
};
