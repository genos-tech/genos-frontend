/**
 * Design system review page (MIP-1106, P1): /workspace/design
 *
 * Renders the proposed tokens and components so the direction can be
 * judged BEFORE anything in the app changes. Nothing else uses `--g-*`
 * yet. Reachable by URL only (no nav entry), lazy-loaded, behind the
 * workspace auth guard. English only: an internal review surface, not a
 * user-facing screen, so its copy is not in the 7 locales.
 *
 * Preview controls set `data-g-theme` / `data-g-mode` on this page's
 * wrapper, which the token stylesheet matches, so any theme can be viewed
 * without touching the user's saved theme. Inside the wrapper the Joy
 * palette variables are re-pointed at the tokens (`joyBridge`), which is
 * also how P2 will wire Joy to them.
 */

import { ReactNode, useMemo, useState } from "react";
import AddRounded from "@mui/icons-material/AddRounded";
import AssignmentRounded from "@mui/icons-material/AssignmentRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import ChatRounded from "@mui/icons-material/ChatRounded";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import EditNoteRounded from "@mui/icons-material/EditNoteRounded";
import FilterListRounded from "@mui/icons-material/FilterListRounded";
import InboxRounded from "@mui/icons-material/InboxRounded";
import MoreHorizRounded from "@mui/icons-material/MoreHorizRounded";
import Box from "@mui/joy/Box";
import JoyButton from "@mui/joy/Button";
import { useColorScheme } from "@mui/joy/styles";

import { Bubble, BubbleAuthor, BubbleMeta } from "../../components/ui/bubble";
import { EmptyState } from "../../components/ui/feedback/EmptyState";
import { SkeletonRows, Spinner } from "../../components/ui/feedback/Skeleton";
import { TabStrip } from "../../components/ui/feedback/TabStrip";
import { toast } from "../../components/ui/feedback/toastStore";
import { NavItem } from "../../components/ui/nav/NavItem";
import { SectionHeader } from "../../components/ui/nav/SectionHeader";
import { useColorTheme } from "../../theme/ColorThemeProvider";
import { DENSITIES } from "../../theme/density";
import { THEME_IDS, ThemeId } from "../../theme/themePalettes";
import { focusRing, g, type, TYPE_SCALE, TypeLevel } from "../../theme/tokens";
import { composite, contrast } from "../../theme/tokens/color";
import { alphaCss, buildRoles, Mode, RoleColors } from "../../theme/tokens/roles";
import { MOTION, RADIUS, ROW } from "../../theme/tokens/scales";
import { PRIORITY_NAMES, STATUS_NAMES } from "../tasks/meta/taskTone";
import {
    Avatar,
    Button,
    FilterChip,
    Input,
    Panel,
    PriorityIcon,
    SampleTask,
    StatusLabel,
    Tag,
    TaskRow,
    Text,
} from "./samples";
import { TailwindSample } from "./TailwindSample";
import { TaskCardSamples } from "./TaskCardSamples";

/** The accent each theme renders with. It doesn't depend on mode, and the
 *  picker would otherwise rebuild every theme's roles on each click. */
const SWATCH: Record<ThemeId, string> = Object.fromEntries(
    THEME_IDS.map((id) => [id, buildRoles(id, "light").accent])
) as Record<ThemeId, string>;

const themeName = (id: ThemeId) => id.charAt(0).toUpperCase() + id.slice(1);

/** Joy's palette variables, re-pointed at the tokens. A custom property is
 *  resolved where it is DECLARED, so every element that sets its own
 *  `data-g-theme` (the page and each matrix cell) must declare these again;
 *  inheriting them would hand a teal cell the page's purple. */
const joyBridge = (mode: Mode) => ({
    "--joy-palette-text-primary": g.text.primary,
    "--joy-palette-text-secondary": g.text.secondary,
    "--joy-palette-text-tertiary": g.text.tertiary,
    "--joy-palette-background-body": g.bg.default,
    "--joy-palette-background-surface": g.surface.default,
    "--joy-palette-background-popup": g.surface.raised,
    "--joy-palette-divider": g.border.subtle,
    "--joy-palette-focusVisible": g.focus,
    "--joy-palette-neutral-outlinedBorder": g.border.default,
    "--joy-fontFamily-body": g.font.body,
    "--joy-fontFamily-display": g.font.body,
    fontFamily: g.font.body,
    // Native scrollbars and form controls follow the previewed mode.
    colorScheme: mode,
    color: g.text.primary,
    background: g.bg.default,
});

const TASKS: SampleTask[] = [
    {
        id: "GEN-201",
        title: "UI & UX full improvement",
        status: "WIP",
        assignee: "Ken Kamiya",
        priority: "Critical",
        tags: [{ label: "UI&UX", color: "#8b5cf6" }],
    },
    {
        id: "GEN-202",
        title: "Wire Joy theme to the design tokens",
        status: "Open",
        assignee: "Ken Kamiya",
        tags: [{ label: "frontend", color: "#3b82f6" }],
    },
    {
        id: "GEN-203",
        title: "OAuth consent screen copy",
        status: "Blocked",
        assignee: "(DY) Ken Kamiya",
        priority: "High",
    },
    {
        id: "GEN-204",
        title: "Weekly digest: one prompt per run",
        status: "Pending",
        assignee: "Genos",
    },
    {
        id: "GEN-205",
        title: "Note comments over MCP",
        status: "Closed",
        assignee: "Ken Kamiya",
        tags: [{ label: "mcp", color: "#10b981" }],
    },
];

