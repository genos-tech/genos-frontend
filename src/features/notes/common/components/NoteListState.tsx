import { Box } from "@mui/joy";

import { DataState } from "../../../../components/ui/feedback/DataState";
import { SkeletonRows } from "../../../../components/ui/feedback/Skeleton";
import { useTranslation } from "../../../../i18n";
import { useSyncFailure, type NoteListScope } from "../../../../services/syncStatus";

/**
 * The empty branch of a notes sidebar list (MIP-1323). "No favorites yet" is a claim
 * about the user's notes; when the read behind the list failed, nothing checked it, so
 * the branch says it could not load, with Retry (the app-wide sync retry re-reads the
 * lists). `hasAny` is "the list holds something": a list that has rows never shows
 * the error (a failed poll keeps what is on screen), and a list emptied by a filter
 * is the caller's empty state, not this.
 *
 * `body` is the empty text; without it a list that was not read yet draws nothing
 * (as before), and only a failure draws.
 */
export const NoteListState = ({
    scope,
    hasAny,
    body,
    action,
    emptyMarker,
}: {
    scope: NoteListScope;
    hasAny: boolean;
    body?: string;
    /** The way out of the empty list, as a link at the end of its line (MIP-1430). */
    action?: { label: string; onClick: () => void };
    emptyMarker: string;
}) => {
    const { t } = useTranslation();
    const sync = useSyncFailure(`notes:${scope}`);
    return (
        <Box sx={{ px: 2 }}>
            <DataState
                error={sync.failed && !hasAny}
                hasData={false}
                loading={sync.retrying && !hasAny}
                size="xs"
                skeleton={<SkeletonRows count={3} />}
                empty={
                    body
                        ? {
                              body,
                              "data-empty": emptyMarker,
                              action: action && { ...action, inline: true },
                          }
                        : undefined
                }
                errorState={{
                    "data-error": `note-${scope}`,
                    onRetry: sync.retry,
                    title: t.common.feedback.sync.notesFailed,
                }}
            />
        </Box>
    );
};
