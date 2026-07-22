import { alpha } from "@mui/system";

type ProjectTagChipProps = {
    label: string;
    tagColor: string;
    isDark: boolean;
};

/**
 * Canonical **project-tag chip**. Source of the look is the task table's read
 * view (`DraggableTaskRow`); this component exists so every surface that shows
 * a project tag — table, sprint board, the dashboard's milestone card, and the
 * tag autocomplete — renders an identical chip.
 *
 * Deliberately a plain styled `<span>`, NOT a Joy/Material `<Chip>`: MUI's
 * `Chip` resolves default colors off the active theme's palette
 * (`palette.grey[700]` etc.), which is present in the table/board subtrees
 * (they wrap their own Material `ThemeProvider`) but NOT in the dashboard —
 * rendering a Material `<Chip>` there threw "Cannot read properties of
 * undefined (reading '700')". A span depends on no palette, so it's safe in
 * every subtree AND guarantees the four surfaces look identical (no Joy-vs-
 * Material engine differences).
 *
 * `isDark` is passed in rather than read via `useColorScheme()` so this stays a
 * leaf that doesn't subscribe to the color-scheme context per chip (the table
 * row, on the render hot path, already resolves the mode once).
 */
export const ProjectTagChip = ({ label, tagColor, isDark }: ProjectTagChipProps) => (
    <span
        style={{
            display: "inline-flex",
            alignItems: "center",
            boxSizing: "border-box",
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            borderStyle: "solid",
            borderWidth: 2,
            borderRadius: 6,
            borderColor: alpha(tagColor, isDark ? 0.6 : 0.8),
            backgroundColor: alpha(tagColor, isDark ? 0.1 : 0.05),
            color: isDark ? "#fff" : "#000",
            fontWeight: 600,
            fontSize: "0.7rem",
            lineHeight: 1.4,
            padding: "2px 8px",
        }}
    >
        {label}
    </span>
);
