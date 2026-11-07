import { memo } from "react";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { IconButton } from "@mui/joy";

import { NavItem } from "../../../../components/ui/nav/NavItem";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { ChatNoteMetaProps, MyNoteMetaProps, TaskNoteMetaProps } from "../../../../types/notes";
import { formatTaskDisplayId } from "../../../tasks/utils/taskDisplayId";
import { useNoteUnread } from "../context/NoteUnreadContext";
import { NoteDot } from "./NoteDot";

interface FavoriteNoteItemProps {
    note: MyNoteMetaProps | TaskNoteMetaProps | ChatNoteMetaProps;
    noteType: number;
    useNM: NoteManagementState;
}

function FavoriteNoteItemComponent({ note, noteType, useNM }: FavoriteNoteItemProps) {
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

    // Check if this specific note is currently selected
    const isSelected =
        useNM.currentNoteType === noteType &&
        note?.noteId ===
            (noteType === 1
                ? useNM.currentMyNote?.noteId
                : noteType === 2
                  ? useNM.currentTaskNote?.noteId
                  : noteType === 3
                    ? useNM.currentChatNote?.noteId
                    : 0);

    const handleClick = () => {
        useNM.setCurrentNoteType(noteType);
        localStorage.setItem("lastOpenNoteType", String(noteType));
        useNM.loadNote(noteType, note.noteId, -1);
        if (hasUnread) markRead(noteType, note.noteId);
    };

    const handleRemoveFavorite = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await useNM.toggleFavorite(note.noteId, noteType);
    };

    // Get additional context based on note type
    const getSubLabel = (): string | null => {
        if (noteType === 2) {
            const taskNote = note as TaskNoteMetaProps;
            // Human-readable task id ("PRJ-123"), not the raw "#123".
            // `formatTaskDisplayId` falls back to "#<taskId>" only when
            // the backend didn't send `displayId` (project without a
            // code / pre-migration row).
            const displayId = formatTaskDisplayId({
                taskId: taskNote.taskId,
                displayId: taskNote.displayId,
            });
            return taskNote.projectName || taskNote.taskTitle
                ? `${taskNote.projectName || ""} ${taskNote.taskTitle ? displayId : ""}`.trim()
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
            icon={<NoteDot unread={hasUnread} />}
            label={note.title || t.notes.defaults.untitled}
            lines={subLabel ? 2 : 1}
            selected={isSelected}
            unread={hasUnread}
            secondary={subLabel}
            // Remove-from-favorites: hover-revealed on desktop, always visible
            // on touch.
            actions={
                <IconButton
                    className="favorite-remove-btn"
                    size="sm"
                    variant="plain"
                    sx={{
                        minWidth: 20,
                        minHeight: 20,
                        borderRadius: g.radius.xs,
                        "--IconButton-size": "20px",
                    }}
                    onClick={handleRemoveFavorite}
                >
                    <StarRoundedIcon sx={{ fontSize: 14, color: g.warning.solid }} />
                </IconButton>
            }
            onClick={handleClick}
        />
    );
}

export const FavoriteNoteItem = memo(FavoriteNoteItemComponent);
