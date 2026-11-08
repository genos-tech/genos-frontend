import { g } from "../../../theme/tokens";

/**
 * The field surface, from tokens. Applied to the Joy `Input` root here and to
 * `Autocomplete` roots that look like a search box.
 */
export const searchSurfaceSx = {
    "--Input-radius": g.radius.md,
    "--Input-focusedThickness": "1px",
    "--Input-focusedHighlight": g.focus,
    "--Input-placeholderOpacity": 1,
    "--Input-placeholderColor": g.text.tertiary,
    "--Icon-color": g.text.tertiary,
    borderRadius: g.radius.md,
    background: g.surface.default,
    border: `1px solid ${g.border.default}`,
    color: g.text.primary,
    transitionProperty: "background-color, border-color, box-shadow",
    transitionDuration: g.motion.fast,
    transitionTimingFunction: g.ease,
    "&:hover": { borderColor: g.border.strong },
    "&:focus-within": { borderColor: g.focus },
} as const;
