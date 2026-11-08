import { useMemo } from "react";
import AllInboxRoundedIcon from "@mui/icons-material/AllInboxRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import NoteAltRoundedIcon from "@mui/icons-material/NoteAltRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import { Box, Sheet, Typography } from "@mui/joy";

import { useTranslation } from "../../i18n";
import { g, type } from "../../theme/tokens";
import { isMac } from "../../utils/platform";
import { Clickable } from "../ui/Clickable";

// Visual metadata for the Cmd+Tab–style service switcher overlay. Indexed
// by the same `id` used in `SERVICES_BY_ID` (hooks/common/useGlobalServiceShortcut.ts)
// and `NAV_ITEMS` (components/layout/sidebar.tsx). All three lists must stay
// in sync — order and ids must match.
const OVERLAY_SERVICES: Array<{
    labelKey: "inbox" | "chats" | "tasks" | "notes" | "search" | "todo";
    icon: typeof AllInboxRoundedIcon;
}> = [
    { labelKey: "inbox", icon: AllInboxRoundedIcon },
    { labelKey: "chats", icon: QuestionAnswerRoundedIcon },
    { labelKey: "tasks", icon: AssignmentRoundedIcon },
    { labelKey: "notes", icon: NoteAltRoundedIcon },
    // The Genos page. `search` is the sidebar key that carries the
    // "Genos" label (kept to avoid a cross-locale rename).
    { labelKey: "search", icon: AutoAwesomeRoundedIcon },
    // To-Do (MIP-1044): no page — a stop on it opens the to-do modal. Same
    // icon as the sidebar's To-Do button.
    { labelKey: "todo", icon: ChecklistRoundedIcon },
];

type ServiceSwitcherOverlayProps = {
    /**
     * Position (within `mruOrder`) of the highlighted service, or `null`
     * to hide the overlay. Comes straight from `useGlobalServiceShortcut`.
     */
    previewIndex: number | null;
    /**
     * Service ids in most-recently-used order. The overlay renders tiles
     * left-to-right in this order so the most-recent service is always
     * leftmost (matching macOS Cmd+Tab).
     */
    mruOrder: number[];
    /** The pointer really moved over the tile at this position. */
    onHighlight?: (positionInMru: number) => void;
    /** The tile at this position was clicked. */
    onSelect?: (positionInMru: number) => void;
};

/**
 * macOS Cmd+Tab–style overlay for the global service switcher. The
 * fullscreen layer has `pointer-events: none`, so it never intercepts clicks
 * on the page; only the sheet itself takes the pointer, so its tiles can be
 * hovered and clicked (MIP-1044). Visibility is driven entirely by
 * `previewIndex`.
 */
export const ServiceSwitcherOverlay = ({
    previewIndex,
    mruOrder,
    onHighlight,
    onSelect,
}: ServiceSwitcherOverlayProps) => {
    const { t } = useTranslation();

    // Hint matches the cycle gesture in `useGlobalServiceShortcut`: hold the
    // platform "switcher" modifier (Cmd on mac, Alt elsewhere) and tap Ctrl
    // to advance the highlight.
    const shortcutHint = useMemo(() => {
        return isMac() ? t.layout.serviceSwitcher.hintMac : t.layout.serviceSwitcher.hintOther;
    }, [t.layout.serviceSwitcher.hintMac, t.layout.serviceSwitcher.hintOther]);

    if (previewIndex === null) return null;

    return (
        <Box
            sx={{
                position: "fixed",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 13000,
                pointerEvents: "none",
            }}
            aria-hidden
        >
            {/* An opaque raised card, like every other overlay surface: it floats
                over the page, so it carries the overlay shadow and nothing else
                (no blur, no brand glow). */}
            <Sheet
                variant="plain"
                sx={{
                    pointerEvents: "auto",
                    px: 3,
                    py: 2.5,
                    borderRadius: g.radius.lg,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 1.5,
                    background: g.surface.raised,
                    border: `1px solid ${g.border.default}`,
                    boxShadow: g.shadow.lg,
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                    {mruOrder.map((serviceId, position) => {
                        const service = OVERLAY_SERVICES[serviceId];
                        if (!service) return null;
                        const Icon = service.icon;
                        const isActive = position === previewIndex;
                        return (
                            <Clickable
                                key={serviceId}
                                sx={{
                                    cursor: "pointer",
                                    width: 88,
                                    height: 96,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 0.75,
                                    borderRadius: g.radius.lg,
                                    px: 1,
                                    // The highlight is the shared selected look: the accent's quiet
                                    // tint and hairline, the icon and label in the accent text.
                                    transition: `background-color ${g.motion.fast} ${g.ease}, border-color ${g.motion.fast} ${g.ease}`,
                                    border: "1px solid",
                                    borderColor: isActive ? g.accent.border : "transparent",
                                    background: isActive ? g.accent.subtle : "transparent",
                                    color: isActive ? g.accent.text : g.text.secondary,
                                    "--Icon-color": "currentColor",
                                    "@media (prefers-reduced-motion: reduce)": {
                                        transition: "none",
                                    },
                                }}
                                onActivate={() => onSelect?.(position)}
                                // `mousemove`, not `mouseenter`: the overlay appears under a
                                // pointer that is not moving, and the browser then reports
                                // that pointer as entering a tile, which must not steal the
                                // highlight from the tap that raised it. Only real movement
                                // counts.
                                data-service-tile
                                onMouseMove={(e) => {
                                    if ((e.movementX !== 0 || e.movementY !== 0) && !isActive) {
                                        onHighlight?.(position);
                                    }
                                }}
                            >
                                <Icon sx={{ fontSize: 28 }} />
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        ...type("body-xs"),
                                        fontWeight: isActive ? 600 : 500,
                                        color: "inherit",
                                    }}
                                >
                                    {t.layout.serviceSwitcher[service.labelKey]}
                                </Typography>
                            </Clickable>
                        );
                    })}
                </Box>
                <Typography
                    level="body-xs"
                    sx={{ ...type("body-xs"), fontFamily: g.font.mono, color: g.text.tertiary }}
                >
                    {shortcutHint}
                </Typography>
            </Sheet>
        </Box>
    );
};
