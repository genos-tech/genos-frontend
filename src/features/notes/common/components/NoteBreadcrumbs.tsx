import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import { Box, Stack, Tooltip, Typography } from "@mui/joy";

import { useIsMobile } from "../../../../hooks/common/useIsMobile";
import { useTranslation } from "../../../../i18n";
import { collapseCrumbs, DEFAULT_VISIBLE_TAIL } from "../utils/collapseCrumbs";

export interface BreadcrumbNode {
    noteId: number;
    title: string;
}

export interface ContextCrumb {
    /** Stable React key + identity, e.g. "folder-3" / "proj-12" / "chan-7". */
    key: string;
    /** Display text — truncated in the chip, full in the tooltip. */
    label: string;
    /** Leading glyph; NoteBreadcrumbs applies the size/tint so callers
     *  pass the bare icon element (e.g. `<FolderRoundedIcon />`). */
    icon?: ReactNode;
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
    /** Optional container ancestry shown BEFORE the note chain as
     *  non-interactive context labels (outermost-first): sidebar folders
     *  for My notes, Project→Task for task notes, Channel→Thread for chat
     *  notes. */
    contextCrumbs?: ContextCrumb[] | null;
    /** Maximum characters to show before truncating (default: 14) */
    maxTitleLength?: number;
    /** How many trailing crumbs stay visible when the trail is
     *  collapsed — the parent and the current note by default. The root
     *  badge is always shown on top of these. */
    visibleTail?: number;
}

/** One entry in the combined trail. Context crumbs (containers) and note
 *  nodes render differently but collapse as a single sequence: what the
 *  user wants is the last two crumbs regardless of which kind they are,
 *  and a note only one folder deep would otherwise hide its folder while
 *  keeping nothing. */
