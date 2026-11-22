import type React from "react";
import Box from "@mui/joy/Box";

import { useTranslation } from "../../i18n";
import { focusRing, g } from "../../theme/tokens";

/** The id of the signed-in app's routed content. The skip link moves keyboard focus here. */
export const APP_MAIN_ID = "app-main";

/**
 * The first tab stop of the signed-in app (MIP-1829): one Enter jumps past the sidebar to the
 * routed content. Hidden until it has keyboard focus, so mouse and touch users never see it.
 */
export function SkipToContent() {
    const { t } = useTranslation();
    return (
        <Box
            component="a"
            href={`#${APP_MAIN_ID}`}
            sx={{
                position: "fixed",
                top: 8,
                insetInlineStart: 8,
                zIndex: 10000,
                px: 1.5,
                py: 1,
                borderRadius: "6px",
                bgcolor: g.surface.raised,
                color: g.text.primary,
                fontWeight: 600,
                textDecoration: "none",
                boxShadow: "md",
                transform: "translateY(calc(-100% - 16px))",
                "&:focus-visible": { ...focusRing, transform: "none" },
            }}
            // MIP-1928: only move focus. Following the href would push `/path#app-main` onto the
            // history (a wasted Back step) and re-render the app on the location change.
            onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                document.getElementById(APP_MAIN_ID)?.focus();
            }}
        >
            {t.common.skipToContent}
        </Box>
    );
}
