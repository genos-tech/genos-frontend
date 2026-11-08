import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import { Box, IconButton } from "@mui/joy";

import { EmptyState } from "../../../../components/ui/feedback/EmptyState";
import { ErrorState } from "../../../../components/ui/feedback/ErrorState";
import { Spinner } from "../../../../components/ui/feedback/Skeleton";
import { useIsMobile } from "../../../../hooks/common/useIsMobile";
import type { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";

/**
 * What the note pane shows when the route (or a click) named a note and nothing
 * opened (MIP-1307), instead of "No Note Selected" as if nothing was asked for.
 *
 *  - a failed request: `ErrorState` with Retry (the toast that said so lasts 8 s;
 *    this stays until it is retried or another note opens),
 *  - a 404: "This note no longer exists" and NO Retry, which could never succeed,
 *  - a Retry in flight: a spinner, so a second failure is not a silent no-op.
 *
 * On a phone the pane has no header of its own to hold a back button, so this
 * brings one (the same one an open note's header has).
 */
type NoteOpenFailureProps = {
    useNM: Pick<NoteManagementState, "noteOpenFailure" | "retryNoteOpen">;
    onMobileBack?: () => void;
};

export const NoteOpenFailure = ({ useNM, onMobileBack }: NoteOpenFailureProps) => {
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const failure = useNM.noteOpenFailure;
    if (!failure) return null;

    return (
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minWidth: 0 }}>
            {isMobile && onMobileBack && (
                <Box sx={{ px: 0.5, py: 0.5, flexShrink: 0 }}>
                    <IconButton
                        aria-label={t.notes.labels.backToNotesList}
                        size="sm"
                        variant="plain"
                        onClick={onMobileBack}
                    >
                        <ArrowBackIosNewRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Box>
            )}
            <Box sx={{ flex: 1, minHeight: 0 }}>
                {failure.retrying ? (
                    <Box
                        sx={{
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Spinner size="md" />
                    </Box>
                ) : failure.reason === "not_found" ? (
                    <EmptyState
                        body={t.notes.placeholder.noteNotFoundBody}
                        data-empty="note-gone"
                        icon={<DescriptionOutlinedIcon />}
                        title={t.notes.placeholder.noteNotFoundTitle}
                        fill
                    />
                ) : (
                    <ErrorState
                        data-error="note-open"
                        title={t.notes.editor.loadFailed}
                        fill
                        onRetry={useNM.retryNoteOpen}
                    />
                )}
            </Box>
        </Box>
    );
};
