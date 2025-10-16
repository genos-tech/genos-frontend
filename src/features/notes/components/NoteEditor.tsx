import { PartialBlock } from "@blocknote/core";
import CheckIcon from "@mui/icons-material/Check";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import { Box, Button, FormControl, Input } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BnMyNoteEditor } from "../../../components/blockNote/bnMyNoteEditor";
import { UserProps } from "../../../types/admin";
import { ChatProps } from "../../../types/chat";
import { MyNoteProps } from "../../../types/notes";

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
    setOpeningService: (service: number) => void;
    socket: Socket | null;
    teamMemberProfiles: Record<string, UserProps>;
    teamMembers: UserProps[];
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
    setOpeningService,
    socket,
    teamMemberProfiles,
    teamMembers,
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
                        variant="outlined"
                        startDecorator={<CheckIcon sx={{ fontSize: "15px" }} />}
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
                setOpeningService={setOpeningService}
                socket={socket}
                teamMemberProfiles={teamMemberProfiles}
                teamMembers={teamMembers}
            />
        </>
    );
};
