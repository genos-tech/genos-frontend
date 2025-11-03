import { PartialBlock } from "@blocknote/core";
import CheckIcon from "@mui/icons-material/Check";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import { Box, Button, FormControl, Input } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BnChatNoteEditor } from "../../../../components/blockNote/bnChatNoteEditor";
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
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    socket: Socket | null;
    TEM: TeamManagementState;
    setCurrentChat: (chat: any) => void;
    UIM: UIStateManagementState;
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
    TEM,
    setCurrentChat,
    UIM,
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
                        mt: "12px",
                        ml: "335px",
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
                currentChatNote={currentChatNote}
                myself={myself}
                setBody={onBodyChange}
                setCurrentChat={setCurrentChat}
                setMyself={setMyself}
                setNoteBodyEdited={setNoteBodyEdited}
                setNoteBodySaved={setNoteBodySaved}
                UIM={UIM}
                socket={socket}
                TEM={TEM}
            />
        </>
    );
};
