import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { Box } from "@mui/joy";
import type { SxProps } from "@mui/joy/styles/types";

import { plainButtonSx } from "./plainButtonStyles";

/**
 * A real `<button>` with no look of its own (MIP-1129).
 *
 * About fifty clickable `Box` / `div` / `span` elements were mouse-only: no
 * keyboard activation, no name for a screen reader, no focus ring. The fix for a
 * thing that is already styled as a row, a tile, a thumbnail or an icon is not a
 * visible Button: it is the same element, as a button that draws nothing. This
 * resets the browser's button chrome (so the caller's `sx` lays it out exactly
 * as the `Box` was), keeps Enter / Space and the name for free, and shows the
 * shared `focusRing` on `:focus-visible` only (the mouse never sees it).
 *
 *     <PlainButton aria-label={t.x.open} onClick={open} sx={{ display: "flex", ... }}>
 *
 * It is `@mui/joy` `Box`, not Material's `ButtonBase`: the design ratchet counts
 * `@mui/material` imports and they may only fall.
 *
 * A `<button>` cannot hold another button, link or input. A row that contains
 * them keeps `role="button"` + `tabIndex` + `onKeyDown` on its own element (the
 * clickable-element scan accepts that), or splits the actions out as siblings
 * the way `NavItem` does.
 */

type PlainButtonProps = Omit<ComponentPropsWithoutRef<"button">, "color" | "style"> & {
    sx?: SxProps;
    style?: React.CSSProperties;
};

export const PlainButton = forwardRef<HTMLButtonElement, PlainButtonProps>(function PlainButton(
    { sx, type = "button", ...rest },
    ref
) {
    return (
        <Box
            ref={ref}
            component="button"
            sx={[plainButtonSx, ...(Array.isArray(sx) ? sx : [sx])]}
            type={type}
            {...rest}
        />
    );
});
