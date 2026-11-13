import React, { useState } from "react";
import NoteIcon from "@mui/icons-material/Note";

import { useNoteModalHostZIndex } from "../../../../components/modals/noteModalHostZIndex";
import { ConfirmDialog } from "../../../../components/ui/modal/ConfirmDialog";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { MyNoteProps } from "../../../../types/notes";

type Props = {
    openDeleteNote: boolean;
    setOpenDeleteNote: (value: boolean) => void;
    currentMyNote: MyNoteProps;
    useNM: NoteManagementState;
};
export const ModalDeleteMyNote: React.FC<Props> = ({
    openDeleteNote,
    setOpenDeleteNote,
    currentMyNote,
    useNM,
}) => {
    const { t } = useTranslation();
    const hostZIndex = useNoteModalHostZIndex();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // The note may be a My, Shared or Team note (all of them open through here), so the
    // cleanup is not this modal's to know: `deleteMyNoteById` deletes on the server and then
    // takes the note out of every list, cache, tab and history (MIP-1435).
    const handleDeleteNote = async () => {
        const hasChildren = [useNM.myNoteMeta, useNM.teamNoteMeta, useNM.sharedNoteMeta].some(
            (rows) => rows.some((note) => note.parentNoteId === currentMyNote.noteId)
        );
        if (hasChildren) {
            setErrorMessage(t.notes.deleteModal.childExistsError);
            return;
        }
        if (await useNM.deleteMyNoteById(currentMyNote.noteId)) {
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
            entityName={currentMyNote.title}
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
