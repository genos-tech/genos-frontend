import { useState } from "react";
import { Box } from "@mui/joy";

import { NavItem } from "../../../../components/ui/nav/NavItem";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { ChatNoteMetaProps, MyNoteMetaProps, TaskNoteMetaProps } from "../../../../types/notes";
import { hiddenRecentsCount, visibleRecents } from "../utils/recentNotesLimit";
import { RecentNoteItem } from "./RecentNoteItem";

type Meta = MyNoteMetaProps | TaskNoteMetaProps | ChatNoteMetaProps;

export type RecentRow = { note: Meta; noteType: number; tsOpenedAt: string };

/**
 * The rows under the notes sidebar's Recents: the first 8, then a "More" row that shows the rest
 * (up to 20) and becomes "Show less" (MIP-1435). It is the same row the task sidebar's Recents
 * uses for its "More" (a `NavItem`). There is one toggle element for both states, so a keyboard
 * user who collapses the list keeps the focus on it instead of losing it with the rows.
 */
export const RecentNotesList = ({
    rows,
    useNM,
    locate,
}: {
    rows: readonly RecentRow[];
    useNM: NoteManagementState;
    locate: (noteType: number, note: Meta) => string | null;
}) => {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const hidden = hiddenRecentsCount(rows.length);

    return (
        <Box>
            {visibleRecents(rows, expanded).map((row) => (
                <RecentNoteItem
                    key={`recent-${row.noteType}-${row.note.noteId}`}
                    locate={locate}
                    note={row.note}
                    noteType={row.noteType}
                    openedAt={row.tsOpenedAt}
                    useNM={useNM}
                />
            ))}
            {hidden > 0 && (
                <NavItem
                    key="recents-toggle"
                    aria-label={
                        expanded
                            ? t.notes.sidebar.recentsLess
                            : fmt(t.notes.sidebar.recentsMoreAria, { count: hidden })
                    }
                    as="div"
                    label={expanded ? t.notes.sidebar.recentsLess : t.notes.sidebar.recentsMore}
                    labelSx={{ fontWeight: 500 }}
                    onClick={() => setExpanded((open) => !open)}
                />
            )}
        </Box>
    );
};
