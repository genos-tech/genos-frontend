import React, { useState } from "react";
import { Modal, ModalDialog, Stack, Button, Typography } from "@mui/joy";

import { NoteMetaProps, NoteProps } from "../../../types/notes";
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
    currentNote: NoteProps;
    handleCloseTab: (value: number) => void;
};

export const ModalDeleteNote: React.FC<Props> = ({
    myself,
    openDeleteNote,
    setOpenDeleteNote,
    myNoteMeta,
    setMyNoteMeta,
    currentNote,
    handleCloseTab,
}) => {
    const { accessToken } = useAuth();

    const handleDeleteNote = async () => {
        await deleteNote(myself, currentNote.noteId, accessToken);
        await deleteData({ storeName: STORES.NOTES, key: currentNote.noteId });
        setMyNoteMeta(myNoteMeta.filter((note) => note.noteId !== currentNote.noteId));
        handleCloseTab(currentNote.noteId);
        setOpenDeleteNote(false);
    };

    return (
        <>
            <Modal
                sx={{ zIndex: 10010 }}
                open={openDeleteNote}
                onClose={() => setOpenDeleteNote(false)}
            >
                <ModalDialog>
                    <Typography level="h4">
                        Are you sure to delete{" "}
                        <Typography level="h3" color="danger">
                            {currentNote.title}
                        </Typography>{" "}
                        ?
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "center" }}>
                        <Button
                            component="button"
                            color="neutral"
                            variant="outlined"
                            onClick={() => setOpenDeleteNote(false)}
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
