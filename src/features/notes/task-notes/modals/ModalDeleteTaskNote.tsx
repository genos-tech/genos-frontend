import React, { useState } from "react";
import NoteIcon from "@mui/icons-material/Note";

import { useNoteModalHostZIndex } from "../../../../components/modals/noteModalHostZIndex";
import { ConfirmDialog } from "../../../../components/ui/modal/ConfirmDialog";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";

type Props = {
    openDeleteNote: boolean;
    setOpenDeleteNote: (value: boolean) => void;
    useNM: NoteManagementState;
};

export const ModalDeleteTaskNote: React.FC<Props> = ({
    openDeleteNote,
    setOpenDeleteNote,
    useNM,
}) => {
    const { t } = useTranslation();
    const hostZIndex = useNoteModalHostZIndex();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // `deleteTaskNoteById` deletes on the server and then takes the note out of every list,
    // cache, tab and history (MIP-1435).
    const handleDeleteNote = async () => {
        const noteId = useNM.currentTaskNote?.noteId;
        if (noteId === undefined) return;
        if (useNM.taskNoteMeta.some((note) => note.parentNoteId === noteId)) {
            setErrorMessage(t.notes.deleteModal.childExistsError);
            return;
        }
        if (await useNM.deleteTaskNoteById(noteId)) {
            setOpenDeleteNote(false);
            setErrorMessage(null);
        } else {
            setErrorMessage(t.notes.deleteModal.failed);
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
