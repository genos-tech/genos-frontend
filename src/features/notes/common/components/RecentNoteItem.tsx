import { memo, MouseEvent } from "react";
import { Typography } from "@mui/joy";

import { NavItem } from "../../../../components/ui/nav/NavItem";
import { NAV_HIDE_ON_ACTIONS_CLASS } from "../../../../components/ui/nav/navStyles";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { ChatNoteMetaProps, MyNoteMetaProps, TaskNoteMetaProps } from "../../../../types/notes";
import { extractYYYYMMDDHHMM } from "../../../../utils/dateUtils";
import { useNoteUnread } from "../context/NoteUnreadContext";
import { isNoteOpen } from "../utils/openNote";
import { NoteFavoriteStar } from "./NoteFavoriteStar";
import { NoteOriginIcon } from "./noteOrigin";
import { NoteUnreadDot } from "./NoteUnreadDot";

interface RecentNoteItemProps {
    note: MyNoteMetaProps | TaskNoteMetaProps | ChatNoteMetaProps;
    noteType: number;
    useNM: NoteManagementState;
    /** When the note was opened (the row's own clock, `tsOpenedAt`). */
    openedAt?: string | null;
    /** "Where it lives" for this note (see `noteLocation`); omitted: no second line. */
    locate?: (noteType: number, note: RecentNoteItemProps["note"]) => string | null;
    /**
     * Called when the row is opened (MIP-1435: the filter results close). `viaKeyboard` is true
     * when the click came from the keyboard (Enter), which has no pointer: `detail` is 0.
     */
    onOpened?: (viaKeyboard: boolean) => void;
}

/**
 * One row of Recents: the note's origin icon, its title, where it lives, and when it was
 * opened (MIP-1429). Recents mixes every kind of note in one list, so the icon and the second
 * line are what tell two notes with the same title apart.
 */
function RecentNoteItemComponent({
    note,
    noteType,
    useNM,
    openedAt,
    locate,
    onOpened,
}: RecentNoteItemProps) {
    const { t } = useTranslation();
    const { isUnread, markRead } = useNoteUnread();
    const hasUnread = isUnread(noteType, note.noteId);

    const isSelected = isNoteOpen(useNM.tabsApi.activeTab, noteType, note.noteId);

    const handleClick = (event: MouseEvent<HTMLElement>) => {
        useNM.setCurrentNoteType(noteType);
        localStorage.setItem("lastOpenNoteType", String(noteType));
        // loadNote internally calls recordNoteOpen on success, which in
        // turn promotes this row to the top of the recents list — so we
        // don't need to call recordNoteOpen ourselves here.
        useNM.loadNote(noteType, note.noteId, -1);
        if (hasUnread) markRead(noteType, note.noteId);
        onOpened?.(event.detail === 0);
    };

    const subLabel = locate?.(noteType, note) ?? null;
    const opened = openedAt ? extractYYYYMMDDHHMM(openedAt) : "";

    return (
        <NavItem
            // The star takes the time's place while the row is hovered or focused, so the row
            // is the same width either way (MIP-1430). A lit star stays beside the time.
            actions={<NoteFavoriteStar noteId={note.noteId} noteType={noteType} useNM={useNM} />}
            as="div"
            icon={<NoteOriginIcon noteType={noteType} />}
            label={note.title || t.notes.defaults.untitled}
            lines={subLabel ? 2 : 1}
            secondary={subLabel}
            selected={isSelected}
            unread={hasUnread}
            trailing={
                opened || hasUnread ? (
                    <>
                        {opened && (
                            <Typography
                                className={NAV_HIDE_ON_ACTIONS_CLASS}
                                level="body-xs"
                                sx={{
                                    color: g.text.tertiary,
                                    whiteSpace: "nowrap",
                                    fontVariantNumeric: "tabular-nums",
                                    mr: hasUnread ? 0.75 : 0,
                                }}
                            >
                                {opened}
                            </Typography>
                        )}
                        {hasUnread && <NoteUnreadDot />}
                    </>
                ) : undefined
            }
            actionsInPlace
            onClick={handleClick}
        />
    );
}

export const RecentNoteItem = memo(RecentNoteItemComponent);
