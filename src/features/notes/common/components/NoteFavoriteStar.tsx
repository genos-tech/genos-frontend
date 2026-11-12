import StarOutlineRoundedIcon from "@mui/icons-material/StarOutlineRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { IconButton } from "@mui/joy";

import { NAV_KEEP_CLASS } from "../../../../components/ui/nav/navStyles";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";

/**
 * A note row's favorite star (MIP-1430): a lit star stays visible, an unlit one appears with
 * the row's other actions on hover or focus, and always on touch.
 *
 * One component for the tree rows and Recents, so the star has one name ("Add to favorites" /
 * "Remove from favorites"). It used to be an unnamed button: a screen reader said "button".
 * `noteType` is the row's sidebar bucket, as everywhere in the note sidebar.
 */
export const NoteFavoriteStar = ({
    noteId,
    noteType,
    useNM,
}: {
    noteId: number;
    noteType: number;
    useNM: NoteManagementState;
}) => {
    const { t } = useTranslation();
    const isFavorited = useNM.isNoteFavorited(noteId, noteType);
    return (
        <IconButton
            className={`favorite-btn${isFavorited ? ` ${NAV_KEEP_CLASS}` : ""}`}
            size="sm"
            variant="plain"
            aria-label={
                isFavorited ? t.notes.sidebar.removeFromFavorites : t.notes.sidebar.addToFavorites
            }
            sx={{
                minWidth: 20,
                minHeight: 20,
                borderRadius: g.radius.xs,
                "--IconButton-size": "20px",
            }}
            onClick={(e) => {
                e.stopPropagation();
                void useNM.toggleFavorite(noteId, noteType);
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
