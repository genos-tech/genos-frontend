import { PartialBlock } from "@blocknote/core";
import CheckIcon from "@mui/icons-material/Check";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import { Box, Button, FormControl, Input } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BnMyNoteEditor } from "../../../../components/blockNote/bnMyNoteEditor";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { ChatProps } from "../../../../types/chat";
import { MyNoteProps } from "../../../../types/notes";

interface NoteEditorProps {
    currentMyNote: MyNoteProps;
    body: PartialBlock[] | undefined;
    currentMyNoteTitle: string;
    titleInputRef: React.RefObject<HTMLInputElement | null>;
    noteBodySaved: boolean;
    onTitleChange: (value: string) => void;
    onTitleBlur: () => void;
    onBodyChange: (newBody: PartialBlock[]) => void;
    setCurrentChat: (chat: ChatProps) => void;
    setMyself: (me: UserProps) => void;
    UIM: UIStateManagementState;
    socket: Socket | null;
    TEM: TeamManagementState;
    myself: UserProps;
}

export const NoteEditor = ({
    currentMyNote,
    body,
    currentMyNoteTitle,
    titleInputRef,
    noteBodySaved,
    onTitleChange,
    onTitleBlur,
    onBodyChange,
    setCurrentChat,
    setMyself,
    UIM,
    socket,
    TEM,
    myself,
}: NoteEditorProps) => {
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
                    placeholder="Note Title"
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

            <BnMyNoteEditor
                body={body || []}
                currentMyNote={currentMyNote}
                myself={myself}
                setBody={onBodyChange}
                setCurrentChat={setCurrentChat}
                setMyself={setMyself}
                setNoteBodyEdited={() => {}} // This will be handled by the hook
                setNoteBodySaved={() => {}} // This will be handled by the hook
                UIM={UIM}
                socket={socket}
                TEM={TEM}
            />
        </>
    );
};
