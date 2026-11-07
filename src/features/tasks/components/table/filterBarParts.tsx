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
import { Dropdown, Menu, MenuItem, type MenuItemProps } from "@mui/joy";

import type { TaskFilterMenuStyles } from "../../../../components/ui/styles/commonStyle";

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
    maxHeight,
    placement = "bottom-start",
    children,
}: {
    isDark: boolean;
    styles: FilterBarStyles;
    minWidth: number | string;
    maxHeight: number | string;
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
