import { Box, Chip } from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { ProjectLabelProps } from "../../../../types/tasks";

type ProjectLabelChipsProps = {
    labels: ProjectLabelProps[];
    /**
     * Cap on how many chips render before collapsing into a `+N` pill.
     * The sidebar passes 1 — the row is narrow and the project NAME is
     * what the user is scanning for, so a second chip would eat the
     * name's truncation budget. The profile modal passes Infinity: it
     * has the width and the user is there to read the labels.
     */
    max?: number;
    size?: "sm" | "md";
};

const chipSx = (label: ProjectLabelProps, size: "sm" | "md") => ({
    backgroundColor: label.color,
    color: label.textColor,
    borderRadius: "5px",
    fontWeight: 600,
    fontSize: size === "sm" ? "0.625rem" : "0.7rem",
    // Never let a long label push the project name out of the row —
    // the chip truncates first, the name keeps its space.
    maxWidth: size === "sm" ? 84 : 200,
    flexShrink: 0,
    "--Chip-paddingInline": size === "sm" ? "6px" : "8px",
    "--Chip-minHeight": size === "sm" ? "16px" : "20px",
    "& .MuiChip-label": {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
});

/**
 * Read-only chip row for a project's team-scoped labels.
 *
 * Renders nothing at all when the project has no labels — callers can
 * drop it inline without guarding, and an unlabelled project keeps
 * exactly its previous layout (no empty gap in the sidebar row).
 */
export const ProjectLabelChips = ({
    labels,
    max = Infinity,
    size = "sm",
}: ProjectLabelChipsProps) => {
    if (!labels || labels.length === 0) return null;

    const shown = labels.slice(0, max);
    const overflow = labels.length - shown.length;
    // The full list always reaches the user through the tooltip, so
    // collapsing to `+N` hides a count, never a name.
    const allNames = labels.map((l) => l.name).join(", ");

    return (
        <AppTooltip size="sm" title={allNames}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.375, minWidth: 0 }}>
                {shown.map((label) => (
                    <Chip key={label.labelId} size="sm" sx={chipSx(label, size)} variant="solid">
                        {label.name}
                    </Chip>
                ))}
                {overflow > 0 && (
                    <Chip
                        size="sm"
                        variant="soft"
                        sx={{
                            borderRadius: "5px",
                            fontWeight: 600,
                            fontSize: size === "sm" ? "0.625rem" : "0.7rem",
                            flexShrink: 0,
                            "--Chip-paddingInline": "5px",
                            "--Chip-minHeight": size === "sm" ? "16px" : "20px",
                        }}
                    >
                        {`+${overflow}`}
                    </Chip>
                )}
            </Box>
        </AppTooltip>
    );
};
