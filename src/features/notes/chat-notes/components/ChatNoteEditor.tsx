import { PartialBlock } from "@blocknote/core";
import CheckIcon from "@mui/icons-material/Check";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import { Box, Chip, FormControl, Input } from "@mui/joy";
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

            {noteBodySaved === true && (
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

            <BnChatNoteEditor
                body={body}
                useCM={useCM}
                currentChatNote={currentChatNote}
                currentNoteMembers={currentNoteMembers}
                myself={myself}
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
