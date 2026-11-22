import { g } from "../../theme/tokens";

/** The hairline between two rows of a Today list (same token as the other Task Stats lists). */
export const rowDivider = {
    borderBottom: `1px solid ${g.border.subtle}`,
    "&:last-child": { borderBottom: "none" },
} as const;
