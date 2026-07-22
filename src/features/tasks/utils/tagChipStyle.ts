import { alpha } from "@mui/system";

/**
 * Canonical **project-tag chip** style. Source of truth is the task table's
 * read view (`DraggableTaskRow`); this helper exists so every surface that
 * renders a project tag — table, sprint board, the dashboard's milestone
 * card, and the tag autocomplete — reads identically instead of each
 * re-deriving slightly different radii / border widths / opacities.
 *
 * Pass `isDark` in rather than calling `useColorScheme()` per chip: callers
 * (notably `DraggableTaskRow`, on the render hot path) already resolve the
 * color mode once per row, and a chip is a leaf that shouldn't subscribe to
 * the color-scheme context on its own.
 *
 * Returns an `sx` object; apply to a `<Chip variant="outlined" size="small">`
 * (Joy or Material — the tokens are plain CSS and work on both).
 */
export const projectTagChipSx = (tagColor: string, isDark: boolean) => ({
    color: isDark ? "white" : "black",
    fontWeight: 600,
    borderRadius: "6px",
    borderWidth: "2px",
    borderColor: alpha(tagColor, isDark ? 0.6 : 0.8),
    fontSize: "0.7rem",
    backgroundColor: alpha(tagColor, isDark ? 0.1 : 0.05),
});
