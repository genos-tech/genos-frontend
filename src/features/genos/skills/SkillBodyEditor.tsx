import { useImperativeHandle, useMemo, type Ref } from "react";
import { Box } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BnMyNoteEditor } from "../../../components/editors/bnMyNoteEditor";
import { useAuth } from "../../../context/authState";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { useNoteData } from "../../../hooks/notes/useNoteData";
import { useNoteEditor } from "../../../hooks/notes/useNoteEditor";
import type { NoteTab } from "../../../hooks/notes/useNoteTabs";
import { UserProps } from "../../../types/admin";
import { MyNoteProps, NoteRoleMember } from "../../../types/notes";
import { NoteAccessRequestPanel } from "../../notes/common/components/NoteAccessRequestPanel";
import { NoteLoadState } from "../../notes/common/components/NoteLoadState";

/** No explicit role rows: the owner of an unshared note is its implicit editor. */
const NO_MEMBERS: NoteRoleMember[] = [];

export type SkillBodyEditorHandle = {
    /** Save the body now (the editor saves on a short delay; publishing must not miss the last
     *  keystrokes). Resolves when the save has been sent. */
    flush: () => Promise<void>;
};

type Props = {
    noteId: number;
    teamId: string;
    title: string;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    /** The person typed in the body (the details form shows "unsaved text is saving"). */
    onEdited?: () => void;
    handleRef?: Ref<SkillBodyEditorHandle>;
};

/**
 * The body of a skill: the note editor, the same one My Notes uses (collab, comments, slash
 * menu, attachments), bound to the skill's note.
 *
 * It does what `MyNoteEditorPanel` does without the notes sidebar's state (`useNM`): the
 * note comes from `useNoteData`, saving from `useNoteEditor`, and the editor is
 * `BnMyNoteEditor` with no title field, because the skill's title is a field of the details form.
 *
 * Keeping the NOTE's title equal to the skill's title is the page's job (`skillNoteTitle.ts`):
 * the editor sends the cached note's title with every body save, so a stale one would rename
 * the note back.
 */
export const SkillBodyEditor = ({
    noteId,
    teamId,
    title,
    myself,
    setMyself,
    socket,
    useTEM,
    useCM,
    useUISM,
    onEdited,
    handleRef,
}: Props) => {
    const { accessToken } = useAuth();
    const tab = useMemo<NoteTab>(
        () => ({
            id: `my-${noteId}`,
            kind: "my",
            noteType: 1,
            noteId,
            title,
            teamId,
        }),
        // The title is the tab strip's label, which this page has none of: a rename must not
        // rebuild the tab (and refetch the note).
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [noteId, teamId]
    );
    const { note, accessDenied, isLoading, error, notFound, reload } = useNoteData<MyNoteProps>(
        tab,
        { myself, accessToken }
    );
    const noteEditor = useNoteEditor({
        currentMyNote: note,
        myself,
        accessToken,
        socket,
        // No tab strip or sidebar list to keep in step: a save writes the note cache itself.
        onNoteUpdate: () => undefined,
    });

    useImperativeHandle(handleRef, () => ({ flush: () => noteEditor.updateNote() }), [noteEditor]);

    // Typing in the body is what the page reports; the flag the editor wants is its own.
    const { setNoteBodyEdited } = noteEditor;
    const reportEdited = (edited: boolean) => {
        setNoteBodyEdited(edited);
        if (edited) onEdited?.();
    };

    if (accessDenied) {
        return <NoteAccessRequestPanel noteId={noteId} noteType={1} socket={socket} />;
    }
    if (!note || !noteEditor.body) {
        return (
            <NoteLoadState
                error={error !== null}
                isLoading={isLoading}
                notFound={notFound}
                isActive
                onRetry={reload}
            />
        );
    }
    return (
        <Box sx={{ minWidth: 0, width: "100%" }}>
            <BnMyNoteEditor
                body={noteEditor.body}
                currentMyNote={note}
                currentNoteMembers={NO_MEMBERS}
                myself={myself}
                noteBodySaved={noteEditor.noteBodySaved}
                setBody={noteEditor.handleBodyChange}
                setMyself={setMyself}
                setNoteBodyEdited={reportEdited}
                setNoteBodySaved={noteEditor.setNoteBodySaved}
                socket={socket}
                useCM={useCM}
                useTEM={useTEM}
                useUISM={useUISM}
                hideViewControls
            />
        </Box>
    );
};
