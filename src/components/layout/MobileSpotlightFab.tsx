import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { IconButton } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useIsMobile } from "../../hooks/common/useIsMobile";
import { purplePalette } from "../../theme/purplePalette";

type MobileSpotlightFabProps = {
    onOpenSpotlight: () => void;
};

// Floating action button anchored above the BottomTabBar on mobile so
// the global spotlight overlay is reachable from every workspace
// screen. Desktop reaches the same surface via the Cmd/Ctrl-K shortcut
// (and the search icon in the top sidebar), so this is mobile-only.
export const MobileSpotlightFab = ({ onOpenSpotlight }: MobileSpotlightFabProps) => {
    const isMobile = useIsMobile();
    const { mode } = useColorScheme();
    if (!isMobile) return null;
    const isDark = mode === "dark";
    const accent = isDark ? purplePalette.dark.accent : purplePalette.light.accent;
    const accentRgb = isDark ? purplePalette.dark.accentRgb : purplePalette.light.accentRgb;

    return (
        <IconButton
            aria-label="Search"
            size="lg"
            sx={{
                position: "fixed",
                // 16px gap above the bottom tab bar (60px). Add safe-area
                // so it stays above the home-indicator strip on iPhones.
                bottom: "calc(var(--BottomTabBar-height, 60px) + 16px + env(safe-area-inset-bottom, 0px))",
                right: 16,
                // Above page content (BottomTabBar is 1200) but below
                // MUI Joy Modal (1300) and the SpotlightOverlay (13100).
                zIndex: 1250,
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${accent} 0%, rgba(${accentRgb}, 0.8) 100%)`,
                color: "#fff",
                boxShadow: isDark
                    ? `0 8px 24px rgba(${accentRgb}, 0.333), 0 2px 6px rgba(0,0,0,0.4)`
                    : `0 8px 24px rgba(${accentRgb}, 0.333), 0 2px 6px rgba(0,0,0,0.15)`,
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
                "&:hover": {
                    background: `linear-gradient(135deg, ${accent} 0%, rgba(${accentRgb}, 0.867) 100%)`,
                    transform: "translateY(-2px)",
                    boxShadow: isDark
                        ? `0 12px 28px rgba(${accentRgb}, 0.4), 0 2px 6px rgba(0,0,0,0.5)`
                        : `0 12px 28px rgba(${accentRgb}, 0.4), 0 2px 6px rgba(0,0,0,0.2)`,
                },
                "&:active": {
                    transform: "translateY(0)",
                },
            }}
            onClick={onOpenSpotlight}
        >
            <SearchRoundedIcon sx={{ fontSize: 24 }} />
        </IconButton>
    );
};
