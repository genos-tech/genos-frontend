import React, { useState } from "react";
import NoteIcon from "@mui/icons-material/Note";

import { useNoteModalHostZIndex } from "../../../../components/modals/noteModalHostZIndex";
import { ConfirmDialog } from "../../../../components/ui/modal/ConfirmDialog";
import { useAuth } from "../../../../context/AuthContext";
import { NoteService } from "../../../../db/services/note.service";
import { DatabaseUtils } from "../../../../db/utils/database";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import { deleteTaskNote } from "../services/deleteTaskNote";

type Props = {
    myself: UserProps;
    openDeleteNote: boolean;
    setOpenDeleteNote: (value: boolean) => void;
    useNM: NoteManagementState;
    handleCloseTab: (tabIndex: number, closingNoteId: number) => void;
};

export const ModalDeleteTaskNote: React.FC<Props> = ({
    myself,
    openDeleteNote,
    setOpenDeleteNote,
    useNM,
    handleCloseTab,
}) => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const hostZIndex = useNoteModalHostZIndex();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const noteService = new NoteService();

    const handleDeleteNote = async () => {
        let childExist: boolean;
        const childNotes = useNM.taskNoteMeta.filter(
            (note) => note.parentNoteId === useNM.currentTaskNote?.noteId
        );

        if (childNotes.length === 0) {
            childExist = false;
        } else {
            childExist = true;
        }

        if (childExist === false) {
            // Delete from backend
            await deleteTaskNote(myself, useNM.currentTaskNote?.noteId as number, accessToken);
            // Delete from indexedDB
            await noteService.deleteTaskNote(useNM.currentTaskNote?.noteId as number);
            // Drop the per-document Yjs IndexedDB (`task-note:<id>`) — y-indexeddb
            // creates one DB per editor document and never cleans up on its own.
            if (useNM.currentTaskNote?.noteId !== undefined) {
                await DatabaseUtils.deleteYjsDatabase(`task-note:${useNM.currentTaskNote.noteId}`);
            }
            // Delete the deleted noteId from the meta object
            useNM.setTaskNoteMeta(
                useNM.taskNoteMeta.filter(
                    (note) => note.noteId !== (useNM.currentTaskNote?.noteId as number)
                )
            );
            handleCloseTab(useNM.selectedTabIndex, useNM.currentTaskNote?.noteId as number);
            setOpenDeleteNote(false);
            setErrorMessage(null);
        } else {
            setErrorMessage(t.notes.deleteModal.childExistsError);
        }
    };

    const close = () => {
        setOpenDeleteNote(false);
        setErrorMessage(null);
    };

    return (
        <ConfirmDialog
            cancelLabel={t.notes.deleteModal.cancel}
            confirmLabel={t.notes.deleteModal.confirm}
            description={t.notes.deleteModal.warning}
            entityName={useNM.currentTaskNote?.title}
            error={errorMessage}
            hostZIndex={hostZIndex}
            icon={<NoteIcon sx={{ color: g.danger.text }} />}
            open={openDeleteNote}
            title={t.notes.deleteModal.title}
            destructive
            onClose={close}
            onConfirm={handleDeleteNote}
        />
    );
};
