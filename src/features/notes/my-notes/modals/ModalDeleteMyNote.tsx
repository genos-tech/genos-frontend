import React, { useState } from "react";
import { Alert, Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";

import { useAuth } from "../../../../context/AuthContext";
import { STORES } from "../../../../db/conf";
import { NoteService } from "../../../../db/services/note.service";
import { UserProps } from "../../../../types/admin";
import { MyNoteMetaProps, MyNoteProps } from "../../../../types/notes";
import { deleteMyNote } from "../services/deleteMyNote";

type Props = {
    myself: UserProps;
    openDeleteNote: boolean;
    setOpenDeleteNote: (value: boolean) => void;
    myNoteMeta: MyNoteMetaProps[];
    setMyNoteMeta: (value: MyNoteMetaProps[]) => void;
    currentMyNote: MyNoteProps;
    handleCloseTab: (tabIndex: number, closingNoteId: number) => void;
    currentTabIndex: number;
};
export const ModalDeleteMyNote: React.FC<Props> = ({
    myself,
    openDeleteNote,
    setOpenDeleteNote,
    myNoteMeta,
    setMyNoteMeta,
    currentMyNote,
    handleCloseTab,
    currentTabIndex,
}) => {
    const { accessToken } = useAuth();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const noteService = new NoteService();

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
            await deleteMyNote(myself, currentMyNote.noteId, accessToken);
            // Delete from indexedDB
            await noteService.deletePersonalNote(currentMyNote.noteId);
            // Delete the deleted noteId from the meta object
            setMyNoteMeta(myNoteMeta.filter((note) => note.noteId !== currentMyNote.noteId));
            handleCloseTab(currentTabIndex, currentMyNote.noteId);
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
                            {currentMyNote.title}
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