// ---------------------------------------------------------------------------
// Layout pieces
// ---------------------------------------------------------------------------

const Section = ({
    title,
    intro,
    children,
}: {
    title: string;
    intro?: string;
    children: ReactNode;
}) => (
    <Box
        component="section"
        sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            py: 4,
            borderTop: `1px solid ${g.border.subtle}`,
        }}
    >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, maxWidth: 640 }}>
            <Text component="h2" level="h3" sx={{ textWrap: "balance" }}>
                {title}
            </Text>
            {intro && (
                <Text component="p" level="body-md" tone="secondary">
                    {intro}
                </Text>
            )}
        </Box>
        {children}
    </Box>
);

const Segmented = <T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: T;
    options: { id: T; label: string }[];
    onChange: (v: T) => void;
}) => (
    <Box
        aria-label={label}
        role="group"
        sx={{
            display: "inline-flex",
            p: 0.25,
            gap: 0.25,
            borderRadius: g.radius.sm,
            background: g.bg.subtle,
            border: `1px solid ${g.border.subtle}`,
        }}
    >
        {options.map((o) => (
            <Box
                key={o.id}
                aria-pressed={value === o.id}
                component="button"
                type="button"
                sx={{
                    ...type("body-sm"),
                    fontFamily: "inherit",
                    fontWeight: 500,
                    height: 24,
                    px: 1,
                    border: 0,
                    borderRadius: "4px",
                    cursor: "pointer",
                    color: value === o.id ? g.text.primary : g.text.secondary,
                    background: value === o.id ? g.surface.default : "transparent",
                    boxShadow: value === o.id ? g.shadow.sm : "none",
                    "&:focus-visible": focusRing,
                }}
                onClick={() => onChange(o.id)}
            >
                {o.label}
            </Box>
        ))}
    </Box>
);

const ThemePicker = ({ value, onChange }: { value: ThemeId; onChange: (id: ThemeId) => void }) => (
    <Box
        aria-label="Color theme"
        role="group"
        sx={{ display: "inline-flex", gap: 0.75, alignItems: "center" }}
    >
        {THEME_IDS.map((id) => (
            <Box
                key={id}
                aria-label={themeName(id)}
                aria-pressed={value === id}
                component="button"
                title={themeName(id)}
                type="button"
                sx={{
                    width: 22,
                    height: 22,
                    p: 0,
                    borderRadius: g.radius.full,
                    cursor: "pointer",
                    border: 0,
                    background: SWATCH[id],
                    boxShadow:
                        value === id
                            ? `0 0 0 2px ${g.bg.default}, 0 0 0 4px ${g.text.primary}`
                            : `inset 0 0 0 1px rgba(0,0,0,0.12)`,
                    "&:focus-visible": focusRing,
                }}
                onClick={() => onChange(id)}
            />
        ))}
    </Box>
);

// ---------------------------------------------------------------------------
// The theme matrix: the same slice of Genos in every theme and mode
// ---------------------------------------------------------------------------

const MiniSlice = ({ id, mode }: { id: ThemeId; mode: Mode }) => (
    <Box
        data-g-mode={mode}
        data-g-theme={id}
        sx={{
            ...joyBridge(mode),
            border: `1px solid ${g.border.default}`,
            borderRadius: g.radius.md,
            overflow: "hidden",
            display: "grid",
            gridTemplateColumns: "124px minmax(0, 1fr)",
            minWidth: 0,
        }}
    >
        <Box
            sx={{
                background: g.bg.subtle,
                borderInlineEnd: `1px solid ${g.border.subtle}`,
                p: 0.75,
                display: "flex",
                flexDirection: "column",
                gap: 0.25,
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    px: 0.5,
                    pb: 0.75,
                }}
            >
                <Text level="title-sm">{themeName(id)}</Text>
            </Box>
            <NavItem as="div" icon={<AssignmentRounded />} label="Tasks" selected />
            <NavItem as="div" count={3} icon={<ChatRounded />} label="Chats" />
            <NavItem as="div" icon={<EditNoteRounded />} label="Notes" />
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    px: 1.5,
                    height: 40,
                    borderBottom: `1px solid ${g.border.subtle}`,
                }}
            >
                <Text level="body-xs" tone="tertiary">
                    {mode === "light" ? "Light" : "Dark"}
                </Text>
                <Button icon={<AddRounded />} size="sm" variant="primary">
                    Task
                </Button>
            </Box>
            <Box sx={{ background: g.surface.default, flex: 1 }}>
                {TASKS.slice(0, 3).map((t, i) => (
                    <TaskRow key={t.id} hovered={i === 1} task={t} compactColumns />
                ))}
            </Box>
        </Box>
    </Box>
);

