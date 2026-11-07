import React from "react";
import NoteIcon from "@mui/icons-material/Note";

import { ConfirmDialog } from "../../../../components/ui/modal/ConfirmDialog";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";

type Props = {
    open: boolean;
    /** Title of the note being deleted (shown in the confirmation). */
    noteTitle: string;
    /**
     * True when the note still has child notes. Deletion is blocked in
     * that case (same guard as the note-header delete) — Confirm is
     * disabled and the "child note(s) exist" message is shown.
     */
    hasChildren: boolean;
    onClose: () => void;
    onConfirm: () => void;
};

// Shared confirm dialog for deleting a note straight from the sidebar
// "⋯" row menu (my / task / chat), so the user doesn't have to open the
// note first. Purely presentational — the parent owns `open`/`hasChildren`
// and runs the actual delete in `onConfirm`. Built on the same
// `ConfirmDialog` as the per-note ModalDelete*Note dialogs of the note header.
export const ModalDeleteNote: React.FC<Props> = ({
    open,
    noteTitle,
    hasChildren,
    onClose,
    onConfirm,
}) => {
    const { t } = useTranslation();

    const handleConfirm = () => {
        if (hasChildren) return;
        onConfirm();
    };

    // Child-note guard: the same message the note-header delete shows after
    // the click, shown up front here so Confirm is disabled instead.
    return (
        <ConfirmDialog
            cancelLabel={t.notes.deleteModal.cancel}
            confirmDisabled={hasChildren}
            confirmLabel={t.notes.deleteModal.confirm}
            description={t.notes.deleteModal.warning}
            entityName={noteTitle}
            error={hasChildren ? t.notes.deleteModal.childExistsError : null}
            icon={<NoteIcon sx={{ color: g.danger.text }} />}
            open={open}
            title={t.notes.deleteModal.title}
            closeOnConfirm
            destructive
            onClose={onClose}
            onConfirm={handleConfirm}
        />
    );
};
