/* eslint-disable react-refresh/only-export-components -- a page entry, nothing imports it */
/**
 * The page `SettingsSidewaysScrollMIP2599.test.ts` loads: a column of labelled Joy checkboxes as in
 * Chat's "Message actions" card (importing `SettingsModal` itself would pull in the whole app) and
 * the REAL "Pause notifications" section, each in a box as narrow as the Settings panel is on that
 * screen, with the app's global CSS (`App.css` holds the checkbox rule), no backend.
 */
import "@fontsource-variable/geist/index.css";
import "../../index.css";
import "../../App.css";

import { Box, Checkbox, Sheet, Stack } from "@mui/joy";
import { createRoot } from "react-dom/client";

import { I18nProvider } from "../../i18n";
import { NotificationPauseSection } from "../../services/notifications/NotificationPausePicker";
import { ColorThemeProvider } from "../../theme/ColorThemeProvider";

const noop = () => {};
const PAUSE = {
    isPausedNow: false,
    snoozeUntil: null,
    snoozeSchedule: { enabled: true, start: "17:00", end: "09:00" },
    pauseFor: noop,
    pauseUntilTomorrow: noop,
    pauseUntilNextWeek: noop,
    pauseUntil: noop,
    resume: noop,
    setSchedule: noop,
};

// 332px is the panel's width inside the dialog on a 390px phone, 670px on a 1440px screen.
const width = window.innerWidth < 600 ? 332 : 670;

const Panel = ({ id, children }: { id: string; children: React.ReactNode }) => (
    <Box data-panel={id} sx={{ width, overflowX: "auto", mx: "auto", mb: 2 }}>
        {children}
    </Box>
);

createRoot(document.getElementById("root")!).render(
    <ColorThemeProvider>
        <I18nProvider>
            <Panel id="chat">
                <Sheet sx={{ p: 2, borderRadius: "lg" }} variant="outlined">
                    <Stack spacing={1}>
                        {["Reply in thread", "Copy message link", "Flag for later"].map(
                            (label) => (
                                <Checkbox key={label} label={label} size="sm" />
                            )
                        )}
                    </Stack>
                </Sheet>
            </Panel>
            <Panel id="notifications">
                <Box sx={{ border: "1px solid", borderRadius: "lg", p: 2 }}>
                    <NotificationPauseSection pause={PAUSE} />
                </Box>
            </Panel>
            <Box sx={{ p: 4 }}>
                <Checkbox data-testid="bare" slotProps={{ input: { "aria-label": "bare" } }} />
            </Box>
        </I18nProvider>
    </ColorThemeProvider>
);
