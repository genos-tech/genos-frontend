import React, { useState } from "react";
import { Alert, Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";

import { useAuth } from "../../../../context/AuthContext";
import { NoteService } from "../../../../db/services/note.service";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { UserProps } from "../../../../types/admin";
import { deleteTaskNote } from "../services/deleteTaskNote";

type Props = {
    myself: UserProps;
    openDeleteNote: boolean;
    setOpenDeleteNote: (value: boolean) => void;
    NM: NoteManagementState;
    handleCloseTab: (tabIndex: number, closingNoteId: number) => void;
};

export const ModalDeleteTaskNote: React.FC<Props> = ({
    myself,
    openDeleteNote,
    setOpenDeleteNote,
    NM,
    handleCloseTab,
}) => {
    const { accessToken } = useAuth();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const noteService = new NoteService();

    const handleDeleteNote = async () => {
        let childExist: boolean;
        const childNotes = NM.taskNoteMeta.filter(
            (note) => note.parentNoteId === NM.currentTaskNote?.noteId
        );

        if (childNotes.length === 0) {
            childExist = false;
        } else {
            childExist = true;
        }

        if (childExist === false) {
            // Delete from backend
            await deleteTaskNote(myself, NM.currentTaskNote?.noteId as number, accessToken);
            // Delete from indexedDB
            await noteService.deleteTaskNote(NM.currentTaskNote?.noteId as number);
            // Delete the deleted noteId from the meta object
            NM.setTaskNoteMeta(
                NM.taskNoteMeta.filter(
                    (note) => note.noteId !== (NM.currentTaskNote?.noteId as number)
                )
            );
            handleCloseTab(NM.selectedTabIndex, NM.currentTaskNote?.noteId as number);
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
                            {NM.currentTaskNote?.title}
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
