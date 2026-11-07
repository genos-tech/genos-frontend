import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import StarOutlineRoundedIcon from "@mui/icons-material/StarOutlineRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import {
    Dropdown,
    IconButton,
    ListDivider,
    Menu,
    MenuButton,
    MenuItem,
    Typography,
} from "@mui/joy";

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
            <Menu
                placement="bottom-end"
                size="sm"
                sx={{ zIndex: 10010, minWidth: 180 }}
                onClick={stop}
            >
                <MenuItem onClick={onToggleFavorite}>
                    {isFavorited ? (
                        <StarRoundedIcon sx={{ fontSize: 16, color: FAVORITE_COLOR }} />
                    ) : (
                        <StarOutlineRoundedIcon sx={{ fontSize: 16 }} />
                    )}
                    {isFavorited
                        ? t.tasks.sidebar.removeFromFavorites
                        : t.tasks.sidebar.addToFavorites}
                </MenuItem>
                {canMove && (
                    <>
                        <ListDivider />
                        <Typography level="body-xs" sx={{ opacity: 0.6, px: 1.5, py: 0.5 }}>
                            {t.tasks.folders.moveToFolder}
                        </Typography>
                        <MenuItem
                            disabled={currentFolderId == null}
                            onClick={() => onMoveToFolder(null)}
                        >
                            {currentFolderId == null && <CheckRoundedIcon sx={{ fontSize: 16 }} />}
                            {t.tasks.folders.noFolder}
                        </MenuItem>
                        {folders.map((f) => (
                            <MenuItem
                                key={f.folderId}
                                disabled={f.folderId === currentFolderId}
                                onClick={() => onMoveToFolder(f.folderId)}
                            >
                                {f.folderId === currentFolderId && (
                                    <CheckRoundedIcon sx={{ fontSize: 16 }} />
                                )}
                                {f.name}
                            </MenuItem>
                        ))}
                    </>
                )}
            </Menu>
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
            <Menu placement="bottom-end" size="sm" sx={{ zIndex: 10010 }} onClick={stop}>
                <MenuItem onClick={onRename}>{t.tasks.folders.renameFolder}</MenuItem>
                <ListDivider />
                <MenuItem color="danger" onClick={onDelete}>
                    {t.tasks.folders.deleteFolder}
                </MenuItem>
            </Menu>
        </Dropdown>
    );
};
