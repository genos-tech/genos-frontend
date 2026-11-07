// The three small parts every dropdown in the task filter bar is built from
// (MIP-1121). They are Joy `Dropdown` / `Menu` / `MenuItem` with the bar's own
// look, so the filter menus no longer need a Material `Menu` + `Fade` slot
// (which crashed under the Joy theme alone, see `SavedFiltersMenu`'s history)
// nor the Material `ThemeProvider` around the table.
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
    Menu,
    MenuButton,
    MenuItem,
    type MenuButtonProps,
    type MenuItemProps,
} from "@mui/joy";
import type { SxProps } from "@mui/joy/styles/types";

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

/** The bar's dropdown surface: its own background, border, radius and scrollbar. */
export const FilterMenu = ({
    isDark,
    styles,
    minWidth,
    // Material's Menu defaulted to the viewport minus a margin.
    maxHeight = "calc(100vh - 96px)",
    placement = "bottom-start",
    children,
}: {
    isDark: boolean;
    styles: FilterBarStyles;
    minWidth: number | string;
    maxHeight?: number | string;
    placement?: "bottom-start" | "bottom-end";
    children: ReactNode;
}) => (
    <Menu
        className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
        placement={placement}
        size="sm"
        sx={{
            background: styles.menuBg,
            border: `1px solid ${styles.menuBorder}`,
            borderRadius: "12px",
            boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.5)" : "0 8px 32px rgba(0,0,0,0.15)",
            minWidth,
            maxHeight,
            overflowY: "auto",
            "--List-padding": "4px",
        }}
    >
        {children}
    </Menu>
);

/** A `MenuItem` that never closes its menu by itself (see the file header). */
export const FilterMenuItem = forwardRef<HTMLDivElement, MenuItemProps>(function FilterMenuItem(
    { onClick, ...props },
    ref
) {
    return (
        <MenuItem
            {...props}
            ref={ref}
            onClick={(event) => {
                // `useMenuItem` checks this flag before dispatching its close.
                (event as unknown as { defaultMuiPrevented?: boolean }).defaultMuiPrevented = true;
                onClick?.(event);
            }}
        />
    );
});

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
 * bar wraps instead of clipping). Only a filter that is narrowing the list carries
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
} & Omit<MenuButtonProps, "children" | "variant" | "color" | "sx">;

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
                    <span style={{ fontVariantNumeric: "tabular-nums", opacity: 0.8 }}>
                        +{extra}
                    </span>
                )}
            </MenuButton>
        );
    }
);
