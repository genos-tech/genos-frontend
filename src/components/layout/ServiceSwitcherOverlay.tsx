import { useMemo } from "react";
import AllInboxRoundedIcon from "@mui/icons-material/AllInboxRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import NoteAltRoundedIcon from "@mui/icons-material/NoteAltRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import { Box, Sheet, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { getServiceShortcutModifierKeys } from "../../utils/platform";

// Visual metadata for the Cmd+Tab–style service switcher overlay. Indexed
// by the same `id` used in `SERVICES_BY_ID` (hooks/common/useGlobalServiceShortcut.ts)
// and `NAV_ITEMS` (components/layout/sidebar.tsx). All three lists must stay
// in sync — order and ids must match.
const OVERLAY_SERVICES: Array<{ label: string; icon: typeof AllInboxRoundedIcon }> = [
    { label: "Inbox", icon: AllInboxRoundedIcon },
    { label: "Chats", icon: QuestionAnswerRoundedIcon },
    { label: "Tasks", icon: AssignmentRoundedIcon },
    { label: "Notes", icon: NoteAltRoundedIcon },
];

type ServiceSwitcherOverlayProps = {
    /**
     * Index of the highlighted service, or `null` to hide the overlay.
     * Comes straight from `useGlobalServiceShortcut`'s returned state.
     */
    previewIndex: number | null;
};

/**
 * macOS Cmd+Tab–style overlay for the global service switcher. Rendered
 * fullscreen with `pointer-events: none`, so it never intercepts clicks;
 * visibility is driven entirely by `previewIndex`.
 */
export const ServiceSwitcherOverlay = ({ previewIndex }: ServiceSwitcherOverlayProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const shortcutHint = useMemo(
        () => [...getServiceShortcutModifierKeys(), "← / →"].join(" + "),
        []
    );

    if (previewIndex === null) return null;

    const accent = isDark ? "#a78bfa" : "#7c3aed";

    return (
        <Box
            aria-hidden
            sx={{
                position: "fixed",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 13000,
                pointerEvents: "none",
            }}
        >
            <Sheet
                variant="soft"
                sx={{
                    px: 3,
                    py: 2.5,
                    borderRadius: "20px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 1.5,
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",
                    background: isDark ? "rgba(28, 28, 32, 0.78)" : "rgba(248, 248, 252, 0.82)",
                    border: "1px solid",
                    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                    boxShadow: isDark
                        ? "0 24px 60px rgba(0,0,0,0.55)"
                        : "0 24px 60px rgba(15,15,30,0.18)",
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                    {OVERLAY_SERVICES.map((service, idx) => {
                        const Icon = service.icon;
                        const isActive = idx === previewIndex;
                        return (
                            <Box
                                key={service.label}
                                sx={{
                                    width: 88,
                                    height: 96,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 0.75,
                                    borderRadius: "16px",
                                    px: 1,
                                    transition: "background 0.15s ease, border-color 0.15s ease",
                                    border: "1.5px solid",
                                    borderColor: isActive
                                        ? isDark
                                            ? `${accent}80`
                                            : `${accent}70`
                                        : "transparent",
                                    background: isActive
                                        ? isDark
                                            ? `linear-gradient(135deg, ${accent}30 0%, ${accent}18 100%)`
                                            : `linear-gradient(135deg, ${accent}22 0%, ${accent}12 100%)`
                                        : "transparent",
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: "14px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: isActive
                                            ? isDark
                                                ? `linear-gradient(135deg, ${accent}35 0%, ${accent}20 100%)`
                                                : `linear-gradient(135deg, ${accent}28 0%, ${accent}15 100%)`
                                            : isDark
                                              ? "rgba(255,255,255,0.06)"
                                              : "rgba(0,0,0,0.04)",
                                    }}
                                >
                                    <Icon
                                        sx={{
                                            fontSize: 28,
                                            color: isActive
                                                ? accent
                                                : isDark
                                                  ? "rgba(255,255,255,0.55)"
                                                  : "rgba(0,0,0,0.5)",
                                        }}
                                    />
                                </Box>
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        fontWeight: isActive ? 700 : 500,
                                        color: isActive
                                            ? accent
                                            : isDark
                                              ? "rgba(255,255,255,0.65)"
                                              : "rgba(0,0,0,0.6)",
                                    }}
                                >
                                    {service.label}
                                </Typography>
                            </Box>
                        );
                    })}
                </Box>
                <Typography
                    level="body-xs"
                    sx={{
                        fontFamily: "monospace",
                        opacity: 0.65,
                        color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)",
                    }}
                >
                    {shortcutHint}
                </Typography>
            </Sheet>
        </Box>
    );
};
