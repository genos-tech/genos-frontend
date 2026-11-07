/**
 * Proposed components for the design system (MIP-1106), bound ONLY to the
 * `--g-*` tokens.
 *
 * They are deliberately plain elements rather than Joy components with
 * `color=` props: Joy reads its own `--joy-palette-*` variables from the
 * root theme, so a Joy Button inside the blue preview cell would still
 * paint the global purple. These samples are what P2/P3 turn into Joy
 * component defaults and shared primitives; until then they live here so
 * the direction can be judged before anything in the app changes.
 */

import { ReactNode } from "react";
import AddRounded from "@mui/icons-material/AddRounded";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";
import Box, { BoxProps } from "@mui/joy/Box";

import { focusRing, g, type, TypeLevel } from "../../theme/tokens";
import { PriorityIcon } from "../tasks/components/meta/PriorityIcon";
import { StatusLabel } from "../tasks/components/meta/StatusLabel";
import { Tag } from "../tasks/components/meta/Tag";
import { StatusName } from "../tasks/meta/taskTone";

const interactive = {
    transition: `background-color ${g.motion.fast} ${g.ease}, border-color ${g.motion.fast} ${g.ease}, color ${g.motion.fast} ${g.ease}`,
    "&:focus-visible": focusRing,
    touchAction: "manipulation",
    "@media (prefers-reduced-motion: reduce)": { transition: "none" },
} as const;

/** Text at a scale level. `tone` picks the text role. */
export const Text = ({
    level = "body-sm",
    tone = "primary",
    children,
    sx,
    ...rest
}: {
    level?: TypeLevel;
    tone?: "primary" | "secondary" | "tertiary" | "accent";
    children: ReactNode;
} & Omit<BoxProps, "color">) => (
    <Box
        sx={[
            {
                ...type(level),
                color: tone === "accent" ? g.accent.text : g.text[tone],
                margin: 0,
            },
            ...(Array.isArray(sx) ? sx : [sx]),
        ]}
        {...rest}
    >
        {children}
    </Box>
);

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const buttonVariant: Record<ButtonVariant, object> = {
    // The one gradient that survives the flattening (Ken, 2026-11-07).
    primary: {
        background: g.brand.gradient,
        color: g.accent.fg,
        border: "1px solid transparent",
        boxShadow: g.shadow.sm,
        "&:hover": { background: g.brand.gradientHover },
    },
    secondary: {
        background: g.surface.default,
        color: g.text.primary,
        border: `1px solid ${g.border.default}`,
        boxShadow: g.shadow.sm,
        "&:hover": { background: g.surface.raised, borderColor: g.border.strong },
    },
    ghost: {
        background: "transparent",
        color: g.text.secondary,
        border: "1px solid transparent",
        "&:hover": { background: g.hover, color: g.text.primary },
    },
    danger: {
        background: g.danger.solid,
        color: g.danger.solidFg,
        border: "1px solid transparent",
        "&:hover": { filter: "brightness(0.94)" },
    },
};

export const Button = ({
    variant = "secondary",
    size = "md",
    icon,
    children,
}: {
    variant?: ButtonVariant;
    size?: Size;
    icon?: ReactNode;
    children: ReactNode;
}) => (
    <Box
        component="button"
        type="button"
        sx={{
            ...type(size === "lg" ? "title-md" : "title-sm"),
            fontWeight: 500,
            fontFamily: "inherit",
            height: g.control[size],
            px: size === "sm" ? 1.25 : 1.5,
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            borderRadius: g.radius.sm,
            cursor: "pointer",
            whiteSpace: "nowrap",
            "& svg": { fontSize: 16, color: "currentColor" },
            ...interactive,
            ...buttonVariant[variant],
        }}
    >
        {icon}
        {children}
    </Box>
);

