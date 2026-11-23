import { g } from "../../theme/tokens";

/** The hairline between two rows of a Today list (same token as the other Task Stats lists). */
export const rowDivider = {
    borderBottom: `1px solid ${g.border.subtle}`,
    "&:last-child": { borderBottom: "none" },
} as const;

/**
 * One height for every row of a Today list (MIP-2213): a task row (two lines: title, then project
 * and why) and a plain row (a request, a mention, a note) are the same size whatever they hold,
 * so a list never steps up and down.
 */
export const ROW_MIN_HEIGHT = 60;
