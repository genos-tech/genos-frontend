import { keyframes } from "@emotion/react";
import { Box, useColorScheme } from "@mui/joy";

import { DataState } from "../../../../components/ui/feedback/DataState";
import {
    LOADING_INDICATOR_DELAY_MS,
    LoadingIndicator,
} from "../../../../components/ui/misc/LoadingIndicator";
import { useTranslation } from "../../../../i18n";
import { NoteGoneState } from "./NoteGoneState";

/**
 * What a note editor panel shows until its note has resolved (MIP-1276, MIP-1675).
 *
 * A note that failed to open used to leave the pane BLANK for good: the
 * panels returned `null` for "still loading" and for "failed" alike, and
 * `useNoteData`'s `error` was never read. Now a failed open says so and offers
 * Retry.
 *
 * While it is merely loading it used to render nothing at all, because an open
 * usually resolves from the memory cache or IndexedDB in milliseconds and a
 * loader would flash on every tab switch. That left a cold note (one that has
 * to come from the network) with a blank pane for as long as the fetch took
 * (MIP-1675). It now shows the same pulsing dots and caption as the task page
 * ("Loading note…"), but the dots and the caption are held invisible for
 * `LOADING_INDICATOR_DELAY_MS` by the CSS itself (no timer, no state), and the
 * pane does not claim its height until then either, so an open that lands
 * inside the delay never paints or moves anything: the same rule as a task SWITCH.
 *
 * The panels stay mounted but hidden (`display: none`) when their tab is not
 * the active one, so the loader and the error follow `isActive` like the editor does.
 */
type NoteLoadStateProps = {
    isActive: boolean;
    fillHeight?: boolean;
    isLoading: boolean;
    error: boolean;
    /** The API said 404: the note was deleted, so there is no Retry (MIP-1307). */
    notFound?: boolean;
    onRetry: () => void;
};

// The empty pane takes its minimum height only once the dots can be seen: a pane that
// claimed 240px at once would shift whatever sits below it for an open that ends in a frame.
const claimHeight = keyframes`
    from { min-height: 0; }
    to { min-height: 240px; }
`;

export const NoteLoadState = ({
    isActive,
    fillHeight = false,
    isLoading,
    error,
    notFound = false,
    onRetry,
}: NoteLoadStateProps) => {
    const { t } = useTranslation();
    const { mode } = useColorScheme();
    if (isLoading) {
        return (
            <Box
                aria-busy="true"
                aria-label={t.notes.editor.loadingNote}
                role="status"
                sx={{
                    display: isActive ? "flex" : "none",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2.5,
                    width: "100%",
                    ...(fillHeight
                        ? { flex: 1, minHeight: 0 }
                        : {
                              animation: `${claimHeight} 1ms linear ${LOADING_INDICATOR_DELAY_MS}ms both`,
                          }),
                }}
            >
                <LoadingIndicator
                    fadeInDelayMs={LOADING_INDICATOR_DELAY_MS}
                    isDark={mode === "dark"}
                    label={t.notes.editor.loadingNote}
                />
            </Box>
        );
    }
    if (!error) return null;
    return (
        <Box
            sx={{
                display: isActive ? "flex" : "none",
                flexDirection: "column",
                width: "100%",
                ...(fillHeight ? { flex: 1, minHeight: 0 } : { minHeight: 240 }),
            }}
        >
            {notFound ? (
                <NoteGoneState />
            ) : (
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
            )}
        </Box>
    );
};
