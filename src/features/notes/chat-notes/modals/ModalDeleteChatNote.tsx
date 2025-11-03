import React, { useState } from "react";
import { Alert, Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";

import { useAuth } from "../../../../context/AuthContext";
import { NoteService } from "../../../../db/services/note.service";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { UserProps } from "../../../../types/admin";
import { ChatNoteMetaProps, ChatNoteProps } from "../../../../types/notes";
import { deleteChatNote } from "../services/deleteChatNote";

type Props = {
    myself: UserProps;
    openDeleteNote: boolean;
    setOpenDeleteNote: (value: boolean) => void;
    handleCloseTab: (tabIndex: number, closingNoteId: number) => void;
    NM: NoteManagementState;
};

export const ModalDeleteChatNote: React.FC<Props> = ({
    myself,
    openDeleteNote,
    setOpenDeleteNote,
    handleCloseTab,
    NM,
}) => {
    const { accessToken } = useAuth();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const noteService = new NoteService();

    const handleDeleteNote = async () => {
        let childExist: boolean;
        const childNotes = NM.chatNoteMeta.filter(
            (note) => note.parentNoteId === NM.currentChatNote?.noteId
        );

        if (childNotes.length === 0) {
            childExist = false;
        } else {
            childExist = true;
        }

        if (childExist === false && NM.currentChatNote?.noteId) {
            // Delete from backend
            await deleteChatNote(myself, NM.currentChatNote?.noteId, accessToken);
            // Delete from indexedDB
            await noteService.deleteChatNote(NM.currentChatNote?.noteId);
            // Delete the deleted noteId from the meta object
            NM.setChatNoteMeta(
                NM.chatNoteMeta.filter((note) => note.noteId !== NM.currentChatNote?.noteId)
            );
            handleCloseTab(NM.selectedTabIndex, NM.currentChatNote?.noteId);
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
                            {NM.currentChatNote?.title}
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