const ThemeMatrix = () => (
    <Box
        sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
            gap: 1.5,
        }}
    >
        {THEME_IDS.flatMap((id) =>
            (["light", "dark"] as Mode[]).map((mode) => (
                <MiniSlice key={`${id}-${mode}`} id={id} mode={mode} />
            ))
        )}
    </Box>
);

// ---------------------------------------------------------------------------
// Color roles
// ---------------------------------------------------------------------------

type RoleRow = {
    name: string;
    value: string;
    paint: string;
    use: string;
    ratio?: number;
    min?: number;
};

const roleRows = (r: RoleColors): { group: string; rows: RoleRow[] }[] => {
    const surfaces = [r.bg, r.bgSubtle, r.surface, r.surfaceRaised];
    // The same backdrops designTokens.test checks, so the page can't show a
    // better figure than the test enforces.
    const onSurface = (c: string) => Math.min(...surfaces.map((s) => contrast(c, s)));
    const onSelected = (c: string) =>
        Math.min(
            ...surfaces.map((s) => contrast(c, composite(r.accentSubtle.hex, r.accentSubtle.a, s)))
        );
    const a = (x: { hex: string; a: number }) => alphaCss(x);
    return [
        {
            group: "Surfaces",
            rows: [
                { name: "bg", value: r.bg, paint: r.bg, use: "Page canvas" },
                {
                    name: "bg-subtle",
                    value: r.bgSubtle,
                    paint: r.bgSubtle,
                    use: "Sidebars, rails, insets",
                },
                {
                    name: "surface",
                    value: r.surface,
                    paint: r.surface,
                    use: "Tables, cards, inputs",
                },
                {
                    name: "surface-raised",
                    value: r.surfaceRaised,
                    paint: r.surfaceRaised,
                    use: "Menus, popovers, modals",
                },
            ],
        },
        {
            group: "Text",
            rows: [
                {
                    name: "text",
                    value: r.text,
                    paint: r.text,
                    use: "Titles, body",
                    ratio: onSurface(r.text),
                    min: 4.5,
                },
                {
                    name: "text-secondary",
                    value: r.textSecondary,
                    paint: r.textSecondary,
                    use: "Labels, descriptions",
                    ratio: onSurface(r.textSecondary),
                    min: 4.5,
                },
                {
                    name: "text-tertiary",
                    value: r.textTertiary,
                    paint: r.textTertiary,
                    use: "IDs, timestamps, placeholders",
                    ratio: onSurface(r.textTertiary),
                    min: 3,
                },
                {
                    name: "text-disabled",
                    value: r.textDisabled,
                    paint: r.textDisabled,
                    use: "Disabled controls only",
                },
            ],
        },
        {
            group: "Lines and fills",
            rows: [
                {
                    name: "border-subtle",
                    value: a(r.borderSubtle),
                    paint: a(r.borderSubtle),
                    use: "Row dividers",
                },
                {
                    name: "border",
                    value: a(r.border),
                    paint: a(r.border),
                    use: "Inputs, cards, chips",
                },
                {
                    name: "border-strong",
                    value: a(r.borderStrong),
                    paint: a(r.borderStrong),
                    use: "Hovered inputs, separators that must show",
                },
                {
                    name: "hover",
                    value: a(r.hover),
                    paint: a(r.hover),
                    use: "Hovered rows and items",
                },
                { name: "active", value: a(r.active), paint: a(r.active), use: "Pressed items" },
            ],
        },
        {
            group: "Accent",
            rows: [
                {
                    name: "accent",
                    value: r.accent,
                    paint: r.accent,
                    use: "Solid fills (white text passes AA)",
                    ratio: contrast(r.accentFg, r.accent),
                    min: 4.5,
                },
                {
                    name: "accent-text",
                    value: r.accentText,
                    paint: r.accentText,
                    use: "Links, selected labels, icons",
                    ratio: Math.min(onSurface(r.accentText), onSelected(r.accentText)),
                    min: 4.5,
                },
                {
                    name: "link",
                    value: r.link,
                    paint: r.link,
                    use: "Links, quote bars and code ink in chat bubbles and comments",
                    ratio: onSurface(r.link),
                    min: 4.5,
                },
                {
                    name: "text-quote",
                    value: r.textQuote,
                    paint: r.textQuote,
                    use: "Quoted text in a bubble (link-visited and link-hover sit beside link)",
                    ratio: onSurface(r.textQuote),
                    min: 4.5,
                },
                {
                    name: "text-code",
                    value: r.codeInk,
                    paint: r.codeInk,
                    use: "Inline code in a chat bubble, over the active wash (dark: 7.4:1 on every bubble fill)",
                    ratio: onSurface(r.codeInk),
                    min: 4.5,
                },
                {
                    name: "accent-subtle",
                    value: a(r.accentSubtle),
                    paint: a(r.accentSubtle),
                    use: "Selected row, selected nav",
                },
                {
                    name: "brand-gradient",
                    value: "primary button, Genos",
                    paint: r.brandGradient,
                    use: "The only gradient left",
                },
            ],
        },
        {
            group: "Status (the same on every theme)",
            rows: (["danger", "success", "warning", "info"] as const).map((k) => ({
                name: k,
                value: r[k].text,
                // The swatch is the color the value and ratio describe: the
                // hue as text. The solid fill is shown in the Buttons sample.
                paint: r[k].text,
                use: {
                    danger: "Errors, destructive actions, overdue",
                    success: "Done, saved, connected",
                    warning: "At risk, in progress",
                    info: "Neutral notices, open",
                }[k],
                ratio: onSurface(r[k].text),
                min: 4.5,
            })),
        },
    ];
};

