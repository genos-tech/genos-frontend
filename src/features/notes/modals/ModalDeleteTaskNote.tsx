import React, { useState } from "react";
import { Alert, Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";

import { useAuth } from "../../../context/AuthContext";
import { STORES } from "../../../db/conf";
import { deleteData } from "../../../db/crud";
import { UserProps } from "../../../types/admin";
import { TaskNoteMetaProps, TaskNoteProps } from "../../../types/notes";
import { deleteTaskNote } from "../services/deleteTaskNote";

type Props = {
    myself: UserProps;
    openDeleteNote: boolean;
    setOpenDeleteNote: (value: boolean) => void;
    taskNoteMeta: TaskNoteMetaProps[];
    setTaskNoteMeta: (value: TaskNoteMetaProps[]) => void;
    currentTaskNote: TaskNoteProps;
    handleCloseTab: (tabIndex: number, closingNoteId: number) => void;
    currentTabIndex: number;
};

export const ModalDeleteTaskNote: React.FC<Props> = ({
    myself,
    openDeleteNote,
    setOpenDeleteNote,
    taskNoteMeta,
    setTaskNoteMeta,
    currentTaskNote,
    handleCloseTab,
    currentTabIndex,
}) => {
    const { accessToken } = useAuth();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const handleDeleteNote = async () => {
        let childExist: boolean;
        const childNotes = taskNoteMeta.filter(
            (note) => note.parentNoteId === currentTaskNote.noteId
        );

        if (childNotes.length === 0) {
            childExist = false;
        } else {
            childExist = true;
        }

        if (childExist === false) {
            // Delete from backend
            await deleteTaskNote(myself, currentTaskNote.noteId, accessToken);
            // Delete from indexedDB
            await deleteData({
                storeName: STORES.TASK_NOTES,
                key: currentTaskNote.noteId,
            });
            // Delete the deleted noteId from the meta object
            setTaskNoteMeta(taskNoteMeta.filter((note) => note.noteId !== currentTaskNote.noteId));
            handleCloseTab(currentTabIndex, currentTaskNote.noteId);
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
                            {currentTaskNote.title}
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
