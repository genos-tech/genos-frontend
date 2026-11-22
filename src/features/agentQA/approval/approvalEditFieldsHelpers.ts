import { focusRing, g } from "../../../theme/tokens";

export const controlSx = (invalid: boolean) => ({
    width: "100%",
    boxSizing: "border-box" as const,
    font: "inherit",
    // 16px on a phone: smaller and iOS zooms the page when the field is focused.
    fontSize: { xs: "1rem", sm: "0.875rem" },
    px: 1,
    py: 0.625,
    borderRadius: "8px",
    border: "1px solid",
    borderColor: invalid ? g.danger.text : g.border.default,
    background: g.surface.default,
    color: g.text.primary,
    "&:focus": {
        ...focusRing,
        outlineOffset: 0,
        ...(invalid ? { outlineColor: g.danger.solid } : {}),
        borderColor: invalid ? g.danger.text : g.focus,
    },
});
