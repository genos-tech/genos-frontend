import { ReactNode, useEffect, useRef } from "react";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Box, Stack, Tooltip, Typography } from "@mui/joy";

import { useIsMobile } from "../../../../hooks/common/useIsMobile";

export interface BreadcrumbNode {
    noteId: number;
    title: string;
}

interface NoteBreadcrumbsProps {
    /** Icon element to display at the start */
    icon: ReactNode;
    /** Label text for the root breadcrumb */
    label: string;
    /** Color theme: 'primary' | 'success' | 'warning' | 'danger' | 'neutral' */
    color: "primary" | "success" | "warning" | "danger" | "neutral";
    /** Chain of note nodes to display as breadcrumbs */
    noteChain: BreadcrumbNode[] | null | undefined;
    /** Callback when a breadcrumb node is clicked */
    onNodeClick: (noteId: number) => void;
    /** Maximum characters to show before truncating (default: 14) */
    maxTitleLength?: number;
}

// Static category-color presets. The first three keys (primary/success/
// warning) are FUNCTIONAL carve-outs: each maps to a distinct note category
// (My / Task / Chat) so users tell categories apart by hue at a glance.
// Do NOT collapse these into the unified purple brand palette.
// `danger` uses the palette dangerTint family (purple-pink) and `neutral`
// stays gray — both are presets without a current functional caller.
const colorSchemes = {
    primary: {
        // My Notes — indigo. Harmonized with getNoteTypeColor (NoteHomeContent)
        // and getTypeColor (RecentNoteItem) so all 3 surfaces match.
        bg: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(99,102,241,0.08) 100%)",
        iconBg: "linear-gradient(135deg, #818cf8 0%, #6366f1 100%)",
        text: "#6366f1",
        hoverBg: "rgba(99,102,241,0.08)",
        activeBg: "rgba(99,102,241,0.15)",
    },
    success: {
        // Task Notes — green (functional carve-out).
        bg: "linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(16,185,129,0.08) 100%)",
        iconBg: "linear-gradient(135deg, #22c55e 0%, #10b981 100%)",
        text: "#22c55e",
        hoverBg: "rgba(34,197,94,0.08)",
        activeBg: "rgba(34,197,94,0.15)",
    },
    warning: {
        // Chat Notes — orange (functional carve-out).
        bg: "linear-gradient(135deg, rgba(251,146,60,0.12) 0%, rgba(245,158,11,0.08) 100%)",
        iconBg: "linear-gradient(135deg, #fb923c 0%, #f59e0b 100%)",
        text: "#f59e0b",
        hoverBg: "rgba(251,146,60,0.08)",
        activeBg: "rgba(251,146,60,0.15)",
    },
    danger: {
        // Palette dangerTint family (purple-pink). Currently unused preset.
        bg: "linear-gradient(135deg, rgba(232,121,195,0.12) 0%, rgba(192,38,168,0.08) 100%)",
        iconBg: "linear-gradient(135deg, #e879c3 0%, #c026a8 100%)",
        text: "#c026a8",
        hoverBg: "rgba(232,121,195,0.08)",
        activeBg: "rgba(232,121,195,0.15)",
    },
    neutral: {
        bg: "linear-gradient(135deg, rgba(107,114,128,0.12) 0%, rgba(75,85,99,0.08) 100%)",
        iconBg: "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)",
        text: "#6b7280",
        hoverBg: "rgba(107,114,128,0.08)",
        activeBg: "rgba(107,114,128,0.15)",
    },
};

