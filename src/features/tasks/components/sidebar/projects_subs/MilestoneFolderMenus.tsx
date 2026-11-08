import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import StarOutlineRoundedIcon from "@mui/icons-material/StarOutlineRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { Dropdown, IconButton, MenuButton } from "@mui/joy";

import {
    MenuDivider,
    MenuGroupLabel,
    MenuRow,
    MenuSurface,
} from "../../../../../components/ui/MoreMenu";
import { useTranslation } from "../../../../../i18n";
import { g } from "../../../../../theme/tokens";
import { MilestoneFolder } from "../../../sprint-milestone/types";

// The "..." menus of the milestone sidebar (MIP-847). Both stop the click
// from reaching the row underneath, which would open the milestone or toggle
// the folder.

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

// The amber the notes sidebar's favorite stars use.
export const FAVORITE_COLOR = g.warning.solid;

type MilestoneRowMenuProps = {
    milestoneTitle: string;
    currentFolderId: number | null;
    folders: MilestoneFolder[];
    onMoveToFolder: (folderId: number | null) => void;
    /** False for a Past milestone, which keeps its folder but is not filed from
     *  here: the menu then holds only the favorite item. */
    canMove?: boolean;
    isFavorited: boolean;
    onToggleFavorite: () => void;
};

/** One milestone's row menu: add / remove it from the user's favorites (MIP-1053)
 *  and "Move to folder". This menu is also the only way to file a milestone on a
 *  phone, where there is no drag. */
export const MilestoneRowMenu = ({
    milestoneTitle,
    currentFolderId,
    folders,
    onMoveToFolder,
    canMove = true,
    isFavorited,
    onToggleFavorite,
}: MilestoneRowMenuProps) => {
    const { t } = useTranslation();
    return (
        <Dropdown>
            <MenuButton
                aria-label={`${t.tasks.folders.moveActions}: ${milestoneTitle}`}
                size="sm"
                slotProps={{ root: { variant: "plain", color: "neutral", size: "sm" } }}
                slots={{ root: IconButton }}
                onClick={stop}
            >
                <MoreHorizRoundedIcon sx={{ fontSize: 16 }} />
            </MenuButton>
            <MenuSurface placement="bottom-end" zIndex={10010}>
                <MenuRow
                    icon={
                        isFavorited ? (
                            <StarRoundedIcon sx={{ color: FAVORITE_COLOR }} />
                        ) : (
                            <StarOutlineRoundedIcon />
                        )
                    }
                    onClick={onToggleFavorite}
                >
                    {isFavorited
                        ? t.tasks.sidebar.removeFromFavorites
                        : t.tasks.sidebar.addToFavorites}
                </MenuRow>
                {canMove && (
                    <>
                        <MenuDivider />
                        <MenuGroupLabel>{t.tasks.folders.moveToFolder}</MenuGroupLabel>
                        <MenuRow
                            disabled={currentFolderId == null}
                            selected={currentFolderId == null}
                            onClick={() => onMoveToFolder(null)}
                        >
                            {t.tasks.folders.noFolder}
                        </MenuRow>
                        {folders.map((f) => (
                            <MenuRow
                                key={f.folderId}
                                disabled={f.folderId === currentFolderId}
                                selected={f.folderId === currentFolderId}
                                onClick={() => onMoveToFolder(f.folderId)}
                            >
                                {f.name}
                            </MenuRow>
                        ))}
                    </>
                )}
            </MenuSurface>
        </Dropdown>
    );
};

/** The star that sits beside the "..." menu on a milestone row. It shows with the
 *  row's other actions (hover, keyboard focus, always on touch): the row's CSS
 *  reveals every button in the row's end action. A starred row also carries a
 *  small star after its title (`FavoriteMark`), so the state reads without
 *  hovering. */
export const MilestoneFavoriteStar = ({
    milestoneTitle,
    isFavorited,
    onToggle,
}: {
    milestoneTitle: string;
    isFavorited: boolean;
    onToggle: () => void;
}) => {
    const { t } = useTranslation();
    const label = isFavorited
        ? t.tasks.sidebar.removeFromFavorites
        : t.tasks.sidebar.addToFavorites;
    return (
        <IconButton
            aria-label={`${label}: ${milestoneTitle}`}
            aria-pressed={isFavorited}
            color="neutral"
            data-testid="milestone-favorite-star"
            size="sm"
            title={label}
            variant="plain"
            onClick={(e) => {
                stop(e);
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

/** The small filled star after the title of a starred milestone. */
export const FavoriteMark = () => (
    <StarRoundedIcon
        data-testid="milestone-favorite-mark"
        sx={{ fontSize: 12, color: FAVORITE_COLOR, flexShrink: 0 }}
        aria-hidden
    />
);

type FolderMenuProps = {
    folderName: string;
    onRename: () => void;
    onDelete: () => void;
};

/** Rename / delete one folder. Any project member may. */
export const FolderMenu = ({ folderName, onRename, onDelete }: FolderMenuProps) => {
    const { t } = useTranslation();
    return (
        <Dropdown>
            <MenuButton
                aria-label={`${t.tasks.folders.folderActions}: ${folderName}`}
                size="sm"
                slotProps={{ root: { variant: "plain", color: "neutral", size: "sm" } }}
                slots={{ root: IconButton }}
                onClick={stop}
            >
                <MoreHorizRoundedIcon sx={{ fontSize: 16 }} />
            </MenuButton>
            <MenuSurface placement="bottom-end" zIndex={10010}>
                <MenuRow onClick={onRename}>{t.tasks.folders.renameFolder}</MenuRow>
                <MenuDivider />
                <MenuRow danger onClick={onDelete}>
                    {t.tasks.folders.deleteFolder}
                </MenuRow>
            </MenuSurface>
        </Dropdown>
    );
};
