import { FocusEvent, useRef } from "react";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import StarOutlineRoundedIcon from "@mui/icons-material/StarOutlineRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { Dropdown, IconButton, MenuButton, Stack } from "@mui/joy";

import {
    MenuDivider,
    MenuGroupLabel,
    MenuRow,
    MenuSurface,
} from "../../../../../components/ui/MoreMenu";
import { useTranslation } from "../../../../../i18n";
import { g } from "../../../../../theme/tokens";
import { MilestoneFolder } from "../../../sprint-milestone/types";
import { ROW_ACTIONS_ENGAGED_ATTR } from "./milestoneRowEngaged";

// The "..." menus of the milestone sidebar (MIP-847). Both stop the click
// from reaching the row underneath, which would open the milestone or toggle
// the folder.

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

// Joy's plain neutral icon is ~3:1 on the row, which read as "invisible" (MIP-1156): the row
// actions use the secondary text role. `--Icon-color` too: Joy icons colour themselves from it.
const ACTION_ICON_SX = { color: g.text.secondary, "--Icon-color": g.text.secondary } as const;

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
    /** The menu opened or closed (the row keeps its actions showing while it is open). */
    onOpenChange?: (open: boolean) => void;
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
    onOpenChange,
}: MilestoneRowMenuProps) => {
    const { t } = useTranslation();
    return (
        <Dropdown onOpenChange={onOpenChange && ((_, open) => onOpenChange(open))}>
            <MenuButton
                aria-label={`${t.tasks.folders.moveActions}: ${milestoneTitle}`}
                size="sm"
                slots={{ root: IconButton }}
                slotProps={{
                    root: { variant: "plain", color: "neutral", size: "sm", sx: ACTION_ICON_SX },
                }}
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

/** The star button beside the "..." menu on a milestone row. `MilestoneRowActions` renders it
 *  only while the milestone is not a favorite: a favorite carries a small lit star after its
 *  title (`FavoriteMark`) and un-stars from the menu. */
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
            sx={ACTION_ICON_SX}
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

/** The actions at a milestone row's end: the star (only while the milestone is NOT a
 *  favorite: a favorite shows its lit star after the title at rest, and the menu holds
 *  "Remove from favorites") and the "..." menu. They take the place of the progress counter
 *  (and of a favorite's small star) while the row is hovered, focused or has its menu open,
 *  so they never overlap anything (MIP-1156).
 *
 *  Keyboard focus and the open menu are told to the row through `ROW_ACTIONS_ENGAGED_ATTR`
 *  on its `li`, written straight to the DOM: it changes on every Tab stop and menu toggle,
 *  and a state change would re-render the whole milestone tree for it (MIP-904). */
export const MilestoneRowActions = ({
    milestoneTitle,
    isFavorited,
    onToggleFavorite,
    ...menu
}: {
    milestoneTitle: string;
    isFavorited: boolean;
    onToggleFavorite: () => void;
} & Omit<MilestoneRowMenuProps, "milestoneTitle" | "isFavorited" | "onToggleFavorite">) => {
    const ref = useRef<HTMLDivElement>(null);
    const engaged = useRef({ focus: false, menu: false });
    const sync = () => {
        const row = ref.current?.closest("li");
        if (!row) return;
        const { focus, menu: open } = engaged.current;
        if (focus || open) row.setAttribute(ROW_ACTIONS_ENGAGED_ATTR, "");
        else row.removeAttribute(ROW_ACTIONS_ENGAGED_ATTR);
    };
    // Only the keyboard ring counts: a mouse click on a button leaves it focused, and the
    // row would stay given way after the pointer left.
    const onFocus = (e: FocusEvent<HTMLElement>) => {
        let visible = false;
        try {
            visible = e.target.matches(":focus-visible");
        } catch {
            // A browser without :focus-visible: no keyboard state, hover still works.
        }
        engaged.current.focus = visible;
        sync();
    };
    const onBlur = (e: FocusEvent<HTMLElement>) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        engaged.current.focus = false;
        sync();
    };
    return (
        <Stack ref={ref} alignItems="center" direction="row" onBlur={onBlur} onFocus={onFocus}>
            {!isFavorited && (
                <MilestoneFavoriteStar
                    isFavorited={isFavorited}
                    milestoneTitle={milestoneTitle}
                    onToggle={() => {
                        onToggleFavorite();
                        // The star is gone once it has done its job: keep keyboard focus in
                        // the actions (on the menu button) instead of dropping it to <body>.
                        ref.current
                            ?.querySelector<HTMLElement>('button[aria-haspopup="menu"]')
                            ?.focus();
                    }}
                />
            )}
            <MilestoneRowMenu
                {...menu}
                isFavorited={isFavorited}
                milestoneTitle={milestoneTitle}
                onToggleFavorite={onToggleFavorite}
                onOpenChange={(open) => {
                    engaged.current.menu = open;
                    sync();
                }}
            />
        </Stack>
    );
};

/** The small filled star after the title of a starred milestone. */
export const FavoriteMark = ({ className }: { className?: string }) => (
    <StarRoundedIcon
        className={className}
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
