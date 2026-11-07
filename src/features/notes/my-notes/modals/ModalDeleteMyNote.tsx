import React, { useState } from "react";
import NoteIcon from "@mui/icons-material/Note";

import { useNoteModalHostZIndex } from "../../../../components/modals/noteModalHostZIndex";
import { ConfirmDialog } from "../../../../components/ui/modal/ConfirmDialog";
import { useAuth } from "../../../../context/AuthContext";
import { NoteService } from "../../../../db/services/note.service";
import { DatabaseUtils } from "../../../../db/utils/database";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
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
    const { t } = useTranslation();
    const hostZIndex = useNoteModalHostZIndex();
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
            // Drop the per-document Yjs IndexedDB (`my-note:<id>`) too —
            // y-indexeddb creates one DB per editor document and never
            // cleans up on its own.
            await DatabaseUtils.deleteYjsDatabase(`my-note:${currentMyNote.noteId}`);
            // Delete the deleted noteId from the meta object
            setMyNoteMeta(myNoteMeta.filter((note) => note.noteId !== currentMyNote.noteId));
            handleCloseTab(currentTabIndex, currentMyNote.noteId);
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