const ColorRoles = ({ roles }: { roles: RoleColors }) => {
    const rows = useMemo(() => roleRows(roles), [roles]);
    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 420px), 1fr))",
                gap: 1.5,
            }}
        >
            {rows.map(({ group, rows: groupRows }) => (
                <Panel key={group}>
                    <Box
                        sx={{
                            px: 1.5,
                            py: 1,
                            borderBottom: `1px solid ${g.border.subtle}`,
                            background: g.bg.subtle,
                        }}
                    >
                        <Text component="h3" level="title-sm">
                            {group}
                        </Text>
                    </Box>
                    {groupRows.map((row) => (
                        <Box
                            key={row.name}
                            sx={{
                                display: "grid",
                                gridTemplateColumns: "28px minmax(0, 1fr) auto",
                                alignItems: "center",
                                gap: 1.25,
                                px: 1.5,
                                py: 0.875,
                                borderBottom: `1px solid ${g.border.subtle}`,
                                "&:last-of-type": { borderBottom: 0 },
                            }}
                        >
                            <Box
                                sx={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: g.radius.sm,
                                    background: row.paint,
                                    boxShadow: `inset 0 0 0 1px ${g.border.default}`,
                                }}
                            />
                            <Box sx={{ minWidth: 0 }}>
                                <Text
                                    level="body-sm"
                                    sx={{ fontWeight: 500, fontFamily: g.font.mono, fontSize: 12 }}
                                    translate="no"
                                >
                                    --g-{row.name}
                                </Text>
                                <Text level="body-xs" tone="secondary">
                                    {row.use}
                                </Text>
                            </Box>
                            <Box sx={{ textAlign: "end" }}>
                                <Text
                                    level="body-xs"
                                    sx={{ fontFamily: g.font.mono, fontSize: 11 }}
                                    tone="tertiary"
                                >
                                    {row.value}
                                </Text>
                                {row.ratio !== undefined && (
                                    <Text
                                        level="caption"
                                        sx={{
                                            color:
                                                row.ratio >= (row.min ?? 4.5)
                                                    ? g.success.text
                                                    : g.danger.text,
                                            fontVariantNumeric: "tabular-nums",
                                        }}
                                    >
                                        {row.ratio.toFixed(1)}:1
                                    </Text>
                                )}
                            </Box>
                        </Box>
                    ))}
                </Panel>
            ))}
        </Box>
    );
};

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------

const TYPE_SAMPLES: Partial<Record<TypeLevel, [string, string]>> = {
    h1: ["Plan the week", "今週の計画"],
    h2: ["Design system", "デザインシステム"],
    h3: ["Sprint 42", "スプリント 42"],
    h4: ["Project settings", "プロジェクト設定"],
    "title-lg": ["Wire Joy to the tokens", "Joy をトークンに接続"],
    "title-md": ["Ken Kamiya", "神谷 健太郎"],
    "title-sm": ["Assignee", "担当者"],
    "body-lg": ["Long-form reading, like a note.", "ノートのような長文。"],
    "body-md": [
        "Messages and task descriptions read at this size.",
        "メッセージとタスクの説明はこのサイズ。",
    ],
    "body-sm": [
        "The default for lists, tables and sidebars.",
        "リスト、テーブル、サイドバーの既定。",
    ],
    "body-xs": ["Secondary details and table meta.", "補足とテーブルのメタ情報。"],
    caption: ["Counts and timestamps", "件数と時刻"],
};

const TypeScale = () => (
    <Panel>
        {(Object.keys(TYPE_SCALE) as TypeLevel[]).map((level) => {
            const s = TYPE_SCALE[level];
            const [en, ja] = TYPE_SAMPLES[level] ?? ["", ""];
            return (
                <Box
                    key={level}
                    sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", sm: "120px minmax(0, 1fr)" },
                        gap: { xs: 0.5, sm: 2 },
                        alignItems: "baseline",
                        px: 2,
                        py: 1.25,
                        borderBottom: `1px solid ${g.border.subtle}`,
                        "&:last-of-type": { borderBottom: 0 },
                    }}
                >
                    <Box>
                        <Text level="body-sm" sx={{ fontWeight: 500 }}>
                            {level}
                        </Text>
                        <Text
                            level="body-xs"
                            sx={{ fontVariantNumeric: "tabular-nums" }}
                            tone="tertiary"
                        >
                            {s.size}/{s.line}, {s.weight}
                        </Text>
                    </Box>
                    <Box
                        sx={{
                            minWidth: 0,
                            display: "flex",
                            flexWrap: "wrap",
                            columnGap: 2.5,
                            rowGap: 0.25,
                        }}
                    >
                        <Text level={level}>{en}</Text>
                        <Text level={level} tone="secondary">
                            {ja}
                        </Text>
                    </Box>
                </Box>
            );
        })}
    </Panel>
);

