import { memo, useEffect, useSyncExternalStore } from "react";
import { Box, Sheet } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useIsMobile } from "../../hooks/common/useIsMobile";
import { useTranslation } from "../../i18n";
import {
    getServiceSwitchTarget,
    listenForServicePopState,
    subscribeServiceSwitch,
} from "../../services/serviceSwitch/serviceSwitchStore";
import { LOADING_INDICATOR_DELAY_MS, LoadingIndicator } from "../ui/misc/LoadingIndicator";
import { LayoutStyles } from "../ui/styles/commonStyle";

// Above every Home's content, below the mobile tab bar (1200), the install
// banner (1199 sits above it on purpose), the Spotlight FAB (1250) and the
// modals (1300).
const LOADER_Z_INDEX = 1100;

const LoaderSurface = () => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const isDark = mode === "dark";
    const ls = isDark ? LayoutStyles.dark : LayoutStyles.light;
    const label = t.app.serviceSwitch.loading;

    return (
        <Sheet
            aria-busy="true"
            aria-label={label}
            role="status"
            sx={{
                // The Homes' own surface, so the swap to the real Home reads as
                // the same page filling in.
                ...ls.serviceSurface,
                // Covers the content area and nothing else: the rail (desktop)
                // and the tab bar (mobile) stay visible and clickable, and a
                // click on them replaces the target. Logical properties so the
                // Arabic layout, where the rail is on the right, is covered too.
                position: "fixed",
                top: 0,
                bottom: isMobile ? "var(--BottomTabBar-height, 60px)" : 0,
                insetInlineStart: isMobile ? 0 : "var(--Sidebar-width, 68px)",
                insetInlineEnd: 0,
                zIndex: LOADER_Z_INDEX,
                alignItems: "center",
                justifyContent: "center",
                gap: 2.5,
            }}
        >
            {/* The surface is there on the first frame; only the dots and the
                caption wait 150ms (CSS, so it holds while the main thread is
                busy), so a switch that lands at once never flashes them. */}
            <LoadingIndicator
                fadeInDelayMs={LOADING_INDICATOR_DELAY_MS}
                isDark={isDark}
                label={label}
            />
        </Sheet>
    );
};

/**
 * The "Loading data…" page for a service switch (MIP-965). Mounted once beside
 * the other app-level overlays. It is the ONLY subscriber to the switch store,
 * and takes no props, so nothing else re-renders when it appears or goes. It
 * never takes focus.
 */
export const ServiceSwitchLoader = memo(function ServiceSwitchLoader() {
    const target = useSyncExternalStore(
        subscribeServiceSwitch,
        getServiceSwitchTarget,
        getServiceSwitchTarget
    );
    // Back / Forward: best effort, see `listenForServicePopState`.
    useEffect(() => listenForServicePopState(), []);
    return target === null ? null : <LoaderSurface />;
});
