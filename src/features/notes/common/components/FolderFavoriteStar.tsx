import StarOutlineRoundedIcon from "@mui/icons-material/StarOutlineRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { IconButton } from "@mui/joy";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";

// A folder row's favorite star (MIP-747): always shown once starred,
// otherwise revealed with the row's other actions on hover (the
// `folder-menu-btn` class), and always visible on touch.
export const FolderFavoriteStar = ({
    folderId,
    useNM,
    isDark,
}: {
    folderId: number;
    useNM: NoteManagementState;
    isDark: boolean;
}) => {
    const isFavorited = useNM.isFolderFavorited(folderId);
    return (
        <IconButton
            className={isFavorited ? undefined : "folder-menu-btn"}
            color="warning"
            data-testid={`folder-favorite-${folderId}`}
            size="sm"
            variant="plain"
            sx={{
                opacity: isFavorited ? 1 : 0,
                minWidth: 20,
                minHeight: 20,
                borderRadius: "4px",
                transition: "opacity 0.15s ease",
                "@media (hover: none)": { opacity: 1 },
            }}
            onClick={(e) => {
                e.stopPropagation();
                void useNM.toggleFolderFavorite(folderId);
            }}
        >
            {isFavorited ? (
                <StarRoundedIcon sx={{ fontSize: 14, color: "#f59e0b" }} />
            ) : (
                <StarOutlineRoundedIcon
                    sx={{
                        fontSize: 14,
                        color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)",
                    }}
                />
            )}
        </IconButton>
    );
};

// The flash a folder row gets when "jump to folder" lands on it.
export const highlightedFolderSx = (isDark: boolean) => ({
    backgroundColor: isDark
        ? "rgba(var(--gp-brandalt-400-rgb), 0.18)"
        : "rgba(var(--gp-brand-700-rgb), 0.12)",
});
