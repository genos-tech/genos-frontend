import { memo } from "react";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { IconButton } from "@mui/joy";

import { NavItem } from "../../../../components/ui/nav/NavItem";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { ChatNoteMetaProps, MyNoteMetaProps, TaskNoteMetaProps } from "../../../../types/notes";
import { useNoteUnread } from "../context/noteUnreadState";
import { isHtmlNote } from "../utils/htmlNote";
import { isNoteOpen } from "../utils/openNote";
import { HtmlNoteChipFor } from "./HtmlNoteChip";
import { NoteKindIcon } from "./noteOrigin";
import { NoteUnreadDot } from "./NoteUnreadDot";

interface FavoriteNoteItemProps {
    note: MyNoteMetaProps | TaskNoteMetaProps | ChatNoteMetaProps;
    noteType: number;
    useNM: NoteManagementState;
    /** Where the note lives, without its space's own name (the group above already says it). */
    locate?: (noteType: number, note: FavoriteNoteItemProps["note"]) => string | null;
}

/**
 * One favorite. Favorites are grouped under a header that carries the family's icon, so the
 * row wears the same document glyph as a note in the tree, and its second line names the
 * place inside that family (a folder, a task, a chat) (MIP-1429).
 */
function FavoriteNoteItemComponent({ note, noteType, useNM, locate }: FavoriteNoteItemProps) {
    const { t } = useTranslation();
    const { isUnread, markRead } = useNoteUnread();
    const hasUnread = isUnread(noteType, note.noteId);

    const isSelected = isNoteOpen(useNM.tabsApi.activeTab, noteType, note.noteId);

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

    const subLabel = locate?.(noteType, note) ?? null;
    // The HTML chip (MIP-2316) sits before the unread dot; the title truncates before both.
    const trailing =
        isHtmlNote(note) || hasUnread ? (
            <>
                <HtmlNoteChipFor note={note} />
                {hasUnread && <NoteUnreadDot />}
            </>
        ) : undefined;

    return (
        <NavItem
            icon={<NoteKindIcon note={note} />}
            label={note.title || t.notes.defaults.untitled}
            lines={subLabel ? 2 : 1}
            secondary={subLabel}
            selected={isSelected}
            trailing={trailing}
            unread={hasUnread}
            // Remove-from-favorites: hover-revealed on desktop, always visible
            // on touch.
            actions={
                <IconButton
                    aria-label={t.notes.sidebar.removeFromFavorites}
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
