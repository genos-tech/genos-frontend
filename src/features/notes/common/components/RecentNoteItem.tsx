import { memo } from "react";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import WindowRoundedIcon from "@mui/icons-material/WindowRounded";

import { NavItem } from "../../../../components/ui/nav/NavItem";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { ChatNoteMetaProps, MyNoteMetaProps, TaskNoteMetaProps } from "../../../../types/notes";
import { useNoteUnread } from "../context/NoteUnreadContext";
import { isPersonalNoteBucket } from "../utils/noteTypeAlias";

interface RecentNoteItemProps {
    note: MyNoteMetaProps | TaskNoteMetaProps | ChatNoteMetaProps;
    noteType: number;
    useNM: NoteManagementState;
}

function getTypeIcon(noteType: number) {
    switch (noteType) {
        case 1:
            return <WindowRoundedIcon />;
        case 2:
            return <AssignmentRoundedIcon />;
        case 3:
            return <QuestionAnswerRoundedIcon />;
        // Sidebar buckets over note_type 1 — they need their own glyphs
        // or every shared / team note reads as a My note.
        case 4:
            return <ShareRoundedIcon />;
        case 8:
            return <GroupsRoundedIcon />;
        default:
            return null;
    }
}

function RecentNoteItemComponent({ note, noteType, useNM }: RecentNoteItemProps) {
    const { t } = useTranslation();
    const { isUnread, markRead } = useNoteUnread();
    const hasUnread = isUnread(noteType, note.noteId);

    const getChatTypeLabel = (chatType: number): string => {
        switch (chatType) {
            case 1:
                return t.notes.chatTypes.dm;
            case 2:
                return t.notes.chatTypes.gm;
            case 3:
                return t.notes.chatTypes.pm;
            default:
                return t.notes.chatTypes.chat;
        }
    };

    const isSelected =
        useNM.currentNoteType === noteType &&
        note?.noteId ===
            (noteType === 2
                ? useNM.currentTaskNote?.noteId
                : noteType === 3
                  ? useNM.currentChatNote?.noteId
                  : // 1, 4 and 8 all ride the currentMyNote slot.
                    isPersonalNoteBucket(noteType)
                    ? useNM.currentMyNote?.noteId
                    : 0);

    const handleClick = () => {
        useNM.setCurrentNoteType(noteType);
        localStorage.setItem("lastOpenNoteType", String(noteType));
        // loadNote internally calls recordNoteOpen on success, which in
        // turn promotes this row to the top of the recents list — so we
        // don't need to call recordNoteOpen ourselves here.
        useNM.loadNote(noteType, note.noteId, -1);
        if (hasUnread) markRead(noteType, note.noteId);
    };

    // Per-type sub-label so the user can distinguish identically-titled
    // notes across different tasks / chats. Personal notes have no
    // additional context.
    const getSubLabel = (): string | null => {
        if (noteType === 2) {
            const taskNote = note as TaskNoteMetaProps;
            return taskNote.projectName || taskNote.taskTitle
                ? `${taskNote.projectName || ""} ${taskNote.taskTitle ? `#${taskNote.taskId}` : ""}`.trim()
                : null;
        }
        if (noteType === 3) {
            const chatNote = note as ChatNoteMetaProps;
            return chatNote.chatTypeName || getChatTypeLabel(chatNote.chatType);
        }
        return null;
    };

    const subLabel = getSubLabel();

    return (
        <NavItem
            as="div"
            icon={getTypeIcon(noteType)}
            label={note.title || t.notes.defaults.untitled}
            lines={subLabel ? 2 : 1}
            secondary={subLabel}
            selected={isSelected}
            unread={hasUnread}
            onClick={handleClick}
        />
    );
}

export const RecentNoteItem = memo(RecentNoteItemComponent);
