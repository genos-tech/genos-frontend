import { PartialBlock } from "@blocknote/core";
import { Socket } from "socket.io-client";

import { BnMyNoteEditor } from "../../../../components/editors/bnMyNoteEditor";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { UserProps } from "../../../../types/admin";
import { MyNoteProps } from "../../../../types/notes";
import { NoteTitleField } from "./NoteTitleField";

interface NoteEditorProps {
    useNM: NoteManagementState;
    // The note this editor instance is bound to. Passed in by the
    // editor pool (MyNoteEditorPanel) so hidden panels can drive their
    // own BlockNote document even when `useNM.currentMyNote` reflects a
    // different active tab.
    currentMyNote: MyNoteProps;
    currentMyNoteTitle: string;
    body: PartialBlock[] | undefined;
    titleInputRef: React.RefObject<HTMLInputElement | null>;
    noteBodySaved: boolean;
    onTitleChange: (value: string) => void;
    onTitleBlur: () => void;
    onBodyChange: (newBody: PartialBlock[]) => void;
    /** Real setters forwarded to `BnMyNoteEditor` so it can flip the
     *  edited / saved flags only when the user actually typed —
     *  see `userInteractedRef` in the editor. Used to be `() => {}`
     *  noops here while `handleBodyChange` did the work, but that
     *  fired even on initial body load, triggering spurious
     *  auto-saves the moment a note opened. */
    setNoteBodyEdited: (edited: boolean) => void;
    setNoteBodySaved: (saved: boolean) => void;
    useCM: ChatManagementState;
    setMyself: (me: UserProps) => void;
    useUISM: UIStateManagementState;
    socket: Socket | null;
    useTEM: TeamManagementState;
    myself: UserProps;
}

export const NoteEditor = ({
    currentMyNote,
    currentMyNoteTitle,
    useNM,
    body,
    titleInputRef,
    noteBodySaved,
    onTitleChange,
    onTitleBlur,
    onBodyChange,
    setNoteBodyEdited,
    setNoteBodySaved,
    useCM,
    setMyself,
    useUISM,
    socket,
    useTEM,
    myself,
}: NoteEditorProps) => {
    return (
        <>
            {/* "Saved" chip is rendered INSIDE BnMyNoteEditor (next to
                the wrap toggles) so it auto-shifts when the comments
                pane opens — see `noteBodySaved` prop below. */}

            <BnMyNoteEditor
                body={body || []}
                currentMyNote={currentMyNote}
                currentNoteMembers={useNM.currentNoteMembers}
                myself={myself}
                noteBodySaved={noteBodySaved}
                resyncSignal={useNM.noteResyncNonce}
                setBody={onBodyChange}
                setMyself={setMyself}
                setNoteBodyEdited={setNoteBodyEdited}
                setNoteBodySaved={setNoteBodySaved}
                socket={socket}
                useCM={useCM}
                useTEM={useTEM}
                useUISM={useUISM}
                titleSlot={
                    <NoteTitleField
                        inputRef={titleInputRef}
                        value={currentMyNoteTitle}
                        onCommit={() => onTitleBlur()}
                        onDraftChange={onTitleChange}
                    />
                }
            />
        </>
    );
};
