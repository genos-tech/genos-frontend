import { useEffect } from "react";
import { Box } from "@mui/joy";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { useNoteData } from "../../../../hooks/notes/useNoteData";
import { useNoteEditor } from "../../../../hooks/notes/useNoteEditor";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import type { NoteTab } from "../../../../hooks/notes/useNoteTabs";
import { UserProps } from "../../../../types/admin";
import { MyNoteProps } from "../../../../types/notes";
import { NoteEditor } from "../../common/components/NoteEditor";

interface MyNoteEditorPanelProps {
    tab: NoteTab & { kind: "my" };
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

// Per-tab editor panel for a My note. Each instance owns its own
// BlockNote editor + collab provider — mounted as soon as the tab
// enters the live pool and torn down only on eviction. Inactive
// panels stay mounted (display:none) so switching back is instant.
export const MyNoteEditorPanel = ({
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
}: MyNoteEditorPanelProps) => {
    const { note } = useNoteData<MyNoteProps>(tab, { myself, accessToken });

    const noteEditor = useNoteEditor({
        currentMyNote: note,
        myself,
        accessToken,
        socket,
        resyncSignal: useNM.noteResyncNonce,
        onNoteUpdate: (updatedNote: MyNoteProps) => {
            // Tab strip title sync (no legacy `tabItems` round-trip).
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

            useNM.bumpNoteVersionsHead(updatedNote.noteType, updatedNote.noteId);
        },
    });

    // Reset the "saved" indicator when this panel becomes active again,
    // so a chip from a prior edit doesn't linger after a tab switch.
    useEffect(() => {
        if (isActive) noteEditor.setNoteBodySaved(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive]);

    if (!note || !noteEditor.body) {
        // Don't render the visibility wrapper until the note has been
        // resolved — avoids a flash of empty space while the cache /
        // IDB / fetch chain is still settling.
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
            <NoteEditor
                body={noteEditor.body}
                currentMyNote={note}
                currentMyNoteTitle={noteEditor.currentMyNoteTitle}
                myself={myself}
                noteBodySaved={noteEditor.noteBodySaved}
                setMyself={setMyself}
                setNoteBodyEdited={noteEditor.setNoteBodyEdited}
                setNoteBodySaved={noteEditor.setNoteBodySaved}
                socket={socket}
                titleInputRef={noteEditor.titleInputRef}
                useCM={useCM}
                useNM={useNM}
                useTEM={useTEM}
                useUISM={useUISM}
                onBodyChange={noteEditor.handleBodyChange}
                onTitleBlur={noteEditor.handleTitleBlur}
                onTitleChange={noteEditor.handleTitleChange}
            />
        </Box>
    );
};
