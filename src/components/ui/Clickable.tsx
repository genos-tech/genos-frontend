import { forwardRef, type KeyboardEvent, type SyntheticEvent } from "react";
import Box, { type BoxProps } from "@mui/joy/Box";

import { focusRing } from "../../theme/tokens";

/**
 * A clickable region that cannot be a `<button>` (MIP-1129).
 *
 * `PlainButton` is the answer when the thing is a tile, a row or a thumbnail. A
 * button cannot hold another button, a link or an input, though, and cannot be an
 * inline run inside a sentence, so a row that carries a menu, a mention chip in a
 * message, or a card with a link in it stays an element of its own. `Clickable` is
 * that element done properly: `role="button"`, in the tab order, Enter and Space
 * activate it, the shared focus ring on `:focus-visible`, and the name from
 * `label` (or its own text).
 *
 * Enter / Space only count when the key was pressed ON the region: a key pressed
 * in a link, a menu button or an input inside it belongs to that control.
 *
 *     <Clickable label={t.x.open} onActivate={open} sx={{ display: "flex" }}>...</Clickable>
 */
type ClickableProps = Omit<BoxProps, "onClick" | "component" | "role" | "onKeyDown"> & {
    onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
    /** Without it the element is inert (no role, not in the tab order): a region that
     *  is only sometimes clickable passes `onActivate={maybe ? fn : undefined}`. */
    /** Runs for a click and for Enter / Space; the event is a click or a key event. */
    onActivate?: (event: SyntheticEvent<HTMLElement>) => void;
    /** Accessible name when the content is not text (an avatar, an icon). */
    label?: string;
    disabled?: boolean;
    /** `button` unless the region is really a checkbox row, a switch, a tab, an option
     *  (or a drag handle that brings its own role). */
    role?: string;
    /** Keys that activate. Space belongs to a drag handle (it lifts the card), so a
     *  draggable region passes `["Enter"]`. */
    keys?: readonly ("Enter" | " ")[];
    /** `span` for an inline run inside a sentence. */
    as?: "div" | "span" | "li";
};

const ACTIVATE_KEYS = ["Enter", " "] as const;

export const Clickable = forwardRef<HTMLElement, ClickableProps>(function Clickable(
    {
        onActivate,
        label,
        disabled,
        as = "div",
        role = "button",
        keys = ACTIVATE_KEYS,
        sx,
        onKeyDown,
        ...rest
    },
    ref
) {
    const active = !!onActivate && !disabled;
    return (
        <Box
            ref={ref}
            aria-disabled={onActivate && disabled ? true : undefined}
            aria-label={label}
            component={as}
            sx={[
                active && {
                    cursor: "pointer",
                    borderRadius: "inherit",
                    "&:focus": { outline: "none" },
                    "&:focus-visible": focusRing,
                },
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
            onClick={active ? onActivate : undefined}
            onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
                onKeyDown?.(event);
                if (!active || event.defaultPrevented || event.target !== event.currentTarget) {
                    return;
                }
                if ((keys as readonly string[]).includes(event.key)) {
                    event.preventDefault();
                    onActivate(event);
                }
            }}
            {...(onActivate ? { role, tabIndex: disabled ? -1 : 0 } : {})}
            {...rest}
        />
    );
});
