import { NoteFolderTagProps } from "../../../../types/notes";

// Chip styling shared by this dialog and the sidebar folder rows.
// Mirrors `ProjectLabelChips` so folder tags and project labels read as
// one visual family — the reference this was asked to match.
export const folderTagChipSx = (
    tag: Pick<NoteFolderTagProps, "color" | "textColor">,
    size: "sm" | "md" = "sm"
) => ({
    backgroundColor: tag.color ?? DEFAULT_COLOR,
    color: tag.textColor ?? DEFAULT_TEXT_COLOR,
    borderRadius: "5px",
    fontWeight: 600,
    fontSize: size === "sm" ? "0.625rem" : "0.7rem",
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

export const DEFAULT_COLOR = "#8e23ff";

export const DEFAULT_TEXT_COLOR = "white";
