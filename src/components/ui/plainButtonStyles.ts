import { focusRing, g } from "../../theme/tokens";

/** The reset behind `PlainButton`: see there for why. */
export const plainButtonSx = {
    appearance: "none",
    background: "none",
    border: 0,
    margin: 0,
    padding: 0,
    font: "inherit",
    // A button resets these two to its own defaults; a title that is uppercase or
    // tracked in its row must stay that way as a button.
    textTransform: "inherit",
    letterSpacing: "inherit",
    color: "inherit",
    textAlign: "inherit",
    textDecoration: "none",
    cursor: "pointer",
    boxSizing: "border-box",
    borderRadius: g.radius.xs,
    WebkitTapHighlightColor: "transparent",
    "&:focus": { outline: "none" },
    "&:focus-visible": focusRing,
    "&:disabled": { cursor: "default" },
} as const;
