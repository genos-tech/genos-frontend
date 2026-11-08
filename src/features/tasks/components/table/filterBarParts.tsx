// The small parts every dropdown in the task filter bar is built from (MIP-1121):
// a Joy `Dropdown` / `MenuButton` trigger around the shared `MenuSurface` /
// `MenuRow` (MIP-1128), so the filter menus need neither a Material `Menu` nor
// the Material `ThemeProvider` around the table.
//
// Each menu is `open` state in the parent, with the trigger a `MenuButton` inside
// `FilterDropdown`. The Dropdown, not the trigger's own onClick, flips it: a
// trigger that also set the state itself would have its toggle evaluated against
// the already-open value and close the menu it just opened.

// Behavior this keeps on purpose:
//  - Nothing closes the menu except the parent. A Joy `MenuItem` closes its
//    menu on click by default; the six multi-select filters need to stay open
//    while you tick several values (and the "show past sprints" row only
//    expands), so `FilterMenuItem` cancels that default. A handler that wants to
//    close still just sets its `open` state to false, exactly as before.
//  - Escape, Tab and clicking away close it (Dropdown reports `open: false`).

import { forwardRef, type ReactNode } from "react";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";
import {
    Chip,
    ChipDelete,
    Dropdown,
    IconButton,
    MenuButton,
    type IconButtonProps,
    type MenuButtonProps,
} from "@mui/joy";
import type { SxProps } from "@mui/joy/styles/types";

import { MenuRow, MenuSurface, type MenuRowProps } from "../../../../components/ui/MoreMenu";
import type { TaskFilterMenuStyles } from "../../../../components/ui/styles/commonStyle";
import { fmt } from "../../../../i18n";
import { g, type } from "../../../../theme/tokens";

type FilterBarStyles = (typeof TaskFilterMenuStyles)["dark"];

/** Wraps a trigger (`MenuButton`) and its `FilterMenu`; `open` is the parent's state. */
export const FilterDropdown = ({
    open,
    onOpenChange,
    children,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
}) => (
    <Dropdown open={open} onOpenChange={(_event, next) => onOpenChange(next)}>
        {children}
    </Dropdown>
);

/**
 * The bar's dropdown surface: the shared menu surface (MIP-1128). The look comes
 * from the tokens; `isDark` and `styles` are accepted only so the call sites in
 * `TaskFilterMenu` / `SavedFiltersMenu` keep compiling (that file is mid-rework),
 * and are dropped from them as they are touched.
 */
export const FilterMenu = ({
    minWidth,
    // Material's Menu defaulted to the viewport minus a margin.
    maxHeight = "calc(100vh - 96px)",
    placement = "bottom-start",
    children,
}: {
    /** @deprecated unused: the surface follows the theme through tokens. */
    isDark?: boolean;
    /** @deprecated unused: the surface follows the theme through tokens. */
    styles?: FilterBarStyles;
    minWidth: number | string;
    maxHeight?: number | string;
    placement?: "bottom-start" | "bottom-end";
    children: ReactNode;
}) => (
    <MenuSurface placement={placement} sx={{ minWidth, maxHeight }}>
        {children}
    </MenuSurface>
);

/** A menu row that never closes its menu by itself (see the file header). */
export const FilterMenuItem = forwardRef<HTMLDivElement, MenuRowProps>(
    function FilterMenuItem(props, ref) {
        return <MenuRow {...props} ref={ref} keepOpen />;
    }
);

/**
 * The bar's small chip (a "+2" count on a button, a sprint's status in its row, the
 * milestone scope pill). Material's `Chip` took a `label` prop and sized itself from
 * the label's own padding; Joy's takes children and has a 24px minimum, so the
 * callers' explicit `height` needs `minHeight: 0` to win.
 */
