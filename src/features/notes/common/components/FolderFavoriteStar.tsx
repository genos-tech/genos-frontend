import StarOutlineRoundedIcon from "@mui/icons-material/StarOutlineRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { IconButton } from "@mui/joy";

import { NAV_KEEP_CLASS } from "../../../../components/ui/nav/navStyles";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { g } from "../../../../theme/tokens";

// A folder row's favorite star (MIP-747): always shown once starred
// (NAV_KEEP_CLASS opts it out of the row's action fade), otherwise revealed
// with the row's other actions on hover or focus, and always visible on touch.
export const FolderFavoriteStar = ({
    folderId,
    useNM,
}: {
    folderId: number;
    useNM: NoteManagementState;
}) => {
    const isFavorited = useNM.isFolderFavorited(folderId);
    return (
        <IconButton
            className={isFavorited ? NAV_KEEP_CLASS : undefined}
            data-testid={`folder-favorite-${folderId}`}
            size="sm"
            variant="plain"
            sx={{
                minWidth: 20,
                minHeight: 20,
                borderRadius: g.radius.xs,
                "--IconButton-size": "20px",
            }}
            onClick={(e) => {
                e.stopPropagation();
                void useNM.toggleFolderFavorite(folderId);
            }}
        >
            {isFavorited ? (
                <StarRoundedIcon sx={{ fontSize: 14, color: g.warning.solid }} />
            ) : (
                <StarOutlineRoundedIcon sx={{ fontSize: 14, color: g.text.tertiary }} />
            )}
        </IconButton>
    );
};

// The flash a folder row gets when "jump to folder" lands on it: the accent
// tint (the same role as a selected row).
export const highlightedFolderSx = {
    background: g.accent.subtle,
} as const;
