import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Box, IconButton, Stack } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useTranslation } from "../../i18n";

type MobileOverlayProps = {
    children: React.ReactNode;
    onClose: () => void;
};

/**
 * Full-screen shell for the mobile panes that have no URL of their own —
 * task preview, create-task form, task notes. Reserves the bottom strip
 * (`--mobile-bottom-inset`) so nothing sits under the tab bar or the
 * keyboard.
 *
 * Two decisions carry the height budget, and both were bugs before:
 *
 * 1. **Close is a flex item in a real header row**, not an absolutely
 *    positioned floater. The floating version had to be kept clear of the
 *    content with a `pt: 5` spacer, i.e. 40px of blank strip above every
 *    pane, and content still passed underneath it while scrolling.
 *
 * 2. **The overlay adds no padding and no scroller of its own.** It hands
 *    `children` a bare flex column. A pane that fills the height (the task
 *    preview, whose Sheet already owns `overflowY: auto`) then gets all of
 *    it; a pane that doesn't brings its own scrolling wrapper. The old
 *    shell wrapped everything in a scroller AND each call site added a
 *    second one, so the preview rendered as a short card — pinned by its
 *    desktop `minHeight: 500` — inside a tall empty overlay.
 *
 * `MobileChatHome` and `MobileNoteHome` still carry their own older copies
 * of this shell. Folding them in is a deliberate follow-up: it changes the
 * layout of surfaces (chat notes, the note-page task preview) beyond the
 * one this was written for, and there's no browser here to check them.
 */
export const MobileOverlay = ({ children, onClose }: MobileOverlayProps) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    return (
        <Box
            sx={{
                position: "fixed",
                inset: 0,
                zIndex: 1300,
                background: isDark
                    ? "linear-gradient(180deg, rgba(var(--gp-dark-surface-b-rgb), 1) 0%, rgba(11,10,22,1) 100%)"
                    : "linear-gradient(180deg, rgba(252,250,255,1) 0%, rgba(248,245,255,1) 100%)",
                display: "flex",
                flexDirection: "column",
                paddingBottom: "var(--mobile-bottom-inset, 60px)",
            }}
        >
            <Stack
                direction="row"
                sx={{
                    alignItems: "center",
                    justifyContent: "flex-end",
                    px: 0.5,
                    py: 0.5,
                    flexShrink: 0,
                    borderBottom: "1px solid",
                    borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                }}
            >
                <IconButton
                    aria-label={t.layout.mobile.close}
                    size="sm"
                    variant="plain"
                    sx={{
                        borderRadius: "10px",
                        background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                        "&:hover": {
                            background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
                        },
                    }}
                    onClick={onClose}
                >
                    <CloseRoundedIcon sx={{ fontSize: 20 }} />
                </IconButton>
            </Stack>
            <Box
                data-testid="mobile-overlay-body"
                sx={{
                    flex: 1,
                    minHeight: 0,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {children}
            </Box>
        </Box>
    );
};
