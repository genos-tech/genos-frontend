import React, { useState } from "react";
import { Alert, Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";

import { useAuth } from "../../../../context/AuthContext";
import { NoteService } from "../../../../db/services/note.service";
import { UserProps } from "../../../../types/admin";
import { ChatNoteMetaProps, ChatNoteProps } from "../../../../types/notes";
import { deleteChatNote } from "../services/deleteChatNote";

type Props = {
    myself: UserProps;
    openDeleteNote: boolean;
    setOpenDeleteNote: (value: boolean) => void;
    chatNoteMeta: ChatNoteMetaProps[];
    setChatNoteMeta: (value: ChatNoteMetaProps[]) => void;
    currentChatNote: ChatNoteProps;
    handleCloseTab: (tabIndex: number, closingNoteId: number) => void;
    currentTabIndex: number;
};

export const ModalDeleteChatNote: React.FC<Props> = ({
    myself,
    openDeleteNote,
    setOpenDeleteNote,
    chatNoteMeta,
    setChatNoteMeta,
    currentChatNote,
    handleCloseTab,
    currentTabIndex,
}) => {
    const { accessToken } = useAuth();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const noteService = new NoteService();

    const handleDeleteNote = async () => {
        let childExist: boolean;
        const childNotes = chatNoteMeta.filter(
            (note) => note.parentNoteId === currentChatNote.noteId
        );

        if (childNotes.length === 0) {
            childExist = false;
        } else {
            childExist = true;
        }

        if (childExist === false) {
            // Delete from backend
            await deleteChatNote(myself, currentChatNote.noteId, accessToken);
            // Delete from indexedDB
            await noteService.deleteChatNote(currentChatNote.noteId);
            // Delete the deleted noteId from the meta object
            setChatNoteMeta(chatNoteMeta.filter((note) => note.noteId !== currentChatNote.noteId));
            handleCloseTab(currentTabIndex, currentChatNote.noteId);
            setOpenDeleteNote(false);
            setErrorMessage(null);
        } else {
            setErrorMessage("Can't delete because child note(s) exists.");
        }
    };

    return (
        <>
            <Modal
                open={openDeleteNote}
                sx={{ zIndex: 10010 }}
                onClose={() => {
                    setOpenDeleteNote(false);
                    setErrorMessage(null);
                }}
            >
                <ModalDialog>
                    <Typography level="h4">
                        Are you sure to delete{" "}
                        <Typography color="danger" level="h3">
                            {currentChatNote.title}
                        </Typography>{" "}
                        ?
                    </Typography>
                    {errorMessage && errorMessage !== "" && (
                        <Alert color="danger">{errorMessage}</Alert>
                    )}
                    <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "center" }}>
                        <Button
                            color="neutral"
                            component="button"
                            variant="outlined"
                            onClick={() => {
                                setOpenDeleteNote(false);
                                setErrorMessage(null);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            color="danger"
                            component="button"
                            onClick={() => {
                                handleDeleteNote();
                            }}
                        >
                            Delete
                        </Button>
                    </Stack>
                </ModalDialog>
            </Modal>
        </>
    );
};
