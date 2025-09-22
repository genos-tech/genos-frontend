import React, { useState } from "react";
import { Modal, ModalDialog, Stack, Button, Typography, Alert } from "@mui/joy";

import { NoteMetaProps, MyNoteProps } from "../../../types/notes";
import { deleteNote } from "../services/deleteNote";
import { deleteData } from "../../../db/crud";
import { STORES } from "../../../db/conf";
import { UserProps } from "../../../types/admin";

import { useAuth } from "../../../context/AuthContext";

type Props = {
    myself: UserProps;
    openDeleteNote: boolean;
    setOpenDeleteNote: (value: boolean) => void;
    myNoteMeta: NoteMetaProps[];
    setMyNoteMeta: (value: NoteMetaProps[]) => void;
    currentMyNote: MyNoteProps;
    handleCloseTab: (value: number) => void;
};

export const ModalDeleteMyNote: React.FC<Props> = ({
    myself,
    openDeleteNote,
    setOpenDeleteNote,
    myNoteMeta,
    setMyNoteMeta,
    currentMyNote,
    handleCloseTab,
}) => {
    const { accessToken } = useAuth();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const handleDeleteNote = async () => {
        let childExist: boolean;
        const childNotes = myNoteMeta.filter((note) => note.parentNoteId === currentMyNote.noteId);

        if (childNotes.length === 0) {
            childExist = false;
        } else {
            childExist = true;
        }

        if (childExist === false) {
            // Delete from backend
            await deleteNote(myself, currentMyNote.noteId, accessToken);
            // Delete from indexedDB
            await deleteData({ storeName: STORES.PERSONAL_NOTES, key: currentMyNote.noteId });
            // Delete the deleted noteId from the meta object
            setMyNoteMeta(myNoteMeta.filter((note) => note.noteId !== currentMyNote.noteId));
            handleCloseTab(currentMyNote.noteId);
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
                            {currentMyNote.title}
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