// ---------------------------------------------------------------------------
// Shape, depth, motion
// ---------------------------------------------------------------------------

const ShapeAndDepth = () => (
    <Box
        sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
            gap: 1.5,
        }}
    >
        <Panel sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Text level="title-sm">Radius by size</Text>
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "flex-end" }}>
                {(Object.entries(RADIUS) as [keyof typeof RADIUS, number][]).map(([k, v]) => (
                    <Box
                        key={k}
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 0.5,
                        }}
                    >
                        <Box
                            sx={{
                                width: 44,
                                height: 44,
                                borderRadius: `${Math.min(v, 22)}px`,
                                background: g.bg.subtle,
                                border: `1px solid ${g.border.strong}`,
                            }}
                        />
                        <Text level="caption" tone="secondary">
                            {k} {v === 9999 ? "" : `${v}`}
                        </Text>
                    </Box>
                ))}
            </Box>
            <Text level="body-xs" tone="secondary">
                Tags 4, buttons and inputs 6, cards and menus 8, modals 12. Small things get small
                corners.
            </Text>
        </Panel>
        <Panel
            sx={{
                p: 2,
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
                background: g.bg.subtle,
            }}
        >
            <Text level="title-sm">Depth</Text>
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                {(["sm", "md", "lg"] as const).map((k) => (
                    <Box
                        key={k}
                        sx={{
                            width: 72,
                            height: 56,
                            borderRadius: g.radius.md,
                            background: g.surface.raised,
                            border: `1px solid ${g.border.subtle}`,
                            boxShadow: g.shadow[k],
                            display: "flex",
                            alignItems: "flex-end",
                            p: 0.75,
                        }}
                    >
                        <Text level="caption" tone="secondary">
                            {k}
                        </Text>
                    </Box>
                ))}
            </Box>
            <Text level="body-xs" tone="secondary">
                Surfaces are flat. sm under buttons and inputs, md under menus, lg under modals. No
                glow.
            </Text>
        </Panel>
        <Panel sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
            <Text level="title-sm">Motion</Text>
            {(
                [
                    ["fast", MOTION.fast, "Hover, press, toggles"],
                    ["base", MOTION.base, "Menus, popovers, tabs"],
                    ["slow", MOTION.slow, "Modals, drawers"],
                ] as const
            ).map(([k, v, use]) => (
                <Box key={k} sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                    <Text level="body-sm">
                        {k}{" "}
                        <Box component="span" sx={{ color: g.text.tertiary }}>
                            {v}
                        </Box>
                    </Text>
                    <Text level="body-xs" tone="secondary">
                        {use}
                    </Text>
                </Box>
            ))}
            <Text level="body-xs" tone="secondary">
                One easing curve. Motion only answers an action, and is off under reduced motion.
            </Text>
        </Panel>
    </Box>
);

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

const Labelled = ({
    title,
    note,
    children,
}: {
    title: string;
    note?: string;
    children: ReactNode;
}) => (
    <Panel sx={{ display: "flex", flexDirection: "column" }}>
        <Box sx={{ px: 2, pt: 1.5, pb: note ? 0.5 : 1.5 }}>
            <Text component="h3" level="title-sm">
                {title}
            </Text>
            {note && (
                <Text level="body-xs" sx={{ mt: 0.25 }} tone="secondary">
                    {note}
                </Text>
            )}
        </Box>
        <Box
            sx={{
                px: 2,
                pb: 2,
                pt: 1,
                display: "flex",
                flexDirection: "column",
                gap: 1.25,
                flex: 1,
            }}
        >
            {children}
        </Box>
    </Panel>
);

/** The three row heights side by side. `data-g-density` re-points `--g-row`
 *  inside each wrapper, so this shows all of them whatever the user chose. */
const DensityStrip = () => (
    <Box
        sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
            gap: 1.5,
        }}
    >
        {DENSITIES.map((d) => (
            <Box key={d} data-g-density={d} data-testid={`density-${d}`}>
                <Text level="body-xs" sx={{ mb: 0.5 }} tone="secondary">
                    {d} · {ROW[d]}px
                </Text>
                <Panel>
                    {TASKS.slice(0, 3).map((t, i) => (
                        <TaskRow key={t.id} hovered={i === 1} task={t} compactColumns />
                    ))}
                </Panel>
            </Box>
        ))}
    </Box>
);

