import StarOutlineRoundedIcon from "@mui/icons-material/StarOutlineRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { IconButton } from "@mui/joy";

import { useTranslation } from "../../../../../i18n";
import { g } from "../../../../../theme/tokens";
import { FAVORITE_COLOR } from "./MilestoneFolderMenus";

// The star beside a project row in the Tasks sidebar (MIP-1695). It sits in the
// row's actions slot, which overlays the row's end (the title does not move):
// hidden at rest on a mouse, shown on hover or focus. A starred project also
// gets `ProjectFavoriteMark` after its name, so the pin reads at rest. Stops the
// click so it neither opens the project nor toggles its section.
export const ProjectFavoriteStar = ({
    projectName,
    isFavorited,
    onToggle,
}: {
    projectName: string;
    isFavorited: boolean;
    onToggle: () => void;
}) => {
    const { t } = useTranslation();
    const label = isFavorited
        ? t.tasks.sidebar.removeFromFavorites
        : t.tasks.sidebar.addToFavorites;
    return (
        <IconButton
            aria-label={`${label}: ${projectName}`}
            aria-pressed={isFavorited}
            color="neutral"
            data-testid="project-favorite-star"
            size="sm"
            title={label}
            variant="plain"
            sx={{
                color: g.text.secondary,
                "--Icon-color": g.text.secondary,
                "--IconButton-size": "28px",
            }}
            onClick={(e) => {
                e.stopPropagation();
                onToggle();
            }}
        >
            {isFavorited ? (
                <StarRoundedIcon sx={{ fontSize: 16, color: FAVORITE_COLOR }} />
            ) : (
                <StarOutlineRoundedIcon sx={{ fontSize: 16 }} />
            )}
        </IconButton>
    );
};

/** The small lit star after a starred project's name (MIP-1695). Decorative: the
 *  star button carries the state for assistive tech. */
export const ProjectFavoriteMark = ({ className }: { className?: string }) => (
    <StarRoundedIcon
        aria-hidden="true"
        className={className}
        data-testid="project-favorite-mark"
        sx={{ fontSize: 12, color: FAVORITE_COLOR, flexShrink: 0 }}
    />
);
