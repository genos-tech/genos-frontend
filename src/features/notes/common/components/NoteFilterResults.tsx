import { KeyboardEvent, Ref } from "react";
import { Box, List } from "@mui/joy";

import { EmptyState } from "../../../../components/ui/feedback/EmptyState";
import { SectionHeader } from "../../../../components/ui/nav/SectionHeader";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { ChatNoteMetaProps, MyNoteMetaProps, TaskNoteMetaProps } from "../../../../types/notes";
import { NoteFilterHit } from "../utils/filterNotes";
import { RecentNoteItem } from "./RecentNoteItem";

type Meta = MyNoteMetaProps | TaskNoteMetaProps | ChatNoteMetaProps;

/**
 * The flat list the notes sidebar shows while its filter has words (MIP-1431): one row per
 * matching note, the "where it lives" line, "No match" and "N more". Opening a row calls
 * `onOpened` (MIP-1435: the list closes); Escape on a row is `onKeyDown`'s.
 */
export const NoteFilterResults = ({
    result,
    query,
    useNM,
    locate,
    listRef,
    onOpened,
    onKeyDown,
}: {
    result: { hits: NoteFilterHit<Meta>[]; total: number };
    query: string;
    useNM: NoteManagementState;
    locate: (noteType: number, note: Meta) => string | null;
    listRef: Ref<HTMLUListElement>;
    onOpened: (viaKeyboard: boolean) => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}) => {
    const { t } = useTranslation();
    return (
        <List
            ref={listRef}
            data-testid="note-filter-results"
            size="sm"
            sx={{ gap: 0.5, "--ListItem-radius": "8px" }}
            onKeyDown={onKeyDown}
        >
            <SectionHeader
                as="li"
                label={fmt(t.notes.sidebar.filterResults, { count: result.total })}
            />
            {result.hits.map(({ noteType, note }) => (
                <RecentNoteItem
                    key={`filter-${noteType}-${note.noteId}`}
                    locate={locate}
                    note={note}
                    noteType={noteType}
                    useNM={useNM}
                    onOpened={onOpened}
                />
            ))}
            {result.total === 0 && (
                <Box sx={{ px: 1.5 }}>
                    <EmptyState
                        data-empty="note-filter"
                        size="xs"
                        body={fmt(t.notes.sidebar.filterNoMatch, { query: query.trim() })}
                    />
                </Box>
            )}
            {result.total > result.hits.length && (
                <Box sx={{ px: 1.5 }}>
                    <EmptyState
                        size="xs"
                        body={fmt(t.notes.sidebar.filterMore, {
                            count: result.total - result.hits.length,
                        })}
                    />
                </Box>
            )}
        </List>
    );
};
