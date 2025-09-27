import React, { useState } from "react";
import { Modal, ModalDialog, Stack, Button, Typography, Alert } from "@mui/joy";

import { ChatNoteMetaProps, ChatNoteProps } from "../../../types/notes";
import { deleteChatNote } from "../services/deleteChatNote";
import { deleteData } from "../../../db/crud";
import { STORES } from "../../../db/conf";
import { UserProps } from "../../../types/admin";

import { useAuth } from "../../../context/AuthContext";

type Props = {
    myself: UserProps;
    openDeleteNote: boolean;
    setOpenDeleteNote: (value: boolean) => void;
    chatNoteMeta: ChatNoteMetaProps[];
    setChatNoteMeta: (value: ChatNoteMetaProps[]) => void;
    currentChatNote: ChatNoteProps;
    handleCloseTab: (value: number) => void;
};

export const ModalDeleteChatNote: React.FC<Props> = ({
    myself,
    openDeleteNote,
    setOpenDeleteNote,
    chatNoteMeta,
    setChatNoteMeta,
    currentChatNote,
    handleCloseTab,
}) => {
    const { accessToken } = useAuth();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
            await deleteData({ storeName: STORES.CHAT_NOTES, key: currentChatNote.noteId });
            // Delete the deleted noteId from the meta object
            setChatNoteMeta(chatNoteMeta.filter((note) => note.noteId !== currentChatNote.noteId));
            handleCloseTab(currentChatNote.noteId);
            setOpenDeleteNote(false);
            setErrorMessage(null);
        } else {
            setErrorMessage("Can't delete because child note(s) exists.");
        }
    };

    return (
        <>
            <Modal
                sx={{ zIndex: 10010 }}
                open={openDeleteNote}
                onClose={() => {
                    setOpenDeleteNote(false);
                    setErrorMessage(null);
                }}
            >
                <ModalDialog>
                    <Typography level="h4">
                        Are you sure to delete{" "}
                        <Typography level="h3" color="danger">
                            {currentChatNote.title}
                        </Typography>{" "}
                        ?
                    </Typography>
                    {errorMessage && errorMessage !== "" && (
                        <Alert color="danger">{errorMessage}</Alert>
                    )}
                    <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "center" }}>
                        <Button
                            component="button"
                            color="neutral"
                            variant="outlined"
                            onClick={() => {
                                setOpenDeleteNote(false);
                                setErrorMessage(null);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            component="button"
                            color="danger"
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
