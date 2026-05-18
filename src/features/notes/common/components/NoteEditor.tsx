import { PartialBlock } from "@blocknote/core";
import CheckIcon from "@mui/icons-material/Check";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import { Box, Chip, FormControl, Input } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BnMyNoteEditor } from "../../../../components/editors/bnMyNoteEditor";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { MyNoteProps } from "../../../../types/notes";

interface NoteEditorProps {
    useNM: NoteManagementState;
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
                }}
                required
            >
                <Input
                    key={"currentMyNoteTitle"}
                    placeholder={t.notes.editor.titlePlaceholder}
                    startDecorator={<NoteAltIcon />}
                    value={currentMyNoteTitle}
                    variant="soft"
                    slotProps={{
                        input: {
                            ref: titleInputRef,
                            onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
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

            {noteBodySaved && (
                <Box
                    sx={{
                        position: "absolute",
                        top: "52.5px",
                        right: "1%",
                        transform: "translateX(-50%)",
                        zIndex: 100,
                    }}
                >
                    <Chip
                        size="sm"
                        variant="soft"
                        color="neutral"
                        startDecorator={<CheckIcon sx={{ fontSize: 14 }} />}
                        sx={{
                            fontWeight: 500,
                            fontSize: "13px",
                            "--Chip-paddingInline": "10px",
                            animation: "fadeIn 0.3s ease-in-out",
                            "@keyframes fadeIn": {
                                from: { opacity: 0, transform: "scale(0.95)" },
                                to: { opacity: 1, transform: "scale(1)" },
                            },
                        }}
                    >
                        {t.notes.editor.savedChip}
                    </Chip>
                </Box>
            )}

            <BnMyNoteEditor
                body={body || []}
                useCM={useCM}
                currentMyNote={useNM.currentMyNote as MyNoteProps}
                currentNoteMembers={useNM.currentNoteMembers}
                myself={myself}
                resyncSignal={useNM.noteResyncNonce}
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
