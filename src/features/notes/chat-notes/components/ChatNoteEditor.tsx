import { PartialBlock } from "@blocknote/core";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import { FormControl, Input } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BnChatNoteEditor } from "../../../../components/editors/bnChatNoteEditor";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { ChatNoteProps, NoteRoleMember } from "../../../../types/notes";

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
    const { t } = useTranslation();
    return (
        <>
            <FormControl
                sx={{
                    mt: "10px",
                    ml: "10px",
                    justifyContent: "center",
                    position: "absolute",
                    zIndex: 100,
                    width: "400px",
                }}
                required
            >
                <Input
                    key={"currentChatNoteTitle"}
                    placeholder={t.notes.editor.titlePlaceholder}
                    startDecorator={<NoteAltIcon />}
                    value={currentChatNoteTitle}
                    variant="soft"
                    slotProps={{
                        input: {
                            ref: titleInputRef,
                            onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                                if (e.key === "Enter") {
                                    e.preventDefault(); // stop form submission if inside <form>
                                    titleInputRef.current?.blur();
                                }
                            },
                        },
                    }}
                    sx={{
                        fontSize: "22px",
                        fontWeight: "bold",
                    }}
                    onBlur={onTitleBlur}
                    onChange={(e) => onTitleChange(e.target.value)}
                />
            </FormControl>

            {/* "Saved" chip lives INSIDE BnChatNoteEditor (next to the
                wrap toggles) so it stays anchored to them when the
                comments pane opens — see `noteBodySaved` prop below. */}

            <BnChatNoteEditor
                body={body}
                useCM={useCM}
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
                useTEM={useTEM}
                useUISM={useUISM}
            />
        </>
    );
};
