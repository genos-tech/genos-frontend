import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import { Box, IconButton } from "@mui/joy";
import type { Socket } from "socket.io-client";

import { ErrorState } from "../../../../components/ui/feedback/ErrorState";
import { Spinner } from "../../../../components/ui/feedback/Skeleton";
import { useIsMobile } from "../../../../hooks/common/useIsMobile";
import type { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { toBackendNoteType } from "../utils/noteTypeAlias";
import { NoteAccessRequestPanel } from "./NoteAccessRequestPanel";
import { NoteGoneState } from "./NoteGoneState";

/**
 * What the note pane shows when the route (or a click) named a note and nothing
 * opened (MIP-1307), instead of "No Note Selected" as if nothing was asked for.
 *
 *  - a failed request: `ErrorState` with Retry (the toast that said so lasts 8 s;
 *    this stays until it is retried or another note opens),
 *  - a 404: "This note no longer exists" and NO Retry, which could never succeed,
 *  - a Retry in flight: a spinner, so a second failure is not a silent no-op,
 *  - a 403: the note exists and the user has no role on it (the shared-URL case), so the
 *    access-request panel. A tab's editor panel shows it for a note that was read; none
 *    opens for one that was not, which is this case (MIP-1330).
 *
 * On a phone the pane has no header of its own to hold a back button, so this
 * brings one (the same one an open note's header has).
 */
type NoteOpenFailureProps = {
    useNM: Pick<NoteManagementState, "noteOpenFailure" | "retryNoteOpen">;
    onMobileBack?: () => void;
    /** Carries the access request of a 403. */
    socket?: Socket | null;
};

export const NoteOpenFailure = ({ useNM, onMobileBack, socket = null }: NoteOpenFailureProps) => {
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
                    <NoteGoneState />
                ) : failure.reason === "forbidden" ? (
                    <NoteAccessRequestPanel
                        // A new note is a new request ("sent" must not carry over).
                        key={`${failure.noteType}-${failure.noteId}`}
                        noteId={failure.noteId}
                        // Shared (4) and team (8) notes live in note type 1 on the backend.
                        noteType={toBackendNoteType(failure.noteType)}
                        socket={socket}
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