export const NoteBreadcrumbs = ({
    icon,
    label,
    color,
    noteChain,
    onNodeClick,
    maxTitleLength = 14,
}: NoteBreadcrumbsProps) => {
    const isMobile = useIsMobile();
    const scheme = colorSchemes[color];
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to the rightmost position when noteChain changes.
    // Must run before any early return so the hook order is stable across
    // renders (react-hooks/rules-of-hooks) — `isMobile` flipping would
    // otherwise change the hook count and crash React.
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
        }
    }, [noteChain]);

    // Hidden on mobile per design — the compact mobile header already
    // shows the current note title; the full breadcrumb trail is
    // desktop chrome that would line-wrap awkwardly at 390px anyway.
    if (isMobile) return null;

    const truncateTitle = (title: string) => {
        if (title.length > maxTitleLength) {
            return `${title.slice(0, maxTitleLength)}...`;
        }
        return title;
    };

    return (
        <Stack
            ref={scrollContainerRef}
            alignItems="center"
            direction="row"
            spacing={0.5}
            sx={{
                flexWrap: "nowrap",
                rowGap: 0.5,
                overflowX: "auto",
                overflowY: "hidden",
                whiteSpace: "nowrap",
                scrollbarWidth: "thin",
                scrollbarColor: `${scheme.text} rgba(0,0,0,0.04)`,
                "&::-webkit-scrollbar": {
                    height: "6px",
                },
                "&::-webkit-scrollbar-thumb": {
                    backgroundColor: "rgba(100,116,139,0.18)",
                    borderRadius: "4px",
                },
                "&::-webkit-scrollbar-track": {
                    backgroundColor: "transparent",
                },
                maxWidth: "100%",
            }}
        >
            {/* Root Badge */}
            <Box
                sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.75,
                    px: 1.25,
                    py: 0.5,
                    borderRadius: "8px",
                    background: scheme.bg,
                    backdropFilter: "blur(8px)",
                    border: "1px solid",
                    borderColor: `color-mix(in srgb, ${scheme.text} 20%, transparent)`,
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    "&:hover": {
                        transform: "translateY(-1px)",
                        boxShadow: `0 4px 12px color-mix(in srgb, ${scheme.text} 15%, transparent)`,
                    },
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 22,
                        height: 22,
                        borderRadius: "6px",
                        background: scheme.iconBg,
                        color: "#fff",
                        "& svg": {
                            fontSize: 14,
                        },
                    }}
                >
                    {icon}
                </Box>
                <Typography
                    level="body-sm"
                    sx={{
                        fontWeight: 600,
                        letterSpacing: "-0.01em",
                        color: scheme.text,
                    }}
                >
                    {label}
                </Typography>
            </Box>

            {/* Breadcrumb Chain */}
            {noteChain &&
                noteChain.map((node, index) => {
                    const isLastItem = index === noteChain.length - 1;

                    return (
                        <Stack
                            key={`breadcrumb-${node.noteId}-${index}`}
                            alignItems="center"
                            direction="row"
                            spacing={0.5}
                        >
                            {/* Separator */}
                            <ChevronRightIcon
                                sx={{
                                    fontSize: 16,
                                    color: "neutral.400",
                                    opacity: 0.7,
                                }}
                            />

                            {/* Breadcrumb Item */}
                            <Tooltip
                                placement="bottom"
                                size="sm"
                                title={node.title}
                                variant="outlined"
                                sx={{
                                    maxWidth: 280,
                                    "& .MuiTooltip-arrow": {
                                        color: "background.level2",
                                    },
                                }}
                                arrow
                            >
                                <Typography
                                    component="button"
                                    level="body-sm"
                                    sx={{
                                        background: isLastItem ? scheme.activeBg : "transparent",
                                        border: "none",
                                        padding: "4px 10px",
                                        borderRadius: "6px",
                                        cursor: "pointer",
                                        fontWeight: isLastItem ? 600 : 500,
                                        color: isLastItem ? scheme.text : "text.secondary",
                                        transition: "all 0.15s ease-out",
                                        position: "relative",
                                        overflow: "hidden",
                                        "&::before": {
                                            content: '""',
                                            position: "absolute",
                                            inset: 0,
                                            borderRadius: "6px",
                                            background: scheme.hoverBg,
                                            opacity: 0,
                                            transition: "opacity 0.15s ease-out",
                                        },
                                        "&:hover": {
                                            color: scheme.text,
                                            "&::before": {
                                                opacity: 1,
                                            },
                                        },
                                        "&:active": {
                                            transform: "scale(0.98)",
                                            "&::before": {
                                                background: scheme.activeBg,
                                                opacity: 1,
                                            },
                                        },
                                        "&:focus-visible": {
                                            outline: `2px solid ${scheme.text}`,
                                            outlineOffset: "2px",
                                        },
                                    }}
                                    onClick={() => onNodeClick(node.noteId)}
                                >
                                    <span style={{ position: "relative", zIndex: 1 }}>
                                        {truncateTitle(node.title)}
                                    </span>
                                </Typography>
                            </Tooltip>
                        </Stack>
                    );
                })}
        </Stack>
    );
};
