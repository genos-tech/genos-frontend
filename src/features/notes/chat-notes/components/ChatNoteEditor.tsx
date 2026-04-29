import { PartialBlock } from "@blocknote/core";
import CheckIcon from "@mui/icons-material/Check";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import { Box, Button, FormControl, Input } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BnChatNoteEditor } from "../../../../components/editors/bnChatNoteEditor";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { ChatNoteProps } from "../../../../types/notes";

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
}: ChatNoteEditorProps) => {
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
                    key={"currentChatNoteTitle"}
                    placeholder="Note Title"
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
                        top: "50px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 100,
                    }}
                >
                    <Button
                        color="neutral"
                        size="sm"
                        startDecorator={<CheckIcon sx={{ fontSize: "15px" }} />}
                        variant="outlined"
                    >
                        Saved
                    </Button>
                </Box>
            )}

            <BnChatNoteEditor
                body={body}
                useCM={useCM}
                currentChatNote={currentChatNote}
                myself={myself}
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
