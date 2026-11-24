import { useState } from "react";
import { Box } from "@mui/joy";

import { NavItem } from "../../../../components/ui/nav/NavItem";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { ChatNoteMetaProps, MyNoteMetaProps, TaskNoteMetaProps } from "../../../../types/notes";
import { isNoteOpen } from "../utils/openNote";
import { hiddenRecentsCount, visibleRecents } from "../utils/recentNotesLimit";
import { NoteSidebarRowNM } from "./noteSidebarSlices";
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
    activeTab,
    locate,
}: {
    rows: readonly RecentRow[];
    useNM: NoteSidebarRowNM & Partial<Pick<NoteManagementState, "tabsApi">>;
    activeTab?: Parameters<typeof isNoteOpen>[0];
    locate: (noteType: number, note: Meta) => string | null;
}) => {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const hidden = hiddenRecentsCount(rows.length);

    return (
        <Box role="none">
            {visibleRecents(rows, expanded).map((row) => (
                <RecentNoteItem
                    key={`recent-${row.noteType}-${row.note.noteId}`}
                    activeTab={activeTab}
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
                    label={expanded ? t.notes.sidebar.recentsLess : t.notes.sidebar.recentsMore}
                    labelSx={{ fontWeight: 500 }}
                    aria-label={
                        expanded
                            ? t.notes.sidebar.recentsLess
                            : fmt(t.notes.sidebar.recentsMoreAria, { count: hidden })
                    }
                    onClick={() => setExpanded((open) => !open)}
                />
            )}
        </Box>
    );
};