/** The shared message frame, in both styles of the bubble-style preference. */
const BubbleSamples = () => {
    const author = (name: string, time: string, edited = false) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <BubbleAuthor>{name}</BubbleAuthor>
            <BubbleMeta>{edited ? `${time} · Edited` : time}</BubbleMeta>
        </Box>
    );
    const toolbar = (
        <Box sx={{ ...type("body-xs"), color: g.text.secondary, px: 0.75, py: 0.5 }}>
            React · Edit · More
        </Box>
    );
    const body = (text: string) => (
        <Text level="body-md" sx={{ ...type("body-md"), color: g.text.primary }}>
            {text}
        </Text>
    );
    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                gap: 1.5,
            }}
        >
            <Panel data-testid="bubble-compact" sx={{ py: 0.5 }}>
                <Bubble
                    avatar={<Avatar name="Mika" size={32} />}
                    header={author("Mika", "09:12")}
                    layout="compact"
                >
                    {body("Can someone review the token PR before lunch?")}
                </Bubble>
                <Bubble avatar="reserve" layout="compact" grouped>
                    {body("It is small, I promise.")}
                </Bubble>
                <Bubble
                    actions={toolbar}
                    avatar={<Avatar name="Dev" size={32} />}
                    header={author("Dev", "09:14", true)}
                    layout="compact"
                    actionsOpen
                >
                    {body("On it. Hover shows the actions toolbar.")}
                </Bubble>
                <Bubble
                    avatar={<Avatar name="Mika" size={32} />}
                    emphasis="focused"
                    header={author("Mika", "09:20")}
                    layout="compact"
                >
                    {body("Deep-linked message.")}
                </Bubble>
                <Bubble
                    avatar={<Avatar name="Dev" size={32} />}
                    emphasis="threadActive"
                    footer={<BubbleMeta>3 replies</BubbleMeta>}
                    header={author("Dev", "09:31")}
                    layout="compact"
                >
                    {body("The root of the open thread.")}
                </Bubble>
            </Panel>
            <Panel
                data-testid="bubble-balloon"
                sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}
            >
                <Bubble
                    avatar={<Avatar name="Mika" size={32} />}
                    header={author("Mika", "09:12")}
                    layout="bubble"
                    side="received"
                    wrapperSx={{ maxWidth: "90%" }}
                >
                    {body("Can someone review the token PR before lunch?")}
                </Bubble>
                <Bubble
                    actions={toolbar}
                    avatar={<Avatar name="Dev" size={32} />}
                    header={author("You", "09:14")}
                    layout="bubble"
                    side="sent"
                    wrapperSx={{ alignSelf: "flex-end", maxWidth: "90%" }}
                    actionsOpen
                >
                    {body("On it.")}
                </Bubble>
                <Bubble
                    avatar={<Avatar name="Mika" size={32} />}
                    emphasis="focused"
                    header={author("Mika", "09:20")}
                    layout="bubble"
                    wrapperSx={{ maxWidth: "90%" }}
                >
                    {body("Deep-linked message.")}
                </Bubble>
            </Panel>
        </Box>
    );
};

const TabStripSample = () => {
    const [value, setValue] = useState("all");
    return (
        <Box sx={{ px: 1.5, pt: 1 }}>
            <TabStrip
                ariaLabel="Sample tabs"
                value={value}
                tabs={[
                    { id: "all", label: "All" },
                    { id: "mine", label: "Mine", count: 4 },
                    { id: "requests", label: "Requests", count: 2, attention: true },
                    { id: "archived", label: "Archived", disabled: true },
                ]}
                onChange={setValue}
            />
        </Box>
    );
};

