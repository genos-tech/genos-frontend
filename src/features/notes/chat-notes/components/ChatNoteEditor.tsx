import { PartialBlock } from "@blocknote/core";
import { Socket } from "socket.io-client";

import { BnChatNoteEditor } from "../../../../components/editors/bnChatNoteEditor";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { ChatNoteProps, NoteRoleMember } from "../../../../types/notes";
import { NoteTitleField } from "../../common/components/NoteTitleField";

interface ChatNoteEditorProps {
    currentChatNote: ChatNoteProps;
    body: PartialBlock[];
    currentChatNoteTitle: string;
    titleInputRef: React.RefObject<HTMLInputElement | null>;
    noteBodySaved: boolean;
    onTitleChange: (value: string) => void;
    onTitleBlur: () => void;
    onBodyChange: (newBody: PartialBlock[]) => void;
    setNoteBodyEdited: (edited: boolean) => void;
    setNoteBodySaved: (saved: boolean) => void;
    useCM: ChatManagementState;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useUISM: UIStateManagementState;
    /** Forwarded to `BnChatNoteEditor` so it can switch between
     *  editor and viewer modes based on the current user's role. */
    currentNoteMembers: NoteRoleMember[];
    resyncSignal?: number | string;
}

export const ChatNoteEditor = ({
    currentChatNote,
    body,
    currentChatNoteTitle,
    titleInputRef,
    noteBodySaved,
    onTitleChange,
    onTitleBlur,
    onBodyChange,
    setNoteBodyEdited,
    setNoteBodySaved,
    myself,
    setMyself,
    socket,
    useTEM,
    useCM,
    useUISM,
    currentNoteMembers,
    resyncSignal,
}: ChatNoteEditorProps) => {
    return (
        <>
            {/* "Saved" chip lives INSIDE BnChatNoteEditor (next to the
                wrap toggles) so it stays anchored to them when the
                comments pane opens — see `noteBodySaved` prop below. */}

            <BnChatNoteEditor
                body={body}
                currentChatNote={currentChatNote}
                currentNoteMembers={currentNoteMembers}
                myself={myself}
                noteBodySaved={noteBodySaved}
                resyncSignal={resyncSignal}
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
                        value={currentChatNoteTitle}
                        onCommit={() => onTitleBlur()}
                        onDraftChange={onTitleChange}
                    />
                }
            />
        </>
    );
};
