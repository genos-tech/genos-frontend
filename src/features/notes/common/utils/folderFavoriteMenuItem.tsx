import StarOutlineRoundedIcon from "@mui/icons-material/StarOutlineRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";

import type { MoreMenuItem } from "../../../../components/ui/MoreMenu";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { g } from "../../../../theme/tokens";

/**
 * "Add to favorites" / "Remove from favorites" for a folder's "..." menu (MIP-1430). The
 * star on the row is hover-only on a pointer device, so the menu is where a keyboard or a
 * person scanning the actions finds it, as they do on a note row.
 */
export const folderFavoriteMenuItem = (
    folderId: number,
    useNM: NoteManagementState,
    labels: { add: string; remove: string }
): MoreMenuItem => {
    const isFavorited = useNM.isFolderFavorited(folderId);
    return {
        id: "favorite",
        kind: "favorite",
        label: isFavorited ? labels.remove : labels.add,
        icon: isFavorited ? (
            <StarRoundedIcon sx={{ fontSize: 16, color: g.warning.solid }} />
        ) : (
            <StarOutlineRoundedIcon sx={{ fontSize: 16 }} />
        ),
        onClick: () => void useNM.toggleFolderFavorite(folderId),
    };
};
