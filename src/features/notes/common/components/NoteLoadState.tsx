import { Box } from "@mui/joy";

import { DataState } from "../../../../components/ui/feedback/DataState";
import { useTranslation } from "../../../../i18n";

/**
 * What a note editor panel shows until its note has resolved (MIP-1276).
 *
 * A note that failed to open used to leave the pane BLANK for good: the
 * panels returned `null` for "still loading" and for "failed" alike, and
 * `useNoteData`'s `error` was never read. Now a failed open says so and offers
 * Retry. While it is merely loading the panel still renders nothing: the open
 * resolves from the memory cache or IndexedDB in milliseconds, and a skeleton
 * there would flash on every tab switch.
 *
 * The panels stay mounted but hidden (`display: none`) when their tab is not
 * the active one, so the error follows `isActive` like the editor does.
 */
type NoteLoadStateProps = {
    isActive: boolean;
    fillHeight?: boolean;
    isLoading: boolean;
    error: boolean;
    onRetry: () => void;
};

export const NoteLoadState = ({
    isActive,
    fillHeight = false,
    isLoading,
    error,
    onRetry,
}: NoteLoadStateProps) => {
    const { t } = useTranslation();
    if (isLoading || !error) return null;
    return (
        <Box
            sx={{
                display: isActive ? "flex" : "none",
                flexDirection: "column",
                width: "100%",
                ...(fillHeight ? { flex: 1, minHeight: 0 } : { minHeight: 240 }),
            }}
        >
            <DataState
                hasData={false}
                loading={false}
                skeleton={null}
                errorState={{
                    title: t.notes.editor.loadFailed,
                    onRetry,
                    "data-error": "note-editor",
                }}
                error
                fill
            />
        </Box>
    );
};