type TrailItem =
    | { kind: "context"; id: string; crumb: ContextCrumb }
    | { kind: "note"; id: string; node: BreadcrumbNode; isCurrent: boolean };

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
        bg: "linear-gradient(135deg, rgba(var(--gp-tint-danger-rgb), 0.12) 0%, rgba(var(--gp-tint-danger-alt-rgb), 0.08) 100%)",
        iconBg: "linear-gradient(135deg, var(--gp-tint-danger) 0%, var(--gp-tint-danger-alt) 100%)",
        text: "var(--gp-tint-danger-alt)",
        hoverBg: "rgba(var(--gp-tint-danger-rgb), 0.08)",
        activeBg: "rgba(var(--gp-tint-danger-rgb), 0.15)",
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
    contextCrumbs,
    maxTitleLength = 14,
    visibleTail = DEFAULT_VISIBLE_TAIL,
}: NoteBreadcrumbsProps) => {
    const isMobile = useIsMobile();
    const { t } = useTranslation();
    const scheme = colorSchemes[color];
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [expanded, setExpanded] = useState(false);

    // Containers and note nodes collapse as ONE sequence — see
    // `TrailItem`. Built here so the collapse maths never has to know
    // which kind an entry is.
    const trail = useMemo<TrailItem[]>(() => {
        const items: TrailItem[] = [];
        for (const crumb of contextCrumbs ?? []) {
            items.push({ kind: "context", id: `ctx-${crumb.key}`, crumb });
        }
        const chain = noteChain ?? [];
        chain.forEach((node, index) => {
            items.push({
                kind: "note",
                id: `note-${node.noteId}-${index}`,
                node,
                isCurrent: index === chain.length - 1,
            });
        });
        return items;
    }, [contextCrumbs, noteChain]);

    const { hidden, visible } = useMemo(
        () => collapseCrumbs(trail, visibleTail),
        [trail, visibleTail]
    );

    // Auto-scroll to the rightmost position when noteChain changes.
    // Must run before any early return so the hook order is stable across
    // renders (react-hooks/rules-of-hooks) — `isMobile` flipping would
    // otherwise change the hook count and crash React.
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
        }
    }, [noteChain, contextCrumbs, expanded]);

    // Expansion is transient: navigating to another note re-collapses,
    // so the header doesn't stay permanently long after one peek at an
    // unrelated deep note.
    useEffect(() => {
        setExpanded(false);
    }, [noteChain, contextCrumbs]);

    // Hidden on mobile per design — the compact mobile header already
    // shows the current note title; the full breadcrumb trail is
    // desktop chrome that would line-wrap awkwardly at 390px anyway.
    if (isMobile) return null;

    const shown = expanded ? trail : visible;
    const canExpand = hidden.length > 0;

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

            {/* Show-more control, sitting between the root badge and the
                surviving tail so the trail still reads left-to-right
                once expanded. Only rendered when it would actually
                reveal something. */}
            {canExpand && !expanded && (
                <Stack alignItems="center" direction="row" spacing={0.5}>
                    <ChevronRightIcon sx={{ fontSize: 16, color: "neutral.400", opacity: 0.7 }} />
                    <Tooltip
                        placement="bottom"
                        size="sm"
                        variant="outlined"
                        arrow
                        sx={{
                            maxWidth: 280,
                            "& .MuiTooltip-arrow": { color: "background.level2" },
                        }}
                        title={
                            // Names what's behind the control rather than
                            // just counting it — "Documents / Specs / 2026"
                            // tells the user whether it's worth opening.
                            hidden
                                .map((item) =>
                                    item.kind === "context" ? item.crumb.label : item.node.title
                                )
                                .join("  /  ")
                        }
                    >
                        <Typography
                            aria-expanded={false}
                            aria-label={t.notes.header.showHiddenCrumbs.replace(
                                "{count}",
                                String(hidden.length)
                            )}
                            component="button"
                            level="body-sm"
                            sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.25,
                                background: "transparent",
                                border: "none",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontWeight: 600,
                                color: "text.tertiary",
                                transition: "all 0.15s ease-out",
                                "&:hover": {
                                    color: scheme.text,
                                    background: scheme.hoverBg,
                                },
                                "&:focus-visible": {
                                    outline: `2px solid ${scheme.text}`,
                                    outlineOffset: "2px",
                                },
                            }}
                            onClick={() => setExpanded(true)}
                        >
                            <MoreHorizRoundedIcon sx={{ fontSize: 16 }} />
                            <span>{hidden.length}</span>
                        </Typography>
                    </Tooltip>
                </Stack>
            )}

            {/* The trail itself. Context crumbs are non-interactive
                container labels; note nodes are clickable. Both come from
                one collapsed sequence so the "last two crumbs" rule holds
                across the boundary between them. */}
            {shown.map((item) => (
                <Stack key={item.id} alignItems="center" direction="row" spacing={0.5}>
                    <ChevronRightIcon sx={{ fontSize: 16, color: "neutral.400", opacity: 0.7 }} />
                    <Tooltip
                        placement="bottom"
                        size="sm"
                        variant="outlined"
                        arrow
                        sx={{
                            maxWidth: 280,
                            "& .MuiTooltip-arrow": { color: "background.level2" },
                        }}
                        title={item.kind === "context" ? item.crumb.label : item.node.title}
                    >
                        {item.kind === "context" ? (
                            <Box
                                sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    padding: "4px 10px",
                                    borderRadius: "6px",
                                    color: "text.tertiary",
                                    fontWeight: 500,
                                    fontSize: "0.875rem",
                                    lineHeight: 1.43,
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {item.crumb.icon && (
                                    <Box
                                        sx={{
                                            display: "inline-flex",
                                            color: scheme.text,
                                            opacity: 0.65,
                                            "& svg": { fontSize: 15 },
                                        }}
                                    >
                                        {item.crumb.icon}
                                    </Box>
                                )}
                                <span>{truncateTitle(item.crumb.label)}</span>
                            </Box>
                        ) : (
                            <Typography
                                component="button"
                                level="body-sm"
                                sx={{
                                    background: item.isCurrent ? scheme.activeBg : "transparent",
                                    border: "none",
                                    padding: "4px 10px",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    fontWeight: item.isCurrent ? 600 : 500,
                                    color: item.isCurrent ? scheme.text : "text.secondary",
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
                                        "&::before": { opacity: 1 },
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
                                onClick={() => onNodeClick(item.node.noteId)}
                            >
                                <span style={{ position: "relative", zIndex: 1 }}>
                                    {truncateTitle(item.node.title)}
                                </span>
                            </Typography>
                        )}
                    </Tooltip>
                </Stack>
            ))}
        </Stack>
    );
};
