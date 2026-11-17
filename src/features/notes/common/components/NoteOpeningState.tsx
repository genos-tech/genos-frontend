import { keyframes } from "@emotion/react";
import { Box, useColorScheme } from "@mui/joy";

import {
    LOADING_INDICATOR_DELAY_MS,
    LoadingIndicator,
} from "../../../../components/ui/misc/LoadingIndicator";
import { useTranslation } from "../../../../i18n";

/**
 * What the notes pane shows while a note is being fetched and has no tab yet (MIP-1675).
 *
 * `loadNote` asks IndexedDB first and, on a miss, waits for the network BEFORE it opens the tab. For
 * that whole time nothing in the pane changed: with no note open it said "No Note Selected", with
 * another note open it kept showing that note, and either way a click looked as if it did nothing.
 *
 * Same loader as the task page ("Loading note…"), and the same rule as a task SWITCH: it is held
 * invisible for `LOADING_INDICATOR_DELAY_MS` by the CSS itself (no timer, no state), so a note that
 * arrives inside the delay paints and covers nothing.
 *
 * - `overlay`: another note is open, so this is laid over the editor area only (the tab strip above
 *   stays usable). Its whole surface fades in after the delay, and only then takes clicks
 *   (`visibility`), so until then the open note stays visible and editable. Nothing is unmounted:
 *   the live editors under it keep their state.
 * - not `overlay`: nothing is open, so this takes the place of "No Note Selected" (which is untrue
 *   while a note is opening); the dots and caption fade in after the delay.
 */
type NoteOpeningStateProps = {
    overlay?: boolean;
};

const reveal = keyframes`
    from { opacity: 0; visibility: hidden; }
    to { opacity: 1; visibility: visible; }
`;

export const NoteOpeningState = ({ overlay = false }: NoteOpeningStateProps) => {
    const { t } = useTranslation();
    const { mode } = useColorScheme();
    const label = t.notes.editor.loadingNote;
    return (
        <Box
            aria-busy="true"
            aria-label={label}
            data-note-opening={overlay ? "overlay" : "pane"}
            role="status"
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2.5,
                width: "100%",
                minHeight: 240,
                ...(overlay
                    ? {
                          position: "absolute",
                          inset: 0,
                          // Above the editor's own title row (z-index 100), below dialogs and toasts.
                          zIndex: 110,
                          background: "var(--editor-bg)",
                          animation: `${reveal} 0.2s ease-out ${LOADING_INDICATOR_DELAY_MS}ms both`,
                          "@media (prefers-reduced-motion: reduce)": {
                              animation: `${reveal} 1ms linear ${LOADING_INDICATOR_DELAY_MS}ms both`,
                          },
                      }
                    : { flex: 1, height: "100%" }),
            }}
        >
            <LoadingIndicator
                fadeInDelayMs={overlay ? undefined : LOADING_INDICATOR_DELAY_MS}
                isDark={mode === "dark"}
                label={label}
            />
        </Box>
    );
};
