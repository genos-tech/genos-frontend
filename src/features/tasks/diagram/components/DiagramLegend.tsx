import { useState } from "react";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import { Box, IconButton, Sheet, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Panel } from "@xyflow/react";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { useTranslation } from "../../../../i18n";
import { purplePalette } from "../../../../theme/purplePalette";

// Bottom-left floating legend. Explains the edge grammar:
//   - Solid purple line = parent-child structure
//   - Dashed amber arrow = blocking dependency
// Collapsible so it doesn't compete with the diagram on small
// screens. Sits inside React Flow's <Panel> so it stays pinned to
// the corner during pan/zoom.
export const DiagramLegend = () => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const P = isDark ? purplePalette.dark : purplePalette.light;
    const [open, setOpen] = useState(true);

    return (
        <Panel position="bottom-left" style={{ marginBottom: 12, marginLeft: 12 }}>
            <Sheet
                variant="outlined"
                sx={{
                    background: P.surface,
                    border: `1px solid ${P.border}`,
                    borderRadius: "10px",
                    boxShadow: P.shadowSoft,
                    backdropFilter: "blur(6px)",
                    overflow: "hidden",
                    minWidth: open ? 184 : "auto",
                    transition: "min-width 0.2s ease",
                }}
            >
                <Stack
                    alignItems="center"
                    direction="row"
                    spacing={0.5}
                    sx={{
                        px: 1.25,
                        py: 0.6,
                        cursor: "pointer",
                        background: open ? "transparent" : P.hoverBg,
                        "&:hover": { background: P.hoverBg },
                    }}
                    onClick={() => setOpen((v) => !v)}
                >
                    <HelpOutlineRoundedIcon sx={{ fontSize: 14, color: P.textMuted }} />
                    <Typography
                        level="body-xs"
                        sx={{
                            fontWeight: 700,
                            color: P.textMuted,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            fontSize: "0.65rem",
                            flex: 1,
                        }}
                    >
                        Legend
                    </Typography>
                    <AppTooltip
                        placement="right"
                        title={
                            open
                                ? t.tasks.diagram.tooltips.collapse
                                : t.tasks.diagram.tooltips.expand
                        }
                    >
                        <IconButton
                            size="sm"
                            variant="plain"
                            sx={{
                                "--IconButton-size": "18px",
                                color: P.textMuted,
                                opacity: 0.7,
                            }}
                        >
                            <Typography
                                level="body-xs"
                                sx={{ fontSize: "0.65rem", lineHeight: 1 }}
                            >
                                {open ? "−" : "+"}
                            </Typography>
                        </IconButton>
                    </AppTooltip>
                </Stack>
                {open && (
                    <Stack
                        spacing={0.5}
                        sx={{ px: 1.25, py: 0.75, borderTop: `1px solid ${P.border}` }}
                    >
                        <Stack alignItems="center" direction="row" spacing={0.75}>
                            <Box
                                sx={{
                                    width: 28,
                                    height: 2,
                                    background: "#7c3aed",
                                    borderRadius: 1,
                                    flexShrink: 0,
                                }}
                                aria-hidden
                            />
                            <Typography
                                level="body-xs"
                                sx={{ color: P.text, fontWeight: 500, fontSize: "0.7rem" }}
                            >
                                Parent → Child
                            </Typography>
                        </Stack>
                        <Stack alignItems="center" direction="row" spacing={0.75}>
                            <Box
                                sx={{
                                    width: 22,
                                    height: 0,
                                    borderTop: "2px dashed #f97316",
                                    flexShrink: 0,
                                }}
                                aria-hidden
                            />
                            <Typography
                                sx={{ color: "#f97316", fontWeight: 700, lineHeight: 1 }}
                                aria-hidden
                            >
                                ▸
                            </Typography>
                            <Typography
                                level="body-xs"
                                sx={{ color: P.text, fontWeight: 500, fontSize: "0.7rem" }}
                            >
                                Blocks
                            </Typography>
                        </Stack>
                        <Stack alignItems="center" direction="row" spacing={0.75}>
                            <Box
                                sx={{
                                    width: 28,
                                    border: `1px dashed ${P.textMuted}`,
                                    height: 8,
                                    opacity: 0.7,
                                    borderRadius: "2px",
                                    flexShrink: 0,
                                }}
                                aria-hidden
                            />
                            <Typography
                                level="body-xs"
                                sx={{ color: P.text, fontWeight: 500, fontSize: "0.7rem" }}
                            >
                                External task
                            </Typography>
                        </Stack>
                    </Stack>
                )}
            </Sheet>
        </Panel>
    );
};
