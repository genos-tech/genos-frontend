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
import { NoteAccessRequestPanel } from "../../common/components/NoteAccessRequestPanel";
import { NoteEditor } from "../../common/components/NoteEditor";

interface MyNoteEditorPanelProps {
    tab: NoteTab & { kind: "my" };
    isActive: boolean;
    /** Stretch to the host's leftover height instead of growing with the
     *  document. Set by the mobile notes-home editor pool, where the
     *  page height is pinned and only this editor may scroll. */
    fillHeight?: boolean;
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
    fillHeight = false,
    accessToken,
    myself,
    setMyself,
    socket,
    useTEM,
    useUISM,
    useCM,
    useNM,
}: MyNoteEditorPanelProps) => {
    const { note, accessDenied } = useNoteData<MyNoteProps>(tab, { myself, accessToken });

    const noteEditor = useNoteEditor({
        currentMyNote: note,
        myself,
        accessToken,
        socket,
        resyncSignal: useNM.noteResyncNonce,
        onNoteUpdate: (updatedNote: MyNoteProps) => {
            // Tab strip title sync (no legacy `tabItems` round-trip).
            useNM.tabsApi.updateTabTitle(updatedNote.noteId, "my", updatedNote.title);

            // MERGE into the existing meta row — never rebuild it.
            // Autosave only changes title/body, but `updatedNote` is a
            // spread of this panel's note snapshot, which `useNoteData`
            // resolved ONCE at mount and never re-reads from the cache.
            // Rebuilding from it dropped `folderId` (note silently fell
            // out of its sidebar folder to root on every save) and
            // resurrected a pre-move `parentNoteId`. Structural fields
            // stay authoritative from the meta list, which the move
            // actions patch. (Same pattern as TaskNoteEditorPanel.)
            //
            // This panel serves ALL THREE personal-backed buckets, so the
            // patch has to reach whichever list holds the note — patching
            // `myNoteMeta` alone left renames invisible in the Team and
            // Shared sections.
            useNM.patchPersonalNoteMeta(
                updatedNote.noteId,
                updatedNote.title,
                updatedNote.tsUpdated
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

    if (accessDenied) {
        // The note exists but this user has no role on it (shared-URL
        // case) — offer the access-request flow instead of a blank pane.
        return (
            <Box sx={{ display: isActive ? "block" : "none", width: "100%", height: "100%" }}>
                <NoteAccessRequestPanel noteId={tab.noteId} noteType={1} socket={socket} />
            </Box>
        );
    }

    if (!note || !noteEditor.body) {
        // Don't render the visibility wrapper until the note has been
        // resolved — avoids a flash of empty space while the cache /
        // IDB / fetch chain is still settling.
        return null;
    }

    return (
        <Box
            sx={{
                display: isActive ? (fillHeight ? "flex" : "block") : "none",
                flexDirection: "column",
                paddingX: "5px",
                paddingTop: "0px",
                paddingBottom: "5px",
                width: "100%",
                ...(fillHeight ? { flex: 1, minHeight: 0 } : {}),
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