const Components = () => (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Labelled
            note="36px rows by default (53 today), 32 or 44 by the Density setting. Status color lives in the icon, IDs are quiet, priority shows only when set."
            title="Task table"
        >
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
                <FilterChip field="Status" value="Open, WIP" active />
                <FilterChip field="Sprint" value="All" />
                <FilterChip field="Milestone" value="All" />
                <FilterChip field="Priority" value="Any" />
                <FilterChip field="Member" value="Anyone" />
                <Button icon={<FilterListRounded />} size="sm" variant="ghost">
                    Filter
                </Button>
            </Box>
            <Panel sx={{ mx: -0.25 }}>
                {TASKS.map((t, i) => (
                    <TaskRow key={t.id} hovered={i === 2} task={t} />
                ))}
            </Panel>
        </Labelled>

        <Labelled
            note="The board, mobile list, dashboard rows and milestone cards are one family: TaskCard and TaskListItem, on the shared status, priority, tag and avatar pieces."
            title="Task card and task row"
        >
            <TaskCardSamples />
        </Labelled>

        <Labelled
            note="Compact, Default and Comfortable. The table above follows the user's choice."
            title="Row density"
        >
            <DensityStrip />
        </Labelled>

        <Labelled
            note="One frame for chat, thread, task comment, inbox and the note comment list. Left: the compact row (default). Right: the bubble style. A deep link is green, the open thread is the accent, your own bubble is tinted. The toolbar floats top-right on hover."
            title="Messages and comments"
        >
            <BubbleSamples />
        </Labelled>

        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
                gap: 1.5,
            }}
        >
            <Labelled note="The gradient survives only on the primary action." title="Buttons">
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    <Button icon={<AddRounded />} variant="primary">
                        New task
                    </Button>
                    <Button variant="secondary">Cancel</Button>
                    <Button variant="ghost">Skip</Button>
                    <Button variant="danger">Delete</Button>
                </Box>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
                    <Button size="sm">Small 28</Button>
                    <Button size="md">Default 32</Button>
                    <Button size="lg">Large 36</Button>
                </Box>
            </Labelled>

            <Labelled note="White field, one border, the accent only on focus." title="Input">
                <Input name="ds-search" placeholder="Search tasks…" />
                <Input defaultValue="Wire Joy to the tokens" name="ds-title" placeholder="Title" />
            </Labelled>

            <Labelled note="Same five hues on every theme." title="Status">
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                    {STATUS_NAMES.filter((s) => s !== "Deleted").map((s) => (
                        <StatusLabel key={s} status={s} />
                    ))}
                </Box>
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                    {PRIORITY_NAMES.map((p) => (
                        <PriorityIcon key={p} priority={p} showLabel />
                    ))}
                </Box>
                <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                    <Tag color="#8b5cf6" label="UI&UX" />
                    <Tag color="#3b82f6" label="frontend" />
                    <Tag color="#10b981" label="mcp" />
                    <Tag color="#ef4444" label="bug" />
                </Box>
                <Box
                    sx={{
                        ...type("body-sm"),
                        color: g.danger.text,
                        background: g.danger.subtle,
                        border: `1px solid ${g.danger.border}`,
                        borderRadius: g.radius.sm,
                        px: 1.25,
                        py: 1,
                    }}
                >
                    Couldn't save the task. Check your connection and try again.
                </Box>
            </Labelled>

            <Labelled
                note="One row, one height (the density setting), one selected style: the accent's quiet tint, not a filled pill. A two-line row is the only taller one."
                title="Navigation"
            >
                <Box
                    sx={{
                        background: g.bg.subtle,
                        borderRadius: g.radius.md,
                        p: 0.75,
                        border: `1px solid ${g.border.subtle}`,
                    }}
                >
                    <NavItem as="div" icon={<AutoAwesomeRounded />} label="Genos" />
                    <NavItem as="div" count={5} icon={<InboxRounded />} label="Inbox" />
                    <NavItem as="div" count={2} icon={<ChatRounded />} label="Chats" />
                    <NavItem as="div" icon={<AssignmentRounded />} label="Tasks" selected />
                    <NavItem as="div" icon={<EditNoteRounded />} label="Notes" />
                    <SectionHeader as="div" label="Projects" expanded />
                    <NavItem as="div" label="Genos web" expanded />
                    <NavItem as="div" indent={1} label="Sprint 42" selected />
                    <NavItem as="div" indent={1} label="Backlog" unread />
                    <NavItem
                        actions={<MoreHorizRounded sx={{ fontSize: 16 }} />}
                        as="div"
                        icon={<EditNoteRounded />}
                        label="Release notes"
                        lines={2}
                        secondary="Edited 2h ago"
                        actionsVisible
                    />
                </Box>
            </Labelled>

            <Labelled
                note="The real component. One design for chat, notes, inbox and every list: the title says what is empty, the body says what to do next, at most one action."
                title="Empty state"
            >
                <Panel sx={{ background: g.bg.default }}>
                    <EmptyState
                        action={{ label: "New note", onClick: () => {}, icon: <AddRounded /> }}
                        body="Pick a note from the sidebar, or start a new one."
                        icon={<DescriptionOutlined />}
                        title="No note open"
                    />
                </Panel>
                <Panel sx={{ background: g.bg.default, mt: 1.5, maxWidth: 280 }}>
                    <EmptyState
                        body="Flag a message to find it here later."
                        icon={<ChatRounded />}
                        size="sm"
                        title="No flagged messages"
                    />
                </Panel>
                <Panel sx={{ background: g.bg.default, mt: 1.5, maxWidth: 280, px: 1.5 }}>
                    <EmptyState body="No favorites yet. Star notes to add them here." size="xs" />
                </Panel>
            </Labelled>

            <Labelled
                note="In a button: its own loading prop. A list: skeleton rows (they take the user's row height, so nothing jumps). A block of text: skeleton lines. A field or one value: the spinner. A page or an AI wait: the spinner with a caption."
                title="Loading"
            >
                <Panel sx={{ background: g.bg.default }}>
                    <SkeletonRows count={3} avatar twoLines />
                </Panel>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.5 }}>
                    <Spinner />
                    <Text level="body-sm" tone="secondary">
                        Inline spinner
                    </Text>
                </Box>
                <Box sx={{ p: 1.5 }}>
                    <Spinner caption="Finishing sign-in…" size="lg" stacked />
                </Box>
            </Labelled>

            <Labelled
                note="One strip: arrow keys, Home and End (mirrored in right-to-left), a count that only asks for attention when it should."
                title="Tab strip"
            >
                <TabStripSample />
            </Labelled>

            <Labelled
                note="One host, bottom-center, announced to screen readers. Errors are assertive; hover pauses the timer; Undo is for soft actions. A state that stays (connection lost, a page about to reload) is pinned at the top instead, so it never covers what you are typing in."
                title="Toast"
            >
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, p: 1.5 }}>
                    <JoyButton
                        color="neutral"
                        size="sm"
                        variant="outlined"
                        onClick={() => toast.success("Link copied")}
                    >
                        Success
                    </JoyButton>
                    <JoyButton
                        color="neutral"
                        size="sm"
                        variant="outlined"
                        onClick={() =>
                            toast.error("That didn't save. Check your connection and retry.")
                        }
                    >
                        Error
                    </JoyButton>
                    <JoyButton
                        color="neutral"
                        size="sm"
                        variant="outlined"
                        onClick={() =>
                            toast.undoable("Task deleted", () => toast.success("Restored"))
                        }
                    >
                        With Undo
                    </JoyButton>
                </Box>
            </Labelled>
        </Box>

        <Labelled
            note="Left cell: Tailwind classes only. Right cell: the same role through sx. They match in every theme and mode."
            title="Tailwind"
        >
            <TailwindSample />
        </Labelled>
    </Box>
);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const DesignSystemPage = () => {
    const { themeId } = useColorTheme();
    const { mode: joyMode, systemMode } = useColorScheme();
    const initialMode: Mode =
        (joyMode === "system" ? systemMode : joyMode) === "dark" ? "dark" : "light";

    const [theme, setTheme] = useState<ThemeId>(themeId);
    const [mode, setMode] = useState<Mode>(initialMode);
    const roles = useMemo(() => buildRoles(theme, mode), [theme, mode]);

    return (
        <Box
            data-g-mode={mode}
            data-g-theme={theme}
            sx={{
                ...joyBridge(mode),
                // The page owns its scroll, like PlansHome: the shell is
                // `overflow: hidden`, so a taller page would scroll the
                // document and carry the sidebar away with it.
                height: "var(--app-vh)",
                // The workspace content slot is a flex row; without these
                // the page shrinks to its content's width.
                flex: 1,
                width: "100%",
                minWidth: 0,
                overflowY: "auto",
                WebkitFontSmoothing: "antialiased",
                // Keep a focused element clear of the sticky header.
                scrollPaddingTop: "72px",
            }}
        >
            <Box
                component="header"
                sx={{
                    // Sticky only on wide screens: on a phone the controls wrap
                    // to three rows and would cover a third of the page.
                    position: { xs: "static", md: "sticky" },
                    top: 0,
                    zIndex: 1,
                    background: g.bg.default,
                    borderBottom: `1px solid ${g.border.subtle}`,
                }}
            >
                <Box
                    sx={{
                        maxWidth: 1120,
                        mx: "auto",
                        px: { xs: 2, md: 4 },
                        py: 1.5,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 1.5,
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <Text component="span" level="title-md">
                        Preview
                    </Text>
                    <Box
                        sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}
                    >
                        <ThemePicker value={theme} onChange={setTheme} />
                        <Segmented
                            label="Mode"
                            value={mode}
                            options={[
                                { id: "light", label: "Light" },
                                { id: "dark", label: "Dark" },
                            ]}
                            onChange={setMode}
                        />
                    </Box>
                </Box>
            </Box>

            <Box
                component="main"
                sx={{
                    maxWidth: 1120,
                    mx: "auto",
                    px: { xs: 2, md: 4 },
                    pb: { xs: "calc(48px + var(--mobile-bottom-inset, 0px))", md: 8 },
                }}
            >
                <Box
                    sx={{
                        py: { xs: 4, md: 6 },
                        display: "flex",
                        flexDirection: "column",
                        gap: 1.5,
                        maxWidth: 640,
                    }}
                >
                    <Text component="h1" level="h1" sx={{ textWrap: "balance" }}>
                        Design system
                    </Text>
                    <Text component="p" level="body-lg" tone="secondary">
                        The proposed look for Genos (MIP-1106): quiet surfaces, one accent used
                        sparingly, real status colors, and one scale for type, corners and depth.
                        Nothing in the app uses it yet. Pick a theme and mode above to preview it.
                    </Text>
                </Box>

                <Section
                    intro="The same slice of Genos in all seven color themes, light and dark. Every color on this page is checked for contrast by a test."
                    title="Every theme"
                >
                    <ThemeMatrix />
                </Section>

                <Section
                    intro={`Components ask for a role, never a hex value or an isDark branch. Values below are ${themeName(theme)}, ${mode}. Ratios are the worst case across the page, sidebar and card surfaces.`}
                    title="Color roles"
                >
                    <ColorRoles roles={roles} />
                </Section>

                <Section
                    intro="Twelve steps replace about 65 sizes in use today. Body text in lists and tables is 13px; reading text is 14px. Weights are 400, 500 and 600 only. The typeface is Geist; Japanese falls back to the system face."
                    title="Type"
                >
                    <TypeScale />
                </Section>

                <Section title="Shape, depth and motion">
                    <ShapeAndDepth />
                </Section>

                <Section
                    intro="The first shared pieces. Each replaces several hand-styled versions in the app today."
                    title="Components"
                >
                    <Components />
                </Section>
            </Box>
        </Box>
    );
};

export default DesignSystemPage;