export const BarChip = ({
    label,
    onDelete,
    sx,
}: {
    label: ReactNode;
    onDelete?: () => void;
    sx?: SxProps;
}) => (
    <Chip
        color="neutral"
        endDecorator={onDelete ? <ChipDelete onDelete={onDelete} /> : undefined}
        size="sm"
        sx={[{ minHeight: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}
        variant="soft"
    >
        {label}
    </Chip>
);

/**
 * A filter of the bar: the field and what is chosen, never cut to "Stat..." (the
 * bar scrolls sideways instead of clipping). Only a filter that is narrowing the list carries
 * the accent (MIP-1123; the design page's `FilterChip` is the reference).
 *
 * The field name comes from the locale's "Status: {value}" template, so it stays
 * translated and the value stays the caller's.
 */
export const splitFilterLabel = (template: string, value: string) => {
    const MARK = "\u0000";
    const [before = "", after = ""] = fmt(template, { value: MARK }).split(MARK);
    return {
        field: before.replace(/[:\uFF1A]\s*$/, "").trim(),
        value,
        suffix: after.trim(),
    };
};

type FilterChipButtonProps = {
    field: string;
    value: ReactNode;
    /** "+N": how many more are chosen beyond the one named. */
    extra?: number;
    active: boolean;
} & Omit<MenuButtonProps, "children" | "variant" | "color" | "sx" | "value">;

export const FilterChipButton = forwardRef<HTMLButtonElement, FilterChipButtonProps>(
    function FilterChipButton({ field, value, extra = 0, active, ...props }, ref) {
        return (
            <MenuButton
                {...props}
                ref={ref}
                color="neutral"
                endDecorator={<KeyboardArrowDownRounded sx={{ fontSize: 16, opacity: 0.7 }} />}
                variant="plain"
                sx={{
                    ...type("body-sm"),
                    height: g.control.sm,
                    minHeight: 0,
                    px: 1,
                    gap: 0.5,
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                    borderRadius: g.radius.sm,
                    border: `1px solid ${active ? g.accent.border : g.border.default}`,
                    background: active ? g.accent.subtle : g.surface.default,
                    color: active ? g.accent.text : g.text.secondary,
                    "--Icon-color": "currentColor",
                    "&:hover": { background: active ? g.accent.subtle : g.hover },
                }}
            >
                <span style={{ color: active ? "inherit" : g.text.tertiary }}>{field}</span>
                <span style={{ fontWeight: 500, color: active ? "inherit" : g.text.primary }}>
                    {value}
                </span>
                {extra > 0 && (
                    // `dir="ltr"`: in a right-to-left bar the "+" is a neutral character
                    // and the count read "3+".
                    <span dir="ltr" style={{ fontVariantNumeric: "tabular-nums", opacity: 0.8 }}>
                        +{extra}
                    </span>
                )}
            </MenuButton>
        );
    }
);

// A compact icon-only control at the end of the bar (Saved Filters, Reset). The
// name is the `AppTooltip` around it, which also writes it on as `aria-label`.
const iconControlSx = (active: boolean) =>
    ({
        width: g.control.sm,
        minWidth: g.control.sm,
        height: g.control.sm,
        minHeight: 0,
        p: 0,
        flexShrink: 0,
        borderRadius: g.radius.sm,
        border: `1px solid ${active ? g.accent.border : "transparent"}`,
        background: active ? g.accent.subtle : "transparent",
        color: active ? g.accent.text : g.text.secondary,
        "--Icon-color": "currentColor",
        "& svg": { fontSize: 18 },
        "&:hover": {
            background: active ? g.accent.subtle : g.hover,
            color: active ? g.accent.text : g.text.primary,
        },
    }) as const;

/** An icon button for a bar action (Reset). */
export const FilterIconButton = forwardRef<
    HTMLButtonElement,
    Omit<IconButtonProps, "variant" | "color" | "sx" | "size">
>(function FilterIconButton(props, ref) {
    return (
        <IconButton
            {...props}
            ref={ref}
            color="neutral"
            sx={iconControlSx(false)}
            variant="plain"
        />
    );
});

/** The icon trigger of a bar dropdown (Saved Filters); `active` while a saved filter is applied. */
export const FilterIconMenuButton = forwardRef<
    HTMLButtonElement,
    { active?: boolean } & Omit<MenuButtonProps, "variant" | "color" | "sx" | "size">
>(function FilterIconMenuButton({ active = false, ...props }, ref) {
    return (
        <MenuButton
            {...props}
            ref={ref}
            color="neutral"
            sx={iconControlSx(active)}
            variant="plain"
        />
    );
});