export const Input = ({
    name,
    placeholder,
    defaultValue,
}: {
    name: string;
    placeholder: string;
    defaultValue?: string;
}) => (
    <Box
        aria-label={placeholder.replace(/…$/, "")}
        autoComplete="off"
        component="input"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        sx={{
            ...type("body-sm"),
            fontFamily: "inherit",
            height: g.control.md,
            px: 1.25,
            width: "100%",
            maxWidth: 320,
            boxSizing: "border-box",
            color: g.text.primary,
            background: g.surface.default,
            border: `1px solid ${g.border.default}`,
            borderRadius: g.radius.sm,
            boxShadow: g.shadow.sm,
            outline: "none",
            "&::placeholder": { color: g.text.tertiary },
            "&:hover": { borderColor: g.border.strong },
            "&:focus-visible": { borderColor: g.focus, boxShadow: `0 0 0 3px ${g.accent.subtle}` },
            transition: `border-color ${g.motion.fast} ${g.ease}, box-shadow ${g.motion.fast} ${g.ease}`,
            "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        }}
    />
);

/** Task status, priority and tag: the SHARED components the app uses
 *  (MIP-1122), re-exported so this page shows exactly what ships. */
export { PriorityIcon, StatusLabel, Tag };

/** Filter chip: field name + chosen value, never truncated to "Stat…".
 *  The bar wraps instead of clipping. An active filter is the only one
 *  that carries the accent. */
export const FilterChip = ({
    field,
    value,
    active = false,
}: {
    field: string;
    value: string;
    active?: boolean;
}) => (
    <Box
        component="button"
        type="button"
        sx={{
            ...type("body-sm"),
            fontFamily: "inherit",
            height: g.control.sm,
            px: 1,
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            borderRadius: g.radius.sm,
            cursor: "pointer",
            whiteSpace: "nowrap",
            border: `1px solid ${active ? g.accent.border : g.border.default}`,
            background: active ? g.accent.subtle : g.surface.default,
            color: active ? g.accent.text : g.text.secondary,
            "&:hover": { background: active ? g.accent.subtle : g.hover },
            "& svg": { fontSize: 16, opacity: 0.7 },
            ...interactive,
        }}
    >
        <Box component="span" sx={{ color: active ? g.accent.text : g.text.tertiary }}>
            {field}
        </Box>
        <Box
            component="span"
            sx={{ fontWeight: 500, color: active ? g.accent.text : g.text.primary }}
        >
            {value}
        </Box>
        <KeyboardArrowDownRounded />
    </Box>
);

export const NavItem = ({
    icon,
    label,
    selected = false,
    count,
}: {
    icon: ReactNode;
    label: string;
    selected?: boolean;
    count?: number;
}) => (
    <Box
        aria-current={selected ? "page" : undefined}
        component="button"
        type="button"
        sx={{
            ...type("body-sm"),
            fontFamily: "inherit",
            fontWeight: selected ? 500 : 400,
            width: "100%",
            height: g.control.md,
            px: 1,
            display: "flex",
            alignItems: "center",
            gap: 1,
            border: 0,
            borderRadius: g.radius.sm,
            cursor: "pointer",
            textAlign: "start",
            background: selected ? g.accent.subtle : "transparent",
            color: selected ? g.accent.text : g.text.secondary,
            "&:hover": {
                background: selected ? g.accent.subtle : g.hover,
                color: selected ? g.accent.text : g.text.primary,
            },
            "& svg": { fontSize: 18, flexShrink: 0 },
            ...interactive,
        }}
    >
        {icon}
        <Box
            component="span"
            sx={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
            }}
        >
            {label}
        </Box>
        {count !== undefined && (
            <Box
                component="span"
                sx={{
                    ...type("caption"),
                    color: selected ? g.accent.text : g.text.tertiary,
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {count}
            </Box>
        )}
    </Box>
);

/** First LETTER of the name, not the first character: "(DY) Ken" is "D",
 *  not "(". Today's avatars show "(" for that name. */
const initialOf = (name: string): string => (name.match(/\p{L}/u)?.[0] ?? "?").toUpperCase();

export const Avatar = ({ name, size = 20 }: { name: string; size?: number }) => (
    <Box
        aria-label={name}
        component="span"
        role="img"
        sx={{
            width: size,
            height: size,
            flexShrink: 0,
            borderRadius: g.radius.full,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: Math.round(size * 0.5),
            fontWeight: 600,
            color: g.text.secondary,
            background: g.bg.subtle,
            boxShadow: `inset 0 0 0 1px ${g.border.default}`,
        }}
    >
        {initialOf(name)}
    </Box>
);

export type SampleTask = {
    id: string;
    title: string;
    status: StatusName;
    tags?: { label: string; color: string }[];
    assignee: string;
    priority?: "Minimal" | "Low" | "Normal" | "High" | "Critical";
};

/** A task-table row at 36px (53px today). IDs are tertiary text, not
 *  orange; priority shows only when it is set, not a flag on every row. */
export const TaskRow = ({
    task,
    hovered = false,
    compactColumns = false,
}: {
    task: SampleTask;
    hovered?: boolean;
    compactColumns?: boolean;
}) => (
    <Box
        sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            height: g.row.default,
            px: 1.5,
            borderBottom: `1px solid ${g.border.subtle}`,
            background: hovered ? g.hover : "transparent",
            "&:hover": { background: g.hover },
            "&:last-of-type": { borderBottom: 0 },
            minWidth: 0,
        }}
    >
        <StatusLabel status={task.status} iconOnly />
        <Text
            level="body-xs"
            tone="tertiary"
            sx={{
                width: 64,
                flexShrink: 0,
                whiteSpace: "nowrap",
                fontVariantNumeric: "tabular-nums",
            }}
        >
            {task.id}
        </Text>
        <Text
            level="body-sm"
            sx={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
            }}
        >
            {task.title}
        </Text>
        {!compactColumns && (
            <Box sx={{ display: { xs: "none", sm: "flex" }, gap: 0.5 }}>
                {task.tags?.map((t) => (
                    <Tag key={t.label} {...t} />
                ))}
            </Box>
        )}
        <PriorityIcon priority={task.priority} />
        <Avatar name={task.assignee} />
    </Box>
);

/** The single empty state for every surface: neutral icon, one line of
 *  title, one line of direction, at most one action. */
export const EmptyState = ({
    icon,
    title,
    body,
    action,
}: {
    icon: ReactNode;
    title: string;
    body: string;
    action?: string;
}) => (
    <Box
        sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 1,
            py: 4,
            px: 2,
        }}
    >
        <Box
            sx={{
                width: 40,
                height: 40,
                borderRadius: g.radius.full,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: g.bg.subtle,
                boxShadow: `inset 0 0 0 1px ${g.border.subtle}`,
                color: g.text.tertiary,
                mb: 0.5,
                "& svg": { fontSize: 20 },
            }}
        >
            {icon}
        </Box>
        <Text level="title-md">{title}</Text>
        <Text level="body-sm" sx={{ maxWidth: 280 }} tone="secondary">
            {body}
        </Text>
        {action && (
            <Box sx={{ mt: 1 }}>
                <Button icon={<AddRounded />} size="sm" variant="secondary">
                    {action}
                </Button>
            </Box>
        )}
    </Box>
);

/** Bordered container used by the samples (P3: `Panel`). */
export const Panel = ({ children, sx, ...rest }: BoxProps) => (
    <Box
        sx={[
            {
                background: g.surface.default,
                border: `1px solid ${g.border.default}`,
                borderRadius: g.radius.md,
                overflow: "hidden",
            },
            ...(Array.isArray(sx) ? sx : [sx]),
        ]}
        {...rest}
    >
        {children}
    </Box>
);
