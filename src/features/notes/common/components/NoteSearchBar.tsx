import { useRef } from "react";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import NoteAddRoundedIcon from "@mui/icons-material/NoteAddRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Box, IconButton, Input } from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { useTranslation } from "../../../../i18n";
import { useShortcut } from "../../../../shortcuts";
import { focusRing, g } from "../../../../theme/tokens";

/**
 * The notes sidebar's filter field and its "New note" button (MIP-1431).
 *
 * "/" (the registry's `notes.filter`) focuses the field from anywhere on the page that is not
 * a place you type; Escape clears it, and a second Escape leaves it. The field is controlled: the sidebar decides what to do
 * with the words (see `filterNotesByTitle`).
 */
export const NoteSearchBar = ({
    value,
    onChange,
    onNewNote,
}: {
    value: string;
    onChange: (value: string) => void;
    onNewNote: () => void;
}) => {
    const { t } = useTranslation();
    const input = useRef<HTMLInputElement | null>(null);

    // "/" from anywhere that is not a place you type (the registry skips text fields and the
    // note editor, and ignores Ctrl/Cmd/Alt chords).
    useShortcut("notes.filter", (event) => {
        event.preventDefault();
        input.current?.focus();
    });

    return (
        <Box sx={{ alignItems: "center", display: "flex", gap: 0.5, minWidth: 0 }}>
            <Input
                aria-label={t.notes.sidebar.filterPlaceholder}
                placeholder={t.notes.sidebar.filterPlaceholder}
                size="sm"
                slotProps={{ input: { ref: input, type: "search" } }}
                value={value}
                endDecorator={
                    value ? (
                        <IconButton
                            aria-label={t.notes.sidebar.filterClear}
                            size="sm"
                            sx={{ minWidth: 20, minHeight: 20, "--IconButton-size": "20px" }}
                            variant="plain"
                            onClick={() => {
                                onChange("");
                                input.current?.focus();
                            }}
                        >
                            <ClearRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                    ) : undefined
                }
                startDecorator={
                    <SearchRoundedIcon sx={{ fontSize: 16, color: g.text.tertiary }} />
                }
                sx={{
                    flex: 1,
                    minWidth: 0,
                    "&:focus-within": focusRing,
                    "& input::-webkit-search-cancel-button": { display: "none" },
                }}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key !== "Escape") return;
                    if (value) onChange("");
                    else input.current?.blur();
                }}
            />
            <AppTooltip title={t.notes.list.newNote}>
                <IconButton
                    aria-label={t.notes.list.newNote}
                    size="sm"
                    sx={{ flexShrink: 0 }}
                    variant="soft"
                    onClick={onNewNote}
                >
                    <NoteAddRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </AppTooltip>
        </Box>
    );
};
