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
import { deleteChatNote } from "../services/deleteChatNote";

type Props = {
    myself: UserProps;
    openDeleteNote: boolean;
    setOpenDeleteNote: (value: boolean) => void;
    handleCloseTab: (tabIndex: number, closingNoteId: number) => void;
    useNM: NoteManagementState;
};

export const ModalDeleteChatNote: React.FC<Props> = ({
    myself,
    openDeleteNote,
    setOpenDeleteNote,
    handleCloseTab,
    useNM,
}) => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const hostZIndex = useNoteModalHostZIndex();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const noteService = new NoteService();

    const handleDeleteNote = async () => {
        let childExist: boolean;
        const childNotes = useNM.chatNoteMeta.filter(
            (note) => note.parentNoteId === useNM.currentChatNote?.noteId
        );

        if (childNotes.length === 0) {
            childExist = false;
        } else {
            childExist = true;
        }

        if (childExist === false && useNM.currentChatNote?.noteId) {
            // Delete from backend
            await deleteChatNote(myself, useNM.currentChatNote?.noteId, accessToken);
            // Delete from indexedDB
            await noteService.deleteChatNote(useNM.currentChatNote?.noteId);
            // Drop the per-document Yjs IndexedDB (`chat-note:<id>`) — y-indexeddb
            // creates one DB per editor document and never cleans up on its own.
            if (useNM.currentChatNote?.noteId !== undefined) {
                await DatabaseUtils.deleteYjsDatabase(`chat-note:${useNM.currentChatNote.noteId}`);
            }
            // Delete the deleted noteId from the meta object
            useNM.setChatNoteMeta(
                useNM.chatNoteMeta.filter((note) => note.noteId !== useNM.currentChatNote?.noteId)
            );
            handleCloseTab(useNM.selectedTabIndex, useNM.currentChatNote?.noteId);
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
            entityName={useNM.currentChatNote?.title}
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
