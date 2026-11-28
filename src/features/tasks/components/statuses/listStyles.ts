/** The list shapes the statuses editor and the rule builder share. */
import { g } from "../../../../theme/tokens";

export const rowSx = {
    display: "flex",
    alignItems: "center",
    gap: 1,
    minHeight: 44,
    paddingInlineStart: 0.75,
    paddingInlineEnd: 0.5,
    "&:not(:first-of-type)": { borderTop: `1px solid ${g.border.subtle}` },
} as const;

export const srOnly = {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
} as const;
